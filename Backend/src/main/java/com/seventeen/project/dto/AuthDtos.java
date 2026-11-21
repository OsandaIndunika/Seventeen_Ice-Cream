
package com.seventeen.project.dto;

import com.seventeen.project.model.AppUser;
import com.seventeen.project.model.Role;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {}

    // React sends this when a user logs in
    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    // Public wholesale registration
    public record RegisterRequest(
            @NotBlank String fullName,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 12) String password
    ) {}

    // Safe user details returned to React
    public record UserResponse(
            Long id,
            Integer employeeId,
            String fullName,
            String email,
            Role role,
            boolean enabled,
            boolean mustChangePassword
    ) {
        public static UserResponse from(AppUser user) {
            return new UserResponse(
                    user.getId(),
                    user.getEmployeeId(),
                    user.getFullName(),
                    user.getEmail(),
                    user.getRole(),
                    user.isEnabled(),
                    user.isMustChangePassword()
            );
        }
    }

    // Successful login response
    public record AuthResponse(
            String token,
            String tokenType,
            UserResponse user
    ) {}

    // Admin creates an employee account
    public record CreateStaffRequest(
            @NotBlank String fullName,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 12) String password,
            @NotNull Role role,
            Integer employeeId
    ) {}

    // Admin changes employee email
    public record EmailRequest(
            @NotBlank @Email String email
    ) {}

    // Admin resets employee password
    public record PasswordResetRequest(
            @NotBlank @Size(min = 12) String newPassword
    ) {}

    // Admin enables or disables account
    public record StatusRequest(
            boolean enabled
    ) {}

    // Admin changes assigned role
    public record RoleRequest(
            @NotNull Role role
    ) {}
}
