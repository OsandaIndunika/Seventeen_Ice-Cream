
package com.seventeen.project.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DeliveryLocationRequest(

    @NotBlank(message = "Street address is required")
    String streetAddress,

    @NotBlank(message = "City is required")
    String city,
    String province,

    String postalCode,

    @NotNull(message = "Latitude is required")
    @DecimalMin(
        value = "-90.0",
        message = "Latitude must be at least -90"
    )
    @DecimalMax(
        value = "90.0",
        message = "Latitude must not exceed 90"
    )
    BigDecimal latitude,

    @NotNull(message = "Longitude is required")
    @DecimalMin(
        value = "-180.0",
        message = "Longitude must be at least -180"
    )
    @DecimalMax(
        value = "180.0",
        message = "Longitude must not exceed 180"
    )
    BigDecimal longitude,

    String deliveryInstructions

) {}
