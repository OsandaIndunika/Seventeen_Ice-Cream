
import React, { useState } from "react";
import "./Profile.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  UserRound,
  BriefcaseBusiness,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  BadgeCheck,
  Pencil,
  Save,
  X
} from "lucide-react";

// Demo employee information
const initialEmployee = {
  employeeId: "EMP-0012",
  fullName: "Nimal Perera",
  email: "nimal.perera@example.com",
  phone: "0771234567",
  address: "Matara, Sri Lanka",
  nic: "200012345678",
  dateOfBirth: "2000-05-15",
  gender: "Male",
  position: "Production Assistant",
  department: "Production",
  joiningDate: "2024-03-12",
  employmentStatus: "Active"
};

// Format date
function formatDate(dateString) {
  if (!dateString) return "—";

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function Profile() {

  // Employee details
  const [employee, setEmployee] = useState(
    initialEmployee
  );

  // Editable contact details
  const [editForm, setEditForm] = useState({
    email: initialEmployee.email,
    phone: initialEmployee.phone,
    address: initialEmployee.address
  });

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);

  // Feedback message
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Open edit form
  const handleEdit = () => {
    setEditForm({
      email: employee.email,
      phone: employee.phone,
      address: employee.address
    });

    setMessage("");
    setMessageType("");
    setIsEditing(true);
  };

  // Cancel editing
  const handleCancel = () => {
    setEditForm({
      email: employee.email,
      phone: employee.phone,
      address: employee.address
    });

    setMessage("");
    setMessageType("");
    setIsEditing(false);
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value
    }));

    setMessage("");
    setMessageType("");
  };

  // Save contact information
  const handleSave = (e) => {
    e.preventDefault();

    const email = editForm.email.trim();
    const phone = editForm.phone.trim();
    const address = editForm.address.trim();

    // Validate email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setMessage("Please enter a valid email address.");
      setMessageType("error");
      return;
    }

    // Validate Sri Lankan phone number
    if (!/^0\d{9}$/.test(phone)) {
      setMessage(
        "Please enter a valid 10-digit phone number."
      );
      setMessageType("error");
      return;
    }

    // Validate address
    if (!address) {
      setMessage("Home address cannot be empty.");
      setMessageType("error");
      return;
    }

    // Update employee details
    setEmployee((previous) => ({
      ...previous,
      email,
      phone,
      address
    }));

    setIsEditing(false);
    setMessage("Contact information updated successfully.");
    setMessageType("success");
  };

  // Personal information
  const personalDetails = [
    {
      label: "Full Name",
      value: employee.fullName,
      icon: UserRound
    },
    {
      label: "Employee ID",
      value: employee.employeeId,
      icon: BadgeCheck
    },
    {
      label: "NIC Number",
      value: employee.nic,
      icon: BadgeCheck
    },
    {
      label: "Date of Birth",
      value: formatDate(employee.dateOfBirth),
      icon: CalendarDays
    },
    {
      label: "Gender",
      value: employee.gender,
      icon: UserRound
    }
  ];

  // Employment information
  const employmentDetails = [
    {
      label: "Position",
      value: employee.position
    },
    {
      label: "Department",
      value: employee.department
    },
    {
      label: "Joining Date",
      value: formatDate(employee.joiningDate)
    },
    {
      label: "Employment Status",
      value: employee.employmentStatus
    }
  ];

  return (
    <div className="employee-app-container">

      <SideBar />

      <main className="employee-main-content">

        <Header
          headername="My Profile"
          description="View and manage your personal information."
        />

        <div className="profile-page-body">

          {/* PROFILE OVERVIEW */}

          <section className="profile-overview-card">

            <div className="profile-avatar">
              <UserRound size={38} />
            </div>

            <div className="profile-overview-info">

              <h2>{employee.fullName}</h2>

              <p>{employee.position}</p>

              <div className="profile-overview-meta">

                <span>{employee.employeeId}</span>

                <span className="profile-active-badge">
                  <BadgeCheck size={14} />
                  {employee.employmentStatus}
                </span>

              </div>

            </div>

          </section>

          {/* PERSONAL INFORMATION */}

          <section className="profile-section">

            <div className="profile-section-heading">

              <div className="profile-section-title">
                <UserRound size={20} />
                <h2>Personal Information</h2>
              </div>

              <span className="profile-readonly-badge">
                Read Only
              </span>

            </div>

            <div className="profile-details-grid">

              {personalDetails.map((detail) => {

                const Icon = detail.icon;

                return (
                  <div
                    className="profile-detail-item"
                    key={detail.label}
                  >

                    <div className="profile-detail-icon">
                      <Icon size={18} />
                    </div>

                    <div>
                      <p>{detail.label}</p>
                      <h3>{detail.value}</h3>
                    </div>

                  </div>
                );
              })}

            </div>

          </section>

          {/* CONTACT INFORMATION */}

          <section className="profile-section">

            <div className="profile-section-heading">

              <div className="profile-section-title">
                <Phone size={20} />
                <h2>Contact Information</h2>
              </div>

              {!isEditing && (
                <button
                  type="button"
                  className="profile-edit-btn"
                  onClick={handleEdit}
                >
                  <Pencil size={16} />
                  Edit Details
                </button>
              )}

            </div>

            {/* EDIT MODE */}

            {isEditing ? (

              <form onSubmit={handleSave}>

                <div className="profile-edit-grid">

                  {/* EMAIL - EDITABLE */}

                  <div className="profile-input-group">

                    <label htmlFor="profile-email">
                      Email Address
                    </label>

                    <input
                      id="profile-email"
                      type="email"
                      name="email"
                      value={editForm.email}
                      onChange={handleChange}
                      placeholder="Enter your email address"
                      required
                    />

                  </div>

                  {/* PHONE - EDITABLE */}

                  <div className="profile-input-group">

                    <label htmlFor="profile-phone">
                      Phone Number
                    </label>

                    <input
                      id="profile-phone"
                      type="tel"
                      name="phone"
                      value={editForm.phone}
                      onChange={handleChange}
                      placeholder="0771234567"
                      maxLength={10}
                      required
                    />

                  </div>

                  {/* ADDRESS - EDITABLE */}

                  <div className="profile-input-group profile-address-field">

                    <label htmlFor="profile-address">
                      Home Address
                    </label>

                    <textarea
                      id="profile-address"
                      name="address"
                      value={editForm.address}
                      onChange={handleChange}
                      placeholder="Enter your home address"
                      rows={3}
                      required
                    />

                  </div>

                </div>

                {/* ERROR MESSAGE */}

                {message && messageType === "error" && (
                  <p className="profile-error-message">
                    {message}
                  </p>
                )}

                {/* FORM BUTTONS */}

                <div className="profile-form-actions">

                  <button
                    type="button"
                    className="profile-cancel-btn"
                    onClick={handleCancel}
                  >
                    <X size={16} />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="profile-save-btn"
                  >
                    <Save size={16} />
                    Save Changes
                  </button>

                </div>

              </form>

            ) : (

              /* VIEW MODE */

              <div className="profile-details-grid">

                {/* EMAIL */}

                <div className="profile-detail-item">

                  <div className="profile-detail-icon">
                    <Mail size={18} />
                  </div>

                  <div>
                    <p>Email Address</p>
                    <h3>{employee.email}</h3>
                  </div>

                </div>

                {/* PHONE */}

                <div className="profile-detail-item">

                  <div className="profile-detail-icon">
                    <Phone size={18} />
                  </div>

                  <div>
                    <p>Phone Number</p>
                    <h3>{employee.phone}</h3>
                  </div>

                </div>

                {/* ADDRESS */}

                <div className="profile-detail-item">

                  <div className="profile-detail-icon">
                    <MapPin size={18} />
                  </div>

                  <div>
                    <p>Home Address</p>
                    <h3>{employee.address}</h3>
                  </div>

                </div>

              </div>

            )}

            {/* SUCCESS MESSAGE */}

            {!isEditing &&
              message &&
              messageType === "success" && (

                <p className="profile-success-message">
                  {message}
                </p>

              )}

          </section>

          {/* EMPLOYMENT INFORMATION */}

          <section className="profile-section">

            <div className="profile-section-heading">

              <div className="profile-section-title">
                <BriefcaseBusiness size={20} />
                <h2>Employment Information</h2>
              </div>

              <span className="profile-readonly-badge">
                Read Only
              </span>

            </div>

            <div className="profile-details-grid">

              {employmentDetails.map((detail) => (

                <div
                  className="profile-detail-item"
                  key={detail.label}
                >

                  <div className="profile-detail-icon">
                    <BriefcaseBusiness size={18} />
                  </div>

                  <div>
                    <p>{detail.label}</p>
                    <h3>{detail.value}</h3>
                  </div>

                </div>

              ))}

            </div>

          </section>

    

        </div>

      </main>

    </div>
  );
}

export default Profile;
