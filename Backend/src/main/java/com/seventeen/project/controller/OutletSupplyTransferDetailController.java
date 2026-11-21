
package com.seventeen.project.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;

import org.springframework.jdbc.core.JdbcTemplate;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/outlet/supply")
@PreAuthorize(
    "hasAnyAuthority('ROLE_OUTLET_MANAGER', 'OUTLET_MANAGER')"
)
public class OutletSupplyTransferDetailController {

    private final JdbcTemplate jdbc;

    public OutletSupplyTransferDetailController(
        JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    // ============================================
    // GET TRANSFER NOTE DETAILS
    //
    // GET /api/outlet/supply/transfers/{transferId}
    //
    // Read-only.
    //
    // Does not:
    // - Deduct stock
    // - Receive stock
    // - Change transfer status
    // - Modify Defreezer 2
    // ============================================

    
}
