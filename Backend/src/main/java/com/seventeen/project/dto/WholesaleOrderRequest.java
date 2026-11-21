
package com.seventeen.project.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record WholesaleOrderRequest(

    // ==========================================
    // UNIQUE ORDER REQUEST KEY
    // ==========================================

    // Prevents duplicate orders when the same
    // request is submitted again.

    @NotNull(
        message = "Order request key is required"
    )
    UUID requestKey,

    // ==========================================
    // WHOLESALE SHOP DETAILS
    // ==========================================

    @NotBlank(
        message = "Shop name is required"
    )
    String shopName,

    @NotBlank(
        message = "Email is required"
    )
    @Email(
        message = "Invalid email address"
    )
    String email,

    @NotBlank(
        message = "Phone number is required"
    )
    String phone,

    @NotBlank(
        message = "First name is required"
    )
    String firstName,

    @NotBlank(
        message = "Last name is required"
    )
    String lastName,

    // ==========================================
    // DELIVERY DETAILS
    // ==========================================

    @NotNull(
        message = "Delivery location is required"
    )
    @Valid
    DeliveryLocation deliveryLocation,

    // ==========================================
    // PAYMENT METHOD
    // ==========================================

    // Allowed payment methods:
    //
    // cash   - Cash Payment
    // bank   - Bank Transfer
    // cheque - Cheque Payment
    // credit - Credit Payment

    @NotBlank(
        message = "Payment method is required"
    )
    @Pattern(
        regexp = "cash|bank|cheque|credit",
        message = "Invalid payment method"
    )
    String paymentMethod,

    // ==========================================
    // CREDIT CASH AMOUNT
    // ==========================================

    // This field is required only when the
    // payment method is "credit".
    //
    // The value represents the amount that
    // the customer PLANS to pay in cash.
    //
    // It does not mean the amount has
    // already been received.

    @DecimalMin(
        value = "0.00",
        inclusive = true,
        message = "Cash amount cannot be negative"
    )
    @Digits(
        integer = 10,
        fraction = 2,
        message = "Cash amount must have no more than two decimal places"
    )
    BigDecimal creditCashAmount,

    // ==========================================
    // BILLING INFORMATION
    // ==========================================

    boolean sameBillingAddress,

    String billingAddress,

    String purchaseOrderNumber,

    String orderNotes,

    // ==========================================
    // ORDER ITEMS
    // ==========================================

    @NotEmpty(
        message = "Order must contain at least one product"
    )
    List<@NotNull @Valid OrderItem> items

) {

    // ==========================================
    // CONDITIONAL CREDIT VALIDATION
    // ==========================================

    // Validate the relationship between
    // paymentMethod and creditCashAmount.
    //
    // The final order total cannot be checked
    // here, because Spring Boot calculates
    // verified prices in the service layer.

    @AssertTrue(
        message = "Credit orders require a valid cash amount, and non-credit orders must not include one"
    )
    public boolean isCreditPaymentValid() {

        if ("credit".equals(paymentMethod)) {

            return creditCashAmount != null
                    && creditCashAmount.signum() >= 0;
        }

        if (
            "cash".equals(paymentMethod)
            || "bank".equals(paymentMethod)
            || "cheque".equals(paymentMethod)
        ) {
            return creditCashAmount == null;
        }

        // @Pattern handles unknown methods.
        return true;
    }

    // ==========================================
    // DELIVERY LOCATION RECORD
    // ==========================================

    public record DeliveryLocation(

        @NotBlank(
            message = "Street address is required"
        )
        String streetAddress,

        @NotBlank(
            message = "City is required"
        )
        String city,

        String province,

        String postalCode,

        @NotNull(
            message = "Latitude is required"
        )
        @DecimalMin(
            value = "-90.0",
            message = "Latitude must be at least -90"
        )
        @DecimalMax(
            value = "90.0",
            message = "Latitude must not exceed 90"
        )
        BigDecimal latitude,

        @NotNull(
            message = "Longitude is required"
        )
        @DecimalMin(
            value = "-180.0",
            message = "Longitude must be at least -180"
        )
        @DecimalMax(
            value = "180.0",
            message = "Longitude must not exceed 180"
        )
        BigDecimal longitude,

        String deliveryInstructions

    ) {}

    // ==========================================
    // ORDER ITEM RECORD
    // ==========================================

    public record OrderItem(

        // PostgreSQL wholesale_products.id
        // is VARCHAR.
        //
        // Examples:
        // ice-cream-cup
        // 1l-tub
        // 4l-bag

        @NotBlank(
            message = "Product ID is required"
        )
        String productId,

        @NotBlank(
            message = "Selected flavour is required"
        )
        String selectedFlavour,

        @NotNull(
            message = "Quantity is required"
        )
        @Min(
            value = 1,
            message = "Quantity must be at least 1"
        )
        Integer quantity

    ) {}
}
