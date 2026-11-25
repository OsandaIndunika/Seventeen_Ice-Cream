
import React, { useState } from "react";
import "./MealPreferences.css";

import SideBar from "../Components/Sidebar/Sidebar";
import Header from "../Components/Header/Header";

import {
  UtensilsCrossed,
  CalendarDays,
  Wallet,
  CheckCircle2,
  ClipboardList,
  Save,
  Info
} from "lucide-react";

// Demo allowance amount.
// Actual rate should come from the backend.
const MEAL_ALLOWANCE_PER_DAY = 200;

// Use local date instead of UTC.
function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  if (!dateString) return "—";

  const [year, month, day] = dateString.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-US",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Initial demo records
const initialMealPreferences = [
  {
    id: 1,
    date: "2026-11-18",
    preference: "No Meal"
  },
  {
    id: 2,
    date: "2026-11-19",
    preference: "Meal Required"
  },
  {
    id: 3,
    date: "2026-11-20",
    preference: "No Meal"
  },
  {
    id: 4,
    date: "2026-11-21",
    preference: "Meal Required"
  },
  {
    id: 5,
    date: "2026-11-22",
    preference: "No Meal"
  },
  {
    id: 6,
    date: "2026-10-15",
    preference: "No Meal"
  },
  {
    id: 7,
    date: "2026-10-16",
    preference: "Meal Required"
  }
];

function MealPreferences() {
  const today = getLocalDate();

  // Form states
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedPreference, setSelectedPreference] = useState("");

  // Saved meal preferences
  const [mealPreferences, setMealPreferences] = useState(
    initialMealPreferences
  );

  // Month filter
  const [selectedMonth, setSelectedMonth] = useState(
    today.slice(0, 7)
  );

  // Feedback message
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Existing preference for selected date
  const existingPreference = mealPreferences.find(
    (record) => record.date === selectedDate
  );

  // Update date and show existing selection
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setMessage("");
    setMessageType("");

    const existing = mealPreferences.find(
      (record) => record.date === date
    );

    setSelectedPreference(existing?.preference || "");
  };

  // Save preference
  const handleSavePreference = (e) => {
    e.preventDefault();

    if (!selectedDate || !selectedPreference) {
      setMessage("Please select a date and meal preference.");
      setMessageType("error");
      return;
    }

    if (selectedDate < today) {
      setMessage("Past dates cannot be edited.");
      setMessageType("error");
      return;
    }

    const existing = mealPreferences.find(
      (record) => record.date === selectedDate
    );

    if (existing) {
      setMealPreferences((previous) =>
        previous.map((record) =>
          record.date === selectedDate
            ? {
                ...record,
                preference: selectedPreference
              }
            : record
        )
      );

      setMessage("Meal preference updated successfully.");
    } else {
      const newPreference = {
        id: crypto.randomUUID(),
        date: selectedDate,
        preference: selectedPreference
      };

      setMealPreferences((previous) => [
        ...previous,
        newPreference
      ]);

      setMessage("Meal preference saved successfully.");
    }

    setMessageType("success");

    // Show the saved date's month in history.
    setSelectedMonth(selectedDate.slice(0, 7));
  };

  // Filter preferences by month
  const filteredPreferences = mealPreferences
    .filter((record) =>
      record.date.startsWith(selectedMonth)
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  // Count meal-required days
  const mealRequiredDays = filteredPreferences.filter(
    (record) => record.preference === "Meal Required"
  ).length;

  // Count no-meal days
  const noMealDays = filteredPreferences.filter(
    (record) => record.preference === "No Meal"
  ).length;

  // Estimated allowance based on saved selections
  const estimatedAllowance =
    noMealDays * MEAL_ALLOWANCE_PER_DAY;

  const summaryCards = [
    {
      title: "Preferences Recorded",
      value: filteredPreferences.length,
      description: "Recorded days this month",
      icon: CalendarDays,
      color: "green"
    },
    {
      title: "Meal Required Days",
      value: mealRequiredDays,
      description: "Factory meals requested",
      icon: UtensilsCrossed,
      color: "pink"
    },
    {
      title: "No Meal Days",
      value: noMealDays,
      description: "Factory meals not requested",
      icon: CheckCircle2,
      color: "blue"
    },
    {
      title: "Estimated Allowance",
      value: `Rs. ${formatCurrency(estimatedAllowance)}`,
      description: "Subject to attendance and approval",
      icon: Wallet,
      color: "orange"
    }
  ];

  return (
    <div className="employee-app-container">
      <SideBar />

      <main className="employee-main-content">
        <Header
          headername="Meal Preferences"
          description="Manage your daily factory meal preferences."
        />

        <div className="meal-page-body">

          {/* MONTH FILTER */}

          <div className="meal-page-heading">
            <div className="meal-month-filter">
              <label htmlFor="meal-month">
                Select Month
              </label>

              <input
                id="meal-month"
                type="month"
                value={selectedMonth}
                onChange={(e) =>
                  setSelectedMonth(e.target.value)
                }
              />
            </div>
          </div>

          {/* SUMMARY CARDS */}

          <div className="meal-summary-grid">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.title}
                  className={`meal-summary-card ${card.color}`}
                >
                  <div className="meal-summary-icon">
                    <Icon size={22} />
                  </div>

                  <p>{card.title}</p>

                  <h2>{card.value}</h2>

                  <span className="meal-card-description">
                    {card.description}
                  </span>
                </div>
              );
            })}
          </div>

          {/* PREFERENCE FORM */}

          <section className="meal-preference-section">
            <div className="meal-section-header">
              <div className="meal-section-title">
                <UtensilsCrossed size={20} />

                <div>
                  <h2>Daily Meal Preference</h2>
                  <p>
                    Select whether you need a factory meal
                    for the chosen date.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePreference}>

              <div className="meal-date-field">
                <label htmlFor="meal-date">
                  Select Date
                </label>

                <input
                  id="meal-date"
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) =>
                    handleDateChange(e.target.value)
                  }
                  required
                />
              </div>

              <div className="meal-choice-grid">

                {/* MEAL REQUIRED */}

                <label
                  className={`meal-choice-card ${
                    selectedPreference === "Meal Required"
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="mealPreference"
                    value="Meal Required"
                    checked={
                      selectedPreference === "Meal Required"
                    }
                    onChange={(e) => {
                      setSelectedPreference(e.target.value);
                      setMessage("");
                    }}
                  />

                  <div className="meal-choice-icon green">
                    <UtensilsCrossed size={24} />
                  </div>

                  <div className="meal-choice-content">
                    <h3>Yes, I Need a Meal</h3>

                    <p>
                      I would like to receive a
                      factory-provided meal.
                    </p>

                    <span className="meal-choice-tag green">
                      Factory Meal
                    </span>
                  </div>
                </label>

                {/* NO MEAL */}

                <label
                  className={`meal-choice-card ${
                    selectedPreference === "No Meal"
                      ? "selected"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="mealPreference"
                    value="No Meal"
                    checked={
                      selectedPreference === "No Meal"
                    }
                    onChange={(e) => {
                      setSelectedPreference(e.target.value);
                      setMessage("");
                    }}
                  />

                  <div className="meal-choice-icon pink">
                    <Wallet size={24} />
                  </div>

                  <div className="meal-choice-content">
                    <h3>No, I Don't Need a Meal</h3>

                    <p>
                      I do not need a factory meal
                      for this date.
                    </p>

                    <span className="meal-choice-tag pink">
                      Allowance Eligible
                    </span>
                  </div>
                </label>

              </div>

              {/* ALLOWANCE INFORMATION */}

              {selectedPreference === "No Meal" && (
                <div className="meal-allowance-info">
                  <Info size={19} />

                  <p>
                    Selecting No Meal may qualify you for
                    a meal allowance of{" "}
                    <strong>
                      Rs. {formatCurrency(MEAL_ALLOWANCE_PER_DAY)}
                    </strong>{" "}
                    for this date, subject to company
                    rules and attendance verification.
                  </p>
                </div>
              )}

              {/* EXISTING RECORD */}

              {existingPreference && (
                <div className="meal-existing-info">
                  Existing preference for this date:{" "}
                  <strong>
                    {existingPreference.preference}
                  </strong>
                </div>
              )}

              {/* FEEDBACK MESSAGE */}

              {message && (
                <p className={`meal-message ${messageType}`}>
                  {message}
                </p>
              )}

              <div className="meal-form-actions">
                <button
                  type="submit"
                  className="meal-save-btn"
                >
                  <Save size={17} />
                  {existingPreference
                    ? "Update Preference"
                    : "Save Preference"}
                </button>
              </div>

            </form>
          </section>

          {/* PREFERENCE HISTORY */}

          <section className="meal-history-section">

            <div className="meal-history-heading">
              <div className="meal-history-title">
                <ClipboardList size={20} />

                <div>
                  <h2>Meal Preference History</h2>

                  <p>
                    View your previously recorded
                    daily meal preferences.
                  </p>
                </div>
              </div>

              <span className="meal-history-count">
                {filteredPreferences.length} Records
              </span>
            </div>

            <div className="meal-table-wrapper">
              <table className="meal-table">

                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Meal Preference</th>
                    <th>Estimated Allowance</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPreferences.length > 0 ? (
                    filteredPreferences.map((record) => (
                      <tr key={record.id}>
                        <td>
                          {formatDate(record.date)}
                        </td>

                        <td>
                          <span
                            className={`meal-status ${
                              record.preference === "No Meal"
                                ? "no-meal"
                                : "required"
                            }`}
                          >
                            {record.preference}
                          </span>
                        </td>

                        <td>
                          {record.preference === "No Meal"
                            ? `Rs. ${formatCurrency(
                                MEAL_ALLOWANCE_PER_DAY
                              )}`
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="3"
                        className="meal-empty-row"
                      >
                        No meal preferences found for
                        the selected month.
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

export default MealPreferences;
