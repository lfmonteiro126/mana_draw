"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/actions";

const initial = { ok: false, message: "" };

export function ResendVerificationButton() {
  const [state, action, pending] = useActionState(resendVerificationAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-amber-900 px-4 text-sm font-semibold text-amber-50 disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Reenviar verificação"}
      </button>
      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-amber-900" : "text-red-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
