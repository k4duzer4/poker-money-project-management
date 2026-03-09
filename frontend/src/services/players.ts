import api from './http';
import type { Player } from '../types/domain';

const normalizePlayerStatus = (status: unknown): 'ACTIVE' | 'CASHOUT' => {
  if (typeof status === 'string') {
    const normalized = status.toUpperCase();
    if (normalized === 'ACTIVE' || normalized === 'CASHOUT') {
      return normalized;
    }
    if (normalized === 'ATIVO') {
      return 'ACTIVE';
    }
  }

  return 'ACTIVE';
};

const normalizePlayer = <T extends { status?: unknown; name?: unknown }>(
  player: T,
): T & { status: 'ACTIVE' | 'CASHOUT'; name: string } => {
  const normalizedName = typeof player.name === 'string' && player.name.trim().length > 0
    ? player.name.trim()
    : 'Sem nome';

  return {
    ...player,
    name: normalizedName,
    status: normalizePlayerStatus(player.status),
  };
};

export const listPlayersRequest = async (tableId: string) => {
  const { data } = await api.get<{ players: Player[] }>(`/players/table/${tableId}`);
  return data.players.map((player) => normalizePlayer(player));
};

export const createPlayerRequest = async (tableId: string, name: string, buyInCents?: number) => {
  const payload = buyInCents ? { name, buyInCents } : { name };
  const { data } = await api.post<{ player: Player }>(`/players/table/${tableId}`, payload);
  return normalizePlayer(data.player);
};

export const rebuyPlayerRequest = async (playerId: string, amountCents: number) => {
  const { data } = await api.patch<{ player: Player }>(`/players/${playerId}/rebuy`, { amountCents });
  return normalizePlayer(data.player);
};

export const cashoutPlayerRequest = async (playerId: string, valorFinalCents: number) => {
  const { data } = await api.patch<{ player: Player }>(`/players/${playerId}/cashout`, { valorFinalCents });
  return normalizePlayer(data.player);
};

export const editCashoutPlayerRequest = async (playerId: string, valorFinalCents: number) => {
  const { data } = await api.patch<{ player: Player }>(`/players/${playerId}/cashout/edit`, { valorFinalCents });
  return normalizePlayer(data.player);
};

export const renamePlayerRequest = async (playerId: string, name: string) => {
  const { data } = await api.patch<{ player: Player }>(`/players/${playerId}`, { name });
  return normalizePlayer(data.player);
};

export const removePlayerRequest = async (playerId: string) => {
  await api.delete(`/players/${playerId}`);
};
