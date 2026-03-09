import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, CornerRightUp, DollarSign, Plus, Sparkles } from 'lucide-react';

import { getApiErrorMessage } from '../services/errors';
import { createTableRequest } from '../services/tables';
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

export default function NewTable() {
  const navigate = useNavigate();
  const addToast = useUIStore((state) => state.addToast);

  const [name, setName] = useState('');
  const [blinds, setBlinds] = useState('1/2');
  const [currency, setCurrency] = useState('BRL');
  const [valorFichaReais, setValorFichaReais] = useState('1');
  const [buyInMinimoReais, setBuyInMinimoReais] = useState('50');
  const [buyInMaximoReais, setBuyInMaximoReais] = useState('');
  const [permitirRebuy, setPermitirRebuy] = useState(true);
  const [limiteRebuys, setLimiteRebuys] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);
    setError(null);

    try {
      const valorFichaCents = parseCurrencyToCents(valorFichaReais);
      const buyInMinimoCents = parseCurrencyToCents(buyInMinimoReais);
      const buyInMaximoCents = buyInMaximoReais.trim() ? parseCurrencyToCents(buyInMaximoReais) : undefined;

      if (Number.isNaN(valorFichaCents) || Number.isNaN(buyInMinimoCents) || Number.isNaN(Number(limiteRebuys))) {
        throw new Error('Preencha corretamente os campos financeiros.');
      }

      if (buyInMaximoCents !== undefined && Number.isNaN(buyInMaximoCents)) {
        throw new Error('Buy-in maximo invalido.');
      }

      const table = await createTableRequest({
        name,
        blinds,
        currency: currency.toUpperCase(),
        valorFichaCents,
        buyInMinimoCents,
        buyInMaximoCents,
        permitirRebuy,
        limiteRebuys: Number(limiteRebuys),
      });

      if (!table?.id) {
        throw new Error('A API nao retornou o id da mesa criada.');
      }

      addToast('Mesa criada com sucesso.', 'success');
      navigate(`/app/tables/${table.id}`);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Nao foi possivel criar a mesa.');
      setError(message);
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-modern d-grid gap-3">
      <div className="create-hero">
        <h2 className="h4 mb-1 d-inline-flex align-items-center gap-2">
          <Sparkles size={18} />
          Nova Mesa
        </h2>
        <p className="text-secondary mb-0">Configure os dados iniciais da mesa para comecar a rodada.</p>
      </div>

      {error && <div className="alert alert-danger mb-0">{error}</div>}

      <form onSubmit={handleSubmit} className="card p-3 d-grid gap-3 create-shell">
        <div>
          <label htmlFor="table-name" className="form-label d-inline-flex align-items-center gap-2">
            <CornerRightUp size={14} />
            Nome da mesa
          </label>
          <input
            id="table-name"
            className="form-control"
            placeholder="Ex.: Poker Night Sexta"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label htmlFor="table-blinds" className="form-label d-inline-flex align-items-center gap-2">
              <Coins size={14} />
              Blinds
            </label>
            <input
              id="table-blinds"
              className="form-control"
              value={blinds}
              placeholder="Ex.: 1/2"
              onChange={(event) => setBlinds(event.target.value)}
              required
            />
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="table-currency" className="form-label d-inline-flex align-items-center gap-2">
              <DollarSign size={14} />
              Moeda (codigo ISO)
            </label>
            <input
              id="table-currency"
              className="form-control"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              placeholder="BRL"
              required
            />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label">Valor da ficha (R$)</label>
            <input
              className="form-control"
              value={valorFichaReais}
              onChange={(event) => setValorFichaReais(event.target.value)}
              placeholder="Ex.: 1"
              required
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Buy-in minimo (R$)</label>
            <input
              className="form-control"
              value={buyInMinimoReais}
              onChange={(event) => setBuyInMinimoReais(event.target.value)}
              placeholder="Ex.: 50"
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
              id="allow-rebuy"
              className="form-check-input"
              type="checkbox"
              checked={permitirRebuy}
              onChange={(event) => setPermitirRebuy(event.target.checked)}
            />
            <label htmlFor="allow-rebuy" className="form-check-label">Permitir rebuy</label>
          </div>
          <div className="col-12 col-md-5">
            <label className="form-label">Limite de rebuys (0 = sem limite visual)</label>
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

        <div className="create-actions d-flex gap-2">
          <button type="submit" className="btn btn-primary btn-modern-primary" disabled={submitting}>
            <Plus size={14} />
            {submitting ? 'Criando...' : 'Criar mesa'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-modern-outline"
            onClick={() => navigate('/app/tables')}
            disabled={submitting}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
