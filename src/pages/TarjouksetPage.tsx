import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Input,
  Select,
  Button,
  Badge,
  SimpleGrid,
  IconButton,
  Textarea,
  NumberInput,
  NumberInputField,
  Divider,
  Spinner,
  useToast,
  FormControl,
  FormLabel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand, phaseColor } from '../theme/brand';
import {
  WF,
  TARJOUKSET_FIELDS as TF,
  TARJOUKSET_PHASES as TP,
  TARJOUSRIVIT_FIELDS as TRF,
  LISATYOT_FIELDS as LF,
  HINNASTOT_PHASES,
  TUOTEHINNAT_PHASES,
  ASIAKASHINNAT_PHASES,
  ASETUKSET_PHASES,
  ASETUKSET_FIELDS as SETF,
  LISTYOHINNASTO_FIELDS as LHF,
  LISTYOHINNASTO_PHASES,
  ASIAKKAAT_FIELDS as AF,
  TUOTTEET_FIELDS as PF,
  TUOTEVALINNAT_PHASES,
} from '../hailer/workspace-bindings';
import { listAllPhase, listAllWorkflow } from '../lib/hailerData';
import { formatEUR, formatDate, readLink, readValue, toDateInputValue, composeAddress } from '../lib/format';
import { resolveUnitPrice, resolveLinePrice, optionGroupsFor, type PricingCatalog } from '../lib/pricing';
import ConfirmDialog from '../components/ConfirmDialog';
import ChoiceDialog, { type ChoiceOption } from '../components/ChoiceDialog';
import { ToneButton, type ToneKey } from '../lib/theme';
import { HailerPlus } from '../hailer/theme/icons/HailerPlus';
import { HailerTrash } from '../hailer/theme/icons/HailerTrash';
import type { PricingResult } from './HinnoitteluPage';

// Exact 5-stage flow from the authoritative reference package
// (copyset-erp.zip, src/app.js: OFFER_ST): Luonnos → Valmis lähetettäväksi →
// Lähetetty → Hyväksytty / Hylätty. Every phase maps 1:1 to its own stage —
// no collapsing (a stale live-deployment reference previously led to
// collapsing "Valmis lähetettäväksi" into "Luonnos"; the zip package is the
// current authoritative source and confirms these are 5 genuinely distinct,
// separately-badged stages).
const OFFER_STAGES = ['Luonnos', 'Valmis lähetettäväksi', 'Lähetetty', 'Hyväksytty', 'Hylätty'] as const;
const OFFER_PHASE_LIST = [
  { id: TP.luonnos, name: 'Luonnos' },
  { id: TP.valmisLahetettavaksi, name: 'Valmis lähetettäväksi' },
  { id: TP.lahetetty, name: 'Lähetetty' },
  { id: TP.hyvaksytty, name: 'Hyväksytty' },
  { id: TP.hylatty, name: 'Hylätty' },
];
const ALL_OFFER_PHASE_IDS = Object.values(TP);

function stageOf(o: Activity): string {
  if (o.currentPhase === TP.hylatty) return 'Hylätty';
  if (o.currentPhase === TP.hyvaksytty) return 'Hyväksytty';
  if (o.currentPhase === TP.lahetetty) return 'Lähetetty';
  if (o.currentPhase === TP.valmisLahetettavaksi) return 'Valmis lähetettäväksi';
  return 'Luonnos';
}

interface LineExtra {
  _id?: string;
  nimi: string;
  hinta: string;
}
interface LineForm {
  _id?: string;
  tuoteId: string;
  tuoteNimi: string;
  maara: string;
  yksikkohinta: string;
  spesifikaatiot: string;
  extras: LineExtra[];
  /** Selected 🎛️ Tuotevalinnat choice id per option-group name, e.g. { Koko: "<choiceId>" }. */
  selectedOptions: Record<string, string>;
}
interface OfferFormState {
  _id?: string;
  asiakasId: string;
  asiakasNimi: string;
  yhteyshenkiloId: string;
  tarjouspaiva: string;
  voimassaAsti: string;
  toimituspiv: string;
  tuotannonDeadline: string;
  projektinNimi: string;
  toimitustapa: string;
  toimitusosoitteet: string;
  toimVastaanottaja: string;
  toimKatuosoite: string;
  toimPostinumero: string;
  toimKaupunki: string;
  toimMaa: string;
  toimLisatiedot: string;
  tuotanto: string;
  alihankkijaId: string;
  maksuehtoPv: string;
  alv: string;
  asiakkaanReferenssi: string;
  toimitushinta: string;
  aloitusmaksu: string;
  laskutuslisa: string;
  laskutusosoite: string;
  ytunnus: string;
  asiakkaanMaa: string;
  verkkolaskuosoite: string;
  valittajatunnus: string;
  ehdotJaHuomiot: string;
  sisisetMuistiinpanot: string;
  lines: LineForm[];
}

function emptyForm(): OfferFormState {
  return {
    asiakasId: '',
    asiakasNimi: '',
    yhteyshenkiloId: '',
    tarjouspaiva: new Date().toISOString().slice(0, 10),
    voimassaAsti: '',
    toimituspiv: '',
    tuotannonDeadline: '',
    projektinNimi: '',
    toimitustapa: 'Nouto',
    toimitusosoitteet: '',
    toimVastaanottaja: '',
    toimKatuosoite: '',
    toimPostinumero: '',
    toimKaupunki: '',
    toimMaa: 'Suomi',
    toimLisatiedot: '',
    tuotanto: 'Copy-Set',
    alihankkijaId: '',
    maksuehtoPv: '21',
    alv: '25.5',
    asiakkaanReferenssi: '',
    toimitushinta: '0',
    aloitusmaksu: '50',
    laskutuslisa: '6',
    laskutusosoite: '',
    ytunnus: '',
    asiakkaanMaa: 'Suomi',
    verkkolaskuosoite: '',
    valittajatunnus: '',
    ehdotJaHuomiot: '',
    sisisetMuistiinpanot: '',
    lines: [],
  };
}

function emptyLine(): LineForm {
  return { tuoteId: '', tuoteNimi: '', maara: '1', yksikkohinta: '0', spesifikaatiot: '', extras: [], selectedOptions: {} };
}

interface Props {
  hailer: HailerApi;
  onCreateOrderFromOffer: (offerId: string, startProduction?: boolean) => void;
  focusOfferId?: string | null;
  onFocusHandled?: () => void;
  presetCustomerId?: string | null;
  onOpenNewRequested?: boolean;
  onNewHandled?: () => void;
  prefillLine?: PricingResult | null;
  onPrefillHandled?: () => void;
}

export default function TarjouksetPage({
  hailer,
  onCreateOrderFromOffer,
  focusOfferId,
  onFocusHandled,
  presetCustomerId,
  onOpenNewRequested,
  onNewHandled,
  prefillLine,
  onPrefillHandled,
}: Props) {
  const toast = useToast();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [offers, setOffers] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('Kaikki');

  const [customers, setCustomers] = useState<Activity[]>([]);
  const [products, setProducts] = useState<Activity[]>([]);
  const [suppliers, setSuppliers] = useState<Activity[]>([]);
  const [hinnastot, setHinnastot] = useState<Activity[]>([]);
  const [tuotehinnat, setTuotehinnat] = useState<Activity[]>([]);
  const [asiakashinnat, setAsiakashinnat] = useState<Activity[]>([]);
  const [asetukset, setAsetukset] = useState<Activity | null>(null);
  const [listyohinnasto, setListyohinnasto] = useState<Activity[]>([]);
  const [tuotevalinnat, setTuotevalinnat] = useState<Activity[]>([]);

  const [selected, setSelected] = useState<Activity | null>(null);
  const [selectedLines, setSelectedLines] = useState<Array<{ line: Activity; extras: Activity[] }>>([]);

  const [form, setForm] = useState<OfferFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  type QuoteActionKind = 'hylkaa' | 'laheta';
  const [actionTarget, setActionTarget] = useState<{ id: string; kind: QuoteActionKind } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  type AcceptChoice = 'order' | 'prod' | 'accept';
  const [acceptTarget, setAcceptTarget] = useState<Activity | null>(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState<string | null>(null);

  const [lineSummary, setLineSummary] = useState<Record<string, string>>({});

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const [list, allLines] = await Promise.all([
        listAllWorkflow(hailer, WF.tarjoukset, ALL_OFFER_PHASE_IDS),
        listAllPhase(hailer, WF.tarjousrivit, '6a9ff73d2921da91c45c8674'),
      ]);
      list.sort((a, b) => Number(b.created) - Number(a.created));
      setOffers(list);
      const byOffer: Record<string, string[]> = {};
      for (const l of allLines) {
        const offerId = readLink(l.fields?.[TRF.tarjous]).id;
        if (!offerId) continue;
        const productName = readLink(l.fields?.[TRF.tuote]).name || 'Tuote';
        const qty = l.fields?.[TRF.maara];
        (byOffer[offerId] ||= []).push(`${productName} · ${qty ?? 0} kpl`);
      }
      const summary: Record<string, string> = {};
      for (const [id, rows] of Object.entries(byOffer)) summary[id] = rows.join(', ');
      setLineSummary(summary);
    } catch (e) {
      toast({ title: 'Tarjousten lataus epäonnistui', status: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  const loadRefs = useCallback(async () => {
    const [c, p, s, h, th, ah, settings, lh, tv] = await Promise.all([
      listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c'),
      listAllPhase(hailer, WF.tuotteet, '6a9fde6e0429f4bd513ae38f'),
      listAllPhase(hailer, WF.alihankkijat, '6a9fde6e0429f4bd513ae3a8'),
      listAllPhase(hailer, WF.hinnastot, HINNASTOT_PHASES.kaikki),
      listAllPhase(hailer, WF.tuotehinnat, TUOTEHINNAT_PHASES.kaikki),
      listAllPhase(hailer, WF.asiakashinnat, ASIAKASHINNAT_PHASES.kaikki),
      listAllPhase(hailer, WF.asetukset, ASETUKSET_PHASES.kaikki),
      listAllPhase(hailer, WF.listyohinnasto, LISTYOHINNASTO_PHASES.kaikki),
      listAllPhase(hailer, WF.tuotevalinnat, TUOTEVALINNAT_PHASES.kaikki),
    ]);
    setCustomers(c);
    setProducts(p);
    setSuppliers(s);
    setHinnastot(h);
    setTuotehinnat(th);
    setAsiakashinnat(ah);
    setAsetukset(settings[0] || null);
    setListyohinnasto(lh.sort((a, b) => a.name.localeCompare(b.name)));
    setTuotevalinnat(tv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  const pricingCatalog: PricingCatalog = useMemo(
    () => ({ products, hinnastot, tuotehinnat, asiakashinnat, customers, tuotevalinnat }),
    [products, hinnastot, tuotehinnat, asiakashinnat, customers, tuotevalinnat],
  );
  // Inactive products (Aktiivinen = Ei) stay selectable on existing lines that
  // already reference them, but never appear in the "add new line" picker.
  const activeProducts = useMemo(() => products.filter((p) => String(readValue(p.fields?.[PF.aktiivinen]) ?? 'Kyllä') !== 'Ei'), [products]);

  useEffect(() => {
    void loadOffers();
    void loadRefs();
  }, [loadOffers, loadRefs]);

  useEffect(() => {
    if (onOpenNewRequested) {
      openNew();
      onNewHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpenNewRequested]);

  useEffect(() => {
    if (focusOfferId) {
      void openDetail(focusOfferId);
      onFocusHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOfferId]);

  const filteredOffers = useMemo(() => {
    return offers.filter((o) => {
      // "Kaikki" is genuinely everything — matches the canonical
      // `filter==='Kaikki'||stage(o)===filter`, no exclusions.
      if (phaseFilter !== 'Kaikki' && stageOf(o) !== phaseFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const customerName = readLink(o.fields?.[TF.asiakas]).name?.toLowerCase() || '';
      return o.name.toLowerCase().includes(q) || customerName.includes(q);
    });
  }, [offers, phaseFilter, search]);

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of offers) {
      const stage = stageOf(o);
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return counts;
  }, [offers]);

  const kaikkiCount = offers.length;

  function openNew() {
    const f = emptyForm();
    // Pull company-wide defaults from ⚙️ Asetukset instead of hardcoding them.
    if (asetukset) {
      const alv = readValue(asetukset.fields?.[SETF.oletusAlv]);
      const maksuehto = readValue(asetukset.fields?.[SETF.oletusmaksuehtoPv]);
      const aloitus = readValue(asetukset.fields?.[SETF.oletusAloitusmaksu]);
      const laskutuslisa = readValue(asetukset.fields?.[SETF.oletusLaskutuslisa]);
      if (alv !== undefined) f.alv = String(alv);
      if (maksuehto !== undefined) f.maksuehtoPv = String(maksuehto);
      if (aloitus !== undefined) f.aloitusmaksu = String(aloitus);
      if (laskutuslisa !== undefined) f.laskutuslisa = String(laskutuslisa);
    }
    if (presetCustomerId) {
      const c = customers.find((x) => x._id === presetCustomerId);
      if (c) {
        f.asiakasId = c._id;
        f.asiakasNimi = c.name;
      }
    }
    if (prefillLine) {
      f.toimitushinta = String(prefillLine.toimitushinta || 0);
      f.lines = [
        {
          tuoteId: prefillLine.tuoteId,
          tuoteNimi: prefillLine.tuoteNimi,
          maara: String(prefillLine.maara),
          yksikkohinta: String(prefillLine.yksikkohinta),
          spesifikaatiot: '',
          selectedOptions: {},
          extras: prefillLine.lisatyoNimi && prefillLine.lisatyoHinta ? [{ nimi: prefillLine.lisatyoNimi, hinta: String(prefillLine.lisatyoHinta) }] : [],
        },
      ];
      onPrefillHandled?.();
    }
    setForm(f);
    setDirty(false);
    setSelected(null);
    setView('form');
  }

  async function loadLinesForOffer(offerId: string) {
    const allLines = await listAllPhase(hailer, WF.tarjousrivit, '6a9ff73d2921da91c45c8674');
    const mine = allLines.filter((l) => readLink(l.fields?.[TRF.tarjous]).id === offerId);
    const allExtras = await listAllPhase(hailer, WF.lisatyot, '6ab22888e066bd5d051623d2');
    const withExtras = mine.map((line) => ({
      line,
      extras: allExtras.filter((e) => readLink(e.fields?.[LF.tarjousrivi]).id === line._id),
    }));
    return withExtras;
  }

  async function openDetail(offerId: string) {
    const offer = offers.find((o) => o._id === offerId) || (await hailer.activity.get(offerId));
    if (!offer) return;
    setSelected(offer);
    const lines = await loadLinesForOffer(offerId);
    setSelectedLines(lines);
    setView('detail');
  }

  // Accepts an optional offerId so "Muokkaa" can be triggered directly from
  // the list (no need to open a detail view first).
  async function openEdit(offerId?: string) {
    const offer = offerId ? offers.find((o) => o._id === offerId) || (await hailer.activity.get(offerId)) : selected;
    if (!offer) return;
    setSelected(offer);
    const lines = !offerId && selectedLines.length ? selectedLines : await loadLinesForOffer(offer._id);
    const f: OfferFormState = {
      _id: offer._id,
      asiakasId: readLink(offer.fields?.[TF.asiakas]).id || '',
      asiakasNimi: readLink(offer.fields?.[TF.asiakas]).name || '',
      yhteyshenkiloId: readLink(offer.fields?.[TF.yhteyshenkilo]).id || '',
      tarjouspaiva: toDateInputValue(offer.fields?.[TF.tarjouspaiva]) || new Date().toISOString().slice(0, 10),
      voimassaAsti: toDateInputValue(offer.fields?.[TF.voimassaAsti]),
      toimituspiv: toDateInputValue(offer.fields?.[TF.toimituspiv]),
      tuotannonDeadline: toDateInputValue(offer.fields?.[TF.tuotannonDeadline]),
      projektinNimi: String(offer.fields?.[TF.projektinNimi] ?? ''),
      toimitustapa: String(offer.fields?.[TF.toimitustapa] ?? 'Nouto'),
      toimitusosoitteet: String(offer.fields?.[TF.toimitusosoitteet] ?? ''),
      toimVastaanottaja: String(offer.fields?.[TF.toimVastaanottaja] ?? ''),
      toimKatuosoite: String(offer.fields?.[TF.toimKatuosoite] ?? ''),
      toimPostinumero: String(offer.fields?.[TF.toimPostinumero] ?? ''),
      toimKaupunki: String(offer.fields?.[TF.toimKaupunki] ?? ''),
      toimMaa: String(offer.fields?.[TF.toimMaa] ?? 'Suomi'),
      toimLisatiedot: String(offer.fields?.[TF.toimLisatiedot] ?? ''),
      tuotanto: String(offer.fields?.[TF.tuotanto] ?? 'Copy-Set'),
      alihankkijaId: readLink(offer.fields?.[TF.alihankkija]).id || '',
      maksuehtoPv: String(offer.fields?.[TF.maksuehtoPv] ?? '21'),
      alv: String(offer.fields?.[TF.alv] ?? '25.5'),
      asiakkaanReferenssi: String(offer.fields?.[TF.asiakkaanReferenssi] ?? ''),
      toimitushinta: String(offer.fields?.[TF.toimitushinta] ?? '0'),
      aloitusmaksu: String(offer.fields?.[TF.aloitusmaksu] ?? '50'),
      laskutuslisa: String(offer.fields?.[TF.laskutuslisa] ?? '6'),
      laskutusosoite: String(offer.fields?.[TF.laskutusosoite] ?? ''),
      ytunnus: String(offer.fields?.[TF.ytunnus] ?? ''),
      asiakkaanMaa: String(offer.fields?.[TF.asiakkaanMaa] ?? 'Suomi'),
      verkkolaskuosoite: String(offer.fields?.[TF.verkkolaskuosoite] ?? ''),
      valittajatunnus: String(offer.fields?.[TF.valittajatunnus] ?? ''),
      ehdotJaHuomiot: String(offer.fields?.[TF.ehdotJaHuomiot] ?? ''),
      sisisetMuistiinpanot: String(offer.fields?.[TF.sisisetMuistiinpanot] ?? ''),
      lines: lines.map(({ line, extras }) => ({
        _id: line._id,
        tuoteId: readLink(line.fields?.[TRF.tuote]).id || '',
        tuoteNimi: readLink(line.fields?.[TRF.tuote]).name || '',
        maara: String(line.fields?.[TRF.maara] ?? '1'),
        yksikkohinta: String(line.fields?.[TRF.yksikkohinta] ?? '0'),
        spesifikaatiot: String(line.fields?.[TRF.spesifikaatiot] ?? ''),
        selectedOptions: {},
        extras: extras
          .filter((e) => e.fields?.[LF.nimi])
          .map((e) => ({ _id: e._id, nimi: String(e.fields?.[LF.nimi] ?? ''), hinta: String(e.fields?.[LF.hinta] ?? '0') })),
      })),
    };
    setForm(f);
    setDirty(false);
    setView('form');
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
    setDirty(true);
  }
  function removeLine(idx: number) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
    setDirty(true);
  }
  function updateLine(idx: number, patch: Partial<LineForm>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
    setDirty(true);
  }
  function addExtra(lineIdx: number, preset?: { nimi: string; hinta: string }) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === lineIdx ? { ...l, extras: [...l.extras, preset || { nimi: '', hinta: '0' }] } : l)),
    }));
    setDirty(true);
  }
  function removeExtra(lineIdx: number, extraIdx: number) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === lineIdx ? { ...l, extras: l.extras.filter((_, ei) => ei !== extraIdx) } : l)),
    }));
    setDirty(true);
  }
  function updateExtra(lineIdx: number, extraIdx: number, patch: Partial<LineExtra>) {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) =>
        i === lineIdx ? { ...l, extras: l.extras.map((e, ei) => (ei === extraIdx ? { ...e, ...patch } : e)) } : l,
      ),
    }));
    setDirty(true);
  }

  const totals = useMemo(() => {
    let tuotteet = 0;
    for (const l of form.lines) {
      const rowExtras = l.extras.filter((e) => e.nimi.trim()).reduce((s, e) => s + (Number(e.hinta) || 0), 0);
      tuotteet += (Number(l.maara) || 0) * (Number(l.yksikkohinta) || 0) + rowExtras;
    }
    const toimitus = Number(form.toimitushinta) || 0;
    const aloitus = Number(form.aloitusmaksu) || 0;
    const lisa = Number(form.laskutuslisa) || 0;
    const netto = tuotteet + toimitus + aloitus + lisa;
    const alvMaara = netto * ((Number(form.alv) || 0) / 100);
    const brutto = netto + alvMaara;
    return { tuotteet, netto, alvMaara, brutto };
  }, [form]);

  async function saveDraft(targetPhaseId?: string): Promise<string | null> {
    if (!form.asiakasId) {
      toast({ title: 'Valitse asiakas ennen tallennusta.', status: 'warning' });
      return null;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: Record<string, any> = {
        [TF.asiakas]: form.asiakasId,
        [TF.tarjouspaiva]: form.tarjouspaiva || null,
        [TF.voimassaAsti]: form.voimassaAsti || null,
        [TF.toimituspiv]: form.toimituspiv || null,
        [TF.tuotannonDeadline]: form.tuotannonDeadline || null,
        [TF.projektinNimi]: form.projektinNimi || null,
        [TF.toimitustapa]: form.toimitustapa,
        // Legacy flat field, auto-composed from the structured address so
        // documents that still read it (Lähete, Lähetyslappu) stay correct.
        [TF.toimitusosoitteet]:
          [
            composeAddress({
              vastaanottaja: form.toimVastaanottaja,
              katuosoite: form.toimKatuosoite,
              postinumero: form.toimPostinumero,
              kaupunki: form.toimKaupunki,
              maa: form.toimMaa,
              lisatiedot: form.toimLisatiedot,
            }),
            form.toimitusosoitteet,
          ]
            .filter(Boolean)
            .join('\n\n') || null,
        [TF.toimVastaanottaja]: form.toimVastaanottaja || null,
        [TF.toimKatuosoite]: form.toimKatuosoite || null,
        [TF.toimPostinumero]: form.toimPostinumero || null,
        [TF.toimKaupunki]: form.toimKaupunki || null,
        [TF.toimMaa]: form.toimMaa || null,
        [TF.toimLisatiedot]: form.toimLisatiedot || null,
        [TF.tuotanto]: form.tuotanto,
        [TF.maksuehtoPv]: Number(form.maksuehtoPv) || 21,
        [TF.alv]: Number(form.alv),
        [TF.asiakkaanReferenssi]: form.asiakkaanReferenssi || null,
        [TF.toimitushinta]: Number(form.toimitushinta) || 0,
        [TF.aloitusmaksu]: Number(form.aloitusmaksu) || 0,
        [TF.laskutuslisa]: Number(form.laskutuslisa) || 0,
        [TF.laskutusosoite]: form.laskutusosoite || null,
        [TF.ytunnus]: form.ytunnus || null,
        [TF.asiakkaanMaa]: form.asiakkaanMaa || null,
        [TF.verkkolaskuosoite]: form.verkkolaskuosoite || null,
        [TF.valittajatunnus]: form.valittajatunnus || null,
        [TF.ehdotJaHuomiot]: form.ehdotJaHuomiot || null,
        [TF.sisisetMuistiinpanot]: form.sisisetMuistiinpanot || null,
      };
      if (form.yhteyshenkiloId) fields[TF.yhteyshenkilo] = form.yhteyshenkiloId;
      if (form.alihankkijaId) fields[TF.alihankkija] = form.alihankkijaId;

      let offerId = form._id;
      if (!offerId) {
        const created = await hailer.activity.create(WF.tarjoukset, [{ name: 'TAR-' + Date.now(), fields }], {
          phaseId: TP.luonnos,
        });
        offerId = Array.isArray(created) ? created[0]?._id : (created as unknown as Activity)?._id;
      } else {
        await hailer.activity.update([{ _id: offerId, fields, ...(targetPhaseId ? { phaseId: targetPhaseId } : {}) }], {});
      }
      if (!offerId) throw new Error('Tarjouksen tallennus epäonnistui.');

      // Replace-all strategy for line items + extra work (simple & correct;
      // trades finer-grained history for guaranteed consistency).
      const existingLines = await loadLinesForOffer(offerId);
      for (const { line, extras } of existingLines) {
        for (const e of extras) await hailer.activity.remove([e._id]);
        await hailer.activity.remove([line._id]);
      }
      for (const l of form.lines) {
        if (!l.tuoteId) continue;
        const lineFields: Record<string, any> = {
          [TRF.tarjous]: offerId,
          [TRF.tuote]: l.tuoteId,
          [TRF.maara]: Number(l.maara) || 0,
          [TRF.yksikkohinta]: Number(l.yksikkohinta) || 0,
          [TRF.spesifikaatiot]: l.spesifikaatiot || null,
        };
        const createdLine = await hailer.activity.create(WF.tarjousrivit, [{ name: l.tuoteNimi || 'Rivi', fields: lineFields }], {});
        const lineId = Array.isArray(createdLine) ? createdLine[0]?._id : (createdLine as unknown as Activity)?._id;
        if (!lineId) continue;
        for (const extra of l.extras) {
          if (!extra.nimi.trim()) continue; // never save empty extra-work rows
          await hailer.activity.create(
            WF.lisatyot,
            [{ name: extra.nimi, fields: { [LF.tarjousrivi]: lineId, [LF.nimi]: extra.nimi, [LF.hinta]: Number(extra.hinta) || 0 } }],
            {},
          );
        }
      }

      toast({ title: 'Tarjous tallennettu.', status: 'success' });
      setDirty(false);
      await loadOffers();
      return offerId;
    } catch (e) {
      toast({ title: 'Tallennus epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndClose() {
    const id = await saveDraft();
    if (id) {
      await openDetail(id);
    }
  }

  async function handleReviewOffer() {
    const id = await saveDraft();
    if (!id) return;
    await openDetail(id);
    // Native Hailer sidenav — its own print/document picker already has
    // "Tarjous" available for this workflow, so we don't render our own
    // PDF viewer here.
    await hailer.ui.activity.open(id, { tab: 'detail' });
  }

  async function handleSend() {
    if (!selected) return;
    setSaving(true);
    try {
      // Luonnos -> Lähetetty directly (matches the reference's 4-stage flow).
      await hailer.activity.update([{ _id: selected._id, phaseId: TP.lahetetty }], {});
      toast({ title: 'Tarjous lähetetty asiakkaalle.', status: 'success' });
      await loadOffers();
      await openDetail(selected._id);
    } catch (e) {
      toast({ title: 'Lähetys epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!selected) return;
    setSaving(true);
    try {
      await hailer.activity.update([{ _id: selected._id, phaseId: TP.hyvaksytty }], {});
      toast({ title: 'Tarjous merkitty hyväksytyksi.', status: 'success' });
      setConfirmApprove(false);
      await loadOffers();
      await openDetail(selected._id);
    } catch (e) {
      toast({ title: 'Hyväksyntä epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    setSaving(true);
    try {
      await hailer.activity.update([{ _id: selected._id, phaseId: TP.hylatty }], {});
      toast({ title: 'Tarjous merkitty hylätyksi.', status: 'success' });
      setConfirmReject(false);
      await loadOffers();
      await openDetail(selected._id);
    } catch (e) {
      toast({ title: 'Toiminto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateOrder() {
    if (!selected) return;
    // Duplicate-order prevention: a "Luotu tilaus" link means an order was
    // already spawned from this offer.
    if (readLink(selected.fields?.[TF.luotuTilaus]).id) {
      toast({ title: 'Tästä tarjouksesta on jo luotu tilaus.', status: 'warning' });
      return;
    }
    onCreateOrderFromOffer(selected._id);
  }

  function backToList() {
    setView('list');
    setSelected(null);
  }

  // Every real workflow-progression action lives here, list-level — no need
  // to open a custom detail view first. Matches the reference's quote
  // lifecycle: Luonnos → (Tarkista) → Valmis lähetettäväksi → (Lähetä) →
  // Lähetetty → (Asiakas hyväksyi) → Hyväksytty (+ order created).
  // Hylkää is reachable from any non-final stage.
  async function runQuoteAction() {
    if (!actionTarget) return;
    const { id, kind } = actionTarget;
    const targetPhase = kind === 'hylkaa' ? TP.hylatty : TP.lahetetty;
    setActionBusy(true);
    try {
      await hailer.activity.update([{ _id: id, phaseId: targetPhase }], {});
      toast({ title: kind === 'hylkaa' ? 'Tarjous merkitty hylätyksi.' : 'Tarjous lähetetty asiakkaalle.', status: 'success' });
      setActionTarget(null);
      await loadOffers();
    } catch (e) {
      toast({ title: 'Toiminto epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
    } finally {
      setActionBusy(false);
    }
  }

  // "Merkitse hyväksytyksi" — matches the reference's 3-way choice dialog
  // exactly: accepting always moves the offer to Hyväksytty; the choice only
  // decides whether an order is created immediately (and whether it's sent
  // straight to production) or left for later from the offer's own page.
  async function runAcceptChoice(choice: AcceptChoice) {
    if (!acceptTarget) return;
    setAcceptBusy(true);
    try {
      await hailer.activity.update([{ _id: acceptTarget._id, phaseId: TP.hyvaksytty }], {});
      if (choice === 'accept') {
        toast({ title: 'Tarjous hyväksytty.', status: 'success' });
        setAcceptTarget(null);
        await loadOffers();
      } else {
        setAcceptTarget(null);
        await onCreateOrderFromOffer(acceptTarget._id, choice === 'prod');
        await loadOffers();
      }
    } catch (e) {
      toast({ title: 'Toiminto epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
    } finally {
      setAcceptBusy(false);
    }
  }

  // "Kopioi uudeksi tarjoukseksi" — from a final state (Hyväksytty/Hylätty),
  // clone header + lines into a brand-new Luonnos offer.
  async function copyAsNewOffer(o: Activity) {
    setCopyBusy(o._id);
    try {
      const lines = await listAllPhase(hailer, WF.tarjousrivit, '6a9ff73d2921da91c45c8674');
      const myLines = lines.filter((l) => readLink(l.fields?.[TRF.tarjous]).id === o._id);
      const fields: Record<string, unknown> = {};
      const copyField = (f: string) => {
        const v = o.fields?.[f];
        if (v !== undefined) fields[f] = readValue(v);
      };
      [TF.asiakas, TF.yhteyshenkilo, TF.maksuehtoPv, TF.alv, TF.ehdotJaHuomiot, TF.toimitustapa, TF.toimitusosoitteet,
        TF.tuotanto, TF.alihankkija, TF.projektinNimi, TF.toimitushinta, TF.aloitusmaksu, TF.laskutuslisa,
        TF.laskutusosoite, TF.ytunnus, TF.asiakkaanMaa, TF.verkkolaskuosoite, TF.valittajatunnus,
        TF.toimVastaanottaja, TF.toimKatuosoite, TF.toimPostinumero, TF.toimKaupunki, TF.toimMaa, TF.toimLisatiedot,
      ].forEach(copyField);
      const created = await hailer.activity.create(WF.tarjoukset, [{ name: 'Tarjous (kopio)', fields: fields as never }], { phaseId: TP.luonnos });
      const newId = Array.isArray(created) ? (created[0] as Activity)?._id : (created as unknown as Activity)?._id;
      if (newId) {
        for (const l of myLines) {
          await hailer.activity.create(
            WF.tarjousrivit,
            [{
              name: l.name,
              fields: {
                [TRF.tarjous]: newId,
                [TRF.tuote]: readLink(l.fields?.[TRF.tuote]).id,
                [TRF.maara]: readValue(l.fields?.[TRF.maara]),
                [TRF.yksikkohinta]: readValue(l.fields?.[TRF.yksikkohinta]),
                [TRF.spesifikaatiot]: readValue(l.fields?.[TRF.spesifikaatiot]),
              } as never,
            }],
            {},
          );
        }
      }
      toast({ title: 'Uusi tarjousluonnos luotu.', status: 'success' });
      if (newId) void hailer.ui.activity.open(newId, { tab: 'detail' });
      await loadOffers();
    } catch (e) {
      toast({ title: 'Kopiointi epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
    } finally {
      setCopyBusy(null);
    }
  }

  // ---- LIST VIEW ---- (matches the reference's quotes list + quote-actions exactly)
  if (view === 'list') {
    // Exact button set per stage from the reference's offerView(o) (app.js):
    // Luonnos -> Jatka muokkausta. Valmis lähetettäväksi -> Lähetä tarjous +
    // Muokkaa. Lähetetty -> Merkitse hyväksytyksi (3-way choice) + Muokkaa +
    // Hylkää tarjous. Hyväksytty -> Luo tilaus / Luo tilaus ja aloita
    // tuotanto (or Avaa tilaus if one already exists) + Kopioi uudeksi
    // tarjoukseksi. Hylätty -> Avaa + Kopioi uudeksi tarjoukseksi.
    type RowButton = { key: string; label: string; buttonKey: string; tone: ToneKey; onClick: () => void; isLoading?: boolean };
    const rowButtons = (o: Activity, stage: string): RowButton[] => {
      const id = o._id;
      const buttons: RowButton[] = [];
      if (stage === 'Luonnos') {
        buttons.push({ key: 'edit', label: 'Jatka muokkausta', buttonKey: 'act:edit-offer', tone: 'Violetti', onClick: () => void hailer.ui.activity.open(id, { tab: 'detail' }) });
      } else if (stage === 'Valmis lähetettäväksi') {
        buttons.push({ key: 'send', label: 'Lähetä tarjous', buttonKey: 'act:send-offer', tone: 'Keltainen', onClick: () => setActionTarget({ id, kind: 'laheta' }) });
        buttons.push({ key: 'edit', label: 'Muokkaa', buttonKey: 'act:edit-offer', tone: 'Violetti', onClick: () => void hailer.ui.activity.open(id, { tab: 'detail' }) });
      } else if (stage === 'Lähetetty') {
        buttons.push({ key: 'accept', label: 'Merkitse hyväksytyksi', buttonKey: 'act:accept-offer', tone: 'Vihreä', onClick: () => setAcceptTarget(o) });
        buttons.push({ key: 'edit', label: 'Muokkaa', buttonKey: 'act:edit-offer', tone: 'Violetti', onClick: () => void hailer.ui.activity.open(id, { tab: 'detail' }) });
        buttons.push({ key: 'reject', label: 'Hylkää tarjous', buttonKey: 'act:reject-offer', tone: 'Punainen', onClick: () => setActionTarget({ id, kind: 'hylkaa' }) });
      } else if (stage === 'Hyväksytty') {
        const linkedOrderId = readLink(o.fields?.[TF.luotuTilaus]).id;
        if (linkedOrderId) {
          buttons.push({ key: 'avaatilaus', label: 'Avaa tilaus', buttonKey: 'open', tone: 'Sininen', onClick: () => void hailer.ui.activity.open(linkedOrderId, { tab: 'detail' }) });
        } else {
          buttons.push({ key: 'luotilaus', label: 'Luo tilaus', buttonKey: 'act:create-order', tone: 'Oranssi', onClick: () => onCreateOrderFromOffer(id) });
          buttons.push({ key: 'luotilausprod', label: 'Luo tilaus ja aloita tuotanto', buttonKey: 'act:create-order-prod', tone: 'Oranssi', onClick: () => onCreateOrderFromOffer(id, true) });
        }
        buttons.push({ key: 'copy', label: 'Kopioi uudeksi tarjoukseksi', buttonKey: 'act:copy-offer', tone: 'Violetti', isLoading: copyBusy === id, onClick: () => void copyAsNewOffer(o) });
      } else if (stage === 'Hylätty') {
        buttons.push({ key: 'open', label: 'Avaa', buttonKey: 'open', tone: 'Harmaa', onClick: () => void hailer.ui.activity.open(id, { tab: 'detail' }) });
        buttons.push({ key: 'copy', label: 'Kopioi uudeksi tarjoukseksi', buttonKey: 'act:copy-offer', tone: 'Violetti', isLoading: copyBusy === id, onClick: () => void copyAsNewOffer(o) });
      }
      return buttons;
    };

    const actionCopy: Record<QuoteActionKind, { title: string; body: string; confirmLabel: string; confirmColorScheme: string }> = {
      hylkaa: {
        title: 'Hylätäänkö tarjous?',
        body: 'Merkitäänkö tarjous hylätyksi? Tilausta ei luoda.',
        confirmLabel: 'Hylkää tarjous',
        confirmColorScheme: 'red',
      },
      laheta: {
        title: 'Lähetetäänkö tarjous?',
        body: 'Merkitäänkö tarjous lähetetyksi asiakkaalle?',
        confirmLabel: 'Lähetä tarjous',
        confirmColorScheme: 'orange',
      },
    };

    const acceptOptions: ChoiceOption<AcceptChoice>[] = [
      { value: 'order', label: 'Hyväksy ja luo tilaus', tone: 'Vihreä', buttonKey: 'act:create-order' },
      { value: 'prod', label: 'Hyväksy ja aloita tuotanto heti', tone: 'Oranssi', buttonKey: 'act:create-order-prod' },
      { value: 'accept', label: 'Vain hyväksy (tilaus myöhemmin)', tone: 'Harmaa', buttonKey: 'act:accept-offer' },
    ];

    return (
      <VStack align="stretch" spacing="14px">
        <Box>
          <Text as="h1" fontSize="32px" fontWeight={800} letterSpacing="-0.015em" lineHeight="1.1" color={brand.charcoal}>
            Tarjoukset
          </Text>
          <Text mt="4px" color="subtleText" fontSize="15px">
            Tarjous siirtyy tilaukseksi vasta, kun merkitset sen hyväksytyksi ja luot tilauksen.
          </Text>
        </Box>
        <Box>
          <Input
            mb="14px"
            h="44px"
            bg="#FBFAF9"
            border="1px solid #D3D0CB"
            borderRadius="10px"
            placeholder="Hae tarjousnumero, asiakas, tuote tai viite"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Box position="relative" pt="25px">
            <Text position="absolute" top={0} left="1px" color="#65707C" fontSize="10px" fontWeight="900" letterSpacing="0.12em">
              RYHMÄT
            </Text>
            <Flex gap="8px" flexWrap="wrap">
              {(['Kaikki', ...OFFER_STAGES] as string[]).map((name) => {
                const count = name === 'Kaikki' ? kaikkiCount : phaseCounts[name] || 0;
                const active = phaseFilter === name;
                return (
                  <Button
                    key={name}
                    size="sm"
                    minH="42px"
                    px="11px"
                    borderRadius="10px"
                    fontSize="11px"
                    fontWeight="800"
                    border="1px solid #D6DCE3"
                    bg={active ? `linear-gradient(135deg, ${brand.orangeLight}, ${brand.orange})` : 'linear-gradient(180deg, #fff, #f8fafb)'}
                    color={active ? 'white' : '#303942'}
                    boxShadow={active ? '0 5px 14px rgba(245,138,36,.24)' : '0 1px 2px rgba(24,32,40,.04)'}
                    onClick={() => setPhaseFilter(name)}
                    rightIcon={
                      <Box
                        as="span"
                        minW="24px"
                        h="22px"
                        display="inline-grid"
                        placeItems="center"
                        px="7px"
                        borderRadius="999px"
                        bg={active ? 'rgba(255,255,255,.25)' : '#EDF1F4'}
                        color={active ? 'white' : '#3F4851'}
                        fontSize="10px"
                      >
                        {count}
                      </Box>
                    }
                  >
                    {name}
                  </Button>
                );
              })}
            </Flex>
          </Box>
        </Box>

        {loading ? (
          <Spinner color={brand.orange} mt={4} />
        ) : filteredOffers.length === 0 ? (
          <Text color="subtleText" mt={4}>
            Ei tarjouksia näillä hakuehdoilla.
          </Text>
        ) : (
          <>
            {/* Desktop table — hidden below 850px */}
            <Box display={{ base: 'none', md: 'block' }} mt="16px" border="1px solid #DFE4E9" borderRadius="11px" bg="white" overflowX="auto">
              <Table minW="1080px" style={{ tableLayout: 'fixed' }}>
                <Thead>
                  <Tr>
                    <Th w="11%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tarjous #</Th>
                    <Th w="9%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Päivä</Th>
                    <Th w="14%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Asiakas</Th>
                    <Th w="19%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tuote</Th>
                    <Th w="11%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Summa alv 0</Th>
                    <Th w="9%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tila</Th>
                    <Th w="9%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Myyjä</Th>
                    <Th w="18%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredOffers.map((o) => {
                    const custName = readLink(o.fields?.[TF.asiakas]).name || '\u2013';
                    const stage = stageOf(o);
                    const colors = phaseColor[stage] || { bg: '#EDF1F4', color: '#3F4851' };
                    const buttons = rowButtons(o, stage);
                    return (
                      <Tr
                        key={o._id}
                        _hover={{ bg: '#FFF8F1' }}
                        cursor="pointer"
                        onClick={() => void hailer.ui.activity.open(o._id, { tab: 'detail' })}
                      >
                        <Td fontWeight="800">{o.name}</Td>
                        <Td>{formatDate(o.created ? Number(o.created) / 1000 : undefined)}</Td>
                        <Td>{custName}</Td>
                        <Td fontSize="xs" whiteSpace="normal">{lineSummary[o._id] || '\u2013'}</Td>
                        <Td>{formatEUR(o.fields?.[TF.nettoYhteensa])}</Td>
                        <Td>
                          <Badge bg={colors.bg} color={colors.color} borderRadius="full" px="9px" py="5px" fontSize="10px" fontWeight="900">
                            {stage}
                          </Badge>
                        </Td>
                        <Td fontSize="xs">Copy-Set</Td>
                         <Td onClick={(e) => e.stopPropagation()}>
                           <VStack spacing="6px" align="stretch">
                             {buttons.map((b) => (
                               <ToneButton key={b.key} buttonKey={b.buttonKey} tone={b.tone} size="sm" minH="34px" fontSize="11px" borderRadius="9px" isLoading={b.isLoading} onClick={b.onClick}>
                                 {b.label}
                               </ToneButton>
                             ))}
                           </VStack>
                         </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>

            {/* Mobile cards — shown below 850px */}
            <VStack display={{ base: 'flex', md: 'none' }} align="stretch" spacing={2} mt={3}>
              {filteredOffers.map((o) => {
                const custName = readLink(o.fields?.[TF.asiakas]).name || '\u2013';
                const stage = stageOf(o);
                const colors = phaseColor[stage] || { bg: '#EDF1F4', color: '#3F4851' };
                const buttons = rowButtons(o, stage);
                return (
                  <Box key={o._id} bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={3} onClick={() => void hailer.ui.activity.open(o._id, { tab: 'detail' })}>
                    <HStack justify="space-between">
                      <Text fontWeight="800">{o.name}</Text>
                      <Badge bg={colors.bg} color={colors.color} borderRadius="full" px="8px" fontSize="10px">
                        {stage}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="subtleText" mt={1}>
                      {custName} · {formatDate(o.created ? Number(o.created) / 1000 : undefined)}
                    </Text>
                    <Text fontSize="xs" color="subtleText" mt={1} noOfLines={2}>
                      {lineSummary[o._id] || '\u2013'}
                    </Text>
                    <Text fontWeight="bold" mt={1}>
                      {formatEUR(o.fields?.[TF.nettoYhteensa])}
                    </Text>
                    <VStack spacing="6px" align="stretch" mt={2}>
                      {buttons.map((b) => (
                        <ToneButton
                          key={b.key}
                          buttonKey={b.buttonKey}
                          tone={b.tone}
                          w="100%"
                          minH="40px"
                          fontSize="12px"
                          borderRadius="9px"
                          isLoading={b.isLoading}
                          onClick={(e) => {
                            e.stopPropagation();
                            b.onClick();
                          }}
                        >
                          {b.label}
                        </ToneButton>
                      ))}
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          </>
        )}

        {actionTarget && (
          <ConfirmDialog
            isOpen={!!actionTarget}
            title={actionCopy[actionTarget.kind].title}
            body={actionCopy[actionTarget.kind].body}
            confirmLabel={actionCopy[actionTarget.kind].confirmLabel}
            confirmColorScheme={actionCopy[actionTarget.kind].confirmColorScheme}
            isLoading={actionBusy}
            onConfirm={() => void runQuoteAction()}
            onCancel={() => setActionTarget(null)}
          />
        )}

        {acceptTarget && (
          <ChoiceDialog<AcceptChoice>
            isOpen={!!acceptTarget}
            title="Merkitse hyväksytyksi"
            body={`Onko asiakas varmasti hyväksynyt tarjouksen ${acceptTarget.name}? Valitse, mitä tehdään samalla. Tilauksen voi luoda myöhemminkin tarjouksen sivulta.`}
            options={acceptOptions}
            isLoading={acceptBusy}
            onChoose={(v) => void runAcceptChoice(v)}
            onCancel={() => setAcceptTarget(null)}
          />
        )}
      </VStack>
    );
  }

  // ---- FORM VIEW (create/edit) ----
  if (view === 'form') {
    return (
      <VStack align="stretch" spacing={5} maxW="900px">
        <HStack justify="space-between">
          <Text fontSize="xl" fontWeight="bold" color={brand.charcoal}>
            {form._id ? 'Muokkaa tarjousta' : 'Uusi tarjous'}
          </Text>
          <Button
            variant="ghost"
            onClick={() => (dirty ? setConfirmClose(true) : (setView(form._id ? 'detail' : 'list')))}
          >
            Peruuta
          </Button>
        </HStack>

        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
          <Text fontWeight="bold" mb={3}>
            Asiakas
          </Text>
          <HStack align="flex-end" spacing={3}>
            <FormControl flex={1}>
              <FormLabel fontSize="sm">Asiakas</FormLabel>
              <Select
                h="40px"
                placeholder="Valitse asiakas…"
                value={form.asiakasId}
                onChange={(e) => {
                  const c = customers.find((x) => x._id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    asiakasId: e.target.value,
                    asiakasNimi: c?.name || '',
                    // Snapshot the customer's billing details onto the offer
                    // — only for a brand-new offer, never overwriting a
                    // manually-edited value on an existing one.
                    ...(!f._id && c
                      ? {
                          ytunnus: String(c.fields?.[AF.ytunnus] ?? f.ytunnus),
                          verkkolaskuosoite: String(c.fields?.[AF.verkkolaskuosoite] ?? f.verkkolaskuosoite),
                          valittajatunnus: String(c.fields?.[AF.valittajatunnus] ?? f.valittajatunnus),
                          laskutusosoite: String(c.fields?.[AF.laskutusosoite] ?? f.laskutusosoite),
                          maksuehtoPv: String(c.fields?.[AF.maksuehtoPv] ?? f.maksuehtoPv),
                        }
                      : {}),
                  }));
                  setDirty(true);
                }}
              >
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <Button
              h="40px"
              variant="outline"
              leftIcon={<HailerPlus />}
              onClick={async () => {
                // Opens Hailer's native creation sidenav ON TOP of this form
                // — nothing navigates away, so the unfinished offer is never
                // lost. On save, refresh the customer list and select it.
                const created = await hailer.ui.activity.create(WF.asiakkaat, {
                  fields: { '6ab22e4f991a8feac7574d65': 'Prospekti', '6a9fdfb32921da91c45bbd79': 21 },
                });
                if (created) {
                  const fresh = await listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c');
                  setCustomers(fresh);
                  setForm((f) => ({ ...f, asiakasId: created._id, asiakasNimi: created.name }));
                  setDirty(true);
                }
              }}
            >
              Uusi asiakas
            </Button>
          </HStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
            <Text fontWeight="bold" mb={3}>
              Aikataulu
            </Text>
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Tarjouspäivä</FormLabel>
                <Input h="40px" type="date" value={form.tarjouspaiva} onChange={(e) => { setForm((f) => ({ ...f, tarjouspaiva: e.target.value })); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Voimassa asti</FormLabel>
                <Input h="40px" type="date" value={form.voimassaAsti} onChange={(e) => { setForm((f) => ({ ...f, voimassaAsti: e.target.value })); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Toimituspäivä</FormLabel>
                <Input h="40px" type="date" value={form.toimituspiv} onChange={(e) => { setForm((f) => ({ ...f, toimituspiv: e.target.value })); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Tuotannon deadline</FormLabel>
                <Input h="40px" type="date" value={form.tuotannonDeadline} onChange={(e) => { setForm((f) => ({ ...f, tuotannonDeadline: e.target.value })); setDirty(true); }} />
              </FormControl>
            </VStack>
          </Box>

          <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
            <Text fontWeight="bold" mb={3}>
              Toimitus ja tuotanto
            </Text>
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Toimitustapa</FormLabel>
                <Select h="40px" value={form.toimitustapa} onChange={(e) => { setForm((f) => ({ ...f, toimitustapa: e.target.value })); setDirty(true); }}>
                  <option value="Posti">Posti</option>
                  <option value="Lähetti">Lähetti</option>
                  <option value="Nouto">Nouto</option>
                </Select>
              </FormControl>
              <Box borderTop={`1px solid ${brand.border}`} pt={3}>
                <Text fontSize="xs" fontWeight="bold" color="subtleText" mb={2}>
                  TOIMITUSOSOITE
                </Text>
                <SimpleGrid columns={2} gap={2} mb={2}>
                  <FormControl>
                    <FormLabel fontSize="xs">Vastaanottaja</FormLabel>
                    <Input h="36px" value={form.toimVastaanottaja} onChange={(e) => { setForm((f) => ({ ...f, toimVastaanottaja: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Katuosoite</FormLabel>
                    <Input h="36px" value={form.toimKatuosoite} onChange={(e) => { setForm((f) => ({ ...f, toimKatuosoite: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Postinumero</FormLabel>
                    <Input h="36px" value={form.toimPostinumero} onChange={(e) => { setForm((f) => ({ ...f, toimPostinumero: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Kaupunki</FormLabel>
                    <Input h="36px" value={form.toimKaupunki} onChange={(e) => { setForm((f) => ({ ...f, toimKaupunki: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Maa</FormLabel>
                    <Input h="36px" value={form.toimMaa} onChange={(e) => { setForm((f) => ({ ...f, toimMaa: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Lisätiedot</FormLabel>
                    <Input h="36px" value={form.toimLisatiedot} onChange={(e) => { setForm((f) => ({ ...f, toimLisatiedot: e.target.value })); setDirty(true); }} />
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel fontSize="xs">Muut toimitusosoitteet (jos useampia)</FormLabel>
                  <Textarea rows={2} value={form.toimitusosoitteet} onChange={(e) => { setForm((f) => ({ ...f, toimitusosoitteet: e.target.value })); setDirty(true); }} placeholder="Yksi osoite per rivi" />
                </FormControl>
              </Box>
              <FormControl>
                <FormLabel fontSize="sm">Tuotanto</FormLabel>
                <Select h="40px" value={form.tuotanto} onChange={(e) => { setForm((f) => ({ ...f, tuotanto: e.target.value })); setDirty(true); }}>
                  <option value="Copy-Set">Copy-Set</option>
                  <option value="Alihankkija">Alihankkija</option>
                </Select>
              </FormControl>
              {form.tuotanto === 'Alihankkija' && (
                <FormControl>
                  <FormLabel fontSize="sm">Alihankkija</FormLabel>
                  <Select h="40px" placeholder="Valitse…" value={form.alihankkijaId} onChange={(e) => { setForm((f) => ({ ...f, alihankkijaId: e.target.value })); setDirty(true); }}>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              )}
            </VStack>
          </Box>
        </SimpleGrid>

        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
          <HStack justify="space-between" mb={3}>
            <Text fontWeight="bold">Tuotteet</Text>
            <Button size="sm" variant="outline" leftIcon={<HailerPlus />} onClick={addLine}>
              Lisää tuote
            </Button>
          </HStack>
          <VStack align="stretch" spacing={4}>
            {form.lines.length === 0 && <Text color="subtleText" fontSize="sm">Ei tuoteriveja. Lisää vähintään yksi tuote.</Text>}
            {form.lines.map((line, idx) => (
              <Box key={idx} border={`1px solid ${brand.border}`} borderRadius="10px" p={4} bg={brand.lightGrey}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold" fontSize="sm">
                    Rivi {idx + 1}
                  </Text>
                  <IconButton aria-label="Poista rivi" icon={<HailerTrash />} size="sm" variant="ghost" colorScheme="red" onClick={() => removeLine(idx)} />
                </HStack>
                <SimpleGrid columns={{ base: 1, md: 3 }} gap={3} mb={2}>
                  <FormControl>
                    <FormLabel fontSize="xs">Tuote</FormLabel>
                    <Select
                      h="40px"
                      bg="white"
                      placeholder="Valitse tuote…"
                      value={line.tuoteId}
                      onChange={(e) => {
                        const tuoteId = e.target.value;
                        const p = products.find((x) => x._id === tuoteId);
                        const resolved = resolveUnitPrice(pricingCatalog, tuoteId, form.asiakasId || null, Number(line.maara) || 1);
                        updateLine(idx, {
                          tuoteId,
                          tuoteNimi: p?.name || '',
                          yksikkohinta: resolved.source !== 'none' ? String(resolved.unitPrice) : line.yksikkohinta,
                        });
                      }}
                    >
                      {activeProducts.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Määrä</FormLabel>
                    <NumberInput
                      min={0}
                      value={line.maara}
                      onChange={(v) => {
                        if (!line.tuoteId) {
                          updateLine(idx, { maara: v });
                          return;
                        }
                        const resolved = resolveUnitPrice(pricingCatalog, line.tuoteId, form.asiakasId || null, Number(v) || 1);
                        updateLine(idx, { maara: v, yksikkohinta: resolved.source !== 'none' ? String(resolved.unitPrice) : line.yksikkohinta });
                      }}
                    >
                      <NumberInputField h="40px" bg="white" />
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Yksikköhinta (€)</FormLabel>
                    <NumberInput min={0} value={line.yksikkohinta} onChange={(v) => updateLine(idx, { yksikkohinta: v })}>
                      <NumberInputField h="40px" bg="white" />
                    </NumberInput>
                  </FormControl>
                </SimpleGrid>
                {line.tuoteId &&
                  (() => {
                    const tuoteryhmaId = readLink(products.find((p) => p._id === line.tuoteId)?.fields?.[PF.tuoteryhma]).id;
                    const groups = optionGroupsFor(pricingCatalog, tuoteryhmaId);
                    if (!groups.length) return null;
                    return (
                      <SimpleGrid columns={{ base: 1, md: groups.length > 2 ? 3 : groups.length }} gap={3} mb={2}>
                        {groups.map((group) => {
                          const selected = line.selectedOptions[group.name] || group.choices.find((c) => c.isDefault)?.id || group.choices[0]?.id || '';
                          return (
                            <FormControl key={group.name}>
                              <FormLabel fontSize="xs">{group.name}</FormLabel>
                              <Select
                                h="38px"
                                bg="white"
                                fontSize="sm"
                                value={selected}
                                onChange={(e) => {
                                  const nextOptions = { ...line.selectedOptions, [group.name]: e.target.value };
                                  const resolved = resolveLinePrice(pricingCatalog, {
                                    tuoteId: line.tuoteId,
                                    tuoteryhmaId,
                                    qty: Number(line.maara) || 1,
                                    customerId: form.asiakasId || null,
                                    selectedOptions: nextOptions,
                                  });
                                  updateLine(idx, {
                                    selectedOptions: nextOptions,
                                    yksikkohinta: resolved.source !== 'none' ? String(Math.round(resolved.unitPrice * 100) / 100) : line.yksikkohinta,
                                    spesifikaatiot: resolved.optionSummary || line.spesifikaatiot,
                                  });
                                }}
                              >
                                {group.choices.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label}
                                  </option>
                                ))}
                              </Select>
                            </FormControl>
                          );
                        })}
                      </SimpleGrid>
                    );
                  })()}
                {line.tuoteId &&
                  (() => {
                    const resolved = resolveUnitPrice(pricingCatalog, line.tuoteId, form.asiakasId || null, Number(line.maara) || 1);
                    if (resolved.source === 'none') return null;
                    const matches = Math.abs(resolved.unitPrice - (Number(line.yksikkohinta) || 0)) < 0.005;
                    return (
                      <HStack mb={2} fontSize="11px" color={matches ? 'subtleText' : 'orange.600'} justify="space-between">
                        <Text>
                          Hinnaston ehdotus: <b>{formatEUR(resolved.unitPrice)}</b> / kpl &mdash; {resolved.label}
                        </Text>
                        {!matches && (
                          <Button size="xs" variant="link" colorScheme="orange" onClick={() => updateLine(idx, { yksikkohinta: String(resolved.unitPrice) })}>
                            Käytä ehdotus
                          </Button>
                        )}
                      </HStack>
                    );
                  })()}
                <FormControl mb={2}>
                  <FormLabel fontSize="xs">Kuvaus / spesifikaatiot</FormLabel>
                  <Textarea bg="white" rows={2} value={line.spesifikaatiot} onChange={(e) => updateLine(idx, { spesifikaatiot: e.target.value })} />
                </FormControl>

                <HStack justify="space-between" mt={3} mb={1}>
                  <Text fontSize="xs" fontWeight="bold" color="subtleText">
                    LISÄTYÖT
                  </Text>
                  <HStack>
                    <Select
                      size="xs"
                      w="200px"
                      bg="white"
                      placeholder="+ Lisätyö hinnastosta…"
                      value=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const preset = listyohinnasto.find((p) => p._id === e.target.value);
                        if (preset) addExtra(idx, { nimi: preset.name, hinta: String(readValue(preset.fields?.[LHF.oletushinta]) ?? '0') });
                      }}
                    >
                      {listyohinnasto.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({formatEUR(readValue(p.fields?.[LHF.oletushinta]) ?? 0)})
                        </option>
                      ))}
                    </Select>
                    <Button size="xs" variant="outline" onClick={() => addExtra(idx)}>
                      + Oma lisätyö
                    </Button>
                  </HStack>
                </HStack>
                {line.extras.map((extra, ei) => (
                  <HStack key={ei} mb={2} bg="white" p={2} borderRadius="8px">
                    <Input h="36px" placeholder="Lisätyön nimi" value={extra.nimi} onChange={(e) => updateExtra(idx, ei, { nimi: e.target.value })} />
                    <NumberInput min={0} h="36px" w="140px" value={extra.hinta} onChange={(v) => updateExtra(idx, ei, { hinta: v })}>
                      <NumberInputField h="36px" />
                    </NumberInput>
                    <IconButton aria-label="Poista lisätyö" icon={<HailerTrash />} size="sm" variant="ghost" colorScheme="red" onClick={() => removeExtra(idx, ei)} />
                  </HStack>
                ))}
              </Box>
            ))}
          </VStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
            <Text fontWeight="bold" mb={3}>
              Maksut ja ehdot
            </Text>
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Toimitushinta (€)</FormLabel>
                <NumberInput min={0} value={form.toimitushinta} onChange={(v) => { setForm((f) => ({ ...f, toimitushinta: v })); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Aloitusmaksu (€)</FormLabel>
                <NumberInput min={0} value={form.aloitusmaksu} onChange={(v) => { setForm((f) => ({ ...f, aloitusmaksu: v })); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Laskutuslisä (€)</FormLabel>
                <NumberInput min={0} value={form.laskutuslisa} onChange={(v) => { setForm((f) => ({ ...f, laskutuslisa: v })); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">ALV %</FormLabel>
                <Select h="40px" value={form.alv} onChange={(e) => { setForm((f) => ({ ...f, alv: e.target.value })); setDirty(true); }}>
                  <option value="25.5">25,5 % (kotimaa)</option>
                  <option value="0">0 % (vienti)</option>
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Maksuehto (pv)</FormLabel>
                <NumberInput min={0} value={form.maksuehtoPv} onChange={(v) => { setForm((f) => ({ ...f, maksuehtoPv: v })); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Asiakkaan referenssi</FormLabel>
                <Input h="40px" value={form.asiakkaanReferenssi} onChange={(e) => { setForm((f) => ({ ...f, asiakkaanReferenssi: e.target.value })); setDirty(true); }} />
              </FormControl>
              <Box borderTop={`1px solid ${brand.border}`} pt={3} mt={1}>
                <Text fontSize="xs" fontWeight="bold" color="subtleText" mb={2}>
                  LASKUTUS JA VEROTUS
                </Text>
                <VStack align="stretch" spacing={3}>
                  <FormControl>
                    <FormLabel fontSize="sm">Y-tunnus</FormLabel>
                    <Input h="40px" value={form.ytunnus} onChange={(e) => { setForm((f) => ({ ...f, ytunnus: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Asiakkaan maa</FormLabel>
                    <Input h="40px" value={form.asiakkaanMaa} onChange={(e) => { setForm((f) => ({ ...f, asiakkaanMaa: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Laskutusosoite</FormLabel>
                    <Textarea rows={2} value={form.laskutusosoite} onChange={(e) => { setForm((f) => ({ ...f, laskutusosoite: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Verkkolaskuosoite</FormLabel>
                    <Input h="40px" value={form.verkkolaskuosoite} onChange={(e) => { setForm((f) => ({ ...f, verkkolaskuosoite: e.target.value })); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="sm">Välittäjätunnus</FormLabel>
                    <Input h="40px" value={form.valittajatunnus} onChange={(e) => { setForm((f) => ({ ...f, valittajatunnus: e.target.value })); setDirty(true); }} />
                  </FormControl>
                </VStack>
              </Box>
            </VStack>
          </Box>

          <VStack spacing={4} align="stretch">
            <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
              <Text fontWeight="bold" mb={3}>
                Ehdot ja muistiinpanot
              </Text>
              <FormControl mb={3}>
                <FormLabel fontSize="sm">Ehdot ja huomiot (näkyy asiakkaalle)</FormLabel>
                <Textarea rows={3} value={form.ehdotJaHuomiot} onChange={(e) => { setForm((f) => ({ ...f, ehdotJaHuomiot: e.target.value })); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Sisäiset muistiinpanot</FormLabel>
                <Textarea rows={3} value={form.sisisetMuistiinpanot} onChange={(e) => { setForm((f) => ({ ...f, sisisetMuistiinpanot: e.target.value })); setDirty(true); }} />
              </FormControl>
            </Box>

            <Box bg={brand.charcoal} color="white" borderRadius="12px" p={5}>
              <Text fontWeight="bold" mb={2} color={brand.orange}>
                YHTEENVETO
              </Text>
              <HStack justify="space-between" fontSize="sm">
                <Text>Tuotteet + lisätyöt</Text>
                <Text>{formatEUR(totals.tuotteet)}</Text>
              </HStack>
              <Divider my={2} borderColor="gray.600" />
              <HStack justify="space-between" fontSize="sm" fontWeight="bold">
                <Text>Yhteensä (ALV 0%)</Text>
                <Text>{formatEUR(totals.netto)}</Text>
              </HStack>
              <HStack justify="space-between" fontSize="sm">
                <Text>ALV {form.alv} %</Text>
                <Text>{formatEUR(totals.alvMaara)}</Text>
              </HStack>
              <Divider my={2} borderColor="gray.600" />
              <HStack justify="space-between" fontSize="lg" fontWeight="extrabold" color={brand.orange}>
                <Text>YHTEENSÄ</Text>
                <Text>{formatEUR(totals.brutto)}</Text>
              </HStack>
            </Box>
          </VStack>
        </SimpleGrid>

        <HStack justify="flex-end" spacing={3} pb={6}>
          <Button variant="ghost" h="40px" onClick={() => (dirty ? setConfirmClose(true) : setView(form._id ? 'detail' : 'list'))} isDisabled={saving}>
            Sulje / Takaisin
          </Button>
          <Button variant="outline" h="40px" onClick={handleSaveAndClose} isLoading={saving} loadingText="Tallennetaan…">
            Tallenna luonnos
          </Button>
          <Button h="40px" bg={brand.orange} color={brand.charcoal} _hover={{ bg: brand.orangeAccent, color: 'white' }} onClick={handleReviewOffer} isLoading={saving}>
            Tarkista tarjous
          </Button>
        </HStack>

        <ConfirmDialog
          isOpen={confirmClose}
          title="Hylätäänkö tallentamattomat muutokset?"
          body="Sinulla on tallentamattomia muutoksia. Jos suljet nyt, muutokset katoavat."
          confirmLabel="Hylkää muutokset"
          confirmColorScheme="red"
          onConfirm={() => {
            setConfirmClose(false);
            setView(form._id ? 'detail' : 'list');
          }}
          onCancel={() => setConfirmClose(false)}
        />
      </VStack>
    );
  }

  // ---- DETAIL VIEW ----
  if (view === 'detail' && selected) {
    const phaseName = OFFER_PHASE_LIST.find((p) => p.id === selected.currentPhase)?.name || 'Muu';
    const custName = readLink(selected.fields?.[TF.asiakas]).name || '\u2013';
    return (
      <VStack align="stretch" spacing={5} maxW="900px">
        <HStack justify="space-between" flexWrap="wrap">
          <VStack align="start" spacing={0}>
            <HStack>
              <Text fontSize="xl" fontWeight="bold" color={brand.charcoal}>
                {selected.name}
              </Text>
              <Badge bg={(phaseColor[phaseName] || { bg: '#EDF1F4', color: '#3F4851' }).bg} color={(phaseColor[phaseName] || { bg: '#EDF1F4', color: '#3F4851' }).color} borderRadius="full" px={3} py={1} fontWeight="800">
                {phaseName}
              </Badge>
            </HStack>
            <Text color="subtleText">{custName}</Text>
          </VStack>
          <Button variant="ghost" h="40px" onClick={backToList}>
            Takaisin
          </Button>
        </HStack>

        <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
          <Text fontWeight="bold" mb={3}>
            Tuotteet
          </Text>
          {selectedLines.length === 0 && <Text color="subtleText" fontSize="sm">Ei tuoteriveja.</Text>}
          {selectedLines.map(({ line, extras }) => (
            <Box key={line._id} borderBottom={`1px solid ${brand.border}`} py={2}>
              <HStack justify="space-between">
                <Text fontWeight="medium">
                  {readLink(line.fields?.[TRF.tuote]).name} × {String(line.fields?.[TRF.maara] ?? '')}
                </Text>
                <Text fontWeight="bold">{formatEUR(line.fields?.[TRF.rivinHinta])}</Text>
              </HStack>
              {extras.filter((e) => e.fields?.[LF.nimi]).length > 0 && (
                <VStack align="start" spacing={0} mt={1} pl={3}>
                  {extras
                    .filter((e) => e.fields?.[LF.nimi])
                    .map((e) => (
                      <Text key={e._id} fontSize="sm" color="subtleText">
                        + {String(e.fields?.[LF.nimi])}: {formatEUR(e.fields?.[LF.hinta])}
                      </Text>
                    ))}
                </VStack>
              )}
            </Box>
          ))}
          <HStack justify="space-between" mt={3} fontWeight="extrabold" fontSize="lg" color={brand.orangeAccent}>
            <Text>YHTEENSÄ SIS. ALV</Text>
            <Text>{formatEUR(selected.fields?.[TF.loppusumma])}</Text>
          </HStack>
        </Box>

        <HStack spacing={3} flexWrap="wrap" justify="flex-end">
          <Button variant="outline" h="40px" onClick={() => void openEdit()}>
            Muokkaa
          </Button>
          <Button
            variant="outline"
            h="40px"
            onClick={() => void hailer.ui.activity.open(selected._id, { tab: 'detail' })}
          >
            Tarkista / esikatsele
          </Button>
          {selected.currentPhase === TP.luonnos && (
            <Button h="40px" bg={brand.orange} color={brand.charcoal} _hover={{ bg: brand.orangeAccent, color: 'white' }} onClick={handleSend} isLoading={saving}>
              Lähetä tarjous
            </Button>
          )}
          {selected.currentPhase === TP.lahetetty && (
            <>
              <Button h="40px" colorScheme="red" variant="outline" onClick={() => setConfirmReject(true)}>
                Merkitse hylätyksi
              </Button>
              <Button h="40px" colorScheme="green" onClick={() => setConfirmApprove(true)}>
                Merkitse hyväksytyksi
              </Button>
            </>
          )}
          {selected.currentPhase === TP.hyvaksytty && !readLink(selected.fields?.[TF.luotuTilaus]).id && (
            <Button h="40px" bg={brand.green} color="white" _hover={{ opacity: 0.9 }} onClick={handleCreateOrder}>
              Luo tilaus
            </Button>
          )}
          {readLink(selected.fields?.[TF.luotuTilaus]).id && (
            <Badge colorScheme="green" px={3} py={2} borderRadius="full">
              Tilaus luotu tästä tarjouksesta
            </Badge>
          )}
        </HStack>

        <ConfirmDialog
          isOpen={confirmApprove}
          title="Merkitäänkö tarjous hyväksytyksi?"
          body="Tämä toiminto vahvistaa, että asiakas on hyväksynyt tarjouksen. Sitä ei tehdä automaattisesti lähetyksen yhteydessä."
          confirmLabel="Merkitse hyväksytyksi"
          confirmColorScheme="green"
          isLoading={saving}
          onConfirm={handleApprove}
          onCancel={() => setConfirmApprove(false)}
        />
        <ConfirmDialog
          isOpen={confirmReject}
          title="Merkitäänkö tarjous hylätyksi?"
          body="Tarjous siirtyy Hylätty-vaiheeseen."
          confirmLabel="Merkitse hylätyksi"
          confirmColorScheme="red"
          isLoading={saving}
          onConfirm={handleReject}
          onCancel={() => setConfirmReject(false)}
        />
      </VStack>
    );
  }

  return null;
}
