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

/** Betreff ASCII-sicher machen — Umlaute im SMTP-Betreff kamen als Rohtext an. */
export function betreffAsciiSicher(s: string): string {
  return s
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[–—]/g, '-')
    .replace(/[„“”‚‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '')
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
  const { data, error } = await supabase.functions.invoke('sende-mail', { body })
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
