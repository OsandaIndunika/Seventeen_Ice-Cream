
package com.seventeen.project.controller;

import com.seventeen.project.service.OutletSupplyService;
import com.seventeen.project.service.OutletSupplyService.CreateTransferRequest;
import com.seventeen.project.service.OutletSupplyService.ManualTransferRequest;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sales Manager Outlet Supply Controller.
 *
 * Supports two stock-transfer workflows:
 *
 * 1. EXISTING BATCH-BASED TRANSFER
 *
 *    Sales Manager selects an existing
 *    vehicle batch stock record.
 *
 * 2. MANUAL BATCH-NUMBER TRANSFER
 *
 *    Sales Manager selects a product from
 *    their already-selected vehicle and
 *    manually enters the batch number.
 *
 * Both workflows create an internal
 * Stock Transfer Note for Outlet Defreezer 2.
 *
 * IMPORTANT:
 *
 * - Uses authenticated Sales Manager JWT.
 *
 * - Uses the already-selected sales vehicle.
 *
 * - Does not create retail or wholesale bills.
 *
 * - Does not collect payments.
 *
 * - Does not immediately increase outlet stock.
 *
 * - Vehicle stock deductions are performed
 *   transactionally by OutletSupplyService.
 *
 * - Outlet Manager must confirm the physical
 *   receipt before Defreezer 2 is updated.
 *
 * - Manually entered batch numbers must be
 *   validated by OutletSupplyService against
 *   registered production batches.
 */
@RestController
@RequestMapping("/api/sales/outlet-supply")
public class OutletSupplyController {

    // ==========================================
    // SERVICE
    // ==========================================

    private final OutletSupplyService outletSupplyService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public OutletSupplyController(
            OutletSupplyService outletSupplyService
    ) {
        this.outletSupplyService = outletSupplyService;
    }

    // =====================================================
    // 1. GET AVAILABLE PRODUCTS FROM SELECTED LORRY
    //
    // NEW ENDPOINT
    //
    // GET /api/sales/outlet-supply/available-products
    //
    // Used by the updated SalesOutletSupplyPanel.jsx.
    //
    // The Sales Manager selects:
    //
    // - Product
    // - Product size
    // - Flavour
    //
    // The batch number is entered separately
    // using a text input.
    //
    // This endpoint retrieves products from
    // existing vehicle_stock records.
    //
    // Therefore, the product dropdown no longer
    // requires vehicle_batch_stock entries.
    // =====================================================

    @GetMapping("/available-products")
    public ResponseEntity<List<Map<String, Object>>> getAvailableProducts(
            Principal principal
    ) {

        List<Map<String, Object>> products =
                outletSupplyService.availableProducts(
                        principal.getName()
                );

        return ResponseEntity.ok(products);
    }

    // =====================================================
    // 2. GET AVAILABLE VEHICLE BATCHES
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/sales/outlet-supply/available-batches
    //
    // Preserved for any existing frontend
    // components using batch-allocated stock.
    //
    // Only eligible registered batches
    // available on the selected lorry
    // are returned.
    // =====================================================

    @GetMapping("/available-batches")
    public ResponseEntity<List<Map<String, Object>>> getAvailableBatches(
            Principal principal
    ) {

        List<Map<String, Object>> batches =
                outletSupplyService.availableBatches(
                        principal.getName()
                );

        return ResponseEntity.ok(batches);
    }

    // =====================================================
    // 3. CREATE MANUAL-BATCH STOCK TRANSFER NOTE
    //
    // NEW ENDPOINT
    //
    // POST /api/sales/outlet-supply/manual-transfers
    //
    // Request JSON:
    //
    // {
    //   "receiptKey": "UUID",
    //   "items": [
    //     {
    //       "vehicleStockId": 12,
    //       "batchNumber": "VAN-2026-001",
    //       "quantity": 20
    //     }
    //   ],
    //   "notes": "Supply to Outlet Defreezer 2"
    // }
    //
    // Backend responsibilities:
    //
    // - Identify the Sales Manager.
    // - Identify their active vehicle.
    // - Validate the vehicleStockId.
    // - Validate the batch number.
    // - Verify product and batch match.
    // - Verify available stock.
    // - Prevent duplicate transfer creation.
    // - Deduct eligible vehicle stock.
    // - Create the Stock Transfer Note.
    // - Set status to IN_TRANSIT.
    //
    // Outlet Defreezer 2 is NOT credited here.
    // =====================================================

    @PostMapping("/manual-transfers")
    public ResponseEntity<Map<String, Object>> createManualTransfer(
            Principal principal,
            @RequestBody ManualTransferRequest request
    ) {

        Map<String, Object> createdTransfer =
                outletSupplyService.createManualTransfer(
                        principal.getName(),
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(createdTransfer);
    }

    // =====================================================
    // 4. CREATE EXISTING BATCH-BASED TRANSFER NOTE
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // POST /api/sales/outlet-supply/transfers
    //
    // Request JSON:
    //
    // {
    //   "receiptKey": "UUID",
    //   "items": [
    //     {
    //       "vehicleBatchStockId": 12,
    //       "quantity": 20
    //     }
    //   ],
    //   "notes": "Stock Transfer"
    // }
    //
    // Existing batch allocation validation,
    // stock deduction and idempotency
    // are retained in OutletSupplyService.
    // =====================================================

    @PostMapping("/transfers")
    public ResponseEntity<Map<String, Object>> createTransfer(
            Principal principal,
            @RequestBody CreateTransferRequest request
    ) {

        Map<String, Object> createdTransfer =
                outletSupplyService.createTransfer(
                        principal.getName(),
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(createdTransfer);
    }

    // =====================================================
    // 5. GET OUTLET SUPPLY TRANSFER HISTORY
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/sales/outlet-supply/transfers
    //
    // Returns the Stock Transfer Notes created
    // for the authenticated Sales Manager's
    // currently selected vehicle.
    //
    // Possible statuses:
    //
    // - IN_TRANSIT
    // - RECEIVED
    // - DISCREPANCY
    // - CANCELLED
    //
    // The service validates Sales Manager
    // ownership before returning transfer history.
    // =====================================================

    @GetMapping("/transfers")
    public ResponseEntity<List<Map<String, Object>>> getTransfers(
            Principal principal
    ) {

        List<Map<String, Object>> transfers =
                outletSupplyService.getTransfers(
                        principal.getName()
                );

        return ResponseEntity.ok(transfers);
    }
}
