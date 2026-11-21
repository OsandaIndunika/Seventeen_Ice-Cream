
package com.seventeen.project.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.time.OffsetDateTime;

@Entity
@Table(
    name = "delivery_vehicles",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "delivery_vehicles_vehicle_number_key",
            columnNames = "vehicle_number"
        )
    }
)
public class DeliveryVehicle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Vehicle number is required")
    @Column(
        name = "vehicle_number",
        nullable = false,
        unique = true,
        length = 30
    )
    private String vehicleNumber;

    @Enumerated(EnumType.STRING)
    @Column(
        name = "status",
        nullable = false,
        length = 20
    )
    private VehicleStatus status = VehicleStatus.OFFLINE;

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "last_location_update")
    private OffsetDateTime lastLocationUpdate;

    public enum VehicleStatus {
        OFFLINE,
        AVAILABLE,
        BUSY
    }

    public DeliveryVehicle() {
    }

    public DeliveryVehicle(String vehicleNumber) {
        this.vehicleNumber = vehicleNumber;
        this.status = VehicleStatus.OFFLINE;
    }

    public DeliveryVehicle(
            String vehicleNumber,
            VehicleStatus status
    ) {
        this.vehicleNumber = vehicleNumber;
        this.status = status;
    }

    // Getters

    public Long getId() {
        return id;
    }

    public String getVehicleNumber() {
        return vehicleNumber;
    }

    public VehicleStatus getStatus() {
        return status;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public OffsetDateTime getLastLocationUpdate() {
        return lastLocationUpdate;
    }

    // Setters

    public void setId(Long id) {
        this.id = id;
    }

    public void setVehicleNumber(String vehicleNumber) {
        this.vehicleNumber = vehicleNumber;
    }

    public void setStatus(VehicleStatus status) {
        this.status = status;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public void setLastLocationUpdate(
            OffsetDateTime lastLocationUpdate
    ) {
        this.lastLocationUpdate = lastLocationUpdate;
    }

    // GPS update helper

    public void updateLocation(
            double latitude,
            double longitude
    ) {
        if (!Double.isFinite(latitude)
                || latitude < -90
                || latitude > 90) {
            throw new IllegalArgumentException(
                "Invalid latitude"
            );
        }

        if (!Double.isFinite(longitude)
                || longitude < -180
                || longitude > 180) {
            throw new IllegalArgumentException(
                "Invalid longitude"
            );
        }

        this.latitude = latitude;
        this.longitude = longitude;
        this.lastLocationUpdate = OffsetDateTime.now();
    }

    public boolean hasLocation() {
        return latitude != null && longitude != null;
    }

    public boolean isAvailableForOrders() {
        return status == VehicleStatus.AVAILABLE
                || status == VehicleStatus.BUSY;
    }

    @Override
    public String toString() {
        return "DeliveryVehicle{" +
                "id=" + id +
                ", vehicleNumber='" + vehicleNumber + '\'' +
                ", status=" + status +
                ", latitude=" + latitude +
                ", longitude=" + longitude +
                '}';
    }
}
