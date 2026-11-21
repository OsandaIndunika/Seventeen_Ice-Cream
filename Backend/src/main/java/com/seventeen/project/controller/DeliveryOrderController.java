
package com.seventeen.project.controller;

import com.seventeen.project.service.DeliveryOrderService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/delivery")
public class DeliveryOrderController {

    private final DeliveryOrderService service;

    public DeliveryOrderController(
            DeliveryOrderService service
    ) {
        this.service = service;
    }

    public record LocationRequest(
        double latitude,
        double longitude
    ) {}

    public record StatusRequest(String status) {}

    @PostMapping("/location")
    public Map<String, String> updateLocation(
            @RequestBody LocationRequest request,
            Authentication authentication
    ) {
        service.updateLocation(
            authentication.getName(),
            request.latitude(),
            request.longitude()
        );

        return Map.of("message", "Location updated");
    }

    @GetMapping("/orders")
    public List<Map<String, Object>> myOrders(
            Authentication authentication
    ) {
        return service.getAssignedOrders(
            authentication.getName()
        );
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, String> updateStatus(
            @PathVariable long id,
            @RequestBody StatusRequest request,
            Authentication authentication
    ) {
        if (!"DELIVERED".equals(request.status())) {
            throw new org.springframework.web.server
                .ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Only DELIVERED is supported"
                );
        }

        service.markDelivered(
            authentication.getName(), id
        );

        return Map.of("status", "DELIVERED");
    }
}
