export function formatCurrency(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valueInCents / 100);
}

export function formatStock(stock: number) {
  if (stock === 1) return "1 disponivel";
  return `${stock} disponiveis`;
}
