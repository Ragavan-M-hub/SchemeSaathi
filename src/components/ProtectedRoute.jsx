// src/components/ProtectedRoute.jsx
// Route guard. Waits for the initial session check, then either renders the
// page, bounces to /login (remembering where the user was headed), or shows a
// "not authorised" notice when a role requirement isn't met.

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";

export default function ProtectedRoute({ children, role }) {
  const { user, loading, isOfficer } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner size="lg" label="Checking your session…" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // `role="officer"` gates officer/admin areas; admins inherit officer access.
  if (role === "officer" && !isOfficer) {
    return (
      <div className="card text-center py-12">
        <div className="text-5xl mb-3">🔒</div>
        <h2 className="text-lg font-bold text-navy-900">Officer access only</h2>
        <p className="text-slate-600 mt-1 text-sm">
          This area is restricted to reviewing officers.
        </p>
      </div>
    );
  }

  return children;
}
