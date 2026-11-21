
package com.seventeen.project.controller;

import com.seventeen.project.dto.RecordPaymentRequest;
import com.seventeen.project.service.WholesalePaymentService;

import jakarta.validation.Valid;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
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
@RequestMapping("/api/sales/payments")
@PreAuthorize("hasRole('SALES_MANAGER')")
public class SalesPaymentController {

    private final WholesalePaymentService service;

    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    public SalesPaymentController(
            WholesalePaymentService service
    ) {
        this.service = service;
    }

    // =====================================================
    // 1. GET WHOLESALE ORDER PAYMENT SUMMARY
    //
    // Sales Manager can view:
    //
    // - Order total
    // - Confirmed paid amount
    // - Remaining balance
    // - Payment receipt history
    // - Admin bank transfer approval status
    //
    // This endpoint is read-only.
    // =====================================================

    @GetMapping("/orders/{orderId}")
    public Map<String, Object> summary(
            @PathVariable long orderId,
            Authentication auth
    ) {

        return service.summaryForSales(
                auth.getName(),
                orderId
        );
    }

    // =====================================================
    // 2. RECORD CASH RECEIVED
    //
    // EXISTING FUNCTIONALITY RETAINED
    //
    // Sales Manager can record actual cash
    // received from wholesale customers.
    //
    // This also supports existing credit
    // balance payment collection.
    // =====================================================

    @PostMapping("/orders/{orderId}/cash")
    public ResponseEntity<Void> receiveCash(
            @PathVariable long orderId,
            @Valid @RequestBody
            RecordPaymentRequest request,
            Authentication auth
    ) {

        service.receiveCash(
                auth.getName(),
                orderId,
                request.receiptKey(),
                request.amount()
        );

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // 3. SUBMIT CHEQUE FOR ADMIN REVIEW
    //
    // EXISTING FUNCTIONALITY RETAINED
    //
    // Sales Manager can upload cheque proof.
    //
    // Cheque submission does not mean
    // payment has been confirmed.
    //
    // Admin approval and bank clearance
    // are required.
    // =====================================================

    @PostMapping(
            value = "/orders/{orderId}/cheque",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<Void> uploadCheque(
            @PathVariable long orderId,
            @RequestParam UUID receiptKey,
            @RequestParam BigDecimal amount,
            @RequestPart("file") MultipartFile file,
            Authentication auth
    ) {

        service.submitCheque(
                auth.getName(),
                orderId,
                receiptKey,
                amount,
                file
        );

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // BANK TRANSFER VERIFICATION REMOVED
    // =====================================================
    //
    // Previous endpoint removed:
    //
    // POST /api/sales/payments/bank/{receiptId}/verify
    //
    // Previous controller method removed:
    //
    // verifyBank()
    //
    // Sales Manager must NOT:
    //
    // - Verify bank transfers
    // - Approve bank payments
    // - Reject bank payments
    // - Review uploaded bank slips
    //
    // These operations belong to the
    // Admin payment controller.
    //
    // Sales Manager can read payment status
    // through the existing summary endpoint.
    //
    // =====================================================

    // =====================================================
    // 4. VIEW AUTHORIZED PAYMENT PROOF
    //
    // EXISTING CHEQUE PROOF FUNCTIONALITY RETAINED
    //
    // IMPORTANT:
    //
    // WholesalePaymentService.proofForSales()
    // must enforce the following restrictions:
    //
    // 1. Receipt belongs to an assigned order.
    // 2. Sales Manager has permission to access it.
    // 3. Receipt is NOT a BANK_TRANSFER receipt.
    //
    // Only Admin can review bank transfer slips.
    //
    // =====================================================

    @GetMapping("/proof/{receiptId}")
    public ResponseEntity<FileSystemResource> proof(
            @PathVariable long receiptId,
            Authentication auth
    ) {

        var path = service.proofForSales(
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
}
