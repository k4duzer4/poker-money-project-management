import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div>
      <header>
        <h1>Meu App</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
