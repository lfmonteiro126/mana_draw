import "server-only";

import { cookies } from "next/headers";
import { createHmac, createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { getSql, hasDatabase, mapUser } from "./db";
import type { StoreUser, UserRole } from "./types";

const sessionCookie = "mana_draw_session";
const demoCookie = "mana_draw_demo_user";
const DEMO_ADMIN_EMAIL = "admin@manadraw.local";

type DbSessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Demo auth only in development, or when explicitly enabled (never trust unsigned cookies). */
export function allowDemoAuth() {
  if (hasDatabase()) return false;
  if (process.env.ALLOW_DEMO_AUTH === "true") return true;
  return !isProduction();
}

function cookieSecure() {
  return isProduction() || process.env.FORCE_SECURE_COOKIES === "true";
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure: cookieSecure()
  };
}

function demoSigningSecret() {
  return (
    process.env.DEMO_AUTH_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    (isProduction() ? "" : "mana-draw-dev-demo-secret")
  );
}

function signDemoPayload(payload: string) {
  const secret = demoSigningSecret();
  if (!secret) throw new Error("DEMO_AUTH_SECRET obrigatorio para auth demo.");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyDemoCookie(raw: string): StoreUser | null {
  const secret = demoSigningSecret();
  if (!secret) return null;

  const lastDot = raw.lastIndexOf(".");
  if (lastDot <= 0) return null;

  const payload = raw.slice(0, lastDot);
  const sig = raw.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StoreUser;
    if (!user?.id || !user?.email || (user.role !== "admin" && user.role !== "customer")) {
      return null;
    }
    // Never honor a forged role: recompute from email for demo.
    return demoUserFor(user.email, user.name || "Cliente");
  } catch {
    return null;
  }
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function currentUser(): Promise<StoreUser | null> {
  const cookieStore = await cookies();

  if (!hasDatabase()) {
    if (!allowDemoAuth()) return null;
    const demo = cookieStore.get(demoCookie)?.value;
    if (!demo) return null;
    return verifyDemoCookie(demo);
  }

  const token = cookieStore.get(sessionCookie)?.value;
  if (!token) return null;

  const sql = getSql();
  if (!sql) return null;

  const tokenHash = hashSessionToken(token);
  const rows = await sql`
    select users.id, users.name, users.email, users.role
    from sessions
    join users on users.id = sessions.user_id
    where (sessions.token = ${tokenHash} or sessions.token = ${token})
      and sessions.expires_at > now()
    limit 1
  `;

  const [user] = rows as DbSessionUser[];
  return user ? mapUser(user) : null;
}

export async function signOut() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;

  if (token && hasDatabase()) {
    const sql = getSql();
    if (sql) {
      const tokenHash = hashSessionToken(token);
      await sql`delete from sessions where token = ${tokenHash} or token = ${token}`;
    }
  }

  cookieStore.delete(sessionCookie);
  cookieStore.delete(demoCookie);
}

export async function createSession(user: StoreUser) {
  const cookieStore = await cookies();

  if (!hasDatabase()) {
    if (!allowDemoAuth()) {
      throw new Error("Auth demo desabilitada sem DATABASE_URL em producao.");
    }
    const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
    cookieStore.set(demoCookie, signDemoPayload(payload), sessionCookieOptions(60 * 60 * 24 * 14));
    return;
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const sql = getSql();
  if (sql) {
    await sql`
      insert into sessions (token, user_id, expires_at)
      values (${tokenHash}, ${user.id}, now() + interval '14 days')
    `;
  }

  cookieStore.set(sessionCookie, token, sessionCookieOptions(60 * 60 * 24 * 14));
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const candidate = pbkdf2Sync(password, salt, 120000, 32, "sha256");
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

export function demoUserFor(email: string, name = "Cliente") {
  const normalized = email.trim().toLowerCase();
  const isDemoAdmin = normalized === DEMO_ADMIN_EMAIL;
  return {
    id: isDemoAdmin ? "demo-admin" : "demo-customer",
    name: isDemoAdmin ? "Admin Demo" : name,
    email: normalized,
    role: isDemoAdmin ? "admin" : "customer"
  } satisfies StoreUser;
}

export const DEMO_ADMIN = {
  email: DEMO_ADMIN_EMAIL,
  password: "admin123"
} as const;
