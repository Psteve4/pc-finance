import { useState, useEffect } from 'react'

// ─── colour palette ───────────────────────────────────────────────────
const C = {
  _: null,
  // Piers
  H: '#2C1503', s: '#F5CBA7', e: '#1A1010',
  B: '#2471A3', P: '#1A5276',
  // Canelle
  h: '#D4A017', T: '#C8306A', J: '#2C3E50',
  // Tilly
  K: '#0D0D15', W: '#E8E8D8', N: '#9E8E7E',
  G: '#FFD700', g: '#B8960C', c: '#E8001C',
  // Room
  q: '#FFFDE0', // paper
  u: '#4eff91', // euro green
}

// ─── pixel art renderer ───────────────────────────────────────────────
function Px({ art, ps, x = 0, y = 0 }) {
  return art.flatMap((row, r) =>
    [...row].map((ch, ci) => {
      const fill = C[ch]
      return fill ? (
        <rect key={`${r}-${ci}`}
          x={x + ci * ps} y={y + r * ps}
          width={ps} height={ps} fill={fill}
          shapeRendering="crispEdges" />
      ) : null
    })
  )
}

// ─── pixel art definitions ────────────────────────────────────────────

// Piers – 9 wide × 12 tall, sitting
const PIERS = [
  '__HHHH___',
  '_HHHHHH__',
  '_HsssssH_',
  '_HsesesH_',
  '__sssss__',
  '_BBBBBBB_',
  '_BBBBBBB_',
  '_BBBBBBB_',
  'PP_____PP',
  'PP_____PP',
  'PP_____PP',
  '_________',
]

// Canelle – 9 wide × 11 tall, sitting
const CANELLE = [
  '_hhhhhhh_',
  'hhssssshh',
  '_hsesessh',
  '__sssss__',
  '_TTTTTTT_',
  '_TTTTTTT_',
  '_TTTTTTT_',
  'JJ_____JJ',
  'JJ_____JJ',
  'JJ_____JJ',
  '_________',
]

// Tilly scene-1 – 9 wide × 11 tall, sitting with tiny glasses
const TILLY_S1 = [
  '__KKKK___',
  '_KKWWWKK_',
  'KKWgWgWKK',
  'KKWWsWWKK', // s=snout-skin
  'KWWWNWWkK',
  '_KWWWWWk_',
  '__cKKKc__',
  '___KWK___',
  '__KKWKK__',
  '_KKKwKKK_',
  '___KKK___',
]

// Tilly scene-2 close-up – 14 wide × 15 tall
const TILLY_S2 = [
  '___KKKKKKKK___',
  '__KKWWWWWWkK__',
  '_KKWWWWWWWWkK_',
  'KKWWWWWWWWWWkK',
  'KWWggGWWWggGWK',
  'KWWgGeWWWgGeWK',
  'KWWggGWWWggGWK',
  'KWWWWWWWWWWWwK',
  'KWWWWWWWWWWwwK',
  'KWWWWNNNNWWwwK',
  'KWWWWNssNWWwwK',
  '_KWWWWWWWWWwK_',
  '__KKWWWWWWKk__',
  '___KKKWWKKK___',
  '____KKKKKK____',
]

// Facture document – 7 wide × 9 tall (paper + lines)
const FACTURE_S2 = [
  'qqqqqqq',
  'q_____q',
  'qKKKK_q',
  'q_____q',
  'qKKK__q',
  'q_____q',
  'qKK___q',
  'q_____q',
  'qqqqqqq',
]

// ─── dissolve overlay ─────────────────────────────────────────────────
function Dissolve({ active }) {
  const COLS = 20, ROWS = 14
  const cells = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const delay = Math.random() * 0.4
      cells.push(
        <div key={`${r}-${c}`} style={{
          position: 'absolute',
          left: `${(c / COLS) * 100}%`,
          top: `${(r / ROWS) * 100}%`,
          width: `${100 / COLS}%`,
          height: `${100 / ROWS}%`,
          background: '#0f1623',
          opacity: active ? 0 : 1,
          transition: active ? `opacity 0.35s ease ${delay}s` : 'none',
        }} />
      )
    }
  }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {cells}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────
export default function MoneyTimeIntro({ onDone }) {
  const [scene, setScene] = useState(1)
  const [textIdx, setTextIdx] = useState(0)
  const [dissolving, setDissolving] = useState(false)
  const [sparkle, setSparkle] = useState(false)
  const TITLE = 'MONEY TIME'

  // timeline
  useEffect(() => {
    const t1 = setTimeout(() => setScene(2), 2100)
    const t2 = setTimeout(() => setSparkle(true), 2400)
    const t3 = setTimeout(() => setDissolving(true), 3200)
    const t4 = setTimeout(() => onDone(), 3700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  // letter-by-letter title
  useEffect(() => {
    if (scene !== 2 || textIdx >= TITLE.length) return
    const t = setTimeout(() => setTextIdx(i => i + 1), 90)
    return () => clearTimeout(t)
  }, [scene, textIdx])

  const PS1 = 7   // scene-1 pixel size
  const PS2 = 12  // scene-2 pixel size

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#0f1623', overflow: 'hidden',
      fontFamily: 'VT323, monospace',
    }}>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0);   opacity: 1; }
          100% { transform: translateY(-64px); opacity: 0; }
        }
        @keyframes wagLeft  { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(22deg); } }
        @keyframes wagRight { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-22deg); } }
        @keyframes rustle   { 0%,100% { transform: rotate(-1deg); } 50% { transform: rotate(2deg); } }
        @keyframes sparkle  { 0%,100% { opacity: 0; transform: scale(0.6); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes sceneIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes glassGlint { 0%,80%,100% { opacity:0 } 90% { opacity:1 } }
      `}</style>

      {/* ── SCENE 1 ── */}
      {scene === 1 && (
        <svg viewBox="0 0 800 450" style={{ width: '100%', height: '100%', display: 'block', animation: 'sceneIn 0.4s ease' }}>

          {/* wall */}
          <rect x="0" y="0" width="800" height="360" fill="#0f1623"/>
          {/* wall panelling hint */}
          <rect x="0" y="340" width="800" height="4" fill="#1a2744" opacity="0.8"/>

          {/* floor */}
          <rect x="0" y="344" width="800" height="106" fill="#2D1A0A"/>
          {[0,1,2,3,4].map(i => (
            <rect key={i} x={i * 200} y="344" width="198" height="106" fill="#3D2210" opacity="0.3"/>
          ))}
          {[1,2,3,4].map(i => (
            <rect key={i} x={i * 200} y="344" width="2" height="106" fill="#1a0f05"/>
          ))}

          {/* sofa back */}
          <rect x="160" y="190" width="480" height="120" rx="6" fill="#6B3520"/>
          <rect x="160" y="190" width="480" height="18" rx="4" fill="#8B4513"/>
          {/* sofa arms */}
          <rect x="150" y="200" width="30" height="110" rx="4" fill="#5A2D18"/>
          <rect x="620" y="200" width="30" height="110" rx="4" fill="#5A2D18"/>
          {/* sofa seat */}
          <rect x="160" y="300" width="480" height="50" rx="3" fill="#7B3D22"/>
          {/* cushion lines */}
          <rect x="390" y="200" width="4" height="100" fill="#5A2D18" opacity="0.6"/>

          {/* coffee table */}
          <rect x="290" y="345" width="220" height="14" rx="2" fill="#4A2810"/>
          <rect x="310" y="358" width="8" height="30" fill="#3A2010"/>
          <rect x="482" y="358" width="8" height="30" fill="#3A2010"/>

          {/* papers on table */}
          <g style={{ transformOrigin: '360px 340px', animation: 'rustle 1.8s ease-in-out infinite' }}>
            <rect x="330" y="330" width="36" height="18" fill="#FFFDE0" rx="1"/>
            <rect x="336" y="333" width="14" height="2" fill="#aaa"/>
            <rect x="336" y="337" width="10" height="2" fill="#aaa"/>
            <rect x="336" y="341" width="12" height="2" fill="#aaa"/>
          </g>
          <rect x="352" y="328" width="32" height="18" fill="#FFF8C0" rx="1" opacity="0.9"/>
          <rect x="370" y="326" width="28" height="20" fill="#FFFDE0" rx="1" opacity="0.8"/>

          {/* floating € symbols */}
          {[
            { x: 345, delay: '0s'   },
            { x: 370, delay: '0.6s' },
            { x: 390, delay: '1.1s' },
          ].map(({ x, delay }, i) => (
            <text key={i} x={x} y="325"
              fontFamily="VT323, monospace" fontSize="16" fill="#4eff91"
              style={{ animation: `floatUp 1.6s ease-in-out ${delay} infinite` }}>
              €
            </text>
          ))}

          {/* ── PIERS (left of sofa) ── */}
          <Px art={PIERS} ps={PS1} x={225} y={200} />

          {/* ── CANELLE (right of sofa) ── */}
          <Px art={CANELLE} ps={PS1} x={465} y={210} />

          {/* ── TILLY (in front of sofa, on floor) ── */}
          <Px art={TILLY_S1} ps={PS1} x={356} y={298} />

          {/* Tilly tail - animated */}
          <g style={{ transformOrigin: '400px 360px' }}>
            <rect x="340" y="350" width="5" height="20" rx="2" fill="#0D0D15"
              style={{ transformOrigin: '342px 350px', animation: 'wagLeft 0.7s ease-in-out infinite' }}/>
          </g>

          {/* vista-blue scanlines overlay */}
          {Array.from({ length: 18 }, (_, i) => (
            <rect key={i} x="0" y={i * 26} width="800" height="1"
              fill="#6ab4ff" opacity="0.04"/>
          ))}

          {/* corner vignette */}
          <defs>
            <radialGradient id="vig" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent"/>
              <stop offset="100%" stopColor="#000" stopOpacity="0.55"/>
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="800" height="450" fill="url(#vig)"/>
        </svg>
      )}

      {/* ── SCENE 2 ── */}
      {scene === 2 && (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 28,
          animation: 'sceneIn 0.3s ease',
        }}>
          <svg viewBox="0 0 600 360" style={{ width: '80%', maxWidth: 600, maxHeight: 360 }}>
            {/* bg */}
            <rect x="0" y="0" width="600" height="360" fill="#0f1623"/>

            {/* Tilly close-up, centred */}
            <Px art={TILLY_S2} ps={PS2} x={160} y={30} />

            {/* Facture paper (held to side) */}
            <Px art={FACTURE_S2} ps={PS2} x={430} y={120} />
            <text x="432" y="118" fontFamily="VT323,monospace" fontSize="13" fill="#2C1503">FACTURE</text>

            {/* glasses sparkle — left lens */}
            {sparkle && (
              <g style={{ animation: 'sparkle 0.8s ease 0.1s 3' }}>
                <text x="188" y="95" fontSize="16" fill="#FFD700" fontFamily="monospace">✦</text>
              </g>
            )}
            {/* glasses sparkle — right lens */}
            {sparkle && (
              <g style={{ animation: 'sparkle 0.8s ease 0.3s 3' }}>
                <text x="335" y="95" fontSize="16" fill="#FFD700" fontFamily="monospace">✦</text>
              </g>
            )}

            {/* scanlines */}
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x="0" y={i * 30} width="600" height="1"
                fill="#6ab4ff" opacity="0.05"/>
            ))}
          </svg>

          {/* Typing title */}
          <div style={{
            fontSize: 72, color: '#6ab4ff', letterSpacing: '0.12em',
            textShadow: '0 0 24px rgba(106,180,255,0.5), 0 0 48px rgba(106,180,255,0.2)',
            minHeight: 80, textAlign: 'center',
          }}>
            {TITLE.slice(0, textIdx)}
            <span style={{ opacity: textIdx < TITLE.length ? 1 : 0, color: '#4eff91' }}>_</span>
          </div>
        </div>
      )}

      {/* ── DISSOLVE OVERLAY ── */}
      <Dissolve active={dissolving} />

      {/* ── SKIP BUTTON ── */}
      <button
        onClick={onDone}
        style={{
          position: 'absolute', bottom: 20, right: 24, zIndex: 10,
          background: 'rgba(106,180,255,0.1)',
          border: '1px solid rgba(106,180,255,0.3)',
          borderRadius: 4, padding: '6px 14px',
          color: 'rgba(106,180,255,0.6)',
          fontFamily: 'VT323, monospace', fontSize: 18,
          cursor: 'pointer', letterSpacing: '0.1em',
        }}
      >SKIP ▶</button>
    </div>
  )
}
