
import React from "react";
import "./SummaryCards.css";

function SummaryCards({
  totalMaterials,
  lowStockCount,
  monthlySpending,
  totalBills
}) {
  return (
    <section className="material-summary-container">

      <div className="material-summary-card">
        <span className="material-summary-label">
          Material Track
        </span>

        <strong className="material-summary-value">
          {totalMaterials}
        </strong>

        <span className="material-summary-description">
          Raw materials registered
        </span>
      </div>

      <div className="material-summary-card">
        <span className="material-summary-label">
          Low Stock Alert
        </span>

        <strong className="material-summary-value">
          {lowStockCount}
        </strong>

        <span className="material-summary-description">
          Low and critical stock items
        </span>
      </div>

      <div className="material-summary-card">
        <span className="material-summary-label">
          Spend This Month
        </span>

        <strong className="material-summary-value">
          Rs. {monthlySpending.toLocaleString("en-LK")}
        </strong>

        <span className="material-summary-description">
          Current month purchases
        </span>
      </div>

      <div className="material-summary-card">
        <span className="material-summary-label">
          Bills Saved
        </span>

        <strong className="material-summary-value">
          {totalBills}
        </strong>

        <span className="material-summary-description">
          Total purchase bills
        </span>
      </div>

    </section>
  );
}

export default SummaryCards;
