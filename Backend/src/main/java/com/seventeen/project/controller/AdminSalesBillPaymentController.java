package com.seventeen.project.controller;

import com.seventeen.project.service.SalesBillingService;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Admin review of evidence attached to DIRECT sales bills.
 * Does not modify wholesale order payment records.
 */
@RestController
@RequestMapping("/api/admin/sales-bill-payments")
@PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ADMIN')")
public class AdminSalesBillPaymentController {

    private final JdbcTemplate jdbc;
    private final SalesBillingService billingService;

    public AdminSalesBillPaymentController(
        JdbcTemplate jdbc,
        SalesBillingService billingService
    ) {
        this.jdbc = jdbc;
        this.billingService = billingService;
    }

    private ResponseStatusException fail(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    private long adminId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw fail(HttpStatus.UNAUTHORIZED, "Admin authentication required");
        }
        List<Long> ids = jdbc.queryForList(
            """
            SELECT id FROM public.app_users
            WHERE LOWER(email) = LOWER(?)
              AND role = 'ADMIN'
              AND enabled = TRUE
            """,
            Long.class, authentication.getName()
        );
        if (ids.isEmpty()) {
            throw fail(HttpStatus.FORBIDDEN, "Active Admin account required");
        }
        return ids.get(0);
    }

    // Never return proof_data as part of the list or status JSON.
    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> listPayments(
        Authentication authentication
    ) {
        adminId(authentication);
        List<Map<String, Object>> records = jdbc.queryForList(
            """
            SELECT
                p.id AS "id",
                p.bill_id AS "billId",
                ('INV-' || b.id) AS "invoiceNumber",
                b.customer_name AS "customerName",
                b.customer_phone AS "customerPhone",
                b.total_amount AS "invoiceTotal",
                b.payment_method AS "invoicePaymentMethod",
                b.payment_status AS "invoicePaymentStatus",
                p.method AS "method",
                p.amount AS "amount",
                p.status AS "status",
                p.transfer_reference AS "transferReference",
                p.cheque_number AS "chequeNumber",
                p.issuing_bank AS "issuingBank",
                p.cheque_date AS "chequeDate",
                p.proof_original_name AS "proofOriginalName",
                p.proof_content_type AS "proofContentType",
                p.rejection_reason AS "rejectionReason",
                p.submitted_by AS "submittedBy",
                p.reviewed_by AS "reviewedBy",
                p.created_at AS "createdAt",
                p.reviewed_at AS "reviewedAt",
                p.confirmed_at AS "confirmedAt"
            FROM public.sales_bill_payment_proofs p
            JOIN public.sales_bills b ON b.id = p.bill_id
            ORDER BY p.created_at DESC, p.id DESC
            """
        );
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(records);
    }

    @GetMapping("/{paymentId:[0-9]+}/proof")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> viewProof(
        Authentication authentication,
        @PathVariable long paymentId
    ) {
        adminId(authentication);
        List<Map<String, Object>> found = jdbc.queryForList(
            """
            SELECT proof_data, proof_content_type
            FROM public.sales_bill_payment_proofs
            WHERE id = ?
            """,
            paymentId
        );
        if (found.isEmpty()) {
            throw fail(HttpStatus.NOT_FOUND, "Payment proof not found");
        }
        byte[] bytes = (byte[]) found.get(0).get("proof_data");
        String mime = String.valueOf(found.get(0).get("proof_content_type"));
        if (bytes == null || bytes.length == 0) {
            throw fail(HttpStatus.NOT_FOUND, "Proof file is unavailable");
        }
        if (!List.of("application/pdf", "image/png", "image/jpeg", "image/jpg")
                .contains(mime.toLowerCase(java.util.Locale.ROOT))) {
            throw fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported stored proof type");
        }
        MediaType type = MediaType.parseMediaType(
            mime.equalsIgnoreCase("image/jpg") ? "image/jpeg" : mime
        );
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .contentType(type)
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
            .header("X-Content-Type-Options", "nosniff")
            .body(bytes);
    }

    /**
     * For BANK_TRANSFER, approve means bank deposit fully verified => CONFIRMED.
     * For CHEQUE, approve means document checked => APPROVED (not paid yet).
     */
    @PostMapping("/{paymentId:[0-9]+}/approve")
    @Transactional
    public Map<String, Object> approve(
        Authentication authentication,
        @PathVariable long paymentId
    ) {
        long reviewerId = adminId(authentication);
        Map<String, Object> record = lockPaymentWithBill(paymentId);
        String method = String.valueOf(record.get("method"));
        String status = String.valueOf(record.get("status"));
        long billId = ((Number) record.get("bill_id")).longValue();
        checkFullInvoiceAmount(record);

        if ("BANK_TRANSFER".equals(method)) {
            if ("CONFIRMED".equals(status)) {
                return details(paymentId); // Idempotent retry.
            }
            requireStatus(status, "PENDING_REVIEW");
            assertNoConfirmedOrOtherActivePayments(billId, paymentId);
            int rows = jdbc.update(
                """
                UPDATE public.sales_bill_payment_proofs
                SET status = 'CONFIRMED', reviewed_by = ?,
                    reviewed_at = NOW(), confirmed_at = NOW(),
                    rejection_reason = NULL
                WHERE id = ? AND status = 'PENDING_REVIEW'
                """, reviewerId, paymentId
            );
            if (rows != 1) throw fail(HttpStatus.CONFLICT, "Payment status changed");
            billingService.refreshPaymentStatus(billId);
            return details(paymentId);
        }

        if ("CHEQUE".equals(method)) {
            if ("APPROVED".equals(status) || "CONFIRMED".equals(status)) {
                return details(paymentId); // No duplicate credit.
            }
            requireStatus(status, "PENDING_REVIEW");
            assertNoConfirmedOrOtherActivePayments(billId, paymentId);
            int rows = jdbc.update(
                """
                UPDATE public.sales_bill_payment_proofs
                SET status = 'APPROVED', reviewed_by = ?,
                    reviewed_at = NOW(), rejection_reason = NULL
                WHERE id = ? AND status = 'PENDING_REVIEW'
                """, reviewerId, paymentId
            );
            if (rows != 1) throw fail(HttpStatus.CONFLICT, "Payment status changed");
            // IMPORTANT: cheque approval alone does not mark the invoice PAID.
            return details(paymentId);
        }
        throw fail(HttpStatus.CONFLICT, "Unsupported direct-sales payment method");
    }

    /** Only a bank-cleared, previously APPROVED cheque is counted as paid. */
    @PostMapping("/{paymentId:[0-9]+}/confirm-cleared")
    @Transactional
    public Map<String, Object> confirmCleared(
        Authentication authentication,
        @PathVariable long paymentId
    ) {
        long reviewerId = adminId(authentication);
        Map<String, Object> record = lockPaymentWithBill(paymentId);
        String method = String.valueOf(record.get("method"));
        String status = String.valueOf(record.get("status"));
        long billId = ((Number) record.get("bill_id")).longValue();

        if (!"CHEQUE".equals(method)) {
            throw fail(HttpStatus.BAD_REQUEST, "Only cheques require bank clearance");
        }
        if ("CONFIRMED".equals(status)) return details(paymentId);
        requireStatus(status, "APPROVED");
        checkFullInvoiceAmount(record);
        assertNoConfirmedOrOtherActivePayments(billId, paymentId);

        int rows = jdbc.update(
            """
            UPDATE public.sales_bill_payment_proofs
            SET status = 'CONFIRMED', reviewed_by = ?,
                confirmed_at = NOW(), rejection_reason = NULL
            WHERE id = ? AND status = 'APPROVED'
            """, reviewerId, paymentId
        );
        if (rows != 1) throw fail(HttpStatus.CONFLICT, "Cheque status changed");
        billingService.refreshPaymentStatus(billId);
        return details(paymentId);
    }

    public record RejectRequest(String reason) {}

    @PostMapping("/{paymentId:[0-9]+}/reject")
    @Transactional
    public Map<String, Object> reject(
        Authentication authentication,
        @PathVariable long paymentId,
        @RequestBody RejectRequest request
    ) {
        long reviewerId = adminId(authentication);
        if (request == null || request.reason() == null ||
            request.reason().isBlank() || request.reason().trim().length() > 500) {
            throw fail(HttpStatus.BAD_REQUEST, "A rejection reason (up to 500 characters) is required");
        }
        Map<String, Object> record = lockPaymentWithBill(paymentId);
        String status = String.valueOf(record.get("status"));
        if ("REJECTED".equals(status)) return details(paymentId);
        if (!"PENDING_REVIEW".equals(status) && !"APPROVED".equals(status)) {
            throw fail(HttpStatus.CONFLICT, "Confirmed payments cannot be rejected here");
        }
        int rows = jdbc.update(
            """
            UPDATE public.sales_bill_payment_proofs
            SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(),
                rejection_reason = ?
            WHERE id = ? AND status IN ('PENDING_REVIEW', 'APPROVED')
            """, reviewerId, request.reason().trim(), paymentId
        );
        if (rows != 1) throw fail(HttpStatus.CONFLICT, "Payment status changed");
        return details(paymentId);
    }

    /**
     * Read bill id, lock invoice FIRST (same order as upload/cash),
     * then lock payment evidence; serialize all approvals for a bill.
     */
    private Map<String, Object> lockPaymentWithBill(long paymentId) {
        List<Long> ids = jdbc.queryForList(
            "SELECT bill_id FROM public.sales_bill_payment_proofs WHERE id = ?",
            Long.class, paymentId
        );
        if (ids.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "Payment record not found");
        long billId = ids.get(0);
        List<Long> lockedBills = jdbc.queryForList(
            "SELECT id FROM public.sales_bills WHERE id = ? FOR UPDATE",
            Long.class, billId
        );
        if (lockedBills.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "Sales invoice not found");
        List<Map<String, Object>> rows = jdbc.queryForList(
            """
            SELECT p.id, p.bill_id, p.method, p.amount, p.status,
                   b.total_amount, b.payment_method
            FROM public.sales_bill_payment_proofs p
            JOIN public.sales_bills b ON b.id = p.bill_id
            WHERE p.id = ? AND p.bill_id = ?
            FOR UPDATE OF p
            """, paymentId, billId
        );
        if (rows.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "Payment record not found");
        return rows.get(0);
    }

    private void checkFullInvoiceAmount(Map<String, Object> record) {
        BigDecimal claimed = (BigDecimal) record.get("amount");
        BigDecimal total = (BigDecimal) record.get("total_amount");
        if (claimed == null || total == null || claimed.compareTo(total) != 0) {
            throw fail(HttpStatus.CONFLICT, "Payment must match the entire invoice total");
        }
        if (!String.valueOf(record.get("method"))
                .equals(String.valueOf(record.get("payment_method")))) {
            throw fail(HttpStatus.CONFLICT, "Payment method differs from original invoice");
        }
    }

    private void requireStatus(String actual, String needed) {
        if (!needed.equals(actual)) {
            throw fail(HttpStatus.CONFLICT,
                "Expected payment status " + needed + ", found " + actual);
        }
    }

    private void assertNoConfirmedOrOtherActivePayments(long billId, long paymentId) {
        BigDecimal cash = jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(amount), 0)
            FROM public.sales_cash_collections
            WHERE source_type = 'DIRECT_BILL' AND source_id = ? AND status = 'CONFIRMED'
            """, BigDecimal.class, billId
        );
        if (cash != null && cash.signum() > 0) {
            throw fail(HttpStatus.CONFLICT,
                "Invoice already has confirmed cash; cannot confirm a full non-cash payment");
        }
        Integer other = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM public.sales_bill_payment_proofs
            WHERE bill_id = ? AND id <> ?
              AND status IN ('PENDING_REVIEW', 'APPROVED', 'CONFIRMED')
            """, Integer.class, billId, paymentId
        );
        if (other != null && other > 0) {
            throw fail(HttpStatus.CONFLICT, "Another active payment exists for this invoice");
        }
    }

    private Map<String, Object> details(long paymentId) {
        List<Map<String, Object>> records = jdbc.queryForList(
            """
            SELECT p.id AS "id", p.bill_id AS "billId",
                   ('INV-' || p.bill_id) AS "invoiceNumber",
                   p.method AS "method", p.amount AS "amount",
                   p.status AS "status", p.transfer_reference AS "transferReference",
                   p.cheque_number AS "chequeNumber", p.issuing_bank AS "issuingBank",
                   p.cheque_date AS "chequeDate", p.proof_original_name AS "proofOriginalName",
                   p.rejection_reason AS "rejectionReason", p.reviewed_by AS "reviewedBy",
                   p.reviewed_at AS "reviewedAt", p.confirmed_at AS "confirmedAt"
            FROM public.sales_bill_payment_proofs p
            WHERE p.id = ?
            """, paymentId
        );
        if (records.isEmpty()) throw fail(HttpStatus.NOT_FOUND, "Payment record not found");
        return new LinkedHashMap<>(records.get(0));
    }
}
