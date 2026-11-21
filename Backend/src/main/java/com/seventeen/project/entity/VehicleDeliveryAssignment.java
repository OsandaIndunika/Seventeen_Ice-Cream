
package com.seventeen.project.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "vehicle_delivery_assignments",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "vehicle_delivery_assignments_wholesale_order_id_key",
            columnNames = "wholesale_order_id"
        )
    }
)
public class VehicleDeliveryAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Each wholesale order can have one assignment.
    // We use Long here until the existing WholesaleOrder
    // entity and its ID mapping are confirmed.
    @Column(
        name = "wholesale_order_id",
        nullable = false,
        unique = true
    )
    private Long wholesaleOrderId;

    // Many assignments can belong to the same vehicle.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
        name = "vehicle_id",
        nullable = false
    )
    private DeliveryVehicle vehicle;

    // Optional shift associated with the assignment.
    // This is nullable because assignments can outlive
    // a particular driver's shift.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id")
    private DeliveryVehicleShift shift;

    @Enumerated(EnumType.STRING)
    @Column(
        name = "status",
        nullable = false,
        length = 30
    )
    private AssignmentStatus status = AssignmentStatus.ASSIGNED;

    @Column(
        name = "assigned_at",
        nullable = false
    )
    private LocalDateTime assignedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    public enum AssignmentStatus {
        ASSIGNED,
        IN_TRANSIT,
        DELIVERED,
        CANCELLED
    }

    // Required by JPA
    public VehicleDeliveryAssignment() {
    }

    public VehicleDeliveryAssignment(
            Long wholesaleOrderId,
            DeliveryVehicle vehicle
    ) {
        this.wholesaleOrderId = wholesaleOrderId;
        this.vehicle = vehicle;
        this.status = AssignmentStatus.ASSIGNED;
        this.assignedAt = LocalDateTime.now();
    }

    public VehicleDeliveryAssignment(
            Long wholesaleOrderId,
            DeliveryVehicle vehicle,
            DeliveryVehicleShift shift
    ) {
        this(wholesaleOrderId, vehicle);
        this.shift = shift;
    }

    @PrePersist
    protected void onCreate() {
        if (status == null) {
            status = AssignmentStatus.ASSIGNED;
        }

        if (assignedAt == null) {
            assignedAt = LocalDateTime.now();
        }
    }

    // Getters

    public Long getId() {
        return id;
    }

    public Long getWholesaleOrderId() {
        return wholesaleOrderId;
    }

    public DeliveryVehicle getVehicle() {
        return vehicle;
    }

    public DeliveryVehicleShift getShift() {
        return shift;
    }

    public AssignmentStatus getStatus() {
        return status;
    }

    public LocalDateTime getAssignedAt() {
        return assignedAt;
    }

    public LocalDateTime getDeliveredAt() {
        return deliveredAt;
    }

    // Setters

    public void setId(Long id) {
        this.id = id;
    }

    public void setWholesaleOrderId(Long wholesaleOrderId) {
        this.wholesaleOrderId = wholesaleOrderId;
    }

    public void setVehicle(DeliveryVehicle vehicle) {
        this.vehicle = vehicle;
    }

    public void setShift(DeliveryVehicleShift shift) {
        this.shift = shift;
    }

    public void setStatus(AssignmentStatus status) {
        this.status = status;
    }

    public void setAssignedAt(LocalDateTime assignedAt) {
        this.assignedAt = assignedAt;
    }

    public void setDeliveredAt(LocalDateTime deliveredAt) {
        this.deliveredAt = deliveredAt;
    }

    // Start delivering an assigned order
    public void startDelivery() {
        if (status != AssignmentStatus.ASSIGNED) {
            throw new IllegalStateException(
                "Only assigned orders can start delivery"
            );
        }

        this.status = AssignmentStatus.IN_TRANSIT;
    }

    // Mark one order as delivered
    public void markDelivered() {
        if (status != AssignmentStatus.IN_TRANSIT) {
            throw new IllegalStateException(
                "Only in-transit orders can be delivered"
            );
        }

        this.status = AssignmentStatus.DELIVERED;
        this.deliveredAt = LocalDateTime.now();
    }

    // Cancel an undelivered assignment
    public void cancelAssignment() {
        if (status == AssignmentStatus.DELIVERED) {
            throw new IllegalStateException(
                "A delivered order cannot be cancelled"
            );
        }

        if (status == AssignmentStatus.CANCELLED) {
            return;
        }

        this.status = AssignmentStatus.CANCELLED;
    }

    public boolean isActive() {
        return status == AssignmentStatus.ASSIGNED
            || status == AssignmentStatus.IN_TRANSIT;
    }

    public boolean isDelivered() {
        return status == AssignmentStatus.DELIVERED;
    }

    @Override
    public String toString() {
        return "VehicleDeliveryAssignment{" +
            "id=" + id +
            ", wholesaleOrderId=" + wholesaleOrderId +
            ", vehicleId=" +
                (vehicle != null ? vehicle.getId() : null) +
            ", status=" + status +
            ", assignedAt=" + assignedAt +
            ", deliveredAt=" + deliveredAt +
            '}';
    }
}
