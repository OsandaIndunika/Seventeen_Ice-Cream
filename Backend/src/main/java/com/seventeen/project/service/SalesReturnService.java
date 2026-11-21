
package com.seventeen.project.service;

import com.seventeen.project.dto.CreateSalesReturnRequest;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SalesReturnService {

    private final JdbcTemplate jdbc;

    private static final ZoneId SRI_LANKA_ZONE =
            ZoneId.of("Asia/Colombo");

    // ==========================================
    // DATABASE RESULT PROJECTION
    // ==========================================

    private static final String RETURN_SELECT = """
        SELECT
            id,
            receipt_key AS "receiptKey",
            original_bill_id AS "originalBillId",
            sales_manager_user_id AS "salesManagerUserId",
            vehicle_id AS "vehicleId",
            shop_name AS "shopName",
            shop_phone AS "shopPhone",
            product_id::text AS "productId",
            product_name AS "productName",
            flavour AS "flavour",
            batch_number AS "batchNumber",
            returned_quantity AS "returnedQuantity",
            return_date AS "returnDate",
            return_reason AS "returnReason",
            replacement_stock_id AS "replacementStockId",
            replacement_product_id::text
                AS "replacementProductId",
            replacement_product_name
                AS "replacementProductName",
            replacement_quantity AS "replacementQuantity",
            stock_condition AS "stockCondition",
            status,
            created_at AS "createdAt"
        FROM public.sales_product_returns
        """;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public SalesReturnService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // ERROR HELPERS
    // ==========================================

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

    // ==========================================
    // VALIDATION HELPERS
    // ==========================================

    private String requiredText(
            String value,
            String field,
            int maxLength
    ) {

        String text = value == null
                ? ""
                : value.trim();

        if (text.isEmpty()) {
            throw bad(field + " is required");
        }

        if (text.length() > maxLength) {
            throw bad(
                    field + " cannot exceed " +
                    maxLength + " characters"
            );
        }

        return text;
    }

    private String optionalText(
            String value,
            int maxLength
    ) {

        String text = value == null
                ? ""
                : value.trim();

        if (text.length() > maxLength) {
            throw bad(
                    "Text cannot exceed " +
                    maxLength + " characters"
            );
        }

        return text;
    }

    private String asText(Object value) {
        return value == null
                ? ""
                : String.valueOf(value);
    }

    private long asLong(Object value) {

        if (value instanceof Number number) {
            return number.longValue();
        }

        if (value == null) {
            throw conflict(
                    "Required numeric value is missing"
            );
        }

        try {
            return Long.parseLong(
                    String.valueOf(value)
            );
        } catch (NumberFormatException exception) {
            throw conflict(
                    "Invalid numeric value in return record"
            );
        }
    }

    private boolean sameFlavour(
            String first,
            String second
    ) {
        return first != null &&
                second != null &&
                first.trim().equalsIgnoreCase(
                        second.trim()
                );
    }

    // ==========================================
    // GET AUTHENTICATED SALES MANAGER
    // ==========================================

    private long salesUserId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in again"
            );
        }

        List<Long> users = jdbc.queryForList(
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

        if (users.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Sales Manager account required"
            );
        }

        return users.get(0);
    }

    // ==========================================
    // GET ALREADY-SELECTED ACTIVE LORRY
    // ==========================================

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
                    "No active sales vehicle. " +
                    "Select a lorry before using Returns."
            );
        }

        return vehicles.get(0);
    }

    // ==========================================
    // LOCK ACTIVE LORRY FOR TRANSACTION
    // ==========================================

    private long lockActiveVehicle(long userId) {

        List<Long> vehicles = jdbc.queryForList(
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

        if (vehicles.isEmpty()) {
            throw conflict(
                    "No active sales vehicle session"
            );
        }

        return vehicles.get(0);
    }

    // ==========================================
    // VALIDATE RETURN FORM
    // ==========================================

    private void validateRequest(
            CreateSalesReturnRequest request
    ) {

        if (request == null) {
            throw bad("Return details are required");
        }

        if (request.receiptKey() == null) {
            throw bad(
                    "Return receipt key is required"
            );
        }

        requiredText(
                request.shopName(),
                "Shop name",
                200
        );

        optionalText(
                request.shopPhone(),
                30
        );

        requiredText(
                request.productId(),
                "Returned product ID",
                100
        );

        requiredText(
                request.flavour(),
                "Returned product flavour",
                100
        );

        requiredText(
                request.batchNumber(),
                "Batch number",
                100
        );

        requiredText(
                request.returnReason(),
                "Return reason",
                500
        );

        if (request.returnedQuantity() == null ||
                request.returnedQuantity() <= 0) {
            throw bad(
                    "Returned quantity must be greater than zero"
            );
        }

        if (request.replacementQuantity() == null ||
                request.replacementQuantity() <= 0) {
            throw bad(
                    "Replacement quantity must be greater than zero"
            );
        }

        if (!request.returnedQuantity().equals(
                request.replacementQuantity()
        )) {
            throw bad(
                    "Replacement quantity must match " +
                    "the returned quantity"
            );
        }

        if (request.replacementStockId() == null ||
                request.replacementStockId() <= 0) {
            throw bad(
                    "Select a replacement product " +
                    "from the current lorry"
            );
        }

        if (request.returnDate() == null) {
            throw bad("Return date is required");
        }

        LocalDate today = LocalDate.now(
                SRI_LANKA_ZONE
        );

        if (request.returnDate().isAfter(today)) {
            throw bad(
                    "Return date cannot be in the future"
            );
        }
    }

    // ==========================================
    // FIND RETURN BY UNIQUE RECEIPT KEY
    // ==========================================

    private Map<String, Object> findByReceiptKey(
            UUID receiptKey
    ) {

        List<Map<String, Object>> rows =
                jdbc.queryForList(
                        RETURN_SELECT +
                        """
                        WHERE receipt_key = ?
                        """,
                        receiptKey
                );

        return rows.isEmpty()
                ? null
                : rows.get(0);
    }

    // ==========================================
    // VERIFY DUPLICATE SUBMISSION
    //
    // Same receipt key must represent the
    // same return, with the same owner.
    // ==========================================

    private void verifyRetry(
            Map<String, Object> saved,
            CreateSalesReturnRequest request,
            long userId,
            long vehicleId
    ) {

        boolean same =
                asLong(saved.get("salesManagerUserId"))
                        == userId

                &&

                asLong(saved.get("vehicleId"))
                        == vehicleId

                &&

                Objects.equals(
                        asText(saved.get("shopName")),
                        request.shopName().trim()
                )

                &&

                Objects.equals(
                        asText(saved.get("shopPhone")),
                        optionalText(
                                request.shopPhone(),
                                30
                        )
                )

                &&

                Objects.equals(
                        asText(saved.get("productId")),
                        request.productId().trim()
                )

                &&

                sameFlavour(
                        asText(saved.get("flavour")),
                        request.flavour()
                )

                &&

                Objects.equals(
                        asText(saved.get("batchNumber")),
                        request.batchNumber().trim()
                )

                &&

                asLong(saved.get("returnedQuantity"))
                        == request.returnedQuantity()

                &&

                Objects.equals(
                        asText(saved.get("returnDate")),
                        request.returnDate().toString()
                )

                &&

                Objects.equals(
                        asText(saved.get("returnReason")),
                        request.returnReason().trim()
                )

                &&

                asLong(saved.get("replacementStockId"))
                        == request.replacementStockId()

                &&

                asLong(saved.get("replacementQuantity"))
                        == request.replacementQuantity();

        if (!same) {
            throw conflict(
                    "This receipt key has already been used " +
                    "for a different return"
            );
        }
    }

    // ==========================================
    // GET RETURNABLE PRODUCTS
    //
    // GET /api/sales/returns/products
    //
    // Returns factory catalog products,
    // including items with no current
    // lorry inventory.
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getReturnableProducts(
            String email
    ) {

        long userId = salesUserId(email);

        activeVehicle(userId);

        return jdbc.queryForList(
                """
                SELECT DISTINCT
                    p.id::text AS "productId",
                    p.name AS "productName",
                    p.size AS "size",
                    c.flavour AS "flavour"
                FROM public.wholesale_products p
                JOIN public.wholesale_price_catalog c
                  ON c.product_id = p.id
                ORDER BY
                    p.name,
                    p.size,
                    c.flavour
                """
        );
    }

    // ==========================================
    // CREATE RETURN AND ISSUE REPLACEMENT
    //
    // POST /api/sales/returns
    //
    // No invoice.
    // No Admin approval.
    // No additional lorry selection.
    //
    // Replacement stock deduction and
    // return INSERT use one transaction.
    // ==========================================

    @Transactional
    public Map<String, Object> createReturn(
            String email,
            CreateSalesReturnRequest request
    ) {

        // --------------------------------------
        // 1. VALIDATE REQUEST
        // --------------------------------------

        validateRequest(request);

        // --------------------------------------
        // 2. AUTHENTICATE SALES MANAGER
        // --------------------------------------

        long userId = salesUserId(email);

        // --------------------------------------
        // 3. LOCK ACTIVE LORRY SESSION
        // --------------------------------------

        long vehicleId = lockActiveVehicle(userId);

        // --------------------------------------
        // 4. IDEMPOTENCY CHECK
        // --------------------------------------

        Map<String, Object> previous =
                findByReceiptKey(
                        request.receiptKey()
                );

        if (previous != null) {

            verifyRetry(
                    previous,
                    request,
                    userId,
                    vehicleId
            );

            // The return was already saved.
            // Do not deduct stock again.

            return previous;
        }

        // --------------------------------------
        // 5. VALIDATE STRING PRODUCT ID
        //
        // Examples:
        // 4l-bag
        // 1l-tub
        // popsicle
        // --------------------------------------

        String productId = requiredText(
                request.productId(),
                "Returned product ID",
                100
        );

        String flavour = requiredText(
                request.flavour(),
                "Returned product flavour",
                100
        );

        // --------------------------------------
        // 6. VALIDATE RETURNED PRODUCT
        // --------------------------------------

        List<Map<String, Object>> products =
                jdbc.queryForList(
                        """
                        SELECT
                            p.id::text AS "productId",
                            p.name AS "productName",
                            p.size AS "size"
                        FROM public.wholesale_products p
                        WHERE p.id = ?
                          AND EXISTS (
                              SELECT 1
                              FROM public.wholesale_price_catalog c
                              WHERE c.product_id = p.id
                                AND LOWER(TRIM(c.flavour))
                                    = LOWER(TRIM(?))
                          )
                        """,
                        productId,
                        flavour
                );

        if (products.isEmpty()) {
            throw bad(
                    "Returned product or flavour " +
                    "does not exist in the catalog"
            );
        }

        String productName = asText(
                products.get(0).get("productName")
        );

        // --------------------------------------
        // 7. LOCK REPLACEMENT LORRY STOCK
        //
        // vehicle_stock.id is BIGINT.
        // vehicle_stock.product_id is VARCHAR.
        // --------------------------------------

        List<Map<String, Object>> stockRows =
                jdbc.queryForList(
                        """
                        SELECT
                            s.id AS "stockId",
                            s.vehicle_id AS "vehicleId",
                            s.product_id::text AS "productId",
                            p.name AS "productName",
                            s.flavour AS "flavour",
                            s.quantity AS "quantity",
                            s.reserved_quantity
                                AS "reservedQuantity",
                            (
                                s.quantity -
                                s.reserved_quantity
                            ) AS "availableQuantity"
                        FROM public.vehicle_stock s
                        JOIN public.wholesale_products p
                          ON p.id = s.product_id
                        WHERE s.id = ?
                          AND s.vehicle_id = ?
                        FOR UPDATE OF s
                        """,
                        request.replacementStockId(),
                        vehicleId
                );

        if (stockRows.isEmpty()) {
            throw conflict(
                    "Replacement stock not found " +
                    "on the selected lorry"
            );
        }

        Map<String, Object> stock = stockRows.get(0);

        // --------------------------------------
        // 8. VALIDATE REPLACEMENT PRODUCT
        // --------------------------------------

        String replacementProductId =
                asText(stock.get("productId"));

        String replacementProductName =
                asText(stock.get("productName"));

        String replacementFlavour =
                asText(stock.get("flavour"));

        if (!replacementProductId.equals(productId)) {
            throw bad(
                    "Replacement must match " +
                    "the returned product"
            );
        }

        if (!sameFlavour(
                replacementFlavour,
                flavour
        )) {
            throw bad(
                    "Replacement flavour must match " +
                    "the returned flavour"
            );
        }

        // --------------------------------------
        // 9. CHECK AVAILABLE STOCK
        // --------------------------------------

        long availableQuantity = asLong(
                stock.get("availableQuantity")
        );

        int replacementQuantity =
                request.replacementQuantity();

        if (availableQuantity < replacementQuantity) {
            throw conflict(
                    "Insufficient lorry stock. " +
                    "Available quantity: " +
                    availableQuantity
            );
        }

        // --------------------------------------
        // 10. DEDUCT REPLACEMENT STOCK
        //
        // Do not change reserved_quantity.
        // Do not add returned stock back.
        // --------------------------------------

        int updatedRows = jdbc.update(
                """
                UPDATE public.vehicle_stock
                SET quantity = quantity - ?
                WHERE id = ?
                  AND vehicle_id = ?
                  AND quantity - reserved_quantity >= ?
                """,
                replacementQuantity,
                request.replacementStockId(),
                vehicleId,
                replacementQuantity
        );

        if (updatedRows != 1) {
            throw conflict(
                    "Lorry stock changed. " +
                    "Refresh inventory and try again."
            );
        }

        // --------------------------------------
        // 11. SAVE RETURN AND REPLACEMENT
        //
        // Product IDs are VARCHAR(100).
        // Stock ID is BIGINT.
        //
        // No original_bill_id is supplied;
        // that existing column remains NULL.
        // --------------------------------------

        Long savedReturnId = jdbc.queryForObject(
                """
                INSERT INTO public.sales_product_returns (
                    receipt_key,
                    sales_manager_user_id,
                    vehicle_id,
                    shop_name,
                    shop_phone,
                    product_id,
                    product_name,
                    flavour,
                    batch_number,
                    returned_quantity,
                    return_date,
                    return_reason,
                    replacement_stock_id,
                    replacement_product_id,
                    replacement_product_name,
                    replacement_quantity,
                    stock_condition,
                    status
                )
                VALUES (
                    ?, ?, ?,
                    ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    'QUARANTINED',
                    'REPLACED'
                )
                RETURNING id
                """,
                Long.class,

                request.receiptKey(),
                userId,
                vehicleId,

                request.shopName().trim(),
                optionalText(request.shopPhone(), 30),

                productId,
                productName,
                flavour,

                request.batchNumber().trim(),
                request.returnedQuantity(),
                request.returnDate(),
                request.returnReason().trim(),

                request.replacementStockId(),
                replacementProductId,
                replacementProductName,
                replacementQuantity
        );

        if (savedReturnId == null) {
            throw conflict(
                    "Unable to save product return"
            );
        }

        // --------------------------------------
        // 12. FETCH SAVED RETURN
        // --------------------------------------

        Map<String, Object> saved =
                findByReceiptKey(
                        request.receiptKey()
                );

        if (saved == null) {
            throw conflict(
                    "Saved return could not be retrieved"
            );
        }

        return saved;
    }

    // ==========================================
    // GET RETURN HISTORY
    //
    // GET /api/sales/returns
    //
    // Only shows the current Sales Manager's
    // returns for the selected lorry.
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getReturns(
            String email
    ) {

        long userId = salesUserId(email);
        long vehicleId = activeVehicle(userId);

        return jdbc.queryForList(
                RETURN_SELECT +
                """
                WHERE sales_manager_user_id = ?
                  AND vehicle_id = ?
                ORDER BY created_at DESC, id DESC
                """,
                userId,
                vehicleId
        );
    }
}
