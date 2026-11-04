
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IceCreamCone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const dashboardRoutes = {
  WHOLESALE: "/wholesale/dashboard",
  STAFF: "/staff/dashboard",
  SALES_MANAGER: "/sales/dashboard",
  OUTLET_MANAGER: "/outlet/dashboard",
  ADMIN: "/admin/dashboard",
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email.trim(), password);

      const role = result.user?.role;
      const destination = dashboardRoutes[role];

      if (!destination) {
        setError("Your account role is not supported.");
        return;
      }

      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FFF9F3] px-4 py-12 sm:px-6 lg:py-20">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-xl lg:grid-cols-2">

        {/* LEFT SIDE */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#3654FF] px-8 py-12 text-white sm:px-12 lg:min-h-[680px]">

          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="rounded-2xl bg-white/15 p-3">
                <IceCreamCone size={32} />
              </div>

              <div>
                <h2 className="text-xl font-bold">
                  Sathutu Sina
                </h2>
                <p className="text-sm text-blue-100">
                  Dairies
                </p>
              </div>
            </Link>
          </div>

          <div className="relative z-10 my-16">
            <span className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm">
              Welcome Back!
            </span>

            <h1 className="mt-8 font-serif text-4xl font-bold leading-tight sm:text-5xl">
              Your Sweet
              <br />
              Journey Starts
              <br />
              Here.
            </h1>

            <p className="mt-6 max-w-md text-lg leading-8 text-blue-100">
              Sign in to manage your ice cream orders,
              explore our delicious flavours, and stay
              connected with Sathutu Sina Dairies.
            </p>

            <div className="mt-10 flex items-center gap-3">
              <ShieldCheck size={22} />
              <span className="text-sm text-blue-100">
                Secure account access
              </span>
            </div>
          </div>

          <p className="relative z-10 text-sm text-blue-100">
            © {new Date().getFullYear()} Sathutu Sina Dairies
          </p>

          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-12 top-20 h-32 w-32 rounded-full bg-white/10" />
        </section>

        {/* RIGHT SIDE */}
        <section className="flex items-center px-7 py-12 sm:px-12 lg:px-16">
          <div className="w-full">

            <div className="mb-10">
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#3654FF]">
                Account Login
              </p>

              <h2 className="font-serif text-4xl font-bold text-[#17265B]">
                Sign In
              </h2>

              <p className="mt-4 text-gray-500">
                Enter your account details to continue.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-semibold text-[#17265B]"
                >
                  Email Address
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 focus-within:border-[#3654FF]">
                  <Mail size={20} className="text-gray-400" />

                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-transparent py-4 outline-none"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-sm font-semibold text-[#17265B]"
                >
                  Password
                </label>

                <div className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 focus-within:border-[#3654FF]">
                  <Lock size={20} className="text-gray-400" />

                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent py-4 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="text-gray-400 hover:text-[#3654FF]"
                  >
                    {showPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#3654FF] px-6 py-4 font-semibold text-white transition hover:bg-[#233BC8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing In..." : "Sign In"}

                {!loading && <ArrowRight size={20} />}
              </button>
            </form>

            {/* WHOLESALE REGISTRATION */}
            <div className="mt-10 border-t border-gray-100 pt-8">
              <p className="text-center text-gray-500">
                Want to become a wholesale customer?
              </p>

              <Link
                to="/wholesale/register"
                className="mt-5 flex items-center justify-center gap-3 rounded-full border-2 border-[#3654FF] px-6 py-3 font-semibold text-[#3654FF] transition hover:bg-[#EAF0FF]"
              >
                <UserPlus size={20} />
                Create Wholesale Account
              </Link>

              <p className="mt-6 text-center text-sm text-gray-400">
                Staff and managers can sign in using
                their assigned accounts.
              </p>
            </div>

            <Link
              to="/"
              className="mt-8 block text-center text-sm font-medium text-[#3654FF] hover:underline"
            >
              Back to Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
