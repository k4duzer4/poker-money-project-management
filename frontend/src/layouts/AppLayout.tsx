import { Outlet, Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export default function AppLayout() {
  const { user, signOut } = useAuthStore();

  return (
    <div style={{ display: "flex" }}>
      <aside style={{ width: "200px", background: "#eee", padding: "1rem" }}>
        <nav>
          <ul>
            <li><Link to="/app">Dashboard</Link></li>
            <li><Link to="/app/tables">Mesas</Link></li>
          </ul>
        </nav>
        <div>
          <p>{user?.email}</p>
          <button onClick={signOut}>Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "1rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
