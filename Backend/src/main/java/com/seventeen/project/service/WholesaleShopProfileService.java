
package com.seventeen.project.service;

import com.seventeen.project.dto.WholesaleShopProfileRequest;
import com.seventeen.project.dto.WholesaleShopProfileResponse;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class WholesaleShopProfileService {

    private final JdbcTemplate jdbc;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public WholesaleShopProfileService(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // GET LOGGED-IN WHOLESALE CUSTOMER ID
    // ==========================================

    private Long getWholesaleUserId(String email) {

        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Login required"
            );
        }

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'WHOLESALE'
                  AND enabled = TRUE
                """,

                (rs, rowNum) -> rs.getLong("id"),

                email.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Wholesale customer account not found"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // GET WHOLESALE SHOP PROFILE
    //
    // GET /api/wholesale/profile
    // ==========================================

    @Transactional(readOnly = true)
    public WholesaleShopProfileResponse getProfile(
            String email
    ) {

        Long userId = getWholesaleUserId(email);

        List<WholesaleShopProfileResponse> profiles =
                jdbc.query(
                        """
                        SELECT
                            u.id AS user_id,
                            u.full_name AS owner_name,
                            u.email,

                            p.shop_name,
                            p.phone,
                            p.shop_address,
                            p.business_registration_number

                        FROM public.app_users u

                        LEFT JOIN public.wholesale_shop_profiles p
                            ON p.user_id = u.id

                        WHERE u.id = ?
                          AND u.role = 'WHOLESALE'
                          AND u.enabled = TRUE
                        """,

                        (rs, rowNum) ->
                                new WholesaleShopProfileResponse(
                                        rs.getLong("user_id"),
                                        rs.getString("owner_name"),
                                        rs.getString("email"),
                                        rs.getString("shop_name"),
                                        rs.getString("phone"),
                                        rs.getString("shop_address"),
                                        rs.getString(
                                                "business_registration_number"
                                        )
                                ),

                        userId
                );

        if (profiles.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Wholesale customer not found"
            );
        }

        // A newly registered customer gets a response
        // with null shop fields rather than HTTP 404.
        return profiles.get(0);
    }

    // ==========================================
    // CREATE OR UPDATE SHOP PROFILE
    //
    // PUT /api/wholesale/profile
    // ==========================================

    @Transactional
    public WholesaleShopProfileResponse saveProfile(
            String email,
            WholesaleShopProfileRequest request
    ) {

        Long userId = getWholesaleUserId(email);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Shop profile details are required"
            );
        }

        String shopName = request.shopName().trim();
        String phone = request.phone().trim();
        String shopAddress = request.shopAddress().trim();

        String registrationNumber =
                request.businessRegistrationNumber().trim();

        if (
                shopName.isBlank() ||
                phone.isBlank() ||
                shopAddress.isBlank() ||
                registrationNumber.isBlank()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "All shop profile fields are required"
            );
        }

        // Insert a new profile or update the existing
        // profile for this logged-in wholesale customer.

        jdbc.update(
                """
                INSERT INTO public.wholesale_shop_profiles (
                    user_id,
                    shop_name,
                    phone,
                    shop_address,
                    business_registration_number,
                    created_at,
                    updated_at
                )

                VALUES (
                    ?, ?, ?, ?, ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT (user_id)
                DO UPDATE SET
                    shop_name = EXCLUDED.shop_name,
                    phone = EXCLUDED.phone,
                    shop_address = EXCLUDED.shop_address,
                    business_registration_number =
                        EXCLUDED.business_registration_number,
                    updated_at = CURRENT_TIMESTAMP
                """,

                userId,
                shopName,
                phone,
                shopAddress,
                registrationNumber
        );

        // Return the latest saved profile.
        return getProfile(email);
    }
}
