
package com.seventeen.project.controller;

import java.security.Principal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.jdbc.core.JdbcTemplate;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/outlet/pos")
@PreAuthorize("hasRole('OUTLET_MANAGER')")
public class OutletBatchInventoryController {

    // ========================================
    // DATABASE
    // ========================================

    private final JdbcTemplate jdbc;

    public OutletBatchInventoryController(
            JdbcTemplate jdbc
    ) {
        this.jdbc = jdbc;
    }

    // ========================================
    // AUTHENTICATED OUTLET MANAGER
    //
    // Find the outlet assigned to the
    // currently authenticated manager.
    //
    // Does not assume only one outlet exists
    // in the entire database.
    // ========================================

    private long getOutletId(Principal principal) {

        if (
            principal == null ||
            principal.getName() == null ||
            principal.getName().isBlank()
        ) {
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Please sign in as Outlet Manager"
            );
        }

        List<Long> outlets = jdbc.queryForList(
            """
            SELECT o.id

            FROM public.outlet_pos_locations o

            JOIN public.app_users u
                ON u.id = o.manager_user_id

            WHERE LOWER(u.email) = LOWER(?)
              AND u.role = 'OUTLET_MANAGER'
              AND u.enabled = TRUE
              AND o.active = TRUE

            ORDER BY o.id
            """,
            Long.class,
            principal.getName().trim()
        );

        if (outlets.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "No active retail outlet is assigned " +
                "to this Outlet Manager"
            );
        }

        if (outlets.size() > 1) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Multiple active outlets are assigned " +
                "to this manager. Configure one " +
                "active outlet before continuing."
            );
        }

        return outlets.get(0);
    }

    // ========================================
    // GET BOTH FREEZERS BY PRODUCTION BATCH
    //
    // GET /api/outlet/pos/batch-inventory
    //
    // READ-ONLY.
    // DOES NOT MODIFY STOCK.
    //
    // Supports:
    //
    // FREEZER_1 - RETAIL BILLING
    // FREEZER_2 - STOCK TRANSFER
    //
    // Each product contains a batches array.
    //
    // Each batch includes:
    //
    // freezerBatchStockId
    // batchId
    // batchNumber
    // quantity
    // batchQuantity
    // availableQuantity
    //
    // No quality_status or expiry filtering.
    // ========================================

    @GetMapping("/batch-inventory")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>>
    getBatchInventory(Principal principal) {

        // ====================================
        // STEP 1: IDENTIFY THE OUTLET
        // ====================================

        long outletId = getOutletId(principal);

        // ====================================
        // STEP 2: RETRIEVE FREEZER STOCK
        //
        // Use the real freezer batch stock ID.
        //
        // bs.id = freezerBatchStockId
        // bs.batch_id = production batch ID
        //
        // Preserve products without batches
        // using LEFT JOIN.
        // ====================================

        List<Map<String, Object>> rows =
            jdbc.queryForList(
                """
                SELECT
                    f.id AS "freezerId",

                    f.freezer_code
                        AS "freezerCode",

                    f.freezer_name
                        AS "freezerName",

                    s.id AS "stockId",

                    s.product_id
                        AS "productId",

                    COALESCE(
                        p.name,
                        s.product_id
                    ) AS "productName",

                    COALESCE(
                        p.size,
                        ''
                    ) AS "size",

                    s.flavour AS "flavour",

                    s.quantity
                        AS "totalQuantity",

                    bs.id
                        AS "freezerBatchStockId",

                    bs.batch_id
                        AS "batchId",

                    b.batch_number
                        AS "batchNumber",

                    bs.quantity
                        AS "batchQuantity"

                FROM public.outlet_pos_stock s

                JOIN public.outlet_pos_freezers f
                    ON f.id = s.freezer_id

                LEFT JOIN public.wholesale_products p
                    ON p.id = s.product_id

                LEFT JOIN public.outlet_freezer_batch_stock bs
                    ON bs.freezer_stock_id = s.id

                LEFT JOIN public.product_batches b
                    ON b.id = bs.batch_id

                WHERE f.outlet_id = ?

                  AND f.freezer_code IN (
                      'FREEZER_1',
                      'FREEZER_2'
                  )

                ORDER BY
                    f.freezer_code,
                    COALESCE(
                        p.name,
                        s.product_id
                    ),
                    COALESCE(p.size, ''),
                    s.flavour,
                    b.batch_number,
                    bs.id
                """,
                outletId
            );

        // ====================================
        // STEP 3: GROUP STOCK BY PRODUCT
        //
        // Preserve the grouped response used
        // by OutletManagerOperations.jsx.
        // ====================================

        Map<Long, Map<String, Object>> grouped =
            new LinkedHashMap<>();

        for (Map<String, Object> row : rows) {

            long stockId =
                ((Number) row.get("stockId"))
                    .longValue();

            Map<String, Object> product =
                grouped.get(stockId);

            // =================================
            // CREATE PRODUCT GROUP
            // =================================

            if (product == null) {

                product = new LinkedHashMap<>();

                product.put(
                    "freezerId",
                    row.get("freezerId")
                );

                product.put(
                    "freezerCode",
                    row.get("freezerCode")
                );

                product.put(
                    "freezerName",
                    row.get("freezerName")
                );

                product.put(
                    "stockId",
                    stockId
                );

                product.put(
                    "productId",
                    row.get("productId")
                );

                product.put(
                    "productName",
                    row.get("productName")
                );

                product.put(
                    "size",
                    row.get("size")
                );

                product.put(
                    "flavour",
                    row.get("flavour")
                );

                int totalQuantity =
                    ((Number) row.get(
                        "totalQuantity"
                    )).intValue();

                product.put(
                    "totalQuantity",
                    totalQuantity
                );

                // Keep this additional alias
                // for frontend compatibility.

                product.put(
                    "quantity",
                    totalQuantity
                );

                product.put(
                    "allocatedQuantity",
                    0L
                );

                product.put(
                    "unallocatedQuantity",
                    0L
                );

                product.put(
                    "batches",
                    new ArrayList<Map<String, Object>>()
                );

                grouped.put(stockId, product);
            }

            // =================================
            // ADD PRODUCTION BATCH
            //
            // IMPORTANT:
            //
            // Only a real freezerBatchStockId
            // can be selected during billing.
            // =================================

            Object rawBatchStockId =
                row.get("freezerBatchStockId");

            if (rawBatchStockId != null) {

                long freezerBatchStockId =
                    ((Number) rawBatchStockId)
                        .longValue();

                Object rawBatchId =
                    row.get("batchId");

                Object rawBatchNumber =
                    row.get("batchNumber");

                if (
                    rawBatchId == null ||
                    rawBatchNumber == null
                ) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Production batch details are " +
                        "missing for freezer stock " +
                        stockId +
                        ". Check batch records."
                    );
                }

                long batchId =
                    ((Number) rawBatchId)
                        .longValue();

                String batchNumber =
                    String.valueOf(
                        rawBatchNumber
                    ).trim();

                if (batchNumber.isEmpty()) {
                    throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "An allocated production batch " +
                        "has no batch number for stock " +
                        stockId
                    );
                }

                int batchQuantity =
                    ((Number) row.get(
                        "batchQuantity"
                    )).intValue();

                // =================================
                // PREPARE BATCH OBJECT
                // =================================

                Map<String, Object> batch =
                    new LinkedHashMap<>();

                // The primary key of:
                // outlet_freezer_batch_stock

                batch.put(
                    "freezerBatchStockId",
                    freezerBatchStockId
                );

                // The primary key of:
                // product_batches

                batch.put(
                    "batchId",
                    batchId
                );

                batch.put(
                    "batchNumber",
                    batchNumber
                );

                // Existing frontend field.

                batch.put(
                    "quantity",
                    batchQuantity
                );

                // Explicit batch quantity.

                batch.put(
                    "batchQuantity",
                    batchQuantity
                );

                // Available for selection
                // before accounting for the
                // current React shopping cart.

                batch.put(
                    "availableQuantity",
                    batchQuantity
                );

                // =================================
                // ADD TO PRODUCT'S BATCH LIST
                // =================================

                @SuppressWarnings("unchecked")
                List<Map<String, Object>> batches =
                    (List<Map<String, Object>>)
                        product.get("batches");

                batches.add(batch);

                // =================================
                // UPDATE ALLOCATED QUANTITY
                // =================================

                long allocated =
                    ((Number) product.get(
                        "allocatedQuantity"
                    )).longValue();

                product.put(
                    "allocatedQuantity",
                    allocated + batchQuantity
                );
            }
        }

        // ====================================
        // STEP 4: CALCULATE UNALLOCATED STOCK
        //
        // totalQuantity - allocatedQuantity
        //
        // Expected to be zero when all stock
        // has been allocated to batches.
        // ====================================

        for (Map<String, Object> product :
                grouped.values()) {

            long total =
                ((Number) product.get(
                    "totalQuantity"
                )).longValue();

            long allocated =
                ((Number) product.get(
                    "allocatedQuantity"
                )).longValue();

            long unallocated =
                total - allocated;

            product.put(
                "unallocatedQuantity",
                unallocated
            );
        }

        // ====================================
        // STEP 5: RETURN GROUPED INVENTORY
        //
        // Do not cache quantities because
        // sales and transfers change stock.
        // ====================================

        return ResponseEntity.ok()
            .cacheControl(
                CacheControl.noStore()
            )
            .body(
                new ArrayList<>(
                    grouped.values()
                )
            );
    }
}
