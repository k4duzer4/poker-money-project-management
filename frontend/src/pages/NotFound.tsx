import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="container py-5">
      <div className="card p-4 text-center">
        <h1 className="h3 mb-2">404 - Pagina nao encontrada</h1>
        <p className="text-secondary mb-4">O caminho informado nao existe no sistema.</p>
        <div className="d-flex justify-content-center gap-2">
          <Link to="/" className="btn btn-outline-secondary">
            Ir para landing
          </Link>
          <Link to="/app" className="btn btn-primary">
            Ir para dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
