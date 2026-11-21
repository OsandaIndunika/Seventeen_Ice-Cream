
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

// Storage key used by all authenticated pages
const AUTH_STORAGE_KEY = "seventeen_auth";

const DELIVERY_SHIFT_KEY = "seventeen_delivery_shift";

// ==============================
// READ SAVED AUTHENTICATION
// ==============================
const getSavedAuth = () => {
  try {
    const savedAuth = sessionStorage.getItem(
      AUTH_STORAGE_KEY
    );

    if (!savedAuth) {
      return null;
    }

    const parsedAuth = JSON.parse(savedAuth);

    // Validate stored authentication data
    if (
      !parsedAuth ||
      typeof parsedAuth.token !== "string" ||
      !parsedAuth.token ||
      !parsedAuth.user ||
      !parsedAuth.user.role
    ) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }

    return parsedAuth;
  } catch {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

// ==============================
// AUTHENTICATION PROVIDER
// ==============================
export function AuthProvider({ children }) {
  // Restore saved authentication on refresh
  const [savedAuth] = useState(getSavedAuth);

  const [user, setUser] = useState(
    savedAuth?.user || null
  );

  const [token, setToken] = useState(
    savedAuth?.token || null
  );

  // ==============================
  // LOGIN FUNCTION
  // ==============================
  const login = async (email, password) => {
    let response;

    try {
      response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );
    } catch {
      throw new Error(
        "Cannot connect to the server. Check that Spring Boot is running."
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Invalid response from the server."
      );
    }

    // Handle login errors
    if (!response.ok) {
      throw new Error(
        typeof data.message === "string"
          ? data.message
          : "Invalid email or password."
      );
    }

    // Validate backend response
    if (!data.token || !data.user?.role) {
      throw new Error(
        "The server did not return a valid login response."
      );
    }

    // ==============================
    // SAVE AUTHENTICATION
    // ==============================
    const authData = {
      token: data.token,
      user: data.user,
    };

    // Save token and user details
    // for delivery pages and page refreshes
    sessionStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(authData)
    );

    // Clear any old vehicle selection.
    // A new login must select its own vehicle.
    sessionStorage.removeItem(
      DELIVERY_SHIFT_KEY
    );

    // Update React authentication state
    setToken(data.token);
    setUser(data.user);

    return data;
  };

  // ==============================
  // LOGOUT FUNCTION
  // ==============================
  const logout = () => {
    // Remove saved authentication
    sessionStorage.removeItem(
      AUTH_STORAGE_KEY
    );

    // Remove locally stored vehicle selection
    sessionStorage.removeItem(
      DELIVERY_SHIFT_KEY
    );

    // Clear React state
    setToken(null);
    setUser(null);
  };

  // ==============================
  // CONTEXT VALUES
  // ==============================
  const value = useMemo(
    () => ({
      user,
      token,
      login,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [user, token]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ==============================
// CUSTOM AUTH HOOK
// ==============================
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
