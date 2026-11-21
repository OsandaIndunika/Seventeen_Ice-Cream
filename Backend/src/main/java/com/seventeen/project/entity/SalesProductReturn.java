
package com.seventeen.project.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;

@Entity
@Table(
    name = "sales_product_returns",
    schema = "public",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "sales_product_returns_receipt_key_key",
            columnNames = {"receipt_key"}
        )
    }
)
public class SalesProductReturn {

    // ==========================================
    // 1. PRIMARY KEY
    // ==========================================

    @Id
    @GeneratedValue(
        strategy = GenerationType.IDENTITY
    )
    @Column(name = "id")
    private Long id;

    // ==========================================
    // 2. IDEMPOTENCY KEY
    //
    // Prevents duplicate return submissions.
    // ==========================================

    @Column(
        name = "receipt_key",
        nullable = false,
        unique = true
    )
    private UUID receiptKey;

    // ==========================================
    // 3. ORIGINAL INVOICE
    //
    // Optional.
    // Returns do not require an invoice.
    //
    // Retained for compatibility with the
    // existing PostgreSQL table.
    // ==========================================

    @Column(name = "original_bill_id")
    private Long originalBillId;

    // ==========================================
    // 4. SALES MANAGER
    // ==========================================

    @Column(
        name = "sales_manager_user_id",
        nullable = false
    )
    private Long salesManagerUserId;

    // ==========================================
    // 5. SELECTED LORRY
    //
    // Vehicle is selected when the
    // Sales Manager starts the session.
    // ==========================================

    @Column(
        name = "vehicle_id",
        nullable = false
    )
    private Long vehicleId;

    // ==========================================
    // 6. SHOP DETAILS
    // ==========================================

    @Column(
        name = "shop_name",
        nullable = false,
        length = 200
    )
    private String shopName;

    @Column(
        name = "shop_phone",
        length = 30
    )
    private String shopPhone;

    // ==========================================
    // 7. RETURNED PRODUCT ID
    //
    // IMPORTANT:
    //
    // wholesale_products.id is VARCHAR.
    // vehicle_stock.product_id is VARCHAR.
    //
    // Example IDs:
    // 4l-bag
    // 1l-tub
    // popsicle
    //
    // Therefore this field must be String.
    // ==========================================

    @Column(
        name = "product_id",
        nullable = false,
        length = 100
    )
    private String productId;

    // ==========================================
    // 8. RETURNED PRODUCT NAME
    // ==========================================

    @Column(
        name = "product_name",
        nullable = false,
        length = 200
    )
    private String productName;

    // ==========================================
    // 9. RETURNED PRODUCT FLAVOUR
    // ==========================================

    @Column(
        name = "flavour",
        length = 100
    )
    private String flavour;

    // ==========================================
    // 10. BATCH NUMBER
    // ==========================================

    @Column(
        name = "batch_number",
        nullable = false,
        length = 100
    )
    private String batchNumber;

    // ==========================================
    // 11. RETURNED QUANTITY
    // ==========================================

    @Column(
        name = "returned_quantity",
        nullable = false
    )
    private Integer returnedQuantity;

    // ==========================================
    // 12. RETURN DATE
    // ==========================================

    @Column(
        name = "return_date",
        nullable = false
    )
    private LocalDate returnDate;

    // ==========================================
    // 13. RETURN REASON
    // ==========================================

    @Column(
        name = "return_reason",
        nullable = false,
        length = 500
    )
    private String returnReason;

    // ==========================================
    // 14. REPLACEMENT STOCK ID
    //
    // vehicle_stock.id is BIGINT.
    // Therefore this field remains Long.
    // ==========================================

    @Column(
        name = "replacement_stock_id"
    )
    private Long replacementStockId;

    // ==========================================
    // 15. REPLACEMENT PRODUCT ID
    //
    // Must be String because factory product
    // IDs contain letters and hyphens.
    // ==========================================

    @Column(
        name = "replacement_product_id",
        length = 100
    )
    private String replacementProductId;

    // ==========================================
    // 16. REPLACEMENT PRODUCT NAME
    // ==========================================

    @Column(
        name = "replacement_product_name",
        length = 200
    )
    private String replacementProductName;

    // ==========================================
    // 17. REPLACEMENT QUANTITY
    // ==========================================

    @Column(
        name = "replacement_quantity"
    )
    private Integer replacementQuantity;

    // ==========================================
    // 18. RETURNED GOODS CONDITION
    //
    // Returned items are quarantined.
    // They are NOT added back to saleable stock.
    // ==========================================

    @Column(
        name = "stock_condition",
        nullable = false,
        length = 30
    )
    private String stockCondition = "QUARANTINED";

    // ==========================================
    // 19. RETURN STATUS
    //
    // Replacement is issued directly.
    // No Admin approval required.
    // ==========================================

    @Column(
        name = "status",
        nullable = false,
        length = 30
    )
    private String status = "REPLACED";

    // ==========================================
    // 20. CREATED DATE
    // ==========================================

    @Column(
        name = "created_at",
        nullable = false,
        updatable = false
    )
    private OffsetDateTime createdAt;

    // ==========================================
    // 21. DEFAULT CONSTRUCTOR
    //
    // Required by JPA.
    // ==========================================

    public SalesProductReturn() {
    }

    // ==========================================
    // 22. DEFAULT VALUES BEFORE INSERT
    // ==========================================

    @PrePersist
    public void prePersist() {

        if (receiptKey == null) {
            receiptKey = UUID.randomUUID();
        }

        if (stockCondition == null) {
            stockCondition = "QUARANTINED";
        }

        if (status == null) {
            status = "REPLACED";
        }

        if (returnDate == null) {
            returnDate = LocalDate.now(
                ZoneId.of("Asia/Colombo")
            );
        }

        if (createdAt == null) {
            createdAt = OffsetDateTime.now(
                ZoneId.of("Asia/Colombo")
            );
        }
    }

    // ==========================================
    // 23. GETTERS AND SETTERS
    // ==========================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    // ==========================================
    // RECEIPT KEY
    // ==========================================

    public UUID getReceiptKey() {
        return receiptKey;
    }

    public void setReceiptKey(UUID receiptKey) {
        this.receiptKey = receiptKey;
    }

    // ==========================================
    // ORIGINAL BILL ID
    // ==========================================

    public Long getOriginalBillId() {
        return originalBillId;
    }

    public void setOriginalBillId(
            Long originalBillId
    ) {
        this.originalBillId = originalBillId;
    }

    // ==========================================
    // SALES MANAGER ID
    // ==========================================

    public Long getSalesManagerUserId() {
        return salesManagerUserId;
    }

    public void setSalesManagerUserId(
            Long salesManagerUserId
    ) {
        this.salesManagerUserId =
            salesManagerUserId;
    }

    // ==========================================
    // VEHICLE ID
    // ==========================================

    public Long getVehicleId() {
        return vehicleId;
    }

    public void setVehicleId(Long vehicleId) {
        this.vehicleId = vehicleId;
    }

    // ==========================================
    // SHOP NAME
    // ==========================================

    public String getShopName() {
        return shopName;
    }

    public void setShopName(String shopName) {
        this.shopName = shopName;
    }

    // ==========================================
    // SHOP PHONE
    // ==========================================

    public String getShopPhone() {
        return shopPhone;
    }

    public void setShopPhone(String shopPhone) {
        this.shopPhone = shopPhone;
    }

    // ==========================================
    // PRODUCT ID
    //
    // CORRECTED: String getter and setter.
    // ==========================================

    public String getProductId() {
        return productId;
    }

    public void setProductId(
            String productId
    ) {
        this.productId = productId;
    }

    // ==========================================
    // PRODUCT NAME
    // ==========================================

    public String getProductName() {
        return productName;
    }

    public void setProductName(
            String productName
    ) {
        this.productName = productName;
    }

    // ==========================================
    // FLAVOUR
    // ==========================================

    public String getFlavour() {
        return flavour;
    }

    public void setFlavour(
            String flavour
    ) {
        this.flavour = flavour;
    }

    // ==========================================
    // BATCH NUMBER
    // ==========================================

    public String getBatchNumber() {
        return batchNumber;
    }

    public void setBatchNumber(
            String batchNumber
    ) {
        this.batchNumber = batchNumber;
    }

    // ==========================================
    // RETURNED QUANTITY
    // ==========================================

    public Integer getReturnedQuantity() {
        return returnedQuantity;
    }

    public void setReturnedQuantity(
            Integer returnedQuantity
    ) {
        this.returnedQuantity = returnedQuantity;
    }

    // ==========================================
    // RETURN DATE
    // ==========================================

    public LocalDate getReturnDate() {
        return returnDate;
    }

    public void setReturnDate(
            LocalDate returnDate
    ) {
        this.returnDate = returnDate;
    }

    // ==========================================
    // RETURN REASON
    // ==========================================

    public String getReturnReason() {
        return returnReason;
    }

    public void setReturnReason(
            String returnReason
    ) {
        this.returnReason = returnReason;
    }

    // ==========================================
    // REPLACEMENT STOCK ID
    // ==========================================

    public Long getReplacementStockId() {
        return replacementStockId;
    }

    public void setReplacementStockId(
            Long replacementStockId
    ) {
        this.replacementStockId =
            replacementStockId;
    }

    // ==========================================
    // REPLACEMENT PRODUCT ID
    //
    // CORRECTED: String getter and setter.
    // ==========================================

    public String getReplacementProductId() {
        return replacementProductId;
    }

    public void setReplacementProductId(
            String replacementProductId
    ) {
        this.replacementProductId =
            replacementProductId;
    }

    // ==========================================
    // REPLACEMENT PRODUCT NAME
    // ==========================================

    public String getReplacementProductName() {
        return replacementProductName;
    }

    public void setReplacementProductName(
            String replacementProductName
    ) {
        this.replacementProductName =
            replacementProductName;
    }

    // ==========================================
    // REPLACEMENT QUANTITY
    // ==========================================

    public Integer getReplacementQuantity() {
        return replacementQuantity;
    }

    public void setReplacementQuantity(
            Integer replacementQuantity
    ) {
        this.replacementQuantity =
            replacementQuantity;
    }

    // ==========================================
    // STOCK CONDITION
    // ==========================================

    public String getStockCondition() {
        return stockCondition;
    }

    public void setStockCondition(
            String stockCondition
    ) {
        this.stockCondition = stockCondition;
    }

    // ==========================================
    // RETURN STATUS
    // ==========================================

    public String getStatus() {
        return status;
    }

    public void setStatus(
            String status
    ) {
        this.status = status;
    }

    // ==========================================
    // CREATED DATE
    // ==========================================

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(
            OffsetDateTime createdAt
    ) {
        this.createdAt = createdAt;
    }
}
