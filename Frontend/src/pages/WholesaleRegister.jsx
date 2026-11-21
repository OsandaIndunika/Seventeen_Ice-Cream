
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  IceCreamCone,
  User,
  Mail,
  Phone,
  Store,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";

// Backend API URL
const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

// Correct wholesale registration endpoint
const REGISTER_URL =
  `${API_BASE_URL}/api/auth/wholesale/register`;

// Initial form values
const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  shopName: "",
  shopAddress: "",
  businessRegistrationNumber: "",
  password: "",
  confirmPassword: "",
};

// Reusable input component
function FormField({
  label,
  icon: Icon,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete,
  disabled = false,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block font-semibold text-[#17265B]"
      >
        {label}
      </label>

      <div className="relative">
        <Icon
          size={19}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-4 outline-none transition focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </div>
    </div>
  );
}

// Main wholesale registration component
export default function WholesaleRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  // Handle input changes
  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  };

  // Validate the registration form
  const validateForm = () => {
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.shopName.trim() ||
      !form.shopAddress.trim()
    ) {
      return "Please fill in all required fields.";
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(form.email.trim())) {
      return "Please enter a valid email address.";
    }

    const phonePattern = /^0[0-9]{9}$/;

    if (!phonePattern.test(form.phone.trim())) {
      return "Please enter a valid 10-digit Sri Lankan phone number.";
    }

    if (form.password.length < 8) {
      return "Password must contain at least 8 characters.";
    }

    if (form.password !== form.confirmPassword) {
      return "Passwords do not match.";
    }

    return null;
  };

  // Submit registration to Spring Boot
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading || success) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    // Only send fields expected by the backend DTO
    const registrationData = {
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      shopName: form.shopName.trim(),
      shopAddress: form.shopAddress.trim(),
      businessRegistrationNumber:
        form.businessRegistrationNumber.trim(),
      password: form.password,
    };

    try {
      const response = await fetch(REGISTER_URL, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify(registrationData),
      });

      const responseText = await response.text();

      let data = null;

      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        let message =
          data?.message ||
          data?.detail ||
          data?.error ||
          `Registration failed (HTTP ${response.status}).`;

        if (response.status === 400) {
          message =
            data?.message ||
            data?.detail ||
            "Invalid registration details. Please check your information.";
        }

        if (response.status === 409) {
          message =
            data?.message ||
            "An account with this email already exists.";
        }

        if (response.status === 401) {
          message =
            "Registration was not authorized. Check the Spring Security configuration.";
        }

        if (response.status === 403) {
          message =
            "Registration is blocked by Spring Security. Ensure the wholesale registration endpoint is public.";
        }

        if (response.status === 404) {
          message =
            "Wholesale registration endpoint was not found. Check your backend controller URL.";
        }

        if (response.status >= 500) {
          message =
            data?.message ||
            "The server encountered an error. Check the Spring Boot terminal.";
        }

        throw new Error(message);
      }

      // Registration successful
      setSuccess(
        "Your wholesale account has been created successfully! You can now sign in."
      );

      // Clear form after successful registration
      setForm(initialForm);

    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          "Cannot connect to the backend. Make sure Spring Boot is running on port 8080 and CORS is configured."
        );
      } else {
        setError(
          err.message ||
          "Unable to create your account. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // Navigate to login after successful registration
  const handleGoToLogin = () => {
    navigate("/login", {
      replace: true,
      state: {
        message:
          "Your wholesale account has been created. Please sign in.",
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F9FF] lg:grid lg:grid-cols-[42%_58%]">

      {/* LEFT BRAND PANEL */}
      <aside className="relative hidden min-h-screen flex-col overflow-hidden bg-[#3654FF] px-12 py-10 text-white lg:flex">

        {/* Decorative circles */}
        <div className="absolute -right-16 top-16 h-52 w-52 rounded-full bg-white/10" />

        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-white/10" />

        {/* Brand logo */}
        <Link
          to="/"
          className="relative z-10 flex items-center gap-4"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
            <IceCreamCone size={34} />
          </div>

          <div>
            <h1 className="text-2xl font-bold">
              Sathutu Sina
            </h1>

            <p>Dairies</p>
          </div>
        </Link>

        {/* Marketing content */}
        <div className="relative z-10 my-auto py-16">

          <span className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm">
            Wholesale Partnership
          </span>

          <h2 className="mt-9 font-serif text-5xl font-bold leading-tight xl:text-6xl">
            Grow Your
            <br />
            Business With
            <br />
            Every Scoop.
          </h2>

          <p className="mt-8 max-w-lg text-lg leading-9 text-blue-100">
            Become a Sathutu Sina Dairies wholesale
            customer and manage your ice cream orders
            conveniently through your own dashboard.
          </p>

          <div className="mt-12 space-y-5">
            {[
              "Convenient wholesale ordering",
              "Track your orders and deliveries",
              "Manage your wholesale shop account",
              "Secure account access",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3"
              >
                <CheckCircle2 size={21} />

                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-sm text-blue-100">
          © 2026 Sathutu Sina Dairies
        </p>
      </aside>

      {/* RIGHT REGISTRATION PANEL */}
      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-16">

        <div className="w-full max-w-2xl">

          {/* Mobile brand */}
          <div className="mb-8 lg:hidden">
            <Link
              to="/"
              className="flex items-center gap-3 text-[#3654FF]"
            >
              <IceCreamCone size={30} />

              <span className="text-xl font-bold">
                Sathutu Sina Dairies
              </span>
            </Link>
          </div>

          {/* Heading */}
          <p className="font-bold uppercase tracking-[0.15em] text-[#3654FF]">
            Wholesale Registration
          </p>

          <h2 className="mt-3 font-serif text-4xl font-bold text-[#17265B] sm:text-5xl">
            Create Account
          </h2>

          <p className="mt-4 text-slate-500">
            Enter your details to become a wholesale
            customer.
          </p>

          {/* ERROR MESSAGE */}
          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle
                size={20}
                className="shrink-0"
              />

              <span>{error}</span>
            </div>
          )}

          {/* SUCCESS MESSAGE */}
          {success && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={23}
                  className="shrink-0 text-green-600"
                />

                <div>
                  <p className="font-bold text-green-800">
                    Registration Successful!
                  </p>

                  <p className="mt-2 text-sm text-green-700">
                    {success}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoToLogin}
                className="mt-5 flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700"
              >
                Continue to Login
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* REGISTRATION FORM */}
          {!success && (
            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-7"
            >

              {/* PERSONAL INFORMATION */}
              <section>
                <h3 className="mb-5 text-lg font-bold text-[#17265B]">
                  Personal Information
                </h3>

                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField
                    label="Full Name"
                    icon={User}
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                    disabled={loading}
                  />

                  <FormField
                    label="Email Address"
                    icon={Mail}
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    disabled={loading}
                  />

                  <div className="sm:col-span-2">
                    <FormField
                      label="Phone Number"
                      icon={Phone}
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="07XXXXXXXX"
                      autoComplete="tel"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
              </section>

              {/* SHOP INFORMATION */}
              <section>
                <h3 className="mb-5 text-lg font-bold text-[#17265B]">
                  Wholesale Shop Information
                </h3>

                <div className="space-y-5">
                  <FormField
                    label="Shop Name"
                    icon={Store}
                    name="shopName"
                    value={form.shopName}
                    onChange={handleChange}
                    placeholder="Enter your shop name"
                    required
                    disabled={loading}
                  />

                  <FormField
                    label="Shop Address"
                    icon={MapPin}
                    name="shopAddress"
                    value={form.shopAddress}
                    onChange={handleChange}
                    placeholder="Enter your shop address"
                    required
                    disabled={loading}
                  />

                  <FormField
                    label="Business Registration Number (Optional)"
                    icon={ShieldCheck}
                    name="businessRegistrationNumber"
                    value={form.businessRegistrationNumber}
                    onChange={handleChange}
                    placeholder="Enter registration number"
                    disabled={loading}
                  />
                </div>
              </section>

              {/* ACCOUNT SECURITY */}
              <section>
                <h3 className="mb-5 text-lg font-bold text-[#17265B]">
                  Account Security
                </h3>

                <div className="space-y-5">

                  {/* PASSWORD */}
                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block font-semibold text-[#17265B]"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="password"
                        name="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        value={form.password}
                        onChange={handleChange}
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Minimum 8 characters"
                        required
                        disabled={loading}
                        className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-12 outline-none focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="mb-2 block font-semibold text-[#17265B]"
                    >
                      Confirm Password
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        value={form.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                        required
                        disabled={loading}
                        className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-12 outline-none focus:border-[#3654FF] focus:ring-2 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(
                            (previous) => !previous
                          )
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Hide confirm password"
                            : "Show confirm password"
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                </div>
              </section>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#3654FF] px-6 py-4 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={21}
                      className="animate-spin"
                    />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Wholesale Account
                    <ArrowRight size={21} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* FOOTER */}
          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <p className="text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-bold text-[#3654FF] hover:underline"
              >
                Sign In
              </Link>
            </p>

            <Link
              to="/"
              className="mt-6 inline-block text-sm font-semibold text-[#3654FF]"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
