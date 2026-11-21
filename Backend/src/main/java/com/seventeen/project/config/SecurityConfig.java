
package com.seventeen.project.config;

import com.seventeen.project.security.JwtAuthenticationFilter;

import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletResponse;

import java.util.List;

import org.springframework.boot.web.servlet.FilterRegistrationBean;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;

import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    // =====================================================
    // SPRING SECURITY FILTER CHAIN
    // =====================================================

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http
    ) throws Exception {

        http

            // Enable CORS before JWT authentication
            .cors(cors -> cors.configurationSource(
                    corsConfigurationSource()
            ))

            // JWT REST API does not use CSRF sessions
            .csrf(csrf -> csrf.disable())

            // Stateless JWT authentication
            .sessionManagement(session ->
                    session.sessionCreationPolicy(
                            SessionCreationPolicy.STATELESS
                    )
            )

            // =================================================
            // ENDPOINT AUTHORIZATION
            // =================================================

            .authorizeHttpRequests(auth -> auth

                // Browser CORS preflight requests
                .requestMatchers(
                        HttpMethod.OPTIONS,
                        "/**"
                ).permitAll()

                // Allow Spring Boot error dispatching
                .dispatcherTypeMatchers(
                        DispatcherType.ERROR
                ).permitAll()

                // =============================================
                // PUBLIC AUTHENTICATION ENDPOINTS
                // =============================================

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/auth/login",
                        "/api/auth/register",
                        "/api/auth/wholesale/register"
                ).permitAll()

                // =============================================
                // PUBLIC WHOLESALE PRODUCT PRICES
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                // Visitors can VIEW approved wholesale prices
                // without logging in.
                //
                // POST, PUT, PATCH and DELETE are not permitted
                // by this rule.
                //
                // Admin-controlled price modifications remain
                // protected by their existing authorization.

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/public/wholesale-prices"
                ).permitAll()

                // =============================================
                // WHOLESALE ORDER ENDPOINTS
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/wholesale/orders"
                ).hasRole("WHOLESALE")

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/wholesale/orders/**"
                ).hasRole("WHOLESALE")

                .requestMatchers(
                        "/api/wholesale/orders/**"
                ).hasRole("WHOLESALE")

                // =============================================
                // WHOLESALE CUSTOMER PAYMENT ENDPOINTS
                // =============================================

                // Wholesale customer can view the payment
                // summary of their own order.
                //
                // Order ownership must also be validated
                // by the payment service.

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/wholesale/payments/orders/*"
                ).hasRole("WHOLESALE")

                // Wholesale customer can upload a bank slip
                // after the order is delivered.
                //
                // Uploading proof does NOT confirm payment.

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/wholesale/payments/orders/*/bank-slip"
                ).hasRole("WHOLESALE")

                // All remaining wholesale payment endpoints
                // require the WHOLESALE role.

                .requestMatchers(
                        "/api/wholesale/payments/**"
                ).hasRole("WHOLESALE")

                // =============================================
                // BANK TRANSFER APPROVAL
                // ADMIN ONLY
                // =============================================

                // Disable the previous Sales Manager
                // bank transfer verification endpoint.
                //
                // No user can approve bank transfers
                // through this old sales endpoint.
                //
                // This rule MUST appear before broader
                // sales endpoint authorization rules.

                .requestMatchers(
                        "/api/sales/payments/bank/**"
                ).denyAll()

                // =============================================
                // ADMIN BANK TRANSFER PAYMENT ENDPOINTS
                // =============================================

                // Admin can retrieve bank transfer receipts.

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/admin/payments/bank-transfers"
                ).hasRole("ADMIN")

                // Admin can view uploaded bank slips.

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/admin/payments/bank-transfers/*/proof"
                ).hasRole("ADMIN")

                // Admin can approve bank transfer payments.

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/admin/payments/bank-transfers/*/approve"
                ).hasRole("ADMIN")

                // Admin can reject bank transfer payments.

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/admin/payments/bank-transfers/*/reject"
                ).hasRole("ADMIN")

                // Protect all other Admin payment endpoints.

                .requestMatchers(
                        "/api/admin/payments/**"
                ).hasRole("ADMIN")

                // =============================================
                // SALES MANAGER PAYMENT SUMMARY
                // =============================================

                // Sales Manager can view payment information
                // for assigned wholesale orders.
                //
                // Includes:
                // - Order total
                // - Confirmed paid amount
                // - Remaining balance
                // - Bank transfer approval status
                //
                // Bank payment information is read-only.
                //
                // Assigned order access must also be
                // validated in the payment service.

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/sales/payments/orders/*"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // SALES MANAGER CASH COLLECTION
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/sales/payments/orders/*/cash"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // SALES MANAGER CHEQUE SUBMISSION
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                // Sales Manager can submit a cheque
                // for Admin review.

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/sales/payments/orders/*/cheque"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // SALES MANAGER PAYMENT PROOF
                // =============================================

                // Existing cheque proof viewing retained.
                //
                // IMPORTANT:
                // This endpoint uses receipt IDs for both
                // cheque and bank transfer proofs.
                //
                // SecurityConfig cannot determine the
                // payment method using the URL alone.
                //
                // The payment controller/service MUST
                // reject BANK_TRANSFER proof requests
                // made by the Sales Manager.
                //
                // Only authorized non-bank payment proof
                // should be returned through this endpoint.

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/sales/payments/proof/*"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // SALES MANAGER CONFIRMED CASH
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                .requestMatchers(
                        HttpMethod.GET,
                        "/api/sales/cash/today",
                        "/api/sales/payments/today-cash"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // REMAINING SALES PAYMENT ENDPOINTS
                // =============================================

                .requestMatchers(
                        "/api/sales/payments/**"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // DIRECT SALES BILLING: SALES MANAGER ONLY
                // =============================================

                // Includes products, invoice creation, credit
                // balances, cash collection, bank details,
                // payment history and bank/cheque proof uploads.
                // Ownership and full-payment checks remain the
                // responsibility of the service layer.

                .requestMatchers(
                        "/api/sales/bills",
                        "/api/sales/bills/**"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // SALES MANAGER PRODUCT RETURNS
                // =============================================

                // Sales Manager records returns and issues
                // replacements directly using the active lorry.
                // No invoice or Admin approval is required.
                // The service validates session ownership and stock.

                .requestMatchers(
                        "/api/sales/returns",
                        "/api/sales/returns/**"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // SALES MANAGER OUTLET STOCK SUPPLY
                // =============================================

                // Sales Manager can view available production
                // batches, create stock transfer notes and view
                // dispatch history for the selected vehicle.
                // The service must validate vehicle ownership
                // and batch quantities before dispatch.

                .requestMatchers(
                        "/api/sales/outlet-supply",
                        "/api/sales/outlet-supply/**"
                ).hasRole("SALES_MANAGER")

                // =============================================
                // OUTLET MANAGER RETAIL POS & DEFREEZER INVENTORY
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                // Outlet Manager can view both freezer stocks,
                // bill retail customers using Defreezer 1,
                // transfer stock and view daily sales/cash.
                // The service enforces outlet ownership.

                .requestMatchers(
                        "/api/outlet/pos",
                        "/api/outlet/pos/**"
                ).hasRole("OUTLET_MANAGER")

                // =============================================
                // NEW: OUTLET MANAGER SHIFT MANAGEMENT
                // =============================================

                // Outlet Manager can start and end their
                // working shift directly from the dashboard.
                //
                // Supported endpoints:
                //
                // GET  /api/outlet/shifts/active
                // POST /api/outlet/shifts/start
                // POST /api/outlet/shifts/end
                // GET  /api/outlet/shifts/history
                //
                // The backend service:
                // - Identifies the logged-in manager
                // - Uses the outlet assigned to that manager
                // - Records the starting date and time
                // - Records the ending time
                // - Calculates elapsed working duration
                // - Prevents duplicate active shifts
                //
                // Only authenticated OUTLET_MANAGER users
                // can access these endpoints.

                .requestMatchers(
                        "/api/outlet/shifts",
                        "/api/outlet/shifts/**"
                ).hasRole("OUTLET_MANAGER")

                // =============================================
                // OUTLET MANAGER STOCK RECEIVING
                // =============================================

                // Outlet Manager can view pending transfer notes
                // and confirm the physically received quantities.
                // The receiving service verifies outlet ownership
                // and credits accepted batches into Defreezer 2.

                .requestMatchers(
                        "/api/outlet/supply",
                        "/api/outlet/supply/**"
                ).hasRole("OUTLET_MANAGER")

                // =============================================
                // DIRECT SALES PAYMENT REVIEW: ADMIN ONLY
                // =============================================

                // These are direct-sales invoice proofs, not
                // wholesale-order payment records.
                // Only Admin can view the uploaded proof,
                // approve deposits, confirm cheque clearance,
                // or reject a submission.

                .requestMatchers(
                        "/api/admin/sales-bill-payments",
                        "/api/admin/sales-bill-payments/**"
                ).hasRole("ADMIN")

                // =============================================
                // DELIVERY PERSON ENDPOINTS
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                // Select delivery vehicle

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/delivery/vehicles/select"
                ).hasRole("DELIVERY_PERSON")

                // Update GPS location

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/delivery/vehicles/location"
                ).hasRole("DELIVERY_PERSON")

                // End delivery shift

                .requestMatchers(
                        HttpMethod.POST,
                        "/api/delivery/vehicles/end-shift"
                ).hasRole("DELIVERY_PERSON")

                // All remaining delivery endpoints

                .requestMatchers(
                        "/api/delivery/**"
                ).hasRole("DELIVERY_PERSON")

                // =============================================
                // ADMIN ENDPOINTS
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                // Includes Admin payment approval,
                // employee management, stock management,
                // production management and other
                // existing Admin-controlled endpoints.

                .requestMatchers(
                        "/api/admin/**"
                ).hasRole("ADMIN")

                // =============================================
                // OTHER AUTHENTICATED ENDPOINTS
                // EXISTING FUNCTIONALITY RETAINED
                // =============================================

                .anyRequest().authenticated()
            )

            // =================================================
            // AUTHENTICATION AND AUTHORIZATION ERRORS
            // =================================================

            .exceptionHandling(ex -> ex

                // HTTP 401: Missing or invalid JWT

                .authenticationEntryPoint(
                        (request, response, exception) -> {

                            response.setStatus(
                                    HttpServletResponse.SC_UNAUTHORIZED
                            );

                            response.setContentType(
                                    "application/json"
                            );

                            response.setCharacterEncoding("UTF-8");

                            response.getWriter().write(
                                    """
                                    {
                                      "status": 401,
                                      "error": "Unauthorized",
                                      "message": "Authentication required or invalid token"
                                    }
                                    """
                            );
                        }
                )

                // HTTP 403: Insufficient role permissions

                .accessDeniedHandler(
                        (request, response, exception) -> {

                            response.setStatus(
                                    HttpServletResponse.SC_FORBIDDEN
                            );

                            response.setContentType(
                                    "application/json"
                            );

                            response.setCharacterEncoding("UTF-8");

                            response.getWriter().write(
                                    """
                                    {
                                      "status": 403,
                                      "error": "Forbidden",
                                      "message": "You do not have permission to access this resource"
                                    }
                                    """
                            );
                        }
                )
            )

            // Disable default login form

            .formLogin(form -> form.disable())

            // Disable HTTP Basic authentication

            .httpBasic(basic -> basic.disable())

            // =================================================
            // JWT FILTER
            // =================================================

            .addFilterBefore(
                    jwtAuthenticationFilter,
                    UsernamePasswordAuthenticationFilter.class
            );

        return http.build();
    }

    // =====================================================
    // CORS CONFIGURATION
    // EXISTING FUNCTIONALITY RETAINED
    // =====================================================

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration =
                new CorsConfiguration();

        // React Vite development frontend

        configuration.setAllowedOrigins(
                List.of(
                        "http://localhost:5173"
                )
        );

        // HTTP methods used by the application

        configuration.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
        );

        // Request headers accepted from React

        configuration.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type",
                        "Accept",
                        "X-Delivery-Shift"
                )
        );

        // Response headers accessible to React

        configuration.setExposedHeaders(
                List.of(
                        "Location"
                )
        );

        // Allow credentialed cross-origin requests

        configuration.setAllowCredentials(true);

        // Cache successful preflight responses

        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        // Apply to wholesale, delivery and other APIs

        source.registerCorsConfiguration(
                "/**",
                configuration
        );

        return source;
    }

    // =====================================================
    // PASSWORD ENCODER
    // EXISTING FUNCTIONALITY RETAINED
    // =====================================================

    @Bean
    public PasswordEncoder passwordEncoder() {

        return new BCryptPasswordEncoder();
    }

    // =====================================================
    // AUTHENTICATION MANAGER
    // EXISTING FUNCTIONALITY RETAINED
    // =====================================================

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration configuration
    ) throws Exception {

        return configuration.getAuthenticationManager();
    }

    // =====================================================
    // PREVENT DUPLICATE JWT FILTER REGISTRATION
    // EXISTING FUNCTIONALITY RETAINED
    // =====================================================

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter>
            jwtFilterRegistration(
                    JwtAuthenticationFilter filter
            ) {

        FilterRegistrationBean<JwtAuthenticationFilter> registration =
                new FilterRegistrationBean<>(filter);

        // JWT filter is already in the SecurityFilterChain

        registration.setEnabled(false);

        return registration;
    }
}
