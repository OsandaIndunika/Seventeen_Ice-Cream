
package com.seventeen.project.controller;

import com.seventeen.project.dto.WholesaleOrderRequest;
import com.seventeen.project.dto.WholesaleOrderResponse;
import com.seventeen.project.service.WholesaleOrderService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/wholesale/orders")
public class WholesaleOrderController {

    private final WholesaleOrderService orderService;

    public WholesaleOrderController(
        WholesaleOrderService orderService
    ) {
        this.orderService = orderService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_WHOLESALE')")
    public ResponseEntity<WholesaleOrderResponse> placeOrder(
        @Valid @RequestBody WholesaleOrderRequest request,
        Authentication authentication
    ) {
        WholesaleOrderResponse response =
            orderService.placeOrder(
                request,
                authentication.getName()
            );

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .body(response);
    }

    @GetMapping("/{orderId}")
    @PreAuthorize("hasAuthority('ROLE_WHOLESALE')")
    public ResponseEntity<WholesaleOrderResponse> getOrder(
        @PathVariable Long orderId,
        Authentication authentication
    ) {
        return ResponseEntity.ok(
            orderService.getOrder(
                orderId,
                authentication.getName()
            )
        );
    }
}
