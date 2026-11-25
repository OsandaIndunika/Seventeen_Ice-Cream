import React from 'react'
import './Employees.css'
import SideBar from '../Components/SideBar/SideBar'
import Header from '../Components/Header/Header'
import { useState } from 'react'
import { Fingerprint, UserRoundPlus, Users, ScanLine, Clock3, UserRoundX, UserCheck } from "lucide-react";

function Employees() {

  const [activeSection, setActiveSection] = useState("details");
  const [search, setSearch] = useState("");

  const [scanType, setScanType] = useState("All");

  const [selectedDate, setSelectedDate] = useState("");
  const [registeredEmployees, setRegisteredEmployees] = useState([]);

  const [employeeSearch, setEmployeeSearch] = useState("");

  const [editingEmployeeId, setEditingEmployeeId] = useState(null);

  const [nextEmployeeNumber, setNextEmployeeNumber] = useState(87);








  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    employeeId: "EMP-0087",
    nic: "",
    dateOfBirth: "",
    phone: "",
    email: "",
    position: "",
    address: "",
    joinDate: "",
    emergencyContactName: "",
    emergencyContact: ""
  });



  const employees = [
    {
      id: 1,
      name: "Nimal Perera",
      empId: "EMP-0012",
      department: "Production",
      date: "2026-10-14",
      time: "07:52 AM",
      type: "Entry",
      scanner: "Gate 1",
      status: "On time"
    },
    {
      id: 2,
      name: "Kamal Silva",
      empId: "EMP-0031",
      department: "Packaging",
      date: "2026-10-14",
      time: "08:03 AM",
      type: "Entry",
      scanner: "Gate 1",
      status: "On time"
    },
    {
      id: 3,
      name: "Sunil Fernando",
      empId: "EMP-0045",
      department: "Cold Storage",
      date: "2026-10-14",
      time: "08:21 AM",
      type: "Entry",
      scanner: "Gate 2",
      status: "Late"
    },
    {
      id: 4,
      name: "Ayesha Rahman",
      empId: "EMP-0008",
      department: "Quality Lab",
      date: "2026-10-14",
      time: "08:30 AM",
      type: "Entry",
      scanner: "Gate 1",
      status: "Late"
    },

    {
      id: 5,
      name: "Nimal Perera",
      empId: "EMP-0012",
      department: "Production",
      date: "2026-10-14",
      time: "04:30 PM",
      type: "Exit",
      scanner: "Gate 1",
      status: "On time"
    }

  ];
  const lateArrivals = employees.filter(
    (employee) => employee.status === "Late"
  ).length;

  const scansToday = employees.length;

  const latestScans = {};

  employees.forEach((employee) => {
    latestScans[employee.empId] = employee;
  });

  const insideFactory = Object.values(latestScans).filter(
    (employee) => employee.type === "Entry"
  ).length;



  const totalShiftEmployees = 30;

  const arrivedEmployees = new Set(
    employees
      .filter((employee) => employee.type === "Entry")
      .map((employee) => employee.empId)
  ).size;

  const notYetArrived = Math.max(0, totalShiftEmployees - arrivedEmployees);


  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(search.toLowerCase()) ||
      employee.empId.toLowerCase().includes(search.toLowerCase());
    const matchesType =
      scanType === "All" || employee.type === scanType;

    const matchesDate =
      selectedDate === "" || employee.date === selectedDate;

    return matchesSearch && matchesType && matchesDate;
  }
  ).sort((a, b) => b.id - a.id);


  const handleEmployeeChange = (e) => {
    const { name, value } = e.target;

    setEmployeeForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };


  const validateEmployeeForm = () => {
    if (
      !employeeForm.fullName.trim() ||
      !employeeForm.nic.trim() ||
      !employeeForm.phone.trim() ||
      !employeeForm.position.trim() ||
      !employeeForm.address.trim() ||
      !employeeForm.emergencyContactName.trim() ||
      !employeeForm.emergencyContact.trim() ||
      !employeeForm.joinDate
    ) {
      alert("Please fill in all required fields.");
      return false;
    }
    // NIC format validation
    const nicPattern = /^(\d{9}[VvXx]|\d{12})$/;

    if (!nicPattern.test(employeeForm.nic.trim())) {
      alert("Please enter a valid Sri Lankan NIC number.");
      return false;
    }

    // Sri Lankan mobile number validation
    const phonePattern = /^(?:0|94|\+94)7\d{8}$/;

    const phone = employeeForm.phone.trim().replace(/[\s-]/g, "");

    if (!phonePattern.test(phone)) {
      alert("Please enter a valid Sri Lankan mobile number.");
      return false;
    }


    const emergencyPhone = employeeForm.emergencyContact.trim().replace(/[\s-]/g, "");
    if (!phonePattern.test(emergencyPhone)) {
      alert("Please enter a valid emergency contact number.");
      return false;
    }

    // Email format validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const email = employeeForm.email.trim();

    if (email && !emailPattern.test(email)) {
      alert("Please enter a valid email address.");
      return false;
    }


    // Check duplicate NIC
    const duplicateNIC = registeredEmployees.some((employee) => {
      return (
        employee.nic.trim().toUpperCase() ===
        employeeForm.nic.trim().toUpperCase() &&
        employee.id !== editingEmployeeId
      );
    });

    if (duplicateNIC) {
      alert("An employee with this NIC already exists.");
      return false;
    }


    // Date validation
    const today = new Date().toLocaleDateString("en-CA");

    // Check Date of Birth
    if (
      employeeForm.dateOfBirth &&
      employeeForm.dateOfBirth > today
    ) {
      alert("Date of Birth cannot be in the future.");
      return false;
    }

    // Check Join Date
    if (employeeForm.joinDate > today) {
      alert("Join Date cannot be in the future.");
      return false;
    }

    // Compare Date of Birth and Join Date
    if (
      employeeForm.dateOfBirth &&
      employeeForm.joinDate < employeeForm.dateOfBirth
    ) {
      alert("Join Date cannot be before Date of Birth.");
      return false;
    }




    return true;
  };


  const handleDeleteEmployee = (employeeId) => {

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this employee?"
    );

    if (!confirmDelete) {
      return;
    }

    setRegisteredEmployees((prev) =>
      prev.filter((employee) => employee.id !== employeeId)
    );

    alert("Employee deleted successfully!");
  };





  const handleSaveEmployee = () => {

    if (!validateEmployeeForm()) {
      return;
    }

    if (editingEmployeeId !== null) {

      // Update existing employee
      setRegisteredEmployees((prev) =>
        prev.map((employee) =>
          employee.id === editingEmployeeId
            ? { ...employee, ...employeeForm }
            : employee
        )
      );

      alert("Employee updated successfully!");

    } else {

      // Add new employee
      const newEmployee = {
        ...employeeForm,
        employeeId: `EMP-${String(nextEmployeeNumber).padStart(4, "0")}`,
        id: crypto.randomUUID()
      };

      setRegisteredEmployees((prev) => [
        ...prev,
        newEmployee
      ]);

      setNextEmployeeNumber((prev) => prev + 1);

      alert("Employee added successfully!");
    }

    resetEmployeeForm();
    setActiveSection("employeeList");
  };





  const filteredRegisteredEmployees = registeredEmployees.filter((employee) => {

    const searchText = employeeSearch.toLowerCase();

    const matchesSearch =
      employee.employeeId.toLowerCase().includes(searchText) ||
      employee.fullName.toLowerCase().includes(searchText) ||
      employee.position.toLowerCase().includes(searchText);

    return matchesSearch;

  });


  const handleEditEmployee = (employee) => {

    setEmployeeForm({
      fullName: employee.fullName,
      employeeId: employee.employeeId,
      nic: employee.nic,
      dateOfBirth: employee.dateOfBirth,
      phone: employee.phone,
      email: employee.email,
      position: employee.position,
      address: employee.address || "",
      joinDate: employee.joinDate,
      emergencyContactName: employee.emergencyContactName || "",
      emergencyContact: employee.emergencyContact || ""
    });

    setEditingEmployeeId(employee.id);

    setActiveSection("add");
  };

  const resetEmployeeForm = () => {

    setEmployeeForm({
      fullName: "",
      employeeId: "",
      nic: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      position: "",
      address: "",
      joinDate: "",
      emergencyContactName: "",
      emergencyContact: ""
    });

    setEditingEmployeeId(null);
  };


  return (
    <div className="employees-page">
      {/* SideBar*/}
      <SideBar />

      <main className='main-content'>
        {/* Header */}
        <Header headername="Employees" description="Manage employee information" />
        <div className='employee-dashboard'>


          <div className="employee-page-buttons">

            <button
              type="button"
              className={
                activeSection === "details"
                  ? "employee-tab active"
                  : "employee-tab"
              }
              onClick={() => setActiveSection("details")}
            >
              <Fingerprint size={20} />
              <span>Attendance Details</span>
            </button>

            <button
              type="button"
              className={
                activeSection === "add"
                  ? "employee-tab active"
                  : "employee-tab"
              }
              onClick={() => {
                resetEmployeeForm();
                setActiveSection("add");
              }}
            >
              <UserRoundPlus size={20} />
              <span>Add Employee</span>
            </button>

            <button
              type="button"
              className={
                activeSection === "employeeList"
                  ? "employee-tab active"
                  : "employee-tab"
              }
              onClick={() => setActiveSection("employeeList")}
            >
              <Users size={20} />
              <span>Employee Details</span>
            </button>

          </div>


          {activeSection === "details" && (
            <>


              <section className='scanner-summary-container' aria-label='Price overview'>

                <div className='scanner-summary-card'>
                  <div className="scanner-summary-icon"><UserCheck size={24} strokeWidth={2.2} /></div>
                  <span className='scanner-summary-label'>Inside Factory now</span>
                  <strong className='scanner-summary-value'>{insideFactory}</strong>
                  <span className='summary-description'>of 30 on today's shift</span>
                </div>


                <div className='scanner-summary-card'>
                  <div className="scanner-summary-icon"><ScanLine size={24} strokeWidth={2.2} /></div>
                  <span className='scanner-summary-label'>Scans today</span>
                  <strong className='scanner-summary-value'> {scansToday}</strong>
                  <span className='summary-description'>Entries and Exits</span>
                </div>

                <div className='scanner-summary-card'>
                  <div className="scanner-summary-icon"><Clock3 size={24} strokeWidth={2.2} /></div>
                  <span className='scanner-summary-label'>Later arivals</span>
                  <strong className='scanner-summary-value'>{lateArrivals}</strong>
                  <span className='summary-description'>after 8.15 AM</span>
                </div>

                <div className='scanner-summary-card'>
                  <div className="scanner-summary-icon"><UserRoundX size={24} strokeWidth={2.2} /></div>
                  <span className='scanner-summary-label'>Not yet Arived</span>
                  <strong className='scanner-summary-value  '>{notYetArrived}</strong>
                  <span className='summary-description'>Check absence</span>
                </div>
              </section>
              <div className='scanner-log'>
                {/* Fingerprint Scan log */}
                <section className='fingerprint-log' aria-label='Fingerprint scan log'>
                  <div className='section-heading'>
                    <div>
                      <h2>Fingerprint Scan Log</h2>
                      <p>Review current fingerprint scans and pending updates.</p>
                    </div>
                  </div>

                  <div className='search-container'>

                    <input
                      type="date"
                      className="date-filter"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />

                    <select
                      className="scan-filter"
                      value={scanType}
                      onChange={(e) => setScanType(e.target.value)}
                    >
                      <option value="All">All Scans</option>
                      <option value="Entry">Entry</option>
                      <option value="Exit">Exit</option>
                    </select>

                    <input type="text" placeholder="Search by employee name or ID" className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <button className="search-btn">
                      Search
                    </button>
                  </div>

                  <div className='scan-table-wrap'>
                    <table className='scan-table'>
                      <thead>
                        <tr>
                          <th scope="col">Employee</th>
                          <th scope="col">ID</th>
                          <th scope="col">Department</th>
                          <th scope="col">Date</th>
                          <th scope="col">Time</th>
                          <th scope="col">Type</th>
                          <th scope="col">Scanner</th>
                          <th scope="col">Status</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmployees.map((employee) => (
                          <tr key={employee.id}>
                            <td>{employee.name}</td>
                            <td>{employee.empId}</td>
                            <td>{employee.department}</td>
                            <td>{employee.date}</td>
                            <td>{employee.time}</td>
                            <td> <span className={employee.type === "Entry" ? "entry-badge" : "exit-badge"}>
                              {employee.type}</span></td>
                            <td>{employee.scanner}</td>
                            <td><span className={employee.status === "On time" ? "ontime-badge" : "late-badge"}>
                              {employee.status}
                            </span></td>
                            <td>Exit</td>
                          </tr>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <tr>
                            <td colSpan={9} className="empty-state">
                              No matching employees found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="scanner-status">
                  <h2>Scanner Status</h2>

                  <div className="scanner-item">
                    <span className="scanner-dot"></span>

                    <div className="scanner-details">
                      <h4>Front Door Scanner</h4>
                      <p>Online · synced 2 min ago</p>
                    </div>
                  </div>


                  <div className="scanner-item">
                    <span className="scanner-dot"></span>

                    <div className="scanner-details">
                      <h4>Back Door Scanner</h4>
                      <p>Online · synced 3 min ago</p>
                    </div>
                  </div>


                  <div className="enrolled-employees">
                    <span>Employees Enrolled</span>
                    <strong>86</strong>
                  </div>
                </section>
              </div>
            </>
          )}


          {activeSection === "add" && (
            <div className="add-employee-page">

              <div className="add-employee-layout">

                {/* Employee Details */}

                <section className="employee-details-panel">

                  <div className="employee-panel-heading">
                    <h2>Employee Details</h2>
                    <span className="employee-id-badge">
                      {editingEmployeeId !== null
                        ? employeeForm.employeeId
                        : `EMP-${String(nextEmployeeNumber).padStart(4, "0")}`}
                    </span>
                  </div>

                  <div className="employee-details-form">

                    <div className="employee-field">
                      <label>Full Name</label>
                      <input
                        type="text"
                        name="fullName"
                        placeholder="Enter full name"
                        value={employeeForm.fullName}
                        onChange={handleEmployeeChange}
                      />                    </div>

                    <div className="employee-field">
                      <label>Employee ID</label>
                      <input
                        type="text"
                        name="employeeId"
                        value={
                          editingEmployeeId !== null
                            ? employeeForm.employeeId
                            : `EMP-${String(nextEmployeeNumber).padStart(4, "0")}`
                        }
                        readOnly
                      />
                    </div>

                    <div className="employee-field">
                      <label>NIC / ID Number</label>

                      <input
                        type="text"
                        name="nic"
                        placeholder="e.g. 199012345678"
                        value={employeeForm.nic}
                        onChange={handleEmployeeChange}
                      />
                    </div>

                    <div className="employee-field">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={employeeForm.dateOfBirth}
                        onChange={handleEmployeeChange}
                      />                    </div>

                    <div className="employee-field">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="+94 7X XXX XXXX"
                        value={employeeForm.phone}
                        onChange={handleEmployeeChange}
                      />                    </div>

                    <div className="employee-field">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="name@example.com"
                        value={employeeForm.email}
                        onChange={handleEmployeeChange}
                      />                    </div>

                    <div className="employee-field full-width">
                      <label>Position</label>
                      <input
                        type="text"
                        name="position"
                        placeholder="e.g. Machine Operator"
                        value={employeeForm.position}
                        onChange={handleEmployeeChange}
                      />                    </div>

                    <div className="employee-field">
                      <label>Address</label>
                      <input
                        type="text"
                        name="address"
                        placeholder="Street, City"
                        value={employeeForm.address}
                        onChange={handleEmployeeChange}
                      />
                    </div>

                    <div className="employee-field">
                      <label>Join Date</label>
                      <input
                        type="date"
                        name="joinDate"
                        value={employeeForm.joinDate}
                        onChange={handleEmployeeChange}
                      />                    </div>

                    <div className="employee-field">
                      <label>Emergency Contact Name</label>
                      <input
                        type="text"
                        name="emergencyContactName"
                        placeholder="Contact person's full name"
                        value={employeeForm.emergencyContactName}
                        onChange={handleEmployeeChange}
                      />
                    </div>

                    <div className="employee-field">
                      <label>Emergency Contact Number</label>
                      <input
                        type="text"
                        name="emergencyContact"
                        placeholder="e.g. 0771234567"
                        value={employeeForm.emergencyContact}
                        onChange={handleEmployeeChange}
                      />
                    </div>

                  </div>
                </section>


                {/* Fingerprint Enrollment */}

                <section className="fingerprint-panel">

                  <h2>Fingerprint Enrollment</h2>

                  <div className="fingerprint-field">
                    <label>Finger to Enroll</label>

                    <select defaultValue="Right Index">
                      <option value="Right Index">Right index finger</option>
                      <option value="Right Thumb">Right thumb</option>
                      <option value="Left Index">Left index finger</option>
                      <option value="Left Thumb">Left thumb</option>
                    </select>
                  </div>

                  <div className="fingerprint-scanner">

                    <div className="fingerprint-animation">
                      <div className="fingerprint-ring ring-1">
                        <div className="fingerprint-ring ring-2">
                          <div className="fingerprint-ring ring-3">
                            <div className="fingerprint-ring ring-4">
                              <div className="fingerprint-ring ring-5"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="scanner-instruction">
                      Place finger on the scanner
                    </p>

                    <span className="scan-progress-text">
                      Scan 2 of 3 captured
                    </span>

                    <div className="scan-progress-dots">
                      <span className="completed"></span>
                      <span className="completed"></span>
                      <span></span>
                    </div>

                  </div>

                  <button type="button" className="next-scan-btn">
                    Start Next Scan
                  </button>

                  <p className="fingerprint-note">
                    Only an encrypted fingerprint template is stored,
                    never the image. The employee must give consent.
                  </p>

                </section>


              </div>

              {/* Action Buttons */}
              <div className="add-employee-actions">
                <button
                  type="button"
                  className="cancel-employee-btn"
                  onClick={() => {
                    resetEmployeeForm();
                    setActiveSection("employeeList");
                  }}
                >
                  Cancel
                </button>


                <button
                  type="button"
                  className="save-employee-btn"
                  onClick={handleSaveEmployee}
                >
                  {editingEmployeeId !== null
                    ? "Update Employee"
                    : "Save Employee"}
                </button>

              </div>

            </div>
          )}


          {activeSection === "employeeList" && (

            <div className="employee-list-page">

              <div className="employee-list-header">
                <h2>Registered Employees</h2>

                <span className="employee-count">
                  Total Employees: {registeredEmployees.length}
                </span>
              </div>


              <div className="employee-search-container">

                <input
                  type="text"
                  placeholder="Search by Employee ID, Name or Position..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                />


              </div>

              <div className="employee-table-container">

                <table className="employee-list-table">

                  <thead>
                    <tr>
                      <th>Employee ID</th>
                      <th>Full Name</th>
                      <th>NIC</th>
                      <th>Phone Number</th>
                      <th>Position</th>
                      <th>Address</th>
                      <th>Join Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>

                    {filteredRegisteredEmployees.length === 0 ? (

                      <tr>
                        <td colSpan="8" className="empty-employee-list">
                          No employees registered yet.
                        </td>
                      </tr>

                    ) : (

                      filteredRegisteredEmployees.map((employee) => (

                        <tr key={employee.id}>

                          <td>{employee.employeeId}</td>
                          <td>{employee.fullName}</td>
                          <td>{employee.nic}</td>
                          <td>{employee.phone}</td>
                          <td>{employee.position}</td>
                          <td>{employee.address}</td>
                          <td>{employee.joinDate}</td>

                          <td>
                            <div className="employee-actions">
                              <button
                                type="button"
                                className="employee-edit-btn"
                                onClick={() => handleEditEmployee(employee)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="employee-delete-btn"
                                onClick={() => handleDeleteEmployee(employee.id)}
                              >
                                Delete
                              </button>

                            </div>
                          </td>

                        </tr>

                      ))

                    )}

                  </tbody>

                </table>

              </div>

            </div>

          )}


        </div>
      </main>
    </div>
  )
}

export default Employees