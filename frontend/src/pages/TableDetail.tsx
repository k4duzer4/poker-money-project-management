import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Coins,
  DollarSign,
  LogOut,
  RotateCw,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';

import { getApiErrorMessage } from '../services/errors';
import {
  cashoutPlayerRequest,
  createPlayerRequest,
  listPlayersRequest,
  rebuyPlayerRequest,
} from '../services/players';
import {
  closeTableRequest,
  getTableRequest,
  reopenTableRequest,
} from '../services/tables';
import { useUIStore } from '../stores/uiStore';
import type { Player, TableDetailResponse } from '../types/domain';
import { formatCurrencyFromCents, formatDateTime } from '../utils/format';

const parseCurrencyToCents = (value: string, options?: { allowZero?: boolean }) => {
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

  const allowZero = options?.allowZero ?? false;
  const minAllowed = allowZero ? 0 : Number.EPSILON;

  if (Number.isNaN(amount) || amount < minAllowed) {
    return Number.NaN;
  }

  return Math.round(amount * 100);
};

type TxModalState = {
  open: boolean;
  playerId: string;
  amountReais: string;
  error: string | null;
};

const defaultTxModalState: TxModalState = {
  open: false,
  playerId: '',
  amountReais: '',
  error: null,
};

const formatCentsToInputReais = (cents: number) => {
  return (cents / 100).toFixed(2).replace('.', ',');
};

export default function TableDetail() {
  const { tableId } = useParams<{ tableId: string }>();
  const addToast = useUIStore((state) => state.addToast);

  const [detail, setDetail] = useState<TableDetailResponse | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerBuyInReais, setAddPlayerBuyInReais] = useState('');
  const [addPlayerLoading, setAddPlayerLoading] = useState(false);

  const [rebuyModal, setRebuyModal] = useState<TxModalState>(defaultTxModalState);
  const [cashoutModal, setCashoutModal] = useState<TxModalState>(defaultTxModalState);
  const [txSubmitting, setTxSubmitting] = useState(false);

  const loadDetail = async (showSpinner = true) => {
    if (!tableId) {
      setError('Mesa invalida.');
      setLoading(false);
      return;
    }

    if (showSpinner) {
      setLoading(true);
    }

    try {
      setError(null);
      const [tableResponse, playersResponse] = await Promise.all([
        getTableRequest(tableId),
        listPlayersRequest(tableId),
      ]);

      setDetail(tableResponse);
      setPlayers(playersResponse);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Nao foi possivel carregar a mesa.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const summaryByPlayer = useMemo(() => {
    const map = new Map<string, {
      buyInInicialCents: number;
      totalInvestidoCents: number;
      valorFinalCents: number | null;
      resultadoCents: number | null;
      rebuysCount: number;
    }>();

    (detail?.summary.players ?? []).forEach((item) => {
      map.set(item.playerId, {
        buyInInicialCents: item.buyInInicialCents,
        totalInvestidoCents: item.totalInvestidoCents,
        valorFinalCents: item.valorFinalCents,
        resultadoCents: item.resultadoCents,
        rebuysCount: item.rebuysCount,
      });
    });

    return map;
  }, [detail]);

  const activePlayers = useMemo(
    () => players.filter((player) => player.status === 'ACTIVE'),
    [players],
  );

  const cashoutPlayers = useMemo(
    () => players.filter((player) => player.status === 'CASHOUT'),
    [players],
  );

  const totals = useMemo(() => {
    const totalInvestedCents = detail?.summary.totalInvestidoCents ?? 0;
    const totalCashOutCents = detail?.summary.totalFinalCents ?? 0;
    const summaryOnTableCents = detail?.summary.totalMesaCents ?? 0;
    const fallbackActiveOnTableCents = (detail?.summary.players ?? [])
      .filter((player) => player.status === 'ACTIVE')
      .reduce((acc, player) => acc + player.totalInvestidoCents, 0);
    const onTableCents = summaryOnTableCents > 0 ? summaryOnTableCents : fallbackActiveOnTableCents;

    return {
      totalInvestedCents,
      totalCashOutCents,
      onTableCents,
    };
  }, [detail]);

  const getPlayerById = (playerId: string) => {
    return players.find((player) => player.id === playerId) ?? null;
  };

  const getRebuyCount = (playerId: string) => {
    return summaryByPlayer.get(playerId)?.rebuysCount ?? 0;
  };

  const openAddPlayerModal = () => {
    const defaultBuyIn = detail?.table.buyInMinimoCents ?? 0;
    setAddPlayerName('');
    setAddPlayerBuyInReais(formatCentsToInputReais(defaultBuyIn));
    setAddPlayerOpen(true);
  };

  const openRebuyModal = (playerId: string) => {
    setRebuyModal({
      open: true,
      playerId,
      amountReais: '50',
      error: null,
    });
  };

  const openCashoutModal = (playerId: string) => {
    setCashoutModal({
      open: true,
      playerId,
      amountReais: '',
      error: null,
    });
  };

  const closeRebuyModal = () => setRebuyModal(defaultTxModalState);
  const closeCashoutModal = () => setCashoutModal(defaultTxModalState);

  const handleAddPlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tableId) {
      return;
    }

    const buyInCents = parseCurrencyToCents(addPlayerBuyInReais);
    if (Number.isNaN(buyInCents)) {
      addToast('Informe um buy-in inicial valido.', 'error');
      return;
    }

    const buyInMinimoCents = detail?.table.buyInMinimoCents ?? 0;
    const finalBuyInCents = Math.max(buyInCents, buyInMinimoCents);

    setAddPlayerLoading(true);

    try {
      if (finalBuyInCents !== buyInCents) {
        addToast(
          `Buy-in ajustado para o minimo da mesa: ${formatCurrencyFromCents(buyInMinimoCents, detail?.table.currency ?? 'BRL')}.`,
          'info',
        );
      }

      const createdPlayer = await createPlayerRequest(tableId, addPlayerName, finalBuyInCents);

      setPlayers((current) => {
        if (current.some((player) => player.id === createdPlayer.id)) {
          return current;
        }
        return [...current, createdPlayer];
      });

      setAddPlayerName('');
      setAddPlayerBuyInReais('');
      setAddPlayerOpen(false);
      addToast('Jogador adicionado.', 'success');
      await loadDetail(false);
    } catch (requestError) {
      const message = getApiErrorMessage(requestError, 'Nao foi possivel adicionar jogador.');
      addToast(message, 'error');

      if (message.toLowerCase().includes('mesa encerrada')) {
        await loadDetail(false);
      }
    } finally {
      setAddPlayerLoading(false);
    }
  };

  const handleRebuySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tableId || !rebuyModal.playerId) {
      return;
    }

    const amountCents = parseCurrencyToCents(rebuyModal.amountReais);
    if (Number.isNaN(amountCents)) {
      setRebuyModal((current) => ({ ...current, error: 'Informe um valor de rebuy valido.' }));
      return;
    }

    setTxSubmitting(true);

    try {
      await rebuyPlayerRequest(rebuyModal.playerId, amountCents);
      addToast('Rebuy confirmado.', 'success');
      closeRebuyModal();
      await loadDetail(false);
    } catch (requestError) {
      setRebuyModal((current) => ({
        ...current,
        error: getApiErrorMessage(requestError, 'Nao foi possivel confirmar o rebuy.'),
      }));
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleCashoutSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!tableId || !cashoutModal.playerId) {
      return;
    }

    const amountCents = parseCurrencyToCents(cashoutModal.amountReais, { allowZero: true });
    if (Number.isNaN(amountCents)) {
      setCashoutModal((current) => ({ ...current, error: 'Informe um valor final valido.' }));
      return;
    }

    setTxSubmitting(true);

    try {
      await cashoutPlayerRequest(cashoutModal.playerId, amountCents);
      addToast('Cash out confirmado.', 'success');
      closeCashoutModal();
      await loadDetail(false);
    } catch (requestError) {
      setCashoutModal((current) => ({
        ...current,
        error: getApiErrorMessage(requestError, 'Nao foi possivel confirmar o cash out.'),
      }));
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleTableStatus = async (nextAction: 'close' | 'reopen') => {
    if (!tableId) {
      return;
    }

    try {
      if (nextAction === 'close') {
        await closeTableRequest(tableId);
        addToast('Mesa encerrada.', 'success');
      } else {
        await reopenTableRequest(tableId);
        addToast('Mesa reaberta.', 'success');
      }
      await loadDetail(false);
    } catch (requestError) {
      addToast(getApiErrorMessage(requestError, 'Nao foi possivel atualizar o status da mesa.'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="mesa-modern mesa-loading-shell d-grid gap-3" aria-label="Carregando detalhe da mesa">
        <div className="card p-3 mesa-loading-block" />

        <section className="mesa-top-cards">
          <article className="mesa-stat-card mesa-loading-block" />
          <article className="mesa-stat-card mesa-loading-block" />
          <article className="mesa-stat-card mesa-loading-block" />
          <article className="mesa-stat-card mesa-loading-block" />
        </section>

        <section className="mesa-main-grid">
          <div className="card p-3 d-grid gap-2">
            <div className="mesa-loading-line" />
            <div className="mesa-loading-line" />
            <div className="mesa-loading-line" />
            <div className="mesa-loading-line short" />
          </div>
          <aside className="card p-3 d-grid gap-2">
            <div className="mesa-loading-line" />
            <div className="mesa-loading-line" />
            <div className="mesa-loading-line short" />
          </aside>
        </section>
      </div>
    );
  }

  if (!detail) {
    return <div className="alert alert-danger">{error ?? 'Mesa nao encontrada.'}</div>;
  }

  return (
    <div className="mesa-modern d-grid gap-3">
      {error && <div className="alert alert-danger mb-0">{error}</div>}

      <header className="mesa-modern-header card p-3 sticky-top mesa-sticky-header">
        <div className="mesa-header-left">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Link to="/app/tables" className="mesa-back-link" aria-label="Voltar para mesas">
              <ArrowLeft size={16} />
            </Link>
            <h2 className="h4 mb-0 mesa-title">{detail.table.name}</h2>
            <span className={`badge ${detail.table.status === 'OPEN' ? 'text-bg-success' : 'text-bg-secondary'}`}>
              {detail.table.status === 'OPEN' ? 'Ativa' : 'Fechada'}
            </span>
          </div>
          <p className="text-secondary mb-0 mt-1">Criada em {formatDateTime(detail.table.createdAt)}</p>
        </div>

        <div className="d-flex gap-2 flex-wrap mesa-header-actions">
          <button
            type="button"
            className="btn btn-primary btn-modern-primary"
            onClick={openAddPlayerModal}
            disabled={detail.table.status !== 'OPEN'}
          >
            <UserPlus size={15} />
            Adicionar Jogador
          </button>
          <Link to={`/app/tables/${detail.table.id}/settings`} className="btn btn-outline-secondary btn-modern-outline">
            <Settings size={14} />
            Configurar
          </Link>
        </div>
      </header>

      <section className="mesa-top-cards">
        <article className="mesa-stat-card">
          <p><Users size={14} /> Jogadores</p>
          <strong>{detail.summary.totalPlayers}</strong>
        </article>
        <article className="mesa-stat-card">
          <p><DollarSign size={14} /> Na Mesa</p>
          <strong>{formatCurrencyFromCents(totals.onTableCents, detail.table.currency)}</strong>
        </article>
        <article className="mesa-stat-card">
          <p><Settings size={14} /> Buy-in min</p>
          <strong>{formatCurrencyFromCents(detail.table.buyInMinimoCents, detail.table.currency)}</strong>
        </article>
        <article className="mesa-stat-card">
          <p><Coins size={14} /> Ficha</p>
          <strong>{formatCurrencyFromCents(detail.table.valorFichaCents, detail.table.currency)}</strong>
        </article>
      </section>

      <section className="mesa-main-grid">
        <div className="mesa-players-block card p-3">
          <h3 className="h5 mesa-section-title">Jogadores Ativos ({activePlayers.length})</h3>

          {activePlayers.length === 0 ? (
            <div className="alert alert-info mb-0">Nenhum jogador ativo no momento.</div>
          ) : (
            <div className="d-grid gap-2">
              {activePlayers.map((player) => {
                const summary = summaryByPlayer.get(player.id);
                const playerName = (player.name ?? '').trim() || 'Sem nome';
                const playerInitial = playerName.charAt(0).toUpperCase();

                return (
                  <article key={player.id} className="mesa-player-row">
                    <div className="player-avatar">{playerInitial}</div>
                    <div className="player-main">
                      <strong>{playerName}</strong>
                      <span>
                        Buy-in: {formatCurrencyFromCents(summary?.buyInInicialCents ?? 0, detail.table.currency)}
                        {(summary?.rebuysCount ?? 0) > 0 ? (
                          <span className="rebuy-count-highlight"> +{summary?.rebuysCount} rebuy{summary?.rebuysCount === 1 ? '' : 's'}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="player-amount">
                      <small>Investido</small>
                      <strong>{formatCurrencyFromCents(summary?.totalInvestidoCents ?? 0, detail.table.currency)}</strong>
                    </div>
                    <div className="player-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary btn-modern-outline"
                        onClick={() => openRebuyModal(player.id)}
                        disabled={detail.table.status !== 'OPEN'}
                      >
                        <RotateCw size={13} />
                        Rebuy
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary btn-modern-primary"
                        onClick={() => openCashoutModal(player.id)}
                        disabled={detail.table.status !== 'OPEN'}
                      >
                        <LogOut size={13} />
                        Cash Out
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {cashoutPlayers.length > 0 && (
            <>
              <hr className="my-3" />
              <h3 className="h6 mesa-section-title text-secondary mb-2">Cash Out ({cashoutPlayers.length})</h3>
              <div className="d-grid gap-2">
                {cashoutPlayers.map((player) => {
                  const summary = summaryByPlayer.get(player.id);
                  const playerName = (player.name ?? '').trim() || 'Sem nome';
                  const playerInitial = playerName.charAt(0).toUpperCase();

                  return (
                    <article key={player.id} className="mesa-player-row cashout-row">
                      <div className="player-avatar bg-secondary-subtle text-secondary-emphasis">
                        {playerInitial}
                      </div>
                      <div className="player-main">
                        <strong>{playerName}</strong>
                        <span>
                          Buy-in: {formatCurrencyFromCents(summary?.buyInInicialCents ?? 0, detail.table.currency)}
                          {(summary?.rebuysCount ?? 0) > 0 ? (
                            <span className="rebuy-count-highlight"> +{summary?.rebuysCount} rebuy{summary?.rebuysCount === 1 ? '' : 's'}</span>
                          ) : null}
                        </span>
                      </div>
                      <div className="player-amount">
                        <small>Cash Out</small>
                        <strong>{formatCurrencyFromCents(summary?.valorFinalCents ?? 0, detail.table.currency)}</strong>
                      </div>
                      <div className="player-actions">
                        <span className="badge text-bg-secondary">Finalizado</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {players.length === 0 && (
            <div className="mesa-empty-state mt-3">
              <Users size={28} />
              <h4>Nenhum jogador ainda</h4>
              <p>Adicione jogadores para iniciar a mesa.</p>
              {detail.table.status === 'OPEN' && (
                <button type="button" className="btn btn-primary btn-modern-primary" onClick={openAddPlayerModal}>
                  <UserPlus size={15} />
                  Adicionar Jogador
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="mesa-close-block card p-3">
          <h3 className="h5 d-inline-flex align-items-center gap-2 mb-2">
            <AlertTriangle size={16} />
            Fechamento da Mesa
          </h3>

          {detail.closure.hasActivePlayers ? (
            <div className="mesa-warning-box">
              {activePlayers.length} jogador(es) ainda na mesa. Todos precisam fazer cash out para fechar.
            </div>
          ) : (
            <div className="alert alert-success mb-2">Nenhum jogador ativo. Mesa pronta para encerramento.</div>
          )}

          <div className="mesa-close-totals">
            <div>
              <span>Total Investido</span>
              <strong>{formatCurrencyFromCents(totals.totalInvestedCents, detail.table.currency)}</strong>
            </div>
            <div>
              <span>Total Cash Out</span>
              <strong>{formatCurrencyFromCents(totals.totalCashOutCents, detail.table.currency)}</strong>
            </div>
          </div>

          {detail.table.status === 'OPEN' ? (
            <button
              type="button"
              className="btn btn-danger w-100 mt-2"
              onClick={() => handleTableStatus('close')}
              disabled={!detail.closure.canClose}
            >
              Encerrar Mesa
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-100 mt-2"
              onClick={() => handleTableStatus('reopen')}
            >
              Reabrir Mesa
            </button>
          )}
        </aside>
      </section>

      {addPlayerOpen && (
        <>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" style={{ pointerEvents: 'auto' }}>
              <div className="modal-content chipz-modal">
                <form onSubmit={handleAddPlayer}>
                  <div className="modal-header">
                    <h5 className="modal-title d-inline-flex align-items-center gap-2">
                      <UserPlus size={16} />
                      Adicionar Jogador
                    </h5>
                    <button type="button" className="btn-close" onClick={() => setAddPlayerOpen(false)} />
                  </div>
                  <div className="modal-body d-grid gap-3">
                    <label className="form-label">Nome</label>
                    <input
                      className="form-control"
                      value={addPlayerName}
                      onChange={(event) => setAddPlayerName(event.target.value)}
                      placeholder="Ex.: Carlos"
                      required
                    />

                    <div className="chipz-modal-info">
                      <div>
                        <span>Buy-in minimo:</span>
                        <strong>{formatCurrencyFromCents(detail.table.buyInMinimoCents, detail.table.currency)}</strong>
                      </div>
                      <div>
                        <span>Valor da ficha:</span>
                        <strong>{formatCurrencyFromCents(detail.table.valorFichaCents, detail.table.currency)}</strong>
                      </div>
                    </div>

                    <div>
                      <label className="form-label mb-1">Buy-in inicial (R$)</label>
                      <input
                        className="form-control"
                        type="text"
                        inputMode="decimal"
                        value={addPlayerBuyInReais}
                        onChange={(event) => setAddPlayerBuyInReais(event.target.value)}
                        required
                      />
                      <small className="text-secondary">
                        Fichas estimadas:{' '}
                        {Math.floor(
                          (Number.isNaN(parseCurrencyToCents(addPlayerBuyInReais)) ? 0 : parseCurrencyToCents(addPlayerBuyInReais)) /
                            Math.max(1, detail.table.valorFichaCents),
                        )}
                      </small>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => setAddPlayerOpen(false)}>
                      Cancelar
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={addPlayerLoading}>
                      {addPlayerLoading ? 'Adicionando...' : 'Adicionar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1055 }} onClick={() => setAddPlayerOpen(false)} />
        </>
      )}

      {rebuyModal.open && (
        <>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" style={{ pointerEvents: 'auto' }}>
              <div className="modal-content chipz-modal">
                <form onSubmit={handleRebuySubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title d-inline-flex align-items-center gap-2">
                      <RotateCw size={16} />
                      Rebuy - {getPlayerById(rebuyModal.playerId)?.name ?? 'Jogador'}
                    </h5>
                    <button type="button" className="btn-close" onClick={closeRebuyModal} />
                  </div>

                  <div className="modal-body d-grid gap-2">
                    {rebuyModal.error && <div className="alert alert-danger mb-1">{rebuyModal.error}</div>}

                    <div className="chipz-modal-info">
                      <div>
                        <span>Investido ate agora:</span>
                        <strong>{formatCurrencyFromCents(summaryByPlayer.get(rebuyModal.playerId)?.totalInvestidoCents ?? 0, detail.table.currency)}</strong>
                      </div>
                      <div>
                        <span>Rebuys realizados:</span>
                        <strong>{getRebuyCount(rebuyModal.playerId)}</strong>
                      </div>
                    </div>

                    <label className="form-label mb-0">Valor do Rebuy (R$)</label>
                    <input
                      className="form-control"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex.: 50"
                      value={rebuyModal.amountReais}
                      onChange={(event) => setRebuyModal((current) => ({ ...current, amountReais: event.target.value, error: null }))}
                      required
                    />
                    <small className="text-secondary text-center">Digite qualquer valor desejado.</small>

                    <div className="chipz-modal-highlight warning">
                      Novo total investido:{' '}
                      {formatCurrencyFromCents(
                        (summaryByPlayer.get(rebuyModal.playerId)?.totalInvestidoCents ?? 0) +
                          (Number.isNaN(parseCurrencyToCents(rebuyModal.amountReais)) ? 0 : parseCurrencyToCents(rebuyModal.amountReais)),
                        detail.table.currency,
                      )}
                    </div>
                  </div>

                  <div className="modal-footer d-grid">
                    <button type="submit" className="btn btn-warning w-100" disabled={txSubmitting}>
                      {txSubmitting ? 'Confirmando...' : 'Confirmar Rebuy'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1055 }} onClick={closeRebuyModal} />
        </>
      )}

      {cashoutModal.open && (
        <>
          <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" style={{ pointerEvents: 'auto' }}>
              <div className="modal-content chipz-modal">
                <form onSubmit={handleCashoutSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title d-inline-flex align-items-center gap-2">
                      <LogOut size={16} />
                      Cash Out - {getPlayerById(cashoutModal.playerId)?.name ?? 'Jogador'}
                    </h5>
                    <button type="button" className="btn-close" onClick={closeCashoutModal} />
                  </div>

                  <div className="modal-body d-grid gap-2">
                    {cashoutModal.error && <div className="alert alert-danger mb-1">{cashoutModal.error}</div>}

                    <div className="chipz-modal-info">
                      <div>
                        <span>Total investido:</span>
                        <strong>{formatCurrencyFromCents(summaryByPlayer.get(cashoutModal.playerId)?.totalInvestidoCents ?? 0, detail.table.currency)}</strong>
                      </div>
                      <div>
                        <span>Resultado atual:</span>
                        <strong>{formatCurrencyFromCents(summaryByPlayer.get(cashoutModal.playerId)?.resultadoCents ?? 0, detail.table.currency)}</strong>
                      </div>
                    </div>

                    <div className="chipz-modal-highlight info">
                      Total na mesa (fichas): {formatCurrencyFromCents(totals.onTableCents, detail.table.currency)}
                    </div>

                    <label className="form-label mb-0">Valor Final em Fichas (R$)</label>
                    <input
                      className="form-control"
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex.: 120"
                      value={cashoutModal.amountReais}
                      onChange={(event) => setCashoutModal((current) => ({ ...current, amountReais: event.target.value, error: null }))}
                      required
                    />
                  </div>

                  <div className="modal-footer d-grid">
                    <button type="submit" className="btn btn-success w-100" disabled={txSubmitting}>
                      {txSubmitting ? 'Confirmando...' : 'Confirmar Cash Out'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" style={{ zIndex: 1055 }} onClick={closeCashoutModal} />
        </>
      )}
    </div>
  );
}
