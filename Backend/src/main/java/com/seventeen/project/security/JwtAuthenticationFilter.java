
package com.seventeen.project.security;

import io.jsonwebtoken.JwtException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.HttpMethod;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter
        extends OncePerRequestFilter {

    private static final Logger logger =
            LoggerFactory.getLogger(
                    JwtAuthenticationFilter.class
            );

    private final JwtService jwtService;

    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserDetailsService userDetailsService
    ) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    // =====================================================
    // SKIP PUBLIC ENDPOINTS
    // =====================================================

    @Override
    protected boolean shouldNotFilter(
            HttpServletRequest request
    ) throws ServletException {

        String path = request.getServletPath();
        String method = request.getMethod();

        // Allow all CORS preflight requests.
        if (HttpMethod.OPTIONS.matches(method)) {
            return true;
        }

        // Public login and registration endpoints.
        // These are already permitted in SecurityConfig.
        if (HttpMethod.POST.matches(method)) {

            if (path.equals("/api/auth/login")
                    || path.equals("/api/auth/register")
                    || path.equals("/api/auth/wholesale/register")) {

                return true;
            }
        }

        // =================================================
        // PUBLIC WHOLESALE PRICE API
        // =================================================

        // Customers can view the prices without logging in.
        //
        // Skip JWT authentication even if the browser sends
        // an old or expired Authorization header.
        //
        // Only GET requests are public.
        // Other HTTP methods remain protected.

        if (HttpMethod.GET.matches(method)
                && path.equals(
                        "/api/public/wholesale-prices"
                )) {

            return true;
        }

        // All other requests continue through JWT validation.
        return false;
    }

    // =====================================================
    // JWT AUTHENTICATION
    // =====================================================

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authorizationHeader =
                request.getHeader("Authorization");

        // =================================================
        // NO BEARER TOKEN
        // =================================================

        // Allow the request to continue.
        //
        // SecurityConfig will decide whether the endpoint
        // requires authentication.
        //
        // Protected endpoints remain protected.

        if (authorizationHeader == null
                || !authorizationHeader.startsWith("Bearer ")) {

            filterChain.doFilter(request, response);
            return;
        }

        // =================================================
        // AUTHENTICATE WHEN CONTEXT IS EMPTY
        // =================================================

        if (SecurityContextHolder.getContext()
                .getAuthentication() == null) {

            try {

                // =========================================
                // EXTRACT JWT
                // =========================================

                String token =
                        authorizationHeader
                                .substring(7)
                                .trim();

                if (token.isEmpty()) {

                    logger.warn(
                            "JWT authentication failed: empty Bearer token"
                    );

                } else {

                    // =====================================
                    // EXTRACT EMAIL FROM JWT
                    // =====================================

                    String email =
                            jwtService.extractEmail(token);

                    if (email == null || email.isBlank()) {

                        logger.warn(
                                "JWT authentication failed: missing subject"
                        );

                    } else {

                        // =================================
                        // LOAD USER FROM DATABASE
                        // =================================

                        UserDetails userDetails =
                                userDetailsService
                                        .loadUserByUsername(email);

                        // =================================
                        // CHECK ACCOUNT STATUS
                        // =================================

                        if (!userDetails.isEnabled()) {

                            logger.warn(
                                    "JWT authentication failed: account disabled"
                            );

                        } else if (
                                !userDetails.isAccountNonLocked()
                        ) {

                            logger.warn(
                                    "JWT authentication failed: account locked"
                            );

                        } else if (
                                !userDetails.isAccountNonExpired()
                        ) {

                            logger.warn(
                                    "JWT authentication failed: account expired"
                            );

                        } else if (
                                !userDetails.isCredentialsNonExpired()
                        ) {

                            logger.warn(
                                    "JWT authentication failed: credentials expired"
                            );

                        } else if (
                                !jwtService.isValid(
                                        token,
                                        userDetails
                                )
                        ) {

                            logger.warn(
                                    "JWT authentication failed: token validation returned false"
                            );

                        } else {

                            // =================================
                            // CREATE SPRING AUTHENTICATION
                            // =================================

                            UsernamePasswordAuthenticationToken authentication =
                                    new UsernamePasswordAuthenticationToken(
                                            userDetails,
                                            null,
                                            userDetails.getAuthorities()
                                    );

                            authentication.setDetails(
                                    new WebAuthenticationDetailsSource()
                                            .buildDetails(request)
                            );

                            // =================================
                            // STORE AUTHENTICATION
                            // =================================

                            SecurityContextHolder
                                    .getContext()
                                    .setAuthentication(
                                            authentication
                                    );

                            logger.debug(
                                    "JWT authentication successful for request {}",
                                    request.getRequestURI()
                            );
                        }
                    }
                }

            } catch (JwtException ex) {

                // Invalid, malformed or expired JWT.
                logger.warn(
                        "JWT authentication failed: {}",
                        ex.getClass().getSimpleName()
                );

                SecurityContextHolder.clearContext();

            } catch (AuthenticationException ex) {

                logger.warn(
                        "JWT authentication failed: {}",
                        ex.getClass().getSimpleName()
                );

                SecurityContextHolder.clearContext();

            } catch (IllegalArgumentException ex) {

                logger.warn(
                        "JWT authentication failed: invalid token or arguments"
                );

                SecurityContextHolder.clearContext();
            }
        }

        // =================================================
        // CONTINUE THROUGH SPRING SECURITY
        // =================================================

        // SecurityConfig performs the final role-based
        // authorization check.

        filterChain.doFilter(request, response);
    }
}
