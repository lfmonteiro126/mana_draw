import "server-only";

import { cookies } from "next/headers";
import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { getSql, hasDatabase, mapUser } from "./db";
import type { StoreUser, UserRole } from "./types";

const sessionCookie = "nova_mana_session";
const demoCookie = "nova_mana_demo_user";

type DbSessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export async function currentUser(): Promise<StoreUser | null> {
  const cookieStore = await cookies();

  if (!hasDatabase()) {
    const demo = cookieStore.get(demoCookie)?.value;
    if (!demo) return null;

    try {
      return JSON.parse(Buffer.from(demo, "base64url").toString("utf8")) as StoreUser;
    } catch {
      return null;
    }
  }

  const token = cookieStore.get(sessionCookie)?.value;
  if (!token) return null;

  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    select users.id, users.name, users.email, users.role
    from sessions
    join users on users.id = sessions.user_id
    where sessions.token = ${token}
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
    if (sql) await sql`delete from sessions where token = ${token}`;
  }

  cookieStore.delete(sessionCookie);
  cookieStore.delete(demoCookie);
}

export async function createSession(user: StoreUser) {
  const cookieStore = await cookies();

  if (!hasDatabase()) {
    cookieStore.set(demoCookie, Buffer.from(JSON.stringify(user)).toString("base64url"), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14
    });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const sql = getSql();
  if (sql) {
    await sql`
      insert into sessions (token, user_id, expires_at)
      values (${token}, ${user.id}, now() + interval '14 days')
    `;
  }

  cookieStore.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });
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
  return {
    id: normalized === "admin@manadraw.local" ? "demo-admin" : "demo-customer",
    name,
    email: normalized,
    role: normalized === "admin@manadraw.local" ? "admin" : "customer"
  } satisfies StoreUser;
}
