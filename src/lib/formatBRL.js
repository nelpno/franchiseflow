const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompactFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const formatBRL = (value) => brlFormatter.format(value || 0);

export const formatBRLCompact = (value) => {
  if (Math.abs(value || 0) >= 1000) {
    return brlCompactFormatter.format(value);
  }
  return brlFormatter.format(value || 0);
};
