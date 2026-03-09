import { Outlet } from "react-router-dom";

export default function TableDetailLayout() {
  return (
    <div>
      <header>
        <h2>Detalhe da Mesa</h2>
      </header>
      <section>
        <Outlet />
      </section>
    </div>
  );
}
