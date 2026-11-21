package com.seventeen.project.service;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SalesBillPaymentService {

    private static final long MAX_FILE_BYTES = 5L * 1024 * 1024;

    private final JdbcTemplate jdbc;
    private final SalesBillingService billingService;
    private final String accountName;
    private final String bankName;
    private final String bankBranch;
    private final String accountNumber;
    private final String chequePayeeName;

    public SalesBillPaymentService(
        JdbcTemplate jdbc,
        SalesBillingService billingService,
        @Value("Sathutu Sina Dairies") String accountName,
        @Value("Commercial Bank") String bankName,
        @Value("Galle Bazar") String bankBranch,
        @Value("91023456") String accountNumber,
        @Value("Sathutu Sina Dairies") String chequePayeeName
    ) {
        this.jdbc = jdbc;
        this.billingService = billingService;
        this.accountName = accountName;
        this.bankName = bankName;
        this.bankBranch = bankBranch;
        this.accountNumber = accountNumber;
        this.chequePayeeName = chequePayeeName;
    }

    private ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    private long salesUserId(String email) {
        List<Long> ids = jdbc.queryForList(
            """
            SELECT id FROM public.app_users
            WHERE LOWER(email) = LOWER(?)
              AND role = 'SALES_MANAGER'
              AND enabled = TRUE
            """, Long.class, email
        );
        if (ids.isEmpty()) {
            throw error(HttpStatus.FORBIDDEN, "Sales Manager account required");
        }
        return ids.get(0);
    }

    private Map<String, Object> ownedBill(
        long userId, long billId, boolean lock
    ) {
        String sql = """
            SELECT id, vehicle_id, sales_representative_id,
                   payment_method, total_amount
            FROM public.sales_bills
            WHERE id = ? AND sales_representative_id = ?
            """ + (lock ? " FOR UPDATE" : "");
        List<Map<String, Object>> rows = jdbc.queryForList(sql, billId, userId);
        if (rows.isEmpty()) {
            throw error(HttpStatus.NOT_FOUND, "Sales bill not found");
        }
        return rows.get(0);
    }

    private BigDecimal confirmedCash(long billId) {
        return jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(amount), 0)
            FROM public.sales_cash_collections
            WHERE source_type = 'DIRECT_BILL'
              AND source_id = ? AND status = 'CONFIRMED'
            """, BigDecimal.class, billId
        );
    }

    private BigDecimal confirmedNonCash(long billId) {
        return jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(amount), 0)
            FROM public.sales_bill_payment_proofs
            WHERE bill_id = ? AND status = 'CONFIRMED'
            """, BigDecimal.class, billId
        );
    }

    private String required(String value, String label, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isBlank() || normalized.length() > maxLength) {
            throw error(HttpStatus.BAD_REQUEST, label + " is required (max " + maxLength + " characters)");
        }
        return normalized;
    }

    private byte[] validatedProof(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_FILE_BYTES) {
            throw error(HttpStatus.BAD_REQUEST, "Upload a file up to 5 MB");
        }
        final byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw error(HttpStatus.BAD_REQUEST, "Unable to read uploaded file");
        }
        if (bytes.length == 0 || bytes.length > MAX_FILE_BYTES) {
            throw error(HttpStatus.BAD_REQUEST, "Invalid proof file size");
        }
        String mime = String.valueOf(file.getContentType()).toLowerCase(Locale.ROOT);
        boolean pdf = mime.equals("application/pdf") && bytes.length >= 5
            && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D'
            && bytes[3] == 'F' && bytes[4] == '-';
        boolean png = mime.equals("image/png") && bytes.length >= 8
            && (bytes[0] & 0xff) == 137 && bytes[1] == 'P'
            && bytes[2] == 'N' && bytes[3] == 'G'
            && (bytes[4] & 0xff) == 13 && (bytes[5] & 0xff) == 10
            && (bytes[6] & 0xff) == 26 && (bytes[7] & 0xff) == 10;
        boolean jpeg = (mime.equals("image/jpeg") || mime.equals("image/jpg"))
            && bytes.length >= 4
            && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8
            && (bytes[2] & 0xff) == 0xff && (bytes[bytes.length - 2] & 0xff) == 0xff
            && (bytes[bytes.length - 1] & 0xff) == 0xd9;
        if (!pdf && !png && !jpeg) {
            throw error(HttpStatus.BAD_REQUEST, "Only genuine PDF, PNG or JPEG proof files are allowed");
        }
        return bytes;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCompanyBankDetails(String email) {
        salesUserId(email);
        if (accountName.isBlank() || bankName.isBlank() || bankBranch.isBlank()
            || accountNumber.isBlank() || chequePayeeName.isBlank()) {
            throw error(HttpStatus.SERVICE_UNAVAILABLE,
                "Company bank and cheque payee details must be configured first");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("accountName", accountName);
        result.put("bankName", bankName);
        result.put("branch", bankBranch);
        result.put("accountNumber", accountNumber);
        result.put("chequePayeeName", chequePayeeName);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getBillPayments(String email, long billId) {
        long userId = salesUserId(email);
        Map<String, Object> bill = ownedBill(userId, billId, false);
        BigDecimal total = (BigDecimal) bill.get("total_amount");
        BigDecimal cash = confirmedCash(billId);
        BigDecimal nonCash = confirmedNonCash(billId);
        List<Map<String, Object>> records = jdbc.queryForList(
            """
            SELECT id AS "id", method AS "method", amount AS "amount",
                   status AS "status", transfer_reference AS "transferReference",
                   cheque_number AS "chequeNumber", issuing_bank AS "issuingBank",
                   cheque_date AS "chequeDate", proof_original_name AS "proofOriginalName",
                   rejection_reason AS "rejectionReason", created_at AS "createdAt",
                   reviewed_at AS "reviewedAt", confirmed_at AS "confirmedAt"
            FROM public.sales_bill_payment_proofs
            WHERE bill_id = ? ORDER BY created_at DESC, id DESC
            """, billId
        );
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("billId", billId);
        result.put("paymentMethod", bill.get("payment_method"));
        result.put("totalAmount", total);
        result.put("confirmedCash", cash);
        result.put("confirmedNonCash", nonCash);
        result.put("confirmedPaid", cash.add(nonCash));
        result.put("remainingBalance", total.subtract(cash).subtract(nonCash).max(BigDecimal.ZERO));
        result.put("payments", records);
        return result;
    }

    @Transactional
    public Map<String, Object> submitBankSlip(
        String email, long billId, UUID receiptKey, BigDecimal amount,
        String transferReference, MultipartFile file
    ) {
        return submit(email, billId, receiptKey, amount, "BANK_TRANSFER",
            required(transferReference, "Transfer reference", 150),
            null, null, null, file);
    }

    @Transactional
    public Map<String, Object> submitCheque(
        String email, long billId, UUID receiptKey, BigDecimal amount,
        String chequeNumber, String issuingBank, LocalDate chequeDate,
        MultipartFile file
    ) {
        if (chequeDate == null) {
            throw error(HttpStatus.BAD_REQUEST, "Cheque date is required");
        }
        return submit(email, billId, receiptKey, amount, "CHEQUE", null,
            required(chequeNumber, "Cheque number", 100),
            required(issuingBank, "Issuing bank", 150), chequeDate, file);
    }

    private Map<String, Object> submit(
        String email, long billId, UUID receiptKey, BigDecimal amount,
        String method, String transferReference, String chequeNumber,
        String issuingBank, LocalDate chequeDate, MultipartFile file
    ) {
        if (receiptKey == null) {
            throw error(HttpStatus.BAD_REQUEST, "Receipt key is required");
        }
        long userId = salesUserId(email);
        Map<String, Object> bill = ownedBill(userId, billId, true);
        String billMethod = String.valueOf(bill.get("payment_method"));
        if (!method.equals(billMethod)) {
            throw error(HttpStatus.CONFLICT, "Payment method does not match the saved invoice");
        }
        BigDecimal total = (BigDecimal) bill.get("total_amount");
        if (amount == null || amount.compareTo(total) != 0) {
            throw error(HttpStatus.BAD_REQUEST,
                "Payment amount must exactly equal the full invoice amount");
        }

        // Resolve an already-submitted UUID before parsing the file again.
        List<Map<String, Object>> prior = jdbc.queryForList(
            """
            SELECT id, bill_id, method, amount, status,
                   transfer_reference, cheque_number, issuing_bank, cheque_date
            FROM public.sales_bill_payment_proofs WHERE receipt_key = ?
            """, receiptKey
        );
        if (!prior.isEmpty()) {
            Map<String, Object> previous = prior.get(0);
            boolean matches = ((Number) previous.get("bill_id")).longValue() == billId
                && method.equals(previous.get("method"))
                && ((BigDecimal) previous.get("amount")).compareTo(amount) == 0
                && java.util.Objects.equals(previous.get("transfer_reference"), transferReference)
                && java.util.Objects.equals(previous.get("cheque_number"), chequeNumber)
                && java.util.Objects.equals(previous.get("issuing_bank"), issuingBank)
                && java.util.Objects.equals(previous.get("cheque_date"), chequeDate);
            if (!matches) {
                throw error(HttpStatus.CONFLICT, "Receipt key is already used for another payment");
            }
            return getBillPayments(email, billId);
        }

        if (confirmedCash(billId).signum() != 0 || confirmedNonCash(billId).signum() != 0) {
            throw error(HttpStatus.CONFLICT, "Invoice already has confirmed payments");
        }
        Integer activeProofs = jdbc.queryForObject(
            """
            SELECT COUNT(*) FROM public.sales_bill_payment_proofs
            WHERE bill_id = ? AND status IN ('PENDING_REVIEW', 'APPROVED', 'CONFIRMED')
            """, Integer.class, billId
        );
        if (activeProofs != null && activeProofs > 0) {
            throw error(HttpStatus.CONFLICT, "An active payment proof already exists for this invoice");
        }

        byte[] bytes = validatedProof(file);
        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) originalName = "proof";
        originalName = originalName.replaceAll("[\\r\\n\\t/\\\\]", "_");
        if (originalName.length() > 255) originalName = originalName.substring(0, 255);

        jdbc.update(
            """
            INSERT INTO public.sales_bill_payment_proofs (
                bill_id, receipt_key, method, amount, status,
                transfer_reference, cheque_number, issuing_bank, cheque_date,
                proof_original_name, proof_content_type, proof_data, submitted_by
            ) VALUES (?, ?, ?, ?, 'PENDING_REVIEW', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            billId, receiptKey, method, total, transferReference,
            chequeNumber, issuingBank, chequeDate, originalName,
            file.getContentType(), bytes, userId
        );
        return getBillPayments(email, billId);
    }
}
