import React, { useState, useEffect } from "react";
import "./Header.css";
import { UserRound, Clock3 } from "lucide-react";

function EmployeeHeader({
  headername = "Employee Dashboard",
  description = "Your workday at a glance",
  employeeName = "Employee",
  profileImage = null
}) {

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="employee-app-header">

      {/* LEFT - PAGE TITLE */}
      <div className="employee-header-left">

        <p className="employee-header-title">
          {headername}
        </p>

        <p className="employee-header-description">
          {description}
        </p>

      </div>

      {/* CENTER - LIVE CLOCK */}
      <div className="employee-header-center">

        <Clock3 size={16} />

        <p>
          {currentTime.toLocaleTimeString("en-LK", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
          })}
        </p>

      </div>

      {/* RIGHT - EMPLOYEE PROFILE */}
      <div className="employee-header-right">

        <div className="employee-header-user-info">

          <h4>{employeeName}</h4>

          <span>Employee</span>

        </div>

        {profileImage ? (
          <img
            src={profileImage}
            alt="Employee Profile"
            className="employee-profile-image"
          />
        ) : (
          <div className="employee-profile-placeholder">
            <UserRound size={22} />
          </div>
        )}

      </div>

    </header>
  );
}

export default EmployeeHeader;
