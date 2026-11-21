
package com.seventeen.project.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record WholesaleOrderResponse(
        Long orderId,
        String shopName,
        String orderStatus,
        String paymentStatus,
        String paymentMethod,
        BigDecimal productSubtotal,
        BigDecimal deliveryCharge,
        BigDecimal taxAmount,
        BigDecimal finalTotal,
        WholesaleOrderRequest.DeliveryLocation deliveryLocation,
        List<Item> items,
        OffsetDateTime createdAt,
        String vehicleNumber
) {

    public record Item(
            String productId,
            String productName,
            String selectedFlavour,
            String size,
            Integer quantity,
            BigDecimal price,
            BigDecimal lineTotal
    ) {}

    // Backward-compatible constructor for existing callers.
    public WholesaleOrderResponse(
            Long orderId,
            String shopName,
            String orderStatus,
            String paymentStatus,
            String paymentMethod,
            BigDecimal productSubtotal,
            BigDecimal deliveryCharge,
            BigDecimal taxAmount,
            BigDecimal finalTotal,
            WholesaleOrderRequest.DeliveryLocation deliveryLocation,
            List<Item> items,
            OffsetDateTime createdAt
    ) {
        this(
                orderId,
                shopName,
                orderStatus,
                paymentStatus,
                paymentMethod,
                productSubtotal,
                deliveryCharge,
                taxAmount,
                finalTotal,
                deliveryLocation,
                items,
                createdAt,
                null
        );
    }
}
