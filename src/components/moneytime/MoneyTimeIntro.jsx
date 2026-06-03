import { useState, useEffect } from 'react'

// ─── colour palette ───────────────────────────────────────────────────
const C = {
  _: null,
  H: '#2C1503', s: '#F5CBA7', e: '#1A1010',
  B: '#2471A3', P: '#1A5276',
  h: '#D4A017', T: '#C8306A', J: '#2C3E50',
  K: '#0D0D15', W: '#E8E8D8', N: '#9E8E7E',
  G: '#FFD700', g: '#B8960C', c: '#E8001C',
  q: '#FFFDE0',
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

// ─── pixel art ───────────────────────────────────────────────────────
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

const TILLY_S1 = [
  '__KKKK___',
  '_KKWWWKK_',
  'KKWgWgWKK',
  'KKWWsWWKK',
  'KWWWNWWkK',
  '_KWWWWWk_',
  '__cKKKc__',
  '___KWK___',
  '__KKWKK__',
  '_KKKwKKK_',
  '___KKK___',
]

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
// Pre-generate stable random delays so re-renders don't reshuffle them
const DISSOLVE_COLS = 20
const DISSOLVE_ROWS = 14
const DISSOLVE_DELAYS = Array.from(
  { length: DISSOLVE_COLS * DISSOLVE_ROWS },
  () => Math.random()
)

// phase:
//   'idle'         — cells transparent, no transition   (scene is visible)
//   'cover-fast'   — cells opaque, no transition        (instant blackout)
//   'clear'        — cells animate to transparent       (reveal scene)
//   'cover-slow'   — cells animate to opaque            (final dissolve out)
function Dissolve({ phase }) {
  const cells = []
  for (let r = 0; r < DISSOLVE_ROWS; r++) {
    for (let co = 0; co < DISSOLVE_COLS; co++) {
      const idx = r * DISSOLVE_COLS + co
      const rand = DISSOLVE_DELAYS[idx]

      let opacity, transition
      if (phase === 'idle') {
        opacity = 0; transition = 'none'
      } else if (phase === 'cover-fast') {
        opacity = 1; transition = 'none'
      } else if (phase === 'clear') {
        opacity = 0; transition = `opacity 0.28s ease ${(rand * 0.28).toFixed(3)}s`
      } else { // cover-slow
        opacity = 1; transition = `opacity 0.28s ease ${(rand * 0.28).toFixed(3)}s`
      }

      cells.push(
        <div key={idx} style={{
          position: 'absolute',
          left: `${(co / DISSOLVE_COLS) * 100}%`,
          top: `${(r / DISSOLVE_ROWS) * 100}%`,
          width: `${100 / DISSOLVE_COLS}%`,
          height: `${100 / DISSOLVE_ROWS}%`,
          background: '#0f1623',
          opacity,
          transition,
          willChange: 'opacity',
        }} />
      )
    }
  }
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {cells}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────
export default function MoneyTimeIntro({ onDone }) {
  const [scene, setScene] = useState(1)
  const [textIdx, setTextIdx] = useState(0)
  const [dissolvePhase, setDissolvePhase] = useState('idle')
  const [sparkle, setSparkle] = useState(false)
  const TITLE = 'MONEY TIME'

  // ── 5-second timeline ──
  // 0-3s   Scene 1 (wide shot)
  // 3s     Pixel cover (instant blackout)
  // 3.05s  Switch to Scene 2 + begin pixel clear (reveal over 0.3s)
  // 3.6s   Glasses sparkle
  // 4.5s   Final pixel cover-slow (animated dissolve out, 0.3s+delay)
  // 5s     onDone → app appears
  useEffect(() => {
    const timers = [
      setTimeout(() => setDissolvePhase('cover-fast'),               3000),
      setTimeout(() => { setScene(2); setDissolvePhase('clear') },   3050),
      setTimeout(() => setSparkle(true),                             3600),
      setTimeout(() => setDissolvePhase('cover-slow'),               4500),
      setTimeout(() => onDone(),                                     5000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // letter-by-letter title in scene 2
  useEffect(() => {
    if (scene !== 2 || textIdx >= TITLE.length) return
    const t = setTimeout(() => setTextIdx(i => i + 1), 85)
    return () => clearTimeout(t)
  }, [scene, textIdx])

  const PS1 = 7
  const PS2 = 12

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#0f1623', overflow: 'hidden',
      fontFamily: 'VT323, monospace',
    }}>
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0);    opacity: 1; }
          100% { transform: translateY(-60px); opacity: 0; }
        }
        @keyframes wagLeft  { 0%,100% { transform: rotate(0deg); }  50% { transform: rotate(20deg); } }
        @keyframes rustle   { 0%,100% { transform: rotate(-1deg); } 50% { transform: rotate(2deg); } }
        @keyframes sparkAnim { 0%,100% { opacity:0; transform:scale(0.5); } 50% { opacity:1; transform:scale(1.3); } }
        @keyframes sceneIn  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* ── SCENE 1 — wide shot (0-3s) ── */}
      {scene === 1 && (
        <svg viewBox="0 0 800 450"
          style={{ width: '100%', height: '100%', display: 'block', animation: 'sceneIn 0.35s ease' }}>

          {/* wall */}
          <rect x="0" y="0" width="800" height="360" fill="#0f1623"/>
          <rect x="0" y="338" width="800" height="4" fill="#1a2744" opacity="0.7"/>

          {/* floor planks */}
          <rect x="0" y="342" width="800" height="108" fill="#2D1A0A"/>
          {[0,1,2,3,4].map(i => (
            <rect key={i} x={i * 200} y="342" width="198" height="108" fill="#3D2210" opacity="0.25"/>
          ))}
          {[1,2,3,4].map(i => (
            <rect key={i} x={i * 200} y="342" width="2" height="108" fill="#1a0f05"/>
          ))}

          {/* sofa back */}
          <rect x="155" y="188" width="490" height="122" rx="6" fill="#6B3520"/>
          <rect x="155" y="188" width="490" height="16" rx="4" fill="#8B4513"/>
          {/* arms */}
          <rect x="144" y="198" width="32" height="112" rx="4" fill="#5A2D18"/>
          <rect x="624" y="198" width="32" height="112" rx="4" fill="#5A2D18"/>
          {/* seat */}
          <rect x="155" y="300" width="490" height="52" rx="3" fill="#7B3D22"/>
          {/* cushion divider */}
          <rect x="392" y="198" width="4" height="102" fill="#5A2D18" opacity="0.5"/>

          {/* coffee table */}
          <rect x="285" y="344" width="230" height="14" rx="2" fill="#4A2810"/>
          <rect x="305" y="357" width="8" height="28" fill="#3A2010"/>
          <rect x="487" y="357" width="8" height="28" fill="#3A2010"/>

          {/* papers (rustling) */}
          <g style={{ transformOrigin: '358px 338px', animation: 'rustle 2s ease-in-out infinite' }}>
            <rect x="326" y="328" width="38" height="20" fill="#FFFDE0" rx="1"/>
            <rect x="332" y="332" width="14" height="2" fill="#bbb"/>
            <rect x="332" y="336" width="10" height="2" fill="#bbb"/>
            <rect x="332" y="340" width="12" height="2" fill="#bbb"/>
          </g>
          <rect x="348" y="326" width="34" height="20" fill="#FFF8C0" rx="1" opacity="0.85"/>
          <rect x="368" y="324" width="30" height="22" fill="#FFFDE0" rx="1" opacity="0.75"/>

          {/* floating € */}
          {[
            { x: 340, delay: '0s'    },
            { x: 368, delay: '0.65s' },
            { x: 393, delay: '1.2s'  },
          ].map(({ x, delay }, i) => (
            <text key={i} x={x} y="322"
              fontFamily="VT323, monospace" fontSize="15" fill="#4eff91"
              style={{ animation: `floatUp 1.7s ease-in-out ${delay} infinite` }}>
              €
            </text>
          ))}

          {/* Piers */}
          <Px art={PIERS} ps={PS1} x={220} y={198} />

          {/* Canelle */}
          <Px art={CANELLE} ps={PS1} x={462} y={208} />

          {/* Tilly + wagging tail */}
          <Px art={TILLY_S1} ps={PS1} x={355} y={295} />
          <rect x="339" y="348" width="5" height="22" rx="2" fill="#0D0D15"
            style={{ transformOrigin: '341px 348px', animation: 'wagLeft 0.75s ease-in-out infinite' }}/>

          {/* scanlines */}
          {Array.from({ length: 17 }, (_, i) => (
            <rect key={i} x="0" y={i * 27} width="800" height="1"
              fill="#6ab4ff" opacity="0.04"/>
          ))}

          {/* vignette */}
          <defs>
            <radialGradient id="vig" cx="50%" cy="50%" r="72%">
              <stop offset="0%" stopColor="transparent"/>
              <stop offset="100%" stopColor="#000" stopOpacity="0.5"/>
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="800" height="450" fill="url(#vig)"/>
        </svg>
      )}

      {/* ── SCENE 2 — Tilly close-up (3-5s) ── */}
      {scene === 2 && (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 24,
          animation: 'sceneIn 0.2s ease',
        }}>
          <svg viewBox="0 0 600 340"
            style={{ width: '80%', maxWidth: 600, maxHeight: 340 }}>
            <rect x="0" y="0" width="600" height="340" fill="#0f1623"/>

            {/* Tilly close-up */}
            <Px art={TILLY_S2} ps={PS2} x={158} y={24} />

            {/* Facture document */}
            <Px art={FACTURE_S2} ps={PS2} x={432} y={110} />
            <text x="434" y="108" fontFamily="VT323,monospace" fontSize="14"
              fill="#5A3010" letterSpacing="1">FACTURE</text>

            {/* Glasses sparkle */}
            {sparkle && <>
              <g style={{ animation: 'sparkAnim 0.75s ease 0.1s 4' }}>
                <text x="188" y="93" fontSize="16" fill="#FFD700" fontFamily="monospace">✦</text>
              </g>
              <g style={{ animation: 'sparkAnim 0.75s ease 0.35s 4' }}>
                <text x="336" y="93" fontSize="16" fill="#FFD700" fontFamily="monospace">✦</text>
              </g>
            </>}

            {/* scanlines */}
            {Array.from({ length: 11 }, (_, i) => (
              <rect key={i} x="0" y={i * 32} width="600" height="1"
                fill="#6ab4ff" opacity="0.05"/>
            ))}
          </svg>

          {/* Typing title */}
          <div style={{
            fontSize: 76, color: '#6ab4ff', letterSpacing: '0.1em',
            textShadow: '0 0 28px rgba(106,180,255,0.5), 0 0 56px rgba(106,180,255,0.2)',
            minHeight: 84, textAlign: 'center', lineHeight: 1,
          }}>
            {TITLE.slice(0, textIdx)}
            <span style={{
              opacity: textIdx < TITLE.length ? 1 : 0,
              color: '#4eff91',
              animation: textIdx < TITLE.length ? 'none' : undefined,
            }}>_</span>
          </div>
        </div>
      )}

      {/* ── PIXEL DISSOLVE (between scenes + final) ── */}
      <Dissolve phase={dissolvePhase} />

      {/* ── SKIP ── */}
      <button
        onClick={onDone}
        style={{
          position: 'absolute', bottom: 20, right: 24, zIndex: 20,
          background: 'rgba(106,180,255,0.1)',
          border: '1px solid rgba(106,180,255,0.3)',
          borderRadius: 4, padding: '6px 14px',
          color: 'rgba(106,180,255,0.65)',
          fontFamily: 'VT323, monospace', fontSize: 18,
          cursor: 'pointer', letterSpacing: '0.1em',
        }}
      >SKIP ▶</button>
    </div>
  )
}
