
package com.seventeen.project.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record SelectSalesVehicleRequest(

    @NotNull(message = "Vehicle is required")
    @Positive(message = "Invalid vehicle ID")
    Long vehicleId

) {}
