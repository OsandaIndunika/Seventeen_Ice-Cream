
package com.seventeen.project.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DeliveryOrderLocationService {

    private final JdbcTemplate jdbc;

    public DeliveryOrderLocationService(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getOrderLocations() {

        String sql = """
            SELECT
                o.id AS order_id,
                o.shop_name,
                o.phone,

                COALESCE(
                    NULLIF(o.delivery_street_address, ''),
                    NULLIF(o.address, '')
                ) AS delivery_address,

                o.delivery_city,
                o.delivery_province,
                o.delivery_postal_code,

                COALESCE(
                    o.delivery_latitude,
                    o.latitude
                ) AS shop_latitude,

                COALESCE(
                    o.delivery_longitude,
                    o.longitude
                ) AS shop_longitude

            FROM public.wholesale_orders o
            ORDER BY o.id DESC
            """;

        return jdbc.query(sql, (rs, rowNum) -> {

            Long orderId = rs.getLong("order_id");

            String street =
                    rs.getString("delivery_address");

            String city =
                    rs.getString("delivery_city");

            String province =
                    rs.getString("delivery_province");

            String postalCode =
                    rs.getString("delivery_postal_code");

            List<String> addressParts =
                    new ArrayList<>();

            if (hasText(street)) {
                addressParts.add(street.trim());
            }

            if (hasText(city)) {
                addressParts.add(city.trim());
            }

            if (hasText(province)) {
                addressParts.add(province.trim());
            }

            if (hasText(postalCode)) {
                addressParts.add(postalCode.trim());
            }

            String fullAddress =
                    String.join(", ", addressParts);

            Double latitude =
                    (Double) rs.getObject("shop_latitude");

            Double longitude =
                    (Double) rs.getObject("shop_longitude");

            Map<String, Object> result =
                    new LinkedHashMap<>();

            result.put("orderId", orderId);

            result.put(
                    "shopName",
                    rs.getString("shop_name")
            );

            result.put(
                    "phone",
                    rs.getString("phone")
            );

            result.put(
                    "deliveryAddress",
                    fullAddress.isBlank()
                            ? null
                            : fullAddress
            );

            result.put(
                    "deliveryLatitude",
                    latitude
            );

            result.put(
                    "deliveryLongitude",
                    longitude
            );

            return result;
        });
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
