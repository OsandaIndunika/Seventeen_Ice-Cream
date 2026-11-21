package com.seventeen.project.dto;

import java.time.LocalDate;
import java.util.UUID;

public record CreateSalesReturnRequest(
        UUID receiptKey,
        String shopName,
        String shopPhone,
        String productId,
        String flavour,
        String batchNumber,
        Integer returnedQuantity,
        LocalDate returnDate,
        String returnReason,
        Long replacementStockId,
        Integer replacementQuantity
) {}