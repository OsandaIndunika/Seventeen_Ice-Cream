
package com.seventeen.project.dto;

import java.util.List;
import java.util.UUID;

/**
 * Request DTO for creating an Outlet Stock Transfer Note.
 *
 * Used when the Sales Manager dispatches products
 * from the currently selected lorry to the outlet.
 *
 * IMPORTANT:
 *
 * 1. The Sales Manager's active vehicle is obtained
 *    from vehicle_sales_sessions.
 *
 * 2. The destination is the outlet's Defreezer 2.
 *
 * 3. Product and batch details are retrieved using
 *    vehicleBatchStockId.
 *
 * 4. Vehicle stock is deducted transactionally
 *    by OutletSupplyService.
 *
 * 5. Outlet stock is NOT increased here.
 *    The Outlet Manager must confirm receipt.
 */
public record CreateOutletSupplyRequest(

        // ==========================================
        // UNIQUE REQUEST KEY
        //
        // Prevents duplicate transfer creation
        // and duplicate lorry stock deductions.
        // ==========================================

        UUID receiptKey,

        // ==========================================
        // PRODUCTS TO TRANSFER
        //
        // Each item identifies one production batch
        // currently available on the active lorry.
        // ==========================================

        List<DispatchLine> items,

        // ==========================================
        // OPTIONAL TRANSFER NOTES
        // ==========================================

        String notes

) {

    // ==========================================
    // DISPATCH LINE
    // ==========================================

    public record DispatchLine(

            // References vehicle_batch_stock.id.
            // This is a BIGINT identifier.
            Long vehicleBatchStockId,

            // Quantity dispatched from this batch.
            Integer quantity

    ) {
    }
}
