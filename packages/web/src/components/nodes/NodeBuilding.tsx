/** Top-down 2D building SVGs — rooftop silhouettes, pixel-art game-map aesthetic. Pure SVG, no images. */

import React from 'react'

export interface BuildingProps {
  color: string
  active?: boolean
}

/** Inline keyframes injected once per SVG — CSS pulse animation for the active ring. */
function PulseRing({ color, cx, cy, r }: { color: string; cx: number; cy: number; r: number }) {
  const id = `pulse-${color.replace(/[^a-zA-Z0-9]/g, '')}-${r}`
  return (
    <>
      <defs>
        <style>{`@keyframes ${id}{0%,100%{opacity:.6;r:${r}px}50%{opacity:.15;r:${r + 5}px}}`}</style>
      </defs>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        style={{ animation: `${id} 1.6s ease-in-out infinite` }}
      />
    </>
  )
}

/** Rectangular active outline pulse. */
function PulseRect({
  color,
  x,
  y,
  w,
  h,
  rx = 0,
}: {
  color: string
  x: number
  y: number
  w: number
  h: number
  rx?: number
}) {
  const id = `pulseR-${color.replace(/[^a-zA-Z0-9]/g, '')}-${x}-${y}`
  return (
    <>
      <defs>
        <style>{`@keyframes ${id}{0%,100%{opacity:.6;stroke-width:3px}50%{opacity:.15;stroke-width:6px}}`}</style>
      </defs>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill="none"
        stroke={color}
        strokeWidth="3"
        style={{ animation: `${id} 1.6s ease-in-out infinite` }}
      />
    </>
  )
}

// ─── ActorBuilding ────────────────────────────────────────────────────────────
// Circular burrow entrance from above — concentric rings like a worn clearing,
// bold bunny silhouette in the center. Dark outer ring, warm earthy fill.
export function ActorBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      <image
        href="/sprites/user_node.svg"
        x="0"
        y="0"
        width="72"
        height="72"
        preserveAspectRatio="xMidYMid meet"
      />
      {active && <PulseRing color={color} cx={36} cy={36} r={33} />}
    </svg>
  )
}

// ─── EndpointBuilding ─────────────────────────────────────────────────────────
// Stone gate arch — two thick rectangular tower posts, heavy lintel crossbar,
// clear open gateway in center, capstone blocks on tower tops.
export function EndpointBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* foundation slab */}
      <rect x="6" y="16" width="60" height="46" rx="0" fill={color} fillOpacity=".14" stroke={color} strokeWidth="4" />
      {/* left tower */}
      <rect x="8" y="18" width="18" height="42" fill={color} fillOpacity=".55" stroke={color} strokeWidth="2.5" />
      {/* right tower */}
      <rect x="46" y="18" width="18" height="42" fill={color} fillOpacity=".55" stroke={color} strokeWidth="2.5" />
      {/* lintel / crossbar — heavy top beam */}
      <rect x="8" y="18" width="56" height="10" fill={color} fillOpacity=".75" stroke={color} strokeWidth="2" />
      {/* capstones on left tower top */}
      <rect x="7" y="12" width="20" height="8" fill={color} fillOpacity=".80" stroke={color} strokeWidth="2" />
      {/* capstones on right tower top */}
      <rect x="45" y="12" width="20" height="8" fill={color} fillOpacity=".80" stroke={color} strokeWidth="2" />
      {/* battlement notches — left tower top */}
      <rect x="10" y="8" width="5" height="7" fill={color} fillOpacity=".85" />
      <rect x="18" y="8" width="5" height="7" fill={color} fillOpacity=".85" />
      {/* battlement notches — right tower top */}
      <rect x="48" y="8" width="5" height="7" fill={color} fillOpacity=".85" />
      <rect x="57" y="8" width="5" height="7" fill={color} fillOpacity=".85" />
      {/* gateway void — dark opening */}
      <rect x="26" y="28" width="20" height="32" fill={color} fillOpacity=".05" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
      {/* gate door lines */}
      <line x1="36" y1="28" x2="36" y2="60" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* tower window slits */}
      <rect x="14" y="34" width="6" height="10" rx="0" fill={color} fillOpacity=".10" stroke={color} strokeWidth="1.5" />
      <rect x="52" y="34" width="6" height="10" rx="0" fill={color} fillOpacity=".10" stroke={color} strokeWidth="1.5" />
      {active && <PulseRect color={color} x={3} y={9} w={66} h={60} />}
    </svg>
  )
}

// ─── TransformBuilding ────────────────────────────────────────────────────────
// Round processing tower — thick outer ring wall, 8-spoke gear pattern radiating
// from a bold center hub. Crisp pixel gear teeth on the outer ring.
export function TransformBuilding({ color, active }: BuildingProps) {
  const cx = 36
  const cy = 36
  const spokeAngles = [0, 45, 90, 135, 180, 225, 270, 315]
  // Gear teeth: 8 rectangular protrusions on the outer ring
  const teethAngles = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer wall ring */}
      <circle cx={cx} cy={cy} r="30" fill={color} fillOpacity=".18" stroke={color} strokeWidth="5" />
      {/* gear teeth — rectangular nubs on outer edge */}
      {teethAngles.map((deg) => {
        const rad = (deg * Math.PI) / 180
        const tx = cx + 28 * Math.cos(rad)
        const ty = cy + 28 * Math.sin(rad)
        return (
          <rect
            key={deg}
            x={tx - 3}
            y={ty - 3}
            width="6"
            height="6"
            fill={color}
            fillOpacity=".80"
            transform={`rotate(${deg} ${tx} ${ty})`}
          />
        )
      })}
      {/* mid processing ring */}
      <circle cx={cx} cy={cy} r="20" fill={color} fillOpacity=".22" stroke={color} strokeWidth="2.5" strokeOpacity=".75" />
      {/* spokes */}
      {spokeAngles.map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x2 = cx + 19 * Math.cos(rad)
        const y2 = cy + 19 * Math.sin(rad)
        return (
          <line
            key={deg}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth="2.5"
            strokeOpacity=".75"
          />
        )
      })}
      {/* inner hub ring */}
      <circle cx={cx} cy={cy} r="9" fill={color} fillOpacity=".35" stroke={color} strokeWidth="2.5" />
      {/* hub center */}
      <circle cx={cx} cy={cy} r="4" fill={color} fillOpacity=".90" />
      {active && <PulseRing color={color} cx={cx} cy={cy} r={33} />}
    </svg>
  )
}

// ─── ValidationBuilding ───────────────────────────────────────────────────────
// Square fortress — thick outer walls, inner courtyard floor, bold checkmark
// painted on the roof, corner watchtower squares.
export function ValidationBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer fortress walls — thick */}
      <rect x="5" y="5" width="62" height="62" fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* inner courtyard floor */}
      <rect x="13" y="13" width="46" height="46" fill={color} fillOpacity=".22" stroke={color} strokeWidth="2" strokeOpacity=".60" />
      {/* corner watchtowers */}
      <rect x="5" y="5" width="12" height="12" fill={color} fillOpacity=".55" stroke={color} strokeWidth="2" />
      <rect x="55" y="5" width="12" height="12" fill={color} fillOpacity=".55" stroke={color} strokeWidth="2" />
      <rect x="5" y="55" width="12" height="12" fill={color} fillOpacity=".55" stroke={color} strokeWidth="2" />
      <rect x="55" y="55" width="12" height="12" fill={color} fillOpacity=".55" stroke={color} strokeWidth="2" />
      {/* corner tower inner marks */}
      <rect x="8" y="8" width="6" height="6" fill={color} fillOpacity=".80" />
      <rect x="58" y="8" width="6" height="6" fill={color} fillOpacity=".80" />
      <rect x="8" y="58" width="6" height="6" fill={color} fillOpacity=".80" />
      <rect x="58" y="58" width="6" height="6" fill={color} fillOpacity=".80" />
      {/* bold checkmark — roof glyph, crisp pixel style */}
      <polyline
        points="17,36 28,48 55,20"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeOpacity=".85"
      />
      {active && <PulseRect color={color} x={2} y={2} w={68} h={68} />}
    </svg>
  )
}

// ─── AuthBuilding ─────────────────────────────────────────────────────────────
// Pentagon citadel — thick pentagon outer wall, inner keep pentagon,
// bold lock symbol (body + shackle) as rooftop marking.
export function AuthBuilding({ color, active }: BuildingProps) {
  const cx = 36
  const cy = 37
  // Outer pentagon
  const R = 30
  const outerPts = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 - 90) * (Math.PI / 180)
    return `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`
  }).join(' ')
  // Inner pentagon (keep)
  const Ri = 18
  const innerPts = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 72 - 90) * (Math.PI / 180)
    return `${cx + Ri * Math.cos(a)},${cy + Ri * Math.sin(a)}`
  }).join(' ')
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer fortress wall */}
      <polygon points={outerPts} fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* inner keep */}
      <polygon points={innerPts} fill={color} fillOpacity=".24" stroke={color} strokeWidth="2.5" strokeOpacity=".70" />
      {/* lock body — solid rectangle */}
      <rect x="28" y="35" width="16" height="13" rx="1" fill={color} fillOpacity=".80" stroke={color} strokeWidth="1.5" />
      {/* lock shackle — U-shape arch */}
      <path
        d="M31 35 L31 29 Q36 24 41 29 L41 35"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="square"
        strokeOpacity=".85"
      />
      {/* keyhole — small rect + triangle */}
      <rect x="34" y="38" width="4" height="5" rx="1" fill={color} fillOpacity=".20" />
      {active && <PulseRing color={color} cx={cx} cy={cy} r={33} />}
    </svg>
  )
}

// ─── DatabaseBuilding ─────────────────────────────────────────────────────────
// Circular silo from above — 4 concentric rings like a barrel top cross-section,
// 4 radial seam lines, solid center cap. Very chunky and storage-like.
export function DatabaseBuilding({ color, active }: BuildingProps) {
  const cx = 36
  const cy = 36
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer rim wall */}
      <circle cx={cx} cy={cy} r="30" fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* barrel ring 2 */}
      <circle cx={cx} cy={cy} r="22" fill={color} fillOpacity=".20" stroke={color} strokeWidth="2.5" strokeOpacity=".70" />
      {/* barrel ring 3 */}
      <circle cx={cx} cy={cy} r="14" fill={color} fillOpacity=".25" stroke={color} strokeWidth="2" strokeOpacity=".65" />
      {/* inner floor fill */}
      <circle cx={cx} cy={cy} r="7" fill={color} fillOpacity=".45" stroke={color} strokeWidth="2" strokeOpacity=".75" />
      {/* center cap */}
      <circle cx={cx} cy={cy} r="3" fill={color} fillOpacity=".90" />
      {/* radial seam lines (4 × 90°) — from inner to outer */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={cx + 7 * Math.cos(rad)}
            y1={cy + 7 * Math.sin(rad)}
            x2={cx + 30 * Math.cos(rad)}
            y2={cy + 30 * Math.sin(rad)}
            stroke={color}
            strokeWidth="2"
            strokeOpacity=".45"
          />
        )
      })}
      {active && <PulseRing color={color} cx={cx} cy={cy} r={33} />}
    </svg>
  )
}

// ─── ExternalBuilding ─────────────────────────────────────────────────────────
// Square building with dashed outer border (signals "outside the system"),
// world-lines globe symbol inside: meridian circle, equator, parallels, vertical meridian.
export function ExternalBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* dashed outer wall — "foreign territory" signal */}
      <rect
        x="5"
        y="5"
        width="62"
        height="62"
        fill={color}
        fillOpacity=".14"
        stroke={color}
        strokeWidth="4"
        strokeDasharray="6 4"
      />
      {/* solid inner floor */}
      <rect x="13" y="13" width="46" height="46" fill={color} fillOpacity=".18" stroke={color} strokeWidth="2" strokeOpacity=".50" />
      {/* globe meridian outer circle */}
      <circle cx="36" cy="36" r="16" fill="none" stroke={color} strokeWidth="2.5" strokeOpacity=".80" />
      {/* equator — horizontal */}
      <line x1="20" y1="36" x2="52" y2="36" stroke={color} strokeWidth="2" strokeOpacity=".70" />
      {/* parallel above */}
      <line x1="23" y1="27" x2="49" y2="27" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* parallel below */}
      <line x1="23" y1="45" x2="49" y2="45" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* prime meridian — vertical */}
      <line x1="36" y1="20" x2="36" y2="52" stroke={color} strokeWidth="2" strokeOpacity=".70" />
      {/* globe meridian ellipse (angled longitude) */}
      <ellipse cx="36" cy="36" rx="8" ry="16" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity=".55" />
      {/* corner outward-pointing arrows — signal "external" */}
      <polyline points="8,8 15,8 15,15" fill="none" stroke={color} strokeWidth="2" strokeOpacity=".65" />
      <polyline points="64,8 57,8 57,15" fill="none" stroke={color} strokeWidth="2" strokeOpacity=".65" />
      <polyline points="8,64 15,64 15,57" fill="none" stroke={color} strokeWidth="2" strokeOpacity=".65" />
      <polyline points="64,64 57,64 57,57" fill="none" stroke={color} strokeWidth="2" strokeOpacity=".65" />
      {active && <PulseRect color={color} x={2} y={2} w={68} h={68} />}
    </svg>
  )
}

// ─── CacheBuilding ────────────────────────────────────────────────────────────
// Square bunker — thick outer walls, 4 prominent corner towers (solid filled squares),
// large lightning bolt filling the interior as the rooftop marking.
export function CacheBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer bunker wall */}
      <rect x="5" y="5" width="62" height="62" fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* inner floor area */}
      <rect x="16" y="16" width="40" height="40" fill={color} fillOpacity=".20" stroke={color} strokeWidth="2" strokeOpacity=".55" />
      {/* corner towers — solid prominent squares */}
      <rect x="5" y="5" width="14" height="14" fill={color} fillOpacity=".60" stroke={color} strokeWidth="2.5" />
      <rect x="53" y="5" width="14" height="14" fill={color} fillOpacity=".60" stroke={color} strokeWidth="2.5" />
      <rect x="5" y="53" width="14" height="14" fill={color} fillOpacity=".60" stroke={color} strokeWidth="2.5" />
      <rect x="53" y="53" width="14" height="14" fill={color} fillOpacity=".60" stroke={color} strokeWidth="2.5" />
      {/* tower inner fill — darker center */}
      <rect x="8" y="8" width="8" height="8" fill={color} fillOpacity=".85" />
      <rect x="56" y="8" width="8" height="8" fill={color} fillOpacity=".85" />
      <rect x="8" y="56" width="8" height="8" fill={color} fillOpacity=".85" />
      <rect x="56" y="56" width="8" height="8" fill={color} fillOpacity=".85" />
      {/* lightning bolt — big bold roof glyph */}
      <polygon
        points="42,14 25,37 33,37 30,58 47,35 39,35"
        fill={color}
        fillOpacity=".82"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity=".90"
      />
      {active && <PulseRect color={color} x={2} y={2} w={68} h={68} />}
    </svg>
  )
}

// ─── QueueBuilding ────────────────────────────────────────────────────────────
// Wide rectangular warehouse — aspect ~2:1, loading dock notches cut into both
// long sides, parallel lane divider lines, directional arrows in the center lane.
export function QueueBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* wide warehouse footprint */}
      <rect x="4" y="16" width="64" height="40" fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* inner floor */}
      <rect x="10" y="22" width="52" height="28" fill={color} fillOpacity=".20" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* loading dock notch — left side */}
      <rect x="4" y="28" width="8" height="16" fill={color} fillOpacity=".45" stroke={color} strokeWidth="2" />
      {/* loading dock notch — right side */}
      <rect x="60" y="28" width="8" height="16" fill={color} fillOpacity=".45" stroke={color} strokeWidth="2" />
      {/* dock inner void (doorway) */}
      <rect x="5" y="30" width="5" height="12" fill={color} fillOpacity=".06" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      <rect x="62" y="30" width="5" height="12" fill={color} fillOpacity=".06" stroke={color} strokeWidth="1" strokeDasharray="2 2" />
      {/* lane divider lines */}
      <line x1="10" y1="31" x2="62" y2="31" stroke={color} strokeWidth="2" strokeOpacity=".50" />
      <line x1="10" y1="41" x2="62" y2="41" stroke={color} strokeWidth="2" strokeOpacity=".50" />
      {/* cargo blocks — top lane */}
      {[12, 22, 32, 42, 52].map((x) => (
        <rect key={`t${x}`} x={x} y="24" width="7" height="6" fill={color} fillOpacity=".45" stroke={color} strokeWidth="1" />
      ))}
      {/* cargo blocks — bottom lane */}
      {[17, 27, 37, 47].map((x) => (
        <rect key={`b${x}`} x={x} y="43" width="7" height="6" fill={color} fillOpacity=".40" stroke={color} strokeWidth="1" />
      ))}
      {/* center lane arrow — pointing right (conveyor direction) */}
      <polygon points="24,36 36,33 36,30 46,36 36,42 36,39" fill={color} fillOpacity=".70" />
      {active && <PulseRect color={color} x={1} y={13} w={70} h={46} />}
    </svg>
  )
}

// ─── ServiceBuilding ─────────────────────────────────────────────────────────
// Standard square building — 4 rooms divided by a bold cross corridor,
// door gap openings in each corridor wall, thick outer perimeter walls.
export function ServiceBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer walls — thick perimeter */}
      <rect x="5" y="5" width="62" height="62" fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* cross corridor — horizontal band */}
      <rect x="5" y="31" width="62" height="10" fill={color} fillOpacity=".32" />
      {/* cross corridor — vertical band */}
      <rect x="31" y="5" width="10" height="62" fill={color} fillOpacity=".32" />
      {/* room NW */}
      <rect x="9" y="9" width="19" height="19" fill={color} fillOpacity=".20" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* room NE */}
      <rect x="44" y="9" width="19" height="19" fill={color} fillOpacity=".20" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* room SW */}
      <rect x="9" y="44" width="19" height="19" fill={color} fillOpacity=".20" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* room SE */}
      <rect x="44" y="44" width="19" height="19" fill={color} fillOpacity=".20" stroke={color} strokeWidth="1.5" strokeOpacity=".50" />
      {/* door gaps — lighter cutouts in corridor at room entrances */}
      {/* north corridor gap */}
      <rect x="34" y="27" width="4" height="4" fill={color} fillOpacity=".08" />
      {/* south corridor gap */}
      <rect x="34" y="41" width="4" height="4" fill={color} fillOpacity=".08" />
      {/* west corridor gap */}
      <rect x="27" y="34" width="4" height="4" fill={color} fillOpacity=".08" />
      {/* east corridor gap */}
      <rect x="41" y="34" width="4" height="4" fill={color} fillOpacity=".08" />
      {/* center hub — where corridors cross */}
      <rect x="33" y="33" width="6" height="6" fill={color} fillOpacity=".55" />
      {active && <PulseRect color={color} x={2} y={2} w={68} h={68} />}
    </svg>
  )
}

// ─── CustomBuilding ───────────────────────────────────────────────────────────
// Plain square building — color-driven, thick walls, inner panel, center mark.
export function CustomBuilding({ color, active }: BuildingProps) {
  return (
    <svg width={72} height={72} viewBox="0 0 72 72" shapeRendering="crispEdges">
      {/* outer wall */}
      <rect x="5" y="5" width="62" height="62" fill={color} fillOpacity=".16" stroke={color} strokeWidth="5" />
      {/* inner panel */}
      <rect x="15" y="15" width="42" height="42" fill={color} fillOpacity=".22" stroke={color} strokeWidth="2" strokeOpacity=".60" />
      {/* center diamond mark */}
      <polygon
        points="36,22 50,36 36,50 22,36"
        fill={color}
        fillOpacity=".30"
        stroke={color}
        strokeWidth="2"
        strokeOpacity=".65"
      />
      {/* center dot */}
      <rect x="33" y="33" width="6" height="6" fill={color} fillOpacity=".75" />
      {active && <PulseRect color={color} x={2} y={2} w={68} h={68} />}
    </svg>
  )
}

// Sprite mapping for node types whose pixel-art has been replaced with the
// new 2D SVGs in packages/web/public/sprites. Types missing from this map
// continue to use the inline building components below.
export const NODE_TYPE_SPRITE: Record<string, string> = {
  actor:     '/sprites/user_node.svg',
  endpoint:  '/sprites/endpoint_node.svg',
  auth:      '/sprites/auth_node.svg',
  database:  '/sprites/database_node.svg',
  external:  '/sprites/external_node.svg',
  cache:     '/sprites/cache_node.svg',
  queue:     '/sprites/queue_node.svg',
  service:   '/sprites/service_node.svg',
  docker:    '/sprites/docker_node.svg',
  k8s:       '/sprites/k8s_node.svg',
  scheduler: '/sprites/scheduler_node.svg',
  // custom: no sprite — uses the service sprite as fallback (see FlowNode)
}

const SPRITE_SIZE = 108

// Per-type visual scale for sprites that look too small inside the fixed
// 108x108 box due to extreme aspect ratios (e.g. the wide-short endpoint).
// The scale is applied via transform so it doesn't affect ELK layout.
const SPRITE_SCALE: Record<string, number> = {
  endpoint: 1.5,
}

export function SpriteBuilding({ src, color, active, nodeType }: { src: string; nodeType?: string } & BuildingProps) {
  const scale = (nodeType && SPRITE_SCALE[nodeType]) ?? 1
  return (
    <div style={{ position: 'relative', width: SPRITE_SIZE, height: SPRITE_SIZE, overflow: 'visible' }}>
      <img
        src={src}
        alt=""
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        style={{
          imageRendering: 'pixelated',
          display: 'block',
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'center center',
          objectFit: 'contain',
          objectPosition: 'center center',
          filter: active ? `drop-shadow(0 0 6px ${color})` : undefined,
        }}
      />
    </div>
  )
}

export const NODE_BUILDINGS: Record<string, React.ComponentType<BuildingProps>> = {
  actor:      ActorBuilding,
  endpoint:   EndpointBuilding,
  auth:       AuthBuilding,
  database:   DatabaseBuilding,
  external:   ExternalBuilding,
  cache:      CacheBuilding,
  queue:      QueueBuilding,
  service:    ServiceBuilding,
  docker:     ServiceBuilding,     // placeholder until sprite wired
  k8s:        ServiceBuilding,     // placeholder until sprite wired
  scheduler:  ServiceBuilding,     // placeholder until sprite wired
  custom:     CustomBuilding,
}
