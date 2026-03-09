import { Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';

import ProtectedRoute from './components/ProtectedRoute';
import ToastCenter from './components/ToastCenter';
import AppLayout from './layouts/AppLayout';
import PublicLayout from './layouts/PublicLayout';
import Dashboard from './pages/Dashboard';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import NewTable from './pages/NewTable';
import NotFound from './pages/NotFound';
import { RegisterPage } from './pages/RegisterPage';
import TableDetail from './pages/TableDetail';
import TableSettings from './pages/TableSettings';
import TablesList from './pages/TablesList';
import { useAuthStore } from './stores/authStore';

export const App = () => {
  const token = useAuthStore((state) => state.token);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const bootstrapLoading = useAuthStore((state) => state.bootstrapLoading);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    if (token && !bootstrapped && !bootstrapLoading) {
      bootstrap();
    }
  }, [token, bootstrapped, bootstrapLoading, bootstrap]);

  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="tables" element={<TablesList />} />
            <Route path="tables/new" element={<NewTable />} />
            <Route path="tables/:tableId" element={<TableDetail />} />
            <Route path="tables/:tableId/settings" element={<TableSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastCenter />
    </>
  );
};

export default App;
