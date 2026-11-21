
package com.seventeen.project.repository;

import com.seventeen.project.entity.VehicleDeliveryAssignment;
import com.seventeen.project.entity.VehicleDeliveryAssignment.AssignmentStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VehicleDeliveryAssignmentRepository
        extends JpaRepository<VehicleDeliveryAssignment, Long> {

    Optional<VehicleDeliveryAssignment> findByWholesaleOrderId(
            Long wholesaleOrderId
    );

    boolean existsByWholesaleOrderId(
            Long wholesaleOrderId
    );

    List<VehicleDeliveryAssignment> findByVehicle_Id(
            Long vehicleId
    );

    List<VehicleDeliveryAssignment> findByVehicle_IdAndStatusInOrderByAssignedAtAsc(
            Long vehicleId,
            List<AssignmentStatus> statuses
    );

    List<VehicleDeliveryAssignment> findByStatus(
            AssignmentStatus status
    );

    long countByVehicle_IdAndStatusIn(
            Long vehicleId,
            List<AssignmentStatus> statuses
    );
}
