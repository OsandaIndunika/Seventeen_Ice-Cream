package com.seventeen.project.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class WholesalePaymentService {

    private static final long MAX_FILE_SIZE = 5_000_000L;

    private final JdbcTemplate jdbc;
    private final Path proofDirectory;

    public WholesalePaymentService(
            JdbcTemplate jdbc,
            @Value("${app.payment-proof.dir:./private-payment-proofs}")
            String proofDir
    ) {
        this.jdbc = jdbc;

        this.proofDirectory = Path.of(proofDir)
                .toAbsolutePath()
                .normalize();
    }

    // ==========================================
    // 1. COMMON ERROR HANDLING
    // ==========================================

    private ResponseStatusException error(
            HttpStatus status,
            String message
    ) {
        return new ResponseStatusException(
                status,
                message
        );
    }

    // ==========================================
    // 2. VALIDATE PAYMENT AMOUNT
    // ==========================================

    private void validateAmount(BigDecimal amount) {

        if (
                amount == null ||
                amount.signum() <= 0 ||
                amount.scale() > 2 ||
                amount.precision() - amount.scale() > 10
        ) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Enter a valid positive payment amount " +
                    "with at most two decimal places"
            );
        }
    }

    private void validateReceiptKey(UUID receiptKey) {

        if (receiptKey == null) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Receipt key is required"
            );
        }
    }

    private void validateOrderId(long orderId) {

        if (orderId <= 0) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }
    }

    // ==========================================
    // 3. IDENTIFY AUTHENTICATED USER
    // ==========================================

    private long userId(
            String email,
            String requiredRole
    ) {

        if (email == null || email.isBlank()) {
            throw error(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in again"
            );
        }

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = ?
                  AND enabled = TRUE
                """,
                (rs, rowNum) -> rs.getLong("id"),
                email.trim(),
                requiredRole
        );

        if (ids.isEmpty()) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "Your account is not authorized"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // 4. LOCK WHOLESALE ORDER
    //
    // This serializes payments for the same order.
    // Every payment-changing transaction must
    // acquire this lock before modifying receipts.
    // ==========================================

    private void lockOrder(long orderId) {

        validateOrderId(orderId);

        List<Long> found = jdbc.query(
                """
                SELECT id
                FROM public.wholesale_orders
                WHERE id = ?
                FOR UPDATE
                """,
                (rs, rowNum) -> rs.getLong("id"),
                orderId
        );

        if (found.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Wholesale order not found"
            );
        }
    }

    // ==========================================
    // 5. READ ORIGINAL CHECKOUT PAYMENT METHOD
    // ==========================================

    private String checkoutMethod(long orderId) {

        validateOrderId(orderId);

        List<String> methods = jdbc.query(
                """
                SELECT payment_method
                FROM public.wholesale_orders
                WHERE id = ?
                """,
                (rs, rowNum) ->
                        rs.getString("payment_method"),
                orderId
        );

        if (methods.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Wholesale order not found"
            );
        }

        String method = methods.get(0);

        return method == null
                ? ""
                : method.trim()
                        .toLowerCase(Locale.ROOT);
    }

    // ==========================================
    // 6. READ WHOLESALE ORDER TOTAL
    //
    // Tries commonly used total columns.
    // Falls back to the sum of existing item
    // subtotals if no order total is stored.
    //
    // Check these names against your actual
    // wholesale_orders schema.
    // ==========================================

    private BigDecimal orderTotal(long orderId) {

        validateOrderId(orderId);

        List<BigDecimal> totals = jdbc.query(
                """
                SELECT
                    COALESCE(
                        NULLIF(
                            to_jsonb(o)->>'final_total',
                            ''
                        )::numeric,

                        NULLIF(
                            to_jsonb(o)->>'total_amount',
                            ''
                        )::numeric,

                        NULLIF(
                            to_jsonb(o)->>'order_total',
                            ''
                        )::numeric,

                        NULLIF(
                            to_jsonb(o)->>'total',
                            ''
                        )::numeric,

                        (
                            SELECT SUM(oi.subtotal)
                            FROM public.wholesale_order_items oi
                            WHERE oi.order_id = o.id
                        )
                    ) AS total_amount

                FROM public.wholesale_orders o
                WHERE o.id = ?
                """,
                (rs, rowNum) ->
                        rs.getBigDecimal("total_amount"),
                orderId
        );

        if (totals.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Wholesale order not found"
            );
        }

        BigDecimal total = totals.get(0);

        if (
                total == null ||
                total.signum() < 0
        ) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Wholesale order total is unavailable"
            );
        }

        return total;
    }

    // ==========================================
    // 7. VERIFY WHOLESALE CUSTOMER OWNERSHIP
    //
    // This implementation uses the email saved
    // on the wholesale order.
    //
    // If your actual database links orders using
    // wholesale_customer_id or app_user_id,
    // replace this lookup with that relationship.
    // ==========================================

    private long requireCustomerOrder(
            String email,
            long orderId
    ) {

        long customerId = userId(
                email,
                "WHOLESALE"
        );

        validateOrderId(orderId);

        List<String> owners = jdbc.query(
                """
                SELECT LOWER(
                    NULLIF(
                        to_jsonb(o)->>'email',
                        ''
                    )
                ) AS customer_email
                FROM public.wholesale_orders o
                WHERE o.id = ?
                """,
                (rs, rowNum) ->
                        rs.getString("customer_email"),
                orderId
        );

        if (owners.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Wholesale order not found"
            );
        }

        String ownerEmail = owners.get(0);

        if (
                ownerEmail == null ||
                !ownerEmail.equalsIgnoreCase(
                        email.trim()
                )
        ) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "You cannot access this wholesale order"
            );
        }

        return customerId;
    }

    // ==========================================
    // 8. GET LATEST VEHICLE ASSIGNMENT
    // ==========================================

    private Map<String, Object> latestAssignment(
            long orderId
    ) {

        List<Map<String, Object>> rows =
                jdbc.queryForList(
                        """
                        SELECT
                            id,
                            vehicle_id,
                            status

                        FROM public.vehicle_delivery_assignments

                        WHERE wholesale_order_id = ?

                        ORDER BY id DESC

                        LIMIT 1
                        """,
                        orderId
                );

        if (rows.isEmpty()) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Wholesale order is not assigned " +
                    "to a delivery vehicle"
            );
        }

        return rows.get(0);
    }

    // ==========================================
    // 9. REQUIRE DELIVERED ORDER
    // ==========================================

    private long deliveredVehicle(long orderId) {

        Map<String, Object> assignment =
                latestAssignment(orderId);

        String status = String.valueOf(
                assignment.get("status")
        );

        if (!"DELIVERED".equalsIgnoreCase(status)) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Wholesale order must be delivered first"
            );
        }

        Object value = assignment.get("vehicle_id");

        if (value == null) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Order has no assigned vehicle"
            );
        }

        return ((Number) value).longValue();
    }

    // ==========================================
    // 10. CHECK SALES REPRESENTATIVE VEHICLE
    // ==========================================

    private long representativeId(
            String salesEmail,
            long vehicleId
    ) {

        long salesId = userId(
                salesEmail,
                "SALES_MANAGER"
        );

        Integer active = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM public.vehicle_sales_sessions
                WHERE sales_representative_id = ?
                  AND vehicle_id = ?
                  AND ended_at IS NULL
                """,
                Integer.class,
                salesId,
                vehicleId
        );

        if (
                active == null ||
                active == 0
        ) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "Select the vehicle assigned to this order"
            );
        }

        return salesId;
    }

    // ==========================================
    // 11. GET CONFIRMED PAYMENTS
    //
    // Only confirmed records reduce the
    // customer's outstanding balance.
    // ==========================================

    private BigDecimal confirmedTotal(long orderId) {

        BigDecimal confirmed = jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(amount), 0)
                FROM public.wholesale_payment_records
                WHERE order_id = ?
                  AND status = 'CONFIRMED'
                """,
                BigDecimal.class,
                orderId
        );

        return confirmed == null
                ? BigDecimal.ZERO
                : confirmed;
    }

    // ==========================================
    // 12. GET REMAINING BALANCE
    // ==========================================

    private BigDecimal remainingBalance(long orderId) {

        BigDecimal remaining = orderTotal(orderId)
                .subtract(confirmedTotal(orderId));

        return remaining.max(BigDecimal.ZERO);
    }

    // ==========================================
    // 13. PREVENT PAYMENT EXCEEDING BALANCE
    //
    // Caller must lockOrder() first for writes.
    // ==========================================

    private void checkRemainingBalance(
            long orderId,
            BigDecimal amount
    ) {

        validateAmount(amount);

        BigDecimal remaining =
                remainingBalance(orderId);

        if (amount.compareTo(remaining) > 0) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Payment exceeds the outstanding balance"
            );
        }
    }

    // ==========================================
    // 14. CHECK DUPLICATE RECEIPT KEY
    //
    // A retry with identical details succeeds
    // without inserting another receipt.
    //
    // A conflicting receipt key is rejected.
    // ==========================================

    private boolean isExistingReceipt(
            UUID receiptKey,
            long orderId,
            String method,
            BigDecimal amount
    ) {

        List<Map<String, Object>> rows =
                jdbc.queryForList(
                        """
                        SELECT
                            order_id,
                            method,
                            CASE WHEN method = 'BANK_TRANSFER'
                                 THEN COALESCE(declared_amount, amount)
                                 ELSE amount END AS amount

                        FROM public.wholesale_payment_records

                        WHERE receipt_key = ?
                        """,
                        receiptKey
                );

        if (rows.isEmpty()) {
            return false;
        }

        Map<String, Object> row = rows.get(0);

        long existingOrderId =
                ((Number) row.get("order_id"))
                        .longValue();

        String existingMethod =
                String.valueOf(row.get("method"));

        BigDecimal existingAmount =
                new BigDecimal(
                        row.get("amount").toString()
                );

        boolean sameReceipt =
                existingOrderId == orderId &&
                method.equalsIgnoreCase(existingMethod) &&
                existingAmount.compareTo(amount) == 0;

        if (!sameReceipt) {
            throw error(
                    HttpStatus.CONFLICT,
                    "This receipt key belongs to " +
                    "a different payment"
            );
        }

        return true;
    }

    // ==========================================
    // 15. RECORD CASH RECEIVED
    //
    // Used for Cash and Credit orders.
    //
    // Must be called only when the Sales
    // Representative has actually received
    // physical cash.
    //
    // This is the method called by:
    //
    // POST /api/sales/payments/orders/{id}/cash
    // ==========================================

    @Transactional
    public void receiveCash(
            String salesEmail,
            long orderId,
            UUID receiptKey,
            BigDecimal amount
    ) {

        validateReceiptKey(receiptKey);
        validateAmount(amount);

        lockOrder(orderId);

        long vehicleId =
                deliveredVehicle(orderId);

        long salesId =
                representativeId(
                        salesEmail,
                        vehicleId
                );

        String method = checkoutMethod(orderId);

        if (
                !"cash".equals(method) &&
                !"credit".equals(method)
        ) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Cash collection is not enabled " +
                    "for this checkout payment method"
            );
        }

        if (
                isExistingReceipt(
                        receiptKey,
                        orderId,
                        "CASH",
                        amount
                )
        ) {
            return;
        }

        checkRemainingBalance(orderId, amount);

        jdbc.update(
                """
                INSERT INTO public.wholesale_payment_records
                (
                    order_id,
                    vehicle_id,
                    receipt_key,
                    method,
                    amount,
                    status,
                    created_by,
                    confirmed_at
                )
                VALUES (
                    ?, ?, ?,
                    'CASH',
                    ?,
                    'CONFIRMED',
                    ?,
                    NOW()
                )
                """,
                orderId,
                vehicleId,
                receiptKey,
                amount,
                salesId
        );
    }

    // ==========================================
    // 16. BUILD PAYMENT SUMMARY
    //
    // Returns values expected by:
    // SalesManagerDashboard.jsx
    // WholesaleCustomerPayments.jsx
    //
    // No credit approval information.
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> paymentSummary(
            long orderId
    ) {

        BigDecimal total = orderTotal(orderId);

        BigDecimal paid = confirmedTotal(orderId);

        BigDecimal remaining = total
                .subtract(paid)
                .max(BigDecimal.ZERO);

        List<Map<String, Object>> details =
                jdbc.queryForList(
                        """
                        SELECT
                            payment_method,
                            credit_cash_amount
                        FROM public.wholesale_orders
                        WHERE id = ?
                        """,
                        orderId
                );

        String method = "";
        BigDecimal plannedCash = null;

        if (!details.isEmpty()) {
            Map<String, Object> order = details.get(0);

            Object methodValue =
                    order.get("payment_method");

            method = methodValue == null
                    ? ""
                    : String.valueOf(methodValue);

            Object plannedValue =
                    order.get("credit_cash_amount");

            if (plannedValue != null) {
                plannedCash = new BigDecimal(
                        plannedValue.toString()
                );
            }
        }

        BigDecimal requestedCredit = null;

        if (
                "credit".equalsIgnoreCase(method) &&
                plannedCash != null
        ) {
            requestedCredit = total
                    .subtract(plannedCash)
                    .max(BigDecimal.ZERO);
        }

        List<Map<String, Object>> receipts =
                jdbc.queryForList(
                        """
                        SELECT
                            id,

                            method,

                            amount,

                            status,

                            created_at AS "createdAt",

                            confirmed_at AS "confirmedAt",

                            declared_amount AS "declaredAmount",
                            CASE WHEN method = 'BANK_TRANSFER'
                                      AND status = 'CONFIRMED'
                                 THEN amount END AS "verifiedAmount",
                            CASE WHEN method = 'BANK_TRANSFER'
                                      AND status = 'CONFIRMED'
                                 THEN confirmed_at END AS "verifiedAt",
                            to_jsonb(wholesale_payment_records)->>'rejection_reason'
                                AS "rejectionReason",

                            (
                                proof_path IS NOT NULL
                            ) AS "hasProof"

                        FROM public.wholesale_payment_records

                        WHERE order_id = ?

                        ORDER BY id DESC
                        """,
                        orderId
                );

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put("orderId", orderId);
        result.put("checkoutMethod", method);

        result.put("orderTotal", total);
        result.put("plannedCash", plannedCash);
        result.put("requestedCredit", requestedCredit);

        result.put("confirmedPaid", paid);
        result.put("remainingBalance", remaining);

        result.put("paymentStatus", remaining.signum() == 0
                ? "PAID" : paid.signum() > 0 ? "PARTIALLY_PAID" : "PENDING");

        result.put("receipts", receipts);

        return result;
    }

    // ==========================================
    // 17. SAVE PAYMENT PROOF PRIVATELY
    //
    // Stores a server-generated filename,
    // never the customer's original path.
    // ==========================================

    private String saveProof(MultipartFile file) {

        if (
                file == null ||
                file.isEmpty() ||
                file.getSize() > MAX_FILE_SIZE
        ) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Upload a file smaller than 5 MB"
            );
        }

        String mime = file.getContentType();

        String extension = switch (
                mime == null
                        ? ""
                        : mime.toLowerCase(Locale.ROOT)
        ) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "application/pdf" -> ".pdf";

            default -> throw error(
                    HttpStatus.BAD_REQUEST,
                    "Only JPG, PNG and PDF are supported"
            );
        };

        try {
            byte[] signature;

            try (var input = file.getInputStream()) {
                signature = input.readNBytes(8);
            }

            boolean valid = switch (extension) {

                case ".jpg" ->
                        signature.length >= 3 &&
                        (signature[0] & 0xff) == 0xff &&
                        (signature[1] & 0xff) == 0xd8 &&
                        (signature[2] & 0xff) == 0xff;

                case ".png" ->
                        signature.length >= 8 &&
                        (signature[0] & 0xff) == 137 &&
                        (signature[1] & 0xff) == 80 &&
                        (signature[2] & 0xff) == 78 &&
                        (signature[3] & 0xff) == 71;

                default ->
                        signature.length >= 5 &&
                        signature[0] == 37 &&
                        signature[1] == 80 &&
                        signature[2] == 68 &&
                        signature[3] == 70 &&
                        signature[4] == 45;
            };

            if (!valid) {
                throw error(
                        HttpStatus.BAD_REQUEST,
                        "The uploaded file does not " +
                        "match its declared format"
                );
            }

            Files.createDirectories(proofDirectory);

            String filename =
                    UUID.randomUUID() + extension;

            Path target = proofDirectory
                    .resolve(filename)
                    .normalize();

            if (!target.startsWith(proofDirectory)) {
                throw error(
                        HttpStatus.BAD_REQUEST,
                        "Invalid upload path"
                );
            }

            try (var input = file.getInputStream()) {
                Files.copy(
                        input,
                        target
                );
            }

            // Delete the proof if a database
            // transaction later rolls back.
            if (
                    TransactionSynchronizationManager
                            .isSynchronizationActive()
            ) {
                TransactionSynchronizationManager
                        .registerSynchronization(
                            new TransactionSynchronization() {

                                @Override
                                public void afterCompletion(
                                        int status
                                ) {
                                    if (
                                            status !=
                                            TransactionSynchronization
                                                    .STATUS_COMMITTED
                                    ) {
                                        try {
                                            Files.deleteIfExists(
                                                    target
                                            );
                                        } catch (IOException ignored) {
                                            // Log this failure in production.
                                        }
                                    }
                                }
                            }
                        );
            }

            return filename;

        } catch (IOException ex) {
            throw error(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Unable to save payment proof"
            );
        }
    }

    // ==========================================
    // 18. UPLOAD BANK TRANSFER SLIP
    //
    // Wholesale customer only.
    // Only after delivery.
    //
    // Upload creates PENDING_REVIEW.
    // It does not confirm payment.
    // ==========================================

    @Transactional
    public void uploadBankSlip(
            String customerEmail,
            long orderId,
            UUID receiptKey,
            BigDecimal claimedAmount,
            MultipartFile file
    ) {

        validateReceiptKey(receiptKey);
        validateAmount(claimedAmount);

        lockOrder(orderId);

        long customerId =
                requireCustomerOrder(
                        customerEmail,
                        orderId
                );

        String method = checkoutMethod(orderId);

        if (
                !"bank".equals(method) &&
                !"bank_transfer".equals(method)
        ) {
            throw error(
                    HttpStatus.CONFLICT,
                    "This order did not select bank transfer"
            );
        }

        long vehicleId =
                deliveredVehicle(orderId);

        if (
                isExistingReceipt(
                        receiptKey,
                        orderId,
                        "BANK_TRANSFER",
                        claimedAmount
                )
        ) {
            return;
        }

        Integer pending = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM public.wholesale_payment_records
                WHERE order_id = ?
                  AND method = 'BANK_TRANSFER'
                  AND status = 'PENDING_REVIEW'
                """,
                Integer.class,
                orderId
        );

        if (pending != null && pending > 0) {
            throw error(HttpStatus.CONFLICT,
                    "A bank slip is already awaiting Admin approval");
        }

        checkRemainingBalance(
                orderId,
                claimedAmount
        );

        String proofName = saveProof(file);

        jdbc.update(
                """
                INSERT INTO public.wholesale_payment_records
                (
                    order_id,
                    vehicle_id,
                    receipt_key,
                    method,
                    amount,
                    declared_amount,
                    status,
                    proof_path,
                    proof_original_name,
                    created_by
                )
                VALUES (
                    ?, ?, ?,
                    'BANK_TRANSFER',
                    ?, ?,
                    'PENDING_REVIEW',
                    ?, ?, ?
                )
                """,
                orderId,
                vehicleId,
                receiptKey,
                claimedAmount,
                claimedAmount,
                proofName,
                file.getOriginalFilename(),
                customerId
        );
    }

    // ==========================================
    // 19. VERIFY BANK TRANSFER
    //
    // Admin must verify
    // actual bank credit first.
    //
    // Only PENDING_REVIEW -> CONFIRMED.
    // ==========================================

    @Transactional
    public void verifyBankTransfer(
            String adminEmail,
            long receiptId,
            BigDecimal verifiedAmount
    ) {

        long adminId = userId(adminEmail, "ADMIN");

        validateAmount(verifiedAmount);

        if (receiptId <= 0) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid payment receipt ID"
            );
        }

        List<Long> orderIds = jdbc.query(
                """
                SELECT order_id
                FROM public.wholesale_payment_records
                WHERE id = ?
                """,
                (rs, rowNum) -> rs.getLong("order_id"),
                receiptId
        );

        if (orderIds.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Bank transfer receipt not found"
            );
        }

        long orderId = orderIds.get(0);

        lockOrder(orderId);

        long vehicleId =
                deliveredVehicle(orderId);

        List<Map<String, Object>> receipts =
                jdbc.queryForList(
                        """
                        SELECT
                            order_id,
                            vehicle_id,
                            method,
                            status,
                            amount,
                            proof_path

                        FROM public.wholesale_payment_records

                        WHERE id = ?

                        FOR UPDATE
                        """,
                        receiptId
                );

        if (receipts.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Bank transfer receipt not found"
            );
        }

        Map<String, Object> receipt =
                receipts.get(0);

        long receiptVehicleId =
                ((Number) receipt.get("vehicle_id"))
                        .longValue();

        if (receiptVehicleId != vehicleId) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "Receipt belongs to another vehicle"
            );
        }

        if (
                !"BANK_TRANSFER".equals(
                        receipt.get("method")
                )
        ) {
            throw error(
                    HttpStatus.CONFLICT,
                    "This is not a bank transfer receipt"
            );
        }

        String status = String.valueOf(
                receipt.get("status")
        );

        BigDecimal existingAmount =
                (BigDecimal) receipt.get("amount");

        // Idempotent confirmation:
        // same already-verified amount is harmless.
        if ("CONFIRMED".equals(status)) {

            if (
                    existingAmount
                            .compareTo(verifiedAmount) == 0
            ) {
                return;
            }

            throw error(
                    HttpStatus.CONFLICT,
                    "Bank transfer has already been " +
                    "confirmed with another amount"
            );
        }

        if (!"PENDING_REVIEW".equals(status)) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Bank receipt is not awaiting verification"
            );
        }

        if (receipt.get("proof_path") == null) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Bank transfer slip is missing"
            );
        }

        checkedProofPath((String) receipt.get("proof_path"));

        checkRemainingBalance(
                orderId,
                verifiedAmount
        );

        int changed = jdbc.update(
                """
                UPDATE public.wholesale_payment_records

                SET declared_amount = COALESCE(declared_amount, amount),
                    amount = ?,
                    status = 'CONFIRMED',
                    reviewed_by = ?,
                    confirmed_at = NOW()

                WHERE id = ?
                  AND method = 'BANK_TRANSFER'
                  AND status = 'PENDING_REVIEW'
                """,
                verifiedAmount,
                adminId,
                receiptId
        );

        if (changed != 1) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Bank transfer status changed; reload receipt"
            );
        }
    }

    // ==========================================
    // 20. SALES REPRESENTATIVE SUBMITS CHEQUE
    //
    // Only after delivery.
    // Initial status: PENDING_REVIEW.
    // ==========================================

    @Transactional
    public void submitCheque(
            String salesEmail,
            long orderId,
            UUID receiptKey,
            BigDecimal chequeAmount,
            MultipartFile file
    ) {

        validateReceiptKey(receiptKey);
        validateAmount(chequeAmount);

        lockOrder(orderId);

        long vehicleId =
                deliveredVehicle(orderId);

        long salesId =
                representativeId(
                        salesEmail,
                        vehicleId
                );

        if (
                !"cheque".equals(
                        checkoutMethod(orderId)
                )
        ) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Customer did not select cheque payment"
            );
        }

        if (
                isExistingReceipt(
                        receiptKey,
                        orderId,
                        "CHEQUE",
                        chequeAmount
                )
        ) {
            return;
        }

        checkRemainingBalance(
                orderId,
                chequeAmount
        );

        String proofName = saveProof(file);

        jdbc.update(
                """
                INSERT INTO public.wholesale_payment_records
                (
                    order_id,
                    vehicle_id,
                    receipt_key,
                    method,
                    amount,
                    status,
                    proof_path,
                    proof_original_name,
                    created_by
                )
                VALUES (
                    ?, ?, ?,
                    'CHEQUE',
                    ?,
                    'PENDING_REVIEW',
                    ?, ?, ?
                )
                """,
                orderId,
                vehicleId,
                receiptKey,
                chequeAmount,
                proofName,
                file.getOriginalFilename(),
                salesId
        );
    }

    // ==========================================
    // 21. ADMIN LISTS PENDING CHEQUES
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> pendingCheques(
            String adminEmail
    ) {

        userId(adminEmail, "ADMIN");

        return jdbc.queryForList(
                """
                SELECT
                    id,

                    order_id AS "orderId",

                    vehicle_id AS "vehicleId",

                    amount,

                    status,

                    created_at AS "createdAt",

                    reviewed_by AS "reviewedBy"

                FROM public.wholesale_payment_records

                WHERE method = 'CHEQUE'

                  AND status IN (
                      'PENDING_REVIEW',
                      'APPROVED'
                  )

                ORDER BY created_at DESC
                """
        );
    }

    // ==========================================
    // 22. ADMIN APPROVES CHEQUE
    //
    // Approval is NOT bank clearance.
    // No money is counted as paid yet.
    // ==========================================

    @Transactional
    public void approveCheque(
            String adminEmail,
            long receiptId
    ) {

        long adminId = userId(
                adminEmail,
                "ADMIN"
        );

        if (receiptId <= 0) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid cheque receipt ID"
            );
        }

        int changed = jdbc.update(
                """
                UPDATE public.wholesale_payment_records

                SET status = 'APPROVED',
                    reviewed_by = ?

                WHERE id = ?
                  AND method = 'CHEQUE'
                  AND status = 'PENDING_REVIEW'
                  AND proof_path IS NOT NULL
                """,
                adminId,
                receiptId
        );

        if (changed != 1) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Cheque cannot be approved " +
                    "from its current status"
            );
        }
    }

    // ==========================================
    // 23. ADMIN CONFIRMS CHEQUE CLEARED
    //
    // Only after actual bank clearance.
    // Only now the confirmed paid amount
    // and remaining balance change.
    // ==========================================

    @Transactional
    public void confirmChequeCleared(
            String adminEmail,
            long receiptId
    ) {

        long adminId = userId(
                adminEmail,
                "ADMIN"
        );

        if (receiptId <= 0) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid cheque receipt ID"
            );
        }

        List<Long> orderIds = jdbc.query(
                """
                SELECT order_id
                FROM public.wholesale_payment_records
                WHERE id = ?
                """,
                (rs, rowNum) -> rs.getLong("order_id"),
                receiptId
        );

        if (orderIds.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Cheque receipt not found"
            );
        }

        long orderId = orderIds.get(0);

        lockOrder(orderId);

        List<Map<String, Object>> records =
                jdbc.queryForList(
                        """
                        SELECT
                            method,
                            status,
                            amount
                        FROM public.wholesale_payment_records
                        WHERE id = ?
                        FOR UPDATE
                        """,
                        receiptId
                );

        if (records.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Cheque receipt not found"
            );
        }

        Map<String, Object> cheque =
                records.get(0);

        if (
                !"CHEQUE".equals(
                        cheque.get("method")
                )
        ) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Receipt is not a cheque"
            );
        }

        String status = String.valueOf(
                cheque.get("status")
        );

        if ("CONFIRMED".equals(status)) {
            // Already cleared. Never count it twice.
            return;
        }

        if (!"APPROVED".equals(status)) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Admin must approve the cheque " +
                    "before clearance"
            );
        }

        BigDecimal amount =
                (BigDecimal) cheque.get("amount");

        checkRemainingBalance(
                orderId,
                amount
        );

        int changed = jdbc.update(
                """
                UPDATE public.wholesale_payment_records

                SET status = 'CONFIRMED',
                    confirmed_at = NOW(),
                    reviewed_by = ?

                WHERE id = ?
                  AND method = 'CHEQUE'
                  AND status = 'APPROVED'
                """,
                adminId,
                receiptId
        );

        if (changed != 1) {
            throw error(
                    HttpStatus.CONFLICT,
                    "Cheque clearance could not be saved"
            );
        }
    }

    // ==========================================
    // 24. PAYMENT SUMMARY FOR SALES
    //
    // Access is allowed only for the Sales
    // Representative's currently selected vehicle.
    //
    // Before delivery, the summary still shows
    // checkout method and planned amounts.
    // Payment actions remain restricted elsewhere.
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> summaryForSales(
            String salesEmail,
            long orderId
    ) {

        validateOrderId(orderId);

        Map<String, Object> assignment =
                latestAssignment(orderId);

        long vehicleId =
                ((Number) assignment.get("vehicle_id"))
                        .longValue();

        representativeId(
                salesEmail,
                vehicleId
        );

        Map<String, Object> summary = paymentSummary(orderId);
        Object records = summary.get("receipts");
        if (records instanceof List<?> list) {
            List<Map<String, Object>> safeReceipts = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> row) {
                    Map<String, Object> copy = new LinkedHashMap<>();
                    row.forEach((key, value) -> copy.put(String.valueOf(key), value));
                    if ("BANK_TRANSFER".equals(copy.get("method"))) {
                        copy.put("hasProof", false);
                    }
                    safeReceipts.add(copy);
                }
            }
            summary.put("receipts", safeReceipts);
        }
        return summary;
    }

    // ==========================================
    // 25. PAYMENT SUMMARY FOR CUSTOMER
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> summaryForCustomer(
            String customerEmail,
            long orderId
    ) {

        requireCustomerOrder(
                customerEmail,
                orderId
        );

        return paymentSummary(orderId);
    }

    // ==========================================
    // 26. PRIVATE PROOF DOWNLOAD FOR SALES
    // ==========================================

    @Transactional(readOnly = true)
    public Path proofForSales(
            String salesEmail,
            long receiptId
    ) {

        if (receiptId <= 0) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid receipt ID"
            );
        }

        List<Map<String, Object>> records =
                jdbc.queryForList(
                        """
                        SELECT
                            order_id,
                            vehicle_id,
                            method,
                            proof_path

                        FROM public.wholesale_payment_records

                        WHERE id = ?
                          AND proof_path IS NOT NULL
                        """,
                        receiptId
                );

        if (records.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Payment proof not found"
            );
        }

        Map<String, Object> record =
                records.get(0);

        long vehicleId =
                ((Number) record.get("vehicle_id"))
                        .longValue();

        long orderId =
                ((Number) record.get("order_id"))
                        .longValue();

        Map<String, Object> assignment =
                latestAssignment(orderId);

        long currentVehicleId =
                ((Number) assignment.get("vehicle_id"))
                        .longValue();

        if (vehicleId != currentVehicleId) {
            throw error(
                    HttpStatus.FORBIDDEN,
                    "Receipt is not assigned to this vehicle"
            );
        }

        representativeId(
                salesEmail,
                vehicleId
        );

        if ("BANK_TRANSFER".equals(record.get("method"))) {
            throw error(HttpStatus.FORBIDDEN,
                    "Only Admin can review bank transfer slips");
        }

        return checkedProofPath(
                (String) record.get("proof_path")
        );
    }

    // ==========================================
    // 27. PRIVATE PROOF DOWNLOAD FOR ADMIN
    // ==========================================

    @Transactional(readOnly = true)
    public Path proofForAdmin(
            String adminEmail,
            long receiptId
    ) {

        userId(adminEmail, "ADMIN");

        if (receiptId <= 0) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Invalid receipt ID"
            );
        }

        List<String> paths = jdbc.query(
                """
                SELECT proof_path
                FROM public.wholesale_payment_records
                WHERE id = ?
                  AND proof_path IS NOT NULL
                """,
                (rs, rowNum) ->
                        rs.getString("proof_path"),
                receiptId
        );

        if (paths.isEmpty()) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Payment proof not found"
            );
        }

        return checkedProofPath(paths.get(0));
    }

    // ==========================================
    // ADMIN BANK TRANSFER REVIEW
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBankTransfers(String adminEmail) {
        userId(adminEmail, "ADMIN");
        return jdbc.queryForList("""
                SELECT id, order_id AS "orderId", vehicle_id AS "vehicleId",
                       amount, declared_amount AS "declaredAmount",
                       status, created_at AS "createdAt",
                       confirmed_at AS "confirmedAt", reviewed_by AS "reviewedBy",
                       proof_original_name AS "proofOriginalName",
                       (proof_path IS NOT NULL) AS "hasProof",
                       CASE WHEN status = 'CONFIRMED' THEN amount END AS "verifiedAmount",
                       to_jsonb(wholesale_payment_records)->>'rejection_reason'
                           AS "rejectionReason"
                FROM public.wholesale_payment_records
                WHERE method = 'BANK_TRANSFER'
                ORDER BY CASE WHEN status = 'PENDING_REVIEW' THEN 0 ELSE 1 END,
                         created_at DESC, id DESC
                """);
    }

    @Transactional(readOnly = true)
    public Path proofForAdminBankTransfer(String adminEmail, long receiptId) {
        userId(adminEmail, "ADMIN");
        if (receiptId <= 0) {
            throw error(HttpStatus.BAD_REQUEST, "Invalid receipt ID");
        }
        List<String> paths = jdbc.query("""
                SELECT proof_path FROM public.wholesale_payment_records
                WHERE id = ? AND method = 'BANK_TRANSFER'
                  AND proof_path IS NOT NULL
                """, (rs, rowNum) -> rs.getString("proof_path"), receiptId);
        if (paths.isEmpty()) {
            throw error(HttpStatus.NOT_FOUND, "Bank transfer proof not found");
        }
        return checkedProofPath(paths.get(0));
    }

    @Transactional
    public void approveBankTransfer(String adminEmail, long receiptId,
                                    BigDecimal verifiedAmount) {
        verifyBankTransfer(adminEmail, receiptId, verifiedAmount);
    }

    @Transactional
    public void rejectBankTransfer(String adminEmail, long receiptId, String reason) {
        long adminId = userId(adminEmail, "ADMIN");
        if (receiptId <= 0 || reason == null || reason.isBlank()
                || reason.trim().length() > 500) {
            throw error(HttpStatus.BAD_REQUEST,
                    "Provide a valid receipt ID and rejection reason (1-500 characters)");
        }
        List<Long> orders = jdbc.query("""
                SELECT order_id FROM public.wholesale_payment_records
                WHERE id = ? AND method = 'BANK_TRANSFER'
                """, (rs, rowNum) -> rs.getLong("order_id"), receiptId);
        if (orders.isEmpty()) {
            throw error(HttpStatus.NOT_FOUND, "Bank transfer receipt not found");
        }
        lockOrder(orders.get(0));
        int changed = jdbc.update("""
                UPDATE public.wholesale_payment_records
                SET status = 'REJECTED', reviewed_by = ?, rejection_reason = ?
                WHERE id = ? AND method = 'BANK_TRANSFER' AND status = 'PENDING_REVIEW'
                """, adminId, reason.trim(), receiptId);
        if (changed != 1) {
            throw error(HttpStatus.CONFLICT, "Bank receipt is not awaiting review");
        }
    }

    // ==========================================
    // 28. VALIDATE PRIVATE FILE PATH
    //
    // The database stores only generated filenames.
    // ==========================================

    private Path checkedProofPath(String storedName) {

        if (
                storedName == null ||
                !storedName.matches(
                        "[0-9a-fA-F-]{36}\\.(jpg|png|pdf)"
                )
        ) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Invalid payment proof filename"
            );
        }

        Path file = proofDirectory
                .resolve(storedName)
                .normalize();

        if (
                !file.startsWith(proofDirectory) ||
                !Files.isRegularFile(
                        file,
                        LinkOption.NOFOLLOW_LINKS
                )
        ) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Payment proof file unavailable"
            );
        }

        return file;
    }


@Transactional(readOnly = true)
public List<Map<String, Object>> getChequePayments(
        String adminEmail
) {
    // Only enabled Admin accounts can list cheques.
    userId(adminEmail, "ADMIN");

    return jdbc.queryForList(
            """
            SELECT
                id,
                order_id AS "orderId",
                vehicle_id AS "vehicleId",
                amount,
                status,
                created_at AS "createdAt",
                confirmed_at AS "confirmedAt",
                reviewed_by AS "reviewedBy",
                proof_original_name AS "proofOriginalName",
                (proof_path IS NOT NULL) AS "hasProof",
                rejection_reason AS "rejectionReason"
            FROM public.wholesale_payment_records
            WHERE method = 'CHEQUE'
            ORDER BY
                CASE
                    WHEN status = 'PENDING_REVIEW' THEN 0
                    WHEN status = 'APPROVED' THEN 1
                    ELSE 2
                END,
                created_at DESC,
                id DESC
            """
    );
}

}
