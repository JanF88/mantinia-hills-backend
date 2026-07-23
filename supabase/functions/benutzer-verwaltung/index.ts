// Nutzerverwaltung (nur eingeloggte Admins; verify_jwt=true).
// Alle Nutzer sind gleichberechtigte Admins — keine Rollen.
// Nutzt intern den Service-Role-Key (nur serverseitig verfügbar), um Auth-User
// aufzulisten, anzulegen und zu löschen. Der Browser sieht den Key nie.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function jwtAusRequest(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** Extrahiert die User-ID (sub) aus dem bereits vom Gateway geprüften JWT. */
function callerId(req: Request): string | null {
  const jwt = jwtAusRequest(req);
  const teile = jwt.split(".");
  if (teile.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(teile[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Prüft, dass der Aufrufer ein eingeloggter Admin ist. WICHTIG: verify_jwt=true
 * am Gateway lässt JEDES gültige Projekt-JWT durch — auch den öffentlichen
 * anon-Key (role="anon"), der im Website-Quelltext steht. Ohne diese Prüfung
 * könnte damit jeder Admins auflisten/anlegen/löschen. Daher hier zwingend
 * role="authenticated" verlangen und das Token gegen den Auth-Server verifizieren.
 */
async function istAdmin(
  supabase: ReturnType<typeof createClient>,
  req: Request,
): Promise<boolean> {
  const jwt = jwtAusRequest(req);
  if (!jwt) return false;
  const teile = jwt.split(".");
  if (teile.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(teile[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.role !== "authenticated") return false;
  } catch {
    return false;
  }
  // Gegenprüfung: Token muss zu einem echten, gültigen Nutzer gehören.
  const { data, error } = await supabase.auth.getUser(jwt);
  return !error && !!data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (!(await istAdmin(supabase, req))) {
    return json(403, { error: "Nicht autorisiert. Bitte als Admin einloggen." });
  }

  let body: { action?: string; email?: string; password?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "ungültiges JSON" });
  }

  if (body.action === "list") {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return json(500, { error: error.message });
    const users = data.users
      .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return json(200, { users });
  }

  if (body.action === "create") {
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "Bitte eine gültige E-Mail-Adresse eingeben." });
    if (password.length < 8) return json(400, { error: "Das Passwort muss mindestens 8 Zeichen haben." });
    const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) return json(400, { error: error.message.includes("already") ? "Diese E-Mail-Adresse existiert bereits." : error.message });
    return json(200, { ok: true });
  }

  if (body.action === "delete") {
    if (!body.id) return json(400, { error: "keine ID" });
    if (body.id === callerId(req)) return json(400, { error: "Du kannst dein eigenes Konto nicht löschen." });
    const { error } = await supabase.auth.admin.deleteUser(body.id);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  return json(400, { error: "unbekannte Aktion" });
});
