package com.seventeen.project.dto;

import java.util.List;

public record PlaceOrderRequest(
    String shopName,
    String phone,
    String address,
    Double latitude,
    Double longitude,
    List<OrderItemRequest> items
) {}