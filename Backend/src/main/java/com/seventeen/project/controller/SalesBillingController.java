
package com.seventeen.project.controller;

import com.seventeen.project.service.SalesBillingService;
import com.seventeen.project.service.SalesBillPaymentService;

import com.seventeen.project.service.SalesBillingService.CreateBillRequest;
import com.seventeen.project.service.SalesBillingService.CashReceiptRequest;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/sales/bills")
@PreAuthorize(
    "hasAnyAuthority('ROLE_SALES_MANAGER', 'SALES_MANAGER')"
)
public class SalesBillingController {

    // ==========================================
    // SERVICES
    // ==========================================

    private final SalesBillingService service;

    private final SalesBillPaymentService paymentService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public SalesBillingController(
        SalesBillingService service,
        SalesBillPaymentService paymentService
    ) {
        this.service = service;
        this.paymentService = paymentService;
    }

    // ==========================================
    // SECTION 1: SALES BILLING
    //
    // Existing billing functionality retained.
    //
    // Batch-aware validation, stock deduction,
    // and invoice traceability are implemented
    // in SalesBillingService.java.
    //
    // Production batch selection uses:
    //
    // - Batch stock ID
    // - Product ID
    // - Flavour
    // - Available batch quantity
    // - Available aggregate lorry quantity
    //
    // No batch approval-status field is
    // required by this controller.
    // ==========================================

    // ==========================================
    // 1. GET BILLABLE PRODUCTS
    //
    // GET /api/sales/bills/products
    //
    // Returns products from the Sales Manager's
    // currently selected lorry with:
    //
    // - Product ID
    // - Product name
    // - Size
    // - Flavour
    // - Available quantity
    // - Admin-controlled wholesale unit price
    //
    // Existing endpoint unchanged.
    // ==========================================

    @GetMapping("/products")
    public List<Map<String, Object>> products(
        Authentication authentication
    ) {
        return service.billableProducts(
            authentication.getName()
        );
    }

    // ==========================================
    // 2. CREATE BATCH-AWARE SALES BILL
    //
    // POST /api/sales/bills
    //
    // The CreateBillRequest DTO contains:
    //
    // receiptKey
    // customerName
    // customerPhone
    // paymentMethod
    // items[]
    //
    // Each item contains:
    //
    // productId
    // flavour
    // quantity
    // vehicleBatchStockId
    //
    // Example:
    //
    // {
    //   "receiptKey": "<UUID>",
    //   "customerName": "ABC Shop",
    //   "customerPhone": "0771234567",
    //   "paymentMethod": "CASH",
    //   "items": [
    //     {
    //       "productId": "4l-bag",
    //       "flavour": "Chocolate",
    //       "quantity": 1,
    //       "vehicleBatchStockId": 41
    //     },
    //     {
    //       "productId": "4l-bag",
    //       "flavour": "Chocolate",
    //       "quantity": 2,
    //       "vehicleBatchStockId": 42
    //     }
    //   ]
    // }
    //
    // IMPORTANT:
    //
    // - The authenticated Sales Manager's
    //   active lorry is identified by service.
    //
    // - The selected batch must belong to the
    //   requested product and active lorry.
    //
    // - The quantity must be available in
    //   the selected production batch.
    //
    // - Different batches of the same product
    //   are saved as separate invoice items.
    //
    // - The service deducts both aggregate
    //   vehicle stock and batch-specific stock
    //   in one database transaction.
    //
    // - The invoice stores batch-number
    //   snapshots for future PDF generation.
    //
    // - The receipt key prevents duplicate
    //   stock deductions on request retries.
    //
    // - Saving the invoice does not confirm
    //   Cash, Bank Transfer or Cheque payment.
    //
    // - No batch approval-status field is
    //   required in the request.
    //
    // Supported payment methods:
    //
    // CASH
    // CREDIT
    // BANK_TRANSFER
    // CHEQUE
    // ==========================================

    @PostMapping
    public ResponseEntity<Map<String, Object>> createBill(
        Authentication authentication,
        @RequestBody CreateBillRequest request
    ) {
        Map<String, Object> createdBill =
            service.createBill(
                authentication.getName(),
                request
            );

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .cacheControl(CacheControl.noStore())
            .body(createdBill);
    }

    // ==========================================
    // 3. GET SALES CREDIT BALANCES
    //
    // GET /api/sales/bills/credit-balances
    //
    // Existing endpoint unchanged.
    //
    // Credit balances are calculated from
    // confirmed payment records.
    //
    // Pending bank transfers and uncleared
    // cheques are not counted as paid.
    //
    // Payment statuses are independent of
    // production batch records.
    // ==========================================

    @GetMapping("/credit-balances")
    public ResponseEntity<List<Map<String, Object>>>
        getCreditBalances(
            Authentication authentication
        ) {

        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(
                service.getCreditBalances(
                    authentication.getName()
                )
            );
    }

    // ==========================================
    // 4. GET SPECIFIC SALES INVOICE
    //
    // GET /api/sales/bills/{billId}
    //
    // The response includes saved batch
    // details for each invoice item:
    //
    // - productId
    // - productName
    // - size
    // - flavour
    // - batchNumber
    // - vehicleBatchStockId
    // - quantity
    // - unitPrice
    // - lineTotal
    //
    // These batch details come from the
    // bill-to-batch records saved in PostgreSQL.
    //
    // The frontend uses this response to
    // generate accurate invoice PDFs.
    //
    // Older invoices without batch records
    // remain accessible.
    //
    // Only the invoice owner may retrieve it.
    //
    // Existing endpoint unchanged.
    // ==========================================

    @GetMapping("/{billId:[0-9]+}")
    public Map<String, Object> getBill(
        Authentication authentication,
        @PathVariable long billId
    ) {
        return service.billById(
            authentication.getName(),
            billId
        );
    }

    // ==========================================
    // 5. RECORD CASH DURING BILLING
    //
    // POST /api/sales/bills/{billId}/cash
    //
    // Existing endpoint unchanged.
    //
    // Used after physical cash has actually
    // been received from the customer.
    // ==========================================

    @PostMapping("/{billId:[0-9]+}/cash")
    public Map<String, Object> receiveCash(
        Authentication authentication,
        @PathVariable long billId,
        @RequestBody CashReceiptRequest request
    ) {
        return service.receiveCash(
            authentication.getName(),
            billId,
            request
        );
    }

    // ==========================================
    // 6. COLLECT OUTSTANDING CREDIT CASH
    //
    // POST /api/sales/bills/{billId}/collections
    //
    // Existing endpoint unchanged.
    //
    // Allows the Sales Manager to record cash
    // collected later for an outstanding
    // direct-sales CREDIT invoice.
    // ==========================================

    @PostMapping("/{billId:[0-9]+}/collections")
    public Map<String, Object> collectCreditCash(
        Authentication authentication,
        @PathVariable long billId,
        @RequestBody CashReceiptRequest request
    ) {
        return service.receiveCash(
            authentication.getName(),
            billId,
            request
        );
    }

    // ==========================================
    // SECTION 2: COMPANY BANK DETAILS
    // ==========================================

    // ==========================================
    // 7. GET COMPANY BANK DETAILS
    //
    // GET /api/sales/bills/company-bank-details
    //
    // Existing endpoint unchanged.
    //
    // Details come from backend configuration,
    // not hardcoded frontend values.
    //
    // Returns:
    //
    // - Company account name
    // - Bank name
    // - Branch
    // - Account number
    // - Cheque payee name
    //
    // Never expose bank login credentials.
    // ==========================================

    @GetMapping("/company-bank-details")
    public ResponseEntity<Map<String, Object>>
        companyBankDetails(
            Authentication authentication
        ) {

        Map<String, Object> details =
            paymentService.getCompanyBankDetails(
                authentication.getName()
            );

        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(details);
    }

    // ==========================================
    // SECTION 3: PAYMENT INFORMATION
    // ==========================================

    // ==========================================
    // 8. GET DIRECT SALES PAYMENT DETAILS
    //
    // GET /api/sales/bills/{billId}/payments
    //
    // Existing endpoint unchanged.
    //
    // Returns:
    //
    // - Invoice ID
    // - Invoice total
    // - Payment method
    // - Confirmed payment amount
    // - Remaining balance
    // - Bank / Cheque evidence status
    // - Admin review information
    //
    // Does not expose uploaded image bytes.
    //
    // SalesBillPaymentService verifies that
    // the authenticated Sales Manager owns
    // the requested invoice.
    // ==========================================

    @GetMapping("/{billId:[0-9]+}/payments")
    public ResponseEntity<Map<String, Object>>
        getBillPayments(
            Authentication authentication,
            @PathVariable long billId
        ) {

        Map<String, Object> payments =
            paymentService.getBillPayments(
                authentication.getName(),
                billId
            );

        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .body(payments);
    }

    // ==========================================
    // SECTION 4: BANK TRANSFER
    // ==========================================

    // ==========================================
    // 9. SUBMIT BANK TRANSFER SLIP
    //
    // POST /api/sales/bills/{billId}/bank-slip
    //
    // Content-Type: multipart/form-data
    //
    // Form fields:
    //
    // receiptKey
    // amount
    // transferReference
    // file
    //
    // Existing endpoint unchanged.
    //
    // The bank transfer must equal the
    // complete invoice amount.
    //
    // Upload status: PENDING_REVIEW
    //
    // Only Admin verification of an actual
    // bank deposit can confirm payment.
    // ==========================================

    @PostMapping(
        value = "/{billId:[0-9]+}/bank-slip",
        consumes = "multipart/form-data"
    )
    public ResponseEntity<Map<String, Object>>
        submitBankSlip(

            Authentication authentication,

            @PathVariable long billId,

            @RequestParam("receiptKey")
            UUID receiptKey,

            @RequestParam("amount")
            BigDecimal amount,

            @RequestParam("transferReference")
            String transferReference,

            @RequestParam("file")
            MultipartFile file

        ) {

        Map<String, Object> result =
            paymentService.submitBankSlip(
                authentication.getName(),
                billId,
                receiptKey,
                amount,
                transferReference,
                file
            );

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .cacheControl(CacheControl.noStore())
            .body(result);
    }

    // ==========================================
    // SECTION 5: CHEQUE PAYMENTS
    // ==========================================

    // ==========================================
    // 10. SUBMIT CHEQUE PHOTOGRAPH
    //
    // POST /api/sales/bills/{billId}/cheque
    //
    // Content-Type: multipart/form-data
    //
    // Form fields:
    //
    // receiptKey
    // amount
    // chequeNumber
    // issuingBank
    // chequeDate
    // file
    //
    // Existing endpoint unchanged.
    //
    // Cheque amount must equal the complete
    // invoice total.
    //
    // Status progression:
    //
    // PENDING_REVIEW
    // APPROVED
    // CONFIRMED
    //
    // Only bank-cleared and CONFIRMED
    // cheques count as paid.
    //
    // These are payment statuses, not
    // production batch statuses.
    // ==========================================

    @PostMapping(
        value = "/{billId:[0-9]+}/cheque",
        consumes = "multipart/form-data"
    )
    public ResponseEntity<Map<String, Object>>
        submitCheque(

            Authentication authentication,

            @PathVariable long billId,

            @RequestParam("receiptKey")
            UUID receiptKey,

            @RequestParam("amount")
            BigDecimal amount,

            @RequestParam("chequeNumber")
            String chequeNumber,

            @RequestParam("issuingBank")
            String issuingBank,

            @RequestParam("chequeDate")
            LocalDate chequeDate,

            @RequestParam("file")
            MultipartFile file

        ) {

        Map<String, Object> result =
            paymentService.submitCheque(
                authentication.getName(),
                billId,
                receiptKey,
                amount,
                chequeNumber,
                issuingBank,
                chequeDate,
                file
            );

        return ResponseEntity
            .status(HttpStatus.CREATED)
            .cacheControl(CacheControl.noStore())
            .body(result);
    }
}
