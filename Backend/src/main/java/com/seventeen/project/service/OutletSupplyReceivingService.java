
package com.seventeen.project.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OutletSupplyReceivingService {

    private final JdbcTemplate jdbc;

    public OutletSupplyReceivingService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ============================================
    // REQUEST DTOs - UNCHANGED
    // ============================================

    public record ReceiveLine(
        Long transferItemId,
        Integer receivedQuantity
    ) {}

    public record ReceiveRequest(
        List<ReceiveLine> items
    ) {}

    private ResponseStatusException fail(
        HttpStatus status,
        String message
    ) {
        return new ResponseStatusException(
            status,
            message
        );
    }

    // ============================================
    // AUTHENTICATED OUTLET MANAGER
    // ============================================

    private long outletManagerId(String email) {

        if (email == null || email.isBlank()) {
            throw fail(
                HttpStatus.UNAUTHORIZED,
                "Outlet Manager login required"
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
            throw fail(
                HttpStatus.FORBIDDEN,
                "Active Outlet Manager account required"
            );
        }

        return ids.get(0);
    }

    // ============================================
    // RECEIVE TRANSFER
    //
    // Uses the actual database relationship:
    //
    // outlet_pos_freezers
    //       |
    //       v
    // outlet_pos_stock
    //       |
    //       v
    // outlet_freezer_batch_stock
    //
    // Both stock quantities are increased
    // within the same transaction.
    // ============================================

    @Transactional
    public Map<String, Object> receiveTransfer(
        String email,
        long transferId,
        ReceiveRequest request
    ) {

        if (transferId <= 0) {
            throw fail(
                HttpStatus.BAD_REQUEST,
                "Invalid transfer ID"
            );
        }

        if (
            request == null ||
            request.items() == null ||
            request.items().isEmpty()
        ) {
            throw fail(
                HttpStatus.BAD_REQUEST,
                "Enter received quantities for all transfer items"
            );
        }

        long managerId = outletManagerId(email);

        // ========================================
        // VALIDATE RECEIVED QUANTITIES
        // ========================================

        Map<Long, Integer> received =
            new HashMap<>();

        for (ReceiveLine line : request.items()) {

            if (
                line == null ||
                line.transferItemId() == null ||
                line.transferItemId() <= 0 ||
                line.receivedQuantity() == null ||
                line.receivedQuantity() < 0
            ) {
                throw fail(
                    HttpStatus.BAD_REQUEST,
                    "Invalid transfer item or received quantity"
                );
            }

            if (
                received.putIfAbsent(
                    line.transferItemId(),
                    line.receivedQuantity()
                ) != null
            ) {
                throw fail(
                    HttpStatus.BAD_REQUEST,
                    "Duplicate transfer item in receipt"
                );
            }
        }

        // ========================================
        // LOCK TRANSFER HEADER
        // ========================================

        List<Map<String, Object>> transfers =
            jdbc.queryForList(
                """
                SELECT
                    t.id,
                    t.transfer_number
                        AS "transferNumber",
                    t.status,
                    t.outlet_id
                        AS "outletId",
                    t.destination_freezer_id
                        AS "freezerId",
                    t.source_type
                        AS "sourceType"

                FROM public.outlet_supply_transfers t

                JOIN public.outlet_pos_locations o
                  ON o.id = t.outlet_id

                JOIN public.outlet_pos_freezers f
                  ON f.id = t.destination_freezer_id
                 AND f.outlet_id = t.outlet_id

                WHERE t.id = ?
                  AND t.source_type = 'SALES_VEHICLE'
                  AND o.active = TRUE
                  AND f.freezer_code = 'FREEZER_2'

                FOR UPDATE OF t
                """,
                transferId
            );

        if (transfers.isEmpty()) {
            throw fail(
                HttpStatus.NOT_FOUND,
                "Transfer not found for active outlet's Defreezer 2"
            );
        }

        Map<String, Object> transfer =
            transfers.get(0);

        long freezerId =
            ((Number) transfer.get(
                "freezerId"
            )).longValue();

        String status =
            String.valueOf(
                transfer.get("status")
            );

        // ========================================
        // LOAD TRANSFER ITEMS
        // ========================================

        List<Map<String, Object>> items =
            jdbc.queryForList(
                """
                SELECT
                    i.id AS "itemId",
                    i.batch_id AS "batchId",
                    i.product_id AS "productId",
                    i.flavour AS "flavour",

                    i.dispatched_quantity
                        AS "dispatchedQuantity",

                    i.received_quantity
                        AS "receivedQuantity",

                    b.batch_number
                        AS "batchNumber"

                FROM public.outlet_supply_transfer_items i

                JOIN public.product_batches b
                  ON b.id = i.batch_id

                WHERE i.transfer_id = ?

                ORDER BY i.id

                FOR UPDATE OF i
                """,
                transferId
            );

        if (items.isEmpty()) {
            throw fail(
                HttpStatus.CONFLICT,
                "Transfer has no products"
            );
        }

        // ========================================
        // VALIDATE PHYSICAL RECEIPT
        // ========================================

        Set<Long> actualIds =
            new HashSet<>();

        int totalReceived = 0;

        for (Map<String, Object> item : items) {

            long itemId =
                ((Number) item.get(
                    "itemId"
                )).longValue();

            actualIds.add(itemId);

            Integer count =
                received.get(itemId);

            if (count == null) {
                throw fail(
                    HttpStatus.BAD_REQUEST,
                    "A received quantity is missing for item " + itemId
                );
            }

            int dispatched =
                ((Number) item.get(
                    "dispatchedQuantity"
                )).intValue();

            // Keep existing full-receipt rule.

            if (count != dispatched) {
                throw fail(
                    HttpStatus.CONFLICT,
                    "Received quantity differs from dispatched " +
                    "quantity for batch " +
                    item.get("batchNumber") +
                    ". Review the discrepancy before accepting."
                );
            }

            try {
                totalReceived =
                    Math.addExact(
                        totalReceived,
                        count
                    );
            } catch (ArithmeticException ex) {
                throw fail(
                    HttpStatus.BAD_REQUEST,
                    "Total received quantity is too large"
                );
            }
        }

        if (!actualIds.equals(received.keySet())) {
            throw fail(
                HttpStatus.BAD_REQUEST,
                "Receipt contains items not belonging to this transfer"
            );
        }

        // ========================================
        // IDEMPOTENCY
        //
        // Already-received transfers must
        // never add stock a second time.
        // ========================================

        if ("RECEIVED".equalsIgnoreCase(status)) {

            for (Map<String, Object> item : items) {

                int saved =
                    item.get("receivedQuantity") == null
                        ? 0
                        : ((Number) item.get(
                            "receivedQuantity"
                        )).intValue();

                long itemId =
                    ((Number) item.get(
                        "itemId"
                    )).longValue();

                if (
                    saved != received.get(itemId)
                ) {
                    throw fail(
                        HttpStatus.CONFLICT,
                        "Transfer was already received with different quantities"
                    );
                }
            }

            Map<String, Object> result =
                new LinkedHashMap<>();

            result.put(
                "transferId",
                transferId
            );

            result.put(
                "transferNumber",
                transfer.get("transferNumber")
            );

            result.put(
                "status",
                "RECEIVED"
            );

            result.put(
                "freezerId",
                freezerId
            );

            result.put(
                "totalReceivedUnits",
                totalReceived
            );

            result.put(
                "alreadyReceived",
                true
            );

            return result;
        }

        if (!"IN_TRANSIT".equalsIgnoreCase(status)) {
            throw fail(
                HttpStatus.CONFLICT,
                "Only IN_TRANSIT transfers can be received"
            );
        }

        // ========================================
        // LOCK DESTINATION FREEZER
        //
        // Serialize receiving operations for
        // this freezer to avoid creating
        // duplicate stock rows.
        // ========================================

        List<Long> freezerLocks =
            jdbc.queryForList(
                """
                SELECT id
                FROM public.outlet_pos_freezers
                WHERE id = ?
                  AND freezer_code = 'FREEZER_2'
                FOR UPDATE
                """,
                Long.class,
                freezerId
            );

        if (freezerLocks.size() != 1) {
            throw fail(
                HttpStatus.CONFLICT,
                "Destination Defreezer 2 is unavailable"
            );
        }

        // ========================================
        // CREDIT DEFREEZER 2
        //
        // STEP 1:
        // Find or create aggregate stock in
        // public.outlet_pos_stock.
        //
        // STEP 2:
        // Increase aggregate quantity.
        //
        // STEP 3:
        // Find or create corresponding batch
        // in outlet_freezer_batch_stock.
        //
        // STEP 4:
        // Increase selected batch quantity.
        //
        // No freezer_id or reserved_quantity
        // references in the batch-stock table.
        // ========================================

        for (Map<String, Object> item : items) {

            long itemId =
                ((Number) item.get(
                    "itemId"
                )).longValue();

            long batchId =
                ((Number) item.get(
                    "batchId"
                )).longValue();

            String productId =
                String.valueOf(
                    item.get("productId")
                );

            String flavour =
                String.valueOf(
                    item.get("flavour")
                );

            int count =
                received.get(itemId);

            // ====================================
            // FIND AGGREGATE FREEZER STOCK
            // ====================================

            List<Long> stockIds =
                jdbc.queryForList(
                    """
                    SELECT id
                    FROM public.outlet_pos_stock
                    WHERE freezer_id = ?
                      AND product_id = ?
                      AND LOWER(TRIM(flavour))
                          = LOWER(TRIM(?))
                    FOR UPDATE
                    """,
                    Long.class,
                    freezerId,
                    productId,
                    flavour
                );

            if (stockIds.size() > 1) {
                throw fail(
                    HttpStatus.CONFLICT,
                    "Duplicate freezer stock rows exist for " +
                    productId + " / " + flavour
                );
            }

            long freezerStockId;

            if (stockIds.isEmpty()) {

                // Create aggregate stock using
                // the actual existing columns.

                Long insertedId =
                    jdbc.queryForObject(
                        """
                        INSERT INTO public.outlet_pos_stock (
                            freezer_id,
                            product_id,
                            flavour,
                            quantity,
                            updated_at
                        )
                        VALUES (?, ?, ?, 0, NOW())
                        RETURNING id
                        """,
                        Long.class,
                        freezerId,
                        productId,
                        flavour
                    );

                if (insertedId == null) {
                    throw fail(
                        HttpStatus.CONFLICT,
                        "Unable to create freezer stock"
                    );
                }

                freezerStockId = insertedId;

            } else {
                freezerStockId =
                    stockIds.get(0);
            }

            // ====================================
            // INCREASE AGGREGATE STOCK
            // ====================================

            int aggregateUpdated =
                jdbc.update(
                    """
                    UPDATE public.outlet_pos_stock
                    SET quantity = quantity + ?,
                        updated_at = NOW()
                    WHERE id = ?
                      AND freezer_id = ?
                    """,
                    count,
                    freezerStockId,
                    freezerId
                );

            if (aggregateUpdated != 1) {
                throw fail(
                    HttpStatus.CONFLICT,
                    "Unable to update Defreezer 2 product stock"
                );
            }

            // ====================================
            // FIND EXACT BATCH STOCK
            //
            // Actual schema:
            // freezer_stock_id
            // batch_id
            // quantity
            // updated_at
            // ====================================

            List<Long> batchStockIds =
                jdbc.queryForList(
                    """
                    SELECT id
                    FROM public.outlet_freezer_batch_stock
                    WHERE freezer_stock_id = ?
                      AND batch_id = ?
                    FOR UPDATE
                    """,
                    Long.class,
                    freezerStockId,
                    batchId
                );

            if (batchStockIds.size() > 1) {
                throw fail(
                    HttpStatus.CONFLICT,
                    "Duplicate batch-stock rows exist for batch " +
                    item.get("batchNumber")
                );
            }

            if (batchStockIds.isEmpty()) {

                // Create batch-specific stock.

                jdbc.update(
                    """
                    INSERT INTO public.outlet_freezer_batch_stock (
                        freezer_stock_id,
                        batch_id,
                        quantity,
                        updated_at
                    )
                    VALUES (?, ?, ?, NOW())
                    """,
                    freezerStockId,
                    batchId,
                    count
                );

            } else {

                // Increase already-recorded batch.

                int batchUpdated =
                    jdbc.update(
                        """
                        UPDATE public.outlet_freezer_batch_stock
                        SET quantity = quantity + ?,
                            updated_at = NOW()
                        WHERE id = ?
                          AND freezer_stock_id = ?
                          AND batch_id = ?
                        """,
                        count,
                        batchStockIds.get(0),
                        freezerStockId,
                        batchId
                    );

                if (batchUpdated != 1) {
                    throw fail(
                        HttpStatus.CONFLICT,
                        "Unable to update batch-specific stock"
                    );
                }
            }

            // ====================================
            // SAVE RECEIVED QUANTITY
            // ====================================

            int itemUpdated =
                jdbc.update(
                    """
                    UPDATE public.outlet_supply_transfer_items
                    SET received_quantity = ?
                    WHERE id = ?
                      AND transfer_id = ?
                    """,
                    count,
                    itemId,
                    transferId
                );

            if (itemUpdated != 1) {
                throw fail(
                    HttpStatus.CONFLICT,
                    "Unable to save received quantity"
                );
            }
        }

        // ========================================
        // MARK TRANSFER AS RECEIVED
        // ========================================

        int changed =
            jdbc.update(
                """
                UPDATE public.outlet_supply_transfers
                SET status = 'RECEIVED',
                    received_by_user_id = ?,
                    received_at = NOW()
                WHERE id = ?
                  AND status = 'IN_TRANSIT'
                """,
                managerId,
                transferId
            );

        if (changed != 1) {
            throw fail(
                HttpStatus.CONFLICT,
                "Transfer status changed during receipt"
            );
        }

        // ========================================
        // RETURN SUCCESS RESPONSE
        // ========================================

        Map<String, Object> result =
            new LinkedHashMap<>();

        result.put(
            "transferId",
            transferId
        );

        result.put(
            "transferNumber",
            transfer.get("transferNumber")
        );

        result.put(
            "status",
            "RECEIVED"
        );

        result.put(
            "freezerId",
            freezerId
        );

        result.put(
            "totalReceivedUnits",
            totalReceived
        );

        result.put(
            "alreadyReceived",
            false
        );

        return result;
    }
}
