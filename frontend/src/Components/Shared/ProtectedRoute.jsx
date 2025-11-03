import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ requiredRole, children }) => {
  const token = localStorage.getItem("Token");
  const role = localStorage.getItem("role");

  // Not authenticated
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // No role restriction
  if (!requiredRole) return children;

  const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const normalizedAllowed = allowed.map((r) => String(r).toLowerCase());
  const userRole = role ? String(role).toLowerCase() : "";

  if (!normalizedAllowed.includes(userRole)) {
    // Authenticated but not authorized for this route
    return <Navigate to="/home" replace />;
  }

  return children;
};

export default ProtectedRoute;
