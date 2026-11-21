
package com.seventeen.project.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SalesBillingService {

    private final JdbcTemplate jdbc;

    public SalesBillingService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ======================================
    // REQUEST DTOs
    //
    // Each bill line identifies the exact
    // production batch on the active lorry.
    //
    // Multiple batches of the same product
    // can appear as separate invoice lines.
    // ======================================

    public record BillLineRequest(
        String productId,
        String flavour,
        Integer quantity,
        Long vehicleBatchStockId
    ) {}

    public record CreateBillRequest(
        UUID receiptKey,
        String customerName,
        String customerPhone,
        String paymentMethod,
        List<BillLineRequest> items
    ) {}

    public record CashReceiptRequest(
        UUID receiptKey,
        BigDecimal amount
    ) {}

    // ======================================
    // INTERNAL CALCULATED BILL LINE
    // ======================================

    private record CalculatedLine(
        String productId,
        String productName,
        String size,
        String flavour,
        long vehicleStockId,
        long vehicleBatchStockId,
        String batchNumber,
        int quantity,
        BigDecimal unitPrice,
        BigDecimal lineTotal
    ) {}

    // ======================================
    // ERROR HELPERS
    // ======================================

    private ResponseStatusException bad(
        String message
    ) {
        return new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            message
        );
    }

    private ResponseStatusException conflict(
        String message
    ) {
        return new ResponseStatusException(
            HttpStatus.CONFLICT,
            message
        );
    }

    // ======================================
    // AUTHENTICATED SALES REPRESENTATIVE
    // ======================================

    private long salesUserId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Sales Representative login required"
            );
        }

        List<Long> ids = jdbc.queryForList(
            """
            SELECT id
            FROM public.app_users
            WHERE LOWER(email) = LOWER(?)
              AND role = 'SALES_MANAGER'
              AND enabled = TRUE
            """,
            Long.class,
            email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Sales Representative account required"
            );
        }

        return ids.get(0);
    }

    // ======================================
    // ACTIVE VEHICLE
    // ======================================

    private long activeVehicle(long userId) {

        List<Long> vehicles = jdbc.queryForList(
            """
            SELECT vehicle_id
            FROM public.vehicle_sales_sessions
            WHERE sales_representative_id = ?
              AND ended_at IS NULL
            ORDER BY started_at DESC
            LIMIT 1
            """,
            Long.class,
            userId
        );

        if (vehicles.isEmpty()) {
            throw conflict(
                "Select a sales vehicle first"
            );
        }

        return vehicles.get(0);
    }

    // ======================================
    // MONEY VALIDATION
    // ======================================

    private BigDecimal validMoney(
        BigDecimal amount
    ) {

        if (
            amount == null ||
            amount.compareTo(BigDecimal.ZERO) <= 0
        ) {
            throw bad(
                "Amount must be positive"
            );
        }

        try {
            return amount.setScale(
                2,
                RoundingMode.UNNECESSARY
            );

        } catch (ArithmeticException ex) {

            throw bad(
                "Maximum two decimal places allowed"
            );
        }
    }

    // ======================================
    // 1. SAME PRICES USED BY HOMEPAGE
    //
    // EXISTING METHOD - UNCHANGED
    // ======================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> wholesalePrices() {

        return jdbc.queryForList(
            """
            SELECT
                p.id AS "productId",
                p.name AS "productName",
                p.size AS "size",
                c.flavour AS "flavour",
                c.unit_price AS "unitPrice"
            FROM public.wholesale_price_catalog c
            JOIN public.wholesale_products p
              ON p.id = c.product_id
            ORDER BY p.name, p.size, c.flavour
            """
        );
    }

    // ======================================
    // 2. VEHICLE INVENTORY + LIVE PRICES
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Product-level inventory remains
    // available to the billing interface.
    //
    // Batch information is loaded through:
    //
    // GET /api/sales/vehicles/{id}/batch-inventory
    // ======================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> billableProducts(
        String email
    ) {

        long userId = salesUserId(email);
        long vehicleId = activeVehicle(userId);

        return jdbc.queryForList(
            """
            SELECT
                s.id AS "stockId",
                s.vehicle_id AS "vehicleId",
                s.product_id AS "productId",
                p.name AS "productName",
                p.size AS "size",
                s.flavour AS "flavour",
                s.quantity AS "quantity",
                s.reserved_quantity
                    AS "reservedQuantity",
                (s.quantity - s.reserved_quantity)
                    AS "availableQuantity",
                c.unit_price AS "unitPrice"
            FROM public.vehicle_stock s
            JOIN public.wholesale_products p
              ON p.id = s.product_id
            JOIN public.wholesale_price_catalog c
              ON c.product_id = s.product_id
             AND LOWER(TRIM(c.flavour))
                 = LOWER(TRIM(s.flavour))
            WHERE s.vehicle_id = ?
              AND s.quantity - s.reserved_quantity > 0
            ORDER BY
                p.name, p.size, s.flavour
            """,
            vehicleId
        );
    }

    // ======================================
    // 3. CREATE BILL + DEDUCT BATCH STOCK
    //
    // UPDATED:
    //
    // 1. Validate authenticated session.
    // 2. Check receipt-key idempotency.
    // 3. Validate product and batch number.
    // 4. Check available batch quantity.
    // 5. Read Admin-controlled unit price.
    // 6. Deduct aggregate lorry stock.
    // 7. Deduct selected batch stock.
    // 8. Save bill and bill items.
    // 9. Save immutable batch snapshots.
    //
    // No batch quality-status dependency.
    //
    // All stock changes and invoice inserts
    // occur in a single transaction.
    //
    // Any failure rolls everything back.
    // ======================================

    @Transactional
    public Map<String, Object> createBill(
        String email,
        CreateBillRequest request
    ) {

        // ==================================
        // VALIDATE REQUEST
        // ==================================

        if (
            request == null ||
            request.receiptKey() == null
        ) {
            throw bad(
                "Receipt key is required"
            );
        }

        if (
            request.customerName() == null ||
            request.customerName().isBlank()
        ) {
            throw bad(
                "Customer or shop name is required"
            );
        }

        if (
            request.items() == null ||
            request.items().isEmpty()
        ) {
            throw bad(
                "Add at least one product"
            );
        }

        if (request.items().size() > 100) {
            throw bad(
                "Too many bill items"
            );
        }

        String method = String.valueOf(
            request.paymentMethod()
        ).trim().toUpperCase(Locale.ROOT);

        if (
            !List.of(
                "CASH",
                "CREDIT",
                "BANK_TRANSFER",
                "CHEQUE"
            ).contains(method)
        ) {
            throw bad(
                "Invalid payment method"
            );
        }

        long userId = salesUserId(email);

        // ==================================
        // LOCK ACTIVE SALES SESSION
        //
        // Prevent the current lorry session
        // from ending during bill creation.
        // ==================================

        List<Long> lockedVehicles =
            jdbc.queryForList(
                """
                SELECT vehicle_id
                FROM public.vehicle_sales_sessions
                WHERE sales_representative_id = ?
                  AND ended_at IS NULL
                ORDER BY started_at DESC
                LIMIT 1
                FOR UPDATE
                """,
                Long.class,
                userId
            );

        if (lockedVehicles.isEmpty()) {
            throw conflict(
                "No active vehicle session"
            );
        }

        long vehicleId =
            lockedVehicles.get(0);

        // ==================================
        // IDEMPOTENT RETRY
        //
        // Prevent duplicate invoice creation
        // and stock deduction when retrying
        // with the same receipt key.
        // ==================================

        List<Long> existing =
            jdbc.queryForList(
                """
                SELECT id
                FROM public.sales_bills
                WHERE receipt_key = ?
                  AND sales_representative_id = ?
                """,
                Long.class,
                request.receiptKey(),
                userId
            );

        if (!existing.isEmpty()) {
            return billById(
                email,
                existing.get(0)
            );
        }

        // ==================================
        // VALIDATE BILL ITEMS
        //
        // Different batches of the same
        // product are allowed.
        //
        // Duplicate batch stock IDs are
        // rejected.
        // ==================================

        Set<Long> selectedBatchIds =
            new HashSet<>();

        for (BillLineRequest item : request.items()) {

            if (
                item == null ||
                item.productId() == null ||
                item.productId().isBlank() ||
                item.flavour() == null ||
                item.flavour().isBlank() ||
                item.quantity() == null ||
                item.quantity() <= 0 ||
                item.vehicleBatchStockId() == null ||
                item.vehicleBatchStockId() <= 0
            ) {
                throw bad(
                    "Each bill item must include " +
                    "a valid product, flavour, " +
                    "production batch and quantity"
                );
            }

            if (
                !selectedBatchIds.add(
                    item.vehicleBatchStockId()
                )
            ) {
                throw bad(
                    "Duplicate batch in bill. " +
                    "Combine quantities for the " +
                    "same production batch."
                );
            }
        }

        // ==================================
        // FIND AGGREGATE STOCK ROWS
        //
        // Every selected batch must belong
        // to the authenticated lorry.
        //
        // Do not trust frontend stock IDs
        // as proof of vehicle ownership.
        // ==================================

        List<Long> aggregateStockIds =
            new ArrayList<>();

        for (BillLineRequest item : request.items()) {

            List<Long> matchingStocks =
                jdbc.queryForList(
                    """
                    SELECT
                        s.id
                    FROM public.vehicle_batch_stock vbs

                    JOIN public.vehicle_stock s
                      ON s.id = vbs.vehicle_stock_id

                    JOIN public.product_batches pb
                      ON pb.id = vbs.batch_id

                    WHERE vbs.id = ?
                      AND s.vehicle_id = ?
                      AND s.product_id = ?
                      AND LOWER(TRIM(s.flavour))
                          = LOWER(TRIM(?))
                      AND pb.product_id = s.product_id
                      AND LOWER(TRIM(pb.flavour))
                          = LOWER(TRIM(s.flavour))
                    """,
                    Long.class,
                    item.vehicleBatchStockId(),
                    vehicleId,
                    item.productId().trim(),
                    item.flavour().trim()
                );

            if (matchingStocks.size() != 1) {
                throw conflict(
                    "Selected batch is not assigned " +
                    "to this product on the current lorry."
                );
            }

            aggregateStockIds.add(
                matchingStocks.get(0)
            );
        }

        // ==================================
        // SORT AGGREGATE STOCK IDs
        //
        // Lock in a consistent order to
        // reduce database deadlocks.
        // ==================================

        aggregateStockIds =
            aggregateStockIds.stream()
                .distinct()
                .sorted()
                .toList();

        for (Long stockId : aggregateStockIds) {

            List<Long> lockedStock =
                jdbc.queryForList(
                    """
                    SELECT id
                    FROM public.vehicle_stock
                    WHERE id = ?
                      AND vehicle_id = ?
                    FOR UPDATE
                    """,
                    Long.class,
                    stockId,
                    vehicleId
                );

            if (lockedStock.size() != 1) {
                throw conflict(
                    "Selected lorry stock is no " +
                    "longer available."
                );
            }
        }

        // ==================================
        // LOCK SELECTED BATCH ROWS
        //
        // Batch locks are acquired only
        // after aggregate stock locks.
        // ==================================

        List<Long> sortedBatchIds =
            selectedBatchIds.stream()
                .sorted()
                .toList();

        for (Long batchStockId : sortedBatchIds) {

            List<Long> lockedBatch =
                jdbc.queryForList(
                    """
                    SELECT id
                    FROM public.vehicle_batch_stock
                    WHERE id = ?
                    FOR UPDATE
                    """,
                    Long.class,
                    batchStockId
                );

            if (lockedBatch.size() != 1) {
                throw conflict(
                    "Selected production batch " +
                    "is no longer available."
                );
            }
        }

        // ==================================
        // CALCULATE INVOICE LINES
        //
        // All prices are read directly from
        // PostgreSQL.
        // ==================================

        List<CalculatedLine> lines =
            new ArrayList<>();

        BigDecimal total =
            BigDecimal.ZERO;

        Map<Long, Integer> requestedPerStock =
            new LinkedHashMap<>();

        for (BillLineRequest item : request.items()) {

            String productId =
                item.productId().trim();

            String flavour =
                item.flavour().trim();

            int count =
                item.quantity();

            long batchStockId =
                item.vehicleBatchStockId();

            // ==================================
            // AUTHORITATIVE BATCH LOOKUP
            //
            // FIXED:
            //
            // The removed database column is
            // not referenced anywhere.
            //
            // The trailing SQL comma after
            // pb.batch_number is also removed.
            // ==================================

            List<Map<String, Object>> batchRows =
                jdbc.queryForList(
                    """
                    SELECT
                        s.id AS vehicle_stock_id,

                        s.quantity
                            AS aggregate_quantity,

                        s.reserved_quantity
                            AS aggregate_reserved,

                        vbs.quantity
                            AS batch_quantity,

                        vbs.reserved_quantity
                            AS batch_reserved,

                        pb.batch_number
                            AS batch_number

                    FROM public.vehicle_batch_stock vbs

                    JOIN public.vehicle_stock s
                      ON s.id = vbs.vehicle_stock_id

                    JOIN public.product_batches pb
                      ON pb.id = vbs.batch_id

                    WHERE vbs.id = ?
                      AND s.vehicle_id = ?
                      AND s.product_id = ?
                      AND LOWER(TRIM(s.flavour))
                          = LOWER(TRIM(?))
                      AND pb.product_id = s.product_id
                      AND LOWER(TRIM(pb.flavour))
                          = LOWER(TRIM(s.flavour))
                    """,
                    batchStockId,
                    vehicleId,
                    productId,
                    flavour
                );

            if (batchRows.size() != 1) {
                throw conflict(
                    "Selected production batch does " +
                    "not belong to this lorry stock."
                );
            }

            Map<String, Object> batchRow =
                batchRows.get(0);

            long vehicleStockId =
                ((Number) batchRow.get(
                    "vehicle_stock_id"
                )).longValue();

            Object rawBatchNumber =
                batchRow.get("batch_number");

            String batchNumber =
                rawBatchNumber == null
                    ? ""
                    : rawBatchNumber.toString().trim();

            // ==================================
            // VALIDATE BATCH NUMBER
            //
            // Batch existence, ownership and
            // available quantity are checked.
            //
            // No quality-status check.
            // ==================================

            if (batchNumber.isEmpty()) {
                throw conflict(
                    "Production batch number is missing."
                );
            }

            // ==================================
            // CHECK AVAILABLE BATCH QUANTITY
            // ==================================

            int batchQuantity =
                ((Number) batchRow.get(
                    "batch_quantity"
                )).intValue();

            int batchReserved =
                ((Number) batchRow.get(
                    "batch_reserved"
                )).intValue();

            int availableBatch =
                batchQuantity - batchReserved;

            if (availableBatch < count) {
                throw conflict(
                    "Insufficient available stock " +
                    "in batch " + batchNumber +
                    ". Available: " + availableBatch
                );
            }

            // ==================================
            // CHECK AGGREGATE PRODUCT QUANTITY
            //
            // Different batches of the same
            // product share this stock row.
            // ==================================

            int aggregateQuantity =
                ((Number) batchRow.get(
                    "aggregate_quantity"
                )).intValue();

            int aggregateReserved =
                ((Number) batchRow.get(
                    "aggregate_reserved"
                )).intValue();

            int requestedTotal =
                requestedPerStock.getOrDefault(
                    vehicleStockId,
                    0
                ) + count;

            int availableAggregate =
                aggregateQuantity -
                aggregateReserved;

            if (requestedTotal > availableAggregate) {
                throw conflict(
                    "Insufficient total lorry stock " +
                    "for " + productId +
                    " / " + flavour
                );
            }

            requestedPerStock.put(
                vehicleStockId,
                requestedTotal
            );

            // ==================================
            // AUTHORITATIVE ADMIN PRICE
            //
            // Pricing remains unchanged.
            // ==================================

            List<Map<String, Object>> prices =
                jdbc.queryForList(
                    """
                    SELECT
                        p.name AS product_name,
                        p.size,
                        c.unit_price

                    FROM public.wholesale_price_catalog c

                    JOIN public.wholesale_products p
                      ON p.id = c.product_id

                    WHERE c.product_id = ?
                      AND LOWER(TRIM(c.flavour))
                          = LOWER(TRIM(?))

                    FOR SHARE OF c
                    """,
                    productId,
                    flavour
                );

            if (prices.size() != 1) {
                throw bad(
                    "Wholesale price not configured for " +
                    productId + " / " + flavour
                );
            }

            Map<String, Object> priceRow =
                prices.get(0);

            BigDecimal unitPrice =
                (BigDecimal) priceRow.get(
                    "unit_price"
                );

            BigDecimal lineTotal =
                unitPrice.multiply(
                    BigDecimal.valueOf(count)
                );

            lines.add(
                new CalculatedLine(
                    productId,
                    String.valueOf(
                        priceRow.get("product_name")
                    ),
                    String.valueOf(
                        priceRow.get("size")
                    ),
                    flavour,
                    vehicleStockId,
                    batchStockId,
                    batchNumber,
                    count,
                    unitPrice,
                    lineTotal
                )
            );

            total = total.add(
                lineTotal
            );
        }

        // ==================================
        // DEDUCT AGGREGATE PRODUCT STOCK
        //
        // The quantities are summed across
        // every batch selected for a product.
        //
        // Example:
        //
        // Chocolate 4L:
        // Batch 055 = 4
        // Batch 056 = 3
        //
        // Aggregate stock deduction = 7
        // ==================================

        for (
            Map.Entry<Long, Integer> entry :
            requestedPerStock.entrySet()
        ) {

            int updated = jdbc.update(
                """
                UPDATE public.vehicle_stock

                SET quantity = quantity - ?,
                    updated_at = NOW()

                WHERE id = ?
                  AND vehicle_id = ?
                  AND quantity - reserved_quantity >= ?
                """,
                entry.getValue(),
                entry.getKey(),
                vehicleId,
                entry.getValue()
            );

            if (updated != 1) {
                throw conflict(
                    "Insufficient aggregate vehicle stock. " +
                    "Refresh the available quantities."
                );
            }
        }

        // ==================================
        // DEDUCT SELECTED BATCH STOCK
        //
        // The selected batch's quantity is
        // deducted separately.
        //
        // Both updates occur in the same
        // database transaction.
        // ==================================

        for (CalculatedLine line : lines) {

            int updated = jdbc.update(
                """
                UPDATE public.vehicle_batch_stock

                SET quantity = quantity - ?

                WHERE id = ?
                  AND vehicle_stock_id = ?
                  AND quantity - reserved_quantity >= ?
                """,
                line.quantity(),
                line.vehicleBatchStockId(),
                line.vehicleStockId(),
                line.quantity()
            );

            if (updated != 1) {
                throw conflict(
                    "Batch " + line.batchNumber() +
                    " has insufficient stock. " +
                    "Refresh lorry inventory."
                );
            }
        }

        total = total.setScale(
            2,
            RoundingMode.UNNECESSARY
        );

        // ==================================
        // SAVE MAIN INVOICE
        //
        // Payment initially remains PENDING.
        //
        // Saving a bill does not automatically
        // confirm any payment.
        // ==================================

        Long billId = jdbc.queryForObject(
            """
            INSERT INTO public.sales_bills (
                receipt_key,
                vehicle_id,
                sales_representative_id,
                customer_name,
                customer_phone,
                payment_method,
                payment_status,
                total_amount
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, 'PENDING', ?
            )
            RETURNING id
            """,
            Long.class,
            request.receiptKey(),
            vehicleId,
            userId,
            request.customerName().trim(),
            request.customerPhone() == null
                ? null
                : request.customerPhone().trim(),
            method,
            total
        );

        if (billId == null) {
            throw conflict(
                "Unable to create sales invoice"
            );
        }

        // ==================================
        // SAVE BILL ITEMS + BATCH REFERENCES
        //
        // Different batches are stored as
        // separate invoice lines.
        //
        // The original batch number is saved
        // for permanent invoice traceability.
        // ==================================

        for (CalculatedLine line : lines) {

            Long saleItemId = jdbc.queryForObject(
                """
                INSERT INTO public.sales_bill_items (
                    bill_id,
                    product_id,
                    product_name,
                    size,
                    flavour,
                    quantity,
                    unit_price,
                    line_total
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                billId,
                line.productId(),
                line.productName(),
                line.size(),
                line.flavour(),
                line.quantity(),
                line.unitPrice(),
                line.lineTotal()
            );

            if (saleItemId == null) {
                throw conflict(
                    "Unable to save invoice item"
                );
            }

            jdbc.update(
                """
                INSERT INTO public.sales_bill_batch_allocations (
                    sale_item_id,
                    vehicle_batch_stock_id,
                    batch_number,
                    quantity
                )
                VALUES (?, ?, ?, ?)
                """,
                saleItemId,
                line.vehicleBatchStockId(),
                line.batchNumber(),
                line.quantity()
            );
        }

        // ==================================
        // RETURN SAVED INVOICE
        //
        // Includes:
        //
        // - Product details
        // - Batch number
        // - Batch stock ID
        // - Quantity
        // - Price
        // - Payment information
        // ==================================

        return billById(
            email,
            billId
        );
    }

    // ======================================
    // 4. CONFIRMED DIRECT-SALES PAYMENTS
    //
    // EXISTING METHODS - UNCHANGED
    //
    // Only confirmed payments are counted.
    // ======================================

    private BigDecimal confirmedCash(long billId) {

        BigDecimal result = jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(amount), 0)
            FROM public.sales_cash_collections
            WHERE source_type = 'DIRECT_BILL'
              AND source_id = ?
              AND status = 'CONFIRMED'
            """,
            BigDecimal.class,
            billId
        );

        return result == null
            ? BigDecimal.ZERO
            : result;
    }

    private BigDecimal confirmedNonCash(long billId) {

        BigDecimal result = jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(amount), 0)
            FROM public.sales_bill_payment_proofs
            WHERE bill_id = ?
              AND method IN ('BANK_TRANSFER', 'CHEQUE')
              AND status = 'CONFIRMED'
            """,
            BigDecimal.class,
            billId
        );

        return result == null
            ? BigDecimal.ZERO
            : result;
    }

    private String paymentStatusFor(
        BigDecimal total,
        BigDecimal paid
    ) {

        if (paid.compareTo(total) >= 0) {
            return "PAID";
        }

        return paid.signum() > 0
            ? "PARTIAL"
            : "PENDING";
    }

    // ======================================
    // 5. REFRESH PAYMENT STATUS
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Called after Admin payment verification.
    // ======================================

    @Transactional
    public Map<String, Object> refreshPaymentStatus(
        long billId
    ) {

        List<Map<String, Object>> rows =
            jdbc.queryForList(
                """
                SELECT total_amount
                FROM public.sales_bills
                WHERE id = ?
                FOR UPDATE
                """,
                billId
            );

        if (rows.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Bill not found"
            );
        }

        BigDecimal total =
            (BigDecimal) rows.get(0).get(
                "total_amount"
            );

        BigDecimal cashPaid =
            confirmedCash(billId);

        BigDecimal nonCashPaid =
            confirmedNonCash(billId);

        BigDecimal paid =
            cashPaid.add(nonCashPaid);

        if (paid.compareTo(total) > 0) {
            throw conflict(
                "Confirmed payments exceed invoice total"
            );
        }

        String status =
            paymentStatusFor(total, paid);

        jdbc.update(
            """
            UPDATE public.sales_bills
            SET payment_status = ?
            WHERE id = ?
            """,
            status,
            billId
        );

        return Map.of(
            "billId", billId,
            "paymentStatus", status,
            "totalAmount", total,
            "confirmedCash", cashPaid,
            "confirmedNonCash", nonCashPaid,
            "confirmedPaid", paid,
            "remainingBalance", total.subtract(paid)
        );
    }

    // ======================================
    // 6. LOAD SAVED BILL
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Returns the saved batch number for
    // each invoice line.
    //
    // Older invoices without batch records
    // remain accessible.
    // ======================================

    @Transactional(readOnly = true)
    public Map<String, Object> billById(
        String email,
        long billId
    ) {

        long userId = salesUserId(email);

        List<Map<String, Object>> bills =
            jdbc.queryForList(
                """
                SELECT
                    b.id AS "id",
                    b.vehicle_id AS "vehicleId",
                    v.vehicle_number AS "vehicleNumber",
                    b.customer_name AS "customerName",
                    b.customer_phone AS "customerPhone",
                    b.payment_method AS "paymentMethod",
                    b.payment_status AS "paymentStatus",
                    b.total_amount AS "totalAmount",
                    b.created_at AS "createdAt"

                FROM public.sales_bills b

                JOIN public.delivery_vehicles v
                  ON v.id = b.vehicle_id

                WHERE b.id = ?
                  AND b.sales_representative_id = ?
                """,
                billId,
                userId
            );

        if (bills.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Bill not found"
            );
        }

        Map<String, Object> result =
            new LinkedHashMap<>(
                bills.get(0)
            );

        // ==================================
        // LOAD SAVED ITEMS + BATCH NUMBERS
        // ==================================

        List<Map<String, Object>> items =
            jdbc.queryForList(
                """
                SELECT
                    i.product_id AS "productId",

                    i.product_name AS "productName",

                    i.size AS "size",

                    i.flavour AS "flavour",

                    i.quantity AS "quantity",

                    i.unit_price AS "unitPrice",

                    i.line_total AS "lineTotal",

                    a.batch_number AS "batchNumber",

                    a.vehicle_batch_stock_id
                        AS "vehicleBatchStockId"

                FROM public.sales_bill_items i

                LEFT JOIN public.sales_bill_batch_allocations a
                  ON a.sale_item_id = i.id

                WHERE i.bill_id = ?

                ORDER BY i.id
                """,
                billId
            );

        BigDecimal cashPaid =
            confirmedCash(billId);

        BigDecimal nonCashPaid =
            confirmedNonCash(billId);

        BigDecimal confirmedPaid =
            cashPaid.add(nonCashPaid);

        BigDecimal totalAmount =
            (BigDecimal) result.get(
                "totalAmount"
            );

        result.put("items", items);

        result.put(
            "invoiceNumber",
            "INV-" + billId
        );

        result.put(
            "confirmedCash",
            cashPaid
        );

        result.put(
            "confirmedNonCash",
            nonCashPaid
        );

        result.put(
            "confirmedPaid",
            confirmedPaid
        );

        result.put(
            "remainingBalance",
            totalAmount.subtract(
                confirmedPaid
            ).max(BigDecimal.ZERO)
        );

        return result;
    }

    // ======================================
    // 7. OUTSTANDING CREDIT BALANCES
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Only CREDIT invoices are listed.
    //
    // Includes previous vehicle sessions.
    // ======================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getCreditBalances(
        String email
    ) {

        long userId = salesUserId(email);

        return jdbc.queryForList(
            """
            SELECT
                b.id AS "billId",
                b.id AS "id",
                ('INV-' || b.id) AS "invoiceNumber",
                b.customer_name AS "customerName",
                b.customer_name AS "shopName",
                b.customer_phone AS "customerPhone",
                b.vehicle_id AS "vehicleId",
                v.vehicle_number AS "vehicleNumber",
                b.payment_method AS "paymentMethod",
                b.total_amount AS "totalAmount",
                b.total_amount AS "billTotal",

                COALESCE(c.confirmed_cash, 0)
                    AS "confirmedCash",

                COALESCE(p.confirmed_non_cash, 0)
                    AS "confirmedNonCash",

                (
                    COALESCE(c.confirmed_cash, 0) +
                    COALESCE(p.confirmed_non_cash, 0)
                ) AS "confirmedPaid",

                GREATEST(
                    b.total_amount -
                    COALESCE(c.confirmed_cash, 0) -
                    COALESCE(p.confirmed_non_cash, 0),
                    0
                ) AS "remainingBalance",

                CASE
                    WHEN
                        COALESCE(c.confirmed_cash, 0) +
                        COALESCE(p.confirmed_non_cash, 0)
                            >= b.total_amount
                        THEN 'PAID'

                    WHEN
                        COALESCE(c.confirmed_cash, 0) +
                        COALESCE(p.confirmed_non_cash, 0) > 0
                        THEN 'PARTIALLY_PAID'

                    ELSE 'PENDING'
                END AS "paymentStatus",

                b.created_at AS "createdAt"

            FROM public.sales_bills b

            JOIN public.delivery_vehicles v
              ON v.id = b.vehicle_id

            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(s.amount), 0)
                        AS confirmed_cash

                FROM public.sales_cash_collections s

                WHERE s.source_type = 'DIRECT_BILL'
                  AND s.source_id = b.id
                  AND s.status = 'CONFIRMED'
            ) c ON TRUE

            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(proof.amount), 0)
                        AS confirmed_non_cash

                FROM public.sales_bill_payment_proofs proof

                WHERE proof.bill_id = b.id
                  AND proof.status = 'CONFIRMED'
                  AND proof.method IN (
                      'BANK_TRANSFER',
                      'CHEQUE'
                  )
            ) p ON TRUE

            WHERE b.sales_representative_id = ?
              AND b.payment_method = 'CREDIT'
              AND b.total_amount >
                  COALESCE(c.confirmed_cash, 0) +
                  COALESCE(p.confirmed_non_cash, 0)

            ORDER BY
                b.created_at DESC,
                b.id DESC
            """,
            userId
        );
    }

    // ======================================
    // 8. CONFIRM PHYSICAL CASH RECEIVED
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Supports CASH and CREDIT only.
    //
    // Bank transfers and cheques continue
    // through Admin payment verification.
    // ======================================

    @Transactional
    public Map<String, Object> receiveCash(
        String email,
        long billId,
        CashReceiptRequest request
    ) {

        if (
            request == null ||
            request.receiptKey() == null
        ) {
            throw bad(
                "Cash receipt key is required"
            );
        }

        BigDecimal amount =
            validMoney(request.amount());

        long userId =
            salesUserId(email);

        List<Map<String, Object>> bills =
            jdbc.queryForList(
                """
                SELECT
                    id,
                    vehicle_id,
                    total_amount,
                    payment_method

                FROM public.sales_bills

                WHERE id = ?
                  AND sales_representative_id = ?

                FOR UPDATE
                """,
                billId,
                userId
            );

        if (bills.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Bill not found"
            );
        }

        Map<String, Object> bill =
            bills.get(0);

        long vehicleId =
            ((Number) bill.get(
                "vehicle_id"
            )).longValue();

        String paymentMethod =
            String.valueOf(
                bill.get("payment_method")
            );

        // Keep existing active-vehicle
        // restriction for CASH invoices.
        //
        // CREDIT may be collected later.

        if (
            "CASH".equals(paymentMethod) &&
            activeVehicle(userId) != vehicleId
        ) {
            throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "Bill does not belong to current vehicle"
            );
        }

        if (
            !List.of(
                "CASH",
                "CREDIT"
            ).contains(paymentMethod)
        ) {
            throw bad(
                "Cash confirmation is available for " +
                "Cash and Credit bills only"
            );
        }

        // ==================================
        // CHECK EXISTING CASH RECEIPT
        //
        // Prevent duplicate cash collection.
        // ==================================

        List<Map<String, Object>> previous =
            jdbc.queryForList(
                """
                SELECT source_id, amount
                FROM public.sales_cash_collections
                WHERE receipt_key = ?
                """,
                request.receiptKey()
            );

        if (!previous.isEmpty()) {

            Map<String, Object> existing =
                previous.get(0);

            if (
                ((Number) existing.get(
                    "source_id"
                )).longValue() != billId ||

                ((BigDecimal) existing.get(
                    "amount"
                )).compareTo(amount) != 0
            ) {
                throw conflict(
                    "Receipt key already used"
                );
            }

            return billById(
                email,
                billId
            );
        }

        BigDecimal cashPaid =
            confirmedCash(billId);

        BigDecimal nonCashPaid =
            confirmedNonCash(billId);

        BigDecimal paid =
            cashPaid.add(nonCashPaid);

        BigDecimal total =
            (BigDecimal) bill.get(
                "total_amount"
            );

        if (
            paid.add(amount).compareTo(total) > 0
        ) {
            throw conflict(
                "Cash exceeds remaining bill balance"
            );
        }

        // ==================================
        // SAVE CONFIRMED CASH PAYMENT
        // ==================================

        jdbc.update(
            """
            INSERT INTO public.sales_cash_collections (
                receipt_key,
                vehicle_id,
                collected_by,
                source_type,
                source_id,
                amount,
                status,
                collected_at,
                created_at
            )
            VALUES (
                ?, ?, ?, 'DIRECT_BILL', ?,
                ?, 'CONFIRMED', NOW(), NOW()
            )
            """,
            request.receiptKey(),
            vehicleId,
            userId,
            billId,
            amount
        );

        BigDecimal newPaid =
            paid.add(amount);

        String paymentStatus =
            newPaid.compareTo(total) == 0
                ? "PAID"
                : "PARTIAL";

        jdbc.update(
            """
            UPDATE public.sales_bills
            SET payment_status = ?
            WHERE id = ?
            """,
            paymentStatus,
            billId
        );

        return billById(
            email,
            billId
        );
    }
}
