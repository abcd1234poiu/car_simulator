const BODY_PATHS = {
  coupe:
    'M18 62 C22 54 34 50 52 48 L86 34 C98 27 114 24 132 24 L160 26 C176 28 188 34 199 44 L214 50 C222 53 226 56 224 62 L216 64 C210 55 200 51 190 52 C182 53 176 58 173 66 L83 66 C80 57 73 52 65 52 C55 52 48 58 45 66 L26 66 C22 66 18 65 18 62 Z',
  muscle:
    'M14 62 C18 54 30 50 50 48 L92 46 L112 32 C122 27 138 25 154 26 L176 30 C190 33 200 40 208 48 L218 52 C224 55 226 58 224 62 L214 64 C208 55 198 51 188 52 C180 53 174 58 171 66 L83 66 C80 57 72 52 64 52 C54 52 47 58 44 66 L26 66 C20 66 14 65 14 62 Z',
  gt: 'M12 62 C16 54 30 49 50 47 L88 45 L108 33 C120 27 140 25 158 26 L178 31 C192 35 202 42 210 49 L222 54 C227 57 228 60 226 63 L216 65 C210 56 200 52 190 53 C182 54 176 59 173 66 L83 66 C80 57 72 52 64 52 C54 52 47 58 44 66 L24 66 C17 66 12 65 12 62 Z',
  hatch:
    'M22 62 C26 53 38 49 56 47 L84 34 C94 28 108 25 124 25 L158 27 C168 28 176 32 182 38 L198 48 C208 51 214 55 213 62 L204 64 C199 55 190 51 181 52 C173 53 167 58 164 66 L83 66 C80 57 72 52 64 52 C54 52 47 58 44 66 L28 66 C23 66 21 65 22 62 Z',
}

const WINDOW_PATHS = {
  coupe:
    'M96 33 C106 28 118 26 132 27 L156 29 C165 31 172 35 179 41 L112 42 Z',
  muscle:
    'M112 33 C120 29 132 27 146 28 L166 31 C176 34 183 38 188 43 L118 42 Z',
  gt: 'M94 34 C106 29 122 26 140 27 L162 30 C172 33 180 38 186 43 L110 43 Z',
  hatch:
    'M88 35 C98 30 110 27 124 27 L150 29 C160 31 168 35 174 41 L104 42 Z',
}

export function CarSilhouette({ car, className = '' }) {
  const body = BODY_PATHS[car.bodyStyle] ?? BODY_PATHS.coupe
  const window = WINDOW_PATHS[car.bodyStyle] ?? WINDOW_PATHS.coupe
  const gradientId = `silhouette-${car.id}`

  return (
    <svg viewBox="0 0 240 90" className={`car-silhouette ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={car.color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={car.color} stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <ellipse cx="120" cy="78" rx="102" ry="5.5" fill={car.color} opacity="0.14" />

      <path d={body} fill={`url(#${gradientId})`} stroke={car.accent} strokeOpacity="0.45" strokeWidth="1.2" />
      <path d={window} fill="#07101a" opacity="0.85" />
      <path
        d={body}
        fill="none"
        stroke={car.accent}
        strokeOpacity="0.35"
        strokeWidth="1"
        strokeDasharray="0.5 140"
      />

      {[
        { cx: 65, cy: 66, r: 12 },
        { cx: 190, cy: 64, r: 12 },
      ].map((wheel) => (
        <g key={wheel.cx}>
          <circle cx={wheel.cx} cy={wheel.cy} r={wheel.r} fill="#05080d" stroke="rgba(255,255,255,0.16)" />
          <circle cx={wheel.cx} cy={wheel.cy} r={wheel.r * 0.45} fill={car.accent} opacity="0.55" />
        </g>
      ))}

      <path d="M30 52 L188 47" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
