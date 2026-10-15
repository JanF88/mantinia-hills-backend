import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ladeEinstellungen } from '../lib/einstellungen'
import { downloadArchiviertesPdf } from '../lib/dokumentService'
import { sendeAngebotErneut } from '../lib/angebotMail'
import { belegungsKonflikt, restzahlungFaellig } from '../lib/statistik'
import { datumDE, eur, zeitpunktDE } from '../lib/format'
import type { Buchung, Dokument, Einstellungen, Feedback, Sprache } from '../lib/types'
import { SPRACHE_LABEL, QUELLE_LABEL } from '../lib/types'
import StatusSchrittleiste from '../components/StatusSchrittleiste'
import WeitereAktionen, { type AktionsEintrag } from '../components/WeitereAktionen'
import AngebotDialog from '../components/AngebotDialog'
import AnzahlungDialog from '../components/AnzahlungDialog'
import AbschlussDialog from '../components/AbschlussDialog'
import StornoDialog from '../components/StornoDialog'
import AbsageDialog from '../components/AbsageDialog'

const TYP_LABEL = {
  angebot: 'Angebot',
  anzahlungsrechnung: 'Anzahlungsrechnung',
  abschlussrechnung: 'Abschlussrechnung',
  stornorechnung: 'Stornorechnung',
} as const

export default function AnfrageDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [buchung, setBuchung] = useState<Buchung | null>(null)
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(null)
  const [dialog, setDialog] = useState<'angebot' | 'anzahlung' | 'abschluss' | 'storno' | 'absage' | 'loeschen' | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [loescht, setLoescht] = useState(false)
  const [angebotSenden, setAngebotSenden] = useState<'idle' | 'laedt' | 'ok' | 'fehler'>('idle')
  const [angebotSendenMeldung, setAngebotSendenMeldung] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [konflikt, setKonflikt] = useState(false)

  const laden = useCallback(async () => {
    if (!id) return
    const [{ data: b }, { data: d }, { data: f }, { data: alleB }, { data: ext }] = await Promise.all([
      supabase.from('buchungen').select('*').eq('id', id).single(),
      supabase.from('dokumente').select('*').eq('buchung_id', id).order('created_at', { ascending: false }),
      supabase.from('feedback').select('*').eq('buchung_id', id).maybeSingle(),
      supabase.from('buchungen').select('id, status, anreise, abreise').in('status', ['bestaetigt', 'angezahlt', 'bezahlt', 'abgeschlossen']),
      supabase.from('ical_blockierungen').select('von, bis'),
    ])
    setBuchung(b as Buchung)
    setDokumente((d as Dokument[]) ?? [])
    setFeedback((f as Feedback | null) ?? null)
    setKonflikt(belegungsKonflikt(
      b as Buchung,
      (alleB as Buchung[]) ?? [],
      (ext as { von: string; bis: string }[]) ?? [],
    ))
  }, [id])

  useEffect(() => {
    laden()
    ladeEinstellungen().then(setEinstellungen).catch(() => setFehler('Einstellungen konnten nicht geladen werden.'))
  }, [laden])

  if (!buchung) return <p className="leer">Wird geladen …</p>

  const juengstesAngebot = dokumente.find((d) => d.typ === 'angebot') ?? null
  const juengsteAnzahlung = dokumente.find((d) => d.typ === 'anzahlungsrechnung') ?? null
  const juengsteAbschluss = dokumente.find((d) => d.typ === 'abschlussrechnung') ?? null

  async function statusSetzen(update: Partial<Buchung>) {
    setFehler(null)
    const { error } = await supabase.from('buchungen').update(update).eq('id', buchung!.id)
    if (error) setFehler(error.message)
    else laden()
  }

  async function anfrageLoeschen() {
    setLoescht(true)
    setFehler(null)
    try {
      // 1) archivierte PDFs aus dem Storage entfernen
      const pfade = dokumente.map((d) => d.pdf_path).filter((p): p is string => !!p)
      if (pfade.length) await supabase.storage.from('dokumente').remove(pfade)
      // 2) Dokument-Datensätze (FK verhindert sonst das Löschen der Buchung)
      await supabase.from('dokumente').delete().eq('buchung_id', buchung!.id)
      // 3) die Buchung selbst
      const { error } = await supabase.from('buchungen').delete().eq('id', buchung!.id)
      if (error) throw error
      navigate('/anfragen')
    } catch (err) {
      setFehler('Löschen fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)))
      setLoescht(false)
      setDialog(null)
    }
  }

  async function angebotErneutSenden() {
    if (!juengstesAngebot || !einstellungen) return
    setAngebotSenden('laedt')
    setAngebotSendenMeldung('')
    try {
      await sendeAngebotErneut(buchung!, juengstesAngebot, einstellungen)
      setAngebotSenden('ok')
      setAngebotSendenMeldung(`Angebot ${juengstesAngebot.nummer} an ${buchung!.email} gesendet.`)
      laden()
    } catch (err) {
      setAngebotSenden('fehler')
      setAngebotSendenMeldung(err instanceof Error ? err.message : String(err))
    }
  }

  // Pro Status genau eine Hauptaktion; Dokumente sind unveränderlich,
  // daher verschwindet jeder Erstellen-Button, sobald das Dokument existiert.
  const s = buchung.status
  const kannAngebot = s === 'neu' && einstellungen != null
  const kannAblehnen = s === 'neu' || s === 'angebot_erstellt'
  const kannAnnehmen = s === 'angebot_erstellt' && juengstesAngebot != null
  const kannAngebotSenden = s === 'angebot_erstellt' && juengstesAngebot != null && buchung.annahme_token != null && einstellungen != null
  const kannAnzahlungsRechnung = s === 'bestaetigt' && juengsteAnzahlung == null && juengstesAngebot != null && einstellungen != null
  const kannAnzahlungEingang = s === 'bestaetigt' && juengsteAnzahlung != null
  const kannAbschlussrechnung = s === 'angezahlt' && juengsteAbschluss == null && juengstesAngebot != null && einstellungen != null
  const kannRestzahlung = s === 'angezahlt' && juengsteAbschluss != null
  const kannStorno = (s === 'bestaetigt' || s === 'angezahlt' || s === 'bezahlt') && juengstesAngebot != null && einstellungen != null
  const kannAbschliessen = s === 'bezahlt'
  const faellig = restzahlungFaellig(buchung, einstellungen?.abschlussrechnung_tage_vorher)

  // --- „Nächster Schritt": genau EINE Primäraktion + ein erklärender Satz ---
  let primaer: { label: string; onClick: () => void } | null = null
  let kontext = ''
  if (kannAngebot) {
    primaer = { label: 'Angebot erstellen', onClick: () => setDialog('angebot') }
    kontext = 'Neue Anfrage — erstellen und senden Sie jetzt das Angebot.'
  } else if (kannAnnehmen) {
    primaer = { label: 'Annahme bestätigen', onClick: () => statusSetzen({ status: 'bestaetigt', angenommen_am: new Date().toISOString() }) }
    kontext = buchung.annahme_token
      ? `Angebot ${juengstesAngebot!.nummer} ist beim Gast — die Annahme läuft normalerweise automatisch über den Link in der E-Mail. Nur bei telefonischer Zusage hier manuell bestätigen.`
      : `Angebot ${juengstesAngebot!.nummer} liegt vor; der Annahme-Link wurde bereits verwendet oder entfernt — Annahme hier manuell bestätigen.`
  } else if (kannAnzahlungsRechnung) {
    primaer = { label: 'Anzahlungsrechnung erstellen', onClick: () => setDialog('anzahlung') }
    kontext = 'Das Angebot wurde angenommen — jetzt die Anzahlungsrechnung erstellen und senden.'
  } else if (kannAnzahlungEingang) {
    primaer = { label: 'Anzahlung eingegangen', onClick: () => statusSetzen({ status: 'angezahlt', anzahlung_eingegangen_am: new Date().toISOString() }) }
    kontext = `Rechnung ${juengsteAnzahlung!.nummer} ist beim Gast. Erst klicken, wenn die Zahlung tatsächlich auf dem Konto ist — PayPal-Zahlungen buchen sich automatisch.`
  } else if (kannAbschlussrechnung) {
    primaer = { label: 'Abschlussrechnung erstellen', onClick: () => setDialog('abschluss') }
    kontext = faellig
      ? `Die Anreise (${datumDE(buchung.anreise)}) rückt näher — jetzt die Abschlussrechnung erstellen und senden.`
      : 'Anzahlung ist da. Die Abschlussrechnung wird vor der Anreise fällig — sie kann jederzeit erstellt werden.'
  } else if (kannRestzahlung) {
    primaer = { label: 'Restzahlung eingegangen', onClick: () => statusSetzen({ status: 'bezahlt', restzahlung_eingegangen_am: new Date().toISOString() }) }
    kontext = `Rechnung ${juengsteAbschluss!.nummer} ist beim Gast. Erst klicken, wenn der Restbetrag tatsächlich auf dem Konto ist.`
  } else if (kannAbschliessen) {
    primaer = { label: 'Abschließen', onClick: () => statusSetzen({ status: 'abgeschlossen' }) }
    kontext = 'Komplett bezahlt. Nach der Abreise wird der Vorgang automatisch abgeschlossen — oder hier manuell.'
  } else if (s === 'abgeschlossen' || s === 'storniert' || s === 'abgelehnt') {
    kontext = 'Vorgang abgeschlossen — keine weiteren Aktionen.'
  } else {
    kontext = 'Keine Aktion möglich — Einstellungen oder Angebot fehlen noch.'
  }

  // --- Nebenaktionen ins Aufklappmenü ---
  const nebenaktionen: AktionsEintrag[] = []
  if (kannAngebotSenden) {
    nebenaktionen.push({
      label: angebotSenden === 'laedt' ? 'Wird gesendet …' : 'Angebot erneut senden',
      onClick: angebotErneutSenden,
      disabled: angebotSenden === 'laedt',
    })
  }
  if (kannAblehnen && einstellungen) nebenaktionen.push({ label: 'Ablehnen …', onClick: () => setDialog('absage'), gefahr: true })
  if (kannStorno) nebenaktionen.push({ label: 'Stornieren …', onClick: () => setDialog('storno'), gefahr: true })
  nebenaktionen.push({ label: 'Anfrage löschen …', onClick: () => setDialog('loeschen'), gefahr: true })

  return (
    <>
      <p style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link to="/anfragen">← Zurück zur Liste</Link>
        <Link to="/kalender">📅 Zum Kalender</Link>
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{buchung.vorname} {buchung.nachname}</h2>
        <WeitereAktionen eintraege={nebenaktionen} />
      </div>

      {/* „Nächster Schritt" — die Seite beantwortet zuerst: Was ist jetzt zu tun? */}
      <div className="card">
        <StatusSchrittleiste buchung={buchung} />
        {konflikt && (
          <div className="warnung">
            <strong>⚠ Zeitraum belegt:</strong> {datumDE(buchung.anreise)} – {datumDE(buchung.abreise)} kollidiert
            mit einer festen Buchung oder Booking/Airbnb-Sperre.
            {s === 'angebot_erstellt' && ' Der Annahme-Link ist automatisch gesperrt.'}
            {' '}Empfehlung: ablehnen oder Alternativtermin anbieten.
          </div>
        )}
        {faellig && s === 'bestaetigt' && (
          <div className="warnung">
            Die Anreise ({datumDE(buchung.anreise)}) rückt näher, aber die Anzahlung ist noch nicht als eingegangen markiert — bitte prüfen.
          </div>
        )}
        <p className="text-hinweis" style={{ margin: '0 0 14px' }}>{kontext}</p>
        {primaer && (
          <button className="btn-primary" style={{ fontSize: 'var(--fs-m)', padding: '12px 26px' }} onClick={primaer.onClick}>
            {primaer.label}
          </button>
        )}
        {angebotSenden === 'ok' && (
          <p className="hinweis" style={{ marginBottom: 0 }}>✓ {angebotSendenMeldung} Bitte den Gast ggf. auf den Spam-Ordner hinweisen.</p>
        )}
        {angebotSenden === 'fehler' && (
          <p className="fehler" style={{ marginBottom: 0 }}>✗ Versand fehlgeschlagen: {angebotSendenMeldung}</p>
        )}
        {fehler && <p className="fehler" style={{ marginBottom: 0 }}>{fehler}</p>}
      </div>

      <div className="card">
        <h2>Buchung</h2>
        <dl className="meta-grid">
          <div><dt>Zeitraum</dt><dd>{datumDE(buchung.anreise)} – {datumDE(buchung.abreise)}</dd></div>
          <div><dt>Nächte</dt><dd>{buchung.naechte}</dd></div>
          <div><dt>Personen</dt><dd>{buchung.personen}</dd></div>
          <div><dt>Gesamt</dt><dd className="summe-gross">{buchung.gesamtpreis_eur != null ? eur(buchung.gesamtpreis_eur) : '–'}</dd></div>
          <div><dt>E-Mail</dt><dd><a href={`mailto:${buchung.email}`}>{buchung.email}</a></dd></div>
          {buchung.telefon && <div><dt>Telefon</dt><dd>{buchung.telefon}</dd></div>}
          <div>
            <dt>Sprache</dt>
            <dd>
              <select
                value={buchung.sprache}
                onChange={(ev) => statusSetzen({ sprache: ev.target.value as Sprache })}
                style={{ padding: '2px 6px', fontSize: 'var(--fs-s)' }}
                title="Sprache für E-Mails, PDFs und Bestätigungsseiten"
              >
                {(Object.keys(SPRACHE_LABEL) as Sprache[]).map((sp) => (
                  <option key={sp} value={sp}>{SPRACHE_LABEL[sp]}</option>
                ))}
              </select>
            </dd>
          </div>
          <div><dt>Quelle</dt><dd>{QUELLE_LABEL[buchung.quelle] ?? buchung.quelle}</dd></div>
        </dl>

        <details style={{ marginTop: 12 }}>
          <summary className="text-hinweis" style={{ cursor: 'pointer' }}>Details &amp; Verlauf</summary>
          <dl className="meta-grid" style={{ marginTop: 10 }}>
            <div><dt>Eingang</dt><dd>{zeitpunktDE(buchung.anfrage_zeitpunkt ?? buchung.created_at)}</dd></div>
            <div><dt>Übernachtung</dt><dd>{buchung.uebernachtung_eur != null ? eur(buchung.uebernachtung_eur) : '–'}</dd></div>
            <div><dt>Endreinigung</dt><dd>{buchung.endreinigung_eur != null ? eur(buchung.endreinigung_eur) : '–'}</dd></div>
            <div><dt>Transfer</dt><dd>{buchung.transfer_option ?? '–'}{buchung.transfer_eur ? ` (${eur(buchung.transfer_eur)})` : ''}</dd></div>
            <div><dt>Fahrzeug/Tour</dt><dd>{buchung.fahrzeug_interesse ?? '–'}</dd></div>
            {buchung.angebot_erinnert_am && <div><dt>Erinnerung 1 gesendet</dt><dd>{zeitpunktDE(buchung.angebot_erinnert_am)}</dd></div>}
            {buchung.angebot_erinnert2_am && <div><dt>Erinnerung 2 gesendet</dt><dd>{zeitpunktDE(buchung.angebot_erinnert2_am)}</dd></div>}
            {buchung.angenommen_am && <div><dt>Angebot angenommen</dt><dd>{zeitpunktDE(buchung.angenommen_am)}</dd></div>}
            {buchung.anzahlung_eingegangen_am && (
              <div>
                <dt>Anzahlung eingegangen</dt>
                <dd>
                  {zeitpunktDE(buchung.anzahlung_eingegangen_am)}
                  {buchung.zahlung_referenz && <span style={{ color: 'var(--grau)' }}> · {buchung.zahlung_referenz}</span>}
                </dd>
              </div>
            )}
            {buchung.restzahlung_eingegangen_am && <div><dt>Restzahlung eingegangen</dt><dd>{zeitpunktDE(buchung.restzahlung_eingegangen_am)}</dd></div>}
            {buchung.storniert_am && <div><dt>Storniert</dt><dd>{zeitpunktDE(buchung.storniert_am)}</dd></div>}
            {buchung.feedback_angefragt_am && <div><dt>Feedback angefragt</dt><dd>{zeitpunktDE(buchung.feedback_angefragt_am)}{feedback ? ' (beantwortet)' : ''}</dd></div>}
          </dl>
          {buchung.saison_aufschluesselung && (
            <p className="text-hinweis" style={{ marginBottom: 0 }}>Saisons: {buchung.saison_aufschluesselung}</p>
          )}
        </details>
      </div>

      {feedback && (
        <div className="card" style={{ borderColor: '#e8d9a8' }}>
          <h2>Gäste-Feedback</h2>
          <div style={{ fontSize: 26, letterSpacing: 3, color: '#e8a33d', marginBottom: 6 }}>
            {'★'.repeat(feedback.sterne)}<span style={{ color: 'var(--linie, #d9d2c7)' }}>{'★'.repeat(5 - feedback.sterne)}</span>
            <span style={{ fontSize: 14, color: 'var(--grau)', marginLeft: 10, letterSpacing: 0 }}>
              {feedback.sterne}/5 · {zeitpunktDE(feedback.erstellt_am)}
            </span>
          </div>
          {feedback.text && <p style={{ fontSize: 'var(--fs-m)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{feedback.text}</p>}
          <p className="text-klein" style={{ marginTop: 10, marginBottom: 0 }}>
            {feedback.veroeffentlichung_ok
              ? '✓ Veröffentlichung als Referenz erlaubt'
              : 'Keine Einwilligung zur Veröffentlichung — nur intern verwenden'}
          </p>
        </div>
      )}

      {(dokumente.length > 0 || buchung.feedback_angefragt_am) && (
        <div className="card">
          <h2>Dokumente</h2>
          <table>
            <thead>
              <tr><th>Dokument</th><th>Datum</th><th className="rechts">Betrag</th><th>Versand</th><th /></tr>
            </thead>
            <tbody>
              {dokumente.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.nummer}</strong><div className="text-klein">{TYP_LABEL[d.typ]}</div></td>
                  <td>{datumDE(d.datum)}</td>
                  <td className="rechts">{eur(Number(d.gesamt))}</td>
                  <td style={{ fontSize: 'var(--fs-s)' }}>
                    {d.versendet_am
                      ? <span style={{ color: 'var(--gruen, #1a7f37)' }}>✓ {datumDE(d.versendet_am)}</span>
                      : <span style={{ color: 'var(--grau)' }}>— nicht gesendet</span>}
                  </td>
                  <td className="rechts">
                    <button className="btn-klein" onClick={() => downloadArchiviertesPdf(d).catch((e) => setFehler(String(e)))}>
                      PDF
                    </button>
                  </td>
                </tr>
              ))}
              {buchung.feedback_angefragt_am && (
                <tr>
                  <td><strong style={{ color: 'var(--grau)' }}>—</strong><div className="text-klein">Feedback-Anfrage{feedback ? ' (beantwortet)' : ''}</div></td>
                  <td>{datumDE(buchung.feedback_angefragt_am)}</td>
                  <td className="rechts">–</td>
                  <td style={{ fontSize: 'var(--fs-s)' }}>
                    <span style={{ color: 'var(--gruen, #1a7f37)' }}>✓ {datumDE(buchung.feedback_angefragt_am)}</span>
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialog === 'loeschen' && (
        <div className="dialog-hintergrund">
          <div className="dialog" style={{ maxWidth: 480 }}>
            <h2>Anfrage löschen</h2>
            <div className="warnung">
              Wirklich <strong>{buchung.vorname} {buchung.nachname}</strong>
              {dokumente.length > 0 && <> samt {dokumente.length} {dokumente.length === 1 ? 'Dokument' : 'Dokumenten'}</>}
              {' '}endgültig löschen? Das kann nicht rückgängig gemacht werden. Zum Entfernen von Testdaten gedacht.
            </div>
            <div className="dialog-aktionen">
              <button onClick={() => setDialog(null)} disabled={loescht}>Abbrechen</button>
              <button className="btn-gefahr" onClick={anfrageLoeschen} disabled={loescht}>
                {loescht ? 'Wird gelöscht …' : 'Ja, endgültig löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog === 'angebot' && einstellungen && (
        <AngebotDialog
          buchung={buchung}
          einstellungen={einstellungen}
          onFertig={() => { setDialog(null); laden() }}
          onAbbrechen={() => setDialog(null)}
        />
      )}
      {dialog === 'anzahlung' && einstellungen && juengstesAngebot && (
        <AnzahlungDialog
          buchung={buchung}
          angebot={juengstesAngebot}
          einstellungen={einstellungen}
          onFertig={() => { setDialog(null); laden() }}
          onAbbrechen={() => setDialog(null)}
        />
      )}
      {dialog === 'abschluss' && einstellungen && juengstesAngebot && (
        <AbschlussDialog
          buchung={buchung}
          angebot={juengstesAngebot}
          anzahlung={juengsteAnzahlung}
          einstellungen={einstellungen}
          onFertig={() => { setDialog(null); laden() }}
          onAbbrechen={() => setDialog(null)}
        />
      )}
      {dialog === 'storno' && einstellungen && juengstesAngebot && (
        <StornoDialog
          buchung={buchung}
          angebot={juengstesAngebot}
          anzahlung={juengsteAnzahlung}
          einstellungen={einstellungen}
          onFertig={() => { setDialog(null); laden() }}
          onAbbrechen={() => setDialog(null)}
        />
      )}
      {dialog === 'absage' && einstellungen && (
        <AbsageDialog
          buchung={buchung}
          einstellungen={einstellungen}
          onFertig={() => { setDialog(null); laden() }}
          onAbbrechen={() => setDialog(null)}
        />
      )}
    </>
  )
}
