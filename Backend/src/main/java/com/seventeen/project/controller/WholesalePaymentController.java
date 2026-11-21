
package com.seventeen.project.controller;

import com.seventeen.project.service.WholesalePaymentService;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/wholesale/payments")
@PreAuthorize("hasRole('WHOLESALE')")
public class WholesalePaymentController {

    private final WholesalePaymentService service;

    public WholesalePaymentController(
            WholesalePaymentService service
    ) {
        this.service = service;
    }

    @GetMapping("/orders/{orderId}")
    public Map<String, Object> summary(
            @PathVariable long orderId,
            Authentication auth
    ) {
        return service.summaryForCustomer(
            auth.getName(),
            orderId
        );
    }

    @PostMapping(
        value = "/orders/{orderId}/bank-slip",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Void> uploadSlip(
            @PathVariable long orderId,
            @RequestParam UUID receiptKey,
            @RequestParam BigDecimal amount,
            @RequestPart("file") MultipartFile file,
            Authentication auth
    ) {
        service.uploadBankSlip(
            auth.getName(),
            orderId,
            receiptKey,
            amount,
            file
        );

        return ResponseEntity.noContent().build();
    }
}
