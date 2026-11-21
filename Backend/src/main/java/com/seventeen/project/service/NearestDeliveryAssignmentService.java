
package com.seventeen.project.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class NearestDeliveryAssignmentService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    NearestDeliveryAssignmentService.class
            );

    private final DeliveryAssignmentGateway gateway;

    public NearestDeliveryAssignmentService(
            DeliveryAssignmentGateway gateway
    ) {
        this.gateway = gateway;
    }

    // ==========================================
    // SITUATION A
    // NEW WHOLESALE ORDER PLACED
    // ==========================================

    @Transactional
    public void assignNewOrder(Long orderId) {

        if (orderId == null || orderId <= 0) {
            throw new IllegalArgumentException(
                    "A valid order ID is required"
            );
        }

        log.info(
                "Starting nearest delivery assignment for order {}",
                orderId
        );

        assignOrderIfPossible(orderId);
    }

    // ==========================================
    // SITUATION B
    // DELIVERY VEHICLE BECOMES AVAILABLE
    // ==========================================

    @Transactional
    public void assignPendingOrders() {

        List<Long> pendingOrderIds =
                gateway.findUnassignedOrderIds();

        log.info(
                "Found {} wholesale orders awaiting delivery assignment",
                pendingOrderIds.size()
        );

        for (Long orderId : pendingOrderIds) {

            if (orderId == null) {
                continue;
            }

            try {
                assignOrderIfPossible(orderId);
            } catch (RuntimeException ex) {

                log.error(
                        "Failed to assign pending order {}",
                        orderId,
                        ex
                );

                // Do not silently report this batch as successful.
                // A database error should trigger a retry.
                throw ex;
            }
        }
    }

    // ==========================================
    // SHARED ASSIGNMENT LOGIC
    // ==========================================

    private void assignOrderIfPossible(Long orderId) {

        // STEP 1: Prevent duplicate assignment.

        if (gateway.isOrderAssigned(orderId)) {

            log.info(
                    "Order {} already has a delivery assignment",
                    orderId
            );

            return;
        }

        // STEP 2: Retrieve wholesale delivery destination.

        Optional<DeliveryDestination> destination =
                gateway.findOrderDestination(orderId);

        if (destination.isEmpty()) {

            log.warn(
                    "Order {} cannot be assigned: delivery GPS is missing",
                    orderId
            );

            return;
        }

        DeliveryDestination shop = destination.get();

        if (!validCoordinates(
                shop.latitude(),
                shop.longitude()
        )) {

            log.warn(
                    "Order {} has invalid delivery coordinates: {}, {}",
                    orderId,
                    shop.latitude(),
                    shop.longitude()
            );

            return;
        }

        // STEP 3: Retrieve eligible available drivers.
        //
        // IMPORTANT:
        // This method must be implemented in
        // DeliveryAssignmentGatewayImpl using
        // active vehicle shifts and vehicle GPS.
        //
        // Changing only this service will not
        // populate an empty driver list.

        List<AvailableDriver> drivers =
                gateway.findAvailableDrivers();

        if (drivers == null || drivers.isEmpty()) {

            log.warn(
                    "Order {} remains unassigned: " +
                    "no eligible delivery vehicles found",
                    orderId
            );

            return;
        }

        log.info(
                "Order {}: found {} candidate delivery vehicles",
                orderId,
                drivers.size()
        );

        // STEP 4: Find nearest valid driver.

        Optional<AvailableDriver> closest =
                drivers.stream()

                .filter(driver ->
                        driver != null
                        && driver.vehicleId() != null
                        && driver.shiftId() != null
                        && validCoordinates(
                                driver.latitude(),
                                driver.longitude()
                        )
                )
                        .min(
                                Comparator.comparingDouble(
                                        driver -> distanceKm(
                                                shop.latitude(),
                                                shop.longitude(),
                                                driver.latitude(),
                                                driver.longitude()
                                        )
                                )
                        );

        if (closest.isEmpty()) {

            log.warn(
                    "Order {} remains unassigned: " +
                    "all candidate vehicles have invalid " +
                    "driver identities or GPS coordinates",
                    orderId
            );

            return;
        }

        // STEP 5: Calculate nearest-driver distance.

        AvailableDriver driver = closest.get();

        double distance = distanceKm(
                shop.latitude(),
                shop.longitude(),
                driver.latitude(),
                driver.longitude()
        );

        log.info(
                "Order {}: selected delivery person {}, " +
                "vehicle {}, shift {}, distance {} km",
                orderId,
                driver.driverUserId(),
                driver.vehicleId(),
                driver.shiftId(),
                distance
        );

        // STEP 6: Save assignment.
        //
        // Gateway implementation must write the
        // assignment records required by the
        // delivery vehicle dashboard.

        gateway.saveAssignment(
                orderId,
                driver,
                distance
        );

        log.info(
                "Delivery assignment saved for order {}",
                orderId
        );
    }

    // ==========================================
    // HAVERSINE DISTANCE IN KILOMETERS
    // ==========================================

    public static double distanceKm(
            double lat1,
            double lon1,
            double lat2,
            double lon2
    ) {

        final double earthRadiusKm = 6371.0;

        double latDifference =
                Math.toRadians(lat2 - lat1);

        double lonDifference =
                Math.toRadians(lon2 - lon1);

        double a =
                Math.pow(
                        Math.sin(latDifference / 2),
                        2
                )
                +
                Math.cos(Math.toRadians(lat1))
                *
                Math.cos(Math.toRadians(lat2))
                *
                Math.pow(
                        Math.sin(lonDifference / 2),
                        2
                );

        a = Math.max(0.0, Math.min(1.0, a));

        double c = 2 * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1.0 - a)
        );

        return earthRadiusKm * c;
    }

    // ==========================================
    // GPS VALIDATION
    // ==========================================

    private boolean validCoordinates(
            double latitude,
            double longitude
    ) {

        return Double.isFinite(latitude)
                && Double.isFinite(longitude)
                && latitude >= -90
                && latitude <= 90
                && longitude >= -180
                && longitude <= 180;
    }

    // ==========================================
    // DATA RECORDS
    // ==========================================

    public record DeliveryDestination(
            double latitude,
            double longitude
    ) {}

    public record AvailableDriver(
            Long driverUserId,
            Long vehicleId,
            Long shiftId,
            double latitude,
            double longitude
    ) {}
}
