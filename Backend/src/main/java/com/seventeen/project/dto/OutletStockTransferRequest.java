
package com.seventeen.project.dto;

public record OutletStockTransferRequest(
        Long sourceStockId,
        Long sourceBatchStockId,
        Integer quantity
) {}
