
package com.seventeen.project.dto;

public record WholesaleShopProfileResponse(

        Long userId,

        String ownerName,

        String email,

        String shopName,

        String phone,

        String shopAddress,

        String businessRegistrationNumber

) {}
