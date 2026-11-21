
package com.seventeen.project.dto;

import java.util.List;
import java.util.UUID;

/**
 * DTO for receiving outlet stock transfers.
 *
 * WORKFLOW:
 *
 * 1. Sales Manager dispatches ice cream products
 *    from their selected vehicle.
 *
 * 2. A Stock Transfer Note is created with
 *    status IN_TRANSIT.
 *
 * 3. Outlet Manager views the pending transfer.
 *
 * 4. Outlet Manager checks the physical products,
 *    batch numbers and received quantities.
 *
 * 5. Outlet Manager confirms receipt.
 *
 * 6. OutletSupplyReceivingService validates the
 *    request and increases Defreezer 2 stock.
 *
 * IMPORTANT:
 *
 * - Products are added only to Defreezer 2.
 * - No retail bill is generated.
 * - No Cash payment is recorded.
 * - Batch numbers come from production records.
 * - Receiving stock must be transactional.
 */
public record ReceiveOutletSupplyRequest(

        // ==========================================
        // UNIQUE RECEIPT CONFIRMATION KEY
        //
        // Used to identify retries and prevent
        // the same delivery being received twice.
        // ==========================================

        UUID receiptKey,

        // ==========================================
        // RECEIVED STOCK ITEMS
        //
        // Each item identifies an existing line
        // in outlet_supply_transfer_items.
        // ==========================================

        List<ReceivedLine> items,

        // ==========================================
        // OPTIONAL RECEIVING NOTES
        //
        // Examples:
        //
        // "All products received correctly."
        // "One Chocolate bag was missing."
        // "Two Vanilla tubs were damaged."
        // ==========================================

        String notes

) {

    // ==========================================
    // RECEIVED PRODUCT LINE
    // ==========================================

    public record ReceivedLine(

            // ======================================
            // TRANSFER ITEM ID
            //
            // References:
            // outlet_supply_transfer_items.id
            //
            // This is NOT a product ID or batch ID.
            // ======================================

            Long transferItemId,

            // ======================================
            // ACTUAL RECEIVED QUANTITY
            //
            // Must be:
            //
            // 0 <= receivedQuantity
            //      <= dispatchedQuantity
            //
            // Checked by the receiving service.
            // ======================================

            Integer receivedQuantity

    ) {
    }
}
