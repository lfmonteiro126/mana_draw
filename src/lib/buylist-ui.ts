export const buylistStatusLabels: Record<string, string> = {
  new: "Nova",
  reviewing: "Em análise",
  offered: "Oferta enviada",
  approved: "Oferta enviada",
  declined: "Recusada",
  awaiting_shipment: "Aguardando envio",
  in_transit: "Em trânsito",
  received: "Recebida",
  checking: "Em conferência",
  stocked: "No estoque",
  paid: "Paga",
  cancelled: "Cancelada"
};

export const buylistStatusStyles: Record<string, string> = {
  new: "bg-sky-50 text-sky-800 border-sky-200",
  reviewing: "bg-amber-50 text-amber-800 border-amber-200",
  offered: "bg-violet-50 text-violet-800 border-violet-200",
  approved: "bg-violet-50 text-violet-800 border-violet-200",
  declined: "bg-rose-50 text-rose-800 border-rose-200",
  awaiting_shipment: "bg-orange-50 text-orange-800 border-orange-200",
  in_transit: "bg-indigo-50 text-indigo-800 border-indigo-200",
  received: "bg-cyan-50 text-cyan-800 border-cyan-200",
  checking: "bg-yellow-50 text-yellow-900 border-yellow-200",
  stocked: "bg-emerald-50 text-emerald-800 border-emerald-200",
  paid: "bg-teal-50 text-teal-800 border-teal-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-200"
};

export const buylistStatusSteps = [
  "new",
  "reviewing",
  "offered",
  "awaiting_shipment",
  "in_transit",
  "received",
  "checking",
  "stocked",
  "paid"
] as const;

export const buylistAdminSelectableStatuses = [
  "new",
  "reviewing",
  "offered",
  "declined",
  "awaiting_shipment",
  "in_transit",
  "received",
  "checking",
  "stocked",
  "paid",
  "cancelled"
] as const;

export const buylistLineStatusLabels: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceita",
  rejected: "Rejeitada",
  adjusted: "Ajustada"
};

export const inboundMethodLabels: Record<string, string> = {
  mail: "Correios / transportadora",
  pickup: "Retirada na loja"
};
