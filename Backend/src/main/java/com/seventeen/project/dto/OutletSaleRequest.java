
package com.seventeen.project.dto;

import java.util.List;
import java.util.UUID;

public record OutletSaleRequest(

        // ==========================================
        // UNIQUE RETAIL BILL IDENTIFIER
        //
        // Prevents duplicate bills when a request
        // is retried.
        //
        // EXISTING FIELD - UNCHANGED
        // ==========================================

        UUID receiptKey,

        // ==========================================
        // PAYMENT METHOD
        //
        // CASH only, as validated by
        // OutletPosService.
        //
        // EXISTING FIELD - UNCHANGED
        // ==========================================

        String paymentMethod,

        // ==========================================
        // PACKAGED ICE CREAM SALE ITEMS
        //
        // Examples:
        // Ice Cream Tub
        // Ice Cream Bag
        // Popsicle
        // Yoghurt Drink
        //
        // These products are deducted from
        // the selected freezer stock and
        // production batch.
        //
        // EXISTING FIELD - UNCHANGED
        // ==========================================

        List<SaleItem> items,

        // ==========================================
        // NEW: CONES AND WAFFLE CUP SALE ITEMS
        //
        // Includes:
        // - Serving option ID
        // - Selected flavours
        // - Quantity
        //
        // These items do NOT deduct stock
        // from either freezer.
        //
        // NEW FIELD
        // ==========================================

        List<ServingItem> servingItems

) {

    // ==========================================
    // EXISTING PACKAGED PRODUCT SALE ITEM
    //
    // DO NOT CHANGE
    // ==========================================

    public record SaleItem(

            // outlet_pos_stock.id
            Long stockId,

            // outlet_freezer_batch_stock.id
            Long freezerBatchStockId,

            // Number of packaged units sold
            Integer quantity

    ) {}

    // ==========================================
    // NEW: CONE / WAFFLE CUP SALE ITEM
    //
    // Examples:
    //
    // Small Cone - Vanilla
    // Small Cone - Vanilla & Chocolate
    // Waffle Cone - Strawberry
    // Waffle Cup - 2 Scoops
    // Waffle Cup - 3 Scoops
    //
    // No freezer stock ID is necessary.
    // No production batch ID is necessary.
    // ==========================================

    public record ServingItem(

            // Primary key of:
            // outlet_pos_serving_options.id
            Long servingOptionId,

            // Selected flavours, for example:
            //
            // ["Vanilla"]
            //
            // ["Vanilla", "Chocolate"]
            //
            // ["Vanilla", "Strawberry"]
            //
            // ["Chocolate", "Chocolate"]
            //
            // ["Vanilla", "Chocolate", "Strawberry"]
            //
            // The number of flavours must match
            // the configured scoop count.
            List<String> flavours,

            // Number of cones or waffle cups sold
            Integer quantity

    ) {}
}
