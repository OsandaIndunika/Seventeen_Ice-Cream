
package com.seventeen.project.service;

import com.seventeen.project.dto.AuthDtos.*;
import com.seventeen.project.model.AppUser;
import com.seventeen.project.model.Role;
import com.seventeen.project.repository.UserRepository;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class AdminAccountService {

    private final UserRepository users;
    private final PasswordEncoder encoder;

    public AdminAccountService(
            UserRepository users,
            PasswordEncoder encoder
    ) {
        this.users = users;
        this.encoder = encoder;
    }

    // View all login accounts
    @Transactional(readOnly = true)
    public List<UserResponse> all() {
        return users.findAll()
                .stream()
                .map(UserResponse::from)
                .toList();
    }

    // Find account by ID
    private AppUser get(Long id) {
        return users.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Account not found"
                        )
                );
    }

    // Staff accounts cannot use WHOLESALE role
    private void staffRole(Role role) {
        if (role == null || role == Role.WHOLESALE) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid staff role"
            );
        }
    }

    // Create a new staff account
    @Transactional
    public UserResponse create(CreateStaffRequest req) {

        staffRole(req.role());

        String email = req.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (users.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        AppUser user = new AppUser();

        user.setFullName(req.fullName().trim());
        user.setEmail(email);
        user.setPassword(encoder.encode(req.password()));
        user.setRole(req.role());
        user.setEmployeeId(req.employeeId());
        user.setEnabled(true);

        try {
            return UserResponse.from(
                    users.saveAndFlush(user)
            );

        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email or employee link already exists, "
                    + "or employee ID is invalid"
            );
        }
    }

    // Change account email
    @Transactional
    public UserResponse changeEmail(
            Long id,
            EmailRequest req
    ) {
        AppUser user = get(id);

        String email = req.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (users.existsByEmailIgnoreCase(email)
                && !user.getEmail().equalsIgnoreCase(email)) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }

        user.setEmail(email);

        try {
            return UserResponse.from(
                    users.saveAndFlush(user)
            );

        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email already exists"
            );
        }
    }

    // Reset account password
    @Transactional
    public void resetPassword(
            Long id,
            PasswordResetRequest req
    ) {
        AppUser user = get(id);

        user.setPassword(
                encoder.encode(req.newPassword())
        );

        users.save(user);
    }

    // Enable or disable account
    @Transactional
    public UserResponse changeStatus(
            Long id,
            StatusRequest req
    ) {
        AppUser user = get(id);

        user.setEnabled(req.enabled());

        return UserResponse.from(
                users.save(user)
        );
    }

    // Change account role
    @Transactional
    public UserResponse changeRole(
            Long id,
            RoleRequest req
    ) {
        AppUser user = get(id);

        if (req.role() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Role is required"
            );
        }

        if ((user.getRole() == Role.WHOLESALE)
                != (req.role() == Role.WHOLESALE)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot switch wholesale and employee account types"
            );
        }

        user.setRole(req.role());

        return UserResponse.from(
                users.save(user)
        );
    }
}
