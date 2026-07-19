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
    betreff: opts.betreff,
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

/** Gemeinsamer HTML-Rahmen mit Anbieter-Fußzeile. */
export function mailRahmen(inhaltHtml: string, a: Anbieter): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2c2c2a;line-height:1.55">
${inhaltHtml}
<hr style="border:none;border-top:1px solid #e2ddd6;margin:20px 0">
<p style="font-size:12px;color:#888;margin:0">
${a.name} · ${a.inhaber}<br>
${a.strasse}, ${a.ort}, ${a.land}<br>
${a.telefon} · ${a.email} · ${a.web}
</p>
</div>`
}
