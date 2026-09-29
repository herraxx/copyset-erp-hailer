import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Select,
  Button,
  SimpleGrid,
  NumberInput,
  NumberInputField,
  FormControl,
  FormLabel,
  Divider,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Input,
  Badge,
  useToast,
} from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import {
  WF,
  ASIAKKAAT_FIELDS as AF,
  HINNASTOT_FIELDS as HF,
  HINNASTOT_PHASES,
  TUOTEHINNAT_FIELDS as THF,
  TUOTEHINNAT_PHASES,
  ASIAKASHINNAT_FIELDS as AHF,
  ASIAKASHINNAT_PHASES,
  ASETUKSET_FIELDS as SETF,
  ASETUKSET_PHASES,
  LISTYOHINNASTO_FIELDS as LHF,
  LISTYOHINNASTO_PHASES,
  TUOTEVALINNAT_FIELDS as TVF,
  TUOTEVALINNAT_PHASES,
} from '../hailer/workspace-bindings';
import { listAllPhase } from '../lib/hailerData';
import { formatEUR, readLink, readValue } from '../lib/format';
import { resolveUnitPrice, type PricingCatalog } from '../lib/pricing';
import { HailerPlus } from '../hailer/theme/icons/HailerPlus';
import { HailerTrash } from '../hailer/theme/icons/HailerTrash';

export interface PricingResult {
  tuoteId: string;
  tuoteNimi: string;
  maara: number;
  yksikkohinta: number;
  aloitusmaksu: number;
  lisatyoNimi: string;
  lisatyoHinta: number;
  toimitushinta: number;
  netto: number;
  alv: number;
  brutto: number;
}

interface Props {
  hailer: HailerApi;
  onTransferToOffer: (result: PricingResult) => void;
}

const SECTIONS = [
  { key: 'oletukset', label: 'Yleiset oletukset' },
  { key: 'hinnastot', label: 'Hinnastot & määräportaat' },
  { key: 'valinnat', label: 'Tuotevalinnat' },
  { key: 'lisatyohinnasto', label: 'Lisätyöhinnasto' },
  { key: 'asiakashinnat', label: 'Asiakaskohtaiset sopimushinnat' },
  { key: 'laskuri', label: 'Pikalaskuri' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

export default function HinnoitteluPage({ hailer, onTransferToOffer }: Props) {
  const [section, setSection] = useState<SectionKey>('oletukset');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Activity[]>([]);
  const [customers, setCustomers] = useState<Activity[]>([]);
  const [hinnastot, setHinnastot] = useState<Activity[]>([]);
  const [tuotehinnat, setTuotehinnat] = useState<Activity[]>([]);
  const [asiakashinnat, setAsiakashinnat] = useState<Activity[]>([]);
  const [asetukset, setAsetukset] = useState<Activity | null>(null);
  const [listyohinnasto, setListyohinnasto] = useState<Activity[]>([]);
  const [tuoteryhmat, setTuoteryhmat] = useState<Activity[]>([]);
  const [tuotevalinnat, setTuotevalinnat] = useState<Activity[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, h, th, ah, settings, lh, tr, tv] = await Promise.all([
        listAllPhase(hailer, WF.tuotteet, '6a9fde6e0429f4bd513ae38f'),
        listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c'),
        listAllPhase(hailer, WF.hinnastot, HINNASTOT_PHASES.kaikki),
        listAllPhase(hailer, WF.tuotehinnat, TUOTEHINNAT_PHASES.kaikki),
        listAllPhase(hailer, WF.asiakashinnat, ASIAKASHINNAT_PHASES.kaikki),
        listAllPhase(hailer, WF.asetukset, ASETUKSET_PHASES.kaikki),
        listAllPhase(hailer, WF.listyohinnasto, LISTYOHINNASTO_PHASES.kaikki),
        listAllPhase(hailer, WF.tuoteryhmat, '6a9fde6e0429f4bd513ae389'),
        listAllPhase(hailer, WF.tuotevalinnat, TUOTEVALINNAT_PHASES.kaikki),
      ]);
      setProducts(p.sort((a, b) => a.name.localeCompare(b.name)));
      setCustomers(c.sort((a, b) => a.name.localeCompare(b.name)));
      setHinnastot(h.sort((a, b) => a.name.localeCompare(b.name)));
      setTuotehinnat(th);
      setAsiakashinnat(ah);
      setAsetukset(settings[0] || null);
      setListyohinnasto(lh.sort((a, b) => a.name.localeCompare(b.name)));
      setTuoteryhmat(tr.sort((a, b) => a.name.localeCompare(b.name, 'fi')));
      setTuotevalinnat(tv);
    } finally {
      setLoading(false);
    }
  }, [hailer]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalog: PricingCatalog = useMemo(
    () => ({ products, hinnastot, tuotehinnat, asiakashinnat, customers }),
    [products, hinnastot, tuotehinnat, asiakashinnat, customers],
  );

  if (loading) return <Spinner color={brand.orange} />;

  return (
    <VStack align="stretch" spacing={5} maxW="1100px">
      <Text fontSize="xl" fontWeight="bold" color={brand.charcoal}>
        Hinnoittelu
      </Text>
      <Text fontSize="sm" color="subtleText">
        Hallitse yrityksen hinnoitteluoletuksia, hinnastoja ja asiakaskohtaisia sopimushintoja. Näitä käytetään automaattisesti
        kun tarjouksiin tai tilauksiin lisätään tuoterivejä.
      </Text>
      <HStack flexWrap="wrap" gap={2} borderBottom={`1px solid ${brand.border}`} pb={3}>
        {SECTIONS.map((s) => {
          const active = s.key === section;
          return (
            <Button
              key={s.key}
              size="sm"
              minH="38px"
              borderRadius="9px"
              fontWeight="800"
              fontSize="12px"
              bg={active ? `linear-gradient(180deg, ${brand.orangeLight}, ${brand.orange})` : 'white'}
              color={active ? 'white' : brand.charcoal}
              border={active ? 'none' : `1px solid ${brand.border}`}
              onClick={() => setSection(s.key)}
            >
              {s.label}
            </Button>
          );
        })}
      </HStack>

      {section === 'oletukset' && <SettingsTab hailer={hailer} asetukset={asetukset} onSaved={load} />}
      {section === 'hinnastot' && (
        <HinnastotTab hailer={hailer} products={products} hinnastot={hinnastot} tuotehinnat={tuotehinnat} onChanged={load} />
      )}
      {section === 'valinnat' && (
        <TuotevalinnatTab hailer={hailer} tuoteryhmat={tuoteryhmat} tuotevalinnat={tuotevalinnat} onChanged={load} />
      )}
      {section === 'lisatyohinnasto' && <LisatyohinnastoTab hailer={hailer} listyohinnasto={listyohinnasto} onChanged={load} />}
      {section === 'asiakashinnat' && (
        <AsiakashinnatTab hailer={hailer} products={products} customers={customers} asiakashinnat={asiakashinnat} onChanged={load} />
      )}
      {section === 'laskuri' && (
        <QuickCalculatorTab catalog={catalog} products={products} customers={customers} onTransferToOffer={onTransferToOffer} />
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — company-wide defaults (⚙️ Asetukset)
// ---------------------------------------------------------------------------
function SettingsTab({ hailer, asetukset, onSaved }: { hailer: HailerApi; asetukset: Activity | null; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [aloitusmaksu, setAloitusmaksu] = useState('50');
  const [laskutuslisa, setLaskutuslisa] = useState('6');
  const [alv, setAlv] = useState('25.5');
  const [maksuehtoPv, setMaksuehtoPv] = useState('14');
  const [oletuskate, setOletuskate] = useState('30');
  const [voimassaoloPv, setVoimassaoloPv] = useState('30');
  const [tuntikustannus, setTuntikustannus] = useState('45');
  const [kustannusosuus, setKustannusosuus] = useState('45');
  const [lisatoidenKustannusosuus, setLisatoidenKustannusosuus] = useState('35');

  useEffect(() => {
    if (!asetukset) return;
    setAloitusmaksu(String(readValue(asetukset.fields?.[SETF.oletusAloitusmaksu]) ?? '50'));
    setLaskutuslisa(String(readValue(asetukset.fields?.[SETF.oletusLaskutuslisa]) ?? '6'));
    setAlv(String(readValue(asetukset.fields?.[SETF.oletusAlv]) ?? '25.5'));
    setMaksuehtoPv(String(readValue(asetukset.fields?.[SETF.oletusmaksuehtoPv]) ?? '14'));
    setOletuskate(String(readValue(asetukset.fields?.[SETF.oletuskate]) ?? '30'));
    setVoimassaoloPv(String(readValue(asetukset.fields?.[SETF.tarjouksenVoimassaoloPv]) ?? '30'));
    setTuntikustannus(String(readValue(asetukset.fields?.[SETF.tuntikustannus]) ?? '45'));
    setKustannusosuus(String(readValue(asetukset.fields?.[SETF.oletusKustannusosuus]) ?? '45'));
    setLisatoidenKustannusosuus(String(readValue(asetukset.fields?.[SETF.lisatoidenKustannusosuus]) ?? '35'));
  }, [asetukset]);

  async function save() {
    if (!asetukset) return;
    setSaving(true);
    try {
      await hailer.activity.update(
        [
          {
            _id: asetukset._id,
            fields: {
              [SETF.oletusAloitusmaksu]: Number(aloitusmaksu) || 0,
              [SETF.oletusLaskutuslisa]: Number(laskutuslisa) || 0,
              [SETF.oletusAlv]: Number(alv) || 0,
              [SETF.oletusmaksuehtoPv]: Number(maksuehtoPv) || 0,
              [SETF.oletuskate]: Number(oletuskate) || 0,
              [SETF.tarjouksenVoimassaoloPv]: Number(voimassaoloPv) || 0,
              [SETF.tuntikustannus]: Number(tuntikustannus) || 0,
              [SETF.oletusKustannusosuus]: Number(kustannusosuus) || 0,
              [SETF.lisatoidenKustannusosuus]: Number(lisatoidenKustannusosuus) || 0,
            },
          },
        ],
        {},
      );
      toast({ title: 'Oletukset tallennettu.', status: 'success' });
      await onSaved();
    } catch {
      toast({ title: 'Tallennus epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5} maxW="640px">
      <Text fontSize="sm" color="subtleText" mb={4}>
        Näitä arvoja käytetään automaattisesti oletusarvoina, kun luodaan uusi tarjous tai tilaus.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <FormControl>
          <FormLabel fontSize="sm">Oletusaloitusmaksu (€)</FormLabel>
          <NumberInput min={0} value={aloitusmaksu} onChange={setAloitusmaksu}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Oletuslaskutuslisä (€)</FormLabel>
          <NumberInput min={0} value={laskutuslisa} onChange={setLaskutuslisa}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Oletus-ALV (%)</FormLabel>
          <NumberInput min={0} step={0.1} value={alv} onChange={setAlv}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Oletusmaksuehto (pv)</FormLabel>
          <NumberInput min={0} value={maksuehtoPv} onChange={setMaksuehtoPv}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Oletuskate (%)</FormLabel>
          <NumberInput min={0} value={oletuskate} onChange={setOletuskate}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Tarjouksen voimassaolo (pv)</FormLabel>
          <NumberInput min={0} value={voimassaoloPv} onChange={setVoimassaoloPv}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
      </SimpleGrid>
      <Text fontSize="sm" fontWeight={700} mt={5} mb={2}>
        Katelaskenta
      </Text>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
        <FormControl>
          <FormLabel fontSize="sm">Tuntikustannus (€/h)</FormLabel>
          <NumberInput min={0} value={tuntikustannus} onChange={setTuntikustannus}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Oletuskustannusosuus (%)</FormLabel>
          <NumberInput min={0} max={100} value={kustannusosuus} onChange={setKustannusosuus}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
        <FormControl>
          <FormLabel fontSize="sm">Lisätöiden kustannusosuus (%)</FormLabel>
          <NumberInput min={0} max={100} value={lisatoidenKustannusosuus} onChange={setLisatoidenKustannusosuus}>
            <NumberInputField h="40px" />
          </NumberInput>
        </FormControl>
      </SimpleGrid>
      <HStack justify="flex-end" mt={4}>
        <Button h="40px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} isLoading={saving} isDisabled={!asetukset} onClick={save}>
          ✓ Tallenna oletukset
        </Button>
      </HStack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — price lists (💶 Hinnastot) and their quantity-tier prices (💶 Tuotehinnat)
// ---------------------------------------------------------------------------
function HinnastotTab({
  hailer,
  products,
  hinnastot,
  tuotehinnat,
  onChanged,
}: {
  hailer: HailerApi;
  products: Activity[];
  hinnastot: Activity[];
  tuotehinnat: Activity[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [selectedHinnasto, setSelectedHinnasto] = useState('');
  const [newListName, setNewListName] = useState('');
  const [newTuoteId, setNewTuoteId] = useState('');
  const [newQty, setNewQty] = useState('1');
  const [newPrice, setNewPrice] = useState('0');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedHinnasto && hinnastot.length) {
      const def = hinnastot.find((h) => String(readValue(h.fields?.[HF.oletushinnasto]) ?? '') === 'Kyllä');
      setSelectedHinnasto((def || hinnastot[0])._id);
    }
  }, [hinnastot, selectedHinnasto]);

  const rows = useMemo(
    () =>
      tuotehinnat
        .filter((t) => readLink(t.fields?.[THF.hinnasto]).id === selectedHinnasto)
        .map((t) => ({
          _id: t._id,
          tuoteId: readLink(t.fields?.[THF.tuote]).id || '',
          tuoteNimi: readLink(t.fields?.[THF.tuote]).name || t.name,
          qty: Number(readValue(t.fields?.[THF.maaraAlkaenKpl])) || 0,
          total: Number(readValue(t.fields?.[THF.kokonaishinta])) || 0,
        }))
        .sort((a, b) => a.tuoteNimi.localeCompare(b.tuoteNimi) || a.qty - b.qty),
    [tuotehinnat, selectedHinnasto],
  );

  async function makeDefault(id: string) {
    setSaving(true);
    try {
      await hailer.activity.update(
        hinnastot.map((h) => ({ _id: h._id, fields: { [HF.oletushinnasto]: h._id === id ? 'Kyllä' : 'Ei' } })),
        {},
      );
      toast({ title: 'Oletushinnasto päivitetty.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Päivitys epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function addHinnasto() {
    if (!newListName.trim()) return;
    setSaving(true);
    try {
      await hailer.activity.create(WF.hinnastot, [{ name: newListName.trim(), fields: { [HF.oletushinnasto]: 'Ei' } }], {});
      setNewListName('');
      toast({ title: 'Hinnasto luotu.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Luonti epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function addTier() {
    if (!selectedHinnasto || !newTuoteId) return;
    setSaving(true);
    try {
      const product = products.find((p) => p._id === newTuoteId);
      await hailer.activity.create(
        WF.tuotehinnat,
        [
          {
            name: `${product?.name || 'Tuote'} \u2013 ${newQty} kpl`,
            fields: {
              [THF.hinnasto]: selectedHinnasto,
              [THF.tuote]: newTuoteId,
              [THF.maaraAlkaenKpl]: Number(newQty) || 1,
              [THF.kokonaishinta]: Number(newPrice) || 0,
            },
          },
        ],
        {},
      );
      setNewTuoteId('');
      setNewQty('1');
      setNewPrice('0');
      toast({ title: 'Hintaporras lisätty.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Lisäys epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function removeTier(id: string) {
    setSaving(true);
    try {
      await hailer.activity.remove([id]);
      toast({ title: 'Hintaporras poistettu.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Poisto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4}>
        <Text fontWeight="bold" mb={2} fontSize="sm">
          Hinnastot
        </Text>
        <HStack flexWrap="wrap" gap={2} mb={3}>
          {hinnastot.map((h) => {
            const isDefault = String(readValue(h.fields?.[HF.oletushinnasto]) ?? '') === 'Kyllä';
            const active = h._id === selectedHinnasto;
            return (
              <Button
                key={h._id}
                size="sm"
                variant={active ? 'solid' : 'outline'}
                bg={active ? brand.orange : undefined}
                color={active ? 'white' : undefined}
                onClick={() => setSelectedHinnasto(h._id)}
                rightIcon={isDefault ? <Badge colorScheme="green" fontSize="8px">OLETUS</Badge> : undefined}
              >
                {h.name}
              </Button>
            );
          })}
        </HStack>
        <HStack>
          <Input h="38px" placeholder="Uuden hinnaston nimi" value={newListName} onChange={(e) => setNewListName(e.target.value)} maxW="280px" />
          <Button size="sm" variant="outline" onClick={addHinnasto} isLoading={saving} isDisabled={!newListName.trim()}>
            + Uusi hinnasto
          </Button>
          {selectedHinnasto && (
            <Button size="sm" variant="outline" colorScheme="green" onClick={() => makeDefault(selectedHinnasto)} isLoading={saving}>
              Aseta oletukseksi
            </Button>
          )}
        </HStack>
      </Box>

      {selectedHinnasto && (
        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4}>
          <Text fontWeight="bold" mb={2} fontSize="sm">
            Määräportaat &mdash; {hinnastot.find((h) => h._id === selectedHinnasto)?.name}
          </Text>
          <Text fontSize="xs" color="subtleText" mb={3}>
            Kokonaishinta (alv 0 %) juuri kyseisessä määrässä, oletusvalinnoilla. Välimäärille hinta interpoloidaan
            portaiden väliltä; suuremmille määrille jatketaan viimeisen portaan kulmakertoimella — sama laskentatapa
            kuin tarjous- ja tilausriveillä.
          </Text>
          <Table size="sm" mb={3}>
            <Thead>
              <Tr>
                <Th>Tuote</Th>
                <Th>Määrä (kpl)</Th>
                <Th>Kokonaishinta (alv 0%)</Th>
                <Th>€ / kpl tässä määrässä</Th>
                <Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((r) => (
                <Tr key={r._id}>
                  <Td>{r.tuoteNimi}</Td>
                  <Td>{r.qty}</Td>
                  <Td>{formatEUR(r.total)}</Td>
                  <Td color="subtleText">{r.qty ? formatEUR(r.total / r.qty) : '\u2013'}</Td>
                  <Td>
                    <IconButton aria-label="Poista" icon={<HailerTrash />} size="xs" variant="ghost" colorScheme="red" onClick={() => removeTier(r._id)} />
                  </Td>
                </Tr>
              ))}
              {rows.length === 0 && (
                <Tr>
                  <Td colSpan={5}>
                    <Text fontSize="sm" color="subtleText">
                      Ei hintaportaita tällä listalla. Lisää ensimmäinen alla — vähintään kaksi pistettä tarvitaan interpolointiin.
                    </Text>
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
          <HStack flexWrap="wrap" gap={2}>
            <Select h="38px" maxW="260px" placeholder="Valitse tuote…" value={newTuoteId} onChange={(e) => setNewTuoteId(e.target.value)}>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <NumberInput h="38px" min={1} value={newQty} onChange={setNewQty} maxW="140px">
              <NumberInputField h="38px" placeholder="Määrä (kpl)" />
            </NumberInput>
            <NumberInput h="38px" min={0} value={newPrice} onChange={setNewPrice} maxW="160px">
              <NumberInputField h="38px" placeholder="Kokonaishinta €" />
            </NumberInput>
            <Button size="sm" leftIcon={<HailerPlus />} bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} onClick={addTier} isLoading={saving} isDisabled={!newTuoteId}>
              Lisää porras
            </Button>
          </HStack>
        </Box>
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Tuotevalinnat — product-category option groups (Koko/Paperi/Painatus/...)
// with Kerroin/€-per-unit/€-flat pricing. This is the in-app equivalent of
// the reference's "muokataan tuotteen omalla sivulla" option editor, adapted
// to this build's model where options live on the Tuoteryhmä (category), not
// the individual Tuote.
// ---------------------------------------------------------------------------
const OPTION_MODES = ['Kerroin', '€ / yksikkö', '€ kertamaksu'] as const;
const TARGET_FIELDS = ['Formaatti', 'Materiaali', 'Värit', 'Painotiedot', 'Ei mitään'] as const;

function TuotevalinnatTab({
  hailer,
  tuoteryhmat,
  tuotevalinnat,
  onChanged,
}: {
  hailer: HailerApi;
  tuoteryhmat: Activity[];
  tuotevalinnat: Activity[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [selectedRyhma, setSelectedRyhma] = useState('');
  const [saving, setSaving] = useState(false);
  const [newRyhmanNimi, setNewRyhmanNimi] = useState('');
  const [newKohdekentta, setNewKohdekentta] = useState<(typeof TARGET_FIELDS)[number]>('Ei mitään');
  const [newVaihtoehdonNimi, setNewVaihtoehdonNimi] = useState('');
  const [newTapa, setNewTapa] = useState<(typeof OPTION_MODES)[number]>('Kerroin');
  const [newArvo, setNewArvo] = useState('1');
  const [newOletus, setNewOletus] = useState(false);

  useEffect(() => {
    if (!selectedRyhma && tuoteryhmat.length) setSelectedRyhma(tuoteryhmat[0]._id);
  }, [tuoteryhmat, selectedRyhma]);

  const rowsForRyhma = useMemo(
    () => tuotevalinnat.filter((r) => readLink(r.fields?.[TVF.tuoteryhma]).id === selectedRyhma),
    [tuotevalinnat, selectedRyhma],
  );

  const groups = useMemo(() => {
    const byName = new Map<string, Activity[]>();
    for (const r of rowsForRyhma) {
      const name = String(readValue(r.fields?.[TVF.ryhmanNimi]) ?? '');
      if (!name) continue;
      (byName.get(name) || byName.set(name, []).get(name)!).push(r);
    }
    return [...byName.entries()].map(([name, rows]) => ({
      name,
      rows: rows.sort((a, b) => (Number(readValue(a.fields?.[TVF.jarjestys])) || 0) - (Number(readValue(b.fields?.[TVF.jarjestys])) || 0)),
    }));
  }, [rowsForRyhma]);

  const existingGroupNames = useMemo(() => [...new Set(groups.map((g) => g.name))], [groups]);

  async function addChoice() {
    if (!selectedRyhma || !newRyhmanNimi.trim() || !newVaihtoehdonNimi.trim()) return;
    setSaving(true);
    try {
      await hailer.activity.create(
        WF.tuotevalinnat,
        [
          {
            name: `${newRyhmanNimi.trim()} / ${newVaihtoehdonNimi.trim()}`,
            fields: {
              [TVF.tuoteryhma]: selectedRyhma,
              [TVF.ryhmanNimi]: newRyhmanNimi.trim(),
              [TVF.kohdekentta]: newKohdekentta,
              [TVF.vaihtoehdonNimi]: newVaihtoehdonNimi.trim(),
              [TVF.tapa]: newTapa,
              [TVF.arvo]: Number(newArvo) || 1,
              [TVF.oletusvalinta]: newOletus ? 'Kyllä' : 'Ei',
              [TVF.jarjestys]: rowsForRyhma.length,
            },
          },
        ],
        {},
      );
      setNewVaihtoehdonNimi('');
      setNewArvo('1');
      setNewOletus(false);
      toast({ title: 'Valinta lisätty.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Lisäys epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function removeChoice(id: string) {
    setSaving(true);
    try {
      await hailer.activity.remove([id]);
      toast({ title: 'Valinta poistettu.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Poisto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4}>
        <Text fontWeight="bold" mb={2} fontSize="sm">
          Tuoteryhmä
        </Text>
        <Text fontSize="xs" color="subtleText" mb={3}>
          Valintaryhmät (esim. Koko, Paperi, Painatus) ja niiden vaihtoehdot koskevat koko tuoteryhmää — kaikki ryhmän
          tuotteet näyttävät samat valinnat tarjous- ja tilausriveillä.
        </Text>
        <HStack flexWrap="wrap" gap={2}>
          {tuoteryhmat.map((g) => (
            <Button
              key={g._id}
              size="sm"
              variant={g._id === selectedRyhma ? 'solid' : 'outline'}
              bg={g._id === selectedRyhma ? brand.orange : undefined}
              color={g._id === selectedRyhma ? 'white' : undefined}
              onClick={() => setSelectedRyhma(g._id)}
            >
              {g.name}
            </Button>
          ))}
        </HStack>
      </Box>

      {selectedRyhma && (
        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4}>
          <Text fontWeight="bold" mb={3} fontSize="sm">
            Valintaryhmät &mdash; {tuoteryhmat.find((g) => g._id === selectedRyhma)?.name}
          </Text>
          {groups.length === 0 && (
            <Text fontSize="sm" color="subtleText" mb={3}>
              Ei valintoja tälle tuoteryhmälle vielä. Lisää ensimmäinen alla.
            </Text>
          )}
          {groups.map((group) => (
            <Box key={group.name} mb={4}>
              <Text fontSize="xs" fontWeight={800} color="subtleText" mb={2} textTransform="uppercase" letterSpacing="0.06em">
                {group.name}
              </Text>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Vaihtoehto</Th>
                    <Th>Tapa</Th>
                    <Th>Arvo</Th>
                    <Th>Kohdekenttä</Th>
                    <Th>Oletus</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {group.rows.map((r) => (
                    <Tr key={r._id}>
                      <Td>{String(readValue(r.fields?.[TVF.vaihtoehdonNimi]) ?? '')}</Td>
                      <Td>{String(readValue(r.fields?.[TVF.tapa]) ?? '')}</Td>
                      <Td>{readValue(r.fields?.[TVF.arvo]) as number}</Td>
                      <Td>{String(readValue(r.fields?.[TVF.kohdekentta]) ?? '')}</Td>
                      <Td>{String(readValue(r.fields?.[TVF.oletusvalinta]) ?? '') === 'Kyllä' ? <Badge colorScheme="green" fontSize="8px">OLETUS</Badge> : ''}</Td>
                      <Td>
                        <IconButton aria-label="Poista" icon={<HailerTrash />} size="xs" variant="ghost" colorScheme="red" onClick={() => removeChoice(r._id)} />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          ))}

          <Divider my={3} />
          <Text fontSize="xs" fontWeight={700} color="subtleText" mb={2}>
            + Lisää vaihtoehto
          </Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={2} mb={2}>
            <FormControl>
              <FormLabel fontSize="xs">Ryhmän nimi</FormLabel>
              <Input h="38px" list="ryhma-names" placeholder="esim. Koko" value={newRyhmanNimi} onChange={(e) => setNewRyhmanNimi(e.target.value)} />
              <datalist id="ryhma-names">
                {existingGroupNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Vaihtoehdon nimi</FormLabel>
              <Input h="38px" placeholder="esim. A5 148 × 210 mm" value={newVaihtoehdonNimi} onChange={(e) => setNewVaihtoehdonNimi(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Kohdekenttä</FormLabel>
              <Select h="38px" value={newKohdekentta} onChange={(e) => setNewKohdekentta(e.target.value as (typeof TARGET_FIELDS)[number])}>
                {TARGET_FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Tapa</FormLabel>
              <Select h="38px" value={newTapa} onChange={(e) => setNewTapa(e.target.value as (typeof OPTION_MODES)[number])}>
                {OPTION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel fontSize="xs">Arvo</FormLabel>
              <NumberInput h="38px" value={newArvo} onChange={setNewArvo} step={0.01}>
                <NumberInputField h="38px" />
              </NumberInput>
            </FormControl>
            <FormControl display="flex" alignItems="center" gap={2} mt={{ base: 0, md: '22px' }}>
              <input type="checkbox" checked={newOletus} onChange={(e) => setNewOletus(e.target.checked)} />
              <FormLabel fontSize="xs" mb={0}>
                Oletusvalinta
              </FormLabel>
            </FormControl>
          </SimpleGrid>
          <Button size="sm" leftIcon={<HailerPlus />} bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} onClick={addChoice} isLoading={saving} isDisabled={!newRyhmanNimi.trim() || !newVaihtoehdonNimi.trim()}>
            Lisää vaihtoehto
          </Button>
        </Box>
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Lisätyöhinnasto — default prices for extra work / finishing (🏷️ Lisätyöhinnasto).
// Used as the picker catalog in Tarjous/Tilaus line-item "Lisätyöt" section.
// ---------------------------------------------------------------------------
function LisatyohinnastoTab({
  hailer,
  listyohinnasto,
  onChanged,
}: {
  hailer: HailerApi;
  listyohinnasto: Activity[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [newNimi, setNewNimi] = useState('');
  const [newHinta, setNewHinta] = useState('0');
  const [saving, setSaving] = useState(false);

  async function addPreset() {
    if (!newNimi.trim()) return;
    setSaving(true);
    try {
      await hailer.activity.create(WF.listyohinnasto, [{ name: newNimi.trim(), fields: { [LHF.oletushinta]: Number(newHinta) || 0 } }], {});
      setNewNimi('');
      setNewHinta('0');
      toast({ title: 'Lisätyö lisätty hinnastoon.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Lisäys epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function removePreset(id: string) {
    setSaving(true);
    try {
      await hailer.activity.remove([id]);
      toast({ title: 'Lisätyö poistettu hinnastosta.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Poisto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4}>
        <Text fontSize="xs" color="subtleText" mb={3}>
          Näitä lisätyön oletushintoja tarjotaan valittavaksi, kun tarjous- tai tilausriville lisätään lisätyö (esim.
          laminointi, pyöristetyt kulmat, foliointi). Yksittäisen rivin hintaa voi aina muuttaa lisäämisen jälkeen.
        </Text>
        <Table size="sm" mb={3}>
          <Thead>
            <Tr>
              <Th>Lisätyö</Th>
              <Th>Oletushinta (€)</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {listyohinnasto.map((p) => (
              <Tr key={p._id}>
                <Td>{p.name}</Td>
                <Td>{formatEUR(readValue(p.fields?.[LHF.oletushinta]) ?? 0)}</Td>
                <Td>
                  <IconButton aria-label="Poista" icon={<HailerTrash />} size="xs" variant="ghost" colorScheme="red" onClick={() => removePreset(p._id)} />
                </Td>
              </Tr>
            ))}
            {listyohinnasto.length === 0 && (
              <Tr>
                <Td colSpan={3}>
                  <Text fontSize="sm" color="subtleText">
                    Lisätyöhinnasto on tyhjä. Lisää ensimmäinen lisätyö alla.
                  </Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
        <HStack flexWrap="wrap" gap={2}>
          <Input h="38px" maxW="260px" placeholder="Lisätyön nimi (esim. Laminointi)" value={newNimi} onChange={(e) => setNewNimi(e.target.value)} />
          <NumberInput h="38px" min={0} value={newHinta} onChange={setNewHinta} maxW="160px">
            <NumberInputField h="38px" placeholder="Oletushinta €" />
          </NumberInput>
          <Button size="sm" leftIcon={<HailerPlus />} bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} onClick={addPreset} isLoading={saving} isDisabled={!newNimi.trim()}>
            Lisää lisätyö
          </Button>
        </HStack>
      </Box>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Tab 3 — customer contract prices (💶 Asiakashinnat)
// ---------------------------------------------------------------------------
function AsiakashinnatTab({
  hailer,
  products,
  customers,
  asiakashinnat,
  onChanged,
}: {
  hailer: HailerApi;
  products: Activity[];
  customers: Activity[];
  asiakashinnat: Activity[];
  onChanged: () => Promise<void>;
}) {
  const toast = useToast();
  const [asiakasId, setAsiakasId] = useState('');
  const [tuoteId, setTuoteId] = useState('');
  const [sopimushinta, setSopimushinta] = useState('0');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () =>
      asiakashinnat
        .map((a) => ({
          _id: a._id,
          asiakasNimi: readLink(a.fields?.[AHF.asiakas]).name || '\u2013',
          tuoteNimi: readLink(a.fields?.[AHF.tuote]).name || '\u2013',
          hinta: Number(readValue(a.fields?.[AHF.sopimushinta])) || 0,
        }))
        .sort((a, b) => a.asiakasNimi.localeCompare(b.asiakasNimi)),
    [asiakashinnat],
  );

  async function addRow() {
    if (!asiakasId || !tuoteId) return;
    setSaving(true);
    try {
      const c = customers.find((x) => x._id === asiakasId);
      const p = products.find((x) => x._id === tuoteId);
      await hailer.activity.create(
        WF.asiakashinnat,
        [
          {
            name: `${c?.name || 'Asiakas'} \u2013 ${p?.name || 'Tuote'}`,
            fields: {
              [AHF.asiakas]: asiakasId,
              [AHF.tuote]: tuoteId,
              [AHF.sopimushinta]: Number(sopimushinta) || 0,
            },
          },
        ],
        {},
      );
      setAsiakasId('');
      setTuoteId('');
      setSopimushinta('0');
      toast({ title: 'Sopimushinta lisätty.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Lisäys epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    setSaving(true);
    try {
      await hailer.activity.remove([id]);
      toast({ title: 'Sopimushinta poistettu.', status: 'success' });
      await onChanged();
    } catch {
      toast({ title: 'Poisto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4}>
        <Text fontSize="xs" color="subtleText" mb={3}>
          Asiakaskohtainen sopimushinta ohittaa aina hinnaston määräportaat ja tuotteen perushinnan sille asiakkaalle ja
          tuotteelle.
        </Text>
        <Table size="sm" mb={3}>
          <Thead>
            <Tr>
              <Th>Asiakas</Th>
              <Th>Tuote</Th>
              <Th>Sopimushinta (€)</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((r) => (
              <Tr key={r._id}>
                <Td>{r.asiakasNimi}</Td>
                <Td>{r.tuoteNimi}</Td>
                <Td>{formatEUR(r.hinta)}</Td>
                <Td>
                  <IconButton aria-label="Poista" icon={<HailerTrash />} size="xs" variant="ghost" colorScheme="red" onClick={() => removeRow(r._id)} />
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={4}>
                  <Text fontSize="sm" color="subtleText">
                    Ei asiakaskohtaisia sopimushintoja. Lisää ensimmäinen alla.
                  </Text>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
        <HStack flexWrap="wrap" gap={2}>
          <Select h="38px" maxW="260px" placeholder="Valitse asiakas…" value={asiakasId} onChange={(e) => setAsiakasId(e.target.value)}>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select h="38px" maxW="260px" placeholder="Valitse tuote…" value={tuoteId} onChange={(e) => setTuoteId(e.target.value)}>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          <NumberInput h="38px" min={0} value={sopimushinta} onChange={setSopimushinta} maxW="160px">
            <NumberInputField h="38px" placeholder="Sopimushinta €" />
          </NumberInput>
          <Button size="sm" leftIcon={<HailerPlus />} bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} onClick={addRow} isLoading={saving} isDisabled={!asiakasId || !tuoteId}>
            Lisää sopimushinta
          </Button>
        </HStack>
      </Box>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Tab 4 — quick single-product calculator, now backed by the real catalog
// ---------------------------------------------------------------------------
function QuickCalculatorTab({
  catalog,
  products,
  customers,
  onTransferToOffer,
}: {
  catalog: PricingCatalog;
  products: Activity[];
  customers: Activity[];
  onTransferToOffer: (result: PricingResult) => void;
}) {
  const [tuoteId, setTuoteId] = useState('');
  const [maara, setMaara] = useState('100');
  const [asiakasId, setAsiakasId] = useState('');
  const [aloitusmaksu, setAloitusmaksu] = useState('0');
  const [lisatyoNimi, setLisatyoNimi] = useState('');
  const [lisatyoHinta, setLisatyoHinta] = useState('0');
  const [toimitushinta, setToimitushinta] = useState('0');
  const [alv, setAlv] = useState('25.5');
  const [manualPrice, setManualPrice] = useState('');

  const selectedProduct = useMemo(() => products.find((p) => p._id === tuoteId), [products, tuoteId]);

  const resolved = useMemo(() => {
    if (!tuoteId) return null;
    return resolveUnitPrice(catalog, tuoteId, asiakasId || null, Number(maara) || 1);
  }, [catalog, tuoteId, asiakasId, maara]);

  useEffect(() => {
    setManualPrice('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuoteId, maara, asiakasId]);

  const unitPrice = manualPrice !== '' ? Number(manualPrice) || 0 : resolved?.unitPrice || 0;

  const result = useMemo(() => {
    const qty = Number(maara) || 0;
    const setup = Number(aloitusmaksu) || 0;
    const extra = Number(lisatyoHinta) || 0;
    const delivery = Number(toimitushinta) || 0;
    const netto = qty * unitPrice + setup + extra + delivery;
    const alvAmount = netto * ((Number(alv) || 0) / 100);
    return { netto, alv: alvAmount, brutto: netto + alvAmount };
  }, [maara, unitPrice, aloitusmaksu, lisatyoHinta, toimitushinta, alv]);

  function handleTransfer() {
    if (!tuoteId) return;
    onTransferToOffer({
      tuoteId,
      tuoteNimi: selectedProduct?.name || '',
      maara: Number(maara) || 0,
      yksikkohinta: unitPrice,
      aloitusmaksu: Number(aloitusmaksu) || 0,
      lisatyoNimi,
      lisatyoHinta: Number(lisatyoHinta) || 0,
      toimitushinta: Number(toimitushinta) || 0,
      netto: result.netto,
      alv: result.alv,
      brutto: result.brutto,
    });
  }

  return (
    <VStack align="stretch" spacing={5} maxW="800px">
      <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <FormControl>
            <FormLabel fontSize="sm">Tuote</FormLabel>
            <Select h="40px" placeholder="Valitse tuote…" value={tuoteId} onChange={(e) => setTuoteId(e.target.value)}>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Asiakas (hinnasto + alennus)</FormLabel>
            <Select h="40px" placeholder="Ei asiakasta valittu…" value={asiakasId} onChange={(e) => setAsiakasId(e.target.value)}>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.fields?.[AF.yleinenAlennus] ? `(-${c.fields?.[AF.yleinenAlennus]}%)` : ''}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Määrä</FormLabel>
            <NumberInput min={0} value={maara} onChange={setMaara}>
              <NumberInputField h="40px" />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Yksikköhinta (€) &mdash; ehdotus muokattavissa</FormLabel>
            <NumberInput min={0} value={manualPrice !== '' ? manualPrice : String(unitPrice)} onChange={setManualPrice}>
              <NumberInputField h="40px" />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Aloituskustannus (€)</FormLabel>
            <NumberInput min={0} value={aloitusmaksu} onChange={setAloitusmaksu}>
              <NumberInputField h="40px" />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Lisätyön nimi</FormLabel>
            <Select h="40px" value={lisatyoNimi} onChange={(e) => setLisatyoNimi(e.target.value)} placeholder="Ei lisätyötä">
              <option value="Lamiinointi">Lamiinointi</option>
              <option value="Rei\u00e4tys">Reiätys</option>
              <option value="Taitto">Taitto</option>
              <option value="Kuvakohdistus">Kuvakohdistus</option>
              <option value="Muu">Muu</option>
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Lisätyön hinta (€)</FormLabel>
            <NumberInput min={0} value={lisatyoHinta} onChange={setLisatyoHinta}>
              <NumberInputField h="40px" />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Toimitushinta (€)</FormLabel>
            <NumberInput min={0} value={toimitushinta} onChange={setToimitushinta}>
              <NumberInputField h="40px" />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">ALV %</FormLabel>
            <Select h="40px" value={alv} onChange={(e) => setAlv(e.target.value)}>
              <option value="25.5">25,5 % (kotimaa)</option>
              <option value="0">0 % (vienti)</option>
            </Select>
          </FormControl>
        </SimpleGrid>
        {resolved && resolved.source !== 'none' && (
          <Text fontSize="xs" color="subtleText" mt={3}>
            Hinnaston ehdotus: <b>{formatEUR(resolved.unitPrice)}</b> / kpl &mdash; {resolved.label}
            {manualPrice !== '' && ' (yliajettu yllä olevalla omalla hinnalla)'}
          </Text>
        )}
      </Box>

      <Box bg={brand.charcoal} color="white" borderRadius="12px" p={5}>
        <Text fontWeight="bold" mb={2} color={brand.orange}>
          LASKELMA
        </Text>
        <HStack justify="space-between" fontWeight="bold">
          <Text>Yhteensä (ALV 0%)</Text>
          <Text>{formatEUR(result.netto)}</Text>
        </HStack>
        <HStack justify="space-between" fontSize="sm">
          <Text>ALV {alv} %</Text>
          <Text>{formatEUR(result.alv)}</Text>
        </HStack>
        <Divider my={2} borderColor="gray.600" />
        <HStack justify="space-between" fontSize="lg" fontWeight="extrabold" color={brand.orange}>
          <Text>YHTEENSÄ</Text>
          <Text>{formatEUR(result.brutto)}</Text>
        </HStack>
      </Box>

      <HStack justify="flex-end">
        <Button h="40px" bg={brand.orange} color={brand.charcoal} _hover={{ bg: brand.orangeAccent, color: 'white' }} isDisabled={!tuoteId} onClick={handleTransfer}>
          Siirrä uuteen tarjoukseen
        </Button>
      </HStack>
    </VStack>
  );
}
