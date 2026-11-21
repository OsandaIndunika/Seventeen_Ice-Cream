
package com.seventeen.project.controller;

import com.seventeen.project.dto.WholesaleShopProfileRequest;
import com.seventeen.project.dto.WholesaleShopProfileResponse;
import com.seventeen.project.service.WholesaleShopProfileService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/wholesale/profile")
public class WholesaleShopProfileController {

    private final WholesaleShopProfileService profileService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public WholesaleShopProfileController(
            WholesaleShopProfileService profileService
    ) {
        this.profileService = profileService;
    }

    // ==========================================
    // VALIDATE AUTHENTICATION
    // ==========================================

    private String authenticatedEmail(
            Authentication authentication
    ) {

        if (
                authentication == null ||
                !authentication.isAuthenticated() ||
                "anonymousUser".equals(
                        String.valueOf(
                                authentication.getPrincipal()
                        )
                )
        ) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in first"
            );
        }

        return authentication.getName();
    }

    // ==========================================
    // GET CUSTOMER PROFILE
    // ==========================================

    @GetMapping
    @PreAuthorize("hasRole('WHOLESALE')")
    public ResponseEntity<WholesaleShopProfileResponse>
    getProfile(Authentication authentication) {

        String email = authenticatedEmail(authentication);

        return ResponseEntity.ok(
                profileService.getProfile(email)
        );
    }

    // ==========================================
    // SAVE / UPDATE CUSTOMER PROFILE
    // ==========================================

    @PutMapping
    @PreAuthorize("hasRole('WHOLESALE')")
    public ResponseEntity<WholesaleShopProfileResponse>
    updateProfile(
            Authentication authentication,

            @Valid @RequestBody
            WholesaleShopProfileRequest request
    ) {

        String email = authenticatedEmail(authentication);

        WholesaleShopProfileResponse savedProfile =
                profileService.saveProfile(
                        email,
                        request
                );

        return ResponseEntity.ok(savedProfile);
    }
}
