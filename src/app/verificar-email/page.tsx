import Link from "next/link";
import { verifyEmailAction } from "@/app/actions";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const uid = typeof params.uid === "string" ? params.uid : "";
  const result = await verifyEmailAction(uid, token);

  return (
    <main className="min-h-screen px-4 py-16 text-[var(--ink)] sm:px-6">
      <section className="surface-card mx-auto max-w-lg p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Mana Draw</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {result.ok ? "E-mail verificado" : "Não foi possível verificar"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{result.message}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/conta"
            className="inline-flex h-11 items-center rounded-[var(--radius-control)] bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            Ir para a conta
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-[var(--radius-control)] border border-[var(--line)] px-4 text-sm font-semibold"
          >
            Voltar à loja
          </Link>
        </div>
      </section>
    </main>
  );
}
