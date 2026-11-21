
package com.seventeen.project.controller;

import com.seventeen.project.dto.CreateSalesReturnRequest;
import com.seventeen.project.service.SalesReturnService;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/sales/returns")
public class SalesReturnController {

    private final SalesReturnService returnService;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public SalesReturnController(
            SalesReturnService returnService
    ) {
        this.returnService = returnService;
    }

    // ==========================================
    // GET AUTHENTICATED SALES MANAGER
    //
    // Uses the email from the JWT identity.
    // The frontend does not send a user ID.
    // ==========================================

    private String authenticatedEmail(
            Principal principal
    ) {
        if (
                principal == null ||
                principal.getName() == null ||
                principal.getName().isBlank()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in as a Sales Manager"
            );
        }

        return principal.getName();
    }

    // ==========================================
    // 1. GET RETURNABLE PRODUCTS
    //
    // GET /api/sales/returns/products
    //
    // Loads available product types from the
    // existing factory product catalog.
    //
    // Does not require an invoice number.
    // Does not deduct any lorry stock.
    // ==========================================

    @GetMapping("/products")
    public ResponseEntity<List<Map<String, Object>>>
            getReturnableProducts(
                    Principal principal
            ) {

        String email = authenticatedEmail(
                principal
        );

        List<Map<String, Object>> products =
                returnService.getReturnableProducts(
                        email
                );

        return ResponseEntity.ok(products);
    }

    // ==========================================
    // 2. GET PRODUCT RETURN HISTORY
    //
    // GET /api/sales/returns
    //
    // SalesReturnService identifies the
    // authenticated Sales Manager and the
    // currently selected sales vehicle.
    //
    // No additional vehicle ID is supplied
    // by the React frontend.
    // ==========================================

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>>
            getReturnHistory(
                    Principal principal
            ) {

        String email = authenticatedEmail(
                principal
        );

        List<Map<String, Object>> returns =
                returnService.getReturns(
                        email
                );

        return ResponseEntity.ok(returns);
    }

    // ==========================================
    // 3. CREATE PRODUCT RETURN
    //
    // POST /api/sales/returns
    //
    // SALES MANAGER DIRECT WORKFLOW
    //
    // No invoice required.
    // No Admin approval required.
    // No new lorry selection required.
    //
    // The service:
    //
    // 1. Identifies Sales Manager from JWT.
    // 2. Gets their existing active lorry.
    // 3. Validates returned product details.
    // 4. Validates the replacement product.
    // 5. Checks available lorry stock.
    // 6. Deducts the replacement quantity.
    // 7. Records returned stock as quarantined.
    // 8. Saves everything transactionally.
    // ==========================================

    @PostMapping
    public ResponseEntity<Map<String, Object>>
            createReturn(
                    @RequestBody
                    CreateSalesReturnRequest request,

                    Principal principal
            ) {

        String email = authenticatedEmail(
                principal
        );

        Map<String, Object> savedReturn =
                returnService.createReturn(
                        email,
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedReturn);
    }
}
