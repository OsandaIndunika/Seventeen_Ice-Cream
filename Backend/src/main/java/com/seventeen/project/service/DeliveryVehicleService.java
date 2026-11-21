
package com.seventeen.project.service;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DeliveryVehicleService {

    // ==========================================
    // ALLOWED DELIVERY VEHICLES
    // ==========================================

    private static final Set<String> ALLOWED_VEHICLES =
            Set.of("LA-2398", "LA-2099");

    private final JdbcTemplate jdbcTemplate;

    public DeliveryVehicleService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // ==========================================
    // RESPONSE DTO
    // ==========================================

    public record VehicleSelectionResponse(
            Long vehicleId,
            String vehicleNumber
    ) {}

    // ==========================================
    // SELECT DELIVERY VEHICLE
    //
    // Multiple delivery persons can select
    // the same vehicle.
    //
    // No shift token is required.
    // ==========================================

    @Transactional
    public VehicleSelectionResponse selectVehicle(
            Authentication authentication,
            String vehicleNumber
    ) {

        requireDeliveryRole(authentication);

        String normalizedNumber =
                normalizeVehicleNumber(vehicleNumber);

        Long userId = getAuthenticatedUserId(
                authentication,
                true
        );

        // Find the selected delivery vehicle.

        List<VehicleSelectionResponse> vehicles =
                jdbcTemplate.query(
                    """
                    SELECT id, vehicle_number
                    FROM public.delivery_vehicles
                    WHERE UPPER(TRIM(vehicle_number)) = ?
                    """,
                    (rs, rowNum) ->
                            new VehicleSelectionResponse(
                                    rs.getLong("id"),
                                    rs.getString("vehicle_number")
                            ),
                    normalizedNumber
                );

        if (vehicles.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Delivery vehicle not found: "
                            + normalizedNumber
            );
        }

        VehicleSelectionResponse vehicle =
                vehicles.get(0);

        // Save or update this person's vehicle selection.
        //
        // user_id is unique.
        // vehicle_id is NOT unique.
        //
        // Therefore, multiple users can select
        // the same vehicle.

        jdbcTemplate.update(
                """
                INSERT INTO public.delivery_person_vehicle_selections (
                    user_id,
                    vehicle_id,
                    selected_at
                )
                VALUES (?, ?, NOW())

                ON CONFLICT (user_id)
                DO UPDATE SET
                    vehicle_id = EXCLUDED.vehicle_id,
                    selected_at = NOW()
                """,
                userId,
                vehicle.vehicleId()
        );

        // Do not create a delivery shift.
        // Do not generate a shift token.
        // Do not reject active shifts.
        // Do not reject unfinished orders.
        // Do not clear vehicle GPS.
        // Do not modify existing order assignments.

        return vehicle;
    }

    // ==========================================
    // GET THE LOGGED-IN PERSON'S VEHICLE
    // ==========================================

    @Transactional(readOnly = true)
    public VehicleSelectionResponse getSelectedVehicle(
            Authentication authentication
    ) {

        requireDeliveryRole(authentication);

        Long userId = getAuthenticatedUserId(
                authentication,
                false
        );

        List<VehicleSelectionResponse> vehicles =
                jdbcTemplate.query(
                    """
                    SELECT
                        v.id,
                        v.vehicle_number

                    FROM public.delivery_person_vehicle_selections s

                    JOIN public.delivery_vehicles v
                        ON v.id = s.vehicle_id

                    WHERE s.user_id = ?
                    """,
                    (rs, rowNum) ->
                            new VehicleSelectionResponse(
                                    rs.getLong("id"),
                                    rs.getString("vehicle_number")
                            ),
                    userId
                );

        if (vehicles.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Please select a delivery vehicle first"
            );
        }

        return vehicles.get(0);
    }

    // ==========================================
    // REQUIRE SELECTED VEHICLE ID
    //
    // Used by:
    // - Delivery dashboard
    // - My orders
    // - GPS tracking
    // - Delivery status updates
    // ==========================================

    @Transactional(readOnly = true)
    public Long requireSelectedVehicle(
            Authentication authentication
    ) {

        return getSelectedVehicle(
                authentication
        ).vehicleId();
    }

    // ==========================================
    // UPDATE VEHICLE GPS LOCATION
    //
    // No shift token required.
    //
    // The logged-in delivery person must
    // have selected a vehicle.
    // ==========================================

    @Transactional
    public Long updateLocation(
            Authentication authentication,
            Double latitude,
            Double longitude
    ) {

        requireDeliveryRole(authentication);

        validateCoordinates(
                latitude,
                longitude
        );

        Long vehicleId =
                requireSelectedVehicle(authentication);

        int updated = jdbcTemplate.update(
                """
                UPDATE public.delivery_vehicles

                SET
                    latitude = ?,
                    longitude = ?,
                    last_location_update = NOW(),

                    status = CASE
                        WHEN status = 'OFFLINE'
                        THEN 'AVAILABLE'
                        ELSE status
                    END

                WHERE id = ?
                """,
                latitude,
                longitude,
                vehicleId
        );

        if (updated != 1) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Selected delivery vehicle not found"
            );
        }

        return vehicleId;
    }

    // ==========================================
    // CLEAR CURRENT VEHICLE SELECTION
    //
    // This does not:
    // - Delete orders
    // - End old shifts
    // - Change vehicle availability
    // - Affect another delivery person
    // ==========================================

    @Transactional
    public void clearVehicleSelection(
            Authentication authentication
    ) {

        requireDeliveryRole(authentication);

        Long userId = getAuthenticatedUserId(
                authentication,
                true
        );

        jdbcTemplate.update(
                """
                DELETE FROM public.delivery_person_vehicle_selections
                WHERE user_id = ?
                """,
                userId
        );
    }

    // ==========================================
    // VALIDATE GPS COORDINATES
    // ==========================================

    private void validateCoordinates(
            Double latitude,
            Double longitude
    ) {

        if (
                latitude == null ||
                longitude == null ||
                !Double.isFinite(latitude) ||
                !Double.isFinite(longitude) ||
                latitude < -90 ||
                latitude > 90 ||
                longitude < -180 ||
                longitude > 180
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid GPS coordinates"
            );
        }
    }

    // ==========================================
    // NORMALIZE VEHICLE NUMBER
    // ==========================================

    private String normalizeVehicleNumber(
            String vehicleNumber
    ) {

        if (
                vehicleNumber == null ||
                vehicleNumber.isBlank()
        ) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vehicle number is required"
            );
        }

        String normalized =
                vehicleNumber.trim()
                        .toUpperCase(Locale.ROOT);

        if (!ALLOWED_VEHICLES.contains(normalized)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid delivery vehicle number: "
                            + normalized
            );
        }

        return normalized;
    }

    // ==========================================
    // VERIFY DELIVERY PERSON ROLE
    // ==========================================

    private void requireDeliveryRole(
            Authentication authentication
    ) {

        if (
                authentication == null ||
                !authentication.isAuthenticated() ||
                authentication.getPrincipal()
                        instanceof String principal
                        && "anonymousUser".equals(principal)
        ) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication required"
            );
        }

        boolean authorized =
                authentication.getAuthorities()
                        .stream()
                        .anyMatch(authority ->
                                "ROLE_DELIVERY_PERSON".equals(
                                        authority.getAuthority()
                                )
                                ||
                                "DELIVERY_PERSON".equals(
                                        authority.getAuthority()
                                )
                        );

        if (!authorized) {

            throw new AccessDeniedException(
                    "Only delivery personnel can access this operation"
            );
        }
    }

    // ==========================================
    // GET AUTHENTICATED USER ID
    //
    // Assumes authentication.getName()
    // contains the logged-in user's email.
    //
    // This matches an email-based JWT login.
    // ==========================================

    private Long getAuthenticatedUserId(
            Authentication authentication,
            boolean lockUser
    ) {

        requireDeliveryRole(authentication);

        String email = authentication.getName();

        if (email == null || email.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authenticated user email is missing"
            );
        }

        String sql =
                """
                SELECT id

                FROM public.app_users

                WHERE UPPER(email) = UPPER(?)
                  AND enabled = TRUE
                  AND role = 'DELIVERY_PERSON'
                """
                + (lockUser ? " FOR UPDATE" : "");

        List<Long> userIds = jdbcTemplate.query(
                sql,
                (rs, rowNum) ->
                        rs.getLong("id"),
                email
        );

        if (userIds.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Active delivery person account not found"
            );
        }

        return userIds.get(0);
    }
}
