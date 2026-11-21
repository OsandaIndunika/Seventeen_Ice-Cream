
package com.seventeen.project.repository;

import com.seventeen.project.entity.DeliveryVehicleShift;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeliveryVehicleShiftRepository
        extends JpaRepository<DeliveryVehicleShift, Long> {

    Optional<DeliveryVehicleShift> findByTokenHash(
            String tokenHash
    );

    Optional<DeliveryVehicleShift> findByTokenHashAndEndedAtIsNull(
            String tokenHash
    );

    boolean existsByVehicle_IdAndEndedAtIsNull(
            Long vehicleId
    );
}
