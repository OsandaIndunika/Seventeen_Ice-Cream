
package com.seventeen.project.controller;

import com.seventeen.project.dto.SelectSalesVehicleRequest;
import com.seventeen.project.service.SalesVehicleService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@PreAuthorize("hasRole('SALES_MANAGER')")
public class SalesVehicleController {

    // ============================================
    // SERVICE
    // ============================================

    private final SalesVehicleService service;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    public SalesVehicleController(
            SalesVehicleService service
    ) {
        this.service = service;
    }

    // ============================================
    // 1. GET AVAILABLE SALES VEHICLES
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/sales/vehicles
    // ============================================

    @GetMapping("/vehicles")
    public ResponseEntity<List<Map<String, Object>>>
    getVehicles(Authentication auth) {

        return ResponseEntity.ok(
            service.getVehicles(auth.getName())
        );
    }

    // ============================================
    // 2. SELECT SALES VEHICLE
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // POST /api/sales/sessions
    // ============================================

    @PostMapping("/sessions")
    public ResponseEntity<Map<String, Object>>
    selectVehicle(
            Authentication auth,
            @Valid @RequestBody
            SelectSalesVehicleRequest request
    ) {

        return ResponseEntity.ok(
            service.selectVehicle(
                auth.getName(),
                request.vehicleId()
            )
        );
    }

    // ============================================
    // 3. GET CURRENT SALES SESSION
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/sales/sessions/current
    // ============================================

    @GetMapping("/sessions/current")
    public ResponseEntity<Map<String, Object>>
    currentSession(Authentication auth) {

        return ResponseEntity.ok(
            service.getCurrentSession(auth.getName())
        );
    }

    // ============================================
    // 4. END CURRENT SALES SESSION
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // POST /api/sales/sessions/current/end
    // ============================================

    @PostMapping("/sessions/current/end")
    public ResponseEntity<Map<String, String>>
    endSession(Authentication auth) {

        service.endSession(auth.getName());

        return ResponseEntity.ok(
            Map.of(
                "message",
                "Vehicle session ended"
            )
        );
    }

    // ============================================
    // 5. GET EXISTING VEHICLE INVENTORY
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/sales/vehicles/{vehicleId}/inventory
    //
    // Used by:
    //
    // - Sales Manager dashboard
    // - Billing
    // - Lorry inventory
    // - Other stock-related operations
    //
    // Returns aggregate stock quantities.
    // ============================================

    @GetMapping("/vehicles/{vehicleId}/inventory")
    public ResponseEntity<List<Map<String, Object>>>
    inventory(
            Authentication auth,
            @PathVariable long vehicleId
    ) {

        return ResponseEntity.ok(
            service.getInventory(
                auth.getName(),
                vehicleId
            )
        );
    }

    // ============================================
    // 5A. GET GROUPED BATCH INVENTORY
    //
    // EXISTING ENDPOINT - PRESERVED
    //
    // GET /api/sales/vehicles/{vehicleId}/batch-inventory
    //
    // Returns a list of products where each
    // product contains:
    //
    // - Product ID
    // - Product name
    // - Product size
    // - Flavour
    // - Total product stock
    // - Reserved stock
    // - Available stock
    // - Batch numbers
    // - Batch-specific quantities
    // - Allocated quantity
    // - Unallocated quantity
    //
    // Example:
    //
    // Ice Cream Bag
    // 4 Litres - Chocolate
    //
    // Total: 24
    //
    // Batch 055 -> 8
    // Batch 056 -> 10
    // Batch 057 -> 6
    //
    // UPDATED BATCH BEHAVIOUR:
    //
    // 1. Registered batches are loaded from
    //    the selected lorry.
    //
    // 2. Batch availability depends on
    //    quantity - reserved quantity.
    //
    // 3. No production batch approval-status
    //    column is required.
    //
    // 4. The Sales Manager can select any
    //    registered batch with available stock.
    //
    // IMPORTANT:
    //
    // - The authenticated Sales Manager must
    //   have selected the requested lorry.
    //
    // - The service validates vehicle access.
    //
    // - This endpoint is read-only.
    //
    // - It does not deduct stock.
    //
    // - Supports both sales lorries.
    //
    // - Yoghurt batch numbers are returned
    //   exactly as stored in PostgreSQL.
    //
    // - Existing inventory API is preserved.
    // ============================================

    @GetMapping("/vehicles/{vehicleId}/batch-inventory")
    public ResponseEntity<List<Map<String, Object>>>
    batchInventory(
            Authentication auth,
            @PathVariable long vehicleId
    ) {

        List<Map<String, Object>> inventory =
                service.getGroupedBatchInventory(
                    auth.getName(),
                    vehicleId
                );

        return ResponseEntity.ok(inventory);
    }

    // ============================================
    // 6. GET WHOLESALE ORDERS
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/sales/vehicles/{vehicleId}/orders
    // ============================================

    @GetMapping("/vehicles/{vehicleId}/orders")
    public ResponseEntity<List<Map<String, Object>>>
    orders(
            Authentication auth,
            @PathVariable long vehicleId
    ) {

        return ResponseEntity.ok(
            service.getOrders(
                auth.getName(),
                vehicleId
            )
        );
    }
}
