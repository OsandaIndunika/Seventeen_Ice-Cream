
package com.seventeen.project.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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

/**
 * Sales Manager dispatch from an active sales vehicle
 * to the sole active outlet's FREEZER_2.
 *
 * The Outlet Manager receives the transferred stock
 * separately.
 *
 * Supports:
 * - Dispatch by vehicleBatchStockId
 * - Dispatch by selected production batch number
 * - Existing and legacy aggregate vehicle stock
 * - Batch-specific quantity validation
 * - Aggregate stock validation
 * - Transactional stock deduction
 * - Idempotent transfer-note creation
 *
 * Production batch expiry dates are not used to
 * approve or reject outlet supply transfers.
 *
 * No production batch quality-status dependency.
 */
@Service
public class OutletSupplyService {

    private final JdbcTemplate jdbc;

    public OutletSupplyService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ============================================
    // REQUEST DTOs
    // ============================================

    public record DispatchLine(
            Long vehicleBatchStockId,
            Integer quantity
    ) {}

    public record CreateTransferRequest(
            UUID receiptKey,
            List<DispatchLine> items,
            String notes
    ) {}

    public record ManualDispatchLine(
            Long vehicleStockId,
            String batchNumber,
            Integer quantity
    ) {}

    public record ManualTransferRequest(
            UUID receiptKey,
            List<ManualDispatchLine> items,
            String notes
    ) {}

    // ============================================
    // ERROR HELPERS
    // ============================================

    private ResponseStatusException bad(String message) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }

    // ============================================
    // SALES MANAGER AUTHENTICATION
    // ============================================

    private long salesManagerId(String email) {

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
                  AND role = 'SALES_MANAGER'
                  AND enabled = TRUE
                """,
                Long.class,
                email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Sales Manager account required"
            );
        }

        return ids.get(0);
    }

    // ============================================
    // ACTIVE SALES VEHICLE
    //
    // UNCHANGED
    // ============================================

    private long activeVehicle(
            long managerId,
            boolean lock
    ) {

        String sql = """
                SELECT vehicle_id
                FROM public.vehicle_sales_sessions
                WHERE sales_representative_id = ?
                  AND ended_at IS NULL
                ORDER BY started_at DESC
                LIMIT 1
                """ + (lock ? " FOR UPDATE" : "");

        List<Long> vehicleIds = jdbc.queryForList(
                sql,
                Long.class,
                managerId
        );

        if (vehicleIds.isEmpty()) {
            throw conflict(
                    "Select your sales vehicle before using Outlet Supply"
            );
        }

        return vehicleIds.get(0);
    }

    // ============================================
    // SOLE ACTIVE OUTLET
    //
    // UNCHANGED
    // ============================================

    private long soleActiveOutlet() {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_locations
                WHERE active = TRUE
                ORDER BY id
                """,
                Long.class
        );

        if (ids.size() != 1) {
            throw conflict(
                    "Exactly one active outlet must be configured " +
                    "for automatic dispatch"
            );
        }

        return ids.get(0);
    }

    // ============================================
    // DESTINATION FREEZER
    //
    // UNCHANGED
    // ============================================

    private long receivingFreezer(long outletId) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_freezers
                WHERE outlet_id = ?
                  AND freezer_code = 'FREEZER_2'
                """,
                Long.class,
                outletId
        );

        if (ids.size() != 1) {
            throw conflict(
                    "The outlet must have exactly one FREEZER_2 configured"
            );
        }

        return ids.get(0);
    }

    // ============================================
    // CLEAN NOTES
    // ============================================

    private static String cleanNotes(String notes) {
        return notes == null ? "" : notes.trim();
    }

    // ============================================
    // VALIDATE BATCH-ID TRANSFER REQUEST
    //
    // UNCHANGED
    // ============================================

    private Map<Long, Integer> validateLines(
            CreateTransferRequest request
    ) {

        if (request == null || request.receiptKey() == null) {
            throw bad("receiptKey is required");
        }

        if (request.items() == null || request.items().isEmpty()) {
            throw bad(
                    "Add at least one batch to the transfer note"
            );
        }

        if (request.items().size() > 100) {
            throw bad(
                    "A transfer note may contain at most 100 batch lines"
            );
        }

        if (cleanNotes(request.notes()).length() > 1000) {
            throw bad("Notes cannot exceed 1000 characters");
        }

        Map<Long, Integer> lines = new LinkedHashMap<>();

        for (DispatchLine line : request.items()) {

            if (
                    line == null ||
                    line.vehicleBatchStockId() == null ||
                    line.vehicleBatchStockId() <= 0 ||
                    line.quantity() == null ||
                    line.quantity() <= 0
            ) {
                throw bad(
                        "Each item needs a valid vehicleBatchStockId " +
                        "and positive quantity"
                );
            }

            if (
                    lines.putIfAbsent(
                            line.vehicleBatchStockId(),
                            line.quantity()
                    ) != null
            ) {
                throw bad(
                        "A vehicle batch stock row appears more than once"
                );
            }
        }

        return lines;
    }

    // ============================================
    // AVAILABLE BATCHES
    //
    // UPDATED:
    // No expiry-date filtering.
    //
    // All batches with available lorry stock
    // can appear, regardless of expiry date.
    //
    // Existing response fields retained.
    // ============================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> availableBatches(
            String email
    ) {

        long managerId = salesManagerId(email);
        long vehicleId = activeVehicle(managerId, false);

        return jdbc.queryForList(
                """
                SELECT
                    vbs.id AS "vehicleBatchStockId",
                    s.id AS "vehicleStockId",
                    s.vehicle_id AS "vehicleId",
                    p.id AS "productId",
                    p.name AS "productName",
                    p.size AS "size",
                    s.flavour AS "flavour",
                    b.id AS "batchId",
                    b.batch_number AS "batchNumber",
                    b.manufactured_date AS "manufacturedDate",
                    b.expiry_date AS "expiryDate",

                    vbs.quantity AS "batchQuantity",

                    vbs.reserved_quantity
                        AS "batchReservedQuantity",

                    GREATEST(
                        0,
                        LEAST(
                            vbs.quantity - vbs.reserved_quantity,
                            s.quantity - s.reserved_quantity
                        )
                    ) AS "availableQuantity"

                FROM public.vehicle_batch_stock vbs

                JOIN public.vehicle_stock s
                    ON s.id = vbs.vehicle_stock_id

                JOIN public.wholesale_products p
                    ON p.id = s.product_id

                JOIN public.product_batches b
                    ON b.id = vbs.batch_id

                WHERE s.vehicle_id = ?

                  AND b.product_id = s.product_id

                  AND LOWER(TRIM(b.flavour))
                      = LOWER(TRIM(s.flavour))

                  AND vbs.quantity - vbs.reserved_quantity > 0

                  AND s.quantity - s.reserved_quantity > 0

                ORDER BY
                    b.expiry_date,
                    p.name,
                    p.size,
                    s.flavour,
                    b.batch_number
                """,
                vehicleId
        );
    }

    // ============================================
    // LOAD EXISTING TRANSFER ITEMS
    //
    // UNCHANGED
    // ============================================

    private List<Map<String, Object>> transferLines(
            long transferId
    ) {

        return jdbc.queryForList(
                """
                SELECT
                    i.id AS "itemId",
                    i.id AS "transferItemId",

                    i.source_batch_stock_id
                        AS "vehicleBatchStockId",

                    vbs.vehicle_stock_id
                        AS "vehicleStockId",

                    i.batch_id AS "batchId",
                    i.product_id AS "productId",
                    p.name AS "productName",
                    p.size AS "size",
                    i.flavour AS "flavour",
                    b.batch_number AS "batchNumber",
                    b.expiry_date AS "expiryDate",

                    i.dispatched_quantity
                        AS "dispatchedQuantity",

                    i.received_quantity
                        AS "receivedQuantity"

                FROM public.outlet_supply_transfer_items i

                JOIN public.product_batches b
                    ON b.id = i.batch_id

                LEFT JOIN public.vehicle_batch_stock vbs
                    ON vbs.id = i.source_batch_stock_id

                JOIN public.wholesale_products p
                    ON p.id = i.product_id

                WHERE i.transfer_id = ?

                ORDER BY i.id
                """,
                transferId
        );
    }

    // ============================================
    // TRANSFER DETAILS
    //
    // UNCHANGED
    // ============================================

    private Map<String, Object> transferDetail(
            long transferId
    ) {

        Map<String, Object> result =
                new LinkedHashMap<>(
                        jdbc.queryForMap(
                                """
                                SELECT
                                    t.id AS "id",
                                    t.transfer_number AS "transferNumber",
                                    t.receipt_key AS "receiptKey",
                                    t.source_type AS "sourceType",
                                    t.source_vehicle_id AS "vehicleId",
                                    t.outlet_id AS "outletId",
                                    o.outlet_name AS "outletName",

                                    t.destination_freezer_id
                                        AS "destinationFreezerId",

                                    t.issued_by_user_id
                                        AS "issuedByUserId",

                                    t.received_by_user_id
                                        AS "receivedByUserId",

                                    t.status AS "status",
                                    t.notes AS "notes",
                                    t.created_at AS "createdAt",
                                    t.dispatched_at AS "dispatchedAt",
                                    t.received_at AS "receivedAt"

                                FROM public.outlet_supply_transfers t

                                JOIN public.outlet_pos_locations o
                                    ON o.id = t.outlet_id

                                WHERE t.id = ?
                                """,
                                transferId
                        )
                );

        List<Map<String, Object>> items =
                transferLines(transferId);

        result.put("items", items);

        result.put(
                "totalUnits",
                items.stream()
                        .mapToInt(
                                item ->
                                        ((Number) item.get(
                                                "dispatchedQuantity"
                                        )).intValue()
                        )
                        .sum()
        );

        return result;
    }

    // ============================================
    // EXISTING TRANSFER ID
    //
    // UNCHANGED
    // ============================================

    private Long existingId(UUID receiptKey) {

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_supply_transfers
                WHERE receipt_key = ?
                """,
                Long.class,
                receiptKey
        );

        return ids.isEmpty() ? null : ids.get(0);
    }

    // ============================================
    // VERIFY IDEMPOTENT RETRY
    //
    // UNCHANGED
    // ============================================

    private void verifyRetry(
            Map<String, Object> saved,
            long managerId,
            long vehicleId,
            Map<Long, Integer> requested,
            String requestedNotes
    ) {

        if (
                ((Number) saved.get("issuedByUserId")).longValue()
                    != managerId ||

                ((Number) saved.get("vehicleId")).longValue()
                    != vehicleId ||

                !"SALES_VEHICLE".equals(saved.get("sourceType"))
        ) {
            throw conflict(
                    "This receipt key belongs to another sales dispatch"
            );
        }

        if (
                !cleanNotes(
                        (String) saved.get("notes")
                ).equals(requestedNotes)
        ) {
            throw conflict(
                    "Receipt key was already used for different transfer notes"
            );
        }

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> savedLines =
                (List<Map<String, Object>>) saved.get("items");

        if (savedLines.size() != requested.size()) {
            throw conflict(
                    "Receipt key was already used for different transfer items"
            );
        }

        for (Map<String, Object> item : savedLines) {

            Object rawId = item.get("vehicleBatchStockId");

            if (!(rawId instanceof Number)) {
                throw conflict(
                        "Existing transfer cannot be matched to this batch request"
                );
            }

            Long batchStockId =
                    ((Number) rawId).longValue();

            Integer requestedQty =
                    requested.get(batchStockId);

            if (
                    requestedQty == null ||
                    requestedQty.intValue() !=
                        ((Number) item.get("dispatchedQuantity")).intValue()
            ) {
                throw conflict(
                        "Receipt key was already used for different transfer items"
                );
            }
        }
    }

    // ============================================
    // CREATE TRANSFER USING BATCH STOCK IDs
    //
    // UPDATED:
    // Expiry-date validation removed.
    //
    // Existing stock validation, deductions
    // and transfer recording retained.
    // ============================================

    @Transactional
    public Map<String, Object> createTransfer(
            String email,
            CreateTransferRequest request
    ) {

        Map<Long, Integer> requested =
                validateLines(request);

        String notes = cleanNotes(request.notes());

        long managerId = salesManagerId(email);
        long vehicleId = activeVehicle(managerId, true);

        // ========================================
        // IDEMPOTENT RETRY
        // ========================================

        Long priorId = existingId(request.receiptKey());

        if (priorId != null) {

            Map<String, Object> saved =
                    transferDetail(priorId);

            verifyRetry(
                    saved,
                    managerId,
                    vehicleId,
                    requested,
                    notes
            );

            return saved;
        }

        // ========================================
        // DESTINATION
        // ========================================

        long outletId = soleActiveOutlet();
        long freezerId = receivingFreezer(outletId);

        List<Long> sortedIds =
                new ArrayList<>(requested.keySet());

        sortedIds.sort(Comparator.naturalOrder());

        List<Map<String, Object>> stockLines =
                new ArrayList<>();

        Set<Long> batchIds = new HashSet<>();

        Map<Long, Integer> aggregateDemand =
                new HashMap<>();

        // ========================================
        // VALIDATE SELECTED BATCHES
        // ========================================

        for (long batchStockId : sortedIds) {

            List<Map<String, Object>> rows =
                    jdbc.queryForList(
                            """
                            SELECT
                                vbs.id
                                    AS "vehicleBatchStockId",

                                vbs.quantity
                                    AS "batchQuantity",

                                vbs.reserved_quantity
                                    AS "batchReserved",

                                s.id
                                    AS "vehicleStockId",

                                s.quantity
                                    AS "stockQuantity",

                                s.reserved_quantity
                                    AS "stockReserved",

                                s.product_id
                                    AS "productId",

                                s.flavour
                                    AS "flavour",

                                b.id
                                    AS "batchId",

                                b.product_id
                                    AS "batchProductId",

                                b.flavour
                                    AS "batchFlavour"

                            FROM public.vehicle_batch_stock vbs

                            JOIN public.vehicle_stock s
                                ON s.id = vbs.vehicle_stock_id

                            JOIN public.product_batches b
                                ON b.id = vbs.batch_id

                            WHERE vbs.id = ?
                              AND s.vehicle_id = ?

                            FOR UPDATE OF s, vbs
                            """,
                            batchStockId,
                            vehicleId
                    );

            if (rows.isEmpty()) {
                throw bad(
                        "Selected batch is not on your active vehicle: " +
                        batchStockId
                );
            }

            Map<String, Object> row = rows.get(0);

            int quantity = requested.get(batchStockId);

            long batchId =
                    ((Number) row.get("batchId")).longValue();

            long vehicleStockId =
                    ((Number) row.get("vehicleStockId")).longValue();

            if (!batchIds.add(batchId)) {
                throw bad(
                        "The same production batch cannot appear twice " +
                        "in one transfer"
                );
            }

            // ====================================
            // PRODUCT / FLAVOUR MATCH
            //
            // UNCHANGED
            // ====================================

            if (
                    !String.valueOf(row.get("productId")).equals(
                            String.valueOf(row.get("batchProductId"))
                    ) ||

                    !String.valueOf(row.get("flavour"))
                            .trim()
                            .equalsIgnoreCase(
                                    String.valueOf(row.get("batchFlavour"))
                                            .trim()
                            )
            ) {
                throw conflict(
                        "Product/batch mismatch in vehicle inventory"
                );
            }

            // ====================================
            // NO EXPIRY-DATE VALIDATION
            //
            // The selected batch is validated
            // using product identity and stock.
            // ====================================

            // ====================================
            // BATCH STOCK VALIDATION
            // ====================================

            int batchAvailable =
                    ((Number) row.get("batchQuantity")).intValue() -
                    ((Number) row.get("batchReserved")).intValue();

            if (quantity > batchAvailable) {
                throw conflict(
                        "Insufficient available quantity in batch " +
                        batchId
                );
            }

            aggregateDemand.merge(
                    vehicleStockId,
                    quantity,
                    Integer::sum
            );

            stockLines.add(row);
        }

        // ========================================
        // AGGREGATE STOCK VALIDATION
        //
        // UNCHANGED
        // ========================================

        for (Map<String, Object> row : stockLines) {

            long stockId =
                    ((Number) row.get("vehicleStockId")).longValue();

            int available =
                    ((Number) row.get("stockQuantity")).intValue() -
                    ((Number) row.get("stockReserved")).intValue();

            if (aggregateDemand.get(stockId) > available) {
                throw conflict(
                        "Insufficient total lorry stock for product " +
                        row.get("productId") +
                        " / " +
                        row.get("flavour")
                );
            }
        }

        // ========================================
        // CREATE TRANSFER
        //
        // UNCHANGED
        // ========================================

        String transferNumber =
                "STN-" +
                UUID.randomUUID()
                        .toString()
                        .replace("-", "")
                        .toUpperCase(Locale.ROOT);

        Long transferId = jdbc.queryForObject(
                """
                INSERT INTO public.outlet_supply_transfers (
                    transfer_number,
                    receipt_key,
                    source_type,
                    source_vehicle_id,
                    outlet_id,
                    destination_freezer_id,
                    issued_by_user_id,
                    status,
                    notes,
                    dispatched_at
                )
                VALUES (
                    ?, ?, 'SALES_VEHICLE',
                    ?, ?, ?, ?,
                    'IN_TRANSIT', ?, CURRENT_TIMESTAMP
                )
                RETURNING id
                """,
                Long.class,
                transferNumber,
                request.receiptKey(),
                vehicleId,
                outletId,
                freezerId,
                managerId,
                notes
        );

        if (transferId == null) {
            throw conflict(
                    "Unable to create the transfer note"
            );
        }

        // ========================================
        // DEDUCT BATCH STOCK
        //
        // UNCHANGED
        // ========================================

        for (int index = 0; index < sortedIds.size(); index++) {

            long batchStockId = sortedIds.get(index);
            int quantity = requested.get(batchStockId);

            Map<String, Object> row = stockLines.get(index);

            int changed = jdbc.update(
                    """
                    UPDATE public.vehicle_batch_stock
                    SET quantity = quantity - ?
                    WHERE id = ?
                      AND quantity - reserved_quantity >= ?
                    """,
                    quantity,
                    batchStockId,
                    quantity
            );

            if (changed != 1) {
                throw conflict(
                        "Batch stock changed while preparing dispatch"
                );
            }

            jdbc.update(
                    """
                    INSERT INTO public.outlet_supply_transfer_items (
                        transfer_id,
                        batch_id,
                        product_id,
                        flavour,
                        source_batch_stock_id,
                        dispatched_quantity
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    transferId,
                    row.get("batchId"),
                    row.get("productId"),
                    row.get("flavour"),
                    batchStockId,
                    quantity
            );
        }

        // ========================================
        // DEDUCT AGGREGATE STOCK
        //
        // UNCHANGED
        // ========================================

        for (Map.Entry<Long, Integer> entry :
                aggregateDemand.entrySet()) {

            int changed = jdbc.update(
                    """
                    UPDATE public.vehicle_stock
                    SET quantity = quantity - ?
                    WHERE id = ?
                      AND vehicle_id = ?
                      AND quantity - reserved_quantity >= ?
                    """,
                    entry.getValue(),
                    entry.getKey(),
                    vehicleId,
                    entry.getValue()
            );

            if (changed != 1) {
                throw conflict(
                        "Aggregate lorry stock changed during dispatch"
                );
            }
        }

        return transferDetail(transferId);
    }

    // ============================================
    // TRANSFER HISTORY
    //
    // UNCHANGED
    // ============================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTransfers(
            String email
    ) {

        long managerId = salesManagerId(email);
        long vehicleId = activeVehicle(managerId, false);

        return jdbc.queryForList(
                """
                SELECT
                    t.id AS "id",
                    t.transfer_number AS "transferNumber",
                    t.status AS "status",
                    t.outlet_id AS "outletId",
                    o.outlet_name AS "outletName",
                    t.source_vehicle_id AS "vehicleId",
                    t.notes AS "notes",
                    t.created_at AS "createdAt",
                    t.dispatched_at AS "dispatchedAt",
                    t.received_at AS "receivedAt",

                    COALESCE(
                        SUM(i.dispatched_quantity),
                        0
                    ) AS "totalUnits"

                FROM public.outlet_supply_transfers t

                JOIN public.outlet_pos_locations o
                    ON o.id = t.outlet_id

                LEFT JOIN public.outlet_supply_transfer_items i
                    ON i.transfer_id = t.id

                WHERE t.source_type = 'SALES_VEHICLE'
                  AND t.source_vehicle_id = ?
                  AND t.issued_by_user_id = ?

                GROUP BY t.id, o.outlet_name

                ORDER BY
                    t.created_at DESC,
                    t.id DESC

                LIMIT 100
                """,
                vehicleId,
                managerId
        );
    }

    // ============================================
    // AVAILABLE PRODUCTS
    //
    // UNCHANGED
    // ============================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> availableProducts(
            String email
    ) {

        long vehicleId = activeVehicle(
                salesManagerId(email),
                false
        );

        return jdbc.queryForList(
                """
                SELECT
                    s.id AS "vehicleStockId",
                    s.product_id AS "productId",
                    p.name AS "productName",
                    p.size AS "size",
                    s.flavour AS "flavour",

                    GREATEST(
                        0,
                        s.quantity - s.reserved_quantity
                    ) AS "availableQuantity"

                FROM public.vehicle_stock s

                JOIN public.wholesale_products p
                    ON p.id = s.product_id

                WHERE s.vehicle_id = ?
                  AND s.quantity - s.reserved_quantity > 0

                ORDER BY
                    p.name,
                    p.size,
                    s.flavour,
                    s.id
                """,
                vehicleId
        );
    }

    // ============================================
    // CREATE MANUAL TRANSFER
    //
    // UPDATED:
    //
    // 1. Find registered batch.
    // 2. Find matching lorry batch allocation.
    // 3. Check selected batch quantity.
    // 4. Check aggregate stock quantity.
    // 5. Save transfer and deduct both stocks.
    //
    // No expiry-date lookup or validation.
    //
    // Other batch allocations are not required
    // to exactly equal aggregate stock before
    // a valid selected batch can be dispatched.
    //
    // If batch allocations exist, the selected
    // batch MUST belong to this lorry.
    //
    // Existing legacy aggregate-only behavior
    // is preserved.
    // ============================================

    @Transactional
    public Map<String, Object> createManualTransfer(
            String email,
            ManualTransferRequest request
    ) {

        // ========================================
        // VALIDATE REQUEST
        //
        // UNCHANGED
        // ========================================

        if (
                request == null ||
                request.receiptKey() == null ||
                request.items() == null ||
                request.items().isEmpty() ||
                request.items().size() > 100
        ) {
            throw bad(
                    "Receipt key and 1-100 transfer items are required"
            );
        }

        String notes = cleanNotes(request.notes());

        if (notes.length() > 1000) {
            throw bad("Notes cannot exceed 1000 characters");
        }

        // ========================================
        // NORMALIZE LINES
        //
        // UNCHANGED
        // ========================================

        record ManualKey(
                long stockId,
                String batchNumber
        ) {}

        Map<ManualKey, Integer> lines =
                new LinkedHashMap<>();

        for (ManualDispatchLine line : request.items()) {

            if (
                    line == null ||
                    line.vehicleStockId() == null ||
                    line.vehicleStockId() <= 0 ||
                    line.batchNumber() == null ||
                    line.batchNumber().trim().isEmpty() ||
                    line.batchNumber().trim().length() > 100 ||
                    line.quantity() == null ||
                    line.quantity() <= 0
            ) {
                throw bad(
                        "Each line needs a vehicle stock ID, " +
                        "batch number and positive quantity"
                );
            }

            ManualKey key = new ManualKey(
                    line.vehicleStockId(),
                    line.batchNumber()
                            .trim()
                            .toUpperCase(Locale.ROOT)
            );

            if (
                    lines.putIfAbsent(
                            key,
                            line.quantity()
                    ) != null
            ) {
                throw bad(
                        "The same stock row and batch number " +
                        "were entered twice"
                );
            }
        }

        // ========================================
        // ACTIVE MANAGER / VEHICLE
        //
        // UNCHANGED
        // ========================================

        long manager = salesManagerId(email);
        long vehicle = activeVehicle(manager, true);

        // ========================================
        // IDEMPOTENT RETRY
        //
        // UNCHANGED
        // ========================================

        Long previous = existingId(request.receiptKey());

        if (previous != null) {

            Map<String, Object> prior =
                    transferDetail(previous);

            if (
                    ((Number) prior.get("issuedByUserId")).longValue()
                        != manager ||

                    ((Number) prior.get("vehicleId")).longValue()
                        != vehicle ||

                    !"SALES_VEHICLE".equals(prior.get("sourceType")) ||

                    !notes.equals(
                            cleanNotes((String) prior.get("notes"))
                    )
            ) {
                throw conflict(
                        "Receipt key belongs to another dispatch"
                );
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> priorItems =
                    (List<Map<String, Object>>) prior.get("items");

            if (priorItems.size() != lines.size()) {
                throw conflict(
                        "Receipt key was used for different items"
                );
            }

            Map<ManualKey, Integer> savedLines =
                    new LinkedHashMap<>();

            for (Map<String, Object> item : priorItems) {

                String savedBatch =
                        String.valueOf(item.get("batchNumber"));

                Object stockId = item.get("vehicleStockId");

                // Legacy aggregate stock can have
                // no source batch stock ID.

                if (stockId == null) {

                    List<Long> matching = jdbc.queryForList(
                            """
                            SELECT id
                            FROM public.vehicle_stock
                            WHERE vehicle_id = ?
                              AND product_id = ?
                              AND flavour = ?
                            """,
                            Long.class,
                            vehicle,
                            item.get("productId"),
                            item.get("flavour")
                    );

                    if (matching.size() != 1) {
                        throw conflict(
                                "Cannot reconcile previous manual dispatch"
                        );
                    }

                    stockId = matching.get(0);
                }

                savedLines.put(
                        new ManualKey(
                                ((Number) stockId).longValue(),
                                savedBatch.trim()
                                        .toUpperCase(Locale.ROOT)
                        ),
                        ((Number) item.get(
                                "dispatchedQuantity"
                        )).intValue()
                );
            }

            if (!savedLines.equals(lines)) {
                throw conflict(
                        "Receipt key was used for different items"
                );
            }

            return prior;
        }

        // ========================================
        // DESTINATION
        //
        // UNCHANGED
        // ========================================

        long outlet = soleActiveOutlet();
        long freezer = receivingFreezer(outlet);

        // ========================================
        // AGGREGATE STOCK DEMAND
        //
        // UNCHANGED
        // ========================================

        Map<Long, Integer> required =
                new LinkedHashMap<>();

        for (var entry : lines.entrySet()) {

            try {
                required.merge(
                        entry.getKey().stockId(),
                        entry.getValue(),
                        Math::addExact
                );

            } catch (ArithmeticException ex) {
                throw bad(
                        "Total dispatch quantity is too large"
                );
            }
        }

        // ========================================
        // LOCK AGGREGATE STOCK
        //
        // UNCHANGED
        // ========================================

        List<Long> stockIds =
                new ArrayList<>(required.keySet());

        stockIds.sort(Long::compareTo);

        Map<Long, Map<String, Object>> stockRows =
                new LinkedHashMap<>();

        for (long stockId : stockIds) {

            List<Map<String, Object>> rows =
                    jdbc.queryForList(
                            """
                            SELECT
                                id,
                                product_id AS "productId",
                                flavour,
                                quantity,

                                reserved_quantity
                                    AS "reservedQuantity"

                            FROM public.vehicle_stock

                            WHERE id = ?
                              AND vehicle_id = ?

                            FOR UPDATE
                            """,
                            stockId,
                            vehicle
                    );

            if (rows.isEmpty()) {
                throw bad(
                        "Product does not belong to your selected lorry"
                );
            }

            Map<String, Object> row = rows.get(0);

            int available =
                    ((Number) row.get("quantity")).intValue() -
                    ((Number) row.get("reservedQuantity")).intValue();

            if (required.get(stockId) > available) {
                throw conflict(
                        "Not enough lorry stock for product " +
                        row.get("productId") +
                        ". Available: " + available
                );
            }

            stockRows.put(stockId, row);
        }

        // ========================================
        // RESOLVE EACH BATCH
        //
        // UNCHANGED EXCEPT EXPIRY VALIDATION
        // ========================================

        record Resolved(
                long stockId,
                long batchId,
                Long sourceBatchStockId,
                String productId,
                String flavour,
                int quantity
        ) {}

        List<Resolved> resolved =
                new ArrayList<>();

        Set<Long> usedBatchIds =
                new HashSet<>();

        for (var entry : lines.entrySet()) {

            ManualKey key = entry.getKey();

            int qty = entry.getValue();

            Map<String, Object> stock =
                    stockRows.get(key.stockId());

            // ====================================
            // FIND REGISTERED PRODUCTION BATCH
            //
            // UPDATED:
            // Only the registered batch ID is
            // needed for this transfer.
            //
            // Match by:
            // - Product ID
            // - Flavour
            // - Batch number
            //
            // Different products may share a
            // batch number such as "055".
            // ====================================

            List<Map<String, Object>> matches =
                    jdbc.queryForList(
                            """
                            SELECT id

                            FROM public.product_batches

                            WHERE product_id = ?

                              AND LOWER(TRIM(flavour))
                                  = LOWER(TRIM(?))

                              AND LOWER(TRIM(batch_number))
                                  = LOWER(TRIM(?))

                            FOR UPDATE
                            """,
                            stock.get("productId"),
                            stock.get("flavour"),
                            key.batchNumber()
                    );

            if (matches.size() != 1) {
                throw conflict(
                        "Batch '" + key.batchNumber() +
                        "' is not uniquely registered for this " +
                        "product and flavour. Check Batch Management."
                );
            }

            Map<String, Object> batch = matches.get(0);

            long batchId =
                    ((Number) batch.get("id")).longValue();

            if (!usedBatchIds.add(batchId)) {
                throw bad(
                        "Duplicate production batch in transfer"
                );
            }

            // ====================================
            // EXPIRY-DATE CHECK REMOVED
            //
            // Continue directly to the actual
            // lorry batch allocation lookup.
            // ====================================

            // ====================================
            // FIND LORRY BATCH ALLOCATIONS
            //
            // UNCHANGED
            // ====================================

            List<Map<String, Object>> allocations =
                    jdbc.queryForList(
                            """
                            SELECT
                                id,
                                batch_id AS "batchId",
                                quantity,

                                reserved_quantity
                                    AS "reservedQuantity"

                            FROM public.vehicle_batch_stock

                            WHERE vehicle_stock_id = ?

                            ORDER BY id
                            FOR UPDATE
                            """,
                            key.stockId()
                    );

            Long sourceId = null;

            if (!allocations.isEmpty()) {

                for (Map<String, Object> allocation : allocations) {

                    long allocatedBatchId =
                            ((Number) allocation.get(
                                    "batchId"
                            )).longValue();

                    if (allocatedBatchId != batchId) {
                        continue;
                    }

                    if (sourceId != null) {
                        throw conflict(
                                "Duplicate allocation exists for batch '" +
                                key.batchNumber() + "'"
                        );
                    }

                    sourceId =
                            ((Number) allocation.get("id")).longValue();

                    int batchAvailable =
                            ((Number) allocation.get(
                                    "quantity"
                            )).intValue() -

                            ((Number) allocation.get(
                                    "reservedQuantity"
                            )).intValue();

                    if (qty > batchAvailable) {
                        throw conflict(
                                "Not enough available stock in batch '" +
                                key.batchNumber() + "'. Available: " +
                                batchAvailable +
                                ", requested: " + qty
                        );
                    }
                }

                if (sourceId == null) {
                    throw conflict(
                            "Batch '" + key.batchNumber() +
                            "' is registered but is not allocated " +
                            "to the selected lorry."
                    );
                }
            }

            // Legacy behavior:
            //
            // If this lorry product has no batch
            // allocations, use the validated
            // aggregate stock.
            //
            // If allocations exist, sourceId is
            // mandatory and its stock is deducted.

            resolved.add(
                    new Resolved(
                            key.stockId(),
                            batchId,
                            sourceId,
                            String.valueOf(
                                    stock.get("productId")
                            ),
                            String.valueOf(
                                    stock.get("flavour")
                            ),
                            qty
                    )
            );
        }

        // ========================================
        // GENERATE TRANSFER NUMBER
        //
        // UNCHANGED
        // ========================================

        String number =
                "STN-" +
                UUID.randomUUID()
                        .toString()
                        .replace("-", "")
                        .toUpperCase(Locale.ROOT);

        // ========================================
        // SAVE TRANSFER HEADER
        //
        // UNCHANGED
        // ========================================

        Long transferId = jdbc.queryForObject(
                """
                INSERT INTO public.outlet_supply_transfers (
                    transfer_number,
                    receipt_key,
                    source_type,
                    source_vehicle_id,
                    outlet_id,
                    destination_freezer_id,
                    issued_by_user_id,
                    status,
                    notes,
                    dispatched_at
                )
                VALUES (
                    ?, ?,
                    'SALES_VEHICLE',
                    ?, ?, ?, ?,
                    'IN_TRANSIT',
                    ?,
                    CURRENT_TIMESTAMP
                )
                RETURNING id
                """,
                Long.class,
                number,
                request.receiptKey(),
                vehicle,
                outlet,
                freezer,
                manager,
                notes
        );

        if (transferId == null) {
            throw conflict(
                    "Cannot create transfer"
            );
        }

        // ========================================
        // DEDUCT SELECTED BATCH STOCK
        //
        // UNCHANGED
        // ========================================

        for (Resolved line : resolved) {

            if (line.sourceBatchStockId() != null) {

                int changed = jdbc.update(
                        """
                        UPDATE public.vehicle_batch_stock
                        SET quantity = quantity - ?
                        WHERE id = ?
                          AND quantity - reserved_quantity >= ?
                        """,
                        line.quantity(),
                        line.sourceBatchStockId(),
                        line.quantity()
                );

                if (changed != 1) {
                    throw conflict(
                            "Selected batch stock changed during dispatch"
                    );
                }
            }

            jdbc.update(
                    """
                    INSERT INTO public.outlet_supply_transfer_items (
                        transfer_id,
                        batch_id,
                        product_id,
                        flavour,
                        source_batch_stock_id,
                        dispatched_quantity
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    transferId,
                    line.batchId(),
                    line.productId(),
                    line.flavour(),
                    line.sourceBatchStockId(),
                    line.quantity()
            );
        }

        // ========================================
        // DEDUCT AGGREGATE LORRY STOCK
        //
        // UNCHANGED
        // ========================================

        for (var entry : required.entrySet()) {

            int changed = jdbc.update(
                    """
                    UPDATE public.vehicle_stock
                    SET quantity = quantity - ?
                    WHERE id = ?
                      AND vehicle_id = ?
                      AND quantity - reserved_quantity >= ?
                    """,
                    entry.getValue(),
                    entry.getKey(),
                    vehicle,
                    entry.getValue()
            );

            if (changed != 1) {
                throw conflict(
                        "Lorry stock changed during dispatch"
                );
            }
        }

        return transferDetail(transferId);
    }
}
