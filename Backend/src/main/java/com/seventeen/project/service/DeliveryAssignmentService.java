
package com.seventeen.project.service;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DeliveryAssignmentService {

    private static final int GPS_MAX_AGE_SECONDS = 120;

    private final JdbcTemplate jdbcTemplate;
    private final DeliveryVehicleService vehicleService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public DeliveryAssignmentService(
            JdbcTemplate jdbcTemplate,
            DeliveryVehicleService vehicleService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.vehicleService = vehicleService;
    }

    // ==========================================
    // ORDER ITEM RESPONSE
    // ==========================================

    public record DeliveryOrderItem(
            Long id,
            String productId,
            String productName,
            String flavour,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal subtotal
    ) {}

    // ==========================================
    // DELIVERY ORDER RESPONSE
    //
    // Original fields preserved.
    // Added delivery-person tracking fields.
    // ==========================================

    public record DeliveryOrder(
            Long assignmentId,
            Long orderId,
            Long vehicleId,
            String vehicleNumber,
            String status,
            Instant assignedAt,
            Instant deliveredAt,

            String shopName,
            String phone,
            String email,

            String deliveryAddress,
            String address,
            String deliveryStreetAddress,
            String deliveryCity,
            String deliveryProvince,
            String deliveryPostalCode,
            String deliveryInstructions,

            Double latitude,
            Double longitude,
            Double deliveryLatitude,
            Double deliveryLongitude,

            BigDecimal finalTotal,
            String paymentMethod,
            String paymentStatus,

            List<DeliveryOrderItem> items,

            Long startedByUserId,
            Instant startedAt,
            Long deliveredByUserId
    ) {}

    // ==========================================
    // ASSIGNMENT RESULT
    // ==========================================

    public record AssignmentResult(
            Long orderId,
            Long vehicleId,
            String vehicleNumber,
            String status
    ) {}

    // ==========================================
    // CANDIDATE VEHICLE
    // ==========================================

    private record CandidateVehicle(
            Long id,
            String vehicleNumber,
            double latitude,
            double longitude,
            double distanceKm
    ) {}

    // ==========================================
    // 1. ASSIGN NEAREST DELIVERY VEHICLE
    //
    // No active shift required.
    //
    // A vehicle must:
    // - Be AVAILABLE or BUSY
    // - Have valid recent GPS
    // - Have at least one delivery person
    //   currently selecting it
    // ==========================================

    @Transactional
    public AssignmentResult assignNearestVehicle(
            Long wholesaleOrderId,
            double shopLatitude,
            double shopLongitude
    ) {

        validateCoordinates(
                shopLatitude,
                shopLongitude
        );

        if (wholesaleOrderId == null ||
                wholesaleOrderId <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }

        // Prevent concurrent assignments of
        // the same wholesale order.

        jdbcTemplate.queryForObject(
                "SELECT pg_advisory_xact_lock(?, ?)",
                (rs, rowNum) -> 1,
                17001,
                Math.toIntExact(
                        wholesaleOrderId % Integer.MAX_VALUE
                )
        );

        // Check for an existing vehicle assignment.

        List<AssignmentResult> existing =
                jdbcTemplate.query(
                    """
                    SELECT
                        a.wholesale_order_id,
                        a.vehicle_id,
                        v.vehicle_number,
                        a.status

                    FROM public.vehicle_delivery_assignments a

                    JOIN public.delivery_vehicles v
                        ON v.id = a.vehicle_id

                    WHERE a.wholesale_order_id = ?
                    """,

                    (rs, rowNum) ->
                            new AssignmentResult(
                                    rs.getLong(
                                            "wholesale_order_id"
                                    ),
                                    rs.getLong("vehicle_id"),
                                    rs.getString(
                                            "vehicle_number"
                                    ),
                                    rs.getString("status")
                            ),

                    wholesaleOrderId
                );

        if (!existing.isEmpty()) {
            return existing.get(0);
        }

        // Find vehicles with valid GPS and
        // at least one selected delivery person.

        List<CandidateVehicle> candidates =
                jdbcTemplate.query(
                    """
                    SELECT
                        v.id,
                        v.vehicle_number,
                        v.latitude,
                        v.longitude

                    FROM public.delivery_vehicles v

                    WHERE v.status IN (
                        'AVAILABLE',
                        'BUSY'
                    )

                    AND v.latitude IS NOT NULL
                    AND v.longitude IS NOT NULL

                    AND v.last_location_update >=
                        NOW() - (
                            ? * INTERVAL '1 second'
                        )

                    AND EXISTS (
                        SELECT 1
                        FROM public.delivery_person_vehicle_selections s
                        JOIN public.app_users u
                            ON u.id = s.user_id
                        WHERE s.vehicle_id = v.id
                          AND u.role = 'DELIVERY_PERSON'
                          AND u.enabled = TRUE
                    )
                    """,

                    (rs, rowNum) ->
                            new CandidateVehicle(
                                    rs.getLong("id"),
                                    rs.getString("vehicle_number"),
                                    rs.getDouble("latitude"),
                                    rs.getDouble("longitude"),
                                    0.0
                            ),

                    GPS_MAX_AGE_SECONDS
                );

        List<CandidateVehicle> ranked =
                new ArrayList<>();

        for (CandidateVehicle vehicle : candidates) {

            if (!isValidCoordinates(
                    vehicle.latitude(),
                    vehicle.longitude()
            )) {
                continue;
            }

            double distance = calculateDistanceKm(
                    shopLatitude,
                    shopLongitude,
                    vehicle.latitude(),
                    vehicle.longitude()
            );

            ranked.add(
                    new CandidateVehicle(
                            vehicle.id(),
                            vehicle.vehicleNumber(),
                            vehicle.latitude(),
                            vehicle.longitude(),
                            distance
                    )
            );
        }

        ranked.sort(
                Comparator.comparingDouble(
                        CandidateVehicle::distanceKm
                )
        );

        // Try the nearest eligible vehicle first.

        for (CandidateVehicle vehicle : ranked) {

            List<Long> lockedVehicles =
                    jdbcTemplate.query(
                        """
                        SELECT id
                        FROM public.delivery_vehicles
                        WHERE id = ?
                        FOR UPDATE SKIP LOCKED
                        """,

                        (rs, rowNum) ->
                                rs.getLong("id"),

                        vehicle.id()
                    );

            if (lockedVehicles.isEmpty()) {
                continue;
            }

            // Recheck availability after locking.

            Integer eligible =
                    jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)

                        FROM public.delivery_vehicles v

                        WHERE v.id = ?

                          AND v.status IN (
                              'AVAILABLE',
                              'BUSY'
                          )

                          AND v.latitude IS NOT NULL
                          AND v.longitude IS NOT NULL

                          AND v.last_location_update >=
                              NOW() - (
                                  ? * INTERVAL '1 second'
                              )

                          AND EXISTS (
                              SELECT 1
                              FROM public.delivery_person_vehicle_selections s
                              JOIN public.app_users u
                                  ON u.id = s.user_id
                              WHERE s.vehicle_id = v.id
                                AND u.role = 'DELIVERY_PERSON'
                                AND u.enabled = TRUE
                          )
                        """,

                        Integer.class,
                        vehicle.id(),
                        GPS_MAX_AGE_SECONDS
                    );

            if (eligible == null || eligible == 0) {
                continue;
            }

            // Insert assignment without shift_id.

            jdbcTemplate.update(
                    """
                    INSERT INTO public.vehicle_delivery_assignments (
                        wholesale_order_id,
                        vehicle_id,
                        status,
                        assigned_at
                    )
                    VALUES (?, ?, 'ASSIGNED', NOW())
                    """,

                    wholesaleOrderId,
                    vehicle.id()
            );

            jdbcTemplate.update(
                    """
                    UPDATE public.delivery_vehicles
                    SET status = 'BUSY'
                    WHERE id = ?
                    """,

                    vehicle.id()
            );

            return new AssignmentResult(
                    wholesaleOrderId,
                    vehicle.id(),
                    vehicle.vehicleNumber(),
                    "ASSIGNED"
            );
        }

        // No eligible vehicle is currently available.
        // Leave the wholesale order unassigned.

        return new AssignmentResult(
                wholesaleOrderId,
                null,
                null,
                "PENDING_ASSIGNMENT"
        );
    }

    // ==========================================
    // 2. GET ORDERS FOR SELECTED VEHICLE
    //
    // No shift token.
    // Vehicle is resolved from logged-in user.
    //
    // Multiple drivers selecting the same
    // vehicle receive the same orders.
    // ==========================================

    @Transactional(readOnly = true)
    public List<DeliveryOrder> getMyOrders(
            Authentication authentication
    ) {

        Long vehicleId =
                vehicleService.requireSelectedVehicle(
                        authentication
                );

        List<DeliveryOrder> orders =
                jdbcTemplate.query(
                    """
                    SELECT
                        a.id AS assignment_id,
                        a.wholesale_order_id AS order_id,
                        a.vehicle_id,
                        v.vehicle_number,

                        a.status,
                        a.assigned_at,
                        a.delivered_at,

                        a.started_by_user_id,
                        a.started_at,
                        a.delivered_by_user_id,

                        wo.shop_name,
                        wo.phone,
                        wo.email,

                        wo.address,
                        wo.delivery_street_address,
                        wo.delivery_city,
                        wo.delivery_province,
                        wo.delivery_postal_code,
                        wo.delivery_instructions,

                        COALESCE(
                            NULLIF(wo.delivery_street_address, ''),
                            NULLIF(wo.address, '')
                        ) AS delivery_address,

                        COALESCE(
                            wo.delivery_latitude,
                            wo.latitude
                        ) AS latitude,

                        COALESCE(
                            wo.delivery_longitude,
                            wo.longitude
                        ) AS longitude,

                        wo.final_total,
                        wo.payment_method,
                        wo.payment_status

                    FROM public.vehicle_delivery_assignments a

                    JOIN public.delivery_vehicles v
                        ON v.id = a.vehicle_id

                    JOIN public.wholesale_orders wo
                        ON wo.id = a.wholesale_order_id

                    WHERE a.vehicle_id = ?

                    ORDER BY
                        CASE
                            WHEN a.status = 'IN_TRANSIT'
                                THEN 0
                            WHEN a.status = 'ASSIGNED'
                                THEN 1
                            WHEN a.status = 'DELIVERED'
                                THEN 2
                            ELSE 3
                        END,
                        a.assigned_at ASC,
                        a.id ASC
                    """,

                    this::mapDeliveryOrder,
                    vehicleId
                );

        // Preserve the ordered-product details.

        List<DeliveryOrder> completeOrders =
                new ArrayList<>();

        for (DeliveryOrder order : orders) {

            List<DeliveryOrderItem> items =
                    getOrderItems(order.orderId());

            completeOrders.add(
                    new DeliveryOrder(
                            order.assignmentId(),
                            order.orderId(),
                            order.vehicleId(),
                            order.vehicleNumber(),
                            order.status(),
                            order.assignedAt(),
                            order.deliveredAt(),

                            order.shopName(),
                            order.phone(),
                            order.email(),

                            order.deliveryAddress(),
                            order.address(),
                            order.deliveryStreetAddress(),
                            order.deliveryCity(),
                            order.deliveryProvince(),
                            order.deliveryPostalCode(),
                            order.deliveryInstructions(),

                            order.latitude(),
                            order.longitude(),
                            order.deliveryLatitude(),
                            order.deliveryLongitude(),

                            order.finalTotal(),
                            order.paymentMethod(),
                            order.paymentStatus(),

                            items,

                            order.startedByUserId(),
                            order.startedAt(),
                            order.deliveredByUserId()
                    )
            );
        }

        return completeOrders;
    }

    // ==========================================
    // 3. GET ORDER ITEMS
    // ==========================================

    private List<DeliveryOrderItem> getOrderItems(
            Long orderId
    ) {

        return jdbcTemplate.query(
                """
                SELECT
                    oi.id,
                    oi.product_id,
                    p.name AS product_name,
                    oi.flavour,
                    oi.quantity,
                    oi.unit_price,
                    oi.subtotal

                FROM public.wholesale_order_items oi

                JOIN public.wholesale_products p
                    ON p.id = oi.product_id

                WHERE oi.order_id = ?

                ORDER BY oi.id
                """,

                (rs, rowNum) ->
                        new DeliveryOrderItem(
                                rs.getLong("id"),
                                rs.getString("product_id"),
                                rs.getString("product_name"),
                                rs.getString("flavour"),
                                rs.getInt("quantity"),
                                rs.getBigDecimal("unit_price"),
                                rs.getBigDecimal("subtotal")
                        ),

                orderId
        );
    }

    // ==========================================
    // 4. START DELIVERY
    //
    // Records the person who started it.
    //
    // Only ASSIGNED -> IN_TRANSIT is allowed.
    // ==========================================

    @Transactional
    public void startDelivery(
            Authentication authentication,
            Long wholesaleOrderId
    ) {

        Long vehicleId =
                vehicleService.requireSelectedVehicle(
                        authentication
                );

        Long driverId =
                getAuthenticatedDriverId(authentication);

        if (wholesaleOrderId == null ||
                wholesaleOrderId <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }

        int updated =
                jdbcTemplate.update(
                    """
                    UPDATE public.vehicle_delivery_assignments a

                    SET
                        status = 'IN_TRANSIT',
                        started_by_user_id = ?,
                        started_at = NOW()

                    WHERE a.wholesale_order_id = ?
                      AND a.vehicle_id = ?
                      AND a.status = 'ASSIGNED'

                      AND EXISTS (
                          SELECT 1
                          FROM public.delivery_person_vehicle_selections s
                          WHERE s.user_id = ?
                            AND s.vehicle_id = a.vehicle_id
                      )
                    """,

                    driverId,
                    wholesaleOrderId,
                    vehicleId,
                    driverId
                );

        if (updated != 1) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order cannot be started. "
                    + "It may already be in transit or completed."
            );
        }
    }

    // ==========================================
    // 5. COMPLETE DELIVERY
    //
    // Records the person who completed it.
    //
    // Only IN_TRANSIT -> DELIVERED is allowed.
    // ==========================================

    @Transactional
    public void completeDelivery(
            Authentication authentication,
            Long wholesaleOrderId
    ) {

        Long vehicleId =
                vehicleService.requireSelectedVehicle(
                        authentication
                );

        Long driverId =
                getAuthenticatedDriverId(authentication);

        if (wholesaleOrderId == null ||
                wholesaleOrderId <= 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }

        int updated =
                jdbcTemplate.update(
                    """
                    UPDATE public.vehicle_delivery_assignments a

                    SET
                        status = 'DELIVERED',
                        delivered_at = NOW(),
                        delivered_by_user_id = ?

                    WHERE a.wholesale_order_id = ?
                      AND a.vehicle_id = ?
                      AND a.status = 'IN_TRANSIT'

                      AND EXISTS (
                          SELECT 1
                          FROM public.delivery_person_vehicle_selections s
                          WHERE s.user_id = ?
                            AND s.vehicle_id = a.vehicle_id
                      )
                    """,

                    driverId,
                    wholesaleOrderId,
                    vehicleId,
                    driverId
                );

        if (updated != 1) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order cannot be completed. "
                    + "It may not be started or is already delivered."
            );
        }

        // Check remaining unfinished deliveries.

        Integer remaining =
                jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*)

                    FROM public.vehicle_delivery_assignments

                    WHERE vehicle_id = ?

                      AND status IN (
                          'ASSIGNED',
                          'IN_TRANSIT'
                      )
                    """,

                    Integer.class,
                    vehicleId
                );

        // Mark the vehicle available again only
        // if all its assigned orders are finished.

        if (remaining != null && remaining == 0) {

            jdbcTemplate.update(
                    """
                    UPDATE public.delivery_vehicles
                    SET status = 'AVAILABLE'
                    WHERE id = ?
                      AND status = 'BUSY'
                    """,

                    vehicleId
            );
        }
    }

    // ==========================================
    // 6. GET AUTHENTICATED DRIVER ID
    // ==========================================

    private Long getAuthenticatedDriverId(
            Authentication authentication
    ) {

        if (authentication == null ||
                !authentication.isAuthenticated()) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Delivery person login required"
            );
        }

        String email = authentication.getName();

        List<Long> userIds =
                jdbcTemplate.queryForList(
                    """
                    SELECT id
                    FROM public.app_users

                    WHERE UPPER(email) = UPPER(?)
                      AND role = 'DELIVERY_PERSON'
                      AND enabled = TRUE
                    """,

                    Long.class,
                    email
                );

        if (userIds.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Active delivery person account not found"
            );
        }

        return userIds.get(0);
    }

    // ==========================================
    // 7. MAP DELIVERY ORDER
    // ==========================================

    private DeliveryOrder mapDeliveryOrder(
            ResultSet rs,
            int rowNum
    ) throws SQLException {

        Timestamp assigned =
                rs.getTimestamp("assigned_at");

        Timestamp delivered =
                rs.getTimestamp("delivered_at");

        Timestamp started =
                rs.getTimestamp("started_at");

        Double latitude =
                getNullableDouble(rs, "latitude");

        Double longitude =
                getNullableDouble(rs, "longitude");

        return new DeliveryOrder(
                rs.getLong("assignment_id"),
                rs.getLong("order_id"),
                rs.getLong("vehicle_id"),
                rs.getString("vehicle_number"),
                rs.getString("status"),

                assigned == null
                        ? null
                        : assigned.toInstant(),

                delivered == null
                        ? null
                        : delivered.toInstant(),

                rs.getString("shop_name"),
                rs.getString("phone"),
                rs.getString("email"),

                rs.getString("delivery_address"),
                rs.getString("address"),
                rs.getString("delivery_street_address"),
                rs.getString("delivery_city"),
                rs.getString("delivery_province"),
                rs.getString("delivery_postal_code"),
                rs.getString("delivery_instructions"),

                latitude,
                longitude,
                latitude,
                longitude,

                rs.getBigDecimal("final_total"),
                rs.getString("payment_method"),
                rs.getString("payment_status"),

                List.of(),

                getNullableLong(
                        rs,
                        "started_by_user_id"
                ),

                started == null
                        ? null
                        : started.toInstant(),

                getNullableLong(
                        rs,
                        "delivered_by_user_id"
                )
        );
    }

    // ==========================================
    // 8. NULL-SAFE DATABASE MAPPING
    // ==========================================

    private Double getNullableDouble(
            ResultSet rs,
            String column
    ) throws SQLException {

        double value = rs.getDouble(column);

        return rs.wasNull()
                ? null
                : value;
    }

    private Long getNullableLong(
            ResultSet rs,
            String column
    ) throws SQLException {

        long value = rs.getLong(column);

        return rs.wasNull()
                ? null
                : value;
    }

    // ==========================================
    // 9. VALIDATE COORDINATES
    // ==========================================

    private void validateCoordinates(
            double latitude,
            double longitude
    ) {

        if (!isValidCoordinates(
                latitude,
                longitude
        )) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale shop coordinates"
            );
        }
    }

    private boolean isValidCoordinates(
            double latitude,
            double longitude
    ) {

        return Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90
                && latitude <= 90
                && longitude >= -180
                && longitude <= 180;
    }

    // ==========================================
    // 10. HAVERSINE DISTANCE IN KILOMETERS
    // ==========================================

    private double calculateDistanceKm(
            double lat1,
            double lon1,
            double lat2,
            double lon2
    ) {

        final double earthRadiusKm = 6371.0;

        double dLat =
                Math.toRadians(lat2 - lat1);

        double dLon =
                Math.toRadians(lon2 - lon1);

        double a =
                Math.pow(
                        Math.sin(dLat / 2),
                        2
                )
                +
                Math.cos(Math.toRadians(lat1))
                *
                Math.cos(Math.toRadians(lat2))
                *
                Math.pow(
                        Math.sin(dLon / 2),
                        2
                );

        double c =
                2 * Math.atan2(
                        Math.sqrt(a),
                        Math.sqrt(
                                Math.max(0, 1 - a)
                        )
                );

        return earthRadiusKm * c;
    }
}
