
package com.seventeen.project.dto;

import jakarta.validation.constraints.NotBlank;

public record SelectVehicleRequest(
        @NotBlank(message = "Vehicle number is required")
        String vehicleNumber
) {
}
