// Per-button colour theme system — matches the reference implementation's
// admin-editable BTN_REG/tone registry, backed by native Hailer data:
//   - 8 tone colours + 3 background colours live as fields on ⚙️ Asetukset
//   - the button -> tone mapping lives as rows in 🎨 Painikkeet (one row per button key)
// ToneButton looks up its own tone by key; admins edit both via HinnoitteluPage/Ylläpito.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@chakra-ui/react';
import type { Activity, HailerApi } from '@hailer/app-sdk';
import { listAllPhase } from './hailerData';
import { readValue } from './format';
import {
  WF,
  ASETUKSET_FIELDS as SETF,
  ASETUKSET_PHASES,
  PAINIKKEET_FIELDS as BTNF,
  PAINIKKEET_PHASES,
  TONE_FIELD_ORDER,
  type ToneKey,
} from '../hailer/workspace-bindings';

export type { ToneKey };

export const TONE_DEFAULTS: Record<ToneKey, string> = {
  Oranssi: '#F7941D',
  Keltainen: '#FFD95A',
  Vihreä: '#8FD19E',
  Sininen: '#9CCBEF',
  Violetti: '#C9B6EA',
  Harmaa: '#E4E2DE',
  Valkoinen: '#FFFFFF',
  Punainen: '#B3261E',
};

export const BG_DEFAULTS = {
  sivu: '#F5F4F2',
  ylavalikko: '#E9E7E4',
  kortti: '#FFFFFF',
};

// Perceptual luminance -> pick readable text colour (same rule as the reference: dark text
// everywhere except the two darkest tones, matching a light-first palette).
function darkText(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return true;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return lum > 0.45;
}

interface ThemeContextValue {
  tones: Record<ToneKey, string>;
  bg: typeof BG_DEFAULTS;
  buttonTone: Record<string, ToneKey>;
  reload: () => Promise<void>;
  asetukset: Activity | null;
  painikkeet: Activity[];
}

const ThemeContext = createContext<ThemeContextValue>({
  tones: TONE_DEFAULTS,
  bg: BG_DEFAULTS,
  buttonTone: {},
  reload: async () => {},
  asetukset: null,
  painikkeet: [],
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ hailer, children }: { hailer: HailerApi; children: ReactNode }) {
  const [tones, setTones] = useState<Record<ToneKey, string>>(TONE_DEFAULTS);
  const [bg, setBg] = useState(BG_DEFAULTS);
  const [buttonTone, setButtonTone] = useState<Record<string, ToneKey>>({});
  const [asetukset, setAsetukset] = useState<Activity | null>(null);
  const [painikkeet, setPainikkeet] = useState<Activity[]>([]);

  async function load() {
    const [settingsRows, buttonRows] = await Promise.all([
      listAllPhase(hailer, WF.asetukset, ASETUKSET_PHASES.kaikki),
      listAllPhase(hailer, WF.painikkeet, PAINIKKEET_PHASES.kaikki),
    ]);
    const s = settingsRows[0] || null;
    setAsetukset(s);
    if (s) {
      const t: Record<ToneKey, string> = { ...TONE_DEFAULTS };
      for (const { tone, field, defaultHex } of TONE_FIELD_ORDER) {
        t[tone] = String(readValue(s.fields?.[field]) ?? defaultHex);
      }
      setTones(t);
      setBg({
        sivu: String(readValue(s.fields?.[SETF.taustaSivu]) ?? BG_DEFAULTS.sivu),
        ylavalikko: String(readValue(s.fields?.[SETF.taustaYlavalikko]) ?? BG_DEFAULTS.ylavalikko),
        kortti: String(readValue(s.fields?.[SETF.taustaKortti]) ?? BG_DEFAULTS.kortti),
      });
    }
    setPainikkeet(buttonRows);
    const map: Record<string, ToneKey> = {};
    for (const row of buttonRows) {
      const key = String(readValue(row.fields?.[BTNF.avain]) ?? '');
      const tone = String(readValue(row.fields?.[BTNF.vari]) ?? '') as ToneKey;
      if (key && tone) map[key] = tone;
    }
    setButtonTone(map);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  const value = useMemo<ThemeContextValue>(
    () => ({ tones, bg, buttonTone, reload: load, asetukset, painikkeet }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tones, bg, buttonTone, asetukset, painikkeet],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Resolve a button's colour: buttonKey looks up the admin-editable Painikkeet
 * mapping; falls back to the given default tone if no row exists yet.
 */
export function useButtonTone(buttonKey: string, fallbackTone: ToneKey): { bg: string; color: string; borderColor?: string } {
  const { tones, buttonTone } = useTheme();
  const tone = buttonTone[buttonKey] || fallbackTone;
  const hex = tones[tone] || TONE_DEFAULTS[tone];
  if (tone === 'Punainen') {
    // Reference renders red as an outline (delete/reject), not a filled block.
    return { bg: 'white', color: hex, borderColor: hex };
  }
  return { bg: hex, color: darkText(hex) ? '#2A2A2A' : 'white' };
}

interface ToneButtonProps extends Omit<ButtonProps, 'colorScheme'> {
  /** Admin-editable lookup key, e.g. "act:accept-offer". Matches a 🎨 Painikkeet row. */
  buttonKey: string;
  /** Tone used until an admin overrides it in Ylläpito. */
  tone: ToneKey;
}

/** Button that colours itself from the live per-button theme instead of a fixed Chakra scheme. */
export function ToneButton({ buttonKey, tone, ...rest }: ToneButtonProps) {
  const { bg, color, borderColor } = useButtonTone(buttonKey, tone);
  return (
    <Button
      bg={bg}
      color={color}
      border={borderColor ? '1.5px solid' : undefined}
      borderColor={borderColor}
      fontWeight={700}
      _hover={{ filter: 'brightness(0.95)' }}
      {...rest}
    />
  );
}
