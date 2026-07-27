export const buylistStatusLabels: Record<string, string> = {
  new: "Nova",
  reviewing: "Em análise",
  approved: "Aprovada",
  declined: "Recusada",
  paid: "Paga"
};

export const buylistStatusStyles: Record<string, string> = {
  new: "bg-sky-50 text-sky-800 border-sky-200",
  reviewing: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  declined: "bg-rose-50 text-rose-800 border-rose-200",
  paid: "bg-teal-50 text-teal-800 border-teal-200"
};

export const buylistStatusSteps = ["new", "reviewing", "approved", "declined", "paid"] as const;
