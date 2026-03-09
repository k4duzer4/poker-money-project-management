type SettlementInput = {
  name: string;
  resultadoCents: number;
};

type BalanceNode = {
  name: string;
  amountCents: number;
};

export type Transfer = {
  from: string;
  to: string;
  amountCents: number;
};

export const calculateTransfers = (items: SettlementInput[]) => {
  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  for (const item of items) {
    if (item.resultadoCents < 0) {
      debtors.push({ name: item.name, amountCents: Math.abs(item.resultadoCents) });
    } else if (item.resultadoCents > 0) {
      creditors.push({ name: item.name, amountCents: item.resultadoCents });
    }
  }

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const transferAmount = Math.min(debtor.amountCents, creditor.amountCents);

    transfers.push({
      from: debtor.name,
      to: creditor.name,
      amountCents: transferAmount,
    });

    debtor.amountCents -= transferAmount;
    creditor.amountCents -= transferAmount;

    if (debtor.amountCents === 0) {
      debtorIndex += 1;
    }

    if (creditor.amountCents === 0) {
      creditorIndex += 1;
    }
  }

  return transfers;
};

export const distributeDifferenceAmongWinners = (
  items: Array<{ id: string; resultadoCents: number; valorFinalCents: number }>,
  differenceCents: number,
) => {
  if (differenceCents <= 0) {
    return [] as Array<{ id: string; descontoCents: number; novoValorFinalCents: number; novoResultadoCents: number }>;
  }

  const winners = items.filter((item) => item.resultadoCents > 0);

  let baseItems = winners;
  let proportionalBase = winners.reduce((acc, item) => acc + item.resultadoCents, 0);

  // Fallback: quando nao ha ganhadores positivos, distribui proporcionalmente pelo valor final.
  // Isso evita travar fechamento em mesas onde todos tiveram resultado <= 0.
  if (baseItems.length === 0 || proportionalBase <= 0) {
    baseItems = items.filter((item) => item.valorFinalCents > 0);
    proportionalBase = baseItems.reduce((acc, item) => acc + item.valorFinalCents, 0);
  }

  if (baseItems.length === 0 || proportionalBase <= 0) {
    return [] as Array<{ id: string; descontoCents: number; novoValorFinalCents: number; novoResultadoCents: number }>;
  }

  const useProfitAsWeight = winners.length > 0;

  const adjustments = baseItems.map((item) => {
    const weight = useProfitAsWeight ? item.resultadoCents : item.valorFinalCents;
    const proportionalDiscount = Math.round((weight / proportionalBase) * differenceCents);
    const cappedDiscount = Math.min(proportionalDiscount, item.valorFinalCents);
    const novoValorFinalCents = item.valorFinalCents - cappedDiscount;
    const novoResultadoCents = item.resultadoCents - cappedDiscount;

    return {
      id: item.id,
      descontoCents: cappedDiscount,
      novoValorFinalCents,
      novoResultadoCents,
    };
  });

  const distributed = adjustments.reduce((acc, item) => acc + item.descontoCents, 0);
  let remainder = differenceCents - distributed;

  if (remainder > 0) {
    for (const adjustment of adjustments) {
      if (remainder <= 0) {
        break;
      }

      const available = adjustment.novoValorFinalCents;
      if (available <= 0) {
        continue;
      }

      const extra = Math.min(available, remainder);
      adjustment.descontoCents += extra;
      adjustment.novoValorFinalCents -= extra;
      adjustment.novoResultadoCents -= extra;
      remainder -= extra;
    }
  }

  if (remainder > 0) {
    return [] as Array<{ id: string; descontoCents: number; novoValorFinalCents: number; novoResultadoCents: number }>;
  }

  return adjustments;
};
