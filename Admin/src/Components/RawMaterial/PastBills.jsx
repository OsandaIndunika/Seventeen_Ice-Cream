
import React, { useEffect, useState } from "react";
import "./PastBills.css";

// Displays the uploaded receipt thumbnail
function ReceiptThumbnail({ file, billId }) {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setImageUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!file) {
    return <p>No Receipt Uploaded</p>;
  }

  if (file.type === "application/pdf") {
    return (
      <div className="past-bill-pdf">
        <span>📄</span>
        <p>PDF Receipt</p>
      </div>
    );
  }

  if (!file.type.startsWith("image/")) {
    return <p>Unsupported file</p>;
  }

  return imageUrl ? (
    <img
      src={imageUrl}
      alt={`Receipt ${billId}`}
      className="past-bill-image"
    />
  ) : null;
}

function PastBills({
  pastBills,
  setSelectedBill
}) {


const [billSearch, setBillSearch] = useState("");
const [selectedBillMonth, setSelectedBillMonth] = useState("all");

const filteredBills = pastBills.filter((bill) => {
  const searchText = billSearch.trim().toLowerCase();

  const matchesSearch =
    String(bill.supplier ?? "")
      .toLowerCase()
      .includes(searchText) ||
    String(bill.id ?? "")
      .toLowerCase()
      .includes(searchText);

  const matchesMonth =
    selectedBillMonth === "all" ||
    bill.date?.slice(0, 7) === selectedBillMonth;

  return matchesSearch && matchesMonth;
});


  const availableMonths = [
    ...new Set(
      pastBills
        .map((bill) => bill.date?.slice(0, 7))
        .filter(Boolean)
    )
  ]
    .sort()
    .reverse();

  return (
    <section className="past-bills">

      <h3>Past Bills</h3>

      {/* Search and Month Filter */}
      <div className="past-bills-filters">

        <input
          type="text"
          placeholder="Search by supplier or bill number..."
          value={billSearch}
          onChange={(e) => setBillSearch(e.target.value)}
        />

        <select
          value={selectedBillMonth}
          onChange={(e) => setSelectedBillMonth(e.target.value)}
        >
          <option value="all">All Months</option>

          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {new Date(
                `${month}-01T00:00:00`
              ).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric"
              })}
            </option>
          ))}
        </select>

      </div>

      {/* Past Bills Grid */}
      <div className="past-bills-grid">

        {filteredBills.length === 0 ? (
          <p className="no-bills-message">
            {pastBills.length === 0
              ? "No bills available."
              : "No bills match your search or selected month."}
          </p>
        ) : (
          filteredBills.map((bill) => (
            <div className="past-bill-card" key={bill.id}>

              {/* Actual Uploaded Receipt */}
              <div className="bill-receipt-placeholder">
                <ReceiptThumbnail
                  file={bill.file}
                  billId={bill.id}
                />
              </div>

              {/* Bill Number and Amount */}
              <div className="past-bill-info">
                <strong>{bill.id}</strong>
                <span>Rs. {bill.amount}</span>
              </div>

              {/* Supplier */}
              <p className="past-bill-supplier">
                {bill.supplier}
              </p>

              {/* Materials and Date */}
              <p className="past-bill-details">
                {bill.material} • {bill.date}
              </p>

              {/* View Bill */}
              <button
                type="button"
                className="view-bill-btn"
                onClick={() => setSelectedBill(bill)}
              >
                View Bill
              </button>

            </div>
          ))
        )}

      </div>
    </section>
  );
}

export default PastBills;
