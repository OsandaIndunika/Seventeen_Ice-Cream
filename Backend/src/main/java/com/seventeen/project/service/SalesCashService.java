
package com.seventeen.project.service;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class SalesCashService {

    // ==========================================
    // BUSINESS TIMEZONE
    // ==========================================

    private static final ZoneId BUSINESS_ZONE =
            ZoneId.of("Asia/Colombo");

    // ==========================================
    // VALID CASH COLLECTION SOURCES
    // ==========================================

    private static final Set<String> SOURCE_TYPES =
            Set.of(
                    "WHOLESALE_ORDER",
                    "DIRECT_BILL"
            );

    private final JdbcTemplate jdbc;

    public SalesCashService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // 1. FIND LOGGED-IN SALES REPRESENTATIVE
    // ==========================================

    private long salesUserId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in as a Sales Representative"
            );
        }

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'SALES_MANAGER'
                  AND enabled = TRUE
                LIMIT 1
                """,
                (rs, rowNum) ->
                        rs.getLong("id"),
                email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Sales Representative account not found"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // 2. FIND CURRENTLY SELECTED VEHICLE
    // ==========================================

    private long selectedVehicleId(long salesUserId) {

        List<Long> vehicleIds = jdbc.query(
                """
                SELECT vehicle_id
                FROM public.vehicle_sales_sessions
                WHERE sales_representative_id = ?
                  AND ended_at IS NULL
                ORDER BY started_at DESC, id DESC
                LIMIT 2
                """,
                (rs, rowNum) ->
                        rs.getLong("vehicle_id"),
                salesUserId
        );

        if (vehicleIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Please select a delivery vehicle first"
            );
        }

        // Multiple active sessions should not occur.
        // Do not silently choose a vehicle if this
        // representative has conflicting sessions.

        if (vehicleIds.size() > 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Multiple active sales sessions found. " +
                    "Please resolve the duplicate sessions."
            );
        }

        return vehicleIds.get(0);
    }

    // ==========================================
    // 3. GET TODAY'S CASH
    // ==========================================
    //
    // Cash sources:
    //
    // 1. Confirmed wholesale CASH payments
    //    from wholesale_payment_records
    //
    // 2. Confirmed DIRECT_BILL payments
    //    from sales_cash_collections
    //
    // IMPORTANT:
    //
    // WHOLESALE_ORDER entries in
    // sales_cash_collections are excluded
    // because wholesale cash is already
    // counted from wholesale_payment_records.
    //
    // Bank transfers are excluded.
    // Cheques are excluded.
    // Unpaid credit is excluded.
    // Pending and voided receipts are excluded.
    //
    // Date boundaries use Asia/Colombo.
    // ==========================================

    @Transactional(readOnly = true)
    public BigDecimal getTodaysCash(String email) {

        // --------------------------------------
        // Identify Sales Representative
        // --------------------------------------

        long salesId = salesUserId(email);

        // --------------------------------------
        // Identify selected vehicle
        // --------------------------------------

        long vehicleId =
                selectedVehicleId(salesId);

        // --------------------------------------
        // Sri Lanka business date
        // --------------------------------------

        LocalDate today =
                LocalDate.now(BUSINESS_ZONE);

        OffsetDateTime start =
                today
                        .atStartOfDay(BUSINESS_ZONE)
                        .toOffsetDateTime();

        OffsetDateTime end =
                today
                        .plusDays(1)
                        .atStartOfDay(BUSINESS_ZONE)
                        .toOffsetDateTime();

        // --------------------------------------
        // Calculate confirmed cash
        // --------------------------------------
        //
        // DISTINCT CASH SOURCES:
        //
        // Wholesale cash:
        // wholesale_payment_records
        //
        // Direct-bill cash:
        // sales_cash_collections
        //
        // Use a single SQL statement so both
        // totals come from the same DB read.
        // --------------------------------------

        BigDecimal total = jdbc.queryForObject(
                """
                SELECT
                    COALESCE(
                        (
                            SELECT SUM(p.amount)
                            FROM public.wholesale_payment_records p
                            WHERE p.vehicle_id = ?
                              AND p.method = 'CASH'
                              AND p.status = 'CONFIRMED'
                              AND p.confirmed_at >= ?
                              AND p.confirmed_at < ?
                        ),
                        0
                    )
                    +
                    COALESCE(
                        (
                            SELECT SUM(c.amount)
                            FROM public.sales_cash_collections c
                            WHERE c.vehicle_id = ?
                              AND c.source_type = 'DIRECT_BILL'
                              AND c.status = 'CONFIRMED'
                              AND c.collected_at >= ?
                              AND c.collected_at < ?
                        ),
                        0
                    ) AS todays_cash
                """,
                BigDecimal.class,

                // Wholesale payments
                vehicleId,
                start,
                end,

                // Direct-bill collections
                vehicleId,
                start,
                end
        );

        return total == null
                ? BigDecimal.ZERO
                : total;
    }

    // ==========================================
    // 4. GET BUSINESS DATE
    // ==========================================

    public LocalDate getBusinessDate() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    // ==========================================
    // 5. SAVE CONFIRMED CASH COLLECTION
    // ==========================================
    //
    // Preserves your existing method signature.
    //
    // This method records a confirmed collection
    // in sales_cash_collections.
    //
    // DIRECT_BILL:
    // Included in Today's Cash.
    //
    // WHOLESALE_ORDER:
    // Can be recorded for compatibility with
    // existing calling code, but is NOT added
    // separately to Today's Cash.
    //
    // The actual wholesale cash payment must
    // be confirmed in wholesale_payment_records.
    //
    // Call this method only after cash is
    // physically received.
    // ==========================================

    @Transactional
    public void saveConfirmedCashCollection(
            UUID receiptKey,
            String email,
            String sourceType,
            long sourceId,
            BigDecimal amount
    ) {

        // ======================================
        // VALIDATE RECEIPT KEY
        // ======================================

        if (receiptKey == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Receipt key is required"
            );
        }

        // ======================================
        // VALIDATE SOURCE TYPE
        // ======================================

        if (
                sourceType == null ||
                !SOURCE_TYPES.contains(sourceType)
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid cash collection source"
            );
        }

        // ======================================
        // VALIDATE SOURCE ID
        // ======================================

        if (sourceId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid order or bill ID"
            );
        }

        // ======================================
        // VALIDATE AMOUNT
        // ======================================

        if (
                amount == null ||
                amount.signum() <= 0 ||
                amount.scale() > 2 ||
                amount.precision() - amount.scale() > 10
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cash amount must be positive and " +
                    "have at most two decimal places"
            );
        }

        // ======================================
        // IDENTIFY SALES REPRESENTATIVE
        // ======================================

        long salesId = salesUserId(email);

        // ======================================
        // GET SELECTED VEHICLE
        // ======================================

        long vehicleId =
                selectedVehicleId(salesId);

        // ======================================
        // WHOLESALE ORDER VEHICLE VALIDATION
        // ======================================

        if ("WHOLESALE_ORDER".equals(sourceType)) {

            Integer orderCount =
                    jdbc.queryForObject(
                            """
                            WITH latest_assignment AS (
                                SELECT vehicle_id
                                FROM public.vehicle_delivery_assignments
                                WHERE wholesale_order_id = ?
                                ORDER BY id DESC
                                LIMIT 1
                            )
                            SELECT COUNT(*)
                            FROM latest_assignment
                            WHERE vehicle_id = ?
                            """,
                            Integer.class,
                            sourceId,
                            vehicleId
                    );

            if (
                    orderCount == null ||
                    orderCount == 0
            ) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Wholesale order does not belong " +
                        "to the selected vehicle"
                );
            }
        }

        // ======================================
        // DIRECT BILL VALIDATION
        // ======================================
        //
        // The calling direct-bill finalization
        // service MUST already verify that:
        //
        // - The bill exists.
        // - The bill belongs to this vehicle.
        // - The representative is authorized.
        // - Cash was actually received.
        // - Stock is correctly deducted.
        // - The payment is not already finalized.
        //
        // We do not assume a direct-bill table
        // structure here, because your existing
        // database schema has not been supplied.
        //
        // ======================================

        // ======================================
        // INSERT CASH COLLECTION
        // ======================================
        //
        // receipt_key is UNIQUE.
        //
        // Same key + same receipt:
        // safe retry.
        //
        // Same key + different receipt:
        // conflict.
        //
        // ======================================

        int inserted = jdbc.update(
                """
                INSERT INTO public.sales_cash_collections
                (
                    receipt_key,
                    vehicle_id,
                    collected_by,
                    source_type,
                    source_id,
                    amount,
                    status,
                    collected_at
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'CONFIRMED',
                    NOW()
                )
                ON CONFLICT (receipt_key)
                DO NOTHING
                """,

                receiptKey,
                vehicleId,
                salesId,
                sourceType,
                sourceId,
                amount
        );

        // ======================================
        // CHECK DUPLICATE RECEIPT
        // ======================================

        if (inserted == 0) {

            List<Boolean> matches =
                    jdbc.query(
                            """
                            SELECT
                                (
                                    vehicle_id = ?
                                    AND collected_by = ?
                                    AND source_type = ?
                                    AND source_id = ?
                                    AND amount = ?
                                    AND status = 'CONFIRMED'
                                ) AS matching_receipt
                            FROM public.sales_cash_collections
                            WHERE receipt_key = ?
                            """,

                            (rs, rowNum) ->
                                    rs.getBoolean(
                                            "matching_receipt"
                                    ),

                            vehicleId,
                            salesId,
                            sourceType,
                            sourceId,
                            amount,
                            receiptKey
                    );

            if (
                    matches.isEmpty() ||
                    !Boolean.TRUE.equals(
                            matches.get(0)
                    )
            ) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Receipt key already belongs " +
                        "to a different or voided collection"
                );
            }

            // ==================================
            // IDEMPOTENT RETRY
            // ==================================
            //
            // Same receipt already exists.
            // Nothing is inserted again.
            // ==================================

            return;
        }
    }
}
