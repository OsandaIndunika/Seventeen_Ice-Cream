
package com.seventeen.project.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Service
public class VehicleDeliveryStockService {

    private final JdbcTemplate jdbc;

    public VehicleDeliveryStockService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }

    /**
     * Deduct physical products exactly once.
     *
     * Must be called INSIDE the same transaction
     * that changes an assignment to DELIVERED.
     *
     * Assumption:
     * Order quantities have NOT already been
     * deducted or reserved at claim time.
     */
    @Transactional(
            propagation = Propagation.MANDATORY
    )
    public void deductOnce(long assignmentId) {

        if (assignmentId <= 0) {
            throw conflict("Invalid delivery assignment");
        }

        // 1. Lock the assignment.

        List<Map<String, Object>> assignments =
                jdbc.queryForList(
                        """
                        SELECT
                            id,
                            wholesale_order_id,
                            vehicle_id,
                            status
                        FROM public.vehicle_delivery_assignments
                        WHERE id = ?
                        FOR UPDATE
                        """,
                        assignmentId
                );

        if (assignments.isEmpty()) {
            throw conflict("Delivery assignment not found");
        }

        Map<String, Object> assignment =
                assignments.get(0);

        long orderId = (
                (Number) assignment.get(
                        "wholesale_order_id"
                )
        ).longValue();

        long vehicleId = (
                (Number) assignment.get(
                        "vehicle_id"
                )
        ).longValue();

        String status = String.valueOf(
                assignment.get("status")
        ).toUpperCase();

        // 2. Only the latest assignment can unload.

        Long latestAssignmentId =
                jdbc.queryForObject(
                        """
                        SELECT MAX(id)
                        FROM public.vehicle_delivery_assignments
                        WHERE wholesale_order_id = ?
                        """,
                        Long.class,
                        orderId
                );

        if (
                latestAssignmentId == null ||
                latestAssignmentId != assignmentId
        ) {
            throw conflict(
                    "This is not the current assignment"
            );
        }

        // 3. Prevent double deductions.

        Integer previousDeductions =
                jdbc.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM public.vehicle_order_stock_deductions
                        WHERE wholesale_order_id = ?
                        """,
                        Integer.class,
                        orderId
                );

        if (
                previousDeductions != null &&
                previousDeductions > 0
        ) {
            if ("DELIVERED".equals(status)) {
                return;
            }

            throw conflict(
                    "Stock has already been deducted " +
                    "for this wholesale order"
            );
        }

        // Historical delivered orders without a
        // ledger record require reconciliation.
        if ("DELIVERED".equals(status)) {
            throw conflict(
                    "Previously delivered order requires " +
                    "stock reconciliation"
            );
        }

        if (
                !"ON_THE_WAY".equals(status) &&
                !"IN_TRANSIT".equals(status)
        ) {
            throw conflict(
                    "Order must be ON_THE_WAY " +
                    "before stock can be deducted"
            );
        }

        // 4. Group quantities by the ACTUAL
        // VARCHAR product ID and flavour.

        List<Map<String, Object>> items =
                jdbc.queryForList(
                        """
                        SELECT
                            product_id,
                            flavour,
                            SUM(quantity)::BIGINT AS units

                        FROM public.wholesale_order_items

                        WHERE order_id = ?

                        GROUP BY product_id, flavour

                        ORDER BY product_id, flavour
                        """,
                        orderId
                );

        if (items.isEmpty()) {
            throw conflict(
                    "Wholesale order contains no products"
            );
        }

        // 5. Deduct every ordered item.
        // Any failure rolls back all updates.

        for (Map<String, Object> item : items) {

            String productId =
                    (String) item.get("product_id");

            String flavour =
                    (String) item.get("flavour");

            long units = (
                    (Number) item.get("units")
            ).longValue();

            if (
                    productId == null ||
                    productId.isBlank() ||
                    flavour == null ||
                    flavour.isBlank() ||
                    units <= 0
            ) {
                throw conflict(
                        "Invalid product or flavour " +
                        "in wholesale order"
                );
            }

            int updated = jdbc.update(
                    """
                    UPDATE public.vehicle_stock

                    SET quantity = quantity - ?,
                        updated_at = NOW()

                    WHERE vehicle_id = ?
                      AND product_id = ?
                      AND flavour = ?
                      AND quantity - reserved_quantity >= ?
                    """,
                    units,
                    vehicleId,
                    productId,
                    flavour,
                    units
            );

            if (updated != 1) {
                throw conflict(
                        "Insufficient unreserved stock: " +
                        productId + " / " + flavour +
                        ". Required quantity: " + units
                );
            }
        }

        // 6. Create an audit record.
        // The primary key on wholesale_order_id
        // prevents duplicate deduction history.

        jdbc.update(
                """
                INSERT INTO
                    public.vehicle_order_stock_deductions
                (
                    wholesale_order_id,
                    assignment_id,
                    vehicle_id,
                    deducted_at
                )
                VALUES (?, ?, ?, NOW())
                """,
                orderId,
                assignmentId,
                vehicleId
        );
    }
}
