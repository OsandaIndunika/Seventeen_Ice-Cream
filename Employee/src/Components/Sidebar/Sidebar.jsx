
import React from "react";
import "./SideBar.css";

import {
  House,
  CalendarCheck,
  Wallet,
  CalendarDays,
  Clock3,
  Utensils,
  UserRound,
  DoorOpen
} from "lucide-react";

import SidebarElements from "./SidebarElements";
import logo from "../../assets/logo.PNG";

function SideBar() {
  return (
    <aside className="employee-sidebar">

      {/* LOGO SECTION */}
      <div className="employee-logo-section">

        <img
          src={logo}
          alt="Sathutusina Ice Cream"
          className="employee-sidebar-logo"
        />

        <div className="employee-logo-text">
          <span className="employee-logo-name">
            Sathutusina
          </span>

          <span className="employee-logo-subtitle">
            Employee Portal
          </span>
        </div>

      </div>

      {/* NAVIGATION */}
      <nav className="employee-sidebar-nav">

        <SidebarElements name="My Profile" path="/">
          <UserRound size={17} />
        </SidebarElements>

        <SidebarElements
          name="My Attendance"
          path="/attendance"
        >
          <CalendarCheck size={17} />
        </SidebarElements>

        <SidebarElements
          name="My Salary"
          path="/salary"
        >
          <Wallet size={17} />
        </SidebarElements>

        <SidebarElements
          name="My Leave"
          path="/leave"
        >
          <CalendarDays size={17} />
        </SidebarElements>

        <SidebarElements
          name="My Overtime"
          path="/overtime"
        >
          <Clock3 size={17} />
        </SidebarElements>

        <SidebarElements
          name="Meal Preferences"
          path="/meal-preferences"
        >
          <Utensils size={17} />
        </SidebarElements>

      </nav>

      {/* LOGOUT */}
      <button
        type="button"
        className="employee-logout-button"
      >
        <DoorOpen size={17} />
        <span>Logout</span>
      </button>

    </aside>
  );
}

export default SideBar;
