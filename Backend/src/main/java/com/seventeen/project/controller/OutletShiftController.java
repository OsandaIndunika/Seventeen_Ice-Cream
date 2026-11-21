
package com.seventeen.project.controller;

import com.seventeen.project.service.OutletShiftService;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/outlet/shifts")
public class OutletShiftController {

    private final OutletShiftService service;

    public OutletShiftController(OutletShiftService service) {
        this.service = service;
    }

    // Check whether the manager is working.

    @GetMapping("/active")
    public Map<String, Object> active(
            Principal principal
    ) {
        return service.currentShift(principal.getName());
    }

    // Start a new work shift.

    @PostMapping("/start")
    public Map<String, Object> start(
            Principal principal
    ) {
        return service.startShift(principal.getName());
    }

    // End the current work shift.

    @PostMapping("/end")
    public Map<String, Object> end(
            Principal principal
    ) {
        return service.endShift(principal.getName());
    }

    // Get previous shifts.

    @GetMapping("/history")
    public List<Map<String, Object>> history(
            Principal principal
    ) {
        return service.history(principal.getName());
    }
}
