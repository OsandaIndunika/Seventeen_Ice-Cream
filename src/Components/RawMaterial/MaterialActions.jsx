
import React from "react";
import "./MaterialActions.css";

import {
  Receipt,
  ReceiptText,
  Clipboard,
  RotateCcwClock,
  CircleChevronsLeft
} from "lucide-react";

function MaterialActions({
  activeView,
  setActiveView,
  setSelectedBill
}) {
  return (
    <div className="raw-material-actions">

      <button
        type="button"
        className="raw-action-btn"
        onClick={() => setActiveView("purchase")}
      >
        <Receipt size={15} />
        Add Purchase
      </button>

      <button
        type="button"
        className="raw-action-btn"
        onClick={() => setActiveView("bills")}
      >
        <ReceiptText size={15} />
        Past Bills
      </button>

      <button
        type="button"
        className="raw-action-btn"
        onClick={() => setActiveView("usage")}
      >
        <Clipboard size={15} />
        Record Usage
      </button>

      <button
        type="button"
        className="raw-action-btn"
        onClick={() => setActiveView("history")}
      >
        <RotateCcwClock size={15} />
        Usage History
      </button>

      <button
        type="button"
        className="raw-action-btn raw-dashboard-btn"
        onClick={() => {
          setActiveView("dashboard");
          setSelectedBill(null);
        }}
      >
        <CircleChevronsLeft size={15} />
        Back to Dashboard
      </button>

    </div>
  );
}

export default MaterialActions;
