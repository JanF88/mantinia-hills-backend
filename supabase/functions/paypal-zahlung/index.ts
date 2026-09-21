// PayPal-Zahlung der ANZAHLUNG (verify_jwt=false; Schutz über den unerratbaren
// zahlung_token der Buchung). Nur die Anzahlungsrechnung wird über PayPal
// gezahlt — die Restzahlung läuft weiterhin per Überweisung.
//
// Ablauf:
//   GET ?token=…                → PayPal-Order serverseitig anlegen (Betrag =
//                                 jüngste Anzahlungsrechnung, nie vom Client)
//                                 und zum PayPal-Checkout weiterleiten.
//   GET ?aktion=zurueck&token=… → Rückkehr von PayPal: Capture ausführen,
//                                 Buchung auf "angezahlt" setzen, Referenz
//                                 speichern, Eigentümer per Mail informieren,
//                                 Gast zur Erfolgsseite leiten.
//   GET ?aktion=abbruch&lang=…  → Gast hat abgebrochen: freundliche Seite,
//                                 Überweisung bleibt möglich.
//
// Secrets: PAYPAL_SECRET (Pflicht, vom Kunden im Dashboard gepflegt),
// optional PAYPAL_CLIENT_ID und PAYPAL_API (Default: Live).

import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const APP_BASE = "https://clients.mantinia-hills.com";
const PAYPAL_API = Deno.env.get("PAYPAL_API") ?? "https://api-m.paypal.com";
const CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") ??
  "AcrWcJr2zUqTyH4x1jq1bhYRhY2JRNAEOIZCXd0Fm9wuD_ic1YigFxGE6EvLzqCHFo2dlfiHBb0M6OkN";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function weiter(url: string): Response {
  return new Response(null, { status: 303, headers: { ...CORS, Location: url } });
}
function statusSeite(status: string, lang: string, extra = ""): Response {
  return weiter(`${APP_BASE}/zahlung?status=${status}&lang=${encodeURIComponent(lang)}${extra}`);
}

/** PAYPAL_SECRET tolerant auflösen (akzeptiert auch z. B. "paypal secret"). */
function findeSecret(): string | undefined {
  const direkt = Deno.env.get("PAYPAL_SECRET");
  if (direkt) return direkt;
  const env = Deno.env.toObject();
  const key = Object.keys(env).find((k) => /paypal/i.test(k) && /secret/i.test(k));
  return key ? env[key] : undefined;
}

async function paypalToken(secret: string): Promise<string> {
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${CLIENT_ID}:${secret}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`PayPal-Auth fehlgeschlagen (HTTP ${res.status})`);
  const j = await res.json();
  return j.access_token as string;
}

/** PayPal-Locale je Gastsprache. */
function locale(sprache: string): string {
  return sprache === "en" ? "en-GB" : sprache === "gr" ? "el-GR" : "de-DE";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return new Response("method not allowed", { status: 405, headers: CORS });

  const url = new URL(req.url);
  const aktion = url.searchParams.get("aktion") ?? "start";
  const token = url.searchParams.get("token") ?? "";
  const langParam = url.searchParams.get("lang") ?? "de";

  if (aktion === "abbruch") return statusSeite("abbruch", langParam);
  if (!token) return statusSeite("fehler", langParam);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: b } = await supabase
      .from("buchungen")
      .select("id, vorname, nachname, email, anreise, abreise, sprache, status")
      .eq("zahlung_token", token)
      .maybeSingle();
    if (!b) return statusSeite("fehler", langParam);
    const lang = ["de", "en", "gr"].includes(b.sprache) ? b.sprache : "de";

    // Bereits bezahlt/angezahlt? Dann freundlich "schon erledigt" zeigen.
    if (["angezahlt", "bezahlt", "abgeschlossen"].includes(b.status)) {
      return statusSeite("bereits", lang);
    }
    // Zahlbar nur im Status "bestaetigt" (Anzahlungsrechnung existiert dann).
    if (b.status !== "bestaetigt") return statusSeite("fehler", lang);

    // Betrag IMMER aus der jüngsten Anzahlungsrechnung (serverseitig).
    const { data: rechnung } = await supabase
      .from("dokumente")
      .select("nummer, gesamt")
      .eq("buchung_id", b.id)
      .eq("typ", "anzahlungsrechnung")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rechnung || !(Number(rechnung.gesamt) > 0)) return statusSeite("fehler", lang);
    const betrag = Number(rechnung.gesamt).toFixed(2);

    const secret = findeSecret();
    if (!secret) {
      console.error("PAYPAL_SECRET nicht gesetzt");
      return statusSeite("inaktiv", lang);
    }
    const access = await paypalToken(secret);
    const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paypal-zahlung`;

    if (aktion === "start") {
      const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: rechnung.nummer,
            invoice_id: rechnung.nummer,
            description: `Anzahlung ${rechnung.nummer} - Ferienhaus Mantinia Hills`,
            amount: { currency_code: "EUR", value: betrag },
          }],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "Ferienhaus Mantinia Hills",
                locale: locale(lang),
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: `${fnBase}?aktion=zurueck&token=${token}`,
                cancel_url: `${fnBase}?aktion=abbruch&lang=${lang}`,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const order = await res.json();
      if (!res.ok) {
        console.error("Order-Anlage fehlgeschlagen:", JSON.stringify(order).slice(0, 500));
        return statusSeite("fehler", lang);
      }
      const approve = (order.links ?? []).find((l: { rel: string }) => l.rel === "payer-action" || l.rel === "approve");
      if (!approve?.href) {
        console.error("Kein Approval-Link in Order:", JSON.stringify(order).slice(0, 500));
        return statusSeite("fehler", lang);
      }
      return weiter(approve.href as string);
    }

    if (aktion === "zurueck") {
      // PayPal hängt seine Order-ID als zusätzlichen ?token=…-Parameter an die
      // return_url. Unser Buchungs-Token ist der erste `token`-Wert, die
      // PayPal-Order-ID der davon abweichende zweite.
      const paypalOrderId = url.searchParams.getAll("token").find((t) => t !== token) ?? "";
      if (!paypalOrderId) return statusSeite("fehler", lang);

      const capRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25_000),
      });
      const cap = await capRes.json();
      const bereitsErledigt = cap?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED";
      if (!capRes.ok && !bereitsErledigt) {
        console.error("Capture fehlgeschlagen:", JSON.stringify(cap).slice(0, 500));
        return statusSeite("fehler", lang);
      }
      if (!bereitsErledigt && cap.status !== "COMPLETED") {
        console.error("Capture nicht COMPLETED:", cap.status);
        return statusSeite("fehler", lang);
      }
      const captureId = cap?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? paypalOrderId;

      // Buchung auf "angezahlt" (nur aus bestaetigt heraus — idempotent bei Doppel-Redirect).
      await supabase
        .from("buchungen")
        .update({
          status: "angezahlt",
          anzahlung_eingegangen_am: new Date().toISOString(),
          zahlung_referenz: `PayPal ${captureId}`,
        })
        .eq("id", b.id)
        .eq("status", "bestaetigt");

      // Eigentümer informieren (Fehler hier nicht fatal für den Gast).
      const smtpPass = Deno.env.get("SMTP_PASS");
      if (smtpPass && !bereitsErledigt) {
        try {
          const user = Deno.env.get("SMTP_USER") ?? "info@mantinia-hills.com";
          const from = Deno.env.get("SMTP_FROM") ?? user;
          const client = new SMTPClient({
            connection: { hostname: Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com", port: parseInt(Deno.env.get("SMTP_PORT") ?? "465", 10), tls: true, auth: { username: user, password: smtpPass } },
          });
          await Promise.race([
            client.send({
              from: `Ferienhaus Mantinia Hills <${from}>`,
              to: from,
              subject: `PayPal-Zahlung eingegangen: ${rechnung.nummer} (${betrag} EUR)`,
              content: `Die Anzahlung zu ${rechnung.nummer} wurde per PayPal gezahlt.\n\nGast: ${b.vorname} ${b.nachname} (${b.email})\nZeitraum: ${b.anreise} bis ${b.abreise}\nBetrag: ${betrag} EUR\nPayPal-Referenz: ${captureId}\n\nDie Buchung steht jetzt auf "Angezahlt" — es ist nichts weiter zu tun.`,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("SMTP-Timeout")), 20_000)),
          ]);
          await client.close();
        } catch (err) {
          console.error("Eigentümer-Mail fehlgeschlagen:", err instanceof Error ? err.message : String(err));
        }
      }
      return statusSeite("ok", lang, `&betrag=${betrag}`);
    }

    return statusSeite("fehler", lang);
  } catch (err) {
    console.error("paypal-zahlung Fehler:", err instanceof Error ? err.message : String(err));
    return statusSeite("fehler", langParam);
  }
});
