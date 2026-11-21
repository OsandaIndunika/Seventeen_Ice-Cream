
package com.seventeen.project.controller;

import com.seventeen.project.service.OutletSupplyReceivingService;
import com.seventeen.project.service.OutletSupplyReceivingService.ReceiveRequest;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.jdbc.core.JdbcTemplate;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/outlet/supply")
@PreAuthorize("hasRole('OUTLET_MANAGER')")
public class OutletSupplyReceivingController {

    // ==========================================
    // SERVICES
    // ==========================================

    private final JdbcTemplate jdbc;

    private final OutletSupplyReceivingService
            receivingService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public OutletSupplyReceivingController(
            JdbcTemplate jdbc,
            OutletSupplyReceivingService receivingService
    ) {
        this.jdbc = jdbc;
        this.receivingService = receivingService;
    }

    // ==========================================
    // GET ACTIVE OUTLET ID
    //
    // EXISTING LOGIC PRESERVED
    //
    // Current installation has exactly
    // one active outlet.
    // ==========================================

    private long activeOutletId() {

        List<Long> outletIds =
                jdbc.queryForList(
                    """
                    SELECT id
                    FROM public.outlet_pos_locations
                    WHERE active = TRUE
                    ORDER BY id
                    """,
                    Long.class
                );

        if (outletIds.size() != 1) {

            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Exactly one active outlet must be configured"
            );
        }

        return outletIds.get(0);
    }

    // ==========================================
    // LOAD TRANSFER ITEMS
    //
    // SHARED READ-ONLY QUERY
    //
    // Preserves:
    // - Product information
    // - Production batch numbers
    // - Dispatched quantities
    // - Received quantities
    //
    // No expiry or quality-status
    // validation is performed.
    //
    // The same batch number can be used
    // by different products.
    // ==========================================

    private List<Map<String, Object>> loadTransferItems(
            long transferId
    ) {

        return jdbc.queryForList(
            """
            SELECT
                i.id AS "id",

                i.id AS "itemId",

                i.id AS "transferItemId",

                i.transfer_id AS "transferId",

                i.batch_id AS "batchId",

                b.batch_number
                    AS "batchNumber",

                b.expiry_date
                    AS "expiryDate",

                i.product_id
                    AS "productId",

                p.name
                    AS "productName",

                p.size
                    AS "size",

                i.flavour
                    AS "flavour",

                i.source_batch_stock_id
                    AS "vehicleBatchStockId",

                i.dispatched_quantity
                    AS "dispatchedQuantity",

                i.received_quantity
                    AS "receivedQuantity"

            FROM public.outlet_supply_transfer_items i

            JOIN public.product_batches b
                ON b.id = i.batch_id

            JOIN public.wholesale_products p
                ON p.id = i.product_id

            WHERE i.transfer_id = ?

            ORDER BY i.id
            """,
            transferId
        );
    }

    // ==========================================
    // ATTACH ITEMS AND TOTAL UNITS
    //
    // Preserves existing JSON structure.
    // ==========================================

    private Map<String, Object> withTransferItems(
            Map<String, Object> transfer
    ) {

        long transferId =
                ((Number) transfer.get("transferId"))
                        .longValue();

        List<Map<String, Object>> items =
                loadTransferItems(transferId);

        Map<String, Object> result =
                new LinkedHashMap<>(transfer);

        result.put("items", items);

        int totalUnits =
                items.stream()
                    .mapToInt(
                        item ->
                            ((Number) item.get(
                                "dispatchedQuantity"
                            )).intValue()
                    )
                    .sum();

        result.put("totalUnits", totalUnits);

        return result;
    }

    // ==========================================
    // 1. GET PENDING OUTLET STOCK TRANSFERS
    //
    // GET /api/outlet/supply/pending
    //
    // EXISTING ENDPOINT PRESERVED
    //
    // Returns transfers that:
    //
    // 1. Were dispatched from a sales vehicle
    // 2. Belong to the active outlet
    // 3. Have status IN_TRANSIT
    //
    // No stock is modified.
    // ==========================================

    @GetMapping("/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>>
    getPendingTransfers() {

        long outletId = activeOutletId();

        // ======================================
        // LOAD PENDING TRANSFER HEADERS
        // ======================================

        List<Map<String, Object>> transfers =
                jdbc.queryForList(
                    """
                    SELECT
                        t.id AS "id",

                        t.id AS "transferId",

                        t.transfer_number
                            AS "transferNumber",

                        t.source_type
                            AS "sourceType",

                        t.source_vehicle_id
                            AS "vehicleId",

                        v.vehicle_number
                            AS "vehicleNumber",

                        t.outlet_id
                            AS "outletId",

                        o.outlet_name
                            AS "outletName",

                        t.destination_freezer_id
                            AS "destinationFreezerId",

                        t.status
                            AS "status",

                        t.notes
                            AS "notes",

                        t.created_at
                            AS "createdAt",

                        t.dispatched_at
                            AS "dispatchedAt"

                    FROM public.outlet_supply_transfers t

                    JOIN public.outlet_pos_locations o
                        ON o.id = t.outlet_id

                    LEFT JOIN public.delivery_vehicles v
                        ON v.id = t.source_vehicle_id

                    WHERE t.outlet_id = ?

                      AND t.source_type = 'SALES_VEHICLE'

                      AND t.status = 'IN_TRANSIT'

                    ORDER BY
                        t.dispatched_at DESC,
                        t.id DESC
                    """,
                    outletId
                );

        // ======================================
        // LOAD ITEMS FOR EACH TRANSFER
        // ======================================

        List<Map<String, Object>> result =
                new ArrayList<>();

        for (Map<String, Object> transfer : transfers) {

            result.add(
                withTransferItems(transfer)
            );
        }

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(result);
    }

    // ==========================================
    // 2. GET A SPECIFIC TRANSFER NOTE
    //
    // NEW ENDPOINT
    //
    // GET /api/outlet/supply/transfers/{transferId}
    //
    // Fixes the 404 when the Outlet Manager
    // presses "Check & Receive".
    //
    // Returns:
    // - Transfer details
    // - Vehicle number
    // - Outlet details
    // - Destination freezer
    // - Product information
    // - Production batch numbers
    // - Dispatched quantities
    // - Received quantities
    //
    // No stock is modified.
    // ==========================================

    @GetMapping("/transfers/{transferId}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>>
    getTransferDetails(
            @PathVariable long transferId
    ) {

        if (transferId <= 0) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid transfer ID"
            );
        }

        long outletId = activeOutletId();

        // ======================================
        // VERIFY TRANSFER BELONGS TO OUTLET
        // ======================================

        List<Map<String, Object>> transfers =
                jdbc.queryForList(
                    """
                    SELECT
                        t.id AS "id",

                        t.id AS "transferId",

                        t.transfer_number
                            AS "transferNumber",

                        t.receipt_key
                            AS "receiptKey",

                        t.source_type
                            AS "sourceType",

                        t.source_vehicle_id
                            AS "vehicleId",

                        v.vehicle_number
                            AS "vehicleNumber",

                        t.outlet_id
                            AS "outletId",

                        o.outlet_name
                            AS "outletName",

                        t.destination_freezer_id
                            AS "destinationFreezerId",

                        f.freezer_code
                            AS "destinationFreezerCode",

                        t.issued_by_user_id
                            AS "issuedByUserId",

                        t.received_by_user_id
                            AS "receivedByUserId",

                        t.status
                            AS "status",

                        t.notes
                            AS "notes",

                        t.created_at
                            AS "createdAt",

                        t.dispatched_at
                            AS "dispatchedAt",

                        t.received_at
                            AS "receivedAt"

                    FROM public.outlet_supply_transfers t

                    JOIN public.outlet_pos_locations o
                        ON o.id = t.outlet_id

                    LEFT JOIN public.delivery_vehicles v
                        ON v.id = t.source_vehicle_id

                    JOIN public.outlet_pos_freezers f
                        ON f.id = t.destination_freezer_id
                       AND f.outlet_id = t.outlet_id

                    WHERE t.id = ?

                      AND t.outlet_id = ?

                      AND t.source_type = 'SALES_VEHICLE'

                      AND f.freezer_code = 'FREEZER_2'
                    """,
                    transferId,
                    outletId
                );

        if (transfers.isEmpty()) {

            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Transfer note not found for " +
                "this outlet's Defreezer 2"
            );
        }

        // ======================================
        // INCLUDE PRODUCTS AND BATCH NUMBERS
        // ======================================

        Map<String, Object> result =
                withTransferItems(
                    transfers.get(0)
                );

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(result);
    }

    // ==========================================
    // 3. RECEIVE STOCK INTO DEFREEZER 2
    //
    // NEW ENDPOINT
    //
    // POST /api/outlet/supply/transfers/{transferId}/receive
    //
    // Fixes the 404 when the Outlet Manager
    // presses "Transfer to Defreezer 2".
    //
    // The receiving service must:
    //
    // 1. Verify the authenticated Outlet Manager
    // 2. Verify the transfer and destination
    // 3. Validate actual received quantities
    // 4. Credit the selected production batches
    // 5. Mark the transfer as RECEIVED
    // 6. Prevent duplicate stock increments
    //
    // Stock updates are handled by the
    // transactional receiving service.
    // ==========================================

    @PostMapping("/transfers/{transferId}/receive")
    public ResponseEntity<Map<String, Object>>
    receiveTransfer(
            Authentication authentication,

            @PathVariable long transferId,

            @RequestBody ReceiveRequest request
    ) {

        if (transferId <= 0) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid transfer ID"
            );
        }

        Map<String, Object> result =
                receivingService.receiveTransfer(
                    authentication.getName(),
                    transferId,
                    request
                );

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(result);
    }
}
