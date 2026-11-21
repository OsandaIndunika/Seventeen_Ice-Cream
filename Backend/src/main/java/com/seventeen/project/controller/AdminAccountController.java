
package com.seventeen.project.controller;

import com.seventeen.project.dto.AuthDtos.*;
import com.seventeen.project.service.AdminAccountService;
import com.seventeen.project.service.WholesalePaymentService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Locale;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAccountController {

    private final AdminAccountService service;

    private final WholesalePaymentService paymentService;

    private final JdbcTemplate jdbc;

    // =====================================================
    // CONSTRUCTOR
    // =====================================================

    public AdminAccountController(
            AdminAccountService service,
            WholesalePaymentService paymentService,
            JdbcTemplate jdbc
    ) {
        this.service = service;
        this.paymentService = paymentService;
        this.jdbc = jdbc;
    }

    // =====================================================
    // SECTION 1: EXISTING ADMIN ACCOUNT MANAGEMENT
    //
    // All existing URLs and functionality retained.
    // =====================================================

    // 1. GET ALL ACCOUNTS

    @GetMapping("/accounts")
    public List<UserResponse> all() {

        return service.all();
    }

    // 2. CREATE STAFF ACCOUNT

    @PostMapping("/accounts")
    public ResponseEntity<UserResponse> create(
            @Valid @RequestBody CreateStaffRequest req
    ) {

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(service.create(req));
    }

    // 3. CHANGE EMAIL

    @PutMapping("/accounts/{id}/email")
    public UserResponse email(
            @PathVariable Long id,
            @Valid @RequestBody EmailRequest req
    ) {

        return service.changeEmail(id, req);
    }

    // 4. RESET PASSWORD

    @PutMapping("/accounts/{id}/password")
    public ResponseEntity<Void> password(
            @PathVariable Long id,
            @Valid @RequestBody PasswordResetRequest req
    ) {

        service.resetPassword(id, req);

        return ResponseEntity.noContent().build();
    }

    // 5. UPDATE ACCOUNT STATUS

    @PatchMapping("/accounts/{id}/status")
    public UserResponse status(
            @PathVariable Long id,
            @RequestBody StatusRequest req
    ) {

        return service.changeStatus(id, req);
    }

    // 6. CHANGE ACCOUNT ROLE

    @PutMapping("/accounts/{id}/role")
    public UserResponse role(
            @PathVariable Long id,
            @Valid @RequestBody RoleRequest req
    ) {

        return service.changeRole(id, req);
    }

    // =====================================================
    // SECTION 2: EXISTING BANK TRANSFER MANAGEMENT
    //
    // All existing bank transfer endpoints retained.
    // =====================================================

    // 7. LIST BANK TRANSFERS

    @GetMapping("/payments/bank-transfers")
    public ResponseEntity<List<Map<String, Object>>>
            getBankTransfers(
                    Authentication auth
            ) {

        List<Map<String, Object>> receipts =
                paymentService.getBankTransfers(
                        auth.getName()
                );

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(receipts);
    }

    // 8. VIEW BANK TRANSFER PROOF

    @GetMapping(
            "/payments/bank-transfers/{receiptId}/proof"
    )
    public ResponseEntity<FileSystemResource>
            getBankTransferProof(
                    @PathVariable long receiptId,
                    Authentication auth
            ) {

        Path path =
                paymentService.proofForAdminBankTransfer(
                        auth.getName(),
                        receiptId
                );

        FileSystemResource resource =
                new FileSystemResource(path);

        String filename =
                path.getFileName().toString();

        MediaType mediaType =
                getProofMediaType(filename);

        String extension =
                getProofExtension(filename);

        String downloadName =
                "bank-slip-" +
                receiptId +
                extension;

        ContentDisposition disposition =
                ContentDisposition.inline()
                        .filename(downloadName)
                        .build();

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )
                .header(
                        "X-Content-Type-Options",
                        "nosniff"
                )
                .cacheControl(CacheControl.noStore())
                .contentType(mediaType)
                .body(resource);
    }

    // 9. APPROVE BANK TRANSFER

    @PostMapping(
            "/payments/bank-transfers/{receiptId}/approve"
    )
    public ResponseEntity<Void> approveBankTransfer(
            @PathVariable long receiptId,
            @Valid @RequestBody
            BankTransferApprovalRequest request,
            Authentication auth
    ) {

        paymentService.approveBankTransfer(
                auth.getName(),
                receiptId,
                request.amount()
        );

        return ResponseEntity.noContent().build();
    }

    // 10. REJECT BANK TRANSFER

    @PostMapping(
            "/payments/bank-transfers/{receiptId}/reject"
    )
    public ResponseEntity<Void> rejectBankTransfer(
            @PathVariable long receiptId,
            @Valid @RequestBody
            BankTransferRejectionRequest request,
            Authentication auth
    ) {

        paymentService.rejectBankTransfer(
                auth.getName(),
                receiptId,
                request.reason().trim()
        );

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // SECTION 3: NEW ADMIN CHEQUE PAYMENT MANAGEMENT
    //
    // Only ADMIN can use these endpoints.
    //
    // Cheque status workflow:
    //
    // PENDING_REVIEW -> APPROVED -> CONFIRMED
    //
    // Rejection:
    //
    // PENDING_REVIEW -> REJECTED
    // APPROVED       -> REJECTED
    //
    // A cheque only counts as paid once CONFIRMED.
    // =====================================================

    // =====================================================
    // 11. GET ALL CHEQUE PAYMENT RECEIPTS
    //
    // GET /api/admin/payments/cheques
    //
    // Includes:
    //
    // - Pending cheques
    // - Approved cheques
    // - Confirmed cheques
    // - Rejected cheques
    // - Proof availability
    //
    // Uses the existing payment records table.
    // =====================================================

    @GetMapping("/payments/cheques")
    public ResponseEntity<List<Map<String, Object>>>
            getChequePayments(
                    Authentication auth
            ) {

        List<Map<String, Object>> cheques =
                jdbc.queryForList(
                        """
                        SELECT
                            id,

                            order_id AS "orderId",

                            vehicle_id AS "vehicleId",

                            amount,

                            status,

                            created_at AS "createdAt",

                            confirmed_at AS "confirmedAt",

                            reviewed_by AS "reviewedBy",

                            created_by AS "createdBy",

                            proof_original_name
                                AS "proofOriginalName",

                            (
                                proof_path IS NOT NULL
                            ) AS "hasProof",

                            rejection_reason
                                AS "rejectionReason"

                        FROM public.wholesale_payment_records

                        WHERE method = 'CHEQUE'

                        ORDER BY
                            CASE
                                WHEN status = 'PENDING_REVIEW'
                                    THEN 0
                                WHEN status = 'APPROVED'
                                    THEN 1
                                WHEN status = 'CONFIRMED'
                                    THEN 2
                                ELSE 3
                            END,

                            created_at DESC,

                            id DESC
                        """
                );

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(cheques);
    }

    // =====================================================
    // 12. GET UPLOADED CHEQUE PHOTO
    //
    // GET /api/admin/payments/cheques/{receiptId}/proof
    //
    // Uses existing secure proof storage.
    //
    // Confirms that the requested receipt
    // is specifically a CHEQUE receipt.
    //
    // Does not expose bank transfer slips
    // through the cheque endpoint.
    // =====================================================

    @GetMapping(
            "/payments/cheques/{receiptId}/proof"
    )
    public ResponseEntity<FileSystemResource>
            getChequeProof(
                    @PathVariable long receiptId,
                    Authentication auth
            ) {

        if (receiptId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid cheque receipt ID"
            );
        }

        // Confirm that this is a cheque record.

        List<Long> chequeIds =
                jdbc.query(
                        """
                        SELECT id
                        FROM public.wholesale_payment_records
                        WHERE id = ?
                          AND method = 'CHEQUE'
                          AND proof_path IS NOT NULL
                        """,

                        (rs, rowNum) ->
                                rs.getLong("id"),

                        receiptId
                );

        if (chequeIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Cheque proof not found"
            );
        }

        // Existing service checks Admin identity
        // and validates the private proof path.

        Path path =
                paymentService.proofForAdmin(
                        auth.getName(),
                        receiptId
                );

        FileSystemResource resource =
                new FileSystemResource(path);

        String filename =
                path.getFileName().toString();

        MediaType mediaType =
                getProofMediaType(filename);

        String downloadName =
                "cheque-" +
                receiptId +
                getProofExtension(filename);

        ContentDisposition disposition =
                ContentDisposition.inline()
                        .filename(downloadName)
                        .build();

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        disposition.toString()
                )
                .header(
                        "X-Content-Type-Options",
                        "nosniff"
                )
                .cacheControl(CacheControl.noStore())
                .contentType(mediaType)
                .body(resource);
    }

    // =====================================================
    // 13. APPROVE CHEQUE
    //
    // POST /api/admin/payments/cheques/{receiptId}/approve
    //
    // PENDING_REVIEW -> APPROVED
    //
    // Important:
    // Approval is not bank clearance.
    // =====================================================

    @PostMapping(
            "/payments/cheques/{receiptId}/approve"
    )
    public ResponseEntity<Void> approveCheque(
            @PathVariable long receiptId,
            Authentication auth
    ) {

        paymentService.approveCheque(
                auth.getName(),
                receiptId
        );

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // 14. CONFIRM CHEQUE BANK CLEARANCE
    //
    // POST /api/admin/payments/cheques/{receiptId}/confirm-cleared
    //
    // APPROVED -> CONFIRMED
    //
    // Only use after verifying the cheque has
    // actually cleared through the bank.
    //
    // This updates the confirmed paid amount
    // and the customer's remaining balance.
    // =====================================================

    @PostMapping(
            "/payments/cheques/{receiptId}/confirm-cleared"
    )
    public ResponseEntity<Void> confirmChequeCleared(
            @PathVariable long receiptId,
            Authentication auth
    ) {

        paymentService.confirmChequeCleared(
                auth.getName(),
                receiptId
        );

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // 15. REJECT CHEQUE
    //
    // POST /api/admin/payments/cheques/{receiptId}/reject
    //
    // Uses the existing rejection_reason column.
    //
    // A rejected cheque does not count as paid.
    //
    // This operation is transactional.
    // =====================================================

    @PostMapping(
            "/payments/cheques/{receiptId}/reject"
    )
    @Transactional
    public ResponseEntity<Void> rejectCheque(
            @PathVariable long receiptId,

            @Valid @RequestBody
            ChequeRejectionRequest request,

            Authentication auth
    ) {

        if (receiptId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid cheque receipt ID"
            );
        }

        String reason = request.reason().trim();

        // Find the authenticated enabled Admin ID.

        List<Long> adminIds =
                jdbc.query(
                        """
                        SELECT id

                        FROM public.app_users

                        WHERE LOWER(email) = LOWER(?)
                          AND role = 'ADMIN'
                          AND enabled = TRUE
                        """,

                        (rs, rowNum) ->
                                rs.getLong("id"),

                        auth.getName()
                );

        if (adminIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only an enabled Admin can reject cheques"
            );
        }

        long adminId = adminIds.get(0);

        // Find the order associated with this cheque.

        List<Long> orderIds =
                jdbc.query(
                        """
                        SELECT order_id

                        FROM public.wholesale_payment_records

                        WHERE id = ?
                          AND method = 'CHEQUE'
                        """,

                        (rs, rowNum) ->
                                rs.getLong("order_id"),

                        receiptId
                );

        if (orderIds.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Cheque receipt not found"
            );
        }

        long orderId = orderIds.get(0);

        // Lock the wholesale order so that cheque
        // rejection and bank-clearance confirmation
        // cannot modify this order concurrently.
        //
        // This follows the same locking approach
        // used by the payment service.

        List<Long> lockedOrders =
                jdbc.query(
                        """
                        SELECT id

                        FROM public.wholesale_orders

                        WHERE id = ?

                        FOR UPDATE
                        """,

                        (rs, rowNum) ->
                                rs.getLong("id"),

                        orderId
                );

        if (lockedOrders.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Wholesale order not found"
            );
        }

        // Reject only a pending or approved cheque.
        //
        // An already CONFIRMED cheque cannot be
        // rejected through this endpoint.

        int changed =
                jdbc.update(
                        """
                        UPDATE public.wholesale_payment_records

                        SET
                            status = 'REJECTED',

                            reviewed_by = ?,

                            rejection_reason = ?

                        WHERE id = ?

                          AND method = 'CHEQUE'

                          AND status IN (
                              'PENDING_REVIEW',
                              'APPROVED'
                          )
                        """,

                        adminId,
                        reason,
                        receiptId
                );

        if (changed != 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cheque cannot be rejected from its current status"
            );
        }

        return ResponseEntity.noContent().build();
    }

    // =====================================================
    // SECTION 4: PROOF FILE CONTENT TYPE HELPERS
    //
    // Existing helpers retained.
    //
    // Reused for bank slips and cheque photos.
    // =====================================================

    private MediaType getProofMediaType(
            String filename
    ) {

        String name =
                filename.toLowerCase(Locale.ROOT);

        if (
                name.endsWith(".jpg") ||
                name.endsWith(".jpeg")
        ) {
            return MediaType.IMAGE_JPEG;
        }

        if (name.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }

        if (name.endsWith(".pdf")) {
            return MediaType.APPLICATION_PDF;
        }

        return MediaType.APPLICATION_OCTET_STREAM;
    }

    private String getProofExtension(
            String filename
    ) {

        String name =
                filename.toLowerCase(Locale.ROOT);

        if (
                name.endsWith(".jpg") ||
                name.endsWith(".jpeg")
        ) {
            return ".jpg";
        }

        if (name.endsWith(".png")) {
            return ".png";
        }

        if (name.endsWith(".pdf")) {
            return ".pdf";
        }

        return "";
    }

    // =====================================================
    // SECTION 5: REQUEST DTOs
    //
    // Existing bank transfer DTOs retained.
    // New cheque rejection DTO added.
    // =====================================================

    // EXISTING BANK TRANSFER APPROVAL DTO

    public record BankTransferApprovalRequest(

            @NotNull(
                    message = "Verified payment amount is required"
            )

            @DecimalMin(
                    value = "0.01",
                    message = "Verified amount must be greater than zero"
            )

            @Digits(
                    integer = 10,
                    fraction = 2,
                    message = "Enter a valid amount with at most two decimal places"
            )

            BigDecimal amount

    ) {
    }

    // EXISTING BANK TRANSFER REJECTION DTO

    public record BankTransferRejectionRequest(

            @NotBlank(
                    message = "Rejection reason is required"
            )

            @Size(
                    max = 500,
                    message = "Rejection reason cannot exceed 500 characters"
            )

            String reason

    ) {
    }

    // NEW CHEQUE REJECTION DTO

    public record ChequeRejectionRequest(

            @NotBlank(
                    message = "Cheque rejection reason is required"
            )

            @Size(
                    max = 500,
                    message = "Rejection reason cannot exceed 500 characters"
            )

            String reason

    ) {
    }
}
