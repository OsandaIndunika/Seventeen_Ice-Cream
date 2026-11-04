
import {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = async (email, password) => {
    let response;

    try {
      response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(
        "Cannot connect to the server. Check that Spring Boot is running."
      );
    }

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid response from the server.");
    }

    if (!response.ok) {
      throw new Error(
        typeof data.message === "string"
          ? data.message
          : "Invalid email or password."
      );
    }

    if (!data.token || !data.user?.role) {
      throw new Error(
        "The server did not return a valid login response."
      );
    }

    setToken(data.token);
    setUser(data.user);

    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
