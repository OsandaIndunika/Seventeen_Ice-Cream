import React, { useEffect, useState } from "react";
import "./BillPreview.css";

function BillPreview({
 selectedBill,
  setSelectedBill
}) {

  
const [billPreviewUrl, setBillPreviewUrl] = useState(null);

useEffect(() => {
  if (!selectedBill?.file) {
    setBillPreviewUrl(null);
    return;
  }

  const url = URL.createObjectURL(selectedBill.file);
  setBillPreviewUrl(url);

  return () => {
    URL.revokeObjectURL(url);
  };
}, [selectedBill]);


const handleDownloadBill = () => {
  if (!billPreviewUrl || !selectedBill?.file) return;

  const link = document.createElement("a");

  link.href = billPreviewUrl;
  link.download = selectedBill.file.name;

  document.body.appendChild(link);
  link.click();
  link.remove();
};

const handlePrintBill = () => {
  if (!billPreviewUrl) return;

  const printWindow = window.open(
    billPreviewUrl,
    "_blank"
  );

  if (!printWindow) {
    alert("Please allow pop-ups to print the bill.");
  }
};



  if (!selectedBill) return null;

  return (
    <section className="bill-preview">

      {/* Preview Header */}
      <div className="bill-preview-header">
        <h3>Bill Preview</h3>

        <button
          type="button"
          className="bill-preview-close"
          onClick={() => setSelectedBill(null)}
          aria-label="Close bill preview"
        >
          ✕
        </button>
      </div>

      {/* Uploaded Receipt Image / PDF */}
      <div className="bill-preview-receipt">
        {billPreviewUrl && selectedBill.file ? (
          selectedBill.file.type.startsWith("image/") ? (
            <img
              src={billPreviewUrl}
              alt="Purchase Bill"
              className="bill-preview-image"
            />
          ) : selectedBill.file.type === "application/pdf" ? (
            <iframe
              src={billPreviewUrl}
              title="Purchase Bill PDF"
              className="bill-preview-pdf"
            />
          ) : (
            <p>Unsupported receipt format.</p>
          )
        ) : (
          <p>No bill image uploaded.</p>
        )}
      </div>

      {/* Bill Details */}
      <div className="bill-preview-details">

        <div className="bill-preview-detail-row">
          <span>Bill Number</span>
          <strong>{selectedBill.id}</strong>
        </div>

        <div className="bill-preview-detail-row">
          <span>Supplier</span>
          <strong>{selectedBill.supplier}</strong>
        </div>

        <div className="bill-preview-detail-row">
          <span>Purchase Date</span>
          <strong>{selectedBill.date}</strong>
        </div>

        <div className="bill-preview-detail-row">
          <span>Raw Materials</span>
          <strong>{selectedBill.material}</strong>
        </div>

        <div className="bill-preview-detail-row">
          <span>Total Amount</span>
          <strong>
            Rs. {selectedBill.amount}
          </strong>
        </div>

      </div>

      {/* Action Buttons */}
      <div className="bill-preview-actions">

        <button
          type="button"
          className="bill-download-btn"
          onClick={handleDownloadBill}
          disabled={!billPreviewUrl}
        >
          Download
        </button>

        <button
          type="button"
          className="bill-print-btn"
          onClick={handlePrintBill}
          disabled={!billPreviewUrl}
        >
          Open to Print
        </button>

      </div>

    </section>
  );
}

export default BillPreview;
