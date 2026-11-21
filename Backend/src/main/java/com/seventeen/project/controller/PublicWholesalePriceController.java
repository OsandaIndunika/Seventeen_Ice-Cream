package com.seventeen.project.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/public/wholesale-prices")
public class PublicWholesalePriceController {

    private final JdbcTemplate jdbcTemplate;

    public PublicWholesalePriceController(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public record PriceResponse(
            String productId,
            String productName,
            String size,
            String flavour,
            BigDecimal unitPrice
    ) {}

    @GetMapping
    public List<PriceResponse> getPrices() {

        return jdbcTemplate.query(
            """
            SELECT
                p.id AS product_id,
                p.name AS product_name,
                p.size,
                c.flavour,
                c.unit_price
            FROM public.wholesale_price_catalog c
            JOIN public.wholesale_products p
                ON p.id = c.product_id
            WHERE p.active = TRUE
              AND c.unit_price > 0
            ORDER BY p.name, p.size, c.flavour
            """,
            (rs, rowNum) -> new PriceResponse(
                rs.getString("product_id"),
                rs.getString("product_name"),
                rs.getString("size"),
                rs.getString("flavour"),
                rs.getBigDecimal("unit_price")
            )
        );
    }
}