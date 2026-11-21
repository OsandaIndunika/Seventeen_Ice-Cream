
import { useMemo } from "react";

import {
  Truck,
  Package,
  Boxes,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// =====================================================
// HELPERS
// =====================================================

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatQuantity(value) {
  return toNumber(value).toLocaleString("en-LK");
}

function formatBatchNumber(batchNumber) {
  const value = String(
    batchNumber ?? ""
  ).trim();

  return value || "Not Assigned";
}

// =====================================================
// GROUPED BATCH INVENTORY COMPONENT
// =====================================================

/**
 * Sales Manager Grouped Batch Inventory.
 *
 * Displays:
 *
 * - Selected lorry
 * - Total number of products
 * - Total stock quantity
 * - Total available quantity
 * - Individual product cards
 * - Product name
 * - Product size
 * - Flavour
 * - Total quantity per product
 * - Batch number
 * - Quantity per batch
 * - Reserved quantity per batch
 * - Available quantity per batch
 * - Unallocated quantity warnings
 *
 * Data source:
 *
 * GET /api/sales/vehicles/{vehicleId}/batch-inventory
 *
 * The parent SalesManagerDashboard.jsx retrieves data
 * and passes it through the inventory prop.
 *
 * This component uses batch identities and quantities.
 * It has no batch approval-status dependency.
 *
 * This component is read-only.
 * It does not modify any stock records.
 */

export default function SalesGroupedBatchInventory({
  vehicleNumber,
  inventory = [],
  loading = false,
  error = "",
}) {

  // ===================================================
  // NORMALIZE INVENTORY
  // ===================================================

  const products = useMemo(() => {

    if (!Array.isArray(inventory)) {
      return [];
    }

    return inventory.map((product) => {

      const totalQuantity = toNumber(
        product.totalQuantity
      );

      const reservedQuantity = toNumber(
        product.reservedQuantity
      );

      const availableQuantity = toNumber(
        product.availableQuantity ??
          totalQuantity - reservedQuantity
      );

      const batches = Array.isArray(
        product.batches
      )
        ? product.batches.map((batch) => {

            const quantity = toNumber(
              batch.quantity
            );

            const reserved = toNumber(
              batch.reservedQuantity
            );

            return {
              ...batch,

              batchNumber: formatBatchNumber(
                batch.batchNumber
              ),

              quantity,

              reservedQuantity: reserved,

              availableQuantity: toNumber(
                batch.availableQuantity ??
                  quantity - reserved
              ),
            };
          })
        : [];

      const allocatedQuantity = toNumber(
        product.allocatedQuantity ??
          batches.reduce(
            (sum, batch) =>
              sum + batch.quantity,
            0
          )
      );

      const unallocatedQuantity = toNumber(
        product.unallocatedQuantity ??
          totalQuantity - allocatedQuantity
      );

      return {
        ...product,

        totalQuantity,

        reservedQuantity,

        availableQuantity,

        allocatedQuantity,

        unallocatedQuantity,

        batches,
      };
    });

  }, [inventory]);

  // ===================================================
  // INVENTORY SUMMARY
  // ===================================================

  const summary = useMemo(() => {

    return products.reduce(
      (result, product) => {

        result.totalProducts += 1;

        result.totalStock +=
          product.totalQuantity;

        result.availableStock +=
          product.availableQuantity;

        result.reservedStock +=
          product.reservedQuantity;

        result.totalBatches +=
          product.batches.length;

        if (
          product.unallocatedQuantity !== 0
        ) {
          result.mismatchedProducts += 1;
        }

        return result;
      },
      {
        totalProducts: 0,
        totalStock: 0,
        availableStock: 0,
        reservedStock: 0,
        totalBatches: 0,
        mismatchedProducts: 0,
      }
    );

  }, [products]);

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">

        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#3654FF]" />

        <p className="mt-4 text-sm font-semibold text-slate-600">
          Loading lorry batch inventory...
        </p>

      </div>
    );
  }

  // ===================================================
  // ERROR
  // ===================================================

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 p-5"
      >

        <div className="flex items-center gap-2 font-bold text-red-700">
          <AlertTriangle size={19} />

          Unable to Load Batch Inventory
        </div>

        <p className="mt-2 text-sm text-red-700">
          {error}
        </p>

      </div>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <section className="space-y-6 text-[#17265B]">

      {/* ======================================
          PAGE HEADER
      ====================================== */}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div>

          <h2 className="flex items-center gap-2 font-serif text-2xl font-bold">

            <Truck
              size={24}
              className="text-[#3654FF]"
            />

            Lorry Stock Inventory

          </h2>

          <p className="mt-2 text-sm text-slate-500">
            View the total quantity of each
            product and its production batch
            numbers in the selected lorry.
          </p>

        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">

          <p className="text-xs font-semibold text-blue-600">
            Selected Lorry
          </p>

          <p className="mt-1 font-bold text-[#17265B]">
            {vehicleNumber || "Active Sales Vehicle"}
          </p>

        </div>

      </div>

      {/* ======================================
          INVENTORY SUMMARY
      ====================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* PRODUCT COUNT */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Package size={17} />
            Product Variants
          </div>

          <p className="mt-3 text-3xl font-bold">
            {formatQuantity(summary.totalProducts)}
          </p>

        </div>

        {/* TOTAL STOCK */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Boxes size={17} />
            Total Stock Units
          </div>

          <p className="mt-3 text-3xl font-bold">
            {formatQuantity(summary.totalStock)}
          </p>

        </div>

        {/* AVAILABLE STOCK */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CheckCircle2 size={17} />
            Available Units
          </div>

          <p className="mt-3 text-3xl font-bold text-green-700">
            {formatQuantity(summary.availableStock)}
          </p>

        </div>

        {/* TOTAL BATCHES */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Package size={17} />
            Batch Records
          </div>

          <p className="mt-3 text-3xl font-bold text-[#3654FF]">
            {formatQuantity(summary.totalBatches)}
          </p>

        </div>

      </div>

      {/* ======================================
          RECONCILIATION WARNING
      ====================================== */}

      {summary.mismatchedProducts > 0 && (

        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">

          <AlertTriangle
            size={20}
            className="mt-0.5 shrink-0 text-amber-700"
          />

          <div>

            <p className="font-bold text-amber-800">
              Batch Inventory Reconciliation Warning
            </p>

            <p className="mt-1 text-sm text-amber-700">
              {summary.mismatchedProducts} product
              record(s) have batch totals that do
              not match their lorry stock quantity.
              Review the batch records before
              transferring these products.
            </p>

          </div>

        </div>

      )}

      {/* ======================================
          GROUPED PRODUCT CARDS
      ====================================== */}

      {products.length > 0 ? (

        <div className="grid gap-5 lg:grid-cols-2">

          {products.map((product) => (

            <article
              key={product.vehicleStockId}
              className={
                "rounded-2xl border border-slate-200 " +
                "bg-white p-5 shadow-sm"
              }
            >

              {/* PRODUCT NAME AND SIZE */}

              <div className="flex items-start gap-3">

                <div className="rounded-xl bg-blue-50 p-3">
                  <Package
                    size={22}
                    className="text-[#3654FF]"
                  />
                </div>

                <div className="min-w-0 flex-1">

                  <h3 className="text-lg font-bold text-[#17265B]">
                    {product.productName ||
                      product.productId ||
                      "Unknown Product"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {product.size || "—"}
                    {" — "}
                    {product.flavour || "—"}
                  </p>

                </div>

              </div>

              {/* TOTAL QUANTITY */}

              <div className="mt-5 rounded-xl bg-slate-50 p-4">

                <p className="text-xs font-semibold text-slate-500">
                  Total Units in Lorry
                </p>

                <p className="mt-2 text-3xl font-bold text-[#17265B]">
                  {formatQuantity(
                    product.totalQuantity
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">

                  <span>
                    Available:{" "}
                    <strong className="text-green-700">
                      {formatQuantity(
                        product.availableQuantity
                      )}
                    </strong>
                  </span>

                  <span>
                    Reserved:{" "}
                    <strong className="text-slate-700">
                      {formatQuantity(
                        product.reservedQuantity
                      )}
                    </strong>
                  </span>

                </div>

              </div>

              {/* BATCH HEADER */}

              <div className="mt-5 border-t border-slate-200 pt-4">

                <div className="flex items-center justify-between">

                  <h4 className="text-sm font-bold">
                    Production Batches
                  </h4>

                  <span className="text-xs text-slate-500">
                    {product.batches.length} batch(es)
                  </span>

                </div>

                <div className="mt-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">

                  <span>Batch Number</span>

                  <span>Quantity</span>

                </div>

              </div>

              {/* BATCH LIST */}

              <div className="mt-3 space-y-2">

                {product.batches.map((batch) => (

                  <div
                    key={
                      batch.vehicleBatchStockId ||
                      batch.batchNumber
                    }
                    className={
                      "rounded-xl border border-slate-100 " +
                      "bg-white px-3 py-3"
                    }
                  >

                    <div className="flex items-center justify-between gap-3">

                      <span className="text-sm font-medium text-slate-700">
                        Batch {batch.batchNumber}
                      </span>

                      <span className="text-lg font-bold text-[#17265B]">
                        {formatQuantity(
                          batch.quantity
                        )}
                      </span>

                    </div>

                    {batch.reservedQuantity > 0 && (

                      <div className="mt-2 flex justify-between text-xs text-slate-500">

                        <span>
                          Available:{" "}
                          {formatQuantity(
                            batch.availableQuantity
                          )}
                        </span>

                        <span>
                          Reserved:{" "}
                          {formatQuantity(
                            batch.reservedQuantity
                          )}
                        </span>

                      </div>

                    )}

                  </div>

                ))}

                {/* UNALLOCATED QUANTITY */}

                {product.unallocatedQuantity > 0 && (

                  <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-700">

                    <span>
                      No Batch Assigned
                    </span>

                    <strong>
                      {formatQuantity(
                        product.unallocatedQuantity
                      )}
                    </strong>

                  </div>

                )}

                {/* OVERALLOCATED QUANTITY */}

                {product.unallocatedQuantity < 0 && (

                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">

                    Batch quantities exceed total
                    stock by{" "}
                    {formatQuantity(
                      Math.abs(
                        product.unallocatedQuantity
                      )
                    )}{" "}
                    units.

                  </div>

                )}

                {/* NO BATCHES */}

                {product.batches.length === 0 && (

                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">

                    No batch numbers have been
                    recorded for this product.

                  </p>

                )}

              </div>

              {/* PRODUCT FOOTER */}

              <div className="mt-5 border-t border-slate-100 pt-4">

                <div className="flex items-center justify-between text-sm">

                  <span className="font-semibold text-slate-500">
                    Total Batch Quantity
                  </span>

                  <span className="font-bold text-[#17265B]">
                    {formatQuantity(
                      product.allocatedQuantity
                    )}
                  </span>

                </div>

              </div>

            </article>

          ))}

        </div>

      ) : (

        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">

          <Package
            size={35}
            className="mx-auto text-slate-400"
          />

          <p className="mt-4 font-semibold text-slate-600">
            No Lorry Inventory Available
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Select a lorry with existing stock
            to view products and their batches.
          </p>

        </div>

      )}

    </section>
  );
}
