
package com.seventeen.project.controller;

import com.seventeen.project.service.DeliveryVehicleService;
import com.seventeen.project.service.DeliveryAssignmentService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/delivery/vehicles")
public class DeliveryVehicleController {

    private final DeliveryVehicleService vehicleService;
    private final DeliveryAssignmentService assignmentService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public DeliveryVehicleController(
            DeliveryVehicleService vehicleService,
            DeliveryAssignmentService assignmentService
    ) {
        this.vehicleService = vehicleService;
        this.assignmentService = assignmentService;
    }

    // ==========================================
    // REQUEST DTOs
    // ==========================================

    public record SelectVehicleRequest(
            String vehicleNumber
    ) {}

    public record LocationRequest(
            Double latitude,
            Double longitude
    ) {}

    // ==========================================
    // 1. SELECT DELIVERY VEHICLE
    //
    // Multiple delivery persons may select
    // the same vehicle.
    //
    // No shift token required.
    // ==========================================

    @PostMapping("/select")
    public ResponseEntity<?> selectVehicle(
            Authentication authentication,
            @RequestBody SelectVehicleRequest request
    ) {

        return ResponseEntity.ok(
                vehicleService.selectVehicle(
                        authentication,
                        request.vehicleNumber()
                )
        );
    }

    // ==========================================
    // 2. GET CURRENTLY SELECTED VEHICLE
    // ==========================================

    @GetMapping("/selected")
    public ResponseEntity<?> getSelectedVehicle(
            Authentication authentication
    ) {

        return ResponseEntity.ok(
                vehicleService.getSelectedVehicle(
                        authentication
                )
        );
    }

    // ==========================================
    // 3. GET ORDERS FOR SELECTED VEHICLE
    //
    // All delivery persons selecting the same
    // vehicle see the same assigned orders.
    // ==========================================

    @GetMapping("/my-orders")
    public ResponseEntity<?> getMyOrders(
            Authentication authentication
    ) {

        return ResponseEntity.ok(
                assignmentService.getMyOrders(
                        authentication
                )
        );
    }

    // ==========================================
    // 4. START DELIVERY
    //
    // ASSIGNED -> IN_TRANSIT
    //
    // Records the authenticated delivery person
    // in started_by_user_id.
    // ==========================================

    @PostMapping("/orders/{orderId}/start")
    public ResponseEntity<?> startDelivery(
            Authentication authentication,
            @PathVariable Long orderId
    ) {

        assignmentService.startDelivery(
                authentication,
                orderId
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Delivery started successfully",
                        "orderId", orderId,
                        "status", "IN_TRANSIT"
                )
        );
    }

    // ==========================================
    // 5. COMPLETE DELIVERY
    //
    // IN_TRANSIT -> DELIVERED
    //
    // Records the authenticated delivery person
    // in delivered_by_user_id.
    // ==========================================

    @PostMapping("/orders/{orderId}/complete")
    public ResponseEntity<?> completeDelivery(
            Authentication authentication,
            @PathVariable Long orderId
    ) {

        assignmentService.completeDelivery(
                authentication,
                orderId
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Delivery completed successfully",
                        "orderId", orderId,
                        "status", "DELIVERED"
                )
        );
    }

    // ==========================================
    // 6. UPDATE VEHICLE GPS LOCATION
    //
    // No shift token required.
    // ==========================================

    @PostMapping("/location")
    public ResponseEntity<?> updateLocation(
            Authentication authentication,
            @RequestBody LocationRequest request
    ) {

        Long vehicleId = vehicleService.updateLocation(
                authentication,
                request.latitude(),
                request.longitude()
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Vehicle location updated",
                        "vehicleId", vehicleId
                )
        );
    }

    // ==========================================
    // 7. CLEAR VEHICLE SELECTION
    //
    // Only clears the logged-in person's
    // selection, not another person's selection.
    // ==========================================

    
    @DeleteMapping("/selection")
    public ResponseEntity<?> clearSelection(
            Authentication authentication
    ) {

        vehicleService.clearVehicleSelection(
                authentication
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Vehicle selection cleared"
                )
        );
    }
}
