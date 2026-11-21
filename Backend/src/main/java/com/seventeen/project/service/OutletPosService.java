
package com.seventeen.project.service;

import com.seventeen.project.dto.OutletSaleRequest;
import com.seventeen.project.dto.OutletStockTransferRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OutletPosService {

    // ==========================================
    // DATABASE
    // ==========================================

    private final JdbcTemplate jdbc;

    private static final ZoneId COLOMBO =
            ZoneId.of("Asia/Colombo");

    // ==========================================
    // CONE AND WAFFLE CUP FLAVOURS
    //
    // These are the only allowed flavours.
    //
    // No Jackson ObjectMapper is required.
    // ==========================================

    private static final List<String> SERVING_FLAVOURS =
            List.of(
                    "Vanilla",
                    "Chocolate",
                    "Strawberry"
            );

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public OutletPosService(JdbcTemplate jdbc) {
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
    // AUTHENTICATED OUTLET MANAGER
    // ==========================================

    private long managerId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please sign in again"
            );
        }

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'OUTLET_MANAGER'
                  AND enabled = TRUE
                """,
                Long.class,
                email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Outlet Manager account required"
            );
        }

        return ids.get(0);
    }

    private long outletId(long managerId) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_locations
                WHERE manager_user_id = ?
                  AND active = TRUE
                """,
                Long.class,
                managerId
        );

        if (ids.size() != 1) {
            throw conflict(
                    "Exactly one active retail outlet " +
                    "must be assigned to this manager"
            );
        }

        return ids.get(0);
    }

    private long freezerId(
            long outletId,
            String code
    ) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_freezers
                WHERE outlet_id = ?
                  AND freezer_code = ?
                """,
                Long.class,
                outletId,
                code
        );

        if (ids.size() != 1) {
            throw conflict(
                    code + " is not configured uniquely " +
                    "for this outlet"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // COMMON OUTLET TRANSACTION LOCK
    //
    // Serializes billing and freezer transfers.
    // ==========================================

    private void lockOutlet(long outletId) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_locations
                WHERE id = ?
                  AND active = TRUE
                FOR UPDATE
                """,
                Long.class,
                outletId
        );

        if (ids.isEmpty()) {
            throw conflict(
                    "Outlet is no longer active"
            );
        }
    }

    // ==========================================
    // BATCH STOCK HELPERS
    // ==========================================

    private long trackedQuantity(long stockId) {

        Long value = jdbc.queryForObject(
                """
                SELECT COALESCE(SUM(quantity), 0)
                FROM public.outlet_freezer_batch_stock
                WHERE freezer_stock_id = ?
                """,
                Long.class,
                stockId
        );

        return value == null ? 0L : value;
    }

    private void verifyBatchCoverage(
            long stockId,
            int aggregateQuantity,
            long trackedQuantity
    ) {

        if (
                trackedQuantity != 0 &&
                trackedQuantity != aggregateQuantity
        ) {
            throw conflict(
                    "Batch quantities do not match freezer " +
                    "inventory for stock " + stockId +
                    ". Reconcile the stock before continuing."
            );
        }
    }

    // ==========================================
    // SELECTED PRODUCTION BATCH
    //
    // freezerBatchStockId:
    // outlet_freezer_batch_stock.id
    //
    // batchId:
    // product_batches.id
    // ==========================================

    private record SelectedBatch(
            long freezerBatchStockId,
            long batchId,
            String batchNumber,
            int availableQuantity
    ) {}

    private SelectedBatch selectedBatch(
            long stockId,
            long freezerBatchStockId
    ) {

        List<Map<String, Object>> rows =
                jdbc.queryForList(
                        """
                        SELECT
                            bs.id AS "freezerBatchStockId",
                            bs.batch_id AS "batchId",
                            bs.quantity AS "quantity",
                            b.batch_number AS "batchNumber"

                        FROM public.outlet_freezer_batch_stock bs

                        JOIN public.outlet_pos_stock s
                          ON s.id = bs.freezer_stock_id

                        JOIN public.product_batches b
                          ON b.id = bs.batch_id

                        WHERE bs.id = ?
                          AND bs.freezer_stock_id = ?
                          AND b.product_id = s.product_id
                          AND LOWER(TRIM(b.flavour)) =
                              LOWER(TRIM(s.flavour))

                        FOR UPDATE OF bs
                        """,
                        freezerBatchStockId,
                        stockId
                );

        if (rows.size() != 1) {
            throw conflict(
                    "Selected batch does not belong to " +
                    "the selected freezer product"
            );
        }

        Map<String, Object> row = rows.get(0);

        return new SelectedBatch(
                ((Number) row.get("freezerBatchStockId"))
                        .longValue(),
                ((Number) row.get("batchId"))
                        .longValue(),
                String.valueOf(
                        row.get("batchNumber")
                ),
                ((Number) row.get("quantity"))
                        .intValue()
        );
    }

    // ==========================================
    // DEDUCT SELECTED PRODUCTION BATCH
    //
    // Used for packaged ice cream only.
    // ==========================================

    private void deductSelectedBatch(
            long stockId,
            SelectedBatch batch,
            int quantity
    ) {

        int changed = jdbc.update(
                """
                UPDATE public.outlet_freezer_batch_stock

                SET quantity = quantity - ?,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                  AND freezer_stock_id = ?
                  AND batch_id = ?
                  AND quantity >= ?
                """,
                quantity,
                batch.freezerBatchStockId(),
                stockId,
                batch.batchId(),
                quantity
        );

        if (changed != 1) {
            throw conflict(
                    "Insufficient available stock in batch " +
                    batch.batchNumber()
            );
        }
    }

    // ==========================================
    // DEDUCT AGGREGATE FREEZER STOCK
    //
    // Used for packaged products only.
    // ==========================================

    private void deductAggregateStock(
            long stockId,
            long freezerId,
            int quantity
    ) {

        int changed = jdbc.update(
                """
                UPDATE public.outlet_pos_stock

                SET quantity = quantity - ?,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = ?
                  AND freezer_id = ?
                  AND quantity >= ?
                """,
                quantity,
                stockId,
                freezerId,
                quantity
        );

        if (changed != 1) {
            throw conflict(
                    "Aggregate freezer stock changed " +
                    "during the transaction"
            );
        }
    }

    // ==========================================
    // EXISTING BATCH MOVEMENT HISTORY
    // ==========================================

    private void recordBatchMovement(
            long batchId,
            long freezerStockId,
            String type,
            int change,
            String referenceType,
            long referenceId,
            long managerId
    ) {

        jdbc.update(
                """
                INSERT INTO public.outlet_batch_movements (
                    batch_id,
                    freezer_stock_id,
                    movement_type,
                    quantity_change,
                    reference_type,
                    reference_id,
                    performed_by_user_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                batchId,
                freezerStockId,
                type,
                change,
                referenceType,
                referenceId,
                managerId
        );
    }

    // ==========================================
    // 1. LOAD BOTH FREEZER INVENTORIES
    //
    // EXISTING FUNCTIONALITY PRESERVED
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> inventory(
            String email
    ) {

        long outlet = outletId(managerId(email));

        return jdbc.queryForList(
                """
                SELECT
                    s.id AS "stockId",
                    f.freezer_code AS "freezerCode",
                    f.freezer_name AS "freezerName",
                    s.product_id AS "productId",
                    p.name AS "productName",
                    p.size AS "size",
                    s.flavour AS "flavour",
                    s.quantity AS "quantity",
                    rp.unit_price AS "unitPrice"

                FROM public.outlet_pos_stock s

                JOIN public.outlet_pos_freezers f
                  ON f.id = s.freezer_id

                JOIN public.wholesale_products p
                  ON p.id = s.product_id

                LEFT JOIN public.outlet_pos_retail_prices rp
                  ON rp.outlet_id = f.outlet_id
                 AND rp.product_id = s.product_id
                 AND rp.flavour = s.flavour

                WHERE f.outlet_id = ?

                ORDER BY
                    f.freezer_code,
                    p.name,
                    s.flavour
                """,
                outlet
        );
    }

    // ==========================================
    // 1A. BATCH-WISE FREEZER INVENTORY
    //
    // EXISTING FUNCTIONALITY PRESERVED
    //
    // OutletBatchInventoryController handles
    // GET /api/outlet/pos/batch-inventory.
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getBatchInventory(
            String email
    ) {

        long outlet = outletId(managerId(email));

        return jdbc.queryForList(
                """
                SELECT
                    f.freezer_code AS "freezerCode",
                    f.freezer_name AS "freezerName",

                    s.id AS "stockId",
                    s.product_id AS "productId",

                    p.name AS "productName",
                    p.size AS "size",
                    s.flavour AS "flavour",

                    s.quantity AS "totalQuantity",

                    bs.id AS "freezerBatchStockId",
                    bs.batch_id AS "batchId",
                    b.batch_number AS "batchNumber",

                    COALESCE(bs.quantity, 0)
                        AS "batchQuantity",

                    COALESCE(bs.quantity, 0)
                        AS "availableQuantity"

                FROM public.outlet_pos_stock s

                JOIN public.outlet_pos_freezers f
                  ON f.id = s.freezer_id

                JOIN public.wholesale_products p
                  ON p.id = s.product_id

                LEFT JOIN public.outlet_freezer_batch_stock bs
                  ON bs.freezer_stock_id = s.id

                LEFT JOIN public.product_batches b
                  ON b.id = bs.batch_id

                WHERE f.outlet_id = ?

                ORDER BY
                    f.freezer_code,
                    p.name,
                    p.size,
                    s.flavour,
                    b.batch_number,
                    bs.id
                """,
                outlet
        );
    }

    // ==========================================
    // 2. PACKAGED RETAIL POS PRODUCTS
    //
    // DEFREEZER 1 ONLY
    //
    // EXISTING FUNCTIONALITY PRESERVED
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> retailProducts(
            String email
    ) {

        long outlet = outletId(managerId(email));

        return jdbc.queryForList(
                """
                SELECT
                    s.id AS "stockId",
                    s.product_id AS "productId",
                    p.name AS "productName",
                    p.size AS "size",
                    s.flavour AS "flavour",
                    s.quantity AS "availableQuantity",
                    rp.unit_price AS "unitPrice"

                FROM public.outlet_pos_stock s

                JOIN public.outlet_pos_freezers f
                  ON f.id = s.freezer_id

                JOIN public.wholesale_products p
                  ON p.id = s.product_id

                JOIN public.outlet_pos_retail_prices rp
                  ON rp.outlet_id = f.outlet_id
                 AND rp.product_id = s.product_id
                 AND rp.flavour = s.flavour

                WHERE f.outlet_id = ?
                  AND f.freezer_code = 'FREEZER_1'
                  AND s.quantity > 0

                ORDER BY p.name, s.flavour
                """,
                outlet
        );
    }

    // ==========================================
    // 2A. CONE AND WAFFLE CUP MENU
    //
    // GET /api/outlet/pos/serving-options
    //
    // READ ONLY.
    // NO FREEZER STOCK DEDUCTION.
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> servingOptions(
            String email
    ) {

        outletId(managerId(email));

        return jdbc.queryForList(
                """
                SELECT
                    id AS "id",
                    code AS "code",
                    name AS "name",
                    corn_type AS "cornType",
                    flavour_mode AS "flavourMode",
                    scoop_count AS "scoopCount",
                    unit_price AS "unitPrice"

                FROM public.outlet_pos_serving_options

                WHERE active = TRUE

                ORDER BY
                    unit_price ASC,
                    id ASC
                """
        );
    }

    // ==========================================
    // 3. DAILY RETAIL SALES REPORT
    //
    // EXISTING FUNCTIONALITY PRESERVED
    //
    // Includes combined bills because all
    // sales use outlet_pos_sales.
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> dailyReport(
            String email
    ) {

        long outlet = outletId(managerId(email));

        LocalDate today = LocalDate.now(COLOMBO);

        String start = today.toString();
        String end = today.plusDays(1).toString();

        Map<String, Object> totals =
                jdbc.queryForMap(
                        """
                        SELECT
                            COUNT(*) AS "totalBills",

                            COALESCE(SUM(total_amount), 0)
                                AS "todaySales",

                            COALESCE(SUM(total_amount) FILTER (
                                WHERE payment_method = 'CASH'
                                  AND payment_status = 'PAID'
                            ), 0) AS "todayCash",

                            COALESCE(SUM(total_amount) FILTER (
                                WHERE payment_method = 'CARD'
                            ), 0) AS "cardSales",

                            COALESCE(SUM(total_amount) FILTER (
                                WHERE payment_method = 'CHEQUE'
                            ), 0) AS "chequeSales"

                        FROM public.outlet_pos_sales

                        WHERE outlet_id = ?

                          AND created_at >=
                              (?::date::timestamp
                                AT TIME ZONE 'Asia/Colombo')

                          AND created_at <
                              (?::date::timestamp
                                AT TIME ZONE 'Asia/Colombo')
                        """,
                        outlet,
                        start,
                        end
                );

        List<Map<String, Object>> recent =
                jdbc.queryForList(
                        """
                        SELECT
                            id AS "saleId",
                            total_amount AS "totalAmount",
                            payment_method AS "paymentMethod",
                            payment_status AS "paymentStatus",
                            created_at AS "createdAt"

                        FROM public.outlet_pos_sales

                        WHERE outlet_id = ?

                        ORDER BY
                            created_at DESC,
                            id DESC

                        LIMIT 10
                        """,
                        outlet
                );

        Map<String, Object> result =
                new LinkedHashMap<>(totals);

        result.put("date", start);
        result.put("recentSales", recent);

        return result;
    }

    // ==========================================
    // 4. COMBINED RETAIL BILLING
    //
    // PACKAGED PRODUCTS:
    // Deduct aggregate and batch stock.
    //
    // CONES / WAFFLE CUPS:
    // Record sale only.
    //
    // CASH ONLY.
    // ==========================================

    private record SaleKey(
            long stockId,
            Long freezerBatchStockId
    ) {}

    private record PricedLine(
            long stockId,
            Long freezerBatchStockId,
            SelectedBatch batch,
            String productId,
            String productName,
            String productSize,
            String flavour,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {}

    private record ServingKey(
            long servingOptionId,
            List<String> flavours
    ) {}

    private record PricedServing(
            long servingOptionId,
            String name,
            String cornType,
            int scoopCount,
            List<String> flavours,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {}

    // ==========================================
    // NORMALIZE PACKAGED SALE ITEMS
    //
    // Empty is allowed for serving-only bills.
    // ==========================================

    private Map<SaleKey, Integer> normalizeSaleItems(
            List<OutletSaleRequest.SaleItem> items
    ) {

        Map<SaleKey, Integer> result =
                new LinkedHashMap<>();

        if (items == null) {
            return result;
        }

        for (OutletSaleRequest.SaleItem item : items) {

            if (
                    item == null ||
                    item.stockId() == null ||
                    item.stockId() <= 0 ||
                    item.quantity() == null ||
                    item.quantity() <= 0
            ) {
                throw bad(
                        "Invalid packaged product or quantity"
                );
            }

            Long batchStockId =
                    item.freezerBatchStockId();

            if (
                    batchStockId != null &&
                    batchStockId <= 0
            ) {
                throw bad(
                        "Invalid production batch selection"
                );
            }

            SaleKey key = new SaleKey(
                    item.stockId(),
                    batchStockId
            );

            if (
                    result.putIfAbsent(
                            key,
                            item.quantity()
                    ) != null
            ) {
                throw bad(
                        "The same product and batch appear " +
                        "more than once in the bill"
                );
            }
        }

        return result;
    }

    // ==========================================
    // NORMALIZE CONE AND WAFFLE CUP ITEMS
    //
    // No freezer stock ID is required.
    // No production batch ID is required.
    // ==========================================

    private Map<ServingKey, Integer> normalizeServingItems(
            List<OutletSaleRequest.ServingItem> items
    ) {

        Map<ServingKey, Integer> result =
                new LinkedHashMap<>();

        if (items == null) {
            return result;
        }

        for (OutletSaleRequest.ServingItem item : items) {

            if (
                    item == null ||
                    item.servingOptionId() == null ||
                    item.servingOptionId() <= 0 ||
                    item.quantity() == null ||
                    item.quantity() <= 0 ||
                    item.flavours() == null
            ) {
                throw bad(
                        "Invalid cone or waffle cup item"
                );
            }

            List<String> flavours =
                    new ArrayList<>();

            for (String rawFlavour : item.flavours()) {

                if (rawFlavour == null) {
                    throw bad(
                            "Select all serving flavours"
                    );
                }

                String flavour =
                        rawFlavour.trim();

                if (!SERVING_FLAVOURS.contains(flavour)) {
                    throw bad(
                            "Invalid serving flavour: " +
                            flavour
                    );
                }

                flavours.add(flavour);
            }

            if (flavours.isEmpty()) {
                throw bad(
                        "Select at least one serving flavour"
                );
            }

            ServingKey key =
                    new ServingKey(
                            item.servingOptionId(),
                            List.copyOf(flavours)
                    );

            try {
                result.merge(
                        key,
                        item.quantity(),
                        Math::addExact
                );
            } catch (ArithmeticException ex) {
                throw bad(
                        "Serving quantity is too large"
                );
            }
        }

        return result;
    }

    // ==========================================
    // VALIDATE SERVING FLAVOURS
    //
    // SINGLE:
    // Vanilla / Chocolate / Strawberry
    //
    // MIXED:
    // Vanilla + Chocolate
    // Vanilla + Strawberry
    //
    // ANY:
    // Any allowed flavour for each scoop.
    // ==========================================

    private void validateServingFlavours(
            String flavourMode,
            int scoopCount,
            List<String> flavours
    ) {

        if (scoopCount <= 0) {
            throw conflict(
                    "Invalid configured scoop count"
            );
        }

        if (flavours.size() != scoopCount) {
            throw bad(
                    "Select exactly " +
                    scoopCount +
                    " flavour(s) for this serving"
            );
        }

        for (String flavour : flavours) {

            if (!SERVING_FLAVOURS.contains(flavour)) {
                throw bad(
                        "Invalid ice cream flavour"
                );
            }
        }

        switch (flavourMode) {

            case "SINGLE" -> {

                if (scoopCount != 1) {
                    throw conflict(
                            "Single flavour menu configuration " +
                            "must have one scoop"
                    );
                }
            }

            case "MIXED" -> {

                if (scoopCount != 2) {
                    throw conflict(
                            "Mixed flavour menu configuration " +
                            "must have two flavour portions"
                    );
                }

                boolean validCombination =
                        flavours.equals(
                                List.of(
                                        "Vanilla",
                                        "Chocolate"
                                )
                        )
                        ||
                        flavours.equals(
                                List.of(
                                        "Vanilla",
                                        "Strawberry"
                                )
                        );

                if (!validCombination) {
                    throw bad(
                            "Mixed cones allow only " +
                            "Vanilla & Chocolate or " +
                            "Vanilla & Strawberry"
                    );
                }
            }

            case "ANY" -> {
                // Repeated flavours are allowed.
                //
                // Example:
                // Vanilla, Vanilla, Chocolate.
                //
                // No freezer stock deduction.
            }

            default -> throw conflict(
                    "Unsupported serving flavour mode"
            );
        }
    }

    // ==========================================
    // PRICE CONES AND WAFFLE CUPS
    //
    // Prices always come from PostgreSQL.
    //
    // React cannot control the unit price.
    //
    // NO FREEZER STOCK ACCESS.
    // ==========================================

    private List<PricedServing> priceServingItems(
            Map<ServingKey, Integer> requested
    ) {

        List<PricedServing> lines =
                new ArrayList<>();

        for (
                Map.Entry<ServingKey, Integer> entry :
                requested.entrySet()
        ) {

            ServingKey key = entry.getKey();
            int quantity = entry.getValue();

            List<Map<String, Object>> options =
                    jdbc.queryForList(
                            """
                            SELECT
                                id AS "id",
                                name AS "name",
                                corn_type AS "cornType",
                                flavour_mode AS "flavourMode",
                                scoop_count AS "scoopCount",
                                unit_price AS "unitPrice"

                            FROM public.outlet_pos_serving_options

                            WHERE id = ?
                              AND active = TRUE
                            """,
                            key.servingOptionId()
                    );

            if (options.size() != 1) {
                throw bad(
                        "Selected cone or waffle cup " +
                        "option is not available"
                );
            }

            Map<String, Object> option =
                    options.get(0);

            String flavourMode =
                    String.valueOf(
                            option.get("flavourMode")
                    );

            int scoopCount =
                    ((Number) option.get("scoopCount"))
                            .intValue();

            validateServingFlavours(
                    flavourMode,
                    scoopCount,
                    key.flavours()
            );

            BigDecimal unitPrice =
                    (BigDecimal) option.get(
                            "unitPrice"
                    );

            if (
                    unitPrice == null ||
                    unitPrice.signum() < 0
            ) {
                throw conflict(
                        "Invalid cone or waffle cup price"
                );
            }

            BigDecimal lineTotal =
                    unitPrice.multiply(
                            BigDecimal.valueOf(quantity)
                    );

            lines.add(
                    new PricedServing(
                            key.servingOptionId(),
                            String.valueOf(
                                    option.get("name")
                            ),
                            String.valueOf(
                                    option.get("cornType")
                            ),
                            scoopCount,
                            key.flavours(),
                            quantity,
                            unitPrice,
                            lineTotal
                    )
            );
        }

        return lines;
    }

    // ==========================================
    // FIXED: SERIALIZE SERVING FLAVOURS TO JSON
    //
    // No ObjectMapper required.
    //
    // Safe because every input flavour is
    // validated against SERVING_FLAVOURS.
    //
    // Examples:
    //
    // ["Vanilla"]
    //
    // ["Vanilla","Chocolate"]
    //
    // ["Vanilla","Chocolate","Strawberry"]
    // ==========================================

    private String flavoursToJson(
            List<String> flavours
    ) {

        if (
                flavours == null ||
                flavours.isEmpty()
        ) {
            throw bad(
                    "Serving flavours are required"
            );
        }

        StringBuilder json =
                new StringBuilder("[");

        for (int i = 0; i < flavours.size(); i++) {

            String flavour = flavours.get(i);

            if (
                    flavour == null ||
                    !SERVING_FLAVOURS.contains(flavour)
            ) {
                throw bad(
                        "Invalid serving flavour"
                );
            }

            if (i > 0) {
                json.append(",");
            }

            json.append("\"")
                    .append(flavour)
                    .append("\"");
        }

        json.append("]");

        return json.toString();
    }

    // ==========================================
    // FIXED: READ SAVED JSON FLAVOURS
    //
    // No TypeReference required.
    //
    // PostgreSQL stores this as JSONB.
    //
    // Only the three configured flavours
    // are accepted.
    //
    // This method is used to verify retries
    // of previously saved retail bills.
    // ==========================================

    private List<String> flavoursFromJson(
            String json
    ) {

        if (json == null) {
            throw conflict(
                    "Saved serving flavour data is missing"
            );
        }

        String value = json.trim();

        if (
                !value.startsWith("[") ||
                !value.endsWith("]")
        ) {
            throw conflict(
                    "Saved serving flavour data is invalid"
            );
        }

        String content =
                value.substring(
                        1,
                        value.length() - 1
                ).trim();

        if (content.isEmpty()) {
            return List.of();
        }

        String[] parts =
                content.split(",", -1);

        List<String> flavours =
                new ArrayList<>();

        for (String part : parts) {

            String token = part.trim();

            // JSONB returns string elements
            // surrounded by double quotes.
            //
            // The fixed flavour whitelist
            // excludes commas, backslashes,
            // quotes, and other special values.

            if (
                    token.length() < 2 ||
                    !token.startsWith("\"") ||
                    !token.endsWith("\"")
            ) {
                throw conflict(
                        "Saved serving flavour data is invalid"
                );
            }

            String flavour =
                    token.substring(
                            1,
                            token.length() - 1
                    );

            if (!SERVING_FLAVOURS.contains(flavour)) {
                throw conflict(
                        "Saved serving flavour is invalid"
                );
            }

            flavours.add(flavour);
        }

        return List.copyOf(flavours);
    }

    // ==========================================
    // IDEMPOTENT RETRY VALIDATION
    //
    // PACKAGED:
    // stockId + batch stock ID + quantity
    //
    // SERVING:
    // serving option + flavours + quantity
    //
    // Prevents duplicate bills and
    // repeated freezer stock deduction.
    // ==========================================

    private void verifySaleRetry(
            Map<String, Object> saved,
            long manager,
            long outlet,
            String paymentMethod,
            Map<SaleKey, Integer> requestedPackaged,
            Map<ServingKey, Integer> requestedServing
    ) {

        if (
                ((Number) saved.get("outletId"))
                        .longValue() != outlet ||
                ((Number) saved.get("managerUserId"))
                        .longValue() != manager
        ) {
            throw conflict(
                    "Receipt key belongs to another sale"
            );
        }

        if (
                !paymentMethod.equals(
                        saved.get("paymentMethod")
                )
        ) {
            throw conflict(
                    "Receipt key was used for a " +
                    "different payment method"
            );
        }

        long saleId =
                ((Number) saved.get("saleId"))
                        .longValue();

        // ======================================
        // VERIFY PACKAGED ITEMS
        // ======================================

        List<Map<String, Object>> savedItems =
                jdbc.queryForList(
                        """
                        SELECT
                            si.stock_id AS "stockId",
                            si.quantity AS "quantity",
                            bs.id AS "freezerBatchStockId"

                        FROM public.outlet_pos_sale_items si

                        LEFT JOIN public.outlet_sale_batch_allocations a
                          ON a.sale_item_id = si.id

                        LEFT JOIN public.outlet_freezer_batch_stock bs
                          ON bs.freezer_stock_id = si.stock_id
                         AND bs.batch_id = a.batch_id

                        WHERE si.sale_id = ?

                        ORDER BY si.id
                        """,
                        saleId
                );

        if (
                savedItems.size() !=
                requestedPackaged.size()
        ) {
            throw conflict(
                    "Receipt key was used for " +
                    "different packaged sale items"
            );
        }

        Map<SaleKey, Integer> originalPackaged =
                new LinkedHashMap<>();

        for (
                Map<String, Object> row :
                savedItems
        ) {

            long stockId =
                    ((Number) row.get("stockId"))
                            .longValue();

            Object rawBatchStockId =
                    row.get("freezerBatchStockId");

            Long batchStockId =
                    rawBatchStockId instanceof Number
                            ? ((Number) rawBatchStockId)
                                    .longValue()
                            : null;

            SaleKey key =
                    new SaleKey(
                            stockId,
                            batchStockId
                    );

            int quantity =
                    ((Number) row.get("quantity"))
                            .intValue();

            if (
                    originalPackaged.putIfAbsent(
                            key,
                            quantity
                    ) != null
            ) {
                throw conflict(
                        "Saved invoice has ambiguous " +
                        "packaged batch items"
                );
            }
        }

        if (
                !originalPackaged.equals(
                        requestedPackaged
                )
        ) {
            throw conflict(
                    "Receipt key was used for " +
                    "different packaged sale items"
            );
        }

        // ======================================
        // VERIFY CONE AND WAFFLE CUP ITEMS
        // ======================================

        List<Map<String, Object>> savedServings =
                jdbc.queryForList(
                        """
                        SELECT
                            serving_option_id
                                AS "servingOptionId",

                            flavours::text
                                AS "flavoursJson",

                            quantity AS "quantity"

                        FROM public.outlet_pos_serving_sale_items

                        WHERE sale_id = ?

                        ORDER BY id
                        """,
                        saleId
                );

        Map<ServingKey, Integer> originalServing =
                new LinkedHashMap<>();

        for (
                Map<String, Object> row :
                savedServings
        ) {

            long servingOptionId =
                    ((Number) row.get(
                            "servingOptionId"
                    )).longValue();

            String flavoursJson =
                    String.valueOf(
                            row.get("flavoursJson")
                    );

            List<String> flavours =
                    flavoursFromJson(
                            flavoursJson
                    );

            ServingKey key =
                    new ServingKey(
                            servingOptionId,
                            flavours
                    );

            int quantity =
                    ((Number) row.get("quantity"))
                            .intValue();

            try {
                originalServing.merge(
                        key,
                        quantity,
                        Math::addExact
                );
            } catch (ArithmeticException ex) {
                throw conflict(
                        "Saved serving quantity is invalid"
                );
            }
        }

        if (
                !originalServing.equals(
                        requestedServing
                )
        ) {
            throw conflict(
                    "Receipt key was used for " +
                    "different cone or waffle cup items"
            );
        }
    }

    // ==========================================
    // CREATE COMBINED RETAIL SALE
    //
    // Supports:
    //
    // 1. Packaged ice cream only
    // 2. Cones and waffle cups only
    // 3. Both types in one bill
    //
    // CASH ONLY.
    //
    // Everything is saved transactionally.
    // ==========================================

    @Transactional
    public Map<String, Object> createSale(
            String email,
            OutletSaleRequest request
    ) {

        // ======================================
        // VALIDATE RECEIPT KEY
        // ======================================

        if (
                request == null ||
                request.receiptKey() == null
        ) {
            throw bad(
                    "Receipt key is required"
            );
        }

        // ======================================
        // NORMALIZE BOTH BILL ITEM TYPES
        // ======================================

        Map<SaleKey, Integer> requestedPackaged =
                normalizeSaleItems(
                        request.items()
                );

        Map<ServingKey, Integer> requestedServing =
                normalizeServingItems(
                        request.servingItems()
                );

        if (
                requestedPackaged.isEmpty() &&
                requestedServing.isEmpty()
        ) {
            throw bad(
                    "At least one packaged product, " +
                    "cone or waffle cup is required"
            );
        }

        // ======================================
        // CASH PAYMENT ONLY
        // ======================================

        String method =
                request.paymentMethod() == null
                        ? ""
                        : request.paymentMethod()
                                .trim()
                                .toUpperCase();

        if (!"CASH".equals(method)) {
            throw bad(
                    "Only CASH payments are accepted " +
                    "for outlet retail sales"
            );
        }

        long manager = managerId(email);
        long outlet = outletId(manager);

        // ======================================
        // SERIALIZE OUTLET BILLING TRANSACTIONS
        // ======================================

        lockOutlet(outlet);

        // ======================================
        // CHECK PREVIOUS RECEIPT KEY
        // ======================================

        List<Map<String, Object>> previous =
                jdbc.queryForList(
                        """
                        SELECT
                            id AS "saleId",
                            receipt_key AS "receiptKey",
                            outlet_id AS "outletId",
                            manager_user_id AS "managerUserId",
                            total_amount AS "totalAmount",
                            payment_method AS "paymentMethod",
                            payment_status AS "paymentStatus"

                        FROM public.outlet_pos_sales

                        WHERE receipt_key = ?
                        """,
                        request.receiptKey()
                );

        if (!previous.isEmpty()) {

            Map<String, Object> saved =
                    previous.get(0);

            verifySaleRetry(
                    saved,
                    manager,
                    outlet,
                    method,
                    requestedPackaged,
                    requestedServing
            );

            // Return previous bill.
            // Do not deduct stock again.
            // Do not insert duplicate serving items.

            return saved;
        }

        // ======================================
        // PRICE CONES AND WAFFLE CUPS
        //
        // NO FREEZER STOCK DEDUCTION.
        // ======================================

        List<PricedServing> pricedServings =
                priceServingItems(
                        requestedServing
                );

        BigDecimal total =
                BigDecimal.ZERO;

        for (PricedServing serving :
                pricedServings) {

            total = total.add(
                    serving.lineTotal()
            );
        }

        // ======================================
        // PRICE PACKAGED PRODUCTS
        //
        // Existing batch-aware logic preserved.
        // ======================================

        List<PricedLine> lines =
                new ArrayList<>();

        long sellingFreezer = 0L;

        if (!requestedPackaged.isEmpty()) {

            sellingFreezer =
                    freezerId(
                            outlet,
                            "FREEZER_1"
                    );

            // ==================================
            // GROUP AGGREGATE STOCK DEMAND
            // ==================================

            Map<Long, Integer> aggregateDemand =
                    new HashMap<>();

            for (
                    Map.Entry<SaleKey, Integer> entry :
                    requestedPackaged.entrySet()
            ) {
                try {
                    aggregateDemand.merge(
                            entry.getKey().stockId(),
                            entry.getValue(),
                            Math::addExact
                    );
                } catch (ArithmeticException ex) {
                    throw bad(
                            "Total requested quantity is too large"
                    );
                }
            }

            // ==================================
            // LOCK STOCK ROWS IN STABLE ORDER
            // ==================================

            List<Long> sortedStockIds =
                    new ArrayList<>(
                            aggregateDemand.keySet()
                    );

            sortedStockIds.sort(
                    Comparator.naturalOrder()
            );

            Map<Long, Map<String, Object>> stockRows =
                    new LinkedHashMap<>();

            for (long stockId : sortedStockIds) {

                List<Map<String, Object>> rows =
                        jdbc.queryForList(
                                """
                                SELECT
                                    s.id AS "stockId",
                                    s.product_id AS "productId",
                                    p.name AS "productName",
                                    p.size AS "productSize",
                                    s.flavour AS "flavour",
                                    s.quantity AS "quantity",
                                    rp.unit_price AS "unitPrice"

                                FROM public.outlet_pos_stock s

                                JOIN public.wholesale_products p
                                  ON p.id = s.product_id

                                JOIN public.outlet_pos_retail_prices rp
                                  ON rp.outlet_id = ?
                                 AND rp.product_id = s.product_id
                                 AND rp.flavour = s.flavour

                                WHERE s.id = ?
                                  AND s.freezer_id = ?

                                FOR UPDATE OF s
                                """,
                                outlet,
                                stockId,
                                sellingFreezer
                        );

                if (rows.size() != 1) {
                    throw conflict(
                            "Selected product is unavailable " +
                            "in Defreezer 1"
                    );
                }

                Map<String, Object> stock =
                        rows.get(0);

                int available =
                        ((Number) stock.get("quantity"))
                                .intValue();

                if (
                        aggregateDemand.get(stockId) >
                        available
                ) {
                    throw conflict(
                            "Insufficient Defreezer 1 stock for " +
                            stock.get("productName")
                    );
                }

                long tracked =
                        trackedQuantity(stockId);

                verifyBatchCoverage(
                        stockId,
                        available,
                        tracked
                );

                stockRows.put(
                        stockId,
                        stock
                );
            }

            // ==================================
            // SORT PACKAGED BILL LINES
            // ==================================

            List<Map.Entry<SaleKey, Integer>> entries =
                    new ArrayList<>(
                            requestedPackaged.entrySet()
                    );

            entries.sort(
                    Comparator
                        .comparingLong(
                            (Map.Entry<SaleKey, Integer> entry) ->
                                    entry.getKey().stockId()
                        )
                        .thenComparing(
                            entry ->
                                    entry.getKey()
                                            .freezerBatchStockId(),
                            Comparator.nullsFirst(
                                    Comparator.naturalOrder()
                            )
                        )
            );

            // ==================================
            // VALIDATE AND PRICE EACH BATCH
            // ==================================

            for (
                    Map.Entry<SaleKey, Integer> entry :
                    entries
            ) {

                SaleKey key =
                        entry.getKey();

                int quantity =
                        entry.getValue();

                Map<String, Object> stock =
                        stockRows.get(
                                key.stockId()
                        );

                int aggregateAvailable =
                        ((Number) stock.get("quantity"))
                                .intValue();

                long tracked =
                        trackedQuantity(
                                key.stockId()
                        );

                SelectedBatch batch = null;

                // ==============================
                // EXACT PRODUCTION BATCH
                // ==============================

                if (
                        key.freezerBatchStockId() != null
                ) {

                    batch = selectedBatch(
                            key.stockId(),
                            key.freezerBatchStockId()
                    );

                    if (
                            quantity >
                            batch.availableQuantity()
                    ) {
                        throw conflict(
                                "Insufficient stock in batch " +
                                batch.batchNumber() +
                                ". Available: " +
                                batch.availableQuantity()
                        );
                    }

                } else if (
                        tracked > 0 ||
                        aggregateAvailable == 0
                ) {

                    throw bad(
                            "Select a production batch " +
                            "for product " +
                            stock.get("productName")
                    );
                }

                // Existing legacy untracked-stock
                // support is preserved.

                BigDecimal price =
                        (BigDecimal) stock.get(
                                "unitPrice"
                        );

                if (price == null) {
                    throw conflict(
                            "Retail unit price is not configured"
                    );
                }

                BigDecimal lineTotal =
                        price.multiply(
                                BigDecimal.valueOf(quantity)
                        );

                lines.add(
                        new PricedLine(
                                key.stockId(),
                                key.freezerBatchStockId(),
                                batch,
                                String.valueOf(
                                        stock.get("productId")
                                ),
                                String.valueOf(
                                        stock.get("productName")
                                ),
                                stock.get("productSize") == null
                                        ? ""
                                        : String.valueOf(
                                                stock.get("productSize")
                                        ),
                                String.valueOf(
                                        stock.get("flavour")
                                ),
                                quantity,
                                price,
                                lineTotal
                        )
                );

                total = total.add(
                        lineTotal
                );
            }
        }

        // ======================================
        // SAVE ONE COMBINED RETAIL BILL
        // ======================================

        String paymentStatus = "PAID";

        Long saleId =
                jdbc.queryForObject(
                        """
                        INSERT INTO public.outlet_pos_sales (
                            receipt_key,
                            outlet_id,
                            manager_user_id,
                            total_amount,
                            payment_method,
                            payment_status
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                        RETURNING id
                        """,
                        Long.class,
                        request.receiptKey(),
                        outlet,
                        manager,
                        total,
                        method,
                        paymentStatus
                );

        if (saleId == null) {
            throw conflict(
                    "Unable to create retail invoice"
            );
        }

        // ======================================
        // SAVE PACKAGED PRODUCTS
        //
        // DEDUCT FREEZER AND BATCH STOCK.
        // ======================================

        for (PricedLine line : lines) {

            deductAggregateStock(
                    line.stockId(),
                    sellingFreezer,
                    line.quantity()
            );

            if (line.batch() != null) {

                deductSelectedBatch(
                        line.stockId(),
                        line.batch(),
                        line.quantity()
                );
            }

            Long saleItemId =
                    jdbc.queryForObject(
                            """
                            INSERT INTO public.outlet_pos_sale_items (
                                sale_id,
                                stock_id,
                                product_id,
                                product_name,
                                product_size,
                                flavour,
                                quantity,
                                unit_price,
                                line_total
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            RETURNING id
                            """,
                            Long.class,
                            saleId,
                            line.stockId(),
                            line.productId(),
                            line.productName(),
                            line.productSize(),
                            line.flavour(),
                            line.quantity(),
                            line.unitPrice(),
                            line.lineTotal()
                    );

            if (saleItemId == null) {
                throw conflict(
                        "Unable to save retail invoice item"
                );
            }

            // ==================================
            // SAVE PACKAGED BATCH TRACEABILITY
            // ==================================

            if (line.batch() != null) {

                jdbc.update(
                        """
                        INSERT INTO public.outlet_sale_batch_allocations (
                            sale_item_id,
                            batch_id,
                            quantity
                        )
                        VALUES (?, ?, ?)
                        """,
                        saleItemId,
                        line.batch().batchId(),
                        line.quantity()
                );

                recordBatchMovement(
                        line.batch().batchId(),
                        line.stockId(),
                        "RETAIL_SALE",
                        -line.quantity(),
                        "OUTLET_SALE",
                        saleId,
                        manager
                );
            }
        }

        // ======================================
        // SAVE CONES AND WAFFLE CUPS
        //
        // NO FREEZER STOCK DEDUCTION.
        //
        // NO PRODUCTION BATCH DEDUCTION.
        //
        // Only bill details are saved.
        // ======================================

        for (PricedServing serving :
                pricedServings) {

            String flavoursJson =
                    flavoursToJson(
                            serving.flavours()
                    );

            jdbc.update(
                    """
                    INSERT INTO public.outlet_pos_serving_sale_items (
                        sale_id,
                        serving_option_id,
                        item_name,
                        corn_type,
                        scoop_count,
                        flavours,
                        quantity,
                        unit_price,
                        line_total
                    )
                    VALUES (
                        ?, ?, ?, ?, ?,
                        ?::jsonb, ?, ?, ?
                    )
                    """,
                    saleId,
                    serving.servingOptionId(),
                    serving.name(),
                    serving.cornType(),
                    serving.scoopCount(),
                    flavoursJson,
                    serving.quantity(),
                    serving.unitPrice(),
                    serving.lineTotal()
            );
        }

        // ======================================
        // RETURN SALE RESPONSE
        // ======================================

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put(
                "saleId",
                saleId
        );

        result.put(
                "totalAmount",
                total
        );

        result.put(
                "paymentMethod",
                method
        );

        result.put(
                "paymentStatus",
                paymentStatus
        );

        result.put(
                "receiptKey",
                request.receiptKey()
        );

        result.put(
                "packagedLineCount",
                lines.size()
        );

        result.put(
                "servingLineCount",
                pricedServings.size()
        );

        return result;
    }

    // ==========================================
    // 5. TRANSFER STOCK
    //
    // DEFREEZER 2 -> DEFREEZER 1
    //
    // EXISTING FUNCTIONALITY PRESERVED
    // ==========================================

    @Transactional
    public Map<String, Object> transferToSellingFreezer(
            String email,
            OutletStockTransferRequest request
    ) {

        if (
                request == null ||
                request.sourceStockId() == null ||
                request.sourceStockId() <= 0 ||
                request.quantity() == null ||
                request.quantity() <= 0
        ) {
            throw bad(
                    "Valid source stock and quantity are required"
            );
        }

        if (
                request.sourceBatchStockId() != null &&
                request.sourceBatchStockId() <= 0
        ) {
            throw bad(
                    "Invalid source batch selection"
            );
        }

        long manager = managerId(email);
        long outlet = outletId(manager);

        // Serialize stock changes for this outlet.

        lockOutlet(outlet);

        long sourceFreezer =
                freezerId(
                        outlet,
                        "FREEZER_2"
                );

        long targetFreezer =
                freezerId(
                        outlet,
                        "FREEZER_1"
                );

        // ======================================
        // LOCK SOURCE PRODUCT STOCK
        // ======================================

        List<Map<String, Object>> sources =
                jdbc.queryForList(
                        """
                        SELECT
                            id,
                            product_id AS "productId",
                            flavour,
                            quantity

                        FROM public.outlet_pos_stock

                        WHERE id = ?
                          AND freezer_id = ?

                        FOR UPDATE
                        """,
                        request.sourceStockId(),
                        sourceFreezer
                );

        if (sources.size() != 1) {
            throw conflict(
                    "Stock not found in Defreezer 2"
            );
        }

        Map<String, Object> stock =
                sources.get(0);

        int available =
                ((Number) stock.get("quantity"))
                        .intValue();

        if (request.quantity() > available) {
            throw conflict(
                    "Insufficient Defreezer 2 stock"
            );
        }

        String productId =
                String.valueOf(
                        stock.get("productId")
                );

        String flavour =
                String.valueOf(
                        stock.get("flavour")
                );

        long sourceTracked =
                trackedQuantity(
                        request.sourceStockId()
                );

        verifyBatchCoverage(
                request.sourceStockId(),
                available,
                sourceTracked
        );

        // ======================================
        // VALIDATE SELECTED SOURCE BATCH
        // ======================================

        SelectedBatch batch = null;

        if (
                request.sourceBatchStockId() != null
        ) {

            batch = selectedBatch(
                    request.sourceStockId(),
                    request.sourceBatchStockId()
            );

            if (
                    request.quantity() >
                    batch.availableQuantity()
            ) {
                throw conflict(
                        "Insufficient Defreezer 2 stock " +
                        "in batch " +
                        batch.batchNumber() +
                        ". Available: " +
                        batch.availableQuantity()
                );
            }

        } else if (sourceTracked > 0) {

            throw bad(
                    "Select the production batch " +
                    "to transfer to Defreezer 1"
            );
        }

        // ======================================
        // FIND EXISTING TARGET PRODUCT STOCK
        // ======================================

        List<Map<String, Object>> targets =
                jdbc.queryForList(
                        """
                        SELECT
                            id,
                            quantity

                        FROM public.outlet_pos_stock

                        WHERE freezer_id = ?
                          AND product_id = ?
                          AND flavour = ?

                        FOR UPDATE
                        """,
                        targetFreezer,
                        productId,
                        flavour
                );

        if (targets.size() > 1) {
            throw conflict(
                    "Duplicate product stock rows " +
                    "exist in Defreezer 1"
            );
        }

        Long targetStockId = null;
        int targetQuantity = 0;
        long targetTracked = 0L;

        if (!targets.isEmpty()) {

            targetStockId =
                    ((Number) targets.get(0).get("id"))
                            .longValue();

            targetQuantity =
                    ((Number) targets.get(0).get("quantity"))
                            .intValue();

            targetTracked =
                    trackedQuantity(
                            targetStockId
                    );

            verifyBatchCoverage(
                    targetStockId,
                    targetQuantity,
                    targetTracked
            );
        }

        // Do not mix tracked and legacy stock.

        if (
                targetQuantity > 0 &&
                (batch != null) != (targetTracked > 0)
        ) {
            throw conflict(
                    "The destination freezer contains " +
                    "incompatible tracked/legacy stock. " +
                    "Reconcile it before transferring."
            );
        }

        // ======================================
        // DEDUCT SOURCE AGGREGATE STOCK
        // ======================================

        deductAggregateStock(
                request.sourceStockId(),
                sourceFreezer,
                request.quantity()
        );

        // ======================================
        // DEDUCT SOURCE SELECTED BATCH
        // ======================================

        if (batch != null) {

            deductSelectedBatch(
                    request.sourceStockId(),
                    batch,
                    request.quantity()
            );
        }

        // ======================================
        // INCREASE TARGET AGGREGATE STOCK
        // ======================================

        jdbc.update(
                """
                INSERT INTO public.outlet_pos_stock (
                    freezer_id,
                    product_id,
                    flavour,
                    quantity
                )
                VALUES (?, ?, ?, ?)

                ON CONFLICT (
                    freezer_id,
                    product_id,
                    flavour
                )

                DO UPDATE SET
                    quantity =
                        public.outlet_pos_stock.quantity +
                        EXCLUDED.quantity,

                    updated_at = CURRENT_TIMESTAMP
                """,
                targetFreezer,
                productId,
                flavour,
                request.quantity()
        );

        // ======================================
        // RETRIEVE TARGET STOCK ID
        // ======================================

        targetStockId =
                jdbc.queryForObject(
                        """
                        SELECT id

                        FROM public.outlet_pos_stock

                        WHERE freezer_id = ?
                          AND product_id = ?
                          AND flavour = ?
                        """,
                        Long.class,
                        targetFreezer,
                        productId,
                        flavour
                );

        if (targetStockId == null) {
            throw conflict(
                    "Unable to locate Defreezer 1 stock"
            );
        }

        // ======================================
        // SAVE EXISTING TRANSFER RECORD
        // ======================================

        Long transferId =
                jdbc.queryForObject(
                        """
                        INSERT INTO public.outlet_pos_transfers (
                            outlet_id,
                            manager_user_id,
                            source_stock_id,
                            destination_freezer_id,
                            product_id,
                            flavour,
                            quantity
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        RETURNING id
                        """,
                        Long.class,
                        outlet,
                        manager,
                        request.sourceStockId(),
                        targetFreezer,
                        productId,
                        flavour,
                        request.quantity()
                );

        if (transferId == null) {
            throw conflict(
                    "Unable to create freezer transfer record"
            );
        }

        // ======================================
        // CREDIT SAME PRODUCTION BATCH
        // INTO DEFREEZER 1
        // ======================================

        if (batch != null) {

            jdbc.update(
                    """
                    INSERT INTO public.outlet_freezer_batch_stock (
                        freezer_stock_id,
                        batch_id,
                        quantity
                    )
                    VALUES (?, ?, ?)

                    ON CONFLICT (
                        freezer_stock_id,
                        batch_id
                    )

                    DO UPDATE SET
                        quantity =
                            public.outlet_freezer_batch_stock.quantity
                            + EXCLUDED.quantity,

                        updated_at = CURRENT_TIMESTAMP
                    """,
                    targetStockId,
                    batch.batchId(),
                    request.quantity()
            );

            // ==================================
            // BATCH MOVEMENT HISTORY
            // ==================================

            recordBatchMovement(
                    batch.batchId(),
                    request.sourceStockId(),
                    "FREEZER_TRANSFER_OUT",
                    -request.quantity(),
                    "FREEZER_TRANSFER",
                    transferId,
                    manager
            );

            recordBatchMovement(
                    batch.batchId(),
                    targetStockId,
                    "FREEZER_TRANSFER_IN",
                    request.quantity(),
                    "FREEZER_TRANSFER",
                    transferId,
                    manager
            );
        }

        // ======================================
        // RETURN EXISTING TRANSFER RESPONSE
        // ======================================

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put(
                "transferId",
                transferId
        );

        result.put(
                "productId",
                productId
        );

        result.put(
                "flavour",
                flavour
        );

        result.put(
                "quantity",
                request.quantity()
        );

        result.put(
                "from",
                "FREEZER_2"
        );

        result.put(
                "to",
                "FREEZER_1"
        );

        if (batch != null) {

            result.put(
                    "batchId",
                    batch.batchId()
            );

            result.put(
                    "batchNumber",
                    batch.batchNumber()
            );

            result.put(
                    "sourceBatchStockId",
                    batch.freezerBatchStockId()
            );
        }

        return result;
    }
}
