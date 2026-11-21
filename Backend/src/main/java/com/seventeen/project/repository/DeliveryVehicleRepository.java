
package com.seventeen.project.repository;

import com.seventeen.project.entity.DeliveryVehicle;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DeliveryVehicleRepository
        extends JpaRepository<DeliveryVehicle, Long> {

    Optional<DeliveryVehicle> findByVehicleNumber(
            String vehicleNumber
    );

    boolean existsByVehicleNumber(
            String vehicleNumber
    );
}
