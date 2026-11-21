
package com.seventeen.project.controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/delivery/shop-visits")
@PreAuthorize("hasRole('DELIVERY_PERSON')")
public class DeliveryShopVisitController {

    private final JdbcTemplate jdbc;

    public DeliveryShopVisitController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // REQUEST DTO
    // ==========================================

    public record ShopVisitRequest(
            String shopName,
            String shopAddress,
            String contactPerson,
            String phone,
            Double latitude,
            Double longitude,
            String vehicleNumber,
            String visitNotes
    ) {}

    // ==========================================
    // AUTHENTICATED DELIVERY PERSON
    // ==========================================

    private long deliveryPersonId(Principal principal) {

        if (principal == null ||
            principal.getName() == null) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please sign in again"
            );
        }

        List<Long> ids = jdbc.queryForList(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'DELIVERY_PERSON'
                  AND enabled = TRUE
                """,
                Long.class,
                principal.getName()
        );

        if (ids.size() != 1) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Active delivery person account required"
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // VALIDATION HELPERS
    // ==========================================

    private String requiredText(
            String value,
            String field,
            int maxLength
    ) {

        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " is required"
            );
        }

        String result = value.trim();

        if (result.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " is too long"
            );
        }

        return result;
    }

    private String optionalText(
            String value,
            String field,
            int maxLength
    ) {

        if (value == null || value.isBlank()) {
            return null;
        }

        String result = value.trim();

        if (result.length() > maxLength) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    field + " is too long"
            );
        }

        return result;
    }

    // ==========================================
    // GET SAVED SHOPS
    //
    // Only shops registered by the currently
    // signed-in delivery person are returned.
    // ==========================================

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>>
    getShopVisits(Principal principal) {

        long personId = deliveryPersonId(principal);

        List<Map<String, Object>> shops =
                jdbc.queryForList(
                        """
                        SELECT
                            id AS "id",
                            shop_name AS "shopName",
                            shop_address AS "shopAddress",
                            contact_person AS "contactPerson",
                            phone AS "phone",
                            latitude AS "latitude",
                            longitude AS "longitude",
                            vehicle_number AS "vehicleNumber",
                            visit_notes AS "visitNotes",
                            visited_at AS "visitedAt"

                        FROM public.delivery_person_shop_visits

                        WHERE delivery_person_user_id = ?

                        ORDER BY
                            visited_at DESC,
                            id DESC
                        """,
                        personId
                );

        return ResponseEntity.ok()
                .cacheControl(
                    org.springframework.http.CacheControl.noStore()
                )
                .body(shops);
    }

    // ==========================================
    // SAVE MANUAL SHOP VISIT
    //
    // Location can be obtained by GPS or
    // manually selected on the map.
    //
    // No wholesale order is created.
    // No stock is modified.
    // ==========================================

    @PostMapping
    public ResponseEntity<Map<String, Object>>
    saveShopVisit(
            Principal principal,
            @RequestBody ShopVisitRequest request
    ) {

        long personId = deliveryPersonId(principal);

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Shop details are required"
            );
        }

        String shopName = requiredText(
                request.shopName(),
                "Shop name",
                150
        );

        String shopAddress = requiredText(
                request.shopAddress(),
                "Shop address",
                2000
        );

        String contactPerson = optionalText(
                request.contactPerson(),
                "Contact person",
                150
        );

        String phone = optionalText(
                request.phone(),
                "Phone",
                30
        );

        String vehicleNumber = optionalText(
                request.vehicleNumber(),
                "Vehicle number",
                30
        );

        String notes = optionalText(
                request.visitNotes(),
                "Visit notes",
                2000
        );

        Double latitude = request.latitude();
        Double longitude = request.longitude();

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
                    "Select a valid shop GPS location"
            );
        }

        Long id = jdbc.queryForObject(
                """
                INSERT INTO public.delivery_person_shop_visits (
                    delivery_person_user_id,
                    shop_name,
                    shop_address,
                    contact_person,
                    phone,
                    latitude,
                    longitude,
                    vehicle_number,
                    visit_notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                personId,
                shopName,
                shopAddress,
                contactPerson,
                phone,
                latitude,
                longitude,
                vehicleNumber,
                notes
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(Map.of(
                        "id", id,
                        "message", "Shop visit saved successfully"
                ));
    }
}
