// Ylläpito — matches the reference's admin page: colours (8 tones + 3
// backgrounds, admin-editable, applied live everywhere) and a per-button
// colour map grouped exactly like the reference's BTN_REG, plus company
// info used on documents. Visible only to workspace admins (gated in
// NavShell/App via useApp().isAdmin — this page also self-guards).
import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  SimpleGrid,
  Input,
  FormControl,
  FormLabel,
  Select,
  useToast,
} from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import { useApp } from '../hailer/use-app';
import { useTheme, TONE_DEFAULTS, BG_DEFAULTS, ToneButton, type ToneKey } from '../lib/theme';
import {
  ASETUKSET_FIELDS as SETF,
  PAINIKKEET_FIELDS as BTNF,
  TONE_FIELD_ORDER,
} from '../hailer/workspace-bindings';
import { readValue } from '../lib/format';

interface Props {
  hailer: HailerApi;
}

const SECTIONS = [
  { key: 'varit', label: 'Värit' },
  { key: 'painikkeet', label: 'Painikkeet' },
  { key: 'yritys', label: 'Yritystiedot' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

const TONE_KEYS: ToneKey[] = ['Oranssi', 'Keltainen', 'Vihreä', 'Sininen', 'Violetti', 'Harmaa', 'Valkoinen', 'Punainen'];
const BG_KEYS: { key: keyof typeof BG_DEFAULTS; label: string; field: string }[] = [
  { key: 'sivu', label: 'Sivun tausta', field: SETF.taustaSivu },
  { key: 'ylavalikko', label: 'Ylävalikon tausta', field: SETF.taustaYlavalikko },
  { key: 'kortti', label: 'Korttien, lomakkeiden ja painikerivin tausta', field: SETF.taustaKortti },
];

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export default function YllapitoPage({ hailer }: Props) {
  const isAdmin = useApp((s) => s.isAdmin);
  const toast = useToast();
  const { asetukset, painikkeet, reload } = useTheme();
  const [section, setSection] = useState<SectionKey>('varit');

  // ---- Värit ----
  const [tones, setTones] = useState<Record<ToneKey, string>>(TONE_DEFAULTS);
  const [bg, setBg] = useState(BG_DEFAULTS);
  const [savingColors, setSavingColors] = useState(false);

  useEffect(() => {
    if (!asetukset) return;
    const t: Record<ToneKey, string> = { ...TONE_DEFAULTS };
    for (const { tone, field, defaultHex } of TONE_FIELD_ORDER) t[tone] = String(readValue(asetukset.fields?.[field]) ?? defaultHex);
    setTones(t);
    setBg({
      sivu: String(readValue(asetukset.fields?.[SETF.taustaSivu]) ?? BG_DEFAULTS.sivu),
      ylavalikko: String(readValue(asetukset.fields?.[SETF.taustaYlavalikko]) ?? BG_DEFAULTS.ylavalikko),
      kortti: String(readValue(asetukset.fields?.[SETF.taustaKortti]) ?? BG_DEFAULTS.kortti),
    });
  }, [asetukset]);

  async function saveColors() {
    if (!asetukset) return;
    setSavingColors(true);
    try {
      const fields: Record<string, unknown> = {};
      for (const { tone, field } of TONE_FIELD_ORDER) fields[field] = tones[tone];
      for (const { key, field } of BG_KEYS) fields[field] = bg[key];
      await hailer.activity.update([{ _id: asetukset._id, fields: fields as never }], {});
      toast({ title: 'Värit tallennettu.', status: 'success' });
      await reload();
    } catch {
      toast({ title: 'Tallennus epäonnistui', status: 'error' });
    } finally {
      setSavingColors(false);
    }
  }

  function resetColors() {
    setTones({ ...TONE_DEFAULTS });
    setBg({ ...BG_DEFAULTS });
  }

  // ---- Painikkeet ----
  const [buttonEdits, setButtonEdits] = useState<Record<string, ToneKey>>({});
  const [savingButtons, setSavingButtons] = useState(false);

  useEffect(() => {
    const map: Record<string, ToneKey> = {};
    for (const row of painikkeet) {
      const tone = String(readValue(row.fields?.[BTNF.vari]) ?? '') as ToneKey;
      if (tone) map[row._id] = tone;
    }
    setButtonEdits(map);
  }, [painikkeet]);

  const buttonGroups = useMemo(() => {
    const groups: Record<string, Activity[]> = {};
    const sorted = [...painikkeet].sort((a, b) => (Number(readValue(a.fields?.[BTNF.jarjestys])) || 0) - (Number(readValue(b.fields?.[BTNF.jarjestys])) || 0));
    for (const row of sorted) {
      const g = String(readValue(row.fields?.[BTNF.ryhma]) ?? 'Muut');
      (groups[g] ||= []).push(row);
    }
    return groups;
  }, [painikkeet]);

  async function saveButtons() {
    setSavingButtons(true);
    try {
      await hailer.activity.update(
        Object.entries(buttonEdits).map(([id, tone]) => ({ _id: id, fields: { [BTNF.vari]: tone } })),
        {},
      );
      toast({ title: 'Painikkeiden värit tallennettu.', status: 'success' });
      await reload();
    } catch {
      toast({ title: 'Tallennus epäonnistui', status: 'error' });
    } finally {
      setSavingButtons(false);
    }
  }

  // ---- Yritystiedot ----
  const [company, setCompany] = useState({ nimi: '', ytunnus: '', osoite: '', puhelin: '', email: '', web: '', iban: '', bic: '' });
  const [savingCompany, setSavingCompany] = useState(false);

  useEffect(() => {
    if (!asetukset) return;
    setCompany({
      nimi: String(readValue(asetukset.fields?.[SETF.yrityksenNimi]) ?? ''),
      ytunnus: String(readValue(asetukset.fields?.[SETF.ytunnus]) ?? ''),
      osoite: String(readValue(asetukset.fields?.[SETF.osoite]) ?? ''),
      puhelin: String(readValue(asetukset.fields?.[SETF.puhelin]) ?? ''),
      email: String(readValue(asetukset.fields?.[SETF.shkposti]) ?? ''),
      web: String(readValue(asetukset.fields?.[SETF.verkkosivu]) ?? ''),
      iban: String(readValue(asetukset.fields?.[SETF.iban]) ?? ''),
      bic: String(readValue(asetukset.fields?.[SETF.bic]) ?? ''),
    });
  }, [asetukset]);

  async function saveCompany() {
    if (!asetukset) return;
    setSavingCompany(true);
    try {
      await hailer.activity.update(
        [
          {
            _id: asetukset._id,
            fields: {
              [SETF.yrityksenNimi]: company.nimi,
              [SETF.ytunnus]: company.ytunnus,
              [SETF.osoite]: company.osoite,
              [SETF.puhelin]: company.puhelin,
              [SETF.shkposti]: company.email,
              [SETF.verkkosivu]: company.web,
              [SETF.iban]: company.iban,
              [SETF.bic]: company.bic,
            },
          },
        ],
        {},
      );
      toast({ title: 'Yritystiedot tallennettu.', status: 'success' });
      await reload();
    } catch {
      toast({ title: 'Tallennus epäonnistui', status: 'error' });
    } finally {
      setSavingCompany(false);
    }
  }

  if (isAdmin === false) {
    return (
      <Box p={8} textAlign="center" color="subtleText">
        Ylläpito on vain ylläpitäjille.
      </Box>
    );
  }

  return (
    <VStack align="stretch" spacing={5}>
      <Box>
        <Text fontSize="26px" fontWeight={800}>
          Ylläpito
        </Text>
        <Text color="subtleText" fontSize="sm" mt={1}>
          Painikkeiden värit, teemavärit ja yritystiedot. Näkyy vain ylläpitäjille.
        </Text>
      </Box>

      <HStack spacing="8px" flexWrap="wrap">
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            h="38px"
            px="14px"
            borderRadius="9px"
            fontWeight={700}
            bg={section === s.key ? brand.orange : 'white'}
            color={section === s.key ? 'white' : brand.charcoal}
            border="1px solid"
            borderColor={section === s.key ? 'transparent' : brand.border}
            onClick={() => setSection(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </HStack>

      {section === 'varit' && (
        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
          <Text fontSize="sm" color="subtleText" mb={3}>
            Samat värit näkyvät myös tilamerkinnöissä: keltainen = odottaa, oranssi = työn alla, vihreä = valmis.
          </Text>
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
            {TONE_KEYS.map((tone) => (
              <FormControl key={tone}>
                <FormLabel fontSize="xs">{tone}</FormLabel>
                <HStack>
                  <Input type="color" w="44px" h="40px" p="2px" value={tones[tone]} onChange={(e) => setTones((t) => ({ ...t, [tone]: e.target.value }))} />
                  <Input h="40px" fontSize="xs" value={tones[tone]} onChange={(e) => setTones((t) => ({ ...t, [tone]: e.target.value }))} />
                </HStack>
              </FormControl>
            ))}
          </SimpleGrid>

          <Text fontSize="sm" fontWeight={700} mt={6} mb={2}>
            Taustavärit
          </Text>
          <Text fontSize="xs" color="subtleText" mb={3}>
            Teksti on aina tummaa, joten valitse vaaleita sävyjä, jotta kaikki pysyy luettavana.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
            {BG_KEYS.map(({ key, label }) => (
              <FormControl key={key}>
                <FormLabel fontSize="xs">{label}</FormLabel>
                <HStack>
                  <Input type="color" w="44px" h="40px" p="2px" value={bg[key]} onChange={(e) => setBg((b) => ({ ...b, [key]: e.target.value }))} />
                  <Input h="40px" fontSize="xs" value={bg[key]} onChange={(e) => setBg((b) => ({ ...b, [key]: e.target.value }))} />
                </HStack>
                {luminance(bg[key]) < 0.45 && (
                  <Text fontSize="10px" color="red.500" fontWeight={700} mt={1}>
                    Liian tumma — teksti voi olla vaikealukuinen
                  </Text>
                )}
              </FormControl>
            ))}
          </SimpleGrid>

          <HStack justify="space-between" mt={5}>
            <Button size="sm" variant="outline" onClick={resetColors}>
              Palauta kaikki oletusvärit
            </Button>
            <Button h="40px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} isLoading={savingColors} isDisabled={!asetukset} onClick={saveColors}>
              ✓ Tallenna värit
            </Button>
          </HStack>
        </Box>
      )}

      {section === 'painikkeet' && (
        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
          <Text fontSize="sm" color="subtleText" mb={4}>
            Valitse jokaiselle painikkeelle väri. Muutos näkyy heti kaikkialla sovelluksessa; tallenna alalaidasta.
          </Text>
          {Object.entries(buttonGroups).map(([group, rows]) => (
            <Box key={group} mb={5}>
              <Text fontSize="xs" fontWeight={800} color="subtleText" mb={2} textTransform="uppercase" letterSpacing="0.06em">
                {group}
              </Text>
              <VStack align="stretch" spacing="6px">
                {rows.map((row) => {
                  const label = String(readValue(row.fields?.[BTNF.selite]) ?? row.name);
                  const buttonKey = String(readValue(row.fields?.[BTNF.avain]) ?? '');
                  const tone = buttonEdits[row._id] || 'Harmaa';
                  return (
                    <HStack key={row._id} justify="space-between" borderBottom="1px solid #F0EDEA" pb="6px">
                      <ToneButton buttonKey={buttonKey} tone={tone} size="sm" isDisabled pointerEvents="none">
                        {label}
                      </ToneButton>
                      <Select
                        w="150px"
                        size="sm"
                        value={tone}
                        onChange={(e) => setButtonEdits((m) => ({ ...m, [row._id]: e.target.value as ToneKey }))}
                      >
                        {TONE_KEYS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </HStack>
                  );
                })}
              </VStack>
            </Box>
          ))}
          <HStack justify="flex-end" mt={2}>
            <Button h="40px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} isLoading={savingButtons} onClick={saveButtons}>
              ✓ Tallenna painikkeiden värit
            </Button>
          </HStack>
        </Box>
      )}

      {section === 'yritys' && (
        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5} maxW="640px">
          <Text fontSize="sm" color="subtleText" mb={4}>
            Näkyvät dokumenteissa (tarjous, tilausvahvistus, lasku jne.).
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
            <FormControl>
              <FormLabel fontSize="sm">Yrityksen nimi</FormLabel>
              <Input h="40px" value={company.nimi} onChange={(e) => setCompany((c) => ({ ...c, nimi: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Y-tunnus</FormLabel>
              <Input h="40px" value={company.ytunnus} onChange={(e) => setCompany((c) => ({ ...c, ytunnus: e.target.value }))} />
            </FormControl>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel fontSize="sm">Osoite</FormLabel>
              <Input h="40px" value={company.osoite} onChange={(e) => setCompany((c) => ({ ...c, osoite: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Puhelin</FormLabel>
              <Input h="40px" value={company.puhelin} onChange={(e) => setCompany((c) => ({ ...c, puhelin: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Sähköposti</FormLabel>
              <Input h="40px" value={company.email} onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Verkkosivu</FormLabel>
              <Input h="40px" value={company.web} onChange={(e) => setCompany((c) => ({ ...c, web: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">IBAN</FormLabel>
              <Input h="40px" value={company.iban} onChange={(e) => setCompany((c) => ({ ...c, iban: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">BIC</FormLabel>
              <Input h="40px" value={company.bic} onChange={(e) => setCompany((c) => ({ ...c, bic: e.target.value }))} />
            </FormControl>
          </SimpleGrid>
          <HStack justify="flex-end" mt={4}>
            <Button h="40px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} isLoading={savingCompany} isDisabled={!asetukset} onClick={saveCompany}>
              ✓ Tallenna yritystiedot
            </Button>
          </HStack>
        </Box>
      )}
    </VStack>
  );
}
