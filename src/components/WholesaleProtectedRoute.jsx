
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function WholesaleProtectedRoute({ children }) {
  const { token, user } = useAuth();
  const location = useLocation();

  // User is not logged in
  if (!token || !user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Only wholesale customers can access this dashboard
  if (user.role !== "WHOLESALE") {
    return <Navigate to="/" replace />;
  }

  // Authenticated wholesale customer
  return children;
}
