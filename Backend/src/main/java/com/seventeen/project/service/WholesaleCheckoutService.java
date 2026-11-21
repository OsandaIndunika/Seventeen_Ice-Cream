
package com.seventeen.project.service;

import com.seventeen.project.dto.WholesaleOrderRequest;
import com.seventeen.project.dto.WholesaleOrderResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;

@Service
public class WholesaleCheckoutService {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    WholesaleCheckoutService.class
            );

    private final WholesaleOrderService orderService;

    private final DeliveryOrderService deliveryService;

    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    public WholesaleCheckoutService(
            WholesaleOrderService orderService,
            DeliveryOrderService deliveryService
    ) {
        this.orderService = orderService;
        this.deliveryService = deliveryService;
    }

    // =====================================================
    // PLACE WHOLESALE ORDER AND ASSIGN DELIVERY PERSON
    // =====================================================

    public WholesaleOrderResponse checkout(
            String email,
            WholesaleOrderRequest request
    ) {

        // STEP 1:
        // Save wholesale order and order items.
        //
        // WholesaleOrderService.placeOrder()
        // accepts:
        // (WholesaleOrderRequest request, String email)

        WholesaleOrderResponse result =
                orderService.placeOrder(
                        request,
                        email
                );

        // STEP 2:
        // Get generated order ID.

        Long orderId = result.orderId();

        if (orderId == null) {
            throw new IllegalStateException(
                    "Order was saved but no order ID was returned."
            );
        }

        logger.info(
                "Wholesale order {} saved successfully.",
                orderId
        );

        // STEP 3:
        // Automatically assign nearest delivery person.
        //
        // This happens AFTER placeOrder() returns,
        // so the order-saving transaction has completed.

        try {

            deliveryService.assignNearestDriver(orderId);

            logger.info(
                    "Delivery assignment attempted for order {}.",
                    orderId
            );

        } catch (RuntimeException ex) {

            // Do not fail checkout just because
            // delivery assignment failed.
            //
            // The saved order remains in PostgreSQL.
            // Delivery assignment can be retried later.

            logger.error(
                    "Delivery assignment failed for order {}. "
                    + "Order remains saved and requires assignment.",
                    orderId,
                    ex
            );
        }

        // STEP 4:
        // Return saved order information to React.

        return result;
    }
}
