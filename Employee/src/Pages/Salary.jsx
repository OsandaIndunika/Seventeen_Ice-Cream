
import React, { useState } from "react";
import "./Salary.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  Wallet,
  Clock3,
  TrendingDown,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock
} from "lucide-react";

// Format currency
function formatCurrency(amount) {
  return Number(amount).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Format month
function formatMonth(month) {
  if (!month) return "—";

  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(year, monthNumber - 1, 1)
    .toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });
}

// Calculate salary
function calculateSalary(record) {
  if (!record) {
    return {
      grossSalary: 0,
      totalDeductions: 0,
      netSalary: 0
    };
  }

  const grossSalary =
    record.basicSalary +
    record.overtimePay +
    record.allowances +
    record.bonuses;

  const totalDeductions =
    record.epfEmployee +
    record.otherDeductions;

  const netSalary = grossSalary - totalDeductions;

  return {
    grossSalary,
    totalDeductions,
    netSalary
  };
}

// Demo data - replace with backend API data later
const initialSalaryData = [
  {
    id: 1,
    month: "2026-11",
    basicSalary: 45000,
    overtimeHours: 12,
    overtimePay: 4500,
    allowances: 5000,
    bonuses: 2000,
    epfEmployee: 3600,
    otherDeductions: 500,
    paymentDate: null,
    paymentStatus: "Pending"
  },
  {
    id: 2,
    month: "2026-10",
    basicSalary: 45000,
    overtimeHours: 18,
    overtimePay: 6750,
    allowances: 5000,
    bonuses: 1500,
    epfEmployee: 3600,
    otherDeductions: 500,
    paymentDate: "2026-10-31",
    paymentStatus: "Paid"
  },
  {
    id: 3,
    month: "2026-09",
    basicSalary: 45000,
    overtimeHours: 10,
    overtimePay: 3750,
    allowances: 5000,
    bonuses: 1000,
    epfEmployee: 3600,
    otherDeductions: 500,
    paymentDate: "2026-09-30",
    paymentStatus: "Paid"
  },
  {
    id: 4,
    month: "2026-08",
    basicSalary: 45000,
    overtimeHours: 14,
    overtimePay: 5250,
    allowances: 5000,
    bonuses: 0,
    epfEmployee: 3600,
    otherDeductions: 500,
    paymentDate: "2026-08-31",
    paymentStatus: "Paid"
  }
];

function Salary() {

  // Salary records
  const [salaryData, setSalaryData] = useState(initialSalaryData);

  // Selected month
  const [selectedMonth, setSelectedMonth] = useState("2026-11");

  // Selected salary record
  const selectedSalary = salaryData.find(
    (record) => record.month === selectedMonth
  );

  // Salary totals
  const {
    grossSalary,
    totalDeductions,
    netSalary
  } = calculateSalary(selectedSalary);

  // Summary cards
  const summaryCards = [
    {
      title: "Basic Salary",
      value: selectedSalary?.basicSalary ?? 0,
      icon: Wallet,
      color: "green"
    },
    {
      title: "Overtime Pay",
      value: selectedSalary?.overtimePay ?? 0,
      icon: Clock3,
      color: "pink"
    },
    {
      title: "Total Deductions",
      value: totalDeductions,
      icon: TrendingDown,
      color: "orange"
    },
    {
      title: "Net Salary",
      value: netSalary,
      icon: Banknote,
      color: "blue"
    }
  ];

  // Salary history
  const salaryHistory = [...salaryData].sort(
    (a, b) => b.month.localeCompare(a.month)
  );

  return (
    <div className="employee-app-container">

      <SideBar />

      <main className="employee-main-content">

        <Header
          headername="My Salary"
          description="View your monthly salary and payment details."
        />

        <div className="salary-page-body">

          {/* MONTH FILTER */}

          <div className="salary-page-heading">

            <div className="salary-month-filter">

              <label htmlFor="salary-month">
                Select Month
              </label>

              <input
                id="salary-month"
                type="month"
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(e.target.value)
                }
              />

            </div>

          </div>

          {/* SUMMARY CARDS */}

          <div className="salary-summary-grid">

            {summaryCards.map((card) => {

              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className={`salary-summary-card ${card.color}`}
                >

                  <div className="salary-summary-icon">
                    <Icon size={22} />
                  </div>

                  <p>{card.title}</p>

                  <h2>
                    <span className="salary-currency">
                      Rs.
                    </span>
                    {formatCurrency(card.value)}
                  </h2>

                </div>
              );
            })}

          </div>

          {selectedSalary ? (
            <>

              {/* SALARY BREAKDOWN HEADING */}

              <div className="salary-details-heading">

                <div>
                  <h2>Salary Breakdown</h2>
                  <p>{formatMonth(selectedMonth)}</p>
                </div>

                <span
                  className={`salary-payment-status ${
                    selectedSalary.paymentStatus.toLowerCase()
                  }`}
                >
                  {selectedSalary.paymentStatus === "Paid" ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Clock size={15} />
                  )}

                  {selectedSalary.paymentStatus}
                </span>

              </div>

              {/* SALARY BREAKDOWN */}

              <div className="salary-breakdown-grid">

                {/* EARNINGS */}

                <section className="salary-detail-card">

                  <div className="salary-detail-card-header">

                    <div className="salary-detail-icon earnings">
                      <Wallet size={20} />
                    </div>

                    <h3>Earnings</h3>

                  </div>

                  <div className="salary-detail-row">
                    <span>Basic Salary</span>

                    <strong>
                      Rs. {formatCurrency(selectedSalary.basicSalary)}
                    </strong>
                  </div>

                  <div className="salary-detail-row">

                    <span>
                      Overtime Pay

                      <small>
                        ({selectedSalary.overtimeHours} hrs)
                      </small>
                    </span>

                    <strong>
                      Rs. {formatCurrency(selectedSalary.overtimePay)}
                    </strong>

                  </div>

                  <div className="salary-detail-row">
                    <span>Allowances</span>

                    <strong>
                      Rs. {formatCurrency(selectedSalary.allowances)}
                    </strong>
                  </div>

                  <div className="salary-detail-row">
                    <span>Bonuses</span>

                    <strong>
                      Rs. {formatCurrency(selectedSalary.bonuses)}
                    </strong>
                  </div>

                  <div className="salary-detail-total">

                    <span>Gross Salary</span>

                    <strong>
                      Rs. {formatCurrency(grossSalary)}
                    </strong>

                  </div>

                </section>

                {/* DEDUCTIONS */}

                <section className="salary-detail-card">

                  <div className="salary-detail-card-header">

                    <div className="salary-detail-icon deductions">
                      <TrendingDown size={20} />
                    </div>

                    <h3>Deductions</h3>

                  </div>

                  <div className="salary-detail-row">

                    <span>Employee EPF</span>

                    <strong>
                      Rs. {formatCurrency(selectedSalary.epfEmployee)}
                    </strong>

                  </div>

                  <div className="salary-detail-row">

                    <span>Other Deductions</span>

                    <strong>
                      Rs. {formatCurrency(selectedSalary.otherDeductions)}
                    </strong>

                  </div>

                  <div className="salary-detail-total">

                    <span>Total Deductions</span>

                    <strong>
                      Rs. {formatCurrency(totalDeductions)}
                    </strong>

                  </div>

                  <div className="salary-net-box">

                    <span>Net Salary</span>

                    <strong>
                      Rs. {formatCurrency(netSalary)}
                    </strong>

                  </div>

                </section>

              </div>

            </>
          ) : (

            <div className="salary-empty-state">

              <CalendarDays size={30} />

              <h3>No Salary Record Found</h3>

              <p>
                No salary details are available for{" "}
                {formatMonth(selectedMonth)}.
              </p>

            </div>

          )}

          {/* SALARY HISTORY */}

          <section className="salary-history-section">

            <div className="salary-history-heading">

              <div>
                <h2>Monthly Salary History</h2>
                <p>
                  Previous salary records and payment status
                </p>
              </div>

              <span className="salary-history-count">
                {salaryHistory.length} Records
              </span>

            </div>

            <div className="salary-table-wrapper">

              <table className="salary-table">

                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Basic Salary</th>
                    <th>Overtime Pay</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>

                  {salaryHistory.map((record) => {

                    const totals = calculateSalary(record);

                    return (
                      <tr key={record.id}>

                        <td>
                          {formatMonth(record.month)}
                        </td>

                        <td>
                          Rs. {formatCurrency(record.basicSalary)}
                        </td>

                        <td>
                          Rs. {formatCurrency(record.overtimePay)}
                        </td>

                        <td>
                          Rs. {formatCurrency(totals.totalDeductions)}
                        </td>

                        <td className="salary-table-net">
                          Rs. {formatCurrency(totals.netSalary)}
                        </td>

                        <td>

                          <span
                            className={`salary-payment-status ${
                              record.paymentStatus.toLowerCase()
                            }`}
                          >
                            {record.paymentStatus}
                          </span>

                        </td>

                      </tr>
                    );
                  })}

                  {salaryHistory.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="salary-empty-row"
                      >
                        No salary records available.
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

export default Salary;
