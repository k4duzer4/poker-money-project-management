import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Plus, Search, Settings2, TableProperties } from 'lucide-react';

import { getApiErrorMessage } from '../services/errors';
import { discoverTablesRequest, listTablesRequest } from '../services/tables';
import type { DiscoverTable, Table } from '../types/domain';
import { formatDateTime } from '../utils/format';

export default function TablesList() {
  const [tables, setTables] = useState<Table[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverResults, setDiscoverResults] = useState<DiscoverTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTables = async () => {
      try {
        setError(null);
        const nextTables = await listTablesRequest();
        setTables(nextTables);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Nao foi possivel carregar as mesas.'));
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, []);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setDiscoverResults([]);
      return;
    }

    setDiscoverLoading(true);

    try {
      const results = await discoverTablesRequest(searchTerm.trim());
      setDiscoverResults(results);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Nao foi possivel pesquisar mesas.'));
    } finally {
      setDiscoverLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="tables-modern tables-loading-shell d-grid gap-3">
        <div className="tables-hero tables-loading-block" />
        <div className="card p-3 tables-loading-table">
          <div className="tables-loading-line" />
          <div className="tables-loading-line" />
          <div className="tables-loading-line" />
          <div className="tables-loading-line" />
          <div className="tables-loading-line short" />
        </div>
      </div>
    );
  }

  return (
    <div className="tables-modern d-grid gap-3">
      <div className="tables-hero d-flex justify-content-between align-items-center">
        <div>
          <h2 className="h4 mb-1 d-flex align-items-center gap-2">
            <TableProperties size={20} />
            Mesas
          </h2>
          <p className="text-secondary mb-0">Gerencie suas mesas de poker cash com visual premium.</p>
        </div>

        <Link to="/app/tables/new" className="btn btn-primary btn-modern-primary">
          <Plus size={16} />
          Nova mesa
        </Link>
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}

      <div className="card p-3 d-grid gap-2">
        <h3 className="h6 mb-0">Pesquisar mesas</h3>
        <p className="text-secondary mb-0">Encontre por codigo ou nome automatico da mesa.</p>
        <div className="d-flex gap-2 flex-wrap">
          <input
            className="form-control"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ex.: MESA-AB12CD"
          />
          <button type="button" className="btn btn-outline-secondary btn-modern-outline" onClick={handleSearch} disabled={discoverLoading}>
            <Search size={14} />
            {discoverLoading ? 'Pesquisando...' : 'Pesquisar'}
          </button>
        </div>
        {discoverResults.length > 0 && (
          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0 modern-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Mesa</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {discoverResults.map((table) => (
                  <tr key={`discover-${table.id}`}>
                    <td><strong>{table.code}</strong></td>
                    <td>{table.name}</td>
                    <td>{table.status === 'OPEN' ? 'Aberta' : 'Fechada'}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <Link to={`/app/join/${table.inviteToken}`} className="btn btn-sm btn-primary btn-modern-primary">
                          Entrar por link
                        </Link>
                        <Link to={`/app/tables/${table.id}`} className="btn btn-sm btn-outline-secondary btn-modern-outline">
                          Ver mesa
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!error && tables.length === 0 ? (
        <div className="alert alert-info mb-0">Nenhuma mesa encontrada. Crie a primeira mesa.</div>
      ) : (
        <div className="table-responsive tables-shell">
          <table className="table table-dark table-hover align-middle mb-0 modern-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Blinds</th>
                <th>Moeda</th>
                <th>Status</th>
                <th>Criada em</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id}>
                  <td>
                    <div className="table-name-cell">
                      <strong>{table.name}</strong>
                      <div className="small text-secondary">{table.code}</div>
                    </div>
                  </td>
                  <td>{table.blinds}</td>
                  <td>{table.currency}</td>
                  <td>
                    <span className={`badge ${table.status === 'OPEN' ? 'text-bg-success' : 'text-bg-secondary'} status-pill`}>
                      {table.status === 'OPEN' ? 'Aberta' : 'Fechada'}
                    </span>
                  </td>
                  <td>{formatDateTime(table.createdAt)}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <Link to={`/app/tables/${table.id}`} className="btn btn-sm btn-outline-secondary btn-modern-outline">
                        <Eye size={14} />
                        Ver mesa
                      </Link>
                      <Link to={`/app/tables/${table.id}/settings`} className="btn btn-sm btn-outline-secondary btn-modern-outline">
                        <Settings2 size={14} />
                        Configurar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
