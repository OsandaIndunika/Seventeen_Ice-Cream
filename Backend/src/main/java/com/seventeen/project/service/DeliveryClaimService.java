
package com.seventeen.project.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DeliveryClaimService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    DeliveryClaimService.class
            );

    private final JdbcTemplate jdbc;

    private final DeliveryVehicleService vehicleService;

    private final VehicleDeliveryStockService stockService;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    public DeliveryClaimService(
            JdbcTemplate jdbc,
            DeliveryVehicleService vehicleService,
            VehicleDeliveryStockService stockService
    ) {
        this.jdbc = jdbc;
        this.vehicleService = vehicleService;
        this.stockService = stockService;
    }

    // ============================================
    // DELIVERY ORDER RESPONSE
    //
    // Matches existing Delivery Dashboard JSON.
    // ============================================

    public record DeliveryOrderView(

            Long orderId,

            Long assignmentId,

            Long vehicleId,

            String vehicleNumber,

            String status,

            String shopName,

            String phone,

            String email,

            String deliveryAddress,

            String deliveryInstructions,

            Double latitude,

            Double longitude,

            BigDecimal finalTotal,

            String paymentMethod,

            String paymentStatus,

            Long claimedByUserId,

            Instant claimedAt,

            Long startedByUserId,

            Instant startedAt,

            Long deliveredByUserId,

            Instant deliveredAt,

            List<OrderItemView> items

    ) {}

    // ============================================
    // ORDER ITEM RESPONSE
    // ============================================

    public record OrderItemView(

            Long id,

            String productId,

            String productName,

            String flavour,

            Integer quantity,

            BigDecimal unitPrice,

            BigDecimal subtotal

    ) {}

    // ============================================
    // AUTHENTICATED DELIVERY USER
    // ============================================

    private Long currentUserId(
            Authentication authentication
    ) {

        if (
                authentication == null ||
                !authentication.isAuthenticated()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Delivery Person login required"
            );
        }

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'DELIVERY_PERSON'
                  AND enabled = TRUE
                """,
                (rs, rowNum) -> rs.getLong("id"),
                authentication.getName()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Active Delivery Person account required"
            );
        }

        return ids.get(0);
    }

    // ============================================
    // GET SELECTED DELIVERY VEHICLE
    // ============================================

    private Long selectedVehicleId(
            Authentication authentication
    ) {

        currentUserId(authentication);

        return vehicleService
                .requireSelectedVehicle(authentication);
    }

    // ============================================
    // NORMALIZE LEGACY YOGHURT FLAVOURS
    //
    // Only the single yoghurt-drink product
    // is normalized.
    //
    // Other product flavours are unchanged.
    //
    // This is valid only because Original, Plain
    // and Yoghurt represent the same factory
    // product in this project.
    // ============================================

    private String normalizeFlavour(
        String productId,
        String flavour
) {
    String normalized = flavour == null
            ? ""
            : flavour.trim();

    if ("yoghurt-drink".equalsIgnoreCase(productId)) {
        return "Yoghurt";
    }

    return normalized;
}

    // ============================================
    // GET DASHBOARD ORDERS
    //
    // Returns:
    // - Waiting orders
    // - Orders assigned to selected vehicle
    // - Customer information
    // - Real order items
    // - Payment information
    //
    // Latest vehicle assignment is used.
    // ============================================

    @Transactional(readOnly = true)
    public List<DeliveryOrderView> getDashboardOrders(
            Authentication authentication
    ) {

        Long vehicleId =
                selectedVehicleId(authentication);

        String sql = """
            SELECT

                wo.id AS order_id,

                a.id AS assignment_id,

                a.vehicle_id,

                dv.vehicle_number,

                COALESCE(
                    a.status,
                    'WAITING'
                ) AS delivery_status,

                COALESCE(
                    to_jsonb(wo)->>'shop_name',
                    to_jsonb(wo)->>'customer_name',
                    ''
                ) AS shop_name,

                COALESCE(
                    to_jsonb(wo)->>'phone',
                    to_jsonb(wo)->>'customer_phone',
                    ''
                ) AS phone,

                COALESCE(
                    to_jsonb(wo)->>'email',
                    ''
                ) AS email,

                COALESCE(
                    NULLIF(
                        to_jsonb(wo)->>'delivery_address',
                        ''
                    ),
                    NULLIF(
                        to_jsonb(wo)->>'address',
                        ''
                    ),
                    CONCAT_WS(
                        ', ',
                        NULLIF(
                            to_jsonb(wo)->>'delivery_street_address',
                            ''
                        ),
                        NULLIF(
                            to_jsonb(wo)->>'delivery_city',
                            ''
                        ),
                        NULLIF(
                            to_jsonb(wo)->>'delivery_province',
                            ''
                        ),
                        NULLIF(
                            to_jsonb(wo)->>'delivery_postal_code',
                            ''
                        )
                    )
                ) AS full_address,

                COALESCE(
                    to_jsonb(wo)->>'delivery_instructions',
                    ''
                ) AS delivery_instructions,

                NULLIF(
                    COALESCE(
                        to_jsonb(wo)->>'delivery_latitude',
                        to_jsonb(wo)->>'latitude',
                        ''
                    ),
                    ''
                )::double precision AS shop_latitude,

                NULLIF(
                    COALESCE(
                        to_jsonb(wo)->>'delivery_longitude',
                        to_jsonb(wo)->>'longitude',
                        ''
                    ),
                    ''
                )::double precision AS shop_longitude,

                COALESCE(

                    NULLIF(
                        to_jsonb(wo)->>'final_total',
                        ''
                    )::numeric,

                    NULLIF(
                        to_jsonb(wo)->>'total_amount',
                        ''
                    )::numeric,

                    NULLIF(
                        to_jsonb(wo)->>'order_total',
                        ''
                    )::numeric,

                    (
                        SELECT COALESCE(
                            SUM(oi.subtotal),
                            0
                        )
                        FROM public.wholesale_order_items oi
                        WHERE oi.order_id = wo.id
                    )

                ) AS final_total,

                COALESCE(
                    to_jsonb(wo)->>'payment_method',
                    ''
                ) AS payment_method,

                COALESCE(
                    to_jsonb(wo)->>'payment_status',
                    'PENDING'
                ) AS payment_status,

                a.claimed_by_user_id,

                a.claimed_at,

                a.started_by_user_id,

                a.started_at,

                a.delivered_by_user_id,

                a.delivered_at

            FROM public.wholesale_orders wo

            LEFT JOIN LATERAL (
                SELECT va.*
                FROM public.vehicle_delivery_assignments va
                WHERE va.wholesale_order_id = wo.id
                ORDER BY va.id DESC
                LIMIT 1
            ) a ON TRUE

            LEFT JOIN public.delivery_vehicles dv
                ON dv.id = a.vehicle_id

            WHERE a.id IS NULL
               OR a.vehicle_id = ?

            ORDER BY
                CASE
                    WHEN a.id IS NULL THEN 0
                    ELSE 1
                END,
                wo.id DESC
            """;

        return jdbc.query(
                sql,
                (rs, rowNum) -> mapOrder(rs),
                vehicleId
        );
    }

    // ============================================
    // CONVERT DATABASE RECORD TO JSON RESPONSE
    // ============================================

    private DeliveryOrderView mapOrder(
            ResultSet rs
    ) throws SQLException {

        Long orderId =
                rs.getLong("order_id");

        return new DeliveryOrderView(

                orderId,

                nullableLong(
                        rs,
                        "assignment_id"
                ),

                nullableLong(
                        rs,
                        "vehicle_id"
                ),

                rs.getString("vehicle_number"),

                rs.getString("delivery_status"),

                rs.getString("shop_name"),

                rs.getString("phone"),

                rs.getString("email"),

                rs.getString("full_address"),

                rs.getString(
                        "delivery_instructions"
                ),

                nullableDouble(
                        rs,
                        "shop_latitude"
                ),

                nullableDouble(
                        rs,
                        "shop_longitude"
                ),

                rs.getBigDecimal("final_total"),

                rs.getString("payment_method"),

                rs.getString("payment_status"),

                nullableLong(
                        rs,
                        "claimed_by_user_id"
                ),

                getInstant(
                        rs,
                        "claimed_at"
                ),

                nullableLong(
                        rs,
                        "started_by_user_id"
                ),

                getInstant(
                        rs,
                        "started_at"
                ),

                nullableLong(
                        rs,
                        "delivered_by_user_id"
                ),

                getInstant(
                        rs,
                        "delivered_at"
                ),

                loadItems(orderId)
        );
    }

    // ============================================
    // LOAD ACTUAL ORDER ITEMS
    //
    // Important fix:
    // Uses wholesale_order_items.flavour
    // and normalizes legacy yoghurt labels.
    //
    // Does not modify quantities or prices.
    // ============================================

    private List<OrderItemView> loadItems(
            Long orderId
    ) {

        return jdbc.query(
                """
                SELECT

                    oi.id,

                    oi.product_id,

                    COALESCE(
                        p.name,
                        oi.product_id
                    ) AS product_name,

                    oi.flavour,

                    oi.quantity,

                    oi.unit_price,

                    oi.subtotal

                FROM public.wholesale_order_items oi

                LEFT JOIN public.wholesale_products p
                    ON p.id = oi.product_id

                WHERE oi.order_id = ?

                ORDER BY oi.id
                """,

                (rs, rowNum) -> {

                    String productId =
                            rs.getString(
                                    "product_id"
                            );

                    String flavour =
                            normalizeFlavour(
                                    productId,
                                    rs.getString(
                                            "flavour"
                                    )
                            );

                    return new OrderItemView(

                            rs.getLong("id"),

                            productId,

                            rs.getString(
                                    "product_name"
                            ),

                            flavour,

                            rs.getInt("quantity"),

                            rs.getBigDecimal(
                                    "unit_price"
                            ),

                            rs.getBigDecimal(
                                    "subtotal"
                            )
                    );
                },

                orderId
        );
    }

    // ============================================
    // LEGACY DATABASE CORRECTION
    //
    // Before deducting stock, normalize only
    // eligible yoghurt order items.
    //
    // This UPDATE participates in the same
    // transaction as the stock deduction.
    //
    // A failure rolls it back.
    // ============================================

    private void normalizeLegacyYoghurtItems(
            Long orderId
    ) {

        int changed = jdbc.update(
                """
                UPDATE public.wholesale_order_items

                SET flavour = 'Yoghurt'

                WHERE order_id = ?

                  AND product_id = 'yoghurt-drink'

                  AND LOWER(TRIM(flavour)) IN (
                      'original',
                      'plain'
                  )
                """,
                orderId
        );

        if (changed > 0) {

            log.info(
                    "Normalized {} legacy yoghurt items " +
                    "for wholesale order {}",
                    changed,
                    orderId
            );
        }
    }

    // ============================================
    // NULLABLE VALUE HELPERS
    // ============================================

    private Long nullableLong(
            ResultSet rs,
            String column
    ) throws SQLException {

        long value =
                rs.getLong(column);

        return rs.wasNull()
                ? null
                : value;
    }

    private Double nullableDouble(
            ResultSet rs,
            String column
    ) throws SQLException {

        double value =
                rs.getDouble(column);

        return rs.wasNull()
                ? null
                : value;
    }

    private Instant getInstant(
            ResultSet rs,
            String column
    ) throws SQLException {

        Timestamp timestamp =
                rs.getTimestamp(column);

        return timestamp == null
                ? null
                : timestamp.toInstant();
    }

    // ============================================
    // CLAIM ORDER
    //
    // WAITING -> PROCESSING
    // ============================================

    @Transactional
    public void claimOrder(
            Authentication authentication,
            Long orderId
    ) {

        Long userId =
                currentUserId(authentication);

        Long vehicleId =
                selectedVehicleId(authentication);

        validateOrderId(orderId);

        // Serialize claims for this order.
        List<Long> orders = jdbc.query(
                """
                SELECT id
                FROM public.wholesale_orders
                WHERE id = ?
                FOR UPDATE
                """,

                (rs, rowNum) ->
                        rs.getLong("id"),

                orderId
        );

        if (orders.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Wholesale order not found"
            );
        }

        // Existing business rule:
        // A submitted wholesale order can be
        // claimed by one vehicle.
        //
        // Add production-readiness validation
        // here if required by your factory flow.

        try {

            int inserted = jdbc.update(
                    """
                    INSERT INTO
                        public.vehicle_delivery_assignments
                    (
                        wholesale_order_id,

                        vehicle_id,

                        status,

                        assigned_at,

                        claimed_by_user_id,

                        claimed_at
                    )

                    VALUES (
                        ?,
                        ?,
                        'PROCESSING',
                        NOW(),
                        ?,
                        NOW()
                    )

                    ON CONFLICT (
                        wholesale_order_id
                    ) DO NOTHING
                    """,

                    orderId,

                    vehicleId,

                    userId
            );

            if (inserted != 1) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "This order has already been claimed"
                );
            }

            log.info(
                    "Order {} claimed by delivery user {} " +
                    "for vehicle {}",
                    orderId,
                    userId,
                    vehicleId
            );

        } catch (DuplicateKeyException ex) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order already claimed",
                    ex
            );
        }
    }

    // ============================================
    // MARK ON THE WAY
    //
    // PROCESSING -> ON_THE_WAY
    // ============================================

    @Transactional
    public void markOnTheWay(
            Authentication authentication,
            Long orderId
    ) {

        Long userId =
                currentUserId(authentication);

        Long vehicleId =
                selectedVehicleId(authentication);

        validateOrderId(orderId);

        int updated = jdbc.update(
                """
                UPDATE public.vehicle_delivery_assignments

                SET
                    status = 'ON_THE_WAY',

                    started_by_user_id = ?,

                    started_at = NOW()

                WHERE wholesale_order_id = ?

                  AND vehicle_id = ?

                  AND claimed_by_user_id = ?

                  AND status = 'PROCESSING'
                """,

                userId,

                orderId,

                vehicleId,

                userId
        );

        if (updated != 1) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order is not processing on " +
                    "your selected vehicle"
            );
        }

        log.info(
                "Order {} is ON_THE_WAY " +
                "with vehicle {}",
                orderId,
                vehicleId
        );
    }

    // ============================================
    // MARK DELIVERED
    //
    // CRITICAL TRANSACTION:
    //
    // 1. Check selected vehicle
    // 2. Lock delivery assignment
    // 3. Check delivery status
    // 4. Normalize legacy yoghurt item
    // 5. Deduct physical lorry stock once
    // 6. Mark assignment DELIVERED
    //
    // Any exception rolls everything back.
    //
    // Cash collection is NOT recorded here.
    // ============================================

    @Transactional
    public void markDelivered(
            Authentication authentication,
            Long orderId
    ) {

        Long userId =
                currentUserId(authentication);

        Long vehicleId =
                selectedVehicleId(authentication);

        validateOrderId(orderId);

        // Lock this assignment so two simultaneous
        // delivery requests cannot process it twice.
        List<Map<String, Object>> assignments =
                jdbc.queryForList(
                        """
                        SELECT
                            id,
                            wholesale_order_id,
                            vehicle_id,
                            status,
                            claimed_by_user_id

                        FROM public.vehicle_delivery_assignments

                        WHERE wholesale_order_id = ?
                          AND vehicle_id = ?

                        FOR UPDATE
                        """,

                        orderId,

                        vehicleId
                );

        if (assignments.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Delivery assignment not found " +
                    "for the selected vehicle"
            );
        }

        Map<String, Object> assignment =
                assignments.get(0);

        Long assignmentId =
                ((Number) assignment.get("id"))
                        .longValue();

        String status =
                String.valueOf(
                        assignment.get("status")
                ).trim().toUpperCase(
                        Locale.ROOT
                );

        Object claimedBy =
                assignment.get(
                        "claimed_by_user_id"
                );

        if (
                claimedBy == null ||
                ((Number) claimedBy).longValue()
                        != userId.longValue()
        ) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only the delivery person who " +
                    "claimed this order may mark it delivered"
            );
        }

        // Safe repeated request:
        // The original transaction already completed.
        if ("DELIVERED".equals(status)) {

            log.info(
                    "Order {} is already DELIVERED",
                    orderId
            );

            return;
        }

        if (
                !"ON_THE_WAY".equals(status) &&
                !"IN_TRANSIT".equals(status)
        ) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order must be ON_THE_WAY " +
                    "before delivery completion"
            );
        }

        // Synchronize legacy yoghurt item names
        // with the approved lorry-stock flavour.
        normalizeLegacyYoghurtItems(orderId);

        // Log the exact order items about to be
        // used for physical stock deduction.
        List<Map<String, Object>> orderItems =
                jdbc.queryForList(
                        """
                        SELECT
                            product_id,
                            flavour,
                            quantity
                        FROM public.wholesale_order_items
                        WHERE order_id = ?
                        ORDER BY id
                        """,
                        orderId
                );

        if (orderItems.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order has no products to deliver"
            );
        }

        log.info(
                "MARK DELIVERED orderId={} " +
                "vehicleId={} items={}",
                orderId,
                vehicleId,
                orderItems
        );

        // ========================================
        // PHYSICAL STOCK DEDUCTION
        //
        // The existing service must handle:
        // - Actual assigned vehicle
        // - Order item quantities
        // - Sufficient unreserved stock
        // - Exactly-once deduction ledger
        // - Atomic rollback on failure
        // ========================================

        stockService.deductOnce(assignmentId);

        // ========================================
        // MARK ORDER AS DELIVERED
        //
        // Runs within the same transaction
        // as the stock deduction.
        // ========================================

        int updated = jdbc.update(
                """
                UPDATE public.vehicle_delivery_assignments

                SET
                    status = 'DELIVERED',

                    delivered_by_user_id = ?,

                    delivered_at = NOW()

                WHERE id = ?

                  AND wholesale_order_id = ?

                  AND vehicle_id = ?

                  AND status IN (
                      'ON_THE_WAY',
                      'IN_TRANSIT'
                  )
                """,

                userId,

                assignmentId,

                orderId,

                vehicleId
        );

        if (updated != 1) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Unable to mark the order delivered"
            );
        }

        log.info(
                "DELIVERY COMPLETED: " +
                "orderId={}, assignmentId={}, " +
                "vehicleId={}, userId={}",
                orderId,
                assignmentId,
                vehicleId,
                userId
        );
    }

    // ============================================
    // ORDER ID VALIDATION
    // ============================================

    private void validateOrderId(
            Long orderId
    ) {

        if (
                orderId == null ||
                orderId <= 0
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }
    }
}
