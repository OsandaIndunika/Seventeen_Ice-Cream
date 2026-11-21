package com.seventeen.project.dto;

import java.time.LocalDate;

public record SalesReturnResponse(
        Long id,
        String shopName,
        String productName,
        String batchNumber,
        Integer returnedQuantity,
        LocalDate returnDate,
        String returnReason,
        Integer replacementQuantity,
        String status
) {
}