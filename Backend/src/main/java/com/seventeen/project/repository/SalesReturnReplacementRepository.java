
package com.seventeen.project.repository;

import com.seventeen.project.entity.SalesReturnReplacement;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SalesReturnReplacementRepository
        extends JpaRepository<SalesReturnReplacement, Long> {

    // ==========================================
    // 1. FIND REPLACEMENTS BY RETURN ID
    //
    // Each replacement belongs to an
    // existing SalesProductReturn.
    //
    // sales_product_returns.id is BIGINT.
    // Therefore returnId remains Long.
    // ==========================================

    List<SalesReturnReplacement>
    findBySalesProductReturn_IdOrderByIssuedAtDesc(
            Long returnId
    );

    // ==========================================
    // 2. FIND REPLACEMENT BY RETURN AND STOCK
    //
    // Used to identify an existing replacement
    // for the same return and vehicle stock.
    // ==========================================

    Optional<SalesReturnReplacement>
    findBySalesProductReturn_IdAndVehicleStockId(
            Long returnId,
            Long vehicleStockId
    );

    // ==========================================
    // 3. CHECK DUPLICATE REPLACEMENT
    //
    // Returns true if a replacement record
    // already exists for the return and stock.
    // ==========================================

    boolean existsBySalesProductReturn_IdAndVehicleStockId(
            Long returnId,
            Long vehicleStockId
    );

    // ==========================================
    // 4. FIND REPLACEMENTS BY LORRY STOCK ID
    //
    // vehicle_stock.id is BIGINT.
    // Therefore vehicleStockId remains Long.
    // ==========================================

    List<SalesReturnReplacement>
    findByVehicleStockIdOrderByIssuedAtDesc(
            Long vehicleStockId
    );

    // ==========================================
    // 5. FIND REPLACEMENTS BY PRODUCT ID
    //
    // CORRECTED:
    //
    // wholesale_products.id = VARCHAR
    // vehicle_stock.product_id = VARCHAR
    //
    // Product IDs include:
    // "4l-bag"
    // "1l-tub"
    // "500ml-tub"
    // "popsicle"
    //
    // Therefore productId must be String.
    // ==========================================

    List<SalesReturnReplacement>
    findByProductIdOrderByIssuedAtDesc(
            String productId
    );

    // ==========================================
    // 6. FIND REPLACEMENTS BY PRODUCT AND FLAVOUR
    //
    // CORRECTED:
    // productId uses String.
    //
    // Flavour comparison is case-insensitive.
    // ==========================================

    List<SalesReturnReplacement>
    findByProductIdAndFlavourIgnoreCaseOrderByIssuedAtDesc(
            String productId,
            String flavour
    );

    // ==========================================
    // 7. FIND REPLACEMENTS BETWEEN DATES
    //
    // Useful for Daily Reports.
    //
    // The end timestamp is exclusive.
    // ==========================================

    List<SalesReturnReplacement>
    findByIssuedAtGreaterThanEqualAndIssuedAtLessThanOrderByIssuedAtDesc(
            OffsetDateTime start,
            OffsetDateTime end
    );

    // ==========================================
    // 8. COUNT REPLACEMENTS FOR A RETURN
    // ==========================================

    long countBySalesProductReturn_Id(
            Long returnId
    );

    // ==========================================
    // 9. TOTAL REPLACEMENT QUANTITY BY RETURN
    //
    // Counts all replacement units issued
    // for a specific product return.
    // ==========================================

    @Query("""
        SELECT COALESCE(SUM(r.quantity), 0)
        FROM SalesReturnReplacement r
        WHERE r.salesProductReturn.id = :returnId
        """)
    Long getTotalReplacementQuantityByReturnId(
            @Param("returnId") Long returnId
    );

    // ==========================================
    // 10. TOTAL REPLACEMENT QUANTITY BY STOCK
    //
    // Counts all replacement units issued
    // from a particular lorry stock record.
    // ==========================================

    @Query("""
        SELECT COALESCE(SUM(r.quantity), 0)
        FROM SalesReturnReplacement r
        WHERE r.vehicleStockId = :vehicleStockId
        """)
    Long getTotalReplacementQuantityByVehicleStockId(
            @Param("vehicleStockId") Long vehicleStockId
    );

    // ==========================================
    // 11. TOTAL REPLACEMENT QUANTITY
    // BETWEEN TWO DATES
    //
    // Useful for Sales Manager Daily Reports.
    // ==========================================

    @Query("""
        SELECT COALESCE(SUM(r.quantity), 0)
        FROM SalesReturnReplacement r
        WHERE r.issuedAt >= :start
          AND r.issuedAt < :end
        """)
    Long getTotalReplacementQuantityBetweenDates(
            @Param("start") OffsetDateTime start,
            @Param("end") OffsetDateTime end
    );

    // ==========================================
    // 12. GET REPLACEMENTS BY VEHICLE ID
    //
    // Vehicle ID comes from the existing
    // SalesProductReturn relationship.
    //
    // No second lorry selection is required.
    // ==========================================

    @Query("""
        SELECT r
        FROM SalesReturnReplacement r
        WHERE r.salesProductReturn.vehicleId = :vehicleId
        ORDER BY r.issuedAt DESC
        """)
    List<SalesReturnReplacement> findByVehicleId(
            @Param("vehicleId") Long vehicleId
    );

    // ==========================================
    // 13. GET REPLACEMENTS BY
    // SALES MANAGER AND SELECTED LORRY
    //
    // Only retrieves records matching both
    // the provided Sales Manager and vehicle.
    //
    // The calling service must obtain these
    // IDs from authenticated session data.
    // ==========================================

    @Query("""
        SELECT r
        FROM SalesReturnReplacement r
        WHERE r.salesProductReturn.salesManagerUserId =
              :salesManagerUserId
          AND r.salesProductReturn.vehicleId = :vehicleId
        ORDER BY r.issuedAt DESC
        """)
    List<SalesReturnReplacement> findBySalesManagerAndVehicle(
            @Param("salesManagerUserId")
            Long salesManagerUserId,

            @Param("vehicleId")
            Long vehicleId
    );

    // ==========================================
    // 14. DAILY REPLACEMENT QUANTITY
    // FOR THE SELECTED LORRY
    //
    // Includes replacements issued within
    // the requested date-time range.
    // ==========================================

    @Query("""
        SELECT COALESCE(SUM(r.quantity), 0)
        FROM SalesReturnReplacement r
        WHERE r.salesProductReturn.vehicleId = :vehicleId
          AND r.issuedAt >= :start
          AND r.issuedAt < :end
        """)
    Long getDailyReplacementQuantityByVehicle(
            @Param("vehicleId")
            Long vehicleId,

            @Param("start")
            OffsetDateTime start,

            @Param("end")
            OffsetDateTime end
    );
}
