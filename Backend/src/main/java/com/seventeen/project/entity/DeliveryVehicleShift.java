
package com.seventeen.project.entity;

import jakarta.persistence.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "delivery_vehicle_shifts")
public class DeliveryVehicleShift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Vehicle selected by the delivery person
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "vehicle_id",
            nullable = false,
            foreignKey = @ForeignKey(
                    name = "delivery_vehicle_shifts_vehicle_id_fkey"
            )
    )
    private DeliveryVehicle vehicle;

    // SHA-256 hash of the shift token
    // Never store the original token
    @Column(
            name = "token_hash",
            nullable = false,
            unique = true,
            length = 64
    )
    private String tokenHash;

    // Time the shift started
    @Column(
            name = "started_at",
            nullable = false
    )
    private OffsetDateTime startedAt;

    // Last activity time
    @Column(
            name = "last_seen_at",
            nullable = false
    )
    private OffsetDateTime lastSeenAt;

    // Shift expiration time
    @Column(
            name = "expires_at",
            nullable = false
    )
    private OffsetDateTime expiresAt;

    // Null while shift is active
    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    // Required by JPA
    public DeliveryVehicleShift() {
    }

    public DeliveryVehicleShift(
            DeliveryVehicle vehicle,
            String tokenHash,
            OffsetDateTime expiresAt
    ) {
        this.vehicle = vehicle;
        this.tokenHash = tokenHash;

        OffsetDateTime now = OffsetDateTime.now();

        this.startedAt = now;
        this.lastSeenAt = now;
        this.expiresAt = expiresAt;
        this.endedAt = null;
    }

    // Automatically set timestamps before insertion
    @PrePersist
    protected void onCreate() {

        OffsetDateTime now = OffsetDateTime.now();

        if (startedAt == null) {
            startedAt = now;
        }

        if (lastSeenAt == null) {
            lastSeenAt = now;
        }
    }

    // Getters

    public Long getId() {
        return id;
    }

    public DeliveryVehicle getVehicle() {
        return vehicle;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }

    public OffsetDateTime getLastSeenAt() {
        return lastSeenAt;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getEndedAt() {
        return endedAt;
    }

    // Setters

    public void setId(Long id) {
        this.id = id;
    }

    public void setVehicle(DeliveryVehicle vehicle) {
        this.vehicle = vehicle;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public void setStartedAt(OffsetDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public void setLastSeenAt(OffsetDateTime lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }

    public void setExpiresAt(OffsetDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public void setEndedAt(OffsetDateTime endedAt) {
        this.endedAt = endedAt;
    }

    // Check whether the shift is currently active
    public boolean isActive() {

        return endedAt == null
                && expiresAt != null
                && expiresAt.isAfter(OffsetDateTime.now());
    }

    // Update last activity time
    public void updateLastSeen() {
        this.lastSeenAt = OffsetDateTime.now();
    }

    // End the shift
    public void endShift() {

        if (endedAt == null) {
            endedAt = OffsetDateTime.now();
        }
    }

    // Check whether the shift has expired
    public boolean isExpired() {

        return expiresAt != null
                && !expiresAt.isAfter(OffsetDateTime.now());
    }

    @Override
    public String toString() {

        return "DeliveryVehicleShift{" +
                "id=" + id +
                ", vehicleId=" +
                (vehicle != null ? vehicle.getId() : null) +
                ", startedAt=" + startedAt +
                ", lastSeenAt=" + lastSeenAt +
                ", expiresAt=" + expiresAt +
                ", endedAt=" + endedAt +
                '}';
    }
}
