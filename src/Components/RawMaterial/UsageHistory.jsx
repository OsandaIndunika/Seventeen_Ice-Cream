import React, { useState } from "react";
import "./UsageHistory.css";

function UsageHistory({ usageHistory }) {


  const [usageSearch, setUsageSearch] = useState("");
  const [usageFilterDate, setUsageFilterDate] = useState("");


  const filteredUsageHistory = usageHistory.filter((record) => {
    const searchText = usageSearch.trim().toLowerCase();

    const matchesMaterial =
      searchText === "" ||
      (record.items ?? []).some((item) =>
        String(item.material ?? "")
          .toLowerCase()
          .includes(searchText)
      ) ||
      String(record.material ?? "")
        .toLowerCase()
        .includes(searchText);

    const matchesDate =
      usageFilterDate === "" ||
      record.date === usageFilterDate;

    return matchesMaterial && matchesDate;
  });


  return (
    <section className="raw-history-view">

      <h3>Raw Material Usage History</h3>

      {/* Search and Date Filters */}
      <div className="usage-history-filters">

        <input
          type="text"
          placeholder="Search raw material..."
          value={usageSearch}
          onChange={(e) => setUsageSearch(e.target.value)}
        />

        <input
          type="date"
          value={usageFilterDate}
          onChange={(e) => setUsageFilterDate(e.target.value)}
        />

        <button
          type="button"
          className="usage-clear-btn"
          onClick={() => {
            setUsageSearch("");
            setUsageFilterDate("");
          }}
        >
          Clear Filters
        </button>

      </div>

      {/* Usage History Table */}
      <div className="material-table-wrapper">

        <table className="material-table">

          <thead>
            <tr>
              <th>Date</th>
              <th>Raw Material</th>
              <th>Used Quantity</th>
            </tr>
          </thead>



          <tbody>
            {(() => {
              const searchText = usageSearch.trim().toLowerCase();

              const rows = filteredUsageHistory.flatMap((record) => {
                const items = record.items?.length
                  ? record.items
                  : [{
                    id: record.id,
                    material: record.material,
                    quantity: record.quantity,
                    unit: record.unit
                  }];

                return items
                  .filter((item) =>
                    String(item.material ?? "")
                      .toLowerCase()
                      .includes(searchText)
                  )
                  .map((item) => (
                    <tr key={`${record.id}-${item.id}`}>
                      <td>{record.date}</td>
                      <td>{item.material}</td>
                      <td>{item.quantity} {item.unit}</td>
                    </tr>
                  ));
              });

              return rows.length === 0 ? (
                <tr>
                  <td colSpan="3" className="usage-empty-message">
                    No usage records found.
                  </td>
                </tr>
              ) : rows;
            })()}
          </tbody>



        </table>
      </div>

    </section>
  );
}

export default UsageHistory;
