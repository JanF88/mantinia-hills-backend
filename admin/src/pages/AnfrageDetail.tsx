import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ladeEinstellungen } from '../lib/einstellungen'
import { downloadArchiviertesPdf } from '../lib/dokumentService'
import { datumDE, eur, zeitpunktDE } from '../lib/format'
import type { Buchung, Dokument, Einstellungen } from '../lib/types'
import StatusBadge from '../components/StatusBadge'
import AngebotDialog from '../components/AngebotDialog'
import AnzahlungDialog from '../components/AnzahlungDialog'
import StornoDialog from '../components/StornoDialog'

const TYP_LABEL = {
  angebot: 'Angebot',
  anzahlungsrechnung: 'Anzahlungsrechnung',
  stornorechnung: 'Stornorechnung',
} as const

export default function AnfrageDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [buchung, setBuchung] = useState<Buchung | null>(null)
  const [dokumente, setDokumente] = useState<Dokument[]>([])
  const [einstellungen, setEinstellungen] = useState<Einstellungen | null>(null)
  const [notizen, setNotizen] = useState('')
  const [dialog, setDialog] = useState<'angebot' | 'anzahlung' | 'storno' | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false)
  const [loescht, setLoescht] = useState(false)

  const laden = useCallback(async () => {
    if (!id) return
    const [{ data: b }, { data: d }] = await Promise.all([
      supabase.from('buchungen').select('*').eq('id', id).single(),
      supabase.from('dokumente').select('*').eq('buchung_id', id).order('created_at', { ascending: false }),
    ])
    setBuchung(b as Buchung)
    setNotizen((b as Buchung)?.notizen ?? '')
    setDokumente((d as Dokument[]) ?? [])
  }, [id])

  useEffect(() => {
    laden()
    ladeEinstellungen().then(setEinstellungen).catch(() => setFehler('Einstellungen konnten nicht geladen werden.'))
  }, [laden])

  if (!buchung) return <p className="leer">Wird geladen …</p>

  const juengstesAngebot = dokumente.find((d) => d.typ === 'angebot') ?? null
  const juengsteAnzahlung = dokumente.find((d) => d.typ === 'anzahlungsrechnung') ?? null

  async function statusSetzen(update: Partial<Buchung>) {
    setFehler(null)
    const { error } = await supabase.from('buchungen').update(update).eq('id', buchung!.id)
    if (error) setFehler(error.message)
    else laden()
  }

  async function notizenSpeichern() {
    await supabase.from('buchungen').update({ notizen: notizen.trim() || null }).eq('id', buchung!.id)
    laden()
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
    }
  }

  const s = buchung.status
  const kannAngebot = (s === 'neu' || s === 'angebot_erstellt') && einstellungen != null
  const kannAblehnen = s === 'neu' || s === 'angebot_erstellt'
  const kannAnnehmen = s === 'angebot_erstellt' && juengstesAngebot != null
  const kannAnzahlungsRechnung = s === 'bestaetigt' && juengstesAngebot != null && einstellungen != null
  const kannAnzahlungEingang = s === 'bestaetigt' && juengsteAnzahlung != null
  const kannRestzahlung = s === 'angezahlt'
  const kannStorno = (s === 'bestaetigt' || s === 'angezahlt' || s === 'bezahlt') && juengstesAngebot != null && einstellungen != null
  const kannAbschliessen = s === 'angezahlt' || s === 'bezahlt'

  return (
    <>
      <p><Link to="/anfragen">← Zurück zur Liste</Link></p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>{buchung.vorname} {buchung.nachname}</h2>
        <StatusBadge status={s} />
      </div>

      <div className="card">
        <h2>Anfrage</h2>
        <dl className="meta-grid">
          <div><dt>Zeitraum</dt><dd>{datumDE(buchung.anreise)} – {datumDE(buchung.abreise)}</dd></div>
          <div><dt>Nächte</dt><dd>{buchung.naechte}</dd></div>
          <div><dt>Personen</dt><dd>{buchung.personen}</dd></div>
          <div><dt>E-Mail</dt><dd><a href={`mailto:${buchung.email}`}>{buchung.email}</a></dd></div>
          {buchung.telefon && <div><dt>Telefon</dt><dd>{buchung.telefon}</dd></div>}
          <div><dt>Quelle</dt><dd>{buchung.quelle === 'webhook' ? 'Website' : 'Manuell'}</dd></div>
          <div><dt>Eingang</dt><dd>{zeitpunktDE(buchung.anfrage_zeitpunkt ?? buchung.created_at)}</dd></div>
          <div><dt>Transfer</dt><dd>{buchung.transfer_option ?? '–'}{buchung.transfer_eur ? ` (${eur(buchung.transfer_eur)})` : ''}</dd></div>
          <div><dt>Fahrzeug/Tour</dt><dd>{buchung.fahrzeug_interesse ?? '–'}</dd></div>
        </dl>

        <h3>Preis laut Anfrage</h3>
        <dl className="meta-grid">
          <div><dt>Übernachtung</dt><dd>{buchung.uebernachtung_eur != null ? eur(buchung.uebernachtung_eur) : '–'}</dd></div>
          <div><dt>Endreinigung</dt><dd>{buchung.endreinigung_eur != null ? eur(buchung.endreinigung_eur) : '–'}</dd></div>
          <div><dt>Transfer</dt><dd>{buchung.transfer_eur != null ? eur(buchung.transfer_eur) : '–'}</dd></div>
          <div><dt>Gesamt</dt><dd className="summe-gross">{buchung.gesamtpreis_eur != null ? eur(buchung.gesamtpreis_eur) : '–'}</dd></div>
        </dl>
        {buchung.saison_aufschluesselung && (
          <p style={{ fontSize: 13, color: 'var(--grau)', marginBottom: 0 }}>
            Saisons: {buchung.saison_aufschluesselung}
          </p>
        )}

        {(buchung.angenommen_am || buchung.anzahlung_eingegangen_am || buchung.restzahlung_eingegangen_am || buchung.storniert_am) && (
          <>
            <h3>Verlauf</h3>
            <dl className="meta-grid">
              {buchung.angenommen_am && <div><dt>Angebot angenommen</dt><dd>{zeitpunktDE(buchung.angenommen_am)}</dd></div>}
              {buchung.anzahlung_eingegangen_am && <div><dt>Anzahlung eingegangen</dt><dd>{zeitpunktDE(buchung.anzahlung_eingegangen_am)}</dd></div>}
              {buchung.restzahlung_eingegangen_am && <div><dt>Restzahlung eingegangen</dt><dd>{zeitpunktDE(buchung.restzahlung_eingegangen_am)}</dd></div>}
              {buchung.storniert_am && <div><dt>Storniert</dt><dd>{zeitpunktDE(buchung.storniert_am)}</dd></div>}
            </dl>
          </>
        )}
      </div>

      <div className="card">
        <h2>Aktionen</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {kannAngebot && (
            <button className="btn-primary" onClick={() => setDialog('angebot')}>
              {s === 'neu' ? 'Angebot erstellen' : 'Neues Angebot erstellen'}
            </button>
          )}
          {kannAnnehmen && (
            <button className="btn-primary" onClick={() => statusSetzen({ status: 'bestaetigt', angenommen_am: new Date().toISOString() })}>
              Annahme bestätigen
            </button>
          )}
          {kannAnzahlungsRechnung && (
            <button className="btn-primary" onClick={() => setDialog('anzahlung')}>
              Anzahlungsrechnung erstellen
            </button>
          )}
          {kannAnzahlungEingang && (
            <button onClick={() => statusSetzen({ status: 'angezahlt', anzahlung_eingegangen_am: new Date().toISOString() })}>
              Anzahlung eingegangen
            </button>
          )}
          {kannRestzahlung && (
            <button onClick={() => statusSetzen({ status: 'bezahlt', restzahlung_eingegangen_am: new Date().toISOString() })}>
              Restzahlung eingegangen
            </button>
          )}
          {kannAbschliessen && (
            <button onClick={() => statusSetzen({ status: 'abgeschlossen' })}>Abschließen</button>
          )}
          {kannStorno && (
            <button className="btn-gefahr" onClick={() => setDialog('storno')}>Stornieren</button>
          )}
          {kannAblehnen && (
            <button className="btn-gefahr" onClick={() => statusSetzen({ status: 'abgelehnt' })}>Ablehnen</button>
          )}
          {s === 'abgeschlossen' || s === 'storniert' || s === 'abgelehnt' ? (
            <span style={{ color: 'var(--grau)', alignSelf: 'center', fontSize: 13 }}>
              Vorgang abgeschlossen — keine weiteren Aktionen.
            </span>
          ) : null}
        </div>
        {kannAnzahlungEingang && (
          <p style={{ fontSize: 13, color: 'var(--grau)', marginBottom: 0 }}>
            „Anzahlung eingegangen" erst klicken, wenn die Zahlung zu {juengsteAnzahlung!.nummer} tatsächlich auf dem Konto ist.
          </p>
        )}
        {fehler && <p className="fehler">{fehler}</p>}
      </div>

      <div className="card">
        <h2>Dokumente</h2>
        {dokumente.length === 0 ? (
          <p className="leer" style={{ padding: '12px 0' }}>Noch keine Dokumente erstellt.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Nummer</th><th>Typ</th><th>Datum</th><th className="rechts">Betrag</th><th /></tr>
            </thead>
            <tbody>
              {dokumente.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.nummer}</strong></td>
                  <td>{TYP_LABEL[d.typ]}</td>
                  <td>{datumDE(d.datum)}</td>
                  <td className="rechts">{eur(Number(d.gesamt))}</td>
                  <td className="rechts">
                    <button className="btn-klein" onClick={() => downloadArchiviertesPdf(d).catch((e) => setFehler(String(e)))}>
                      PDF herunterladen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Notizen</h2>
        <textarea rows={4} value={notizen} onChange={(e) => setNotizen(e.target.value)} placeholder="Interne Notizen zu dieser Anfrage …" />
        <div style={{ marginTop: 10 }}>
          <button className="btn-klein" onClick={notizenSpeichern}>Notizen speichern</button>
        </div>
      </div>

      <div className="card" style={{ borderColor: '#f0d6d8' }}>
        <h2>Anfrage löschen</h2>
        {!loeschBestaetigung ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--grau)', marginTop: 0 }}>
              Löscht diese Anfrage samt aller erstellten Dokumente unwiderruflich. Zum Entfernen von Testdaten gedacht.
            </p>
            <button className="btn-gefahr" onClick={() => setLoeschBestaetigung(true)}>Anfrage löschen</button>
          </>
        ) : (
          <>
            <div className="warnung">
              Wirklich <strong>{buchung.vorname} {buchung.nachname}</strong>
              {dokumente.length > 0 && <> samt {dokumente.length} {dokumente.length === 1 ? 'Dokument' : 'Dokumenten'}</>}
              {' '}endgültig löschen? Das kann nicht rückgängig gemacht werden.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setLoeschBestaetigung(false)} disabled={loescht}>Abbrechen</button>
              <button className="btn-gefahr" onClick={anfrageLoeschen} disabled={loescht}>
                {loescht ? 'Wird gelöscht …' : 'Ja, endgültig löschen'}
              </button>
            </div>
          </>
        )}
      </div>

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
    </>
  )
}
