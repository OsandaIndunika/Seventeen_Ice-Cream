import React, { useState, useEffect } from "react";
import "./RecordUsage.css";


function RecordUsage({
  rawMaterials,
  selectedUsageMaterial,
  onSaveUsage
}) {


  const [usageDate, setUsageDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );

  const [currentUsage, setCurrentUsage] = useState({
    material: "",
    quantity: ""
  });

  const [usageItems, setUsageItems] = useState([]);

  useEffect(() => {
    if (selectedUsageMaterial) {
      setCurrentUsage({
        material: selectedUsageMaterial,
        quantity: ""
      });
    }
  }, [selectedUsageMaterial]);


  const handleAddUsageMaterial = () => {
    const { material, quantity } = currentUsage;

    if (!material || !quantity || Number(quantity) <= 0) {
      alert("Please select a material and enter a valid quantity.");
      return;
    }

    const selectedMaterial = rawMaterials.find(
      (item) => item.name === material
    );

    if (!selectedMaterial) {
      alert("Material not found.");
      return;
    }

    const usedQuantity = Number(quantity);

    const alreadyAddedQuantity = usageItems
      .filter((item) => item.material === material)
      .reduce((total, item) => total + Number(item.quantity), 0);

    if (usedQuantity + alreadyAddedQuantity > selectedMaterial.quantity) {
      alert("Insufficient stock available.");
      return;
    }

    const newUsageItem = {
      id: crypto.randomUUID(),
      material,
      quantity: usedQuantity,
      unit: selectedMaterial.unit
    };

    setUsageItems((prev) => [...prev, newUsageItem]);

    setCurrentUsage({
      material: "",
      quantity: ""
    });
  };


const handleSaveUsage = () => {
  if (!usageDate) {
    alert("Please select a usage date.");
    return;
  }

  if (usageItems.length === 0) {
    alert("Please add at least one material.");
    return;
  }

  
const newUsage = {
  id: crypto.randomUUID(),
  date: usageDate,
  material: usageItems.map((item) => item.material).join(", "),
  quantity: usageItems.reduce(
    (total, item) => total + Number(item.quantity),
    0
  ),
  items: usageItems
};


  const saved = onSaveUsage(newUsage);

if (!saved) return;

  setUsageItems([]);
  setCurrentUsage({
    material: "",
    quantity: ""
  });

  alert("Material usage recorded successfully!");
};




  return (
    <section className="raw-usage-view">

      <h3>Record Raw Material Usage</h3>

      <div className="usage-form">

        {/* Usage Date */}
        <div className="usage-field">
          <label>Usage Date</label>

          <input
            type="date"
            value={usageDate}
            onChange={(e) => setUsageDate(e.target.value)}
          />
        </div>

        {/* Material Selection */}
        <div className="usage-field">
          <label>Raw Material</label>

          <select
            value={currentUsage.material}
            onChange={(e) =>
              setCurrentUsage((prev) => ({
                ...prev,
                material: e.target.value,
                quantity: ""
              }))
            }
          >
            <option value="">Select Raw Material</option>

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

        {/* Used Quantity */}
        <div className="usage-field">
          <label>Used Quantity</label>

          <div className="usage-quantity-row">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Enter used quantity"
              value={currentUsage.quantity}
              onChange={(e) =>
                setCurrentUsage((prev) => ({
                  ...prev,
                  quantity: e.target.value
                }))
              }
            />

            <span className="usage-unit">
              {rawMaterials.find(
                (material) =>
                  material.name === currentUsage.material
              )?.unit || "Unit"}
            </span>
          </div>
        </div>

        {/* Add Material */}
        <button
          type="button"
          className="usage-add-btn"
          onClick={handleAddUsageMaterial}
        >
          + Add Material
        </button>

      </div>

      {/* Added Usage Materials */}
      {usageItems.length > 0 && (
        <div className="usage-items-section">

          <h4>
            Added Materials ({usageItems.length})
          </h4>

          <div className="material-table-wrapper">
            <table className="material-table">

              <thead>
                <tr>
                  <th>Material</th>
                  <th>Used Quantity</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {usageItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.material}</td>

                    <td>
                      {item.quantity} {item.unit}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="usage-remove-btn"
                        onClick={() =>
                          setUsageItems((prev) =>
                            prev.filter(
                              (usage) => usage.id !== item.id
                            )
                          )
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        </div>
      )}

      {/* Save Usage */}
      {usageItems.length > 0 && (
        <div className="usage-save-actions">
          <button
            type="button"
            className="usage-save-btn"
            onClick={handleSaveUsage}
          >
            Save Usage & Update Stock
          </button>
        </div>
      )}

    </section>
  );
}

export default RecordUsage;
