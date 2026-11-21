
package com.seventeen.project.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.OffsetDateTime;
import java.time.ZoneId;

@Entity
@Table(
    name = "sales_return_replacements",
    schema = "public",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uq_sales_return_replacement_return_stock",
            columnNames = {
                "return_id",
                "vehicle_stock_id"
            }
        )
    }
)
public class SalesReturnReplacement {

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
    // 2. ASSOCIATED PRODUCT RETURN
    //
    // Each replacement is linked to an
    // existing SalesProductReturn.
    //
    // No original invoice is required.
    // No Admin approval is required.
    // ==========================================

    @ManyToOne(
        fetch = FetchType.LAZY,
        optional = false
    )
    @JoinColumn(
        name = "return_id",
        nullable = false,
        foreignKey = @ForeignKey(
            name = "fk_sales_replacement_return"
        )
    )
    private SalesProductReturn salesProductReturn;

    // ==========================================
    // 3. ACTIVE LORRY STOCK ID
    //
    // References vehicle_stock.id.
    //
    // vehicle_stock.id is BIGINT,
    // so this field remains Long.
    //
    // The Sales Manager selects a lorry
    // when starting their sales session.
    // ==========================================

    @Column(
        name = "vehicle_stock_id",
        nullable = false
    )
    private Long vehicleStockId;

    // ==========================================
    // 4. REPLACEMENT PRODUCT ID
    //
    // CORRECTED:
    //
    // wholesale_products.id = VARCHAR
    // vehicle_stock.product_id = VARCHAR
    //
    // Examples:
    // "4l-bag"
    // "1l-tub"
    // "popsicle"
    //
    // Therefore, use String instead of Long.
    // ==========================================

    @Column(
        name = "product_id",
        nullable = false,
        length = 100
    )
    private String productId;

    // ==========================================
    // 5. REPLACEMENT PRODUCT NAME
    // ==========================================

    @Column(
        name = "product_name",
        nullable = false,
        length = 200
    )
    private String productName;

    // ==========================================
    // 6. REPLACEMENT PRODUCT FLAVOUR
    // ==========================================

    @Column(
        name = "flavour",
        length = 100
    )
    private String flavour;

    // ==========================================
    // 7. REPLACEMENT BATCH NUMBER
    //
    // Optional because vehicle_stock may not
    // track individual production batches.
    // ==========================================

    @Column(
        name = "replacement_batch_number",
        length = 100
    )
    private String replacementBatchNumber;

    // ==========================================
    // 8. REPLACEMENT QUANTITY
    //
    // One-for-one replacement:
    // replacement quantity must match the
    // returned quantity.
    //
    // Validation is enforced by
    // SalesReturnService, not this entity.
    // ==========================================

    @Column(
        name = "quantity",
        nullable = false
    )
    private Integer quantity;

    // ==========================================
    // 9. REPLACEMENT ISSUE DATE
    // ==========================================

    @Column(
        name = "issued_at",
        nullable = false,
        updatable = false
    )
    private OffsetDateTime issuedAt;

    // ==========================================
    // 10. DEFAULT CONSTRUCTOR
    //
    // Required by JPA.
    // ==========================================

    public SalesReturnReplacement() {
    }

    // ==========================================
    // 11. PARAMETERIZED CONSTRUCTOR
    //
    // CORRECTED: productId is String.
    // ==========================================

    public SalesReturnReplacement(
            SalesProductReturn salesProductReturn,
            Long vehicleStockId,
            String productId,
            String productName,
            String flavour,
            String replacementBatchNumber,
            Integer quantity
    ) {

        this.salesProductReturn = salesProductReturn;
        this.vehicleStockId = vehicleStockId;
        this.productId = productId;
        this.productName = productName;
        this.flavour = flavour;
        this.replacementBatchNumber =
                replacementBatchNumber;
        this.quantity = quantity;
    }

    // ==========================================
    // 12. DEFAULT VALUES BEFORE INSERT
    // ==========================================

    @PrePersist
    public void prePersist() {

        if (issuedAt == null) {
            issuedAt = OffsetDateTime.now(
                    ZoneId.of("Asia/Colombo")
            );
        }
    }

    // ==========================================
    // 13. GETTERS AND SETTERS
    // ==========================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    // ------------------------------------------
    // ASSOCIATED RETURN
    // ------------------------------------------

    public SalesProductReturn getSalesProductReturn() {
        return salesProductReturn;
    }

    public void setSalesProductReturn(
            SalesProductReturn salesProductReturn
    ) {
        this.salesProductReturn =
                salesProductReturn;
    }

    // ------------------------------------------
    // VEHICLE STOCK ID
    // ------------------------------------------

    public Long getVehicleStockId() {
        return vehicleStockId;
    }

    public void setVehicleStockId(
            Long vehicleStockId
    ) {
        this.vehicleStockId = vehicleStockId;
    }

    // ------------------------------------------
    // PRODUCT ID
    //
    // CORRECTED: String getter and setter.
    // ------------------------------------------

    public String getProductId() {
        return productId;
    }

    public void setProductId(
            String productId
    ) {
        this.productId = productId;
    }

    // ------------------------------------------
    // PRODUCT NAME
    // ------------------------------------------

    public String getProductName() {
        return productName;
    }

    public void setProductName(
            String productName
    ) {
        this.productName = productName;
    }

    // ------------------------------------------
    // FLAVOUR
    // ------------------------------------------

    public String getFlavour() {
        return flavour;
    }

    public void setFlavour(
            String flavour
    ) {
        this.flavour = flavour;
    }

    // ------------------------------------------
    // REPLACEMENT BATCH NUMBER
    // ------------------------------------------

    public String getReplacementBatchNumber() {
        return replacementBatchNumber;
    }

    public void setReplacementBatchNumber(
            String replacementBatchNumber
    ) {
        this.replacementBatchNumber =
                replacementBatchNumber;
    }

    // ------------------------------------------
    // REPLACEMENT QUANTITY
    // ------------------------------------------

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(
            Integer quantity
    ) {
        this.quantity = quantity;
    }

    // ------------------------------------------
    // REPLACEMENT ISSUE DATE
    // ------------------------------------------

    public OffsetDateTime getIssuedAt() {
        return issuedAt;
    }

    public void setIssuedAt(
            OffsetDateTime issuedAt
    ) {
        this.issuedAt = issuedAt;
    }
}
