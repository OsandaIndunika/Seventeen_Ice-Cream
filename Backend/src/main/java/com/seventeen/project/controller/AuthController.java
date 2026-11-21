
package com.seventeen.project.controller;

import com.seventeen.project.dto.AuthDtos.AuthResponse;
import com.seventeen.project.dto.AuthDtos.LoginRequest;
import com.seventeen.project.dto.AuthDtos.RegisterRequest;
import com.seventeen.project.service.AuthService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody LoginRequest req
    ) {
        return auth.login(req);
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest req
    ) {
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(auth.register(req));
    }
}
