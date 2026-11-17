import React, { useState, useRef } from "react";
import "./AddPurchase.css";

function AddPurchase({
  rawMaterials,
  onSavePurchase
}) {
  const [supplierName, setSupplierName] = useState("");
const [purchaseDate, setPurchaseDate] = useState("");
const [billFile, setBillFile] = useState(null);

const billFileInputRef = useRef(null);

const [purchaseItems, setPurchaseItems] = useState([]);

const [currentItem, setCurrentItem] = useState({
  material: "",
  quantity: "",
  unit: "kg",
  totalAmount: ""
});

const [editingItemId, setEditingItemId] = useState(null);


const handleCurrentItemChange = (field, value) => {
  setCurrentItem((prev) => ({
    ...prev,
    [field]: value
  }));
};

const handleAddOrUpdateMaterial = () => {
  const { material, quantity, unit, totalAmount } = currentItem;

  if (
    !material ||
    quantity === "" ||
    !Number.isFinite(Number(quantity)) ||
    Number(quantity) <= 0 ||
    totalAmount === "" ||
    !Number.isFinite(Number(totalAmount)) ||
    Number(totalAmount) < 0
  ) {
    alert("Please enter valid material details.");
    return;
  }

  const selectedMaterial = rawMaterials.find(
    (item) => item.name === material
  );

  if (!selectedMaterial || selectedMaterial.unit !== unit) {
    alert("Please select a valid material and unit.");
    return;
  }

  if (editingItemId !== null) {
    setPurchaseItems((prev) =>
      prev.map((item) =>
        item.id === editingItemId
          ? { ...currentItem, id: editingItemId }
          : item
      )
    );

    setEditingItemId(null);
  } else {
    setPurchaseItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ...currentItem
      }
    ]);
  }

  setCurrentItem({
    material: "",
    quantity: "",
    unit: "kg",
    totalAmount: ""
  });
};

const handleEditMaterial = (id) => {
  const itemToEdit = purchaseItems.find(
    (item) => item.id === id
  );

  if (!itemToEdit) return;

  setCurrentItem({
    material: itemToEdit.material,
    quantity: itemToEdit.quantity,
    unit: itemToEdit.unit,
    totalAmount: itemToEdit.totalAmount
  });

  setEditingItemId(id);
};

const handleRemoveMaterial = (id) => {
  setPurchaseItems((prev) =>
    prev.filter((item) => item.id !== id)
  );

  if (editingItemId === id) {
    setEditingItemId(null);

    setCurrentItem({
      material: "",
      quantity: "",
      unit: "kg",
      totalAmount: ""
    });
  }
};

const handleCancelEdit = () => {
  setEditingItemId(null);

  setCurrentItem({
    material: "",
    quantity: "",
    unit: "kg",
    totalAmount: ""
  });
};

const totalCost = purchaseItems.reduce(
  (total, item) => total + Number(item.totalAmount || 0),
  0
);


const handleSavePurchase = () => {
  if (!supplierName.trim()) {
    alert("Please enter supplier name.");
    return;
  }

  if (!purchaseDate) {
    alert("Please select purchase date.");
    return;
  }

  if (purchaseItems.length === 0) {
    alert("Please add at least one material.");
    return;
  }

  const invalidItem = purchaseItems.some((item) => {
    const selectedMaterial = rawMaterials.find(
      (material) => material.name === item.material
    );

    return (
      !selectedMaterial ||
      selectedMaterial.unit !== item.unit ||
      item.quantity === "" ||
      !Number.isFinite(Number(item.quantity)) ||
      Number(item.quantity) <= 0 ||
      item.totalAmount === "" ||
      !Number.isFinite(Number(item.totalAmount)) ||
      Number(item.totalAmount) < 0
    );
  });

  if (invalidItem) {
    alert("Please check purchased material details.");
    return;
  }

  if (!billFile) {
    alert("Please upload a purchase bill.");
    return;
  }

  const newBill = {
    id: `RM-${Date.now()}`,
    supplier: supplierName.trim(),
    date: purchaseDate,
    material: purchaseItems.map((item) => item.material).join(", "),
    items: purchaseItems.map((item) => ({
      material: item.material,
      quantity: Number(item.quantity),
      unit: item.unit,
      totalAmount: Number(item.totalAmount)
    })),
    amount: totalCost.toFixed(2),
    file: billFile
  };

  onSavePurchase(newBill);

  setSupplierName("");
  setPurchaseDate("");
  setBillFile(null);
  setPurchaseItems([]);
  setEditingItemId(null);

  setCurrentItem({
    material: "",
    quantity: "",
    unit: "kg",
    totalAmount: ""
  });

  if (billFileInputRef.current) {
    billFileInputRef.current.value = "";
  }

  alert("Purchase saved and stock updated successfully!");
};


  return (
    <section className="add-purchase">

      <div className="purchase-header">
        <h3>Add Purchase</h3>
      </div>

      <div className="purchase-form">

        {/* Supplier Name */}
        <div className="purchase-field">
          <label>Supplier Name</label>
          <input
            type="text"
            placeholder="Enter supplier name"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
        </div>

        {/* Purchase Date */}
        <div className="purchase-field">
          <label>Purchase Date</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        {/* Purchased Materials */}
        <div className="purchase-items-section">
          <h4>Purchased Materials</h4>

          {/* Material Entry Form */}
          <div className="purchase-item-card">

            <div className="purchase-item-header">
              <span>
                {editingItemId !== null
                  ? "Edit Material"
                  : "Add Raw Material"}
              </span>
            </div>

            <div className="purchase-field">
              <label>Raw Material</label>

              <select
                value={currentItem.material}
                onChange={(e) => {
                  const selectedName = e.target.value;

                  const selectedMaterial = rawMaterials.find(
                    (material) => material.name === selectedName
                  );

                  setCurrentItem((prev) => ({
                    ...prev,
                    material: selectedName,
                    unit: selectedMaterial?.unit || "kg"
                  }));
                }}
              >
                <option value="" disabled>
                  Select Material
                </option>

                {rawMaterials.map((material) => (
                  <option
                    key={material.id}
                    value={material.name}
                  >
                    {material.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="purchase-compact-row">

              <div className="purchase-field">
                <label>Quantity</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Qty"
                  value={currentItem.quantity}
                  onChange={(e) =>
                    handleCurrentItemChange(
                      "quantity",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="purchase-field">
                <label>Unit</label>
                <input
                  type="text"
                  value={currentItem.unit}
                  readOnly
                />
              </div>

              <div className="purchase-field">
                <label>Total Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  value={currentItem.totalAmount}
                  onChange={(e) =>
                    handleCurrentItemChange(
                      "totalAmount",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

            <div className="purchase-form-actions">

              <button
                type="button"
                className="add-purchase-item-btn"
                onClick={handleAddOrUpdateMaterial}
              >
                {editingItemId !== null
                  ? "Update Material"
                  : "+ Add Material"}
              </button>

              {editingItemId !== null && (
                <button
                  type="button"
                  className="cancel-material-edit-btn"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}

            </div>
          </div>

          {/* Added Materials List */}
          {purchaseItems.length > 0 && (
            <div className="added-materials-list">

              <h4>
                Added Materials ({purchaseItems.length})
              </h4>

              {purchaseItems.map((item) => (
                <div
                  className="added-material-row"
                  key={item.id}
                >
                  <div className="added-material-info">
                    <strong>{item.material}</strong>

                    <span>
                      {item.quantity} {item.unit} · Rs.{" "}
                      {Number(item.totalAmount).toFixed(2)}
                    </span>
                  </div>

                  <div className="added-material-actions">
                    <button
                      type="button"
                      className="added-material-edit"
                      onClick={() => handleEditMaterial(item.id)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="added-material-remove"
                      onClick={() => handleRemoveMaterial(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

            </div>
          )}

        </div>

        {/* Total Cost */}
        <div className="purchase-field">
          <label>Total Cost (Rs)</label>
          <input
            type="number"
            value={totalCost.toFixed(2)}
            readOnly
          />
        </div>

        {/* Bill / Receipt Upload */}
        <div className="purchase-field">
          <label>Bill / Receipt</label>

          <div className="purchase-receipt-box">

            <div className="receipt-placeholder">
              <span>RECEIPT</span>
              <div className="receipt-line"></div>
              <div className="receipt-line short"></div>
              <div className="receipt-line"></div>
              <div className="receipt-line short"></div>
            </div>

            <div className="receipt-upload">
              <p>Upload Purchase Bill</p>

              <input
                ref={billFileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="purchase-file-input"
                onChange={(e) =>
                  setBillFile(e.target.files[0] || null)
                }
              />
            </div>

          </div>
        </div>

        {/* Save Purchase */}
        <button
          type="button"
          className="purchase-save-btn"
          onClick={handleSavePurchase}
        >
          Save Purchase & Update Stock
        </button>

      </div>
    </section>
  );
}

export default AddPurchase;
