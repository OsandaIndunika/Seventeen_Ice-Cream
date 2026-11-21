
package com.seventeen.project.service;

import com.seventeen.project.dto.WholesaleRegisterRequest;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

@Service
public class WholesaleRegistrationService {

    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public WholesaleRegistrationService(
            JdbcTemplate jdbcTemplate,
            PasswordEncoder passwordEncoder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, Object> register(
            WholesaleRegisterRequest request
    ) {

        String fullName = request.fullName().trim();

        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        String phone = request.phone().trim();
        String shopName = request.shopName().trim();
        String shopAddress = request.shopAddress().trim();

        String businessRegistrationNumber =
                request.businessRegistrationNumber() == null
                        ? null
                        : request.businessRegistrationNumber().trim();

        if (fullName.isBlank()
                || email.isBlank()
                || phone.isBlank()
                || shopName.isBlank()
                || shopAddress.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Please complete all required fields"
            );
        }

        Integer existing = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*)
                FROM app_users
                WHERE LOWER(email) = ?
                """,
                Integer.class,
                email
        );

        if (existing != null && existing > 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email address is already registered"
            );
        }

        String hashedPassword =
                passwordEncoder.encode(request.password());

        try {

            Long userId = jdbcTemplate.queryForObject(
                    """
                    INSERT INTO app_users
                    (
                        employee_id,
                        full_name,
                        email,
                        password,
                        role,
                        enabled,
                        must_change_password,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        NULL, ?, ?, ?, 'WHOLESALE',
                        TRUE, FALSE, NOW(), NOW()
                    )
                    RETURNING id
                    """,
                    Long.class,
                    fullName,
                    email,
                    hashedPassword
            );

            if (userId == null) {
                throw new IllegalStateException(
                        "Failed to create wholesale user"
                );
            }

            jdbcTemplate.update(
                    """
                    INSERT INTO wholesale_customers
                    (
                        user_id,
                        phone,
                        shop_name,
                        shop_address,
                        business_registration_number,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
                    """,
                    userId,
                    phone,
                    shopName,
                    shopAddress,
                    businessRegistrationNumber
            );

            return Map.of(
                    "message",
                    "Wholesale account created successfully",
                    "userId",
                    userId,
                    "role",
                    "WHOLESALE"
            );

        } catch (DuplicateKeyException ex) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email address is already registered",
                    ex
            );
        }
    }
}
