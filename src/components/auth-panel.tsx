"use client";

import { LogIn, UserPlus } from "lucide-react";
import { useEffect } from "react";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions";

const initialState = { ok: false, message: "" };

export function AuthPanel({ redirectTo }: { redirectTo?: string }) {
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialState
  );
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    initialState
  );

  useEffect(() => {
    if (loginState.ok || registerState.ok) {
      if (redirectTo) {
        window.location.assign(redirectTo);
        return;
      }

      window.location.reload();
    }
  }, [loginState.ok, redirectTo, registerState.ok]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form action={loginFormAction} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-4 flex items-center gap-2">
          <LogIn size={18} className="text-[var(--accent)]" />
          <h3 className="font-semibold text-[var(--ink)]">Entrar</h3>
        </div>
        <div className="grid gap-3">
          <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="email" placeholder="email@exemplo.com" type="email" required />
          <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="password" placeholder="Senha" type="password" required />
          <button className="h-11 rounded-md bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition active:scale-95 disabled:opacity-50" disabled={loginPending} type="submit">
            {loginPending ? "Entrando..." : "Entrar"}
          </button>
          {loginState.message && (
            <p className={`text-sm ${loginState.ok ? "text-[var(--accent-strong)]" : "text-rose-600"}`}>
              {loginState.message}
            </p>
          )}
        </div>
      </form>

      <form action={registerFormAction} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-[var(--accent)]" />
          <h3 className="font-semibold text-[var(--ink)]">Criar conta</h3>
        </div>
        <div className="grid gap-3">
          <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="name" placeholder="Nome" required />
          <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="email" placeholder="email@exemplo.com" type="email" required />
          <input className="h-11 rounded-md border border-[var(--line)] bg-[var(--surface-hover)]/40 px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" name="password" placeholder="Senha com 6+ caracteres" type="password" required />
          <button className="h-11 rounded-md bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent-strong)] transition active:scale-95 disabled:opacity-50" disabled={registerPending} type="submit">
            {registerPending ? "Criando..." : "Criar conta"}
          </button>
          {registerState.message && (
            <p className={`text-sm ${registerState.ok ? "text-[var(--accent-strong)]" : "text-rose-600"}`}>
              {registerState.message}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
