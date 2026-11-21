
package com.seventeen.project.config;

import com.seventeen.project.model.AppUser;
import com.seventeen.project.model.Role;
import com.seventeen.project.repository.UserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Locale;

@Configuration
public class AccountInitializer {

    @Bean
    CommandLineRunner seed(
            UserRepository users,
            PasswordEncoder encoder,
            @Value("${app.seed.enabled:false}")
            boolean enabled
    ) {

        return args -> {

            // ==========================================
            // CREATE DEFAULT ACCOUNTS
            // ==========================================

            if (enabled) {

                // ======================================
                // ADMIN ACCOUNT
                // ======================================

                create(
                        users,
                        encoder,
                        "System Administrator",
                        "admin@seventeen.com",
                        "SEED_ADMIN_PASSWORD",
                        Role.ADMIN
                );

                // ======================================
                // FACTORY MANAGER ACCOUNT
                // ======================================

                create(
                        users,
                        encoder,
                        "Factory Manager",
                        "manager@seventeen.com",
                        "SEED_FACTORY_MANAGER_PASSWORD",
                        Role.FACTORY_MANAGER
                );

                // ======================================
                // SALES REPRESENTATIVE 1
                // ======================================

                // Existing Sales Manager account.
                // Used for vehicle-based sales.

                create(
                        users,
                        encoder,
                        "Sales Representative 1",
                        "sales@seventeen.com",
                        "SEED_SALES_MANAGER_PASSWORD",
                        Role.SALES_MANAGER
                );

                // ======================================
                // SALES REPRESENTATIVE 2 - NEW ACCOUNT
                // ======================================

                // Second representative.
                // Uses the same dashboard and role.
                // Selects a delivery vehicle after login.

                create(
                        users,
                        encoder,
                        "Sales Representative 2",
                        "sales2@seventeen.com",
                        "SEED_SALES2_PASSWORD",
                        Role.SALES_MANAGER
                );

                // ======================================
                // OUTLET MANAGER ACCOUNT
                // ======================================

                create(
                        users,
                        encoder,
                        "Outlet Manager",
                        "outlet@seventeen.com",
                        "SEED_OUTLET_MANAGER_PASSWORD",
                        Role.OUTLET_MANAGER
                );

                // ======================================
                // DELIVERY PERSON 1
                // ======================================

                create(
                        users,
                        encoder,
                        "Delivery Person 1",
                        "delivery@seventeen.com",
                        "SEED_DELIVERY_PASSWORD",
                        Role.DELIVERY_PERSON
                );

                // ======================================
                // DELIVERY PERSON 2
                // ======================================

                create(
                        users,
                        encoder,
                        "Delivery Person 2",
                        "delivery2@seventeen.com",
                        "SEED_DELIVERY2_PASSWORD",
                        Role.DELIVERY_PERSON
                );
            }

            // ==========================================
            // OPTIONAL PASSWORD RESETS
            // ==========================================

            // ======================================
            // ADMIN PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_ADMIN_PASSWORD",
                    "NEW_ADMIN_PASSWORD",
                    "admin@seventeen.com",
                    Role.ADMIN
            );

            // ======================================
            // FACTORY MANAGER PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_FACTORY_MANAGER_PASSWORD",
                    "NEW_FACTORY_MANAGER_PASSWORD",
                    "manager@seventeen.com",
                    Role.FACTORY_MANAGER
            );

            // ======================================
            // SALES REPRESENTATIVE 1 PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_SALES_MANAGER_PASSWORD",
                    "NEW_SALES_MANAGER_PASSWORD",
                    "sales@seventeen.com",
                    Role.SALES_MANAGER
            );

            // ======================================
            // SALES REPRESENTATIVE 2 PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_SALES2_PASSWORD",
                    "NEW_SALES2_PASSWORD",
                    "sales2@seventeen.com",
                    Role.SALES_MANAGER
            );

            // ======================================
            // OUTLET MANAGER PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_OUTLET_MANAGER_PASSWORD",
                    "NEW_OUTLET_MANAGER_PASSWORD",
                    "outlet@seventeen.com",
                    Role.OUTLET_MANAGER
            );

            // ======================================
            // DELIVERY PERSON 1 PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_DELIVERY_PASSWORD",
                    "NEW_DELIVERY_PASSWORD",
                    "delivery@seventeen.com",
                    Role.DELIVERY_PERSON
            );

            // ======================================
            // DELIVERY PERSON 2 PASSWORD RESET
            // ======================================

            resetPasswordIfRequested(
                    users,
                    encoder,
                    "RESET_DELIVERY2_PASSWORD",
                    "NEW_DELIVERY2_PASSWORD",
                    "delivery2@seventeen.com",
                    Role.DELIVERY_PERSON
            );
        };
    }

    // ==========================================
    // CREATE ACCOUNT IF IT DOES NOT EXIST
    // ==========================================

    private void create(
            UserRepository users,
            PasswordEncoder encoder,
            String name,
            String email,
            String env,
            Role role
    ) {

        String normalizedEmail =
                email.trim().toLowerCase(Locale.ROOT);

        // Avoid creating duplicate accounts.

        if (users.existsByEmailIgnoreCase(normalizedEmail)) {

            System.out.println(
                    "Account already exists: "
                            + normalizedEmail
            );

            return;
        }

        // Read password from environment variable.
        // Never hardcode account passwords.

        String password = System.getenv(env);

        if (
                password == null ||
                password.length() < 12
        ) {

            throw new IllegalStateException(
                    "Set a password of at least "
                            + "12 characters in "
                            + env
            );
        }

        // Create new application user.

        AppUser user = new AppUser();

        user.setFullName(name);

        user.setEmail(normalizedEmail);

        user.setPassword(
                encoder.encode(password)
        );

        user.setRole(role);

        user.setEnabled(true);

        // The original initializer does not
        // assign employee IDs.
        // If your database requires employee_id
        // for staff accounts, that mapping must
        // be supplied before saving.

        users.saveAndFlush(user);

        System.out.println(
                "Account created successfully: "
                        + normalizedEmail
                        + " | Role: "
                        + role
        );
    }

    // ==========================================
    // RESET PASSWORD WHEN REQUESTED
    // ==========================================

    private void resetPasswordIfRequested(
            UserRepository users,
            PasswordEncoder encoder,
            String resetEnv,
            String passwordEnv,
            String email,
            Role expectedRole
    ) {

        // Reset only when explicitly enabled.

        String resetRequested =
                System.getenv(resetEnv);

        if (
                !"true".equalsIgnoreCase(
                        resetRequested
                )
        ) {
            return;
        }

        // Read the new password.

        String newPassword =
                System.getenv(passwordEnv);

        if (
                newPassword == null ||
                newPassword.length() < 12
        ) {

            throw new IllegalStateException(
                    passwordEnv
                            + " must contain at least "
                            + "12 characters."
            );
        }

        // Find existing user.

        AppUser account = users
                .findByEmailIgnoreCase(email)
                .orElseThrow(
                        () -> new IllegalStateException(
                                "Account not found: "
                                        + email
                        )
                );

        // Prevent reset for an account
        // with an unexpected role.

        if (account.getRole() != expectedRole) {

            throw new IllegalStateException(
                    "Incorrect role for account: "
                            + email
            );
        }

        // Encrypt new password.

        account.setPassword(
                encoder.encode(newPassword)
        );

        users.saveAndFlush(account);

        System.out.println(
                "Password reset successfully for: "
                        + email
        );
    }
}
