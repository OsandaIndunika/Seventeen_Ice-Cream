
import React from "react";
import { NavLink } from "react-router-dom";
import "./SideBar.css";

function SidebarElements({ name, path, children }) {
  return (
    <NavLink
      to={path}
      end={path === "/"}
      className={({ isActive }) =>
        isActive
          ? "employee-sidebar-button active"
          : "employee-sidebar-button"
      }
    >
      {children}
      <span>{name}</span>
    </NavLink>
  );
}

export default SidebarElements;
