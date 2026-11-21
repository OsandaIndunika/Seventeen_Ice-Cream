
package com.seventeen.project.service;

import com.seventeen.project.dto.WholesaleOrderRequest;
import com.seventeen.project.dto.WholesaleOrderResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class WholesaleOrderService {

    private static final Logger log =
            LoggerFactory.getLogger(WholesaleOrderService.class);

    private static final int MIN_WHOLESALE_QUANTITY = 5;

    private static final BigDecimal ZERO =
            new BigDecimal("0.00");

    private final JdbcTemplate jdbc;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public WholesaleOrderService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ==========================================
    // PRODUCT RECORD
    // ==========================================

    private record CatalogProduct(
            String id,
            String name,
            String size,
            BigDecimal price
    ) {}

    // ==========================================
    // RESOLVE WHOLESALE CUSTOMER FROM JWT EMAIL
    // ==========================================

    private Long getCustomerId(String customerEmail) {

        if (isBlank(customerEmail)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Authentication is required."
            );
        }

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.app_users
                WHERE LOWER(email) = LOWER(?)
                  AND role = 'WHOLESALE'
                  AND enabled = TRUE
                """,
                (rs, rowNum) -> rs.getLong("id"),
                customerEmail.trim()
        );

        if (ids.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Active wholesale customer account not found."
            );
        }

        return ids.get(0);
    }

    // ==========================================
    // GET CATALOG PRODUCT
    // ==========================================

    private CatalogProduct getProduct(String productId) {

        if (isBlank(productId)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Product ID is required."
            );
        }

        List<CatalogProduct> products = jdbc.query(
                """
                SELECT id, name, size, unit_price
                FROM public.wholesale_products
                WHERE id = ?
                  AND active = TRUE
                """,
                (rs, rowNum) -> new CatalogProduct(
                        rs.getString("id"),
                        rs.getString("name"),
                        rs.getString("size"),
                        rs.getBigDecimal("unit_price")
                ),
                productId.trim()
        );

        if (products.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unknown or inactive product: " + productId
            );
        }

        CatalogProduct product = products.get(0);

        if (
                product.price() == null ||
                product.price().compareTo(ZERO) < 0
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid product price: " + productId
            );
        }

        return product;
    }

    // ==========================================
    // FIND DUPLICATE REQUEST
    // ==========================================

    private Long findExistingOrder(
            UUID requestKey,
            Long customerId
    ) {

        List<Long> ids = jdbc.query(
                """
                SELECT id
                FROM public.wholesale_orders
                WHERE request_key = ?
                  AND customer_id = ?
                """,
                (rs, rowNum) -> rs.getLong("id"),
                requestKey,
                customerId
        );

        return ids.isEmpty() ? null : ids.get(0);
    }

    // ==========================================
    // PLACE WHOLESALE ORDER
    // ==========================================

    @Transactional
    public WholesaleOrderResponse placeOrder(
            WholesaleOrderRequest request,
            String customerEmail
    ) {

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order details are required."
            );
        }

        Long customerId = getCustomerId(customerEmail);

        // --------------------------------------
        // REQUEST KEY VALIDATION
        // --------------------------------------

        if (request.requestKey() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order request key is required."
            );
        }

        Long existingOrderId = findExistingOrder(
                request.requestKey(),
                customerId
        );

        if (existingOrderId != null) {
            return getOrder(existingOrderId, customerEmail);
        }

        // --------------------------------------
        // CUSTOMER VALIDATION
        // --------------------------------------

        if (
                isBlank(request.shopName()) ||
                isBlank(request.email()) ||
                isBlank(request.phone()) ||
                isBlank(request.firstName()) ||
                isBlank(request.lastName())
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Complete customer details are required."
            );
        }

        if (
                !request.email().trim().equalsIgnoreCase(
                        customerEmail.trim()
                )
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order email must match the logged-in account."
            );
        }

        // --------------------------------------
        // PAYMENT METHOD
        // --------------------------------------

        
        String paymentMethod =
        request.paymentMethod() == null
                ? ""
                : request.paymentMethod()
                        .trim()
                        .toLowerCase(Locale.ROOT);

Set<String> allowedPaymentMethods = Set.of(
        "cash",
        "bank",
        "cheque",
        "credit"
);

if (!allowedPaymentMethods.contains(paymentMethod)) {

    throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Invalid payment method"
    );
}


        if (
                !request.sameBillingAddress() &&
                isBlank(request.billingAddress())
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Billing address is required."
            );
        }

        // --------------------------------------
        // DELIVERY LOCATION
        // --------------------------------------

        WholesaleOrderRequest.DeliveryLocation location =
                request.deliveryLocation();

        if (
                location == null ||
                isBlank(location.streetAddress()) ||
                isBlank(location.city()) ||
                location.latitude() == null ||
                location.longitude() == null
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Complete delivery address and GPS coordinates are required."
            );
        }

        if (
                location.latitude().compareTo(
                        BigDecimal.valueOf(-90)
                ) < 0 ||
                location.latitude().compareTo(
                        BigDecimal.valueOf(90)
                ) > 0 ||
                location.longitude().compareTo(
                        BigDecimal.valueOf(-180)
                ) < 0 ||
                location.longitude().compareTo(
                        BigDecimal.valueOf(180)
                ) > 0
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid delivery GPS coordinates."
            );
        }

        // --------------------------------------
        // ORDER ITEMS
        // --------------------------------------

        if (
                request.items() == null ||
                request.items().isEmpty()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order must contain at least one product."
            );
        }

        List<WholesaleOrderResponse.Item> orderItems =
                new ArrayList<>();

        Set<String> uniqueVariants = new HashSet<>();

        BigDecimal productSubtotal = ZERO;

        for (
                WholesaleOrderRequest.OrderItem item
                : request.items()
        ) {

            if (
                    item == null ||
                    isBlank(item.productId()) ||
                    isBlank(item.selectedFlavour()) ||
                    item.quantity() == null
            ) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Each item requires product ID, flavour and quantity."
                );
            }

            if (item.quantity() < MIN_WHOLESALE_QUANTITY) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Minimum quantity is 5 per product/flavour."
                );
            }

            String productId = item.productId().trim();
            String flavour = item.selectedFlavour().trim();

            String variantKey =
                    productId + "\u0000" +
                    flavour.toLowerCase(Locale.ROOT);

            if (!uniqueVariants.add(variantKey)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Duplicate product/flavour: " +
                                productId + " / " + flavour
                );
            }

            CatalogProduct product = getProduct(productId);

            BigDecimal lineTotal =
                    product.price().multiply(
                            BigDecimal.valueOf(item.quantity())
                    );

            productSubtotal = productSubtotal.add(lineTotal);

            orderItems.add(
                    new WholesaleOrderResponse.Item(
                            product.id(),
                            product.name(),
                            flavour,
                            product.size(),
                            item.quantity(),
                            product.price(),
                            lineTotal
                    )
            );
        }

        // --------------------------------------
        // TOTALS
        // --------------------------------------

        BigDecimal deliveryCharge = ZERO;
        BigDecimal taxAmount = ZERO;

        BigDecimal finalTotal =
                productSubtotal
                        .add(deliveryCharge)
                        .add(taxAmount);

        // --------------------------------------
        // SAVE ORDER HEADER
        // --------------------------------------

        List<Long> generatedIds = jdbc.query(
                """
INSERT INTO public.wholesale_orders (
    customer_id,
    shop_name,
    phone,
    address,
    latitude,
    longitude,
    total_amount,
    status,

    delivery_street_address,
    delivery_city,
    delivery_postal_code,
    delivery_latitude,
    delivery_longitude,
    delivery_instructions,

    email,
    first_name,
    last_name,

    payment_method,
    payment_status,
    same_billing_address,
    billing_address,
    purchase_order_number,
    order_notes,

    product_subtotal,
    delivery_charge,
    tax_amount,
    final_total,
    request_key
)
VALUES (
    ?, ?, ?, ?, ?, ?, ?, 'PLACED',
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, 'PENDING', ?, ?, ?, ?,
    ?, ?, ?, ?, ?
)
RETURNING id
""",
                (rs, rowNum) -> rs.getLong("id"),

                customerId,
                request.shopName().trim(),
                request.phone().trim(),

                location.streetAddress().trim(),
                location.latitude().doubleValue(),
                location.longitude().doubleValue(),

                finalTotal,

                location.streetAddress().trim(),
                location.city().trim(),
                location.postalCode(),

                location.latitude().doubleValue(),
                location.longitude().doubleValue(),
                location.deliveryInstructions(),

                request.email().trim(),
                request.firstName().trim(),
                request.lastName().trim(),

                paymentMethod,
                request.sameBillingAddress(),

                request.sameBillingAddress()
                        ? null
                        : request.billingAddress().trim(),

                request.purchaseOrderNumber(),
                request.orderNotes(),

                productSubtotal,
                deliveryCharge,
                taxAmount,
                finalTotal,
                request.requestKey()
        );

        if (generatedIds.isEmpty()) {
            throw new IllegalStateException(
                    "Unable to generate wholesale order ID."
            );
        }

        Long orderId = generatedIds.get(0);

        // --------------------------------------
        // SAVE ORDER ITEMS
        // --------------------------------------

        for (WholesaleOrderResponse.Item item : orderItems) {

            jdbc.update(
                    """
                    INSERT INTO public.wholesale_order_items (
                        order_id,
                        product_id,
                        flavour,
                        quantity,
                        unit_price,
                        subtotal
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    orderId,
                    item.productId(),
                    item.selectedFlavour(),
                    item.quantity(),
                    item.price(),
                    item.lineTotal()
            );
        }

        log.info(
                "Wholesale order {} created for customer {}",
                orderId,
                customerId
        );

        /*
         * MANUAL DELIVERY WORKFLOW
         *
         * Do not assign a vehicle automatically.
         *
         * New orders become available through:
         *
         * GET /api/delivery/claims/orders
         *
         * Delivery persons using LA-2099 or LA-2398
         * may claim an available order.
         *
         * DeliveryClaimService is responsible for
         * recording the vehicle and delivery person.
         */

        return getOrder(orderId, customerEmail);
    }

    // ==========================================
    // GET ONE WHOLESALE ORDER
    // ==========================================

    @Transactional(readOnly = true)
    public WholesaleOrderResponse getOrder(
            Long orderId,
            String customerEmail
    ) {

        if (orderId == null || orderId <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Valid order ID is required."
            );
        }

        Long customerId = getCustomerId(customerEmail);

        // ======================================
        // ORDER + DELIVERY STATUS + VEHICLE
        // ======================================

        String sql = """
                SELECT
                    wo.*,

                    CASE
                        WHEN a.status = 'ASSIGNED'
                            THEN 'PROCESSING'

                        WHEN a.status = 'IN_TRANSIT'
                            THEN 'ON_THE_WAY'

                        WHEN a.status IS NOT NULL
                            THEN a.status

                        WHEN wo.status = 'PLACED'
                            THEN 'WAITING'

                        ELSE wo.status
                    END AS delivery_display_status,

                    v.vehicle_number AS assigned_vehicle_number

                FROM public.wholesale_orders wo

                LEFT JOIN LATERAL (
                    SELECT
                        assignment.status,
                        assignment.vehicle_id

                    FROM public.vehicle_delivery_assignments
                        assignment

                    WHERE assignment.wholesale_order_id = wo.id

                    ORDER BY
                        assignment.assigned_at DESC,
                        assignment.id DESC

                    LIMIT 1
                ) a ON TRUE

                LEFT JOIN public.delivery_vehicles v
                    ON v.id = a.vehicle_id

                WHERE wo.id = ?
                  AND wo.customer_id = ?
                """;

        List<WholesaleOrderResponse> orders = jdbc.query(
                sql,

                (rs, rowNum) -> {

                    // ----------------------------------
                    // CREATED DATE
                    // ----------------------------------

                    Timestamp createdAt =
                            rs.getTimestamp("created_at");

                    // ----------------------------------
                    // DELIVERY GPS
                    // ----------------------------------

                    BigDecimal latitude =
                            rs.getBigDecimal(
                                    "delivery_latitude"
                            );

                    BigDecimal longitude =
                            rs.getBigDecimal(
                                    "delivery_longitude"
                            );

                    if (latitude == null) {
                        latitude =
                                rs.getBigDecimal("latitude");
                    }

                    if (longitude == null) {
                        longitude =
                                rs.getBigDecimal("longitude");
                    }

                    // ----------------------------------
                    // DELIVERY ADDRESS
                    // ----------------------------------

                    String streetAddress =
                            rs.getString(
                                    "delivery_street_address"
                            );

                    if (isBlank(streetAddress)) {
                        streetAddress =
                                rs.getString("address");
                    }

                    WholesaleOrderRequest.DeliveryLocation
                            deliveryLocation =
                            new WholesaleOrderRequest.DeliveryLocation(
                                    streetAddress,
                                    rs.getString("delivery_city"),
                                    rs.getString("delivery_province"),
                                    rs.getString("delivery_postal_code"),
                                    latitude,
                                    longitude,
                                    rs.getString("delivery_instructions")
                            );

                    // ----------------------------------
                    // TOTALS
                    // ----------------------------------

                    BigDecimal productSubtotal =
                            rs.getBigDecimal(
                                    "product_subtotal"
                            );

                    if (productSubtotal == null) {
                        productSubtotal =
                                rs.getBigDecimal("total_amount");
                    }

                    BigDecimal deliveryCharge =
                            rs.getBigDecimal(
                                    "delivery_charge"
                            );

                    if (deliveryCharge == null) {
                        deliveryCharge = ZERO;
                    }

                    BigDecimal taxAmount =
                            rs.getBigDecimal("tax_amount");

                    if (taxAmount == null) {
                        taxAmount = ZERO;
                    }

                    BigDecimal finalTotal =
                            rs.getBigDecimal("final_total");

                    if (finalTotal == null) {
                        finalTotal =
                                rs.getBigDecimal("total_amount");
                    }

                    // ----------------------------------
                    // STATUS
                    // ----------------------------------

                    String currentDeliveryStatus =
                            rs.getString(
                                    "delivery_display_status"
                            );

                    // ----------------------------------
                    // VEHICLE
                    // ----------------------------------

                    String assignedVehicleNumber =
                            rs.getString(
                                    "assigned_vehicle_number"
                            );

                    // ----------------------------------
                    // RESPONSE INCLUDING VEHICLE
                    // ----------------------------------

                    return new WholesaleOrderResponse(
                            rs.getLong("id"),
                            rs.getString("shop_name"),

                            currentDeliveryStatus,

                            rs.getString("payment_status"),
                            rs.getString("payment_method"),

                            productSubtotal,
                            deliveryCharge,
                            taxAmount,
                            finalTotal,

                            deliveryLocation,

                            List.of(),

                            createdAt == null
                                    ? null
                                    : createdAt.toInstant()
                                            .atOffset(
                                                    ZoneOffset.UTC
                                            ),

                            assignedVehicleNumber
                    );
                },

                orderId,
                customerId
        );

        if (orders.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Order not found or access denied."
            );
        }

        WholesaleOrderResponse order = orders.get(0);

        // ======================================
        // LOAD ORDER ITEMS
        // ======================================

        List<WholesaleOrderResponse.Item> items =
                jdbc.query(
                        """
                        SELECT
                            oi.product_id,

                            COALESCE(
                                p.name,
                                oi.product_id
                            ) AS product_name,

                            oi.flavour,

                            p.size AS product_size,

                            oi.quantity,
                            oi.unit_price,
                            oi.subtotal AS line_total

                        FROM public.wholesale_order_items oi

                        LEFT JOIN public.wholesale_products p
                            ON p.id = oi.product_id

                        WHERE oi.order_id = ?

                        ORDER BY oi.id
                        """,

                        (rs, rowNum) ->
                                new WholesaleOrderResponse.Item(
                                        rs.getString("product_id"),
                                        rs.getString("product_name"),
                                        rs.getString("flavour"),
                                        rs.getString("product_size"),
                                        rs.getInt("quantity"),
                                        rs.getBigDecimal("unit_price"),
                                        rs.getBigDecimal("line_total")
                                ),

                        orderId
                );

        // ======================================
        // FINAL RESPONSE: PRESERVE VEHICLE
        // ======================================

        return new WholesaleOrderResponse(
                order.orderId(),
                order.shopName(),
                order.orderStatus(),
                order.paymentStatus(),
                order.paymentMethod(),
                order.productSubtotal(),
                order.deliveryCharge(),
                order.taxAmount(),
                order.finalTotal(),
                order.deliveryLocation(),
                items,
                order.createdAt(),

                // Critical: keep assigned vehicle.
                order.vehicleNumber()
        );
    }

    // ==========================================
    // ALL ORDERS FOR LOGGED-IN CUSTOMER
    // ==========================================

    @Transactional(readOnly = true)
    public List<WholesaleOrderResponse> getOrdersForCustomer(
            String customerEmail
    ) {

        Long customerId = getCustomerId(customerEmail);

        List<Long> orderIds = jdbc.query(
                """
                SELECT id
                FROM public.wholesale_orders

                WHERE customer_id = ?

                ORDER BY
                    created_at DESC,
                    id DESC
                """,
                (rs, rowNum) -> rs.getLong("id"),
                customerId
        );

        List<WholesaleOrderResponse> history =
                new ArrayList<>();

        for (Long orderId : orderIds) {
            history.add(
                    getOrder(orderId, customerEmail)
            );
        }

        return history;
    }

    // ==========================================
    // HELPER
    // ==========================================

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
