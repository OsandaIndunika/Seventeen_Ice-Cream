
import {
    useEffect,
    useMemo,
    useState,
  } from "react";
  
  import { salesVehicleApi } from
    "../../services/salesVehicleApi";
  
  import { salesBillingApi } from
    "../../services/salesBillingApi";
  
  export default function SalesOutletBatchSelector({
    vehicleStockId,
    value = "",
    onChange,
    refreshKey = 0,
  }) {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
  
    // ========================================
    // LOAD BATCHES FROM ACTIVE LORRY
    // ========================================
  
    useEffect(() => {
      let cancelled = false;
  
      async function loadInventory() {
        setLoading(true);
        setError("");
  
        try {
          const session =
            await salesVehicleApi.currentSession();
  
          const vehicleId = Number(
            session?.vehicleId ??
            session?.vehicle_id
          );
  
          if (
            !session?.active ||
            !Number.isSafeInteger(vehicleId) ||
            vehicleId <= 0
          ) {
            throw new Error(
              "Select an active sales lorry first."
            );
          }
  
          const result =
            await salesBillingApi.getBatchInventory(
              vehicleId
            );
  
          if (!cancelled) {
            setInventory(result);
          }
  
        } catch (err) {
          if (!cancelled) {
            setError(
              err.message ||
              "Unable to load batch numbers."
            );
            setInventory([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }
  
      loadInventory();
  
      return () => {
        cancelled = true;
      };
    }, [refreshKey]);
  
    // ========================================
    // FIND SELECTED PRODUCT
    // ========================================
  
    const product = useMemo(
      () =>
        inventory.find(
          (row) =>
            String(row.vehicleStockId) ===
            String(vehicleStockId)
        ),
      [inventory, vehicleStockId]
    );
  
    // ========================================
    // AVAILABLE BATCHES
    //
    // Only check actual available quantity.
    // ========================================
  
    const availableBatches = useMemo(() => {
      if (!Array.isArray(product?.batches)) {
        return [];
      }
  
      return product.batches.filter((batch) => {
        const available = Number(
          batch.availableQuantity ??
          (
            Number(batch.quantity ?? 0) -
            Number(batch.reservedQuantity ?? 0)
          )
        );
  
        return (
          String(batch.batchNumber ?? "").trim() !== "" &&
          Number.isFinite(available) &&
          available > 0
        );
      });
    }, [product]);
  
    // ========================================
    // SELECTED BATCH
    // ========================================
  
    const selectedBatch = availableBatches.find(
      (batch) =>
        String(batch.batchNumber) === String(value)
    );
  
    function handleChange(event) {
      const batchNumber = event.target.value;
  
      const selected = availableBatches.find(
        (batch) =>
          String(batch.batchNumber) === batchNumber
      );
  
      onChange?.(
        batchNumber,
        selected || null
      );
    }
  
    // ========================================
    // RENDER
    // ========================================
  
    return (
      <div>
        <label className="mb-2 block text-sm font-semibold text-[#17265B]">
          Production Batch Number
        </label>
  
        <select
          value={selectedBatch ? value : ""}
          onChange={handleChange}
          disabled={
            !vehicleStockId ||
            loading ||
            Boolean(error)
          }
          required
          className={
            "w-full rounded-xl border border-slate-200 " +
            "bg-slate-50 px-4 py-3 outline-none " +
            "focus:border-[#3654FF] focus:ring-2 " +
            "focus:ring-blue-100"
          }
        >
          <option value="">
            {loading
              ? "Loading batches..."
              : "Select production batch"}
          </option>
  
          {availableBatches.map((batch) => (
            <option
              key={batch.vehicleBatchStockId}
              value={String(batch.batchNumber)}
            >
              Batch {batch.batchNumber}
              {" — "}
              {batch.availableQuantity} available
            </option>
          ))}
        </select>
  
        {vehicleStockId &&
          !loading &&
          !error &&
          availableBatches.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No batches with available stock were
              found for this product on the selected lorry.
            </p>
          )}
  
        {selectedBatch && (
          <p className="mt-2 text-xs text-slate-500">
            Batch {selectedBatch.batchNumber}
            {" — "}
            {selectedBatch.availableQuantity} units available.
          </p>
        )}
  
        {error && (
          <p
            role="alert"
            className="mt-2 text-sm text-red-600"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
  