import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, PlusSquare, TableProperties, LogOut } from 'lucide-react';

import { appName } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function AppLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="container-fluid min-vh-100 py-3 app-shell">
      <div className="row g-3 min-vh-100">
        <aside className="col-12 col-lg-3 col-xxl-2">
          <div className="card h-100 p-3 d-flex flex-column app-sidebar-card">
            <Link to="/app" className="app-brand text-decoration-none mb-4">
              <span className="app-brand-dot" />
              {appName}
            </Link>

            <nav className="nav flex-column gap-2 mb-auto app-nav">
              <NavLink
                to="/app"
                end
                className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              >
                <LayoutDashboard size={16} />
                Dashboard
              </NavLink>

              <NavLink
                to="/app/tables"
                className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              >
                <TableProperties size={16} />
                Mesas
              </NavLink>

              <NavLink
                to="/app/tables/new"
                className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}
              >
                <PlusSquare size={16} />
                Nova Mesa
              </NavLink>
            </nav>

            <div className="mt-4 pt-3 border-top border-secondary-subtle app-sidebar-footer">
              <p className="mb-2 text-secondary small">Logado como</p>
              <p className="mb-3 text-light text-break app-user-email">{user?.email}</p>
              <button type="button" className="btn btn-danger w-100 app-logout-btn" onClick={handleLogout}>
                <LogOut size={15} />
                Sair
              </button>
            </div>
          </div>
        </aside>

        <section className="col-12 col-lg-9 col-xxl-10 d-flex flex-column gap-3">
          <main className="card p-3 flex-grow-1 app-main-card">
            <Outlet />
          </main>
        </section>
      </div>
    </div>
  );
}
