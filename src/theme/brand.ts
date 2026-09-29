// Copy-Set brand palette — matches the authoritative reference package
// (copyset-erp.zip: src/styles.css tone variables --t-O/Y/G/B/L/H/W/R).
// These are the DEFAULTS only; the live values are admin-editable via
// Ylläpito and served through src/lib/theme.tsx (ThemeProvider/useTheme) —
// read live tones there, not these constants, wherever a themed colour
// is user-facing. This file remains as a static fallback/reference.
export const brand = {
  charcoal: '#353535',
  darkHeader: '#414447',
  orange: '#F7941D', // --t-O
  orangeAccent: '#E58412',
  orangeLight: '#FFAD58',
  green: '#8FD19E', // --t-G
  greenHover: '#6FBE83',
  greenSoft: '#EAF9F0',
  lightGrey: '#F5F4F2', // --paper
  border: '#E2DFDA', // --line
  white: '#FFFFFF',
} as const;

// Status badges reuse just 4 tones + a red outline for "bad" states — the
// reference's stClass() maps every status to one of these 5 classes; it does
// NOT give every phase its own distinct hue. Render with <Badge bg={c.bg}
// color={c.color} border={c.border}>. "Peruttu" is this build's own addition
// (non-destructive cancel, see phases.ts) and reuses the same "bad" treatment
// as Hylätty.
export const phaseColor: Record<string, { bg: string; color: string; border?: string }> = {
  // s-grey
  Luonnos: { bg: '#E9E7E4', color: '#2A2A2A' },
  // s-wait
  'Valmis lähetettäväksi': { bg: '#FFD95A', color: '#2A2A2A' },
  Lähetetty: { bg: '#FFD95A', color: '#2A2A2A' },
  Vahvistettu: { bg: '#FFD95A', color: '#2A2A2A' },
  Laskutusvalmis: { bg: '#FFD95A', color: '#2A2A2A' },
  // s-act
  Tuotannossa: { bg: '#F7941D', color: '#2A2A2A' },
  // s-done
  Hyväksytty: { bg: '#8FD19E', color: '#2A2A2A' },
  Valmis: { bg: '#8FD19E', color: '#2A2A2A' },
  Laskutettu: { bg: '#8FD19E', color: '#2A2A2A' },
  // s-bad (outline)
  Hylätty: { bg: '#FFFFFF', color: '#B3261E', border: '#B3261E' },
  Peruttu: { bg: '#FFFFFF', color: '#B3261E', border: '#B3261E' },
};
