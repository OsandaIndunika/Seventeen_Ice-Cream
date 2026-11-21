
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Supported roles in the application
const VALID_ROLES = [
  "ADMIN",
  "FACTORY_MANAGER",
  "SALES_MANAGER",
  "OUTLET_MANAGER",
  "DELIVERY_PERSON",
  "WHOLESALE",
  "STAFF",
];

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated } = useAuth();

  // Step 1: Check authentication
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Step 2: Check that the account has a supported role
  if (!VALID_ROLES.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Step 3: Check permission for the requested page
  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Step 4: Render the authorized dashboard
  return <Outlet />;
}
