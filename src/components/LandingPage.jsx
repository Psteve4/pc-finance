import { useState } from 'react'

export default function LandingPage({ onSelect, lang, setLang }) {
  const [hovered, setHovered] = useState(null)

  const T = {
    en: {
      choose: 'Choose your space',
      mt_sub: 'Budget · Savings · Accounts',
      cv_sub: 'Business · URSSAF · Income',
      lang_toggle: 'FR'
    },
    fr: {
      choose: 'Choisissez votre espace',
      mt_sub: 'Budget · Épargne · Comptes',
      cv_sub: 'Activité · URSSAF · Revenus',
      lang_toggle: 'EN'
    }
  }[lang]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: '#080810', fontFamily: 'Space Grotesk, sans-serif',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }}/>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
          P & C
        </div>
        <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
          border: '1px solid rgba(255,255,255,0.1)', textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'inherit'
        }}>{T.lang_toggle}</button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 12, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 48, fontWeight: 600 }}>
          {T.choose}
        </p>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 900 }}>

          {/* MONEY TIME — Vista retro */}
          <AppCard
            id="moneytime"
            hovered={hovered === 'moneytime'}
            onHover={setHovered}
            onClick={() => onSelect('moneytime')}
            theme="vista"
            badge="Retro Windows"
          >
            <div style={{
              fontFamily: 'VT323, monospace', fontSize: 52,
              color: '#6ab4ff', letterSpacing: '0.05em',
              textShadow: '0 0 20px rgba(106,180,255,0.4)',
              lineHeight: 1
            }}>Money<br/>Time</div>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: 12,
              color: 'rgba(106,180,255,0.6)', marginTop: 12, letterSpacing: '0.1em'
            }}>{T.mt_sub}</div>
            <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['€ Budget','📊 Charts','🏦 Accounts','💡 Tips'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 3,
                  background: 'rgba(106,180,255,0.1)', color: 'rgba(106,180,255,0.7)',
                  border: '1px solid rgba(106,180,255,0.2)', fontFamily: 'Share Tech Mono, monospace'
                }}>{tag}</span>
              ))}
            </div>
          </AppCard>

          {/* CANELLE VISUELS — Black/red modern */}
          <AppCard
            id="canelle"
            hovered={hovered === 'canelle'}
            onHover={setHovered}
            onClick={() => onSelect('canelle')}
            theme="canelle"
            badge="Pro Studio"
          >
            <div style={{ lineHeight: 1 }}>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.01em' }}>Canelle</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 32, fontWeight: 700, color: '#f5c000', letterSpacing: '-0.01em' }}>.visuels</span>
            </div>
            <div style={{
              fontSize: 12, color: 'rgba(240,240,240,0.4)',
              marginTop: 12, letterSpacing: '0.1em', fontWeight: 500
            }}>{T.cv_sub}</div>
            <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['URSSAF', 'Factures', 'Historique', 'Objectifs'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 3,
                  background: 'rgba(245,192,0,0.12)', color: '#c9a200',
                  border: '1px solid rgba(245,192,0,0.25)', fontWeight: 600,
                  letterSpacing: '0.05em'
                }}>{tag}</span>
              ))}
            </div>
          </AppCard>

        </div>
      </div>
    </div>
  )
}

function AppCard({ id, hovered, onHover, onClick, theme, badge, children }) {
  const isVista = theme === 'vista'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      style={{
        width: 360, minHeight: 280, padding: 36, borderRadius: 16,
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        transform: hovered ? 'translateY(-6px) scale(1.01)' : 'translateY(0) scale(1)',
        background: isVista
          ? 'linear-gradient(135deg, #1a2744 0%, #243058 60%, #1e2a4d 100%)'
          : '#0d0d0d',
        border: isVista
          ? `1.5px solid ${hovered ? '#6ab4ff' : 'rgba(106,180,255,0.25)'}`
          : `1.5px solid ${hovered ? '#f5c000' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: hovered
          ? isVista
            ? '0 20px 60px rgba(106,180,255,0.2), 0 0 0 1px rgba(106,180,255,0.15)'
            : '0 20px 60px rgba(245,192,0,0.18), 0 0 0 1px rgba(245,192,0,0.12)'
          : '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -60, right: -60,
        width: 180, height: 180, borderRadius: '50%',
        background: isVista ? 'rgba(106,180,255,0.06)' : 'rgba(245,192,0,0.04)',
        filter: 'blur(30px)', pointerEvents: 'none'
      }}/>

      {/* Badge */}
      <div style={{
        display: 'inline-block', marginBottom: 24, padding: '4px 10px',
        borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
        textTransform: 'uppercase',
        background: isVista ? 'rgba(106,180,255,0.1)' : 'rgba(245,192,0,0.1)',
        color: isVista ? 'rgba(106,180,255,0.7)' : '#c9a200',
        border: `1px solid ${isVista ? 'rgba(106,180,255,0.2)' : 'rgba(245,192,0,0.25)'}`,
        fontFamily: 'Space Grotesk, sans-serif'
      }}>{badge}</div>

      {children}

      {/* Arrow */}
      <div style={{
        position: 'absolute', bottom: 24, right: 24,
        fontSize: 20, color: isVista ? 'rgba(106,180,255,0.4)' : 'rgba(255,255,255,0.15)',
        transition: 'all 0.2s',
        transform: hovered ? 'translate(3px,-3px)' : 'none',
        opacity: hovered ? 1 : 0.5
      }}>→</div>
    </div>
  )
}
