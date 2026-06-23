/**
 * Orchid logo — modelled on the kachnar (Bauhinia variegata, the "orchid tree")
 * bloom: five broad, clawed obovate petals with open gaps, and the flower's
 * signature curving stamens arcing out between them.
 *
 * Colours derive from the live `--accent` CSS variable (via color-mix), so the
 * mark recolours with the selected theme. Stops are set through `style` rather
 * than presentation attributes so the CSS variable actually resolves.
 */
export default function OrchidMark({ size = 64 }: { size?: number }): JSX.Element {
  const petal = 'M50,53 C42,46 37,30 43,17 C46,10 54,10 57,17 C63,30 58,46 50,53 Z'
  const petalAngles = [0, 72, 144, 216, 288]
  const stamenAngles = [36, 108, 180, 252, 324]

  const light = { stopColor: 'color-mix(in srgb, var(--accent) 45%, white)' }
  const mid = { stopColor: 'var(--accent)' }
  const dark = { stopColor: 'color-mix(in srgb, var(--accent) 70%, black)' }
  const coreInner = { stopColor: 'color-mix(in srgb, var(--accent) 8%, white)' }
  const coreOuter = { stopColor: 'color-mix(in srgb, var(--accent) 45%, white)' }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Orchid"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="kachnar-grad" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" style={light} />
          <stop offset="52%" style={mid} />
          <stop offset="100%" style={dark} />
        </linearGradient>
        <radialGradient id="kachnar-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" style={coreInner} />
          <stop offset="100%" style={coreOuter} />
        </radialGradient>
      </defs>

      <g fill="url(#kachnar-grad)" fillOpacity="0.9">
        {petalAngles.map((a) => (
          <path key={a} d={petal} transform={`rotate(${a} 50 52)`} />
        ))}
      </g>

      <g
        fill="none"
        style={{ stroke: 'color-mix(in srgb, var(--accent) 45%, white)' }}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.9"
      >
        {stamenAngles.map((a) => (
          <path key={a} d="M50,51 C52,40 55,27 53,17" transform={`rotate(${a} 50 52)`} />
        ))}
      </g>
      <g style={{ fill: 'color-mix(in srgb, var(--accent) 70%, white)' }}>
        {stamenAngles.map((a) => (
          <circle key={a} cx="53" cy="16" r="2" transform={`rotate(${a} 50 52)`} />
        ))}
      </g>

      <circle cx="50" cy="52" r="6" fill="url(#kachnar-core)" />
      <circle cx="50" cy="52" r="2.2" style={{ fill: 'var(--accent)' }} fillOpacity="0.6" />
    </svg>
  )
}
