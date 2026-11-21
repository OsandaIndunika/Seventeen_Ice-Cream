
package com.seventeen.project.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeliveryOrderService {

    private final JdbcTemplate jdbc;
    private final DeliveryClaimService claimService;

    public DeliveryOrderService(
            JdbcTemplate jdbc,
            DeliveryClaimService claimService
    ) {
        this.jdbc = jdbc;
        this.claimService = claimService;
    }

    // ==========================================
    // AUTHENTICATED DELIVERY PERSON
    // ==========================================

    private long userId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in as a delivery person"
            );
        }

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role IN (
                      'DELIVERY_PERSON',
                      'ROLE_DELIVERY_PERSON'
                  )
                  AND enabled = TRUE
                """,
                (rs, rowNum) -> rs.getLong("id"),
                email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Delivery person account not found"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // AUTHENTICATION ADAPTER
    // ==========================================

    private Authentication authenticationFor(
            String email
    ) {
        userId(email);

        return new UsernamePasswordAuthenticationToken(
                email,
                null,
                List.of(
                        new SimpleGrantedAuthority(
                                "ROLE_DELIVERY_PERSON"
                        )
                )
        );
    }

    // ==========================================
    // VALIDATE GPS COORDINATES
    // ==========================================

    private void validateCoordinates(
            double latitude,
            double longitude
    ) {

        if (
                !Double.isFinite(latitude) ||
                !Double.isFinite(longitude) ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid GPS coordinates"
            );
        }
    }

    // ==========================================
    // UPDATE DELIVERY PERSON GPS LOCATION
    //
    // Called when a driver starts their shift
    // or shares their current location.
    // ==========================================

    @Transactional
    public void updateLocation(
            String email,
            double latitude,
            double longitude
    ) {

        validateCoordinates(latitude, longitude);

        long driverId = userId(email);

        jdbc.update(
                """
                INSERT INTO public.delivery_person_locations
                (
                    delivery_person_id,
                    latitude,
                    longitude,
                    availability,
                    updated_at
                )
                VALUES (
                    ?, ?, ?, 'AVAILABLE', NOW()
                )
                ON CONFLICT (delivery_person_id)
                DO UPDATE SET
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    updated_at = NOW()
                """,
                driverId,
                latitude,
                longitude
        );

        // GPS updates intentionally do not reset
        // an existing BUSY availability state.
    }

    // ==========================================
    // CALCULATE STRAIGHT-LINE DISTANCE
    //
    // This is not driving distance.
    // Google Maps must calculate road routes.
    // ==========================================

    public double distanceKm(
            double lat1,
            double lon1,
            double lat2,
            double lon2
    ) {

        validateCoordinates(lat1, lon1);
        validateCoordinates(lat2, lon2);

        final double earthRadiusKm = 6371.0088;

        double latitudeDifference =
                Math.toRadians(lat2 - lat1);

        double longitudeDifference =
                Math.toRadians(lon2 - lon1);

        double a =
                Math.pow(
                        Math.sin(
                                latitudeDifference / 2
                        ),
                        2
                )
                +
                Math.cos(Math.toRadians(lat1))
                *
                Math.cos(Math.toRadians(lat2))
                *
                Math.pow(
                        Math.sin(
                                longitudeDifference / 2
                        ),
                        2
                );

        a = Math.max(0.0, Math.min(1.0, a));

        return 2.0
                * earthRadiusKm
                * Math.asin(Math.sqrt(a));
    }

    // ==========================================
    // MANUAL CLAIM WORKFLOW
    //
    // Do not automatically assign orders.
    //
    // The DeliveryClaimService handles:
    // - Viewing unclaimed orders
    // - Claiming orders
    // - Marking orders on the way
    // - Marking orders delivered
    // ==========================================

    @Deprecated
    public boolean assignNearestDriver(long orderId) {

        if (orderId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }

        // Automatic assignment is disabled.
        // The delivery person must claim the order.
        return false;
    }

    // ==========================================
    // GET ORDERS ASSIGNED TO DRIVER'S VEHICLE
    //
    // Uses the latest assignment per order.
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAssignedOrders(
            String email
    ) {

        long driverId = userId(email);

        List<Map<String, Object>> orders =
                jdbc.query(
                        """
                        SELECT
                            o.id,
                            o.id AS order_id,

                            o.shop_name,
                            o.phone,
                            o.email,

                            o.first_name,
                            o.last_name,

                            o.delivery_street_address,
                            o.delivery_city,
                            o.delivery_province,
                            o.delivery_postal_code,

                            o.delivery_latitude,
                            o.delivery_longitude,
                            o.delivery_instructions,

                            o.final_total,
                            o.total_amount,

                            o.payment_method,
                            o.payment_status,

                            o.created_at,

                            a.id AS assignment_id,
                            a.status AS assignment_status,

                            v.id AS vehicle_id,
                            v.vehicle_number

                        FROM public.wholesale_orders o

                        JOIN LATERAL (
                            SELECT
                                assignment.id,
                                assignment.vehicle_id,
                                assignment.status,
                                assignment.assigned_at

                            FROM public.vehicle_delivery_assignments
                                assignment

                            WHERE assignment.wholesale_order_id =
                                  o.id

                            ORDER BY
                                assignment.assigned_at DESC,
                                assignment.id DESC

                            LIMIT 1
                        ) a ON TRUE

                        JOIN public.delivery_vehicles v
                          ON v.id = a.vehicle_id

                        WHERE v.delivery_person_id = ?

                        ORDER BY o.created_at DESC,
                                 o.id DESC
                        """,
                        (rs, rowNum) ->
                                mapDeliveryOrder(rs),
                        driverId
                );

        for (Map<String, Object> order : orders) {

            long orderId =
                    ((Number) order.get("id"))
                            .longValue();

            List<Map<String, Object>> items =
                    jdbc.queryForList(
                            """
                            SELECT
                                i.id,
                                i.product_id AS "productId",

                                p.name AS "productName",
                                p.size AS "size",

                                i.flavour AS "flavour",
                                i.quantity AS "quantity",

                                i.unit_price AS "unitPrice",
                                i.subtotal AS "subtotal"

                            FROM public.wholesale_order_items i

                            LEFT JOIN public.wholesale_products p
                              ON p.id = i.product_id

                            WHERE i.order_id = ?

                            ORDER BY i.id
                            """,
                            orderId
                    );

            order.put("items", items);
        }

        return orders;
    }

    // ==========================================
    // MAP DATABASE ORDER TO FRONTEND RESPONSE
    // ==========================================

    private Map<String, Object> mapDeliveryOrder(
            ResultSet rs
    ) throws SQLException {

        Map<String, Object> order =
                new LinkedHashMap<>();

        long orderId =
                rs.getLong("id");

        String shopName =
                rs.getString("shop_name");

        String phone =
                rs.getString("phone");

        String email =
                rs.getString("email");

        String firstName =
                rs.getString("first_name");

        String lastName =
                rs.getString("last_name");

        String street =
                rs.getString(
                        "delivery_street_address"
                );

        String city =
                rs.getString("delivery_city");

        String province =
                rs.getString("delivery_province");

        String postalCode =
                rs.getString("delivery_postal_code");

        String instructions =
                rs.getString(
                        "delivery_instructions"
                );

        Double latitude =
                nullableDouble(
                        rs,
                        "delivery_latitude"
                );

        Double longitude =
                nullableDouble(
                        rs,
                        "delivery_longitude"
                );

        String assignmentStatus =
                rs.getString("assignment_status");

        String displayStatus =
                normalizeStatus(assignmentStatus);

        String vehicleNumber =
                rs.getString("vehicle_number");

        String address =
                buildAddress(
                        street,
                        city,
                        province,
                        postalCode
                );

        order.put("id", orderId);
        order.put("orderId", orderId);

        order.put("shopName", shopName);
        order.put("phone", phone);
        order.put("email", email);

        order.put("firstName", firstName);
        order.put("lastName", lastName);

        order.put("customerName",
                buildCustomerName(
                        firstName,
                        lastName
                )
        );

        order.put("address", address);
        order.put("deliveryAddress", address);

        order.put("streetAddress", street);
        order.put("city", city);
        order.put("province", province);
        order.put("postalCode", postalCode);

        order.put("latitude", latitude);
        order.put("longitude", longitude);

        order.put(
                "deliveryLatitude",
                latitude
        );

        order.put(
                "deliveryLongitude",
                longitude
        );

        order.put(
                "deliveryInstructions",
                instructions
        );

        Map<String, Object> deliveryLocation =
                new LinkedHashMap<>();

        deliveryLocation.put(
                "streetAddress",
                street
        );

        deliveryLocation.put("city", city);
        deliveryLocation.put("province", province);
        deliveryLocation.put("postalCode", postalCode);

        deliveryLocation.put("latitude", latitude);
        deliveryLocation.put("longitude", longitude);

        deliveryLocation.put(
                "deliveryInstructions",
                instructions
        );

        order.put(
                "deliveryLocation",
                deliveryLocation
        );

        order.put("status", displayStatus);
        order.put("orderStatus", displayStatus);
        order.put("deliveryStatus", displayStatus);

        order.put(
                "assignmentStatus",
                assignmentStatus
        );

        order.put(
                "assignmentId",
                rs.getLong("assignment_id")
        );

        order.put(
                "vehicleId",
                rs.getLong("vehicle_id")
        );

        order.put(
                "vehicleNumber",
                vehicleNumber
        );

        order.put(
                "paymentMethod",
                rs.getString("payment_method")
        );

        order.put(
                "paymentStatus",
                rs.getString("payment_status")
        );

        Object total =
                rs.getObject("final_total");

        if (total == null) {
            total = rs.getObject("total_amount");
        }

        order.put("totalAmount", total);
        order.put("finalTotal", total);

        Object createdAt =
                rs.getObject("created_at");

        order.put("createdAt", createdAt);

        return order;
    }

    // ==========================================
    // NULLABLE GPS HELPER
    // ==========================================

    private Double nullableDouble(
            ResultSet rs,
            String column
    ) throws SQLException {

        Object value =
                rs.getObject(column);

        if (value == null) {
            return null;
        }

        if (value instanceof Number number) {
            return number.doubleValue();
        }

        return Double.valueOf(
                value.toString()
        );
    }

    // ==========================================
    // BUILD DELIVERY ADDRESS
    // ==========================================

    private String buildAddress(
            String street,
            String city,
            String province,
            String postalCode
    ) {

        List<String> parts =
                new ArrayList<>();

        addIfPresent(parts, street);
        addIfPresent(parts, city);
        addIfPresent(parts, province);
        addIfPresent(parts, postalCode);

        return String.join(", ", parts);
    }

    private void addIfPresent(
            List<String> parts,
            String value
    ) {

        if (
                value != null &&
                !value.isBlank()
        ) {
            parts.add(value.trim());
        }
    }

    private String buildCustomerName(
            String firstName,
            String lastName
    ) {

        List<String> parts =
                new ArrayList<>();

        addIfPresent(parts, firstName);
        addIfPresent(parts, lastName);

        return String.join(" ", parts);
    }

    // ==========================================
    // NORMALIZE DELIVERY STATUS
    // ==========================================

    private String normalizeStatus(
            String status
    ) {

        if (status == null) {
            return "WAITING";
        }

        return switch (
                status.trim().toUpperCase()
        ) {

            case "ASSIGNED", "PROCESSING" ->
                    "PROCESSING";

            case "IN_TRANSIT",
                 "OUT_FOR_DELIVERY",
                 "ON_THE_WAY" ->
                    "ON_THE_WAY";

            case "DELIVERED" ->
                    "DELIVERED";

            default ->
                    status.trim().toUpperCase();
        };
    }

    // ==========================================
    // MARK ORDER DELIVERED
    //
    // Delegate to DeliveryClaimService.
    // This prevents two services from applying
    // different delivery status rules.
    // ==========================================

    @Transactional
    public void markDelivered(
            String email,
            long orderId
    ) {

        if (orderId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }

        Authentication authentication =
                authenticationFor(email);

        claimService.markDelivered(
                authentication,
                orderId
        );
    }
}
