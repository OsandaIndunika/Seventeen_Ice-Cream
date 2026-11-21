
package com.seventeen.project.controller;

import com.seventeen.project.service.SalesBillingService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/wholesale/prices")
public class WholesalePriceController {

    private final SalesBillingService billingService;
    private final JdbcTemplate jdbc;

    public WholesalePriceController(
        SalesBillingService billingService,
        JdbcTemplate jdbc
    ) {
        this.billingService = billingService;
        this.jdbc = jdbc;
    }

    public record PriceUpdate(
        String productId,
        String flavour,
        BigDecimal unitPrice
    ) {}

    // Public endpoint: homepage can read prices.
    @GetMapping
    public List<Map<String, Object>> getPrices() {
        return billingService.wholesalePrices();
    }

    // Only Admin can insert or change prices.
    @PutMapping
    @PreAuthorize(
        "hasAnyAuthority('ROLE_ADMIN', 'ADMIN')"
    )
    public Map<String, Object> updatePrice(
        @RequestBody PriceUpdate request
    ) {
        if (
            request == null ||
            request.productId() == null ||
            request.flavour() == null ||
            request.productId().isBlank() ||
            request.flavour().isBlank() ||
            request.unitPrice() == null ||
            request.unitPrice().compareTo(
                BigDecimal.ZERO
            ) <= 0 ||
            request.unitPrice().scale() > 2
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid product, flavour or price"
            );
        }

        int updated = jdbc.update(
            """
            INSERT INTO public.wholesale_price_catalog (
                product_id,
                flavour,
                unit_price,
                updated_at
            )
            VALUES (?, ?, ?, NOW())
            ON CONFLICT (product_id, flavour)
            DO UPDATE SET
                unit_price = EXCLUDED.unit_price,
                updated_at = NOW()
            """,
            request.productId().trim(),
            request.flavour().trim(),
            request.unitPrice()
        );

        return Map.of(
            "success", updated > 0,
            "productId", request.productId(),
            "flavour", request.flavour(),
            "unitPrice", request.unitPrice()
        );
    }
}
