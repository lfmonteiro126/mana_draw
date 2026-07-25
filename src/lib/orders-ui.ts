export const orderStatusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado"
};

export const orderStatusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  shipped: "bg-sky-50 text-sky-800 border-sky-200",
  delivered: "bg-teal-50 text-teal-800 border-teal-200",
  cancelled: "bg-rose-50 text-rose-800 border-rose-200"
};

export const orderStatusSteps = ["pending", "paid", "shipped", "delivered"] as const;

export function formatOrderDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatPostalCode(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function paymentLabel(provider?: string | null, status?: string | null) {
  if (!provider && !status) return null;
  const providerName =
    provider === "mercadopago" ? "Mercado Pago" : provider ? provider : "Pagamento";
  if (!status) return providerName;
  const statusMap: Record<string, string> = {
    approved: "aprovado",
    pending: "pendente",
    in_process: "em análise",
    rejected: "recusado",
    cancelled: "cancelado",
    refunded: "estornado"
  };
  return `${providerName} · ${statusMap[status] ?? status}`;
}
