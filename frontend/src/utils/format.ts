export const formatCurrencyFromCents = (
  cents: number,
  currency: string | null | undefined,
  locale = 'pt-BR',
) => {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  const normalizedCurrency = (currency ?? '').trim().toUpperCase();
  const hasValidCurrencyCode = /^[A-Z]{3}$/.test(normalizedCurrency);

  // Prefer currency format when an ISO code is available, otherwise fallback to decimal.
  if (hasValidCurrencyCode) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: 2,
      }).format(safeCents / 100);
    } catch {
      // Falls back below if the runtime rejects the provided code.
    }
  }

  return new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeCents / 100);
};

export const formatDateTime = (isoDate: string | Date | null | undefined, locale = 'pt-BR') => {
  if (!isoDate) {
    return '-';
  }

  const date = isoDate instanceof Date ? isoDate : new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};
