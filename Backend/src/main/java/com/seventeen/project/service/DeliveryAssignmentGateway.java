
package com.seventeen.project.service;

import java.util.List;
import java.util.Optional;

import com.seventeen.project.service
        .NearestDeliveryAssignmentService
        .AvailableDriver;

import com.seventeen.project.service
        .NearestDeliveryAssignmentService
        .DeliveryDestination;

public interface DeliveryAssignmentGateway {

    // Find wholesale orders that have not
    // been assigned to any delivery person.
    List<Long> findUnassignedOrderIds();

    // Check whether the order is already assigned.
    boolean isOrderAssigned(Long orderId);

    // Read destination coordinates from
    // the wholesale order.
    Optional<DeliveryDestination> findOrderDestination(
            Long orderId
    );

    // Find delivery persons with:
    // - active shifts
    // - selected vehicles
    // - recent valid GPS coordinates
    // - eligibility to accept another order
    List<AvailableDriver> findAvailableDrivers();

    // Persist the assignment in the existing
    // delivery assignment tables.
    void saveAssignment(
            Long orderId,
            AvailableDriver driver,
            double distanceKm
    );
}
