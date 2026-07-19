import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import PasswortNeu from './pages/PasswortNeu'
import AnfragenListe from './pages/AnfragenListe'
import AnfrageNeu from './pages/AnfrageNeu'
import AnfrageDetail from './pages/AnfrageDetail'
import Kalender from './pages/Kalender'
import Auswertung from './pages/Auswertung'
import Einstellungen from './pages/Einstellungen'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [passwortReset, setPasswortReset] = useState(false)
  const [laedt, setLaedt] = useState(true)
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
        <nav>
          <NavLink to="/anfragen" className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Anfragen
          </NavLink>
          <NavLink to="/kalender" className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Kalender
          </NavLink>
          <NavLink to="/auswertung" className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Auswertung
          </NavLink>
          <NavLink to="/einstellungen" className={({ isActive }) => (isActive ? 'aktiv' : '')}>
            Einstellungen
          </NavLink>
        </nav>
        <button className="btn-klein" onClick={abmelden}>Abmelden</button>
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
          <Route path="*" element={<Navigate to="/anfragen" replace />} />
        </Routes>
      </main>
    </>
  )
}
