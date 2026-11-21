
package com.seventeen.project.controller;

import com.seventeen.project.dto.WholesaleRegisterRequest;
import com.seventeen.project.service.WholesaleRegistrationService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class WholesaleRegistrationController {

    private final WholesaleRegistrationService registrationService;

    public WholesaleRegistrationController(
            WholesaleRegistrationService registrationService
    ) {
        this.registrationService = registrationService;
    }

    // Wholesale customer registration
    @PostMapping("/wholesale/register")
    public ResponseEntity<Map<String, Object>> register(
            @Valid @RequestBody WholesaleRegisterRequest request
    ) {

        Map<String, Object> response =
                registrationService.register(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}
