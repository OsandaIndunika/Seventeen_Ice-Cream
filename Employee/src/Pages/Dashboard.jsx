
import React from "react";
import "./Dashboard.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  Clock3,
  Timer,
  Wallet,
  CalendarDays
} from "lucide-react";

function Dashboard() {

  // Temporary employee data
  const summaryData = [
    {
      id: 1,
      title: "Working Hours",
      value: "168",
      unit: "hrs",
      description: "This Month",
      icon: Clock3,
      color: "green"
    },
    {
      id: 2,
      title: "Overtime Hours",
      value: "12",
      unit: "hrs",
      description: "This Month",
      icon: Timer,
      color: "pink"
    },
    {
      id: 3,
      title: "Net Salary",
      value: "58,500",
      unit: "LKR",
      description: "Latest Payroll",
      icon: Wallet,
      color: "blue"
    },
    {
      id: 4,
      title: "Leave Balance",
      value: "08",
      unit: "days",
      description: "Remaining Leave",
      icon: CalendarDays,
      color: "orange"
    }
  ];

  return (
    <div className="employee-app-container">

      {/* SIDEBAR */}
      <SideBar />

      {/* MAIN CONTENT */}
      <main className="employee-main-content">

        {/* HEADER */}
        <Header
          headername="Employee Dashboard"
          description="View your working hours, salary, leave and meal preferences."
        />

        {/* DASHBOARD BODY */}
        <div className="employee-dashboard-body">     

          {/* SUMMARY SECTION */}
          <section className="employee-summary-section">

            {/* SUMMARY CARDS */}
            <div className="employee-summary-grid">

              {summaryData.map((item) => {

                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    className={`employee-summary-card ${item.color}`}
                  >

                    {/* CARD TOP */}
                    <div className="employee-summary-card-top">

                      <div className="employee-summary-icon">
                        <Icon size={22} strokeWidth={2} />
                      </div>

                      <span className="employee-summary-period">
                        {item.description}
                      </span>

                    </div>

                    {/* CARD CONTENT */}
                    <div className="employee-summary-card-content">

                      <p className="employee-summary-title">
                        {item.title}
                      </p>

                      <div className="employee-summary-value-row">

                        <h3>{item.value}</h3>

                        <span>{item.unit}</span>

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>

          </section>

        </div>

      </main>

    </div>
  );
}

export default Dashboard;
