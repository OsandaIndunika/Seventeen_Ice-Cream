
import React from "react";
import "./MaterialTable.css";

function MaterialTable({
  rawMaterials,
  handleAddNewMaterial,
  handleUseMaterial
}) {
  return (
    <section className="remaining-materials">

      <div className="remaining-materials-header">
        <h3>Remaining Raw Materials</h3>

        <button
          className="add-material-btn"
          onClick={handleAddNewMaterial}
        >
          + New Material
        </button>
      </div>

      <div className="material-table-wrapper">
        <table className="material-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Remaining</th>
              <th>Level</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {rawMaterials.map((material) => {
              const percentage = Math.min(
                (material.quantity / material.capacity) * 100,
                100
              );

              const status =
                percentage <= 10
                  ? "critical"
                  : percentage <= 25
                    ? "low"
                    : "good";

              return (
                <tr key={material.id}>
                  <td>{material.name}</td>

                  <td>
                    {material.quantity} {material.unit}
                  </td>

                  <td>
                    <div className="stock-progress">
                      <div
                        className={`stock-progress-fill ${
                          status === "good" ? "" : status
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </td>

                  <td>
                    <span className={`stock-status ${status}`}>
                      {status === "good"
                        ? "Good"
                        : status === "low"
                          ? "Low"
                          : "Critical"}
                    </span>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="material-add-btn"
                      onClick={() => handleUseMaterial(material.id)}
                    >
                      Use
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </section>
  );
}

export default MaterialTable;
