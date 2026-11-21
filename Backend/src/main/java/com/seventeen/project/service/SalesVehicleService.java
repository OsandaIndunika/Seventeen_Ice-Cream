
package com.seventeen.project.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SalesVehicleService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SalesVehicleService.class
            );

    private final JdbcTemplate jdbc;

    private static final int USER_LOCK_NAMESPACE = 7201;
    private static final int VEHICLE_LOCK_NAMESPACE = 7202;

    public SalesVehicleService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ============================================
    // VALIDATION
    // ============================================

    private ResponseStatusException fail(
            HttpStatus status,
            String message
    ) {
        return new ResponseStatusException(
                status,
                message
        );
    }

    private void validateVehicleId(long vehicleId) {
        if (vehicleId <= 0) {
            throw fail(
                    HttpStatus.BAD_REQUEST,
                    "Invalid vehicle ID"
            );
        }
    }

    // ============================================
    // AUTHENTICATED SALES REPRESENTATIVE
    // ============================================

    private long salesUserId(String email) {

        if (email == null || email.isBlank()) {
            throw fail(
                    HttpStatus.UNAUTHORIZED,
                    "Sales Representative login required"
            );
        }

        List<Long> users = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'SALES_MANAGER'
                  AND enabled = TRUE
                """,
                (rs, rowNum) -> rs.getLong("id"),
                email.trim()
        );

        if (users.isEmpty()) {
            throw fail(
                    HttpStatus.FORBIDDEN,
                    "Active SALES_MANAGER account required"
            );
        }

        return users.get(0);
    }

    // ============================================
    // TRANSACTION SETTINGS
    // ============================================

    private void configureTimeouts() {

        jdbc.execute(
                "SET LOCAL lock_timeout = '5s'"
        );

        jdbc.execute(
                "SET LOCAL statement_timeout = '15s'"
        );
    }

    // ============================================
    // ADVISORY LOCKING FOR SALES SESSIONS
    // ============================================

    private void acquireLock(
            int namespace,
            long resourceId,
            String description
    ) {

        final int id;

        try {
            id = Math.toIntExact(resourceId);
        } catch (ArithmeticException ex) {
            throw fail(
                    HttpStatus.BAD_REQUEST,
                    "Invalid " + description + " ID"
            );
        }

        Boolean acquired = jdbc.queryForObject(
                """
                SELECT pg_try_advisory_xact_lock(?, ?)
                """,
                Boolean.class,
                namespace,
                id
        );

        if (!Boolean.TRUE.equals(acquired)) {
            throw fail(
                    HttpStatus.CONFLICT,
                    description +
                    " is currently being updated. Retry."
            );
        }
    }

    private void lockSalesRepresentative(long userId) {
        acquireLock(
                USER_LOCK_NAMESPACE,
                userId,
                "Sales Representative session"
        );
    }

    private void lockVehicle(long vehicleId) {
        acquireLock(
                VEHICLE_LOCK_NAMESPACE,
                vehicleId,
                "Delivery vehicle"
        );
    }

    // ============================================
    // SQL ERROR HANDLING
    // ============================================

    private String findSqlState(Throwable throwable) {

        Throwable current = throwable;

        while (current != null) {

            if (current instanceof SQLException sql) {
                if (sql.getSQLState() != null) {
                    return sql.getSQLState();
                }
            }

            current = current.getCause();
        }

        return null;
    }

    private RuntimeException translateError(
            DataAccessException exception
    ) {

        String state = findSqlState(exception);

        if ("55P03".equals(state)) {
            return new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "A database transaction is temporarily " +
                    "locking a required record.",
                    exception
            );
        }

        if ("40P01".equals(state)) {
            return new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Database deadlock detected. Retry.",
                    exception
            );
        }

        if ("23505".equals(state)) {
            return new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "An active sales session already exists.",
                    exception
            );
        }

        if ("57014".equals(state)) {
            return new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Database request timed out.",
                    exception
            );
        }

        return exception;
    }

    // ============================================
    // 1. GET DELIVERY VEHICLES
    //
    // EXISTING METHOD - UNCHANGED
    // ============================================

    @Transactional(
            readOnly = true,
            isolation = Isolation.READ_COMMITTED
    )
    public List<Map<String, Object>> getVehicles(
            String email
    ) {

        long userId = salesUserId(email);

        return jdbc.queryForList(
                """
                SELECT
                    v.id,

                    v.vehicle_number
                        AS "vehicleNumber",

                    v.status,

                    EXISTS (
                        SELECT 1
                        FROM public.vehicle_sales_sessions s
                        WHERE s.vehicle_id = v.id
                          AND s.ended_at IS NULL
                    ) AS "occupied",

                    EXISTS (
                        SELECT 1
                        FROM public.vehicle_sales_sessions s
                        WHERE s.vehicle_id = v.id
                          AND s.sales_representative_id = ?
                          AND s.ended_at IS NULL
                    ) AS "selectedByMe"

                FROM public.delivery_vehicles v

                ORDER BY v.id
                """,
                userId
        );
    }

    // ============================================
    // 2. CURRENT SALES SESSION
    //
    // EXISTING METHOD - UNCHANGED
    // ============================================

    @Transactional(
            readOnly = true,
            isolation = Isolation.READ_COMMITTED
    )
    public Map<String, Object> getCurrentSession(
            String email
    ) {

        long userId = salesUserId(email);

        return readCurrentSession(userId);
    }

    private Map<String, Object> readCurrentSession(
            long userId
    ) {

        List<Map<String, Object>> sessions =
                jdbc.queryForList(
                        """
                        SELECT
                            s.id AS "sessionId",

                            s.vehicle_id AS "vehicleId",

                            v.vehicle_number
                                AS "vehicleNumber",

                            s.started_at AS "startedAt"

                        FROM public.vehicle_sales_sessions s

                        JOIN public.delivery_vehicles v
                            ON v.id = s.vehicle_id

                        WHERE s.sales_representative_id = ?
                          AND s.ended_at IS NULL

                        ORDER BY s.id DESC

                        LIMIT 1
                        """,
                        userId
                );

        if (sessions.isEmpty()) {

            Map<String, Object> result =
                    new LinkedHashMap<>();

            result.put("active", false);
            result.put("vehicleId", null);
            result.put("vehicleNumber", "");

            return result;
        }

        Map<String, Object> result =
                new LinkedHashMap<>(
                        sessions.get(0)
                );

        result.put("active", true);

        return result;
    }

    // ============================================
    // 3. SELECT VEHICLE
    //
    // EXISTING METHOD - UNCHANGED
    // ============================================

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public Map<String, Object> selectVehicle(
            String email,
            long vehicleId
    ) {

        validateVehicleId(vehicleId);

        try {
            configureTimeouts();

            long userId = salesUserId(email);

            // Prevent concurrent selections by
            // the same Sales Representative.
            lockSalesRepresentative(userId);

            Map<String, Object> existing =
                    readCurrentSession(userId);

            if (Boolean.TRUE.equals(
                    existing.get("active")
            )) {

                long selectedId =
                        ((Number) existing.get(
                                "vehicleId"
                        )).longValue();

                if (selectedId == vehicleId) {
                    return existing;
                }

                throw fail(
                        HttpStatus.CONFLICT,
                        "End your existing vehicle session " +
                        "before selecting another vehicle."
                );
            }

            // Serialize vehicle selection attempts.
            lockVehicle(vehicleId);

            List<Map<String, Object>> vehicles =
                    jdbc.queryForList(
                            """
                            SELECT
                                id,
                                vehicle_number,
                                status
                            FROM public.delivery_vehicles
                            WHERE id = ?
                            """,
                            vehicleId
                    );

            if (vehicles.isEmpty()) {
                throw fail(
                        HttpStatus.NOT_FOUND,
                        "Vehicle not found"
                );
            }

            String status = String.valueOf(
                    vehicles.get(0).get("status")
            ).trim().toUpperCase();

            if (
                    status.equals("INACTIVE") ||
                    status.equals("MAINTENANCE") ||
                    status.equals("OUT_OF_SERVICE") ||
                    status.equals("DISABLED")
            ) {
                throw fail(
                        HttpStatus.CONFLICT,
                        "Vehicle is unavailable"
                );
            }

            Integer occupied = jdbc.queryForObject(
                    """
                    SELECT COUNT(*)
                    FROM public.vehicle_sales_sessions
                    WHERE vehicle_id = ?
                      AND ended_at IS NULL
                    """,
                    Integer.class,
                    vehicleId
            );

            if (
                    occupied != null &&
                    occupied > 0
            ) {
                throw fail(
                        HttpStatus.CONFLICT,
                        "Vehicle already selected by " +
                        "another Sales Representative"
                );
            }

            jdbc.update(
                    """
                    INSERT INTO public.vehicle_sales_sessions
                    (
                        vehicle_id,
                        sales_representative_id,
                        started_at
                    )
                    VALUES (?, ?, NOW())
                    """,
                    vehicleId,
                    userId
            );

            log.info(
                    "Sales session created: userId={}, vehicleId={}",
                    userId,
                    vehicleId
            );

            return readCurrentSession(userId);

        } catch (DataAccessException exception) {
            throw translateError(exception);
        }
    }

    // ============================================
    // 4. END SALES SESSION
    //
    // EXISTING METHOD - UNCHANGED
    // ============================================

    @Transactional(
            isolation = Isolation.READ_COMMITTED
    )
    public void endSession(String email) {

        try {
            configureTimeouts();

            long userId = salesUserId(email);

            lockSalesRepresentative(userId);

            Map<String, Object> session =
                    readCurrentSession(userId);

            if (!Boolean.TRUE.equals(
                    session.get("active")
            )) {
                throw fail(
                        HttpStatus.CONFLICT,
                        "No active vehicle session found"
                );
            }

            long vehicleId =
                    ((Number) session.get(
                            "vehicleId"
                    )).longValue();

            lockVehicle(vehicleId);

            int updated = jdbc.update(
                    """
                    UPDATE public.vehicle_sales_sessions
                    SET ended_at = NOW()
                    WHERE sales_representative_id = ?
                      AND vehicle_id = ?
                      AND ended_at IS NULL
                    """,
                    userId,
                    vehicleId
            );

            if (updated == 0) {
                throw fail(
                        HttpStatus.CONFLICT,
                        "Unable to end the sales session"
                );
            }

            log.info(
                    "Sales session ended: userId={}, vehicleId={}",
                    userId,
                    vehicleId
            );

        } catch (DataAccessException exception) {
            throw translateError(exception);
        }
    }

    // ============================================
    // VERIFY ACTIVE VEHICLE ACCESS
    //
    // EXISTING METHOD - UNCHANGED
    // ============================================

    private void checkVehicleAccess(
            String email,
            long vehicleId
    ) {

        validateVehicleId(vehicleId);

        long userId = salesUserId(email);

        Integer count = jdbc.queryForObject(
                """
                SELECT COUNT(*)
                FROM public.vehicle_sales_sessions
                WHERE sales_representative_id = ?
                  AND vehicle_id = ?
                  AND ended_at IS NULL
                """,
                Integer.class,
                userId,
                vehicleId
        );

        if (count == null || count == 0) {
            throw fail(
                    HttpStatus.FORBIDDEN,
                    "Select this vehicle before " +
                    "accessing its inventory or orders"
            );
        }
    }

    // ============================================
    // DATABASE DIAGNOSTICS
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Logging only. No stock changes.
    // ============================================

    private void logInventoryDiagnostics(
            long vehicleId
    ) {

        Map<String, Object> database =
                jdbc.queryForMap(
                        """
                        SELECT
                            current_database()
                                AS database_name,

                            inet_server_addr()::text
                                AS server_address,

                            inet_server_port()
                                AS server_port,

                            current_user
                                AS database_user
                        """
                );

        Map<String, Object> totals =
                jdbc.queryForMap(
                        """
                        SELECT
                            COUNT(*) AS product_variants,

                            COALESCE(
                                SUM(quantity),
                                0
                            ) AS physical_stock,

                            COALESCE(
                                SUM(reserved_quantity),
                                0
                            ) AS reserved_stock,

                            COALESCE(
                                SUM(
                                    quantity -
                                    reserved_quantity
                                ),
                                0
                            ) AS available_stock

                        FROM public.vehicle_stock

                        WHERE vehicle_id = ?
                        """,
                        vehicleId
                );

        log.info(
                "SALES INVENTORY DATABASE: {}",
                database
        );

        log.info(
                "SALES INVENTORY vehicleId={} totals={}",
                vehicleId,
                totals
        );
    }

    // ============================================
    // 5. GET ACTUAL VEHICLE INVENTORY
    //
    // EXISTING METHOD - UNCHANGED
    //
    // No hardcoded products.
    // No quantity modification.
    // No product-category filtering.
    // ============================================

    @Transactional(
            readOnly = true,
            isolation = Isolation.READ_COMMITTED
    )
    public List<Map<String, Object>> getInventory(
            String email,
            long vehicleId
    ) {

        checkVehicleAccess(email, vehicleId);

        logInventoryDiagnostics(vehicleId);

        List<Map<String, Object>> inventory =
                jdbc.queryForList(
                        """
                        SELECT
                            s.id,

                            s.vehicle_id
                                AS "vehicleId",

                            s.product_id
                                AS "productId",

                            COALESCE(
                                p.name,
                                s.product_id
                            ) AS "productName",

                            COALESCE(
                                p.size,
                                ''
                            ) AS "size",

                            s.flavour,

                            s.quantity,

                            s.reserved_quantity
                                AS "reservedQuantity",

                            (
                                s.quantity -
                                s.reserved_quantity
                            ) AS "availableQuantity",

                            s.updated_at
                                AS "updatedAt"

                        FROM public.vehicle_stock s

                        LEFT JOIN public.wholesale_products p
                            ON p.id = s.product_id

                        WHERE s.vehicle_id = ?

                        ORDER BY
                            COALESCE(
                                p.name,
                                s.product_id
                            ),
                            COALESCE(p.size, ''),
                            s.flavour
                        """,
                        vehicleId
                );

        log.info(
                "SALES INVENTORY vehicleId={} returnedRecords={}",
                vehicleId,
                inventory.size()
        );

        return inventory;
    }

    // ============================================
    // 5A. GET GROUPED BATCH INVENTORY
    //
    // UPDATED FOR DATABASE WITHOUT
    // BATCH QUALITY STATUS
    //
    // Returns:
    //
    // - Product total quantity
    // - Product reserved quantity
    // - Product available quantity
    // - Individual batch numbers
    // - Batch stock quantities
    // - Batch reserved quantities
    // - Batch available quantities
    // - Allocated / unallocated quantities
    //
    // Compatibility fields retained:
    //
    // - saleable
    // - saleableAvailableQuantity
    //
    // These now depend ONLY on the available
    // batch quantity.
    //
    // No batch approval status is required.
    //
    // This method reads inventory only.
    // It never changes stock quantities.
    // ============================================

    @Transactional(
            readOnly = true,
            isolation = Isolation.READ_COMMITTED
    )
    public List<Map<String, Object>> getGroupedBatchInventory(
            String email,
            long vehicleId
    ) {

        // ========================================
        // VERIFY THE SELECTED LORRY
        // ========================================

        checkVehicleAccess(email, vehicleId);

        // ========================================
        // LOAD AGGREGATE PRODUCT STOCK
        //
        // One record for each product variant
        // on the selected vehicle.
        // ========================================

        List<Map<String, Object>> products =
                jdbc.queryForList(
                        """
                        SELECT
                            s.id AS "vehicleStockId",

                            s.vehicle_id AS "vehicleId",

                            s.product_id AS "productId",

                            COALESCE(
                                p.name,
                                s.product_id
                            ) AS "productName",

                            COALESCE(
                                p.size,
                                ''
                            ) AS "size",

                            s.flavour AS "flavour",

                            s.quantity AS "totalQuantity",

                            s.reserved_quantity
                                AS "reservedQuantity",

                            (
                                s.quantity -
                                s.reserved_quantity
                            ) AS "availableQuantity",

                            s.updated_at AS "updatedAt"

                        FROM public.vehicle_stock s

                        LEFT JOIN public.wholesale_products p
                            ON p.id = s.product_id

                        WHERE s.vehicle_id = ?

                        ORDER BY
                            COALESCE(p.name, s.product_id),
                            COALESCE(p.size, ''),
                            s.flavour,
                            s.id
                        """,
                        vehicleId
                );

        // ========================================
        // INITIALIZE PRODUCT GROUPS
        // ========================================

        Map<Long, Map<String, Object>> productByStockId =
                new LinkedHashMap<>();

        for (Map<String, Object> product : products) {

            long stockId =
                    ((Number) product.get(
                            "vehicleStockId"
                    )).longValue();

            product.put(
                    "batches",
                    new ArrayList<Map<String, Object>>()
            );

            product.put(
                    "allocatedQuantity",
                    0
            );

            product.put(
                    "unallocatedQuantity",
                    ((Number) product.get(
                            "totalQuantity"
                    )).intValue()
            );

            // Retained for compatibility
            // with previously developed
            // Sales Manager components.
            //
            // Now means the number of units
            // available across stock batches.

            product.put(
                    "saleableAvailableQuantity",
                    0
            );

            productByStockId.put(
                    stockId,
                    product
            );
        }

        if (products.isEmpty()) {
            return products;
        }

        // ========================================
        // LOAD PRODUCTION BATCHES
        //
        // FIX:
        //
        // No batch approval column is queried.
        //
        // A batch is selectable when its
        // available quantity is greater than 0.
        //
        // Existing frontend compatibility:
        //
        // "saleable" is calculated using
        // quantity and reserved_quantity.
        // ========================================

        List<Map<String, Object>> batchRows =
                jdbc.queryForList(
                        """
                        SELECT
                            vbs.id
                                AS "vehicleBatchStockId",

                            vbs.vehicle_stock_id
                                AS "vehicleStockId",

                            pb.id AS "batchId",

                            pb.batch_number
                                AS "batchNumber",

                            vbs.quantity
                                AS "quantity",

                            vbs.reserved_quantity
                                AS "reservedQuantity",

                            (
                                vbs.quantity -
                                vbs.reserved_quantity
                            ) AS "availableQuantity",

                            (
                                vbs.quantity -
                                vbs.reserved_quantity
                            ) > 0 AS "saleable"

                        FROM public.vehicle_batch_stock vbs

                        JOIN public.vehicle_stock s
                            ON s.id = vbs.vehicle_stock_id

                        JOIN public.product_batches pb
                            ON pb.id = vbs.batch_id

                        WHERE s.vehicle_id = ?

                        ORDER BY
                            s.id,
                            pb.batch_number,
                            vbs.id
                        """,
                        vehicleId
                );

        // ========================================
        // GROUP BATCHES UNDER PRODUCTS
        // ========================================

        Map<Long, Integer> allocatedByStockId =
                new LinkedHashMap<>();

        Map<Long, Integer> saleableByStockId =
                new LinkedHashMap<>();

        for (Map<String, Object> batch : batchRows) {

            long stockId =
                    ((Number) batch.get(
                            "vehicleStockId"
                    )).longValue();

            Map<String, Object> product =
                    productByStockId.get(stockId);

            if (product == null) {
                continue;
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> batches =
                    (List<Map<String, Object>>)
                            product.get("batches");

            batches.add(batch);

            int batchQuantity =
                    ((Number) batch.get(
                            "quantity"
                    )).intValue();

            allocatedByStockId.merge(
                    stockId,
                    batchQuantity,
                    Integer::sum
            );

            // ====================================
            // CALCULATE AVAILABLE BATCH STOCK
            //
            // No status-based filtering.
            // ====================================

            int availableBatch =
                    ((Number) batch.get(
                            "availableQuantity"
                    )).intValue();

            if (availableBatch > 0) {

                saleableByStockId.merge(
                        stockId,
                        availableBatch,
                        Integer::sum
                );
            }
        }

        // ========================================
        // CALCULATE PRODUCT TOTALS
        // ========================================

        int totalBatchRows = 0;
        int mismatchedProducts = 0;

        for (Map<String, Object> product : products) {

            long stockId =
                    ((Number) product.get(
                            "vehicleStockId"
                    )).longValue();

            int totalQuantity =
                    ((Number) product.get(
                            "totalQuantity"
                    )).intValue();

            int allocated =
                    allocatedByStockId.getOrDefault(
                            stockId,
                            0
                    );

            int unallocated =
                    totalQuantity - allocated;

            int saleableQuantity =
                    saleableByStockId.getOrDefault(
                            stockId,
                            0
                    );

            product.put(
                    "allocatedQuantity",
                    allocated
            );

            product.put(
                    "unallocatedQuantity",
                    unallocated
            );

            product.put(
                    "saleableAvailableQuantity",
                    saleableQuantity
            );

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> batches =
                    (List<Map<String, Object>>)
                            product.get("batches");

            totalBatchRows += batches.size();

            if (unallocated != 0) {

                mismatchedProducts++;

                log.warn(
                        "BATCH INVENTORY MISMATCH: " +
                        "vehicleId={}, vehicleStockId={}, " +
                        "total={}, allocated={}, difference={}",
                        vehicleId,
                        stockId,
                        totalQuantity,
                        allocated,
                        unallocated
                );
            }
        }

        log.info(
                "GROUPED BATCH INVENTORY: " +
                "vehicleId={}, products={}, " +
                "batchRows={}, mismatches={}",
                vehicleId,
                products.size(),
                totalBatchRows,
                mismatchedProducts
        );

        return products;
    }

    // ============================================
    // 6. GET WHOLESALE ORDERS
    //
    // EXISTING METHOD - UNCHANGED
    //
    // Preserves:
    // - Delivery assignment status
    // - Customer/shop details
    // - Checkout payment method
    // - Credit planned cash
    // - Order total
    // - Order items
    //
    // No Credit Approval field.
    // ============================================

    @Transactional(
            readOnly = true,
            isolation = Isolation.READ_COMMITTED
    )
    public List<Map<String, Object>> getOrders(
            String email,
            long vehicleId
    ) {

        checkVehicleAccess(email, vehicleId);

        List<Map<String, Object>> orders =
                jdbc.queryForList(
                        """
                        WITH latest_assignments AS (

                            SELECT DISTINCT ON (
                                a.wholesale_order_id
                            )
                                a.id,
                                a.wholesale_order_id,
                                a.vehicle_id,
                                a.status,
                                a.assigned_at,
                                a.claimed_at,
                                a.started_at,
                                a.delivered_at

                            FROM public.vehicle_delivery_assignments a

                            ORDER BY
                                a.wholesale_order_id,
                                a.id DESC
                        )

                        SELECT

                            o.id AS "orderId",

                            o.shop_name AS "shopName",

                            COALESCE(
                                to_jsonb(o)->>'payment_method',
                                ''
                            ) AS "paymentMethod",

                            COALESCE(
                                to_jsonb(o)->>'payment_status',
                                'PENDING'
                            ) AS "paymentStatus",

                            NULLIF(
                                to_jsonb(o)->>'credit_cash_amount',
                                ''
                            )::numeric
                                AS "creditCashAmount",

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
                                    SELECT SUM(i.subtotal)
                                    FROM public.wholesale_order_items i
                                    WHERE i.order_id = o.id
                                )
                            ) AS "orderTotal",

                            a.id AS "assignmentId",

                            a.vehicle_id AS "vehicleId",

                            a.status AS "deliveryStatus",

                            a.assigned_at AS "assignedAt",

                            a.claimed_at AS "claimedAt",

                            a.started_at AS "startedAt",

                            a.delivered_at AS "deliveredAt",

                            COALESCE(
                                to_jsonb(o)->>'phone',
                                ''
                            ) AS "phone",

                            COALESCE(
                                to_jsonb(o)->>'email',
                                ''
                            ) AS "email",

                            COALESCE(
                                to_jsonb(o)->>'delivery_street_address',
                                to_jsonb(o)->>'street_address',
                                ''
                            ) AS "streetAddress",

                            COALESCE(
                                to_jsonb(o)->>'delivery_city',
                                to_jsonb(o)->>'city',
                                ''
                            ) AS "city",

                            COALESCE(
                                to_jsonb(o)->>'delivery_province',
                                to_jsonb(o)->>'province',
                                ''
                            ) AS "province",

                            COALESCE(
                                to_jsonb(o)->>'delivery_postal_code',
                                to_jsonb(o)->>'postal_code',
                                ''
                            ) AS "postalCode",

                            NULLIF(
                                COALESCE(
                                    to_jsonb(o)->>'delivery_latitude',
                                    to_jsonb(o)->>'latitude',
                                    ''
                                ),
                                ''
                            ) AS "latitude",

                            NULLIF(
                                COALESCE(
                                    to_jsonb(o)->>'delivery_longitude',
                                    to_jsonb(o)->>'longitude',
                                    ''
                                ),
                                ''
                            ) AS "longitude",

                            COALESCE(
                                to_jsonb(o)->>'delivery_instructions',
                                ''
                            ) AS "deliveryInstructions"

                        FROM public.wholesale_orders o

                        JOIN latest_assignments a
                            ON a.wholesale_order_id = o.id

                        WHERE a.vehicle_id = ?

                        ORDER BY
                            CASE
                                WHEN UPPER(a.status) =
                                     'DELIVERED'
                                THEN 1
                                ELSE 0
                            END,
                            o.id DESC
                        """,
                        vehicleId
                );

        // ========================================
        // LOAD ITEMS FOR EACH ORDER
        // ========================================

        for (Map<String, Object> order : orders) {

            long orderId =
                    ((Number) order.get("orderId"))
                            .longValue();

            List<Map<String, Object>> items =
                    jdbc.queryForList(
                            """
                            SELECT

                                i.id AS "itemId",

                                i.product_id
                                    AS "productId",

                                COALESCE(
                                    p.name,
                                    i.product_id::text
                                ) AS "productName",

                                p.size,

                                i.flavour,

                                i.quantity,

                                i.unit_price
                                    AS "unitPrice",

                                i.subtotal

                            FROM public.wholesale_order_items i

                            LEFT JOIN public.wholesale_products p
                                ON p.id = i.product_id

                            WHERE i.order_id = ?

                            ORDER BY i.id
                            """,
                            orderId
                    );

            order.put("items", items);

            // ====================================
            // BUILD CUSTOMER DELIVERY ADDRESS
            // ====================================

            List<String> addressParts =
                    new ArrayList<>();

            for (String key : List.of(
                    "streetAddress",
                    "city",
                    "province",
                    "postalCode"
            )) {

                Object value = order.get(key);

                if (
                        value != null &&
                        !value.toString().isBlank()
                ) {
                    addressParts.add(
                            value.toString().trim()
                    );
                }
            }

            order.put(
                    "address",
                    String.join(", ", addressParts)
            );
        }

        log.info(
                "SALES ORDERS vehicleId={} returnedOrders={}",
                vehicleId,
                orders.size()
        );

        return orders;
    }
}
