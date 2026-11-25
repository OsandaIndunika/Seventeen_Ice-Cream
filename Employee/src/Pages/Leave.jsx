
import React, { useState } from "react";
import "./Leave.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  CalendarDays,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  ClipboardList,
  CheckCircle2
} from "lucide-react";

// Demo leave records
// Later these records will come from the backend.
const initialLeaveData = [
  {
    id: 1,
    date: "2026-11-10",
    type: "Casual Leave",
    days: 1,
    reason: "Personal Matter",
    status: "Approved"
  },
  {
    id: 2,
    date: "2026-10-15",
    type: "Sick Leave",
    days: 1,
    reason: "Medical Reason",
    status: "Approved"
  },
  {
    id: 3,
    date: "2026-09-20",
    type: "Annual Leave",
    days: 1,
    reason: "Family Event",
    status: "Approved"
  },
  {
    id: 4,
    date: "2026-08-12",
    type: "Casual Leave",
    days: 1,
    reason: "Personal Matter",
    status: "Approved"
  },
  {
    id: 5,
    date: "2026-07-05",
    type: "Sick Leave",
    days: 1,
    reason: "Medical Reason",
    status: "Approved"
  },
  {
    id: 6,
    date: "2026-06-18",
    type: "Annual Leave",
    days: 2,
    reason: "Family Function",
    status: "Approved"
  }
];

// Format date
function formatDate(date) {
  if (!date) return "—";

  const [year, month, day] = date.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function Leave() {

  // Leave records
  const [leaveData, setLeaveData] = useState(initialLeaveData);

  // Annual leave allowance (demo)
  const [totalLeaveAllowance, setTotalLeaveAllowance] = useState(20);

  // Selected month for filtering
  const [selectedMonth, setSelectedMonth] = useState("2026-11");

  // Selected year for leave balance
  const selectedYear = Number(selectedMonth.split("-")[0]);

  // Approved leave records for selected year
  const approvedYearlyLeaves = leaveData.filter(
    (leave) =>
      leave.date.startsWith(String(selectedYear)) &&
      leave.status === "Approved"
  );

  // Total leaves taken in selected year
  const leavesTaken = approvedYearlyLeaves.reduce(
    (total, leave) => total + leave.days,
    0
  );

  // Remaining leaves
  const remainingLeaves = Math.max(
    0,
    totalLeaveAllowance - leavesTaken
  );

  // Leaves taken in selected month
  const thisMonthLeaves = leaveData
    .filter(
      (leave) =>
        leave.date.startsWith(selectedMonth) &&
        leave.status === "Approved"
    )
    .reduce(
      (total, leave) => total + leave.days,
      0
    );

  // Filter leave history by selected month
  const filteredLeaveHistory = leaveData
    .filter((leave) => leave.date.startsWith(selectedMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Summary cards
  const summaryCards = [
    {
      title: "Total Leave Allowance",
      value: totalLeaveAllowance,
      description: "Days per year",
      icon: CalendarDays,
      color: "green"
    },
    {
      title: "Leaves Taken",
      value: leavesTaken,
      description: `Taken in ${selectedYear}`,
      icon: CalendarCheck,
      color: "pink"
    },
    {
      title: "Remaining Leaves",
      value: remainingLeaves,
      description: "Available leave days",
      icon: CalendarClock,
      color: "blue"
    },
    {
      title: "This Month Leaves",
      value: thisMonthLeaves,
      description: "Days taken this month",
      icon: CalendarX,
      color: "orange"
    }
  ];

  return (
    <div className="employee-app-container">

      <SideBar />

      <main className="employee-main-content">

        <Header
          headername="My Leave"
          description="View your leave balance and history."
        />

        <div className="leave-page-body">

          {/* MONTH FILTER */}

          <div className="leave-page-heading">

            <div className="leave-month-filter">

              <label htmlFor="leave-month">
                Select Month
              </label>

              <input
                id="leave-month"
                type="month"
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(e.target.value)
                }
              />

            </div>

          </div>

          {/* SUMMARY CARDS */}

          <div className="leave-summary-grid">

            {summaryCards.map((card) => {

              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className={`leave-summary-card ${card.color}`}
                >

                  <div className="leave-summary-icon">
                    <Icon size={22} />
                  </div>

                  <p>{card.title}</p>

                  <h2>
                    {card.value}
                    <span className="leave-days-label">
                      Days
                    </span>
                  </h2>

                  <span className="leave-card-description">
                    {card.description}
                  </span>

                </div>
              );
            })}

          </div>

          {/* LEAVE BALANCE SECTION */}

          <section className="leave-balance-section">

            <div className="leave-section-header">

              <div className="leave-section-title">
                <CalendarCheck size={20} />
                <h2>Annual Leave Overview</h2>
              </div>

              <span className="leave-year-badge">
                {selectedYear}
              </span>

            </div>

            <div className="leave-balance-details">

              <div className="leave-balance-info">

                <div>
                  <p>Total Allowance</p>
                  <h3>{totalLeaveAllowance} Days</h3>
                </div>

                <div>
                  <p>Leaves Taken</p>
                  <h3>{leavesTaken} Days</h3>
                </div>

                <div>
                  <p>Remaining</p>
                  <h3>{remainingLeaves} Days</h3>
                </div>

              </div>

              {/* PROGRESS BAR */}

              <div className="leave-progress-container">

                <div className="leave-progress-label">

                  <span>Leave Usage</span>

                  <span>
                    {totalLeaveAllowance > 0
                      ? Math.round(
                          (leavesTaken / totalLeaveAllowance) * 100
                        )
                      : 0}
                    %
                  </span>

                </div>

                <div className="leave-progress-bar">

                  <div
                    className="leave-progress-fill"
                    style={{
                      width: `${
                        totalLeaveAllowance > 0
                          ? Math.min(
                              (leavesTaken / totalLeaveAllowance) * 100,
                              100
                            )
                          : 0
                      }%`
                    }}
                  />

                </div>

                <p className="leave-progress-note">
                  {remainingLeaves} days remaining out of{" "}
                  {totalLeaveAllowance} allocated days.
                </p>

              </div>

            </div>

          </section>

          {/* LEAVE HISTORY */}

          <section className="leave-history-section">

            <div className="leave-history-heading">

              <div className="leave-history-title">

                <ClipboardList size={20} />

                <div>
                  <h2>Leave History</h2>
                  <p>
                    View your previously recorded leave details.
                  </p>
                </div>

              </div>

              <span className="leave-history-count">
                {filteredLeaveHistory.length} Records
              </span>

            </div>

            <div className="leave-table-wrapper">

              <table className="leave-table">

                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Leave Type</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {filteredLeaveHistory.length > 0 ? (

                    filteredLeaveHistory.map((leave) => (

                      <tr key={leave.id}>

                        <td>
                          {formatDate(leave.date)}
                        </td>

                        <td>
                          {leave.type}
                        </td>

                        <td>
                          {leave.days}
                        </td>

                        <td>
                          {leave.reason}
                        </td>

                        <td>
                          <span
                            className={`leave-status ${
                              leave.status.toLowerCase()
                            }`}
                          >
                            {leave.status === "Approved" && (
                              <CheckCircle2 size={13} />
                            )}

                            {leave.status}
                          </span>
                        </td>

                      </tr>

                    ))

                  ) : (

                    <tr>
                      <td
                        colSpan="5"
                        className="leave-empty-row"
                      >
                        No leave records found for the selected month.
                      </td>
                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

export default Leave;
