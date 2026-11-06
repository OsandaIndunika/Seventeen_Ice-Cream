
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated } = useAuth();

  // Redirect users who are not logged in
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check whether the logged-in user has permission
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Render the protected child route
  return <Outlet />;
}
