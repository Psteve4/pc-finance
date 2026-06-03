import { useState, useRef } from 'react'
import LandingPage from './components/LandingPage.jsx'
import MoneyTime from './components/moneytime/MoneyTime.jsx'
import CanelleVisuels from './components/canelle/CanelleVisuels.jsx'
import { supabase } from './lib/supabase.js'

const PASSWORD = 'canpie2024'

export default function App() {
  const [app, setApp] = useState(null)
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('auth') === '1')
  const [lang, setLang] = useState('en')
  const [mtVideoSeen, setMtVideoSeen] = useState(() => !!sessionStorage.getItem('mt_video_seen'))
  const [cvVideoSeen, setCvVideoSeen] = useState(() => !!sessionStorage.getItem('cv_video_seen'))

  const handleAuth = (pw) => {
    if (pw === PASSWORD) {
      sessionStorage.setItem('auth', '1')
      setAuthed(true)
      return true
    }
    return false
  }

  if (!authed) {
    return <LoginScreen onAuth={handleAuth} lang={lang} setLang={setLang} />
  }

  if (!app) {
    return <LandingPage onSelect={setApp} lang={lang} setLang={setLang} />
  }

  if (app === 'moneytime' && !mtVideoSeen) {
    return <VideoIntro src="/money-time-intro.mp4" onDone={() => {
      sessionStorage.setItem('mt_video_seen', '1')
      setMtVideoSeen(true)
    }} />
  }

  if (app === 'canelle' && !cvVideoSeen) {
    return <VideoIntro src="/canelle-intro.mp4" onDone={() => {
      sessionStorage.setItem('cv_video_seen', '1')
      setCvVideoSeen(true)
    }} />
  }

  if (app === 'moneytime') {
    return <MoneyTime onBack={() => setApp(null)} lang={lang} setLang={setLang} />
  }

  return <CanelleVisuels onBack={() => setApp(null)} lang={lang} setLang={setLang} />
}

function VideoIntro({ src, onDone }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000 }}>
      <video
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <button
        onClick={onDone}
        style={{
          position: 'absolute', bottom: 24, right: 28, zIndex: 10,
          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: 4, padding: '8px 16px', color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', letterSpacing: '0.05em'
        }}
      >SKIP ▶</button>
    </div>
  )
}

function LoginScreen({ onAuth, lang, setLang }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)

  const T = {
    en: { title: 'P & C Finance', sub: 'Our private money space', placeholder: 'Password', btn: 'Enter', wrong: 'Wrong password' },
    fr: { title: 'P & C Finance', sub: 'Notre espace argent privé', placeholder: 'Mot de passe', btn: 'Entrer', wrong: 'Mauvais mot de passe' }
  }[lang]

  const submit = (e) => {
    e.preventDefault()
    if (!onAuth(pw)) {
      setErr(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      setPw('')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: '#080810',
      fontFamily: 'Space Grotesk, sans-serif'
    }}>
      <div style={{ position: 'absolute', top: 20, right: 24, display: 'flex', gap: 8 }}>
        {['en','fr'].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            background: lang === l ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: lang === l ? '#fff' : 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.1)', textTransform: 'uppercase',
            cursor: 'pointer', fontFamily: 'inherit'
          }}>{l}</button>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.3)', marginBottom: 16
        }}>Private</div>
        <h1 style={{
          fontSize: 48, fontWeight: 700, color: '#fff',
          fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.05em'
        }}>{T.title}</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 8 }}>{T.sub}</p>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          placeholder={T.placeholder}
          style={{
            padding: '14px 20px', borderRadius: 10, fontSize: 16,
            background: 'rgba(255,255,255,0.07)', border: `1.5px solid ${err ? '#ff4e4e' : 'rgba(255,255,255,0.12)'}`,
            color: '#fff', width: '100%', fontFamily: 'Space Grotesk, sans-serif',
            animation: shake ? 'shake 0.4s ease' : 'none',
            transition: 'border-color 0.2s'
          }}
          autoFocus
        />
        {err && <p style={{ fontSize: 12, color: '#ff4e4e', textAlign: 'center' }}>{T.wrong}</p>}
        <button type="submit" style={{
          padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 600,
          background: 'rgba(255,255,255,0.1)', color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.15)',
          fontFamily: 'Space Grotesk, sans-serif', transition: 'all 0.2s'
        }} onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.18)'}
           onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.1)'}>
          {T.btn}
        </button>
      </form>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-8px); }
          40%,80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}
