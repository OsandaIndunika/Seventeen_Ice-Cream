
package com.seventeen.project.controller;

import com.seventeen.project.dto.OutletSaleRequest;
import com.seventeen.project.dto.OutletStockTransferRequest;
import com.seventeen.project.service.OutletPosService;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/outlet/pos")
public class OutletPosController {

    // ==========================================
    // SERVICE
    // ==========================================

    private final OutletPosService service;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public OutletPosController(
            OutletPosService service
    ) {
        this.service = service;
    }

    // ==========================================
    // 1. GET OUTLET INVENTORY
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/outlet/pos/inventory
    //
    // Returns aggregate product stock for:
    //
    // FREEZER_1 - Selling Stock
    // FREEZER_2 - Backroom Stock
    // ==========================================

    @GetMapping("/inventory")
    public List<Map<String, Object>> inventory(
            Principal principal
    ) {
        return service.inventory(
                principal.getName()
        );
    }

    // ==========================================
    // 1A. BATCH-WISE FREEZER INVENTORY
    //
    // GET /api/outlet/pos/batch-inventory
    //
    // IMPORTANT:
    //
    // This endpoint is already handled by
    // OutletBatchInventoryController.java.
    //
    // Do not add another @GetMapping here.
    //
    // Prevents the previous ambiguous
    // mapping startup error.
    // ==========================================


    // ==========================================
    // 2. GET RETAIL PRODUCTS
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/outlet/pos/products
    //
    // Returns billable products from FREEZER_1,
    // including their retail unit prices.
    // ==========================================

    @GetMapping("/products")
    public List<Map<String, Object>> products(
            Principal principal
    ) {
        return service.retailProducts(
                principal.getName()
        );
    }

    // ==========================================
    // 2A. GET CONE AND WAFFLE CUP OPTIONS
    //
    // NEW ENDPOINT
    //
    // GET /api/outlet/pos/serving-options
    //
    // Returns:
    //
    // - id
    // - code
    // - name
    // - cornType
    // - flavourMode
    // - scoopCount
    // - unitPrice
    //
    // Examples:
    //
    // SMALL_SINGLE       - LKR 100
    // SMALL_MIX          - LKR 150
    // WAFFLE_SINGLE      - LKR 200
    // WAFFLE_MIX         - LKR 250
    // WAFFLE_CUP_2       - LKR 300
    // WAFFLE_CUP_3       - LKR 600
    //
    // Flavour modes:
    //
    // SINGLE:
    // Vanilla / Chocolate / Strawberry
    //
    // MIXED:
    // Vanilla + Chocolate
    // Vanilla + Strawberry
    //
    // ANY:
    // Select each scoop flavour individually.
    //
    // This endpoint is read-only.
    // It does not modify freezer stock.
    // ==========================================

    @GetMapping("/serving-options")
    public List<Map<String, Object>> servingOptions(
            Principal principal
    ) {
        return service.servingOptions(
                principal.getName()
        );
    }

    // ==========================================
    // 3. GET DAILY SALES REPORT
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // GET /api/outlet/pos/daily-report
    //
    // Returns:
    //
    // - Today's sales
    // - Today's cash
    // - Total bills
    // - Card sales
    // - Cheque sales
    // - Recent retail bills
    //
    // Cone/cup sales will also be included
    // when the service records them in the
    // existing outlet_pos_sales table.
    // ==========================================

    @GetMapping("/daily-report")
    public Map<String, Object> dailyReport(
            Principal principal
    ) {
        return service.dailyReport(
                principal.getName()
        );
    }

    // ==========================================
    // 4. CREATE RETAIL SALE
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // POST /api/outlet/pos/sales
    //
    // The updated OutletPosService supports:
    //
    // A. PACKAGED ICE CREAM:
    //
    // - stockId
    // - freezerBatchStockId
    // - quantity
    //
    // Packaged sales deduct selected freezer
    // batch stock and aggregate stock.
    //
    // B. CONES AND WAFFLE CUPS:
    //
    // - servingOptionId
    // - flavours
    // - quantity
    //
    // Serving sales record the chosen
    // flavours and prices without
    // deducting freezer stock.
    //
    // Both categories can appear on one bill
    // when OutletSaleRequest and OutletPosService
    // are updated to support servingItems.
    //
    // CASH-only billing is preserved.
    // ==========================================

    @PostMapping("/sales")
    public ResponseEntity<Map<String, Object>> createSale(
            Principal principal,
            @RequestBody OutletSaleRequest request
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(
                        service.createSale(
                                principal.getName(),
                                request
                        )
                );
    }

    // ==========================================
    // 5. TRANSFER FREEZER STOCK
    //
    // EXISTING ENDPOINT - UNCHANGED
    //
    // POST /api/outlet/pos/transfers
    //
    // Request:
    //
    // - sourceStockId
    // - sourceBatchStockId
    // - quantity
    //
    // Transfer:
    //
    // FREEZER_2 -> FREEZER_1
    //
    // The service preserves the selected
    // production batch during the transfer.
    //
    // This operation applies only to
    // packaged stock.
    //
    // Cone and waffle cup sales do not use
    // this transfer endpoint.
    // ==========================================

    @PostMapping("/transfers")
    public ResponseEntity<Map<String, Object>> transfer(
            Principal principal,
            @RequestBody OutletStockTransferRequest request
    ) {
        return ResponseEntity.ok(
                service.transferToSellingFreezer(
                        principal.getName(),
                        request
                )
        );
    }
}
