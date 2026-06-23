export type Appearance = 'system' | 'light' | 'dark'

export interface AccentTheme {
  key: string
  name: string
  light: string
  dark: string
}

/**
 * Curated accents — each tuned for Bloom (light) and Dusk (dark), grouped by hue.
 * Saturation stays restrained so even the brighter options keep the calm, editorial vibe.
 * (No near-gray accent — it muddies against the text color.)
 */
export const ACCENTS: AccentTheme[] = [
  // violets + pinks
  { key: 'orchid', name: 'Orchid', light: '#7c4dd6', dark: '#ab8bf2' },
  { key: 'iris', name: 'Iris', light: '#4f54de', dark: '#8e92f4' },
  { key: 'plum', name: 'Plum', light: '#a838c9', dark: '#cf7ce6' },
  { key: 'fuchsia', name: 'Fuchsia', light: '#d61f9e', dark: '#f25cc8' },
  // blues + slate (cool, dark-friendly)
  { key: 'periwinkle', name: 'Periwinkle', light: '#5471ec', dark: '#8aa2f7' },
  { key: 'azure', name: 'Azure', light: '#1b8ae6', dark: '#57b2f5' },
  { key: 'slate', name: 'Slate', light: '#4f6488', dark: '#9aaece' },
  { key: 'steel', name: 'Steel', light: '#3f6fa3', dark: '#7eaae0' },
  // neutral
  { key: 'graphite', name: 'Graphite', light: '#5c6676', dark: '#9ca7b7' },
  // greens
  { key: 'lagoon', name: 'Lagoon', light: '#0aa1c2', dark: '#49c8e2' },
  { key: 'teal', name: 'Teal', light: '#0f9b91', dark: '#41c6ba' },
  { key: 'jade', name: 'Jade', light: '#12a578', dark: '#46cd9c' },
  { key: 'pine', name: 'Pine', light: '#2f7d5e', dark: '#62b48f' },
  // warms
  { key: 'marigold', name: 'Marigold', light: '#d98e2b', dark: '#ecb55e' },
  { key: 'coral', name: 'Coral', light: '#e75a46', dark: '#f58a79' },
  { key: 'rose', name: 'Rose', light: '#d6447e', dark: '#ec7ba8' }
]

export const accentByKey = (key: string): AccentTheme =>
  ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]
