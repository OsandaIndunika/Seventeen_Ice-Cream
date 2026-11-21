package com.seventeen.project.controller;

import com.seventeen.project.dto.AuthDtos.UserResponse;
import com.seventeen.project.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class DashboardController {

    private final UserRepository users;

    public DashboardController(UserRepository users) {
        this.users = users;
    }

    private UserResponse current(Authentication auth) {

        return UserResponse.from(
                users.findByEmailIgnoreCase(auth.getName())
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.UNAUTHORIZED
                                )
                        )
        );
    }

    @GetMapping("/api/auth/me")
    public UserResponse me(Authentication auth) {
        return current(auth);
    }

    @GetMapping("/api/admin/me")
    public UserResponse admin(Authentication auth) {
        return current(auth);
    }

    @GetMapping("/api/factory/me")
    public UserResponse factory(Authentication auth) {
        return current(auth);
    }

    @GetMapping("/api/sales/me")
    public UserResponse sales(Authentication auth) {
        return current(auth);
    }

    @GetMapping("/api/outlet/me")
    public UserResponse outlet(Authentication auth) {
        return current(auth);
    }

    @GetMapping("/api/delivery/me")
    public UserResponse delivery(Authentication auth) {
        return current(auth);
    }

    @GetMapping("/api/wholesale/me")
    public UserResponse wholesale(Authentication auth) {
        return current(auth);
    }
}
