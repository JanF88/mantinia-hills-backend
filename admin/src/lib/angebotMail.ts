// Gemeinsamer Angebots-Mailversand — genutzt beim Erstellen (AngebotDialog) und
// beim erneuten Senden (AnfrageDetail). Baut den „Angebot annehmen"-Button, füllt
// die Vorlage, hängt das PDF an und vermerkt den Versand am Dokument.

import { sendeMail, mailRahmen } from './mail'
import { renderMailVorlage } from './mailVorlagen'
import { ladePdfBytes, markiereVersendet } from './dokumentService'
import { datumDE, lokalISO } from './format'
import type { Buchung, Dokument, Einstellungen } from './types'

/** HTML-Button, der auf die Bestätigungsseite (…/angebot-annehmen?token=…) führt. */
export function annahmeButtonHtml(token: string): string {
  const url = `${window.location.origin}/angebot-annehmen?token=${token}`
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0"><tr><td style="border-radius:8px;background:#681318">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;color:#fff;font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,Helvetica,sans-serif">Angebot annehmen</a>
</td></tr></table>
<p style="font-size:13px;color:#666">Falls der Button nicht funktioniert, kopieren Sie bitte diesen Link in Ihren Browser:<br><a href="${url}">${url}</a></p>`
}

/**
 * Verschickt ein bereits erstelltes Angebot (erneut) per E-Mail: lädt das
 * archivierte PDF, baut Button + Vorlage und vermerkt den Versand.
 * Gültigkeit wird ab heute neu berechnet (das Angebot gilt ab Versand weiter).
 */
export async function sendeAngebotErneut(
  buchung: Buchung,
  angebot: Dokument,
  einstellungen: Einstellungen,
): Promise<void> {
  if (!buchung.annahme_token) {
    throw new Error('Kein Annahme-Link vorhanden — das Angebot wurde vermutlich bereits angenommen.')
  }
  const bytes = await ladePdfBytes(angebot)
  const gueltig = new Date()
  gueltig.setDate(gueltig.getDate() + einstellungen.angebot_gueltig_tage)
  const { betreff, html } = renderMailVorlage(
    einstellungen.mail_vorlagen[buchung.sprache].angebot,
    {
      vorname: buchung.vorname,
      nachname: buchung.nachname,
      anreise: datumDE(buchung.anreise),
      abreise: datumDE(buchung.abreise),
      nummer: angebot.nummer,
      gueltig_bis: datumDE(lokalISO(gueltig)),
    },
    { button: annahmeButtonHtml(buchung.annahme_token) },
  )
  await sendeMail({
    an: buchung.email,
    betreff,
    html: mailRahmen(html, einstellungen.anbieter),
    anhangBytes: bytes,
    anhangName: `${angebot.nummer}_Angebot_Mantinia_Hills.pdf`,
    kopieAnMich: true,
  })
  await markiereVersendet(angebot.id)
}
