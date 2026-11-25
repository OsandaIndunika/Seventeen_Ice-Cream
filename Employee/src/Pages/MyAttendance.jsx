
import React, { useState } from "react";
import "./MyAttendance.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  CalendarCheck,
  ClockAlert,
  LogOut,
  Clock3
} from "lucide-react";

// Temporary shift times
const SHIFT_START = "08:00";
const SHIFT_END = "16:00";

// Convert HH:mm into minutes
function toMinutes(time) {
  if (!time) return null;

  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

// Convert 24-hour time to 12-hour time
function formatTime(time) {
  if (!time) return "—";

  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  return `${String(hour12).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")} ${period}`;
}

// Calculate working minutes
function getWorkingMinutes(entry, exit) {
  if (!entry || !exit) return 0;

  const entryMinutes = toMinutes(entry);
  const exitMinutes = toMinutes(exit);

  return Math.max(0, exitMinutes - entryMinutes);
}

// Convert minutes to hours and minutes
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

// Calculate attendance status
function getAttendanceStatus(record) {
  if (!record.entry) {
    return {
      label: "Absent",
      type: "absent"
    };
  }

  const isLate =
    toMinutes(record.entry) > toMinutes(SHIFT_START);

  if (!record.exit) {
    return {
      label: isLate
        ? "Late · Not Checked Out"
        : "Not Checked Out",
      type: isLate ? "late" : "pending"
    };
  }

  const isEarly =
    toMinutes(record.exit) < toMinutes(SHIFT_END);

  if (isLate && isEarly) {
    return {
      label: "Late & Early Departure",
      type: "late"
    };
  }

  if (isLate) {
    return {
      label: "Late",
      type: "late"
    };
  }

  if (isEarly) {
    return {
      label: "Early Departure",
      type: "early"
    };
  }

  return {
    label: "On Time",
    type: "ontime"
  };
}

function MyAttendance() {

  const [attendanceData, setAttendanceData] = useState([
    {
      id: 1,
      date: "2026-11-02",
      entry: "07:55",
      exit: "16:05"
    },
    {
      id: 2,
      date: "2026-11-03",
      entry: "08:25",
      exit: "16:00"
    },
    {
      id: 3,
      date: "2026-11-04",
      entry: "08:00",
      exit: "15:20"
    },
    {
      id: 4,
      date: "2026-11-05",
      entry: "08:30",
      exit: "15:30"
    },
    {
      id: 5,
      date: "2026-11-06",
      entry: "07:58",
      exit: "16:10"
    },
    {
      id: 6,
      date: "2026-11-09",
      entry: "08:00",
      exit: "16:00"
    },
    {
      id: 7,
      date: "2026-11-10",
      entry: "08:10",
      exit: "16:15"
    },
    {
      id: 8,
      date: "2026-11-11",
      entry: "07:50",
      exit: "15:45"
    },
    {
      id: 9,
      date: "2026-11-12",
      entry: "08:00",
      exit: "16:00"
    },
    {
      id: 10,
      date: "2026-11-13",
      entry: "07:55",
      exit: "16:10"
    },
    {
      id: 11,
      date: "2026-11-16",
      entry: "08:00",
      exit: "16:00"
    },
    {
      id: 12,
      date: "2026-11-17",
      entry: "07:55",
      exit: "16:05"
    },
    {
      id: 13,
      date: "2026-11-18",
      entry: "08:00",
      exit: "15:30"
    },
    {
      id: 14,
      date: "2026-11-19",
      entry: "07:50",
      exit: "16:00"
    },
    {
      id: 15,
      date: "2026-11-20",
      entry: "08:05",
      exit: "16:10"
    },
    {
      id: 16,
      date: "2026-11-23",
      entry: "08:02",
      exit: null
    }
  ]);

  // Selected month
  const [selectedMonth, setSelectedMonth] = useState("2026-11");

  // Filter attendance records by selected month
  const monthlyRecords = attendanceData
    .filter((record) => record.date.startsWith(selectedMonth))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate present days
  const presentDays = monthlyRecords.filter(
    (record) => record.entry
  ).length;

  // Calculate late arrivals
  const lateArrivals = monthlyRecords.filter(
    (record) =>
      record.entry &&
      toMinutes(record.entry) > toMinutes(SHIFT_START)
  ).length;

  // Calculate early departures
  const earlyDepartures = monthlyRecords.filter(
    (record) =>
      record.exit &&
      toMinutes(record.exit) < toMinutes(SHIFT_END)
  ).length;

  // Calculate total working minutes
  const totalMinutes = monthlyRecords.reduce(
    (total, record) => {
      return (
        total +
        getWorkingMinutes(record.entry, record.exit)
      );
    },
    0
  );

  // Summary card information
  const summaryCards = [
    {
      title: "Present Days",
      value: presentDays,
      icon: CalendarCheck,
      color: "green"
    },
    {
      title: "Late Arrivals",
      value: lateArrivals,
      icon: ClockAlert,
      color: "pink"
    },
    {
      title: "Early Departures",
      value: earlyDepartures,
      icon: LogOut,
      color: "orange"
    },
    {
      title: "Total Work Hours",
      value: formatDuration(totalMinutes),
      icon: Clock3,
      color: "blue"
    }
  ];

  return (
    <div className="employee-app-container">

      <SideBar />

      <main className="employee-main-content">

        <Header
          headername="My Attendance"
          description="View your daily entry, exit and working hours."
        />

        <div className="attendance-page-body">

          {/* PAGE HEADING */}

          <div className="attendance-page-heading">      
            {/* MONTH FILTER */}

            <div className="attendance-month-filter">

              <label htmlFor="attendance-month">
                Select Month
              </label>

              <input
                id="attendance-month"
                type="month"
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(e.target.value)
                }
              />

            </div>

          </div>

          {/* SUMMARY CARDS */}

          <div className="attendance-summary-grid">

            {summaryCards.map((card) => {

              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className={`attendance-summary-card ${card.color}`}
                >

                  <div className="attendance-summary-icon">
                    <Icon size={22} />
                  </div>

                  <p>{card.title}</p>

                  <h2>{card.value}</h2>

                </div>
              );
            })}

          </div>

          {/* ATTENDANCE RECORDS */}

          <section className="attendance-record-section">

            <div className="attendance-record-header">

              <div>
                <h2>Monthly Attendance Records</h2>
                <p>Daily fingerprint attendance history</p>
              </div>

              <span className="attendance-record-count">
                {monthlyRecords.length} Records
              </span>

            </div>

            <div className="attendance-table-wrapper">

              <table className="attendance-table">

                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Entry Time</th>
                    <th>Exit Time</th>
                    <th>Working Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {monthlyRecords.map((record) => {

                    const status = getAttendanceStatus(record);

                    const date = new Date(
                      `${record.date}T12:00:00`
                    );

                    return (
                      <tr key={record.id}>

                        <td>
                          {date.toLocaleDateString("en-GB")}
                        </td>

                        <td>
                          {date.toLocaleDateString("en-US", {
                            weekday: "short"
                          })}
                        </td>

                        <td>
                          {formatTime(record.entry)}
                        </td>

                        <td>
                          {formatTime(record.exit)}
                        </td>

                        <td>
                          {record.entry && record.exit
                            ? formatDuration(
                                getWorkingMinutes(
                                  record.entry,
                                  record.exit
                                )
                              )
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={`attendance-status ${status.type}`}
                          >
                            {status.label}
                          </span>
                        </td>

                      </tr>
                    );
                  })}

                  {monthlyRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="attendance-empty"
                      >
                        No attendance records found for this month.
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

export default MyAttendance;
