import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AddTransactionPage } from "./pages/AddTransactionPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { UsersPage } from "./pages/UsersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SavingsGoalsPage } from "./pages/SavingsGoalsPage";
import { useAppData } from "./context/AppDataContext";
import { getRolePermissions } from "./lib/permissions";

function ProtectedRoute({ children, allow }) {
  const { user, loading } = useAuth();
  const { profile } = useAppData();

  if (loading) {
    return <div className="app-shell flex items-center justify-center p-6">Loading...</div>;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (allow) {
    const permissions = getRolePermissions(profile?.role);
    if (!permissions[allow]) {
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-transaction"
        element={
          <ProtectedRoute allow="canAddTransactions">
            <AddTransactionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/savings"
        element={
          <ProtectedRoute allow="canManageSavings">
            <SavingsGoalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute allow="canManageCategories">
            <CategoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allow="canViewReports">
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allow="canManageUsers">
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
