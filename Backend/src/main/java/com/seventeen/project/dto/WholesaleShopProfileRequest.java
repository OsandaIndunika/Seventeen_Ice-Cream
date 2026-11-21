
package com.seventeen.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record WholesaleShopProfileRequest(

        @NotBlank(message = "Shop name is required")
        @Size(max = 150)
        String shopName,

        @NotBlank(message = "Phone number is required")
        @Size(max = 20)
        String phone,

        @NotBlank(message = "Shop address is required")
        String shopAddress,

        @NotBlank(
            message = "Business registration number is required"
        )
        @Size(max = 100)
        String businessRegistrationNumber

) {}
