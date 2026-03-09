import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Coins, Lock, Save, Settings2, ShieldAlert, Unlock } from 'lucide-react';

import ConfirmModal from '../components/ConfirmModal';
import { getApiErrorMessage } from '../services/errors';
import {
  closeTableRequest,
  getTableRequest,
  reopenTableRequest,
  updateTableRequest,
} from '../services/tables';
import type { Table } from '../types/domain';
import { useUIStore } from '../stores/uiStore';

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

const formatCentsToInput = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return '';
  }

  return (value / 100).toString().replace('.', ',');
};

export default function TableSettings() {
  const { tableId } = useParams<{ tableId: string }>();
  const addToast = useUIStore((state) => state.addToast);

  const [table, setTable] = useState<Table | null>(null);
  const [name, setName] = useState('');
  const [blinds, setBlinds] = useState('');
  const [currency, setCurrency] = useState('');
  const [valorFichaReais, setValorFichaReais] = useState('');
  const [buyInMinimoReais, setBuyInMinimoReais] = useState('');
  const [buyInMaximoReais, setBuyInMaximoReais] = useState('');
  const [permitirRebuy, setPermitirRebuy] = useState(true);
  const [limiteRebuys, setLimiteRebuys] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [criticalLoading, setCriticalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [confirmReopenOpen, setConfirmReopenOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!tableId) {
        setError('Mesa invalida.');
        setLoading(false);
        return;
      }

      try {
        const response = await getTableRequest(tableId);
        setTable(response.table);
        setName(response.table.name);
        setBlinds(response.table.blinds);
        setCurrency(response.table.currency);
        setValorFichaReais(formatCentsToInput(response.table.valorFichaCents));
        setBuyInMinimoReais(formatCentsToInput(response.table.buyInMinimoCents));
        setBuyInMaximoReais(formatCentsToInput(response.table.buyInMaximoCents));
        setPermitirRebuy(response.table.permitirRebuy);
        setLimiteRebuys(String(response.table.limiteRebuys));
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Nao foi possivel carregar a mesa.'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tableId]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tableId) {
      return;
    }

    setSaving(true);

    try {
      const valorFichaCents = parseCurrencyToCents(valorFichaReais);
      const buyInMinimoCents = parseCurrencyToCents(buyInMinimoReais);
      const buyInMaximoCents = buyInMaximoReais.trim() ? parseCurrencyToCents(buyInMaximoReais) : null;

      if (Number.isNaN(valorFichaCents) || Number.isNaN(buyInMinimoCents) || Number.isNaN(Number(limiteRebuys))) {
        throw new Error('Preencha corretamente os campos financeiros.');
      }

      if (buyInMaximoCents !== null && Number.isNaN(buyInMaximoCents)) {
        throw new Error('Buy-in maximo invalido.');
      }

      const updated = await updateTableRequest(tableId, {
        name,
        blinds,
        currency: currency.toUpperCase(),
        valorFichaCents,
        buyInMinimoCents,
        buyInMaximoCents,
        permitirRebuy,
        limiteRebuys: Number(limiteRebuys),
      });
      setTable(updated);
      addToast('Mesa atualizada com sucesso.', 'success');
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Nao foi possivel atualizar a mesa.');
      setError(message);
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseTable = async () => {
    if (!tableId) {
      return;
    }

    setCriticalLoading(true);

    try {
      const updated = await closeTableRequest(tableId);
      setTable(updated);
      addToast('Mesa encerrada.', 'success');
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Nao foi possivel encerrar a mesa.');
      setError(message);
      addToast(message, 'error');
    } finally {
      setCriticalLoading(false);
      setConfirmCloseOpen(false);
    }
  };

  const handleReopenTable = async () => {
    if (!tableId) {
      return;
    }

    setCriticalLoading(true);

    try {
      const updated = await reopenTableRequest(tableId);
      setTable(updated);
      addToast('Mesa reaberta.', 'success');
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Nao foi possivel reabrir a mesa.');
      setError(message);
      addToast(message, 'error');
    } finally {
      setCriticalLoading(false);
      setConfirmReopenOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-modern settings-loading-shell d-grid gap-3">
        <div className="settings-hero settings-loading-block" />
        <div className="card p-3 d-grid gap-2 settings-loading-block">
          <div className="settings-loading-line" />
          <div className="settings-loading-line" />
          <div className="settings-loading-line" />
          <div className="settings-loading-line" />
          <div className="settings-loading-line short" />
        </div>
        <div className="card p-3 settings-loading-block" />
      </div>
    );
  }

  if (!table) {
    return <div className="alert alert-danger">{error ?? 'Mesa nao encontrada.'}</div>;
  }

  return (
    <div className="settings-modern d-grid gap-3">
      <div className="settings-hero d-flex justify-content-between align-items-center">
        <div>
          <h2 className="h4 mb-1 d-inline-flex align-items-center gap-2">
            <Settings2 size={18} />
            Configuracoes da mesa
          </h2>
          <p className="text-secondary mb-0">Edite dados e gerencie o status.</p>
        </div>
        <Link to={`/app/tables/${table.id}`} className="btn btn-outline-secondary btn-modern-outline">
          <ArrowLeft size={14} />
          Voltar para detalhe
        </Link>
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}

      <form onSubmit={handleSave} className="card p-3 d-grid gap-3 settings-shell">
        <div>
          <label htmlFor="settings-name" className="form-label d-inline-flex align-items-center gap-2">
            <Coins size={14} />
            Nome
          </label>
          <input
            id="settings-name"
            className="form-control"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="settings-blinds" className="form-label">
            Blinds
          </label>
          <input
            id="settings-blinds"
            className="form-control"
            value={blinds}
            onChange={(event) => setBlinds(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="settings-currency" className="form-label">
            Moeda
          </label>
          <input
            id="settings-currency"
            className="form-control"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            required
          />
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label">Valor da ficha (R$)</label>
            <input
              className="form-control"
              value={valorFichaReais}
              onChange={(event) => setValorFichaReais(event.target.value)}
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Buy-in minimo (R$)</label>
            <input
              className="form-control"
              value={buyInMinimoReais}
              onChange={(event) => setBuyInMinimoReais(event.target.value)}
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Buy-in maximo (R$)</label>
            <input
              className="form-control"
              value={buyInMaximoReais}
              onChange={(event) => setBuyInMaximoReais(event.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <div className="row g-3 align-items-end">
          <div className="col-12 col-md-6 form-check ms-2">
            <input
              id="settings-allow-rebuy"
              className="form-check-input"
              type="checkbox"
              checked={permitirRebuy}
              onChange={(event) => setPermitirRebuy(event.target.checked)}
            />
            <label htmlFor="settings-allow-rebuy" className="form-check-label">Permitir rebuy</label>
          </div>
          <div className="col-12 col-md-5">
            <label className="form-label">Limite de rebuys</label>
            <input
              className="form-control"
              type="number"
              min={0}
              value={limiteRebuys}
              onChange={(event) => setLimiteRebuys(event.target.value)}
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-modern-primary" disabled={saving}>
          <Save size={14} />
          {saving ? 'Salvando...' : 'Salvar alteracoes'}
        </button>
      </form>

      <div className="card p-3 d-grid gap-2 settings-critical">
        <h3 className="h6 mb-0 d-inline-flex align-items-center gap-2">
          <ShieldAlert size={16} />
          Acoes criticas
        </h3>
        <p className="text-secondary mb-2">Confirme antes de alterar o status da mesa.</p>

        {table.status === 'OPEN' ? (
          <button type="button" className="btn btn-danger btn-modern-outline" onClick={() => setConfirmCloseOpen(true)}>
            <Lock size={14} />
            Encerrar mesa
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-modern-primary" onClick={() => setConfirmReopenOpen(true)}>
            <Unlock size={14} />
            Reabrir mesa
          </button>
        )}
      </div>

      <ConfirmModal
        title="Encerrar mesa"
        description="Esta acao bloqueia novas transacoes e algumas acoes de jogador. Deseja continuar?"
        confirmLabel="Encerrar"
        confirmVariant="danger"
        isOpen={confirmCloseOpen}
        onCancel={() => setConfirmCloseOpen(false)}
        onConfirm={handleCloseTable}
        isLoading={criticalLoading}
      />

      <ConfirmModal
        title="Reabrir mesa"
        description="A mesa voltara a aceitar transacoes e reativacao de jogadores."
        confirmLabel="Reabrir"
        isOpen={confirmReopenOpen}
        onCancel={() => setConfirmReopenOpen(false)}
        onConfirm={handleReopenTable}
        isLoading={criticalLoading}
      />
    </div>
  );
}
