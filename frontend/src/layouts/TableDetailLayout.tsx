import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Activity, Lock, Receipt, Settings, Unlock, Users } from 'lucide-react';

import type { TableSummary, TableStatus } from '../types/domain';

type TableDetailLayoutProps = {
  tableId: string;
  tableName: string;
  tableStatus: TableStatus;
  summary: TableSummary;
  onCloseTable?: () => void;
  onReopenTable?: () => void;
  children: ReactNode;
};

export default function TableDetailLayout({
  tableId,
  tableName,
  tableStatus,
  summary,
  onCloseTable,
  onReopenTable,
  children,
}: TableDetailLayoutProps) {
  return (
    <div className="table-detail-modern d-grid gap-3">
      <header className="card p-3 detail-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h2 className="h4 mb-1 detail-title">{tableName}</h2>
            <p className="mb-0 detail-status-line">
              Status:{' '}
              <span className={`badge ${tableStatus === 'OPEN' ? 'text-bg-success' : 'text-bg-secondary'}`}>
                {tableStatus}
              </span>
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Link to={`/app/tables/${tableId}/settings`} className="btn btn-outline-secondary btn-modern-outline">
              <Settings size={16} />
              Configuracoes
            </Link>
            {tableStatus === 'OPEN' ? (
              <button type="button" className="btn btn-danger btn-modern-outline" onClick={onCloseTable}>
                <Lock size={16} />
                Encerrar mesa
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-modern-primary" onClick={onReopenTable}>
                <Unlock size={16} />
                Reabrir mesa
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="row g-3 detail-summary-grid">
        <article className="col-12 col-md-4">
          <div className="card p-3 h-100 detail-summary-card">
            <div className="detail-summary-icon"><Users size={18} /></div>
            <div>
              <p className="text-secondary mb-1">Jogadores</p>
              <h3 className="h4 mb-0">{summary.totalPlayers}</h3>
            </div>
          </div>
        </article>
        <article className="col-12 col-md-4">
          <div className="card p-3 h-100 detail-summary-card">
            <div className="detail-summary-icon"><Activity size={18} /></div>
            <div>
              <p className="text-secondary mb-1">Ativos</p>
              <h3 className="h4 mb-0">{summary.activePlayers}</h3>
            </div>
          </div>
        </article>
        <article className="col-12 col-md-4">
          <div className="card p-3 h-100 detail-summary-card">
            <div className="detail-summary-icon"><Receipt size={18} /></div>
            <div>
              <p className="text-secondary mb-1">Transações</p>
              <h3 className="h4 mb-0">{summary.totalTransactions}</h3>
            </div>
          </div>
        </article>
      </section>

      <section>{children}</section>
    </div>
  );
}
