
import React, {
    useCallback,
    useEffect,
    useState,
  } from "react";
  
  import {
    Store,
    UserRound,
    Mail,
    Phone,
    MapPin,
    FileText,
    Save,
    Pencil,
    X,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
  } from "lucide-react";
  
  // ==========================================
  // API CONFIGURATION
  // ==========================================
  
  const API_URL = (
    import.meta.env.VITE_API_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  
  const PROFILE_API =
    `${API_URL}/api/wholesale/profile`;
  
  const AUTH_KEY = "seventeen_auth";
  
  const EMPTY_FORM = {
    shopName: "",
    phone: "",
    shopAddress: "",
    businessRegistrationNumber: "",
  };
  
  // ==========================================
  // AUTH HELPER
  // ==========================================
  
  function getToken() {
    try {
      const auth = JSON.parse(
        sessionStorage.getItem(AUTH_KEY) || "null"
      );
  
      return (
        auth?.token ||
        auth?.accessToken ||
        auth?.jwt ||
        auth?.user?.token ||
        null
      );
    } catch {
      return null;
    }
  }
  
  // ==========================================
  // API HELPER
  // ==========================================
  
  async function request(
    method = "GET",
    body = null,
    signal
  ) {
    const token = getToken();
  
    if (!token) {
      throw new Error(
        "Session expired. Please log in again."
      );
    }
  
    let response;
  
    try {
      response = await fetch(PROFILE_API, {
        method,
  
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(body !== null
            ? { "Content-Type": "application/json" }
            : {}),
        },
  
        ...(body !== null
          ? { body: JSON.stringify(body) }
          : {}),
  
        signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
  
      throw new Error(
        "Cannot connect to Spring Boot. Check port 8080."
      );
    }
  
    const responseText = await response.text();
  
    let data = null;
  
    try {
      data = responseText
        ? JSON.parse(responseText)
        : null;
    } catch {
      data = null;
    }
  
    if (!response.ok) {
      const validationMessage =
        data?.errors &&
        typeof data.errors === "object"
          ? Object.entries(data.errors)
              .map(
                ([field, message]) =>
                  `${field}: ${message}`
              )
              .join("\n")
          : "";
  
      throw new Error(
        validationMessage ||
        data?.message ||
        data?.detail ||
        (response.status === 403
          ? "Only wholesale customers may edit this profile."
          : `Request failed (HTTP ${response.status}).`)
      );
    }
  
    if (!data || typeof data !== "object") {
      throw new Error(
        "Invalid profile response from Spring Boot."
      );
    }
  
    return data;
  }
  
  // ==========================================
  // PROFILE FIELD
  // ==========================================
  
  function ProfileField({
    label,
    name,
    value,
    onChange,
    icon: Icon,
    placeholder,
    disabled = false,
    multiline = false,
    maxLength,
  }) {
    const classes =
      "w-full rounded-xl border border-slate-200 " +
      "bg-white px-4 py-3 text-sm text-[#17265B] " +
      "outline-none transition " +
      "focus:border-[#3654FF] focus:ring-2 " +
      "focus:ring-blue-100 disabled:bg-slate-50";
  
    return (
      <div>
        <label
          htmlFor={name}
          className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#17265B]"
        >
          <Icon size={17} className="text-[#3654FF]" />
          {label}
          <span className="text-red-500">*</span>
        </label>
  
        {multiline ? (
          <textarea
            id={name}
            name={name}
            rows={3}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            required
            className={classes}
          />
        ) : (
          <input
            id={name}
            name={name}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={maxLength}
            required
            className={classes}
          />
        )}
      </div>
    );
  }
  
  // ==========================================
  // READ-ONLY PROFILE ROW
  // ==========================================
  
  function ProfileRow({ label, value, icon: Icon }) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-4">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Icon
            size={18}
            className="text-[#3654FF]"
          />
          {label}
        </div>
  
        <span className="max-w-md break-words text-right text-sm font-semibold text-[#17265B]">
          {value || "Not provided"}
        </span>
      </div>
    );
  }
  
  // ==========================================
  // MAIN SHOP PROFILE COMPONENT
  // ==========================================
  
  export default function WholesaleShopProfile({
    onProfileSaved,
  }) {
    const [profile, setProfile] = useState(null);
  
    const [form, setForm] = useState(EMPTY_FORM);
  
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
  
    const [editing, setEditing] = useState(false);
  
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
  
    // ========================================
    // LOAD PROFILE
    // ========================================
  
    const loadProfile = useCallback(
      async (signal) => {
        setLoading(true);
        setError("");
  
        try {
          const data = await request(
            "GET",
            null,
            signal
          );
  
          if (signal?.aborted) return;
  
          setProfile(data);
  
          const values = {
            shopName: data.shopName || "",
            phone: data.phone || "",
            shopAddress: data.shopAddress || "",
            businessRegistrationNumber:
              data.businessRegistrationNumber || "",
          };
  
          setForm(values);
  
          // If the customer has not completed the profile,
          // open the edit form automatically.
          const incomplete = Object.values(values)
            .some((value) => !value.trim());
  
          setEditing(incomplete);
        } catch (err) {
          if (err.name !== "AbortError") {
            setError(err.message);
          }
        } finally {
          if (!signal?.aborted) {
            setLoading(false);
          }
        }
      },
      []
    );
  
    useEffect(() => {
      const controller = new AbortController();
  
      loadProfile(controller.signal);
  
      return () => controller.abort();
    }, [loadProfile]);
  
    // ========================================
    // UPDATE INPUT VALUES
    // ========================================
  
    function handleChange(event) {
      const { name, value } = event.target;
  
      setForm((previous) => ({
        ...previous,
        [name]: value,
      }));
  
      setError("");
      setSuccess("");
    }
  
    // ========================================
    // VALIDATE PROFILE
    // ========================================
  
    function validateProfile() {
      if (!form.shopName.trim()) {
        return "Please enter your shop name.";
      }
  
      if (!form.phone.trim()) {
        return "Please enter your phone number.";
      }
  
      if (!form.shopAddress.trim()) {
        return "Please enter your shop address.";
      }
  
      if (!form.businessRegistrationNumber.trim()) {
        return "Please enter your business registration number.";
      }
  
      return "";
    }
  
    // ========================================
    // SAVE PROFILE
    // ========================================
  
    async function handleSave(event) {
      event.preventDefault();
  
      const validationError = validateProfile();
  
      if (validationError) {
        setError(validationError);
        return;
      }
  
      if (saving) return;
  
      setSaving(true);
      setError("");
      setSuccess("");
  
      const payload = {
        shopName: form.shopName.trim(),
        phone: form.phone.trim(),
        shopAddress: form.shopAddress.trim(),
        businessRegistrationNumber:
          form.businessRegistrationNumber.trim(),
      };
  
      try {
        const saved = await request(
          "PUT",
          payload
        );
  
        setProfile(saved);
  
        setForm({
          shopName: saved.shopName || "",
          phone: saved.phone || "",
          shopAddress: saved.shopAddress || "",
          businessRegistrationNumber:
            saved.businessRegistrationNumber || "",
        });
  
        setEditing(false);
  
        setSuccess(
          "Shop profile saved successfully!"
        );
  
        if (typeof onProfileSaved === "function") {
          onProfileSaved(saved);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }
  
    // ========================================
    // CANCEL EDITING
    // ========================================
  
    function cancelEditing() {
      setForm({
        shopName: profile?.shopName || "",
        phone: profile?.phone || "",
        shopAddress: profile?.shopAddress || "",
        businessRegistrationNumber:
          profile?.businessRegistrationNumber || "",
      });
  
      setEditing(false);
      setError("");
      setSuccess("");
    }
  
    // ========================================
    // LOADING SCREEN
    // ========================================
  
    if (loading) {
      return (
        <section className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-[#3654FF]">
            <RefreshCw
              size={22}
              className="animate-spin"
            />
            Loading your shop profile...
          </div>
        </section>
      );
    }
  
    // ========================================
    // MAIN UI
    // ========================================
  
    return (
      <section className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
  
        {/* HEADER */}
  
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#17265B]">
              Shop Profile
            </h2>
  
            <p className="mt-2 text-sm text-slate-500">
              Manage your wholesale business information.
            </p>
          </div>
  
          {!editing && profile && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError("");
                setSuccess("");
              }}
              className="flex items-center gap-2 rounded-xl bg-[#3654FF] px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Pencil size={17} />
              Edit Profile
            </button>
          )}
        </div>
  
        {/* ERROR */}
  
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle size={20} className="shrink-0" />
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}
  
        {/* SUCCESS */}
  
        {success && (
          <div
            role="status"
            className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
          >
            <CheckCircle2 size={20} />
            {success}
          </div>
        )}
  
        {/* OWNER DETAILS */}
  
        <div className="mb-8">
          <h3 className="text-lg font-bold text-[#17265B]">
            Account Information
          </h3>
  
          <p className="mt-1 text-xs text-slate-500">
            These details are taken from your login account.
          </p>
  
          <ProfileRow
            label="Owner"
            value={profile?.ownerName}
            icon={UserRound}
          />
  
          <ProfileRow
            label="Email"
            value={profile?.email}
            icon={Mail}
          />
        </div>
  
        {/* EDIT FORM */}
  
        {editing ? (
          <form
            onSubmit={handleSave}
            className="space-y-6"
          >
            <h3 className="border-t border-slate-100 pt-7 text-lg font-bold text-[#17265B]">
              Business Details
            </h3>
  
            <ProfileField
              label="Shop Name"
              name="shopName"
              value={form.shopName}
              onChange={handleChange}
              icon={Store}
              placeholder="Enter your wholesale shop name"
              maxLength={150}
              disabled={saving}
            />
  
            <ProfileField
              label="Phone Number"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              icon={Phone}
              placeholder="07XXXXXXXX"
              maxLength={20}
              disabled={saving}
            />
  
            <ProfileField
              label="Shop Address"
              name="shopAddress"
              value={form.shopAddress}
              onChange={handleChange}
              icon={MapPin}
              placeholder="Street, city, district, province"
              multiline
              disabled={saving}
            />
  
            <ProfileField
              label="Business Registration Number"
              name="businessRegistrationNumber"
              value={form.businessRegistrationNumber}
              onChange={handleChange}
              icon={FileText}
              placeholder="Enter your business registration number"
              maxLength={100}
              disabled={saving}
            />
  
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={17} />
                Cancel
              </button>
  
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#3654FF] px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Save size={17} />
                )}
  
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <h3 className="border-t border-slate-100 pt-7 text-lg font-bold text-[#17265B]">
              Business Details
            </h3>
  
            <ProfileRow
              label="Shop Name"
              value={profile?.shopName}
              icon={Store}
            />
  
            <ProfileRow
              label="Phone Number"
              value={profile?.phone}
              icon={Phone}
            />
  
            <ProfileRow
              label="Shop Address"
              value={profile?.shopAddress}
              icon={MapPin}
            />
  
            <ProfileRow
              label="Business Registration Number"
              value={profile?.businessRegistrationNumber}
              icon={FileText}
            />
          </div>
        )}
      </section>
    );
  }
  