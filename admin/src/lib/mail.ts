import { supabase } from './supabase'
import type { Anbieter } from './types'

/** Uint8Array (PDF) → Base64 (chunkweise, stack-sicher). */
export function bytesZuBase64(bytes: Uint8Array): string {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/**
 * Betreff mail-tauglich kodieren. DE-Umlaute/Sonderzeichen werden transliteriert
 * (bewährt); bleibt danach nur ASCII übrig, wird der Betreff unverändert gesendet.
 * Andernfalls (z. B. Griechisch) als RFC-2047-Encoded-Word (UTF-8/Base64) — so
 * kommen alle Zeichen korrekt an, statt entfernt zu werden.
 */
export function betreffAsciiSicher(s: string): string {
  const ascii = s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[–—]/g, '-')
    .replace(/[„“”‚‘’]/g, "'")
  if (/^[\x20-\x7E]*$/.test(ascii)) return ascii
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  return '=?UTF-8?B?' + b64 + '?='
}

export async function sendeMail(opts: {
  an: string
  betreff: string
  html: string
  anhangBytes?: Uint8Array
  anhangName?: string
  kopieAnMich?: boolean
}): Promise<void> {
  const body: Record<string, unknown> = {
    an: opts.an,
    betreff: betreffAsciiSicher(opts.betreff),
    html: opts.html,
    kopie_an_absender: opts.kopieAnMich ?? true,
  }
  if (opts.anhangBytes && opts.anhangName) {
    body.anhang = { dateiname: opts.anhangName, base64: bytesZuBase64(opts.anhangBytes) }
  }
  let { data, error } = await supabase.functions.invoke('sende-mail', { body })
  // Netzwerk-Abbruch (typisch mobil: Funkloch, Netzwechsel, Tab schlafen gelegt):
  // die Anfrage kam gar nicht erst an — einmal automatisch wiederholen.
  // (Im seltensten Fall, dass der erste Versuch doch durchging, entsteht eine
  // doppelte Mail — das ist besser als gar keine.)
  if (error && (error.name === 'FunctionsFetchError' || /Failed to send a request/i.test(error.message ?? ''))) {
    await new Promise((r) => setTimeout(r, 2000))
    const zweiter = await supabase.functions.invoke('sende-mail', { body })
    data = zweiter.data
    error = zweiter.error
  }
  if (error) {
    let detail = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        detail = j.detail || j.error || detail
      }
    } catch { /* Detail nicht lesbar */ }
    throw new Error(detail)
  }
  // Funktion gibt {ok:true} zurück; bei Fehlern im Body ebenfalls prüfen
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { detail?: string; error?: string }).detail || (data as { error?: string }).error)
  }
}

const LOGO_URL = 'https://clients.mantinia-hills.com/logo-email.png'

/** Gemeinsamer HTML-Rahmen mit gebrandeter Signatur-Fußzeile (Logo + Kontakt). */
export function mailRahmen(inhaltHtml: string, a: Anbieter): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2c2c2a;line-height:1.55">
${inhaltHtml}
<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e2ddd6;padding-top:16px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td style="padding:0 0 8px 0;">
    <a href="https://${a.web.replace(/^https?:\/\//, '')}" target="_blank" style="text-decoration:none;">
      <img src="${LOGO_URL}" width="200" height="50" alt="${a.name}" style="display:block;border:0;">
    </a>
  </td></tr>
  <tr><td style="font-size:13px;color:#2c2c2a;">
    <span style="font-weight:bold;color:#681318;">${a.name}</span><br>
    <span style="color:#666;font-size:12px;">${a.inhaber} · ${a.strasse}, ${a.ort}, ${a.land}</span><br>
    <span style="color:#681318;font-weight:bold;">T</span> ${a.telefon}
    &nbsp;·&nbsp; <span style="color:#681318;font-weight:bold;">M</span> <a href="mailto:${a.email}" style="color:#2c2c2a;text-decoration:none;">${a.email}</a>
    &nbsp;·&nbsp; <a href="https://${a.web.replace(/^https?:\/\//, '')}" style="color:#681318;">${a.web}</a>
  </td></tr>
</table>
</div>`
}

/** PayPal-Zahlungsblock für die Anzahlungs-Mail (nur Anzahlung; Überweisung bleibt möglich). */
const PP_TXT: Record<'de' | 'en' | 'gr', { btn: string; hinweis: string }> = {
  de: { btn: 'Anzahlung jetzt mit PayPal zahlen', hinweis: 'Oder überweisen Sie den Betrag klassisch — alle Angaben stehen in der Rechnung.' },
  en: { btn: 'Pay deposit now with PayPal', hinweis: 'Or transfer the amount by bank — all details are in the invoice.' },
  gr: { btn: 'Πληρωμή προκαταβολής μέσω PayPal', hinweis: 'Ή εμβάστε το ποσό μέσω τράπεζας — όλα τα στοιχεία βρίσκονται στο τιμολόγιο.' },
}

export function paypalZahlungBlock(zahlungToken: string | null, sprache: 'de' | 'en' | 'gr'): string {
  if (!zahlungToken) return ''
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-zahlung?token=${zahlungToken}`
  const t = PP_TXT[sprache]
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px"><tr><td style="border-radius:8px;background:#681318">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${t.btn}</a>
</td></tr></table>
<p style="font-size:13px;color:#666;margin:0 0 12px">${t.hinweis}</p>`
}
