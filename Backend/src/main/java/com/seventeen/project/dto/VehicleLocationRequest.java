
package com.seventeen.project.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record VehicleLocationRequest(

        @NotNull(message = "Latitude is required")
        @DecimalMin(
                value = "-90.0",
                message = "Latitude must be at least -90"
        )
        @DecimalMax(
                value = "90.0",
                message = "Latitude must not exceed 90"
        )
        Double latitude,

        @NotNull(message = "Longitude is required")
        @DecimalMin(
                value = "-180.0",
                message = "Longitude must be at least -180"
        )
        @DecimalMax(
                value = "180.0",
                message = "Longitude must not exceed 180"
        )
        Double longitude

) {
    public VehicleLocationRequest {
        if (latitude != null && !Double.isFinite(latitude)) {
            throw new IllegalArgumentException(
                    "Latitude must be a finite number"
            );
        }

        if (longitude != null && !Double.isFinite(longitude)) {
            throw new IllegalArgumentException(
                    "Longitude must be a finite number"
            );
        }
    }
}
