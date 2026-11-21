package com.seventeen.project.dto;

public record OrderItemRequest(
    String productId,
    String flavour,
    Integer quantity
) {}