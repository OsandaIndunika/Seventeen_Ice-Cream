package com.seventeen.project.repository;

import com.seventeen.project.entity.SalesProductReturn;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SalesReturnRepository
        extends JpaRepository<SalesProductReturn, Long> {

    Optional<SalesProductReturn> findByReceiptKey(
            UUID receiptKey
    );
}