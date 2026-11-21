
package com.seventeen.project.controller;

import com.seventeen.project.service.DeliveryClaimService;
import com.seventeen.project.service.DeliveryClaimService.DeliveryOrderView;
import com.seventeen.project.service.DeliveryOrderLocationService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.*;

import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/delivery/claims")
@PreAuthorize("hasRole('DELIVERY_PERSON')")
public class DeliveryClaimController {

    // ==========================================
    // SERVICES
    // ==========================================

    private final DeliveryClaimService claimService;

    private final DeliveryOrderLocationService locationService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public DeliveryClaimController(
            DeliveryClaimService claimService,
            DeliveryOrderLocationService locationService
    ) {
        this.claimService = claimService;
        this.locationService = locationService;
    }

    // ==========================================
    // CHECK AUTHENTICATION
    // ==========================================

    private void requireAuthentication(
            Authentication authentication
    ) {
        if (
                authentication == null ||
                !authentication.isAuthenticated() ||
                "anonymousUser".equals(
                        String.valueOf(
                                authentication.getPrincipal()
                        )
                )
        ) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in as a delivery person"
            );
        }
    }

    // ==========================================
    // VALIDATE ORDER ID
    // ==========================================

    private void validateOrderId(Long orderId) {

        if (orderId == null || orderId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid wholesale order ID"
            );
        }
    }

    // ==========================================
    // GET ALL VISIBLE DELIVERY ORDERS
    //
    // GET /api/delivery/claims/orders
    //
    // - Unclaimed orders are visible to both vehicles
    // - Claimed orders are visible to the assigned vehicle
    // ==========================================

    @GetMapping("/orders")
    public ResponseEntity<List<DeliveryOrderView>> getOrders(
            Authentication authentication
    ) {

        requireAuthentication(authentication);

        List<DeliveryOrderView> orders =
                claimService.getDashboardOrders(
                        authentication
                );

        return ResponseEntity.ok(orders);
    }

    // ==========================================
    // GET WHOLESALE SHOP LOCATIONS
    //
    // GET /api/delivery/claims/order-locations
    //
    // Returns:
    // - orderId
    // - shopName
    // - phone
    // - deliveryAddress
    // - deliveryLatitude
    // - deliveryLongitude
    //
    // Required for Google Maps directions.
    // ==========================================

    @GetMapping("/order-locations")
    public ResponseEntity<List<Map<String, Object>>>
    getOrderLocations(
            Authentication authentication
    ) {

        requireAuthentication(authentication);

        List<Map<String, Object>> locations =
                locationService.getOrderLocations();

        return ResponseEntity.ok(locations);
    }

    // ==========================================
    // CLAIM WHOLESALE ORDER
    //
    // POST /api/delivery/claims/orders/{orderId}/claim
    //
    // WAITING -> PROCESSING
    // ==========================================

    @PostMapping("/orders/{orderId}/claim")
    public ResponseEntity<Map<String, Object>> claimOrder(
            Authentication authentication,

            @PathVariable("orderId") Long orderId
    ) {

        requireAuthentication(authentication);
        validateOrderId(orderId);

        claimService.claimOrder(
                authentication,
                orderId
        );

        return ResponseEntity.ok(
                successResponse(
                        orderId,
                        "PROCESSING",
                        "Order claimed successfully"
                )
        );
    }

    // ==========================================
    // MARK ORDER ON THE WAY
    //
    // POST /api/delivery/claims/orders/{orderId}/on-the-way
    //
    // PROCESSING -> ON_THE_WAY
    // ==========================================

    @PostMapping("/orders/{orderId}/on-the-way")
    public ResponseEntity<Map<String, Object>> markOnTheWay(
            Authentication authentication,

            @PathVariable("orderId") Long orderId
    ) {

        requireAuthentication(authentication);
        validateOrderId(orderId);

        claimService.markOnTheWay(
                authentication,
                orderId
        );

        return ResponseEntity.ok(
                successResponse(
                        orderId,
                        "ON_THE_WAY",
                        "Order is now on the way"
                )
        );
    }

    // ==========================================
    // MARK ORDER DELIVERED
    //
    // POST /api/delivery/claims/orders/{orderId}/delivered
    //
    // ON_THE_WAY -> DELIVERED
    // ==========================================

    @PostMapping("/orders/{orderId}/delivered")
    public ResponseEntity<Map<String, Object>> markDelivered(
            Authentication authentication,

            @PathVariable("orderId") Long orderId
    ) {

        requireAuthentication(authentication);
        validateOrderId(orderId);

        claimService.markDelivered(
                authentication,
                orderId
        );

        return ResponseEntity.ok(
                successResponse(
                        orderId,
                        "DELIVERED",
                        "Order delivered successfully"
                )
        );
    }

    // ==========================================
    // SUCCESS RESPONSE
    // ==========================================

    private Map<String, Object> successResponse(
            Long orderId,
            String status,
            String message
    ) {

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put("success", true);
        response.put("message", message);
        response.put("orderId", orderId);
        response.put("status", status);

        return response;
    }

    // ==========================================
    // HANDLE EXPECTED DELIVERY ERRORS
    // ==========================================

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>>
    handleResponseStatusException(
            ResponseStatusException ex
    ) {

        Map<String, Object> response =
                new LinkedHashMap<>();

        response.put("success", false);

        response.put(
                "message",
                ex.getReason() != null
                        ? ex.getReason()
                        : "Delivery request failed"
        );

        response.put(
                "status",
                ex.getStatusCode().value()
        );

        return ResponseEntity
                .status(ex.getStatusCode())
                .body(response);
    }
}
