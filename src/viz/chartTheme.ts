/** Resolve CSS variables for uPlot so charts follow light/dark system theme. */
export function chartColors(): {
  ink: string
  muted: string
  line: string
  bg: string
  series: string[]
} {
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback

  return {
    ink: read('--ink', '#15202b'),
    muted: read('--muted', '#5b6b7c'),
    line: read('--line', '#d7dee7'),
    bg: read('--bg-elevated', '#ffffff'),
    series: [
      read('--accent', '#0b6e6e'),
      '#c45c26',
      '#3b6ea8',
      '#7a4e9d',
      '#2f8f4e',
      '#b03a5b',
      '#6b7280',
      '#ca8a04',
    ],
  }
}
