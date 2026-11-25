
import React, { useState } from "react";
import "./Overtime.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  Clock3,
  Wallet,
  CalendarDays,
  TrendingUp,
  ClipboardList
} from "lucide-react";

// Demo overtime records
// Replace with backend API data later
const initialOvertimeData = [
  {
    id: 1,
    date: "2026-11-03",
    startTime: "16:00",
    endTime: "18:00",
    hours: 2,
    amount: 750,
    status: "Approved"
  },
  {
    id: 2,
    date: "2026-11-07",
    startTime: "16:00",
    endTime: "19:00",
    hours: 3,
    amount: 1125,
    status: "Approved"
  },
  {
    id: 3,
    date: "2026-11-12",
    startTime: "16:00",
    endTime: "18:30",
    hours: 2.5,
    amount: 937.5,
    status: "Approved"
  },
  {
    id: 4,
    date: "2026-11-18",
    startTime: "16:00",
    endTime: "20:30",
    hours: 4.5,
    amount: 1687.5,
    status: "Approved"
  },
  {
    id: 5,
    date: "2026-10-05",
    startTime: "16:00",
    endTime: "19:00",
    hours: 3,
    amount: 1125,
    status: "Approved"
  },
  {
    id: 6,
    date: "2026-10-12",
    startTime: "16:00",
    endTime: "20:00",
    hours: 4,
    amount: 1500,
    status: "Approved"
  },
  {
    id: 7,
    date: "2026-10-19",
    startTime: "16:00",
    endTime: "21:00",
    hours: 5,
    amount: 1875,
    status: "Approved"
  },
  {
    id: 8,
    date: "2026-10-25",
    startTime: "16:00",
    endTime: "22:00",
    hours: 6,
    amount: 2250,
    status: "Approved"
  }
];

// Format currency
function formatCurrency(amount) {
  return Number(amount).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

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

// Format time
function formatTime(time) {
  if (!time) return "—";

  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${String(hour12).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")} ${period}`;
}

function Overtime() {

  // Overtime records
  const [overtimeData, setOvertimeData] = useState(
    initialOvertimeData
  );

  // Selected month
  const [selectedMonth, setSelectedMonth] = useState(
    "2026-11"
  );

  // Filter records for selected month
  const filteredOvertime = overtimeData
    .filter((record) =>
      record.date.startsWith(selectedMonth)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Approved overtime records
  const approvedOvertime = filteredOvertime.filter(
    (record) => record.status === "Approved"
  );

  // Total approved overtime hours
  const totalOvertimeHours = approvedOvertime.reduce(
    (total, record) => total + record.hours,
    0
  );

  // Total approved overtime earnings
  const totalOvertimeEarnings = approvedOvertime.reduce(
    (total, record) => total + record.amount,
    0
  );

  // Number of overtime days
  const overtimeDays = new Set(
    approvedOvertime.map((record) => record.date)
  ).size;

  // Average overtime hours per day
  const averageOvertime = overtimeDays > 0
    ? totalOvertimeHours / overtimeDays
    : 0;

  // Summary cards
  const summaryCards = [
    {
      title: "Total Overtime Hours",
      value: `${totalOvertimeHours.toFixed(1)} hrs`,
      description: "Approved overtime hours",
      icon: Clock3,
      color: "green"
    },
    {
      title: "Overtime Earnings",
      value: `Rs. ${formatCurrency(totalOvertimeEarnings)}`,
      description: "Approved overtime payments",
      icon: Wallet,
      color: "pink"
    },
    {
      title: "Overtime Days",
      value: overtimeDays,
      description: "Days with approved overtime",
      icon: CalendarDays,
      color: "blue"
    },
    {
      title: "Average Overtime",
      value: `${averageOvertime.toFixed(1)} hrs`,
      description: "Average hours per overtime day",
      icon: TrendingUp,
      color: "orange"
    }
  ];

  return (
    <div className="employee-app-container">

      <SideBar />

      <main className="employee-main-content">

        <Header
          headername="My Overtime"
          description="View your overtime hours and earnings."
        />

        <div className="overtime-page-body">

          {/* MONTH FILTER */}

          <div className="overtime-page-heading">

            <div className="overtime-month-filter">

              <label htmlFor="overtime-month">
                Select Month
              </label>

              <input
                id="overtime-month"
                type="month"
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(e.target.value)
                }
              />

            </div>

          </div>

          {/* SUMMARY CARDS */}

          <div className="overtime-summary-grid">

            {summaryCards.map((card) => {

              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className={`overtime-summary-card ${card.color}`}
                >

                  <div className="overtime-summary-icon">
                    <Icon size={22} />
                  </div>

                  <p>{card.title}</p>

                  <h2>{card.value}</h2>

                  <span className="overtime-card-description">
                    {card.description}
                  </span>

                </div>
              );
            })}

          </div>

          {/* OVERTIME HISTORY */}

          <section className="overtime-history-section">

            <div className="overtime-history-heading">

              <div className="overtime-history-title">

                <ClipboardList size={20} />

                <div>
                  <h2>Overtime History</h2>
                  <p>
                    View your recorded overtime details.
                  </p>
                </div>

              </div>

              <span className="overtime-history-count">
                {filteredOvertime.length} Records
              </span>

            </div>

            <div className="overtime-table-wrapper">

              <table className="overtime-table">

                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>OT Hours</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {filteredOvertime.length > 0 ? (

                    filteredOvertime.map((record) => (

                      <tr key={record.id}>

                        <td>
                          {formatDate(record.date)}
                        </td>

                        <td>
                          {formatTime(record.startTime)}
                        </td>

                        <td>
                          {formatTime(record.endTime)}
                        </td>

                        <td className="overtime-hours-cell">
                          {record.hours.toFixed(1)} hrs
                        </td>

                        <td>
                          Rs. {formatCurrency(record.amount)}
                        </td>

                        <td>
                          <span
                            className={`overtime-status ${
                              record.status.toLowerCase()
                            }`}
                          >
                            {record.status}
                          </span>
                        </td>

                      </tr>

                    ))

                  ) : (

                    <tr>
                      <td
                        colSpan="6"
                        className="overtime-empty-row"
                      >
                        No overtime records found for the
                        selected month.
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

export default Overtime;
