import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';

export default function ProtectedRoute() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const bootstrapLoading = useAuthStore((state) => state.bootstrapLoading);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    if (!bootstrapped && token && !bootstrapLoading) {
      bootstrap();
    }
  }, [bootstrapped, token, bootstrapLoading, bootstrap]);

  if (token && (!bootstrapped || bootstrapLoading)) {
    return (
      <div className="route-loading-shell" aria-label="Validando sessao">
        <div className="route-loading-card" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
