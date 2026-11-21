
package com.seventeen.project.controller;

import com.seventeen.project.service.WholesaleOrderService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wholesale/orders")
public class WholesaleOrderHistoryController {

    private final WholesaleOrderService orderService;

    public WholesaleOrderHistoryController(
            WholesaleOrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('WHOLESALE')")
    public ResponseEntity<?> getMyOrders(
            Authentication authentication) {

        if (authentication == null ||
                !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                    .body("Authentication required");
        }

        String email = authentication.getName();

        return ResponseEntity.ok(
                orderService.getOrdersForCustomer(email)
        );
    }
}
