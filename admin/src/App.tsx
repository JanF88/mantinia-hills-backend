import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import PasswortNeu from './pages/PasswortNeu'
import AngebotAngenommen from './pages/AngebotAngenommen'
import AnfragenListe from './pages/AnfragenListe'
import AnfrageNeu from './pages/AnfrageNeu'
import AnfrageDetail from './pages/AnfrageDetail'
import Kalender from './pages/Kalender'
import Auswertung from './pages/Auswertung'
import Benutzer from './pages/Benutzer'
import Einstellungen from './pages/Einstellungen'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [passwortReset, setPasswortReset] = useState(false)
  const [laedt, setLaedt] = useState(true)
  const [menuOffen, setMenuOffen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLaedt(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setPasswortReset(true)
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Öffentliche Dankesseite (Gast ohne Login, nach „Angebot annehmen")
  if (window.location.pathname === '/angebot-angenommen') return <AngebotAngenommen />

  if (laedt) return null
  if (passwortReset) {
    return <PasswortNeu onFertig={() => { setPasswortReset(false); navigate('/anfragen') }} />
  }
  if (!session) return <Login />

  async function abmelden() {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <>
      <header className="topbar">
        <h1>Mantinia Hills</h1>
        <button
          className="burger"
          aria-label="Menü"
          aria-expanded={menuOffen}
          onClick={() => setMenuOffen((o) => !o)}
        >
          {menuOffen ? '✕' : '☰'}
        </button>
        <nav className={menuOffen ? 'offen' : ''}>
          <NavLink to="/anfragen" onClick={() => setMenuOffen(false)} className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Anfragen
          </NavLink>
          <NavLink to="/kalender" onClick={() => setMenuOffen(false)} className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Kalender
          </NavLink>
          <NavLink to="/auswertung" onClick={() => setMenuOffen(false)} className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Auswertung
          </NavLink>
          <NavLink to="/einstellungen" onClick={() => setMenuOffen(false)} className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Einstellungen
          </NavLink>
          <NavLink to="/benutzer" onClick={() => setMenuOffen(false)} className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Benutzer
          </NavLink>
          <button className="btn-klein nav-abmelden" onClick={() => { setMenuOffen(false); abmelden() }}>Abmelden</button>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/anfragen" replace />} />
          <Route path="/anfragen" element={<AnfragenListe />} />
          <Route path="/anfragen/neu" element={<AnfrageNeu />} />
          <Route path="/anfragen/:id" element={<AnfrageDetail />} />
          <Route path="/kalender" element={<Kalender />} />
          <Route path="/auswertung" element={<Auswertung />} />
          <Route path="/einstellungen" element={<Einstellungen />} />
          <Route path="/benutzer" element={<Benutzer />} />
          <Route path="*" element={<Navigate to="/anfragen" replace />} />
        </Routes>
      </main>
    </>
  )
}
