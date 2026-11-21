
package com.seventeen.project.service;

import com.seventeen.project.dto.AuthDtos.AuthResponse;
import com.seventeen.project.dto.AuthDtos.LoginRequest;
import com.seventeen.project.dto.AuthDtos.RegisterRequest;
import com.seventeen.project.dto.AuthDtos.UserResponse;

import com.seventeen.project.model.AppUser;
import com.seventeen.project.model.Role;
import com.seventeen.project.repository.UserRepository;
import com.seventeen.project.security.JwtService;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final AuthenticationManager manager;
    private final CustomUserDetailsService details;
    private final JwtService jwt;

    public AuthService(
            UserRepository users,
            PasswordEncoder encoder,
            AuthenticationManager manager,
            CustomUserDetailsService details,
            JwtService jwt
    ) {
        this.users = users;
        this.encoder = encoder;
        this.manager = manager;
        this.details = details;
        this.jwt = jwt;
    }

    // Login for all user roles
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {

        String email = req.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        try {
            manager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            email,
                            req.password()
                    )
            );

        } catch (AuthenticationException e) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid email or password"
            );
        }

        AppUser user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Invalid email or password"
                        )
                );

        if (!user.isEnabled()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid email or password"
            );
        }

        UserDetails userDetails =
                details.loadUserByUsername(email);

        String token = jwt.generateToken(userDetails);

        return new AuthResponse(
                token,
                "Bearer",
                UserResponse.from(user)
        );
    }

    // Public registration for wholesale customers only
    @Transactional
    public AuthResponse register(RegisterRequest req) {

        String email = req.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already registered"
            );
        }

        AppUser user = new AppUser();

        user.setFullName(req.fullName().trim());
        user.setEmail(email);

        // BCrypt password hashing
        user.setPassword(
                encoder.encode(req.password())
        );

        // Prevent public registration with privileged roles
        user.setRole(Role.WHOLESALE);
        user.setEnabled(true);

        try {
            user = users.saveAndFlush(user);

        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already registered"
            );
        }

        UserDetails userDetails =
                details.loadUserByUsername(email);

        String token = jwt.generateToken(userDetails);

        return new AuthResponse(
                token,
                "Bearer",
                UserResponse.from(user)
        );
    }
}
