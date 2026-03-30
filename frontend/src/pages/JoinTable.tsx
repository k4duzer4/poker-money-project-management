import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getApiErrorMessage } from '../services/errors';
import { createPlayerRequest } from '../services/players';
import { getInviteTableRequest } from '../services/tables';
import type { DiscoverTable } from '../types/domain';
import { useUIStore } from '../stores/uiStore';
import { formatCurrencyFromCents } from '../utils/format';

const parseCurrencyToCents = (value: string) => {
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/r\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');

  if (!normalized) {
    return Number.NaN;
  }

  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount) || amount <= 0) {
    return Number.NaN;
  }

  return Math.round(amount * 100);
};

export default function JoinTable() {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const navigate = useNavigate();
  const addToast = useUIStore((state) => state.addToast);

  const [table, setTable] = useState<DiscoverTable | null>(null);
  const [password, setPassword] = useState('');
  const [buyInReais, setBuyInReais] = useState('50');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTable = async () => {
      if (!inviteToken) {
        setError('Link de convite inválido.');
        setLoading(false);
        return;
      }

      try {
        const found = await getInviteTableRequest(inviteToken);
        setTable(found);
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Nao foi possivel abrir o convite.'));
      } finally {
        setLoading(false);
      }
    };

    loadTable();
  }, [inviteToken]);

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!table) {
      return;
    }

    const buyInCents = parseCurrencyToCents(buyInReais);

    if (Number.isNaN(buyInCents)) {
      addToast('Informe um buy-in válido.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      await createPlayerRequest(table.id, password, buyInCents);
      addToast('Entrada na mesa confirmada.', 'success');
      navigate(`/app/tables/${table.id}`);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Nao foi possivel entrar na mesa.');
      setError(message);
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="alert alert-secondary mb-0">Carregando convite...</div>;
  }

  if (!table) {
    return <div className="alert alert-danger mb-0">{error ?? 'Convite inválido.'}</div>;
  }

  if (table.alreadyJoined) {
    return (
      <div className="d-grid gap-3">
        <div className="alert alert-info mb-0">Você já entrou nessa mesa.</div>
        <Link to={`/app/tables/${table.id}`} className="btn btn-primary w-auto">Abrir mesa</Link>
      </div>
    );
  }

  return (
    <div className="d-grid gap-3">
      <div>
        <h2 className="h4 mb-1">Entrar na mesa</h2>
        <p className="text-secondary mb-0">{table.name} ({table.code})</p>
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}

      <form onSubmit={handleJoin} className="card p-3 d-grid gap-3">
        <div>
          <label className="form-label">Senha da mesa</label>
          <input
            className="form-control"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div>
          <label className="form-label">Buy-in inicial (R$)</label>
          <input
            className="form-control"
            value={buyInReais}
            onChange={(event) => setBuyInReais(event.target.value)}
            required
          />
          <small className="text-secondary">
            Minimo: {formatCurrencyFromCents(table.buyInMinimoCents, table.currency)}
          </small>
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar na mesa'}
        </button>
      </form>
    </div>
  );
}
