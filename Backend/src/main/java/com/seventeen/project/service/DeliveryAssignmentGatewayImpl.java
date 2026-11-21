
package com.seventeen.project.service;

import com.seventeen.project.service
        .NearestDeliveryAssignmentService.AvailableDriver;
import com.seventeen.project.service
        .NearestDeliveryAssignmentService.DeliveryDestination;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Repository
public class DeliveryAssignmentGatewayImpl
        implements DeliveryAssignmentGateway {

    private static final Logger log =
            LoggerFactory.getLogger(
                    DeliveryAssignmentGatewayImpl.class
            );

    private final JdbcTemplate jdbc;

    public DeliveryAssignmentGatewayImpl(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // 1. FIND UNASSIGNED WHOLESALE ORDERS
    // ==========================================

    @Override
    public List<Long> findUnassignedOrderIds() {

        String orderColumn = orderReferenceColumn();

        String sql = """
            SELECT wo.id
            FROM public.wholesale_orders wo
            WHERE wo.status = 'PLACED'
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.delivery_assignments da
                  WHERE da.order_id = wo.id
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.vehicle_delivery_assignments va
                  WHERE va.%s = wo.id
              )
            ORDER BY wo.created_at, wo.id
            """.formatted(orderColumn);

        return jdbc.queryForList(sql, Long.class);
    }

    // ==========================================
    // 2. CHECK EXISTING ASSIGNMENTS
    // ==========================================

    @Override
    public boolean isOrderAssigned(Long orderId) {

        if (orderId == null) {
            return false;
        }

        String orderColumn = orderReferenceColumn();

        String sql = """
            SELECT EXISTS (
                SELECT 1
                FROM public.delivery_assignments
                WHERE order_id = ?
            )
            OR EXISTS (
                SELECT 1
                FROM public.vehicle_delivery_assignments
                WHERE %s = ?
            )
            """.formatted(orderColumn);

        Boolean exists = jdbc.queryForObject(
                sql,
                Boolean.class,
                orderId,
                orderId
        );

        return Boolean.TRUE.equals(exists);
    }

    // ==========================================
    // 3. FIND WHOLESALE ORDER DESTINATION
    // ==========================================

    @Override
    public Optional<DeliveryDestination>
    findOrderDestination(Long orderId) {

        if (orderId == null) {
            return Optional.empty();
        }

        List<DeliveryDestination> results =
                jdbc.query(
                    """
                    SELECT
                        COALESCE(
                            delivery_latitude,
                            latitude
                        ) AS latitude,

                        COALESCE(
                            delivery_longitude,
                            longitude
                        ) AS longitude

                    FROM public.wholesale_orders
                    WHERE id = ?
                    """,
                    (rs, rowNum) -> {

                        Double latitude =
                                nullableDouble(
                                        rs,
                                        "latitude"
                                );

                        Double longitude =
                                nullableDouble(
                                        rs,
                                        "longitude"
                                );

                        if (latitude == null
                                || longitude == null) {
                            return null;
                        }

                        return new DeliveryDestination(
                                latitude,
                                longitude
                        );
                    },
                    orderId
                );

        return results.stream()
                .filter(Objects::nonNull)
                .findFirst();
    }

    // ==========================================
    // 4. FIND AVAILABLE DELIVERY VEHICLES
    // ==========================================
    //
    // Uses delivery_vehicles instead of the
    // empty delivery_person_locations table.
    //
    // Only vehicles with active, recent shifts
    // and valid GPS coordinates are selected.
    //
    // A vehicle-based assignment does not need
    // an invented delivery-person ID.
    // ==========================================

    @Override
    public List<AvailableDriver> findAvailableDrivers() {

        List<AvailableDriver> vehicles =
                jdbc.query(
                    """
                    SELECT
                        v.id AS vehicle_id,
                        v.vehicle_number,
                        v.latitude,
                        v.longitude,
                        s.id AS shift_id

                    FROM public.delivery_vehicles v

                    JOIN LATERAL (
                        SELECT
                            dvs.id
                        FROM public.delivery_vehicle_shifts dvs
                        WHERE dvs.vehicle_id = v.id
                          AND dvs.ended_at IS NULL
                          AND dvs.expires_at >
                              CURRENT_TIMESTAMP
                          AND dvs.last_seen_at >=
                              CURRENT_TIMESTAMP
                              - INTERVAL '2 minutes'
                        ORDER BY
                            dvs.last_seen_at DESC,
                            dvs.id DESC
                        LIMIT 1
                    ) s ON TRUE

                    WHERE UPPER(v.status) = 'AVAILABLE'
                      AND v.latitude IS NOT NULL
                      AND v.longitude IS NOT NULL
                      AND v.latitude BETWEEN -90 AND 90
                      AND v.longitude BETWEEN -180 AND 180

                    ORDER BY v.id
                    """,
                    (rs, rowNum) ->
                            new AvailableDriver(
                                    null,
                                    rs.getLong("vehicle_id"),
                                    rs.getLong("shift_id"),
                                    rs.getDouble("latitude"),
                                    rs.getDouble("longitude")
                            )
                );

        log.info(
                "Found {} available vehicles with active shifts",
                vehicles.size()
        );

        for (AvailableDriver vehicle : vehicles) {
            log.debug(
                    "Candidate vehicle {}, shift {}, GPS ({}, {})",
                    vehicle.vehicleId(),
                    vehicle.shiftId(),
                    vehicle.latitude(),
                    vehicle.longitude()
            );
        }

        return vehicles;
    }

    // ==========================================
    // 5. SAVE VEHICLE DELIVERY ASSIGNMENT
    // ==========================================

    @Override
    @Transactional
    public void saveAssignment(
            Long orderId,
            AvailableDriver driver,
            double distanceKm
    ) {

        if (orderId == null || orderId <= 0) {
            throw new IllegalArgumentException(
                    "A valid order ID is required"
            );
        }

        if (driver == null
                || driver.vehicleId() == null
                || driver.shiftId() == null) {

            throw new IllegalArgumentException(
                    "Vehicle ID and shift ID are required"
            );
        }

        if (!Double.isFinite(distanceKm)
                || distanceKm < 0) {

            throw new IllegalArgumentException(
                    "Invalid delivery distance"
            );
        }

        // Prevent ordinary duplicate assignments.
        // A unique database constraint is still
        // required to prevent concurrent duplicates.

        if (isOrderAssigned(orderId)) {

            log.info(
                    "Order {} is already assigned",
                    orderId
            );

            return;
        }

        // Revalidate the selected vehicle and shift
        // immediately before saving.

        Boolean eligible = jdbc.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM public.delivery_vehicles v
                    JOIN public.delivery_vehicle_shifts s
                      ON s.vehicle_id = v.id
                    WHERE v.id = ?
                      AND s.id = ?
                      AND UPPER(v.status) = 'AVAILABLE'
                      AND s.ended_at IS NULL
                      AND s.expires_at > CURRENT_TIMESTAMP
                      AND s.last_seen_at >=
                          CURRENT_TIMESTAMP
                          - INTERVAL '2 minutes'
                )
                """,
                Boolean.class,
                driver.vehicleId(),
                driver.shiftId()
        );

        if (!Boolean.TRUE.equals(eligible)) {
            throw new IllegalStateException(
                    "Selected vehicle or shift is no longer available"
            );
        }

        // Read the actual assignment-table schema.
        // Only known, supported columns are used.

        List<ColumnInfo> columns = assignmentColumns();

        Set<String> names = columns.stream()
                .map(ColumnInfo::name)
                .collect(Collectors.toSet());

        String orderColumn = orderReferenceColumn();

        List<String> insertColumns =
                new ArrayList<>();

        List<Object> values =
                new ArrayList<>();

        addColumn(
                names,
                insertColumns,
                values,
                orderColumn,
                orderId
        );

        addColumn(
                names,
                insertColumns,
                values,
                "vehicle_id",
                driver.vehicleId()
        );

        addColumn(
                names,
                insertColumns,
                values,
                "shift_id",
                driver.shiftId()
        );

        // Optional columns, if present.

        addColumn(
                names,
                insertColumns,
                values,
                "status",
                "ASSIGNED"
        );

        if (names.contains("distance_km")) {
            addColumn(
                    names,
                    insertColumns,
                    values,
                    "distance_km",
                    distanceKm
            );
        }

        if (names.contains("assigned_at")) {
            addColumn(
                    names,
                    insertColumns,
                    values,
                    "assigned_at",
                    java.sql.Timestamp.from(
                            java.time.Instant.now()
                    )
            );
        }

        // Reject unsupported required columns
        // rather than inserting an incomplete row.

        Set<String> supplied =
                Set.copyOf(insertColumns);

        List<String> missingRequired =
                columns.stream()
                        .filter(ColumnInfo::required)
                        .map(ColumnInfo::name)
                        .filter(name ->
                                !supplied.contains(name)
                        )
                        .toList();

        if (!missingRequired.isEmpty()) {

            throw new IllegalStateException(
                    "vehicle_delivery_assignments has " +
                    "required columns that need explicit " +
                    "mapping: " + missingRequired
            );
        }

        String placeholders =
                insertColumns.stream()
                        .map(name -> "?")
                        .collect(
                                Collectors.joining(", ")
                        );

        String sql = """
                INSERT INTO
                    public.vehicle_delivery_assignments
                    (%s)
                VALUES (%s)
                """.formatted(
                        String.join(
                                ", ",
                                insertColumns
                        ),
                        placeholders
                );

        int inserted = jdbc.update(
                sql,
                values.toArray()
        );

        if (inserted != 1) {
            throw new IllegalStateException(
                    "Vehicle assignment insert failed"
            );
        }

        log.info(
                "Order {} assigned to vehicle {}, " +
                "shift {}, distance {} km",
                orderId,
                driver.vehicleId(),
                driver.shiftId(),
                distanceKm
        );
    }

    // ==========================================
    // DATABASE SCHEMA HELPERS
    // ==========================================

    private String orderReferenceColumn() {

        Set<String> names =
                assignmentColumns()
                        .stream()
                        .map(ColumnInfo::name)
                        .collect(Collectors.toSet());

        if (names.contains("order_id")) {
            return "order_id";
        }

        if (names.contains("wholesale_order_id")) {
            return "wholesale_order_id";
        }

        throw new IllegalStateException(
                "Cannot identify the wholesale order " +
                "reference in vehicle_delivery_assignments. " +
                "Expected order_id or wholesale_order_id."
        );
    }

    private List<ColumnInfo> assignmentColumns() {

        return jdbc.query(
                """
                SELECT
                    column_name,
                    is_nullable,
                    column_default,
                    is_identity,
                    is_generated
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name =
                      'vehicle_delivery_assignments'
                ORDER BY ordinal_position
                """,
                (rs, rowNum) -> {

                    String name =
                            rs.getString("column_name");

                    boolean nullable =
                            "YES".equalsIgnoreCase(
                                    rs.getString(
                                            "is_nullable"
                                    )
                            );

                    boolean hasDefault =
                            rs.getString(
                                    "column_default"
                            ) != null;

                    boolean identity =
                            "YES".equalsIgnoreCase(
                                    rs.getString(
                                            "is_identity"
                                    )
                            );

                    boolean generated =
                            !"NEVER".equalsIgnoreCase(
                                    rs.getString(
                                            "is_generated"
                                    )
                            );

                    boolean required =
                            !nullable
                            && !hasDefault
                            && !identity
                            && !generated;

                    return new ColumnInfo(
                            name,
                            required
                    );
                }
        );
    }

    private void addColumn(
            Set<String> availableColumns,
            List<String> insertColumns,
            List<Object> values,
            String name,
            Object value
    ) {

        if (availableColumns.contains(name)) {
            insertColumns.add(name);
            values.add(value);
        }
    }

    private Double nullableDouble(
            ResultSet rs,
            String column
    ) throws SQLException {

        double value = rs.getDouble(column);

        return rs.wasNull() ? null : value;
    }

    private record ColumnInfo(
            String name,
            boolean required
    ) {}
}
