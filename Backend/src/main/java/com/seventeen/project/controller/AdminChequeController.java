
package com.seventeen.project.controller;

import com.seventeen.project.service.WholesalePaymentService;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/payment-proofs")
@PreAuthorize("hasRole('ADMIN')")
public class AdminChequeController {

    private final WholesalePaymentService service;

    public AdminChequeController(
            WholesalePaymentService service
    ) {
        this.service = service;
    }

    @GetMapping("/pending-cheques")
    public List<Map<String, Object>> pending(
            Authentication auth
    ) {
        return service.pendingCheques(
            auth.getName()
        );
    }

    @GetMapping("/{receiptId}")
    public ResponseEntity<FileSystemResource> proof(
            @PathVariable long receiptId,
            Authentication auth
    ) {
        var path = service.proofForAdmin(
            auth.getName(),
            receiptId
        );

        return ResponseEntity.ok()
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=payment-proof"
            )
            .contentType(
                MediaType.APPLICATION_OCTET_STREAM
            )
            .body(new FileSystemResource(path));
    }

    @PostMapping("/{receiptId}/approve-cheque")
    public ResponseEntity<Void> approve(
            @PathVariable long receiptId,
            Authentication auth
    ) {
        service.approveCheque(
            auth.getName(),
            receiptId
        );

        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{receiptId}/confirm-cleared")
    public ResponseEntity<Void> cleared(
            @PathVariable long receiptId,
            Authentication auth
    ) {
        service.confirmChequeCleared(
            auth.getName(),
            receiptId
        );

        return ResponseEntity.noContent().build();
    }
}
