import { NavLink, useLocation } from "react-router-dom";
import { useRolePermissions } from "../hooks/useRolePermissions";

const navItems = [
  { to: "/", label: "Dashboard", permission: "canAddTransactions" },
  { to: "/add-transaction", label: "Add", permission: "canAddTransactions" },
  { to: "/reports", label: "Reports", permission: "canViewReports" },
  { to: "/categories", label: "Categories", permission: "canManageCategories" },
  { to: "/savings", label: "Goals", permission: "canManageSavings" },
  { to: "/users", label: "Users", permission: "canManageUsers" },
  { to: "/settings", label: "Settings", permission: "canAddTransactions" },
];

export function Layout({ title, subtitle, children }) {
  const location = useLocation();
  const permissions = useRolePermissions();
  const hideNavigation = location.pathname === "/login";
  const visibleNavItems = navItems.filter(
    (item) => !item.permission || permissions[item.permission]
  );
  const frameClassName = hideNavigation
    ? "min-h-svh"
    : "app-frame";

  return (
    <div className="app-shell">
      <div className={frameClassName}>
        {!hideNavigation ? (
          <aside className="desktop-sidebar">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Daily Money Tracker
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900">Business Panel</p>
            <nav className="mt-6 space-y-2">
              {visibleNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block nav-chip ${isActive ? "nav-chip-active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        ) : null}

        <div className="desktop-main">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 md:hidden">
              Daily Money Tracker
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </header>

          <main className="space-y-4 p-4 pb-24 md:p-6">{children}</main>
        </div>
      </div>

      {!hideNavigation ? (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white md:hidden">
          <ul
            className="mx-auto grid max-w-md"
            style={{ gridTemplateColumns: `repeat(${visibleNavItems.length || 1}, minmax(0, 1fr))` }}
          >
            {visibleNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-1 py-2 text-center text-[11px] font-medium ${
                      isActive ? "text-slate-900" : "text-slate-500"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
