import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

// Páginas públicas
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

// Páginas autenticadas
import Dashboard from "./pages/Dashboard";
import TablesList from "./pages/TablesList";
import NewTable from "./pages/NewTable";
import TableDetail from "./pages/TableDetail";
import TableSettings from "./pages/TableSettings";

// Página de fallback
import NotFound from "./pages/NotFound";

export const App = () => {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Rotas protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/tables" element={<TablesList />} />
        <Route path="/app/tables/new" element={<NewTable />} />
        <Route path="/app/tables/:tableId" element={<TableDetail />} />
        <Route path="/app/tables/:tableId/settings" element={<TableSettings />} />
      </Route>

      {/* Rota para páginas não encontradas */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default App;
