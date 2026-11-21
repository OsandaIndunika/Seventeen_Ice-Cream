
package com.seventeen.project.controller;

import com.seventeen.project.service.SalesCashService;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

@RestController
@RequestMapping("/api/sales/cash")
@PreAuthorize("hasRole('SALES_MANAGER')")
public class SalesCashController {

    private final SalesCashService service;

    public SalesCashController(SalesCashService service) {
        this.service = service;
    }

    @GetMapping("/today")
    public ResponseEntity<Map<String, Object>> today(
            Authentication authentication
    ) {
        BigDecimal total = service.getTodaysCash(
            authentication.getName()
        );

        return ResponseEntity.ok(
            Map.of(
                "date",
                LocalDate.now(
                    ZoneId.of("Asia/Colombo")
                ).toString(),
                "currency", "LKR",
                "todaysCash", total
            )
        );
    }
}
