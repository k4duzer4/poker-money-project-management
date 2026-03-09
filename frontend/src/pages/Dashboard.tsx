import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, History, Plus, Spade, TrendingUp } from 'lucide-react';

import { getApiErrorMessage } from '../services/errors';
import { getTableRequest, listTablesRequest } from '../services/tables';
import type { Table, TableSummary } from '../types/domain';
import { formatDateTime } from '../utils/format';

type DashboardTableInfo = {
  table: Table;
  summary: TableSummary | null;
};

export default function Dashboard() {
  const [tableInfos, setTableInfos] = useState<DashboardTableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const nextTables = await listTablesRequest();

        const details = await Promise.all(
          nextTables.map(async (table) => {
            try {
              const detail = await getTableRequest(table.id);
              return { table, summary: detail.summary };
            } catch {
              // Keeps dashboard usable even if one table detail call fails.
              return { table, summary: null };
            }
          }),
        );

        setTableInfos(details);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Nao foi possivel carregar o dashboard.'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const openTables = useMemo(
    () => tableInfos.filter((item) => item.table.status === 'OPEN'),
    [tableInfos],
  );

  const closedTables = useMemo(
    () => tableInfos.filter((item) => item.table.status === 'CLOSED'),
    [tableInfos],
  );

  const activePlayersTotal = useMemo(() => {
    return tableInfos.reduce((accumulator, item) => {
      return accumulator + (item.summary?.activePlayers ?? 0);
    }, 0);
  }, [tableInfos]);

  if (loading) {
    return (
      <div className="dashboard-modern dashboard-loading-shell">
        <section className="dashboard-hero dashboard-loading-block" />
        <section className="dashboard-stats-grid">
          <article className="dashboard-stat-card dashboard-loading-block" />
          <article className="dashboard-stat-card dashboard-loading-block" />
          <article className="dashboard-stat-card dashboard-loading-block" />
        </section>
        <section className="dashboard-table-grid">
          <article className="dashboard-table-card dashboard-loading-block" />
          <article className="dashboard-table-card dashboard-loading-block" />
          <article className="dashboard-table-card dashboard-loading-block" />
        </section>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="dashboard-modern">
      <section className="dashboard-hero">
        <div>
          <h2 className="dashboard-title">Chipz</h2>
          <p className="dashboard-subtitle">Gerencie suas mesas de cash game</p>
        </div>
        <div className="dashboard-hero-actions">
          <Link to="/app/tables/new" className="btn btn-primary btn-modern-primary">
            <Plus size={18} />
            Nova Mesa
          </Link>
          <Link to="/app/tables" className="btn btn-outline-secondary btn-modern-outline">
            Ver Todas
          </Link>
        </div>
      </section>

      <section className="dashboard-stats-grid">
        <article className="dashboard-stat-card stat-green">
          <div className="dashboard-stat-icon">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="dashboard-stat-label">Mesas Ativas</p>
            <p className="dashboard-stat-value">{openTables.length}</p>
          </div>
        </article>

        <article className="dashboard-stat-card stat-gold">
          <div className="dashboard-stat-icon">
            <History size={20} />
          </div>
          <div>
            <p className="dashboard-stat-label">Total de Mesas</p>
            <p className="dashboard-stat-value">{tableInfos.length}</p>
          </div>
        </article>

        <article className="dashboard-stat-card stat-cyan">
          <div className="dashboard-stat-icon">
            <Spade size={20} />
          </div>
          <div>
            <p className="dashboard-stat-label">Jogadores Ativos</p>
            <p className="dashboard-stat-value">{activePlayersTotal}</p>
          </div>
        </article>
      </section>

      {openTables.length > 0 && (
        <section className="dashboard-section">
          <h3 className="dashboard-section-title">
            <span className="live-dot" />
            Mesas em Andamento
          </h3>

          <div className="dashboard-table-grid">
            {openTables.map((item) => (
              <article key={item.table.id} className="dashboard-table-card">
                <div className="table-card-header">
                  <h4>{item.table.name}</h4>
                  <span className="badge text-bg-success">Aberta</span>
                </div>

                <p className="table-card-meta">
                  Blinds: {item.table.blinds} | Moeda: {item.table.currency}
                </p>
                <p className="table-card-date">
                  <Clock3 size={14} />
                  {formatDateTime(item.table.createdAt)}
                </p>

                <div className="table-card-stats">
                  <div>
                    <span>Jogadores</span>
                    <strong>{item.summary?.totalPlayers ?? '-'}</strong>
                  </div>
                  <div>
                    <span>Transacoes</span>
                    <strong>{item.summary?.totalTransactions ?? '-'}</strong>
                  </div>
                </div>

                <Link to={`/app/tables/${item.table.id}`} className="btn btn-primary w-100 btn-modern-primary">
                  Acessar Mesa
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {closedTables.length > 0 && (
        <section className="dashboard-section">
          <h3 className="dashboard-section-title">
            <History size={18} />
            Historico
          </h3>

          <div className="dashboard-table-grid">
            {closedTables.slice(0, 9).map((item) => (
              <article key={item.table.id} className="dashboard-table-card closed-card">
                <div className="table-card-header">
                  <h4>{item.table.name}</h4>
                  <span className="badge text-bg-secondary">Fechada</span>
                </div>

                <p className="table-card-meta">
                  Blinds: {item.table.blinds} | Moeda: {item.table.currency}
                </p>
                <p className="table-card-date">
                  <Clock3 size={14} />
                  {formatDateTime(item.table.createdAt)}
                </p>

                <div className="table-card-stats">
                  <div>
                    <span>Jogadores</span>
                    <strong>{item.summary?.totalPlayers ?? '-'}</strong>
                  </div>
                  <div>
                    <span>Transacoes</span>
                    <strong>{item.summary?.totalTransactions ?? '-'}</strong>
                  </div>
                </div>

                <Link to={`/app/tables/${item.table.id}`} className="btn btn-outline-secondary w-100 btn-modern-outline">
                  Ver Mesa
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {tableInfos.length === 0 && (
        <section className="dashboard-empty">
          <div className="dashboard-empty-icon">
            <Spade size={34} />
          </div>
          <h3>Nenhuma mesa ainda</h3>
          <p>Crie sua primeira mesa para comecar com estilo.</p>
          <Link to="/app/tables/new" className="btn btn-primary btn-modern-primary">
            <Plus size={18} />
            Criar Mesa
          </Link>
        </section>
      )}
    </div>
  );
}
