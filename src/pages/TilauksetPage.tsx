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
  TILAUKSET_FIELDS as OF,
  TILAUKSET_PHASES as OP,
  TILAUSRIVIT_FIELDS as ORF,
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
import { formatEUR, formatDate, readLink, readValue, toDateInputValue, isOverdue, composeAddress } from '../lib/format';
import { resolveUnitPrice, resolveLinePrice, optionGroupsFor, type PricingCatalog } from '../lib/pricing';
import ConfirmDialog from '../components/ConfirmDialog';
import { HailerPlus } from '../hailer/theme/icons/HailerPlus';
import { HailerTrash } from '../hailer/theme/icons/HailerTrash';
import { HailerPrint } from '../hailer/theme/icons/HailerPrint';
import { duplicateOrder } from '../lib/orderDuplicate';

const ORDER_PHASE_LIST = [
  { id: OP.vahvistettu, name: 'Vahvistettu' },
  { id: OP.tuotannossa, name: 'Tuotannossa' },
  { id: OP.valmis, name: 'Valmis' },
  { id: OP.laskutusvalmis, name: 'Laskutusvalmis' },
  { id: OP.laskutettu, name: 'Laskutettu' },
  { id: OP.peruttu, name: 'Peruttu' },
];
const ALL_ORDER_PHASE_IDS = Object.values(OP);
// Exact filter set from the authoritative reference package (copyset-erp.zip,
// src/app.js: ORDER_ST + orderList filters). "Kaikki" is genuinely
// everything — Laskutettu is a normal filterable chip, not excluded.
// "Peruttu" is this build's own non-destructive-cancel addition (see
// workspace-bindings.ts) and is included in "Kaikki" but not in the main
// filter chips, matching how the reference treats deleted orders (invisible
// unless you know to look — here, always reachable via "Kaikki").
const MAIN_ORDER_STAGES = ['Vahvistettu', 'Tuotannossa', 'Valmis', 'Laskutusvalmis', 'Laskutettu'];
// Matches the reference's late(): only Vahvistettu/Tuotannossa can ever be
// late — Valmis/Laskutusvalmis/Laskutettu are excluded regardless of deadline.
const ORDER_NEVER_LATE_STATUSES = new Set(['Valmis', 'Laskutusvalmis', 'Laskutettu', 'Peruttu']);

function orderStatusOf(o: Activity): string {
  return ORDER_PHASE_LIST.find((p) => p.id === o.currentPhase)?.name || 'Muu';
}

function orderDeadlineValue(o: Activity): unknown {
  return o.fields?.[OF.tuotannonDeadline] || o.fields?.[OF.toimituspiv];
}

function orderIsLate(o: Activity): boolean {
  const status = orderStatusOf(o);
  if (ORDER_NEVER_LATE_STATUSES.has(status)) return false;
  return isOverdue(orderDeadlineValue(o));
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
interface OrderFormState {
  _id?: string;
  asiakasId: string;
  tilauspaiva: string;
  toimituspiv: string;
  tuotannonDeadline: string;
  projektinNimi: string;
  toimitustapa: string;
  toimitusosoite: string;
  toimVastaanottaja: string;
  toimKatuosoite: string;
  toimPostinumero: string;
  toimKaupunki: string;
  toimMaa: string;
  toimLisatiedot: string;
  laskutusosoite: string;
  ytunnus: string;
  asiakkaanMaa: string;
  verkkolaskuosoite: string;
  valittajatunnus: string;
  asiakkaanViitePo: string;
  maksuehtoPv: string;
  alv: string;
  toimitushinta: string;
  aloitusmaksu: string;
  laskutuslisa: string;
  sisisetMuistiinpanot: string;
  maksutapa: string;
  lines: LineForm[];
}

function toForm(order: Activity): OrderFormState {
  return {
    _id: order._id,
    asiakasId: readLink(order.fields?.[OF.asiakas]).id || '',
    tilauspaiva: toDateInputValue(order.fields?.[OF.tilauspaiva]) || new Date().toISOString().slice(0, 10),
    toimituspiv: toDateInputValue(order.fields?.[OF.toimituspiv]),
    tuotannonDeadline: toDateInputValue(order.fields?.[OF.tuotannonDeadline]),
    projektinNimi: String(order.fields?.[OF.projektinNimi] ?? ''),
    toimitustapa: String(order.fields?.[OF.toimitustapa] ?? 'Nouto'),
    toimitusosoite: String(order.fields?.[OF.toimitusosoite] ?? ''),
    toimVastaanottaja: String(order.fields?.[OF.toimVastaanottaja] ?? ''),
    toimKatuosoite: String(order.fields?.[OF.toimKatuosoite] ?? ''),
    toimPostinumero: String(order.fields?.[OF.toimPostinumero] ?? ''),
    toimKaupunki: String(order.fields?.[OF.toimKaupunki] ?? ''),
    toimMaa: String(order.fields?.[OF.toimMaa] ?? 'Suomi'),
    toimLisatiedot: String(order.fields?.[OF.toimLisatiedot] ?? ''),
    laskutusosoite: String(order.fields?.[OF.laskutusosoite] ?? ''),
    ytunnus: String(order.fields?.[OF.ytunnus] ?? ''),
    asiakkaanMaa: String(order.fields?.[OF.asiakkaanMaa] ?? 'Suomi'),
    verkkolaskuosoite: String(order.fields?.[OF.verkkolaskuosoite] ?? ''),
    valittajatunnus: String(order.fields?.[OF.valittajatunnus] ?? ''),
    asiakkaanViitePo: String(order.fields?.[OF.asiakkaanViitePo] ?? ''),
    maksuehtoPv: String(order.fields?.[OF.maksuehtoPv] ?? '21'),
    alv: String(order.fields?.[OF.alv] ?? '25.5'),
    toimitushinta: String(order.fields?.[OF.toimitushinta] ?? '0'),
    aloitusmaksu: String(order.fields?.[OF.aloitusmaksu] ?? '50'),
    laskutuslisa: String(order.fields?.[OF.laskutuslisa] ?? '6'),
    sisisetMuistiinpanot: String(order.fields?.[OF.sisisetMuistiinpanot] ?? ''),
    maksutapa: String(order.fields?.[OF.maksutapaKateiskuitti] ?? ''),
    lines: [],
  };
}

interface Props {
  hailer: HailerApi;
  focusOrderId?: string | null;
  onFocusHandled?: () => void;
  presetCustomerId?: string | null;
  onOpenNewRequested?: boolean;
  onNewHandled?: () => void;
  archiveOnly?: boolean;
}

export default function TilauksetPage({ hailer, focusOrderId, onFocusHandled, presetCustomerId, onOpenNewRequested, onNewHandled, archiveOnly }: Props) {
  const toast = useToast();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [orders, setOrders] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('Kaikki');

  const [customers, setCustomers] = useState<Activity[]>([]);
  const [products, setProducts] = useState<Activity[]>([]);
  const [hinnastot, setHinnastot] = useState<Activity[]>([]);
  const [tuotehinnat, setTuotehinnat] = useState<Activity[]>([]);
  const [asiakashinnat, setAsiakashinnat] = useState<Activity[]>([]);
  const [asetukset, setAsetukset] = useState<Activity | null>(null);
  const [listyohinnasto, setListyohinnasto] = useState<Activity[]>([]);
  const [tuotevalinnat, setTuotevalinnat] = useState<Activity[]>([]);

  const [selected, setSelected] = useState<Activity | null>(null);
  const [selectedLines, setSelectedLines] = useState<Array<{ line: Activity; extras: Activity[] }>>([]);

  const [form, setForm] = useState<OrderFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmProductionDone, setConfirmProductionDone] = useState(false);
  const [confirmApproveInvoice, setConfirmApproveInvoice] = useState(false);
  const [approveInvoiceTargetId, setApproveInvoiceTargetId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);


  // ---- Tuotannossa inline work-order editor state (matches the reference's
  // dedicated editable production card — not the generic order form) ----
  const [woDeadline, setWoDeadline] = useState('');
  const [woToimitustapa, setWoToimitustapa] = useState('Posti');
  const [woTuotanto, setWoTuotanto] = useState('Copy-Set');
  const [woNotes, setWoNotes] = useState('');
  const [woLines, setWoLines] = useState<Record<string, { maara: string; spesifikaatiot: string }>>({});
  const [woSaving, setWoSaving] = useState(false);

  const [lineSummary, setLineSummary] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [list, allLines] = await Promise.all([
        listAllWorkflow(hailer, WF.tilaukset, ALL_ORDER_PHASE_IDS),
        listAllPhase(hailer, WF.tilausrivit, '6a9fde6e0429f4bd513ae3b4'),
      ]);
      list.sort((a, b) => Number(b.created) - Number(a.created));
      setOrders(list);
      const byOrder: Record<string, string[]> = {};
      for (const l of allLines) {
        const orderId = readLink(l.fields?.[ORF.tilaus]).id;
        if (!orderId) continue;
        const productName = readLink(l.fields?.[ORF.tuote]).name || 'Tuote';
        const qty = l.fields?.[ORF.maara];
        (byOrder[orderId] ||= []).push(`${productName} · ${qty ?? 0}`);
      }
      const summary: Record<string, string> = {};
      for (const [id, rows] of Object.entries(byOrder)) summary[id] = rows.join(', ');
      setLineSummary(summary);
    } catch {
      toast({ title: 'Tilausten lataus epäonnistui', status: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  const loadRefs = useCallback(async () => {
    const [c, p, h, th, ah, settings, lh, tv] = await Promise.all([
      listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c'),
      listAllPhase(hailer, WF.tuotteet, '6a9fde6e0429f4bd513ae38f'),
      listAllPhase(hailer, WF.hinnastot, HINNASTOT_PHASES.kaikki),
      listAllPhase(hailer, WF.tuotehinnat, TUOTEHINNAT_PHASES.kaikki),
      listAllPhase(hailer, WF.asiakashinnat, ASIAKASHINNAT_PHASES.kaikki),
      listAllPhase(hailer, WF.asetukset, ASETUKSET_PHASES.kaikki),
      listAllPhase(hailer, WF.listyohinnasto, LISTYOHINNASTO_PHASES.kaikki),
      listAllPhase(hailer, WF.tuotevalinnat, TUOTEVALINNAT_PHASES.kaikki),
    ]);
    setCustomers(c);
    setProducts(p);
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
    void loadOrders();
    void loadRefs();
  }, [loadOrders, loadRefs]);

  useEffect(() => {
    if (onOpenNewRequested) {
      openNew();
      onNewHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onOpenNewRequested]);

  useEffect(() => {
    if (focusOrderId) {
      void openDetail(focusOrderId);
      onFocusHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOrderId]);

  const visibleOrders = useMemo(() => {
    const archivePhases = new Set<string>([OP.laskutettu, OP.peruttu]);
    return orders.filter((o) => (archiveOnly ? archivePhases.has(o.currentPhase) : true));
  }, [orders, archiveOnly]);

  const filteredOrders = useMemo(() => {
    return visibleOrders.filter((o) => {
      if (!archiveOnly) {
        // "Kaikki" is genuinely everything; "Myöhässä" uses orderIsLate();
        // everything else is an exact status match — matches the canonical
        // `matches(o,filter)` exactly.
        if (phaseFilter === 'Myöhässä') {
          if (!orderIsLate(o)) return false;
        } else if (phaseFilter !== 'Kaikki' && orderStatusOf(o) !== phaseFilter) {
          return false;
        }
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const customerName = readLink(o.fields?.[OF.asiakas]).name?.toLowerCase() || '';
      return o.name.toLowerCase().includes(q) || customerName.includes(q);
    });
  }, [visibleOrders, phaseFilter, search, archiveOnly]);

  const phaseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of visibleOrders) {
      const status = orderStatusOf(o);
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [visibleOrders]);

  const mainFilterCounts = useMemo(() => {
    if (archiveOnly) return { Kaikki: 0, Myöhässä: 0 };
    return {
      Kaikki: visibleOrders.length,
      Myöhässä: visibleOrders.filter(orderIsLate).length,
    };
  }, [visibleOrders, archiveOnly]);

  function openNew() {
    const f: OrderFormState = {
      asiakasId: presetCustomerId || '',
      tilauspaiva: new Date().toISOString().slice(0, 10),
      toimituspiv: '',
      tuotannonDeadline: '',
      projektinNimi: '',
      toimitustapa: 'Nouto',
      toimitusosoite: '',
      toimVastaanottaja: '',
      toimKatuosoite: '',
      toimPostinumero: '',
      toimKaupunki: '',
      toimMaa: 'Suomi',
      toimLisatiedot: '',
      laskutusosoite: '',
      ytunnus: '',
      asiakkaanMaa: 'Suomi',
      verkkolaskuosoite: '',
      valittajatunnus: '',
      asiakkaanViitePo: '',
      maksuehtoPv: '21',
      alv: '25.5',
      toimitushinta: '0',
      aloitusmaksu: '50',
      laskutuslisa: '6',
      sisisetMuistiinpanot: '',
      maksutapa: '',
      lines: [],
    };
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
    setForm(f);
    setDirty(false);
    setSelected(null);
    setView('form');
  }

  async function loadLinesForOrder(orderId: string) {
    const allLines = await listAllPhase(hailer, WF.tilausrivit, '6a9fde6e0429f4bd513ae3b4');
    const mine = allLines.filter((l) => readLink(l.fields?.[ORF.tilaus]).id === orderId);
    const allExtras = await listAllPhase(hailer, WF.lisatyot, '6ab22888e066bd5d051623d2');
    return mine.map((line) => ({
      line,
      extras: allExtras.filter((e) => readLink(e.fields?.[LF.tilausrivi]).id === line._id),
    }));
  }

  async function openDetail(orderId: string) {
    const order = orders.find((o) => o._id === orderId) || (await hailer.activity.get(orderId));
    if (!order) return;
    setSelected(order);
    const lines = await loadLinesForOrder(orderId);
    setSelectedLines(lines);
    // Seed the Tuotannossa work-order editor state whenever we land on an
    // order that's actually in production.
    setWoDeadline(toDateInputValue(order.fields?.[OF.tuotannonDeadline]));
    setWoToimitustapa(String(order.fields?.[OF.toimitustapa] ?? 'Posti'));
    setWoTuotanto(String(order.fields?.[OF.tuotanto] ?? 'Copy-Set'));
    setWoNotes(String(order.fields?.[OF.sisisetMuistiinpanot] ?? ''));
    const seed: Record<string, { maara: string; spesifikaatiot: string }> = {};
    for (const { line } of lines) {
      seed[line._id] = {
        maara: String(line.fields?.[ORF.maara] ?? '0'),
        spesifikaatiot: String(line.fields?.[ORF.spesifikaatiot] ?? ''),
      };
    }
    setWoLines(seed);
    setView('detail');
  }

  async function saveWorkOrder() {
    if (!selected) return;
    setWoSaving(true);
    try {
      await hailer.activity.update(
        [
          {
            _id: selected._id,
            fields: {
              [OF.tuotannonDeadline]: woDeadline || null,
              [OF.toimitustapa]: woToimitustapa,
              [OF.tuotanto]: woTuotanto,
              [OF.sisisetMuistiinpanot]: woNotes || null,
            },
          },
        ],
        {},
      );
      for (const [lineId, edits] of Object.entries(woLines)) {
        await hailer.activity.update(
          [{ _id: lineId, fields: { [ORF.maara]: Number(edits.maara) || 0, [ORF.spesifikaatiot]: edits.spesifikaatiot || null } }],
          {},
        );
      }
      toast({ title: 'Työmääräys päivitetty.', status: 'success' });
      await loadOrders();
      await openDetail(selected._id);
    } catch {
      toast({ title: 'Tallennus epäonnistui', status: 'error' });
    } finally {
      setWoSaving(false);
    }
  }

  // Accepts an optional orderId so "Muokkaa" can be triggered directly from
  // the list (no need to open the removed custom detail view first).
  async function openEdit(orderId?: string) {
    const order = orderId ? orders.find((o) => o._id === orderId) || (await hailer.activity.get(orderId)) : selected;
    if (!order) return;
    setSelected(order);
    const lines = !orderId && selectedLines.length ? selectedLines : await loadLinesForOrder(order._id);
    const f = toForm(order);
    f.lines = lines.map(({ line, extras }) => ({
      _id: line._id,
      tuoteId: readLink(line.fields?.[ORF.tuote]).id || '',
      tuoteNimi: readLink(line.fields?.[ORF.tuote]).name || '',
      maara: String(line.fields?.[ORF.maara] ?? '1'),
      yksikkohinta: String(line.fields?.[ORF.yksikkohinta] ?? '0'),
      spesifikaatiot: String(line.fields?.[ORF.spesifikaatiot] ?? ''),
      selectedOptions: {},
      extras: extras
        .filter((e) => e.fields?.[LF.nimi])
        .map((e) => ({ _id: e._id, nimi: String(e.fields?.[LF.nimi] ?? ''), hinta: String(e.fields?.[LF.hinta] ?? '0') })),
    }));
    setForm(f);
    setDirty(false);
    setView('form');
  }

  function addLine() {
    setForm((f) => (f ? { ...f, lines: [...f.lines, { tuoteId: '', tuoteNimi: '', maara: '1', yksikkohinta: '0', spesifikaatiot: '', extras: [], selectedOptions: {} }] } : f));
    setDirty(true);
  }
  function removeLine(idx: number) {
    setForm((f) => (f ? { ...f, lines: f.lines.filter((_, i) => i !== idx) } : f));
    setDirty(true);
  }
  function updateLine(idx: number, patch: Partial<LineForm>) {
    setForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : f));
    setDirty(true);
  }
  function addExtra(lineIdx: number, preset?: { nimi: string; hinta: string }) {
    setForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === lineIdx ? { ...l, extras: [...l.extras, preset || { nimi: '', hinta: '0' }] } : l)) } : f));
    setDirty(true);
  }
  function removeExtra(lineIdx: number, extraIdx: number) {
    setForm((f) => (f ? { ...f, lines: f.lines.map((l, i) => (i === lineIdx ? { ...l, extras: l.extras.filter((_, ei) => ei !== extraIdx) } : l)) } : f));
    setDirty(true);
  }
  function updateExtra(lineIdx: number, extraIdx: number, patch: Partial<LineExtra>) {
    setForm((f) =>
      f
        ? {
            ...f,
            lines: f.lines.map((l, i) => (i === lineIdx ? { ...l, extras: l.extras.map((e, ei) => (ei === extraIdx ? { ...e, ...patch } : e)) } : l)),
          }
        : f,
    );
    setDirty(true);
  }

  const totals = useMemo(() => {
    if (!form) return { tuotteet: 0, netto: 0, alvMaara: 0, brutto: 0 };
    let tuotteet = 0;
    for (const l of form.lines) {
      const rowExtras = l.extras.filter((e) => e.nimi.trim()).reduce((s, e) => s + (Number(e.hinta) || 0), 0);
      tuotteet += (Number(l.maara) || 0) * (Number(l.yksikkohinta) || 0) + rowExtras;
    }
    const netto = tuotteet + (Number(form.toimitushinta) || 0) + (Number(form.aloitusmaksu) || 0) + (Number(form.laskutuslisa) || 0);
    const alvMaara = netto * ((Number(form.alv) || 0) / 100);
    return { tuotteet, netto, alvMaara, brutto: netto + alvMaara };
  }, [form]);

  async function saveOrder(): Promise<string | null> {
    if (!form) return null;
    if (!form.asiakasId) {
      toast({ title: 'Valitse asiakas ennen tallennusta.', status: 'warning' });
      return null;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: Record<string, any> = {
        [OF.asiakas]: form.asiakasId,
        [OF.tilauspaiva]: form.tilauspaiva || null,
        [OF.toimituspiv]: form.toimituspiv || null,
        [OF.tuotannonDeadline]: form.tuotannonDeadline || null,
        [OF.projektinNimi]: form.projektinNimi || null,
        [OF.toimitustapa]: form.toimitustapa,
        // Legacy flat field, auto-composed from the structured address so
        // documents that still read it (Lähete, Lähetyslappu) stay correct.
        [OF.toimitusosoite]:
          [
            composeAddress({
              vastaanottaja: form.toimVastaanottaja,
              katuosoite: form.toimKatuosoite,
              postinumero: form.toimPostinumero,
              kaupunki: form.toimKaupunki,
              maa: form.toimMaa,
              lisatiedot: form.toimLisatiedot,
            }),
            form.toimitusosoite,
          ]
            .filter(Boolean)
            .join('\n\n') || null,
        [OF.toimVastaanottaja]: form.toimVastaanottaja || null,
        [OF.toimKatuosoite]: form.toimKatuosoite || null,
        [OF.toimPostinumero]: form.toimPostinumero || null,
        [OF.toimKaupunki]: form.toimKaupunki || null,
        [OF.toimMaa]: form.toimMaa || null,
        [OF.toimLisatiedot]: form.toimLisatiedot || null,
        [OF.laskutusosoite]: form.laskutusosoite || null,
        [OF.ytunnus]: form.ytunnus || null,
        [OF.asiakkaanMaa]: form.asiakkaanMaa || null,
        [OF.verkkolaskuosoite]: form.verkkolaskuosoite || null,
        [OF.valittajatunnus]: form.valittajatunnus || null,
        [OF.asiakkaanViitePo]: form.asiakkaanViitePo || null,
        [OF.maksuehtoPv]: Number(form.maksuehtoPv) || 21,
        [OF.alv]: Number(form.alv),
        [OF.toimitushinta]: Number(form.toimitushinta) || 0,
        [OF.aloitusmaksu]: Number(form.aloitusmaksu) || 0,
        [OF.laskutuslisa]: Number(form.laskutuslisa) || 0,
        [OF.sisisetMuistiinpanot]: form.sisisetMuistiinpanot || null,
      };
      if (form.maksutapa) fields[OF.maksutapaKateiskuitti] = form.maksutapa;
      if (selected && selected.currentPhase !== OP.vahvistettu) {
        fields[OF.muutettuTuotannonJalkeen] = 'Kyllä';
      }

      let orderId = form._id;
      if (!orderId) {
        const created = await hailer.activity.create(WF.tilaukset, [{ name: 'TIL-' + Date.now(), fields }], { phaseId: OP.vahvistettu });
        orderId = Array.isArray(created) ? created[0]?._id : (created as unknown as Activity)?._id;
      } else {
        await hailer.activity.update([{ _id: orderId, fields }], {});
      }
      if (!orderId) throw new Error('Tallennus epäonnistui.');

      const existingLines = await loadLinesForOrder(orderId);
      for (const { line, extras } of existingLines) {
        for (const e of extras) await hailer.activity.remove([e._id]);
        await hailer.activity.remove([line._id]);
      }
      for (const l of form.lines) {
        if (!l.tuoteId) continue;
        const lineFields: Record<string, any> = {
          [ORF.tilaus]: orderId,
          [ORF.tuote]: l.tuoteId,
          [ORF.maara]: Number(l.maara) || 0,
          [ORF.yksikkohinta]: Number(l.yksikkohinta) || 0,
          [ORF.spesifikaatiot]: l.spesifikaatiot || null,
        };
        const createdLine = await hailer.activity.create(WF.tilausrivit, [{ name: l.tuoteNimi || 'Rivi', fields: lineFields }], {});
        const lineId = Array.isArray(createdLine) ? createdLine[0]?._id : (createdLine as unknown as Activity)?._id;
        if (!lineId) continue;
        for (const extra of l.extras) {
          if (!extra.nimi.trim()) continue;
          await hailer.activity.create(
            WF.lisatyot,
            [{ name: extra.nimi, fields: { [LF.tilausrivi]: lineId, [LF.nimi]: extra.nimi, [LF.hinta]: Number(extra.hinta) || 0 } }],
            {},
          );
        }
      }
      toast({ title: 'Tilaus tallennettu.', status: 'success' });
      setDirty(false);
      await loadOrders();
      return orderId;
    } catch (e) {
      toast({ title: 'Tallennus epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndClose() {
    const id = await saveOrder();
    if (id) await openDetail(id);
  }

  async function movePhase(phaseId: string, successMsg: string) {
    if (!selected) return;
    setSaving(true);
    try {
      await hailer.activity.update([{ _id: selected._id, phaseId }], {});
      toast({ title: successMsg, status: 'success' });
      await loadOrders();
      await openDetail(selected._id);
    } catch {
      toast({ title: 'Toiminto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // Matches invoiceReview.move() in the reference: from Valmis this both
  // transitions the phase AND opens the review in one click; from
  // Laskutusvalmis it would just reopen (handled by the caller instead).
  async function handleMoveToInvoiceReview() {
    if (!selected) return;
    setSaving(true);
    try {
      await hailer.activity.update([{ _id: selected._id, phaseId: OP.laskutusvalmis }], {});
      await loadOrders();
      await openDetail(selected._id);
      // Open Hailer's native sidenav — its own document/print picker
      // already has "Laskun tarkastus" available for this workflow.
      await hailer.ui.activity.open(selected._id, { tab: 'detail' });
    } catch {
      toast({ title: 'Toiminto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyAsNew() {
    if (!selected) return;
    setSaving(true);
    try {
      const newId = await duplicateOrder(hailer, selected._id);
      toast({ title: 'Uusi tilaus luotu kopiona.', status: 'success' });
      await loadOrders();
      await openDetail(newId);
    } catch (e) {
      toast({ title: 'Kopiointi epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setSaving(true);
    try {
      const lines = await loadLinesForOrder(selected._id);
      for (const { line, extras } of lines) {
        for (const e of extras) await hailer.activity.remove([e._id]);
        await hailer.activity.remove([line._id]);
      }
      await hailer.activity.remove([selected._id]);
      toast({ title: 'Tilaus poistettu.', status: 'success' });
      setConfirmDelete(false);
      setView('list');
      setSelected(null);
      await loadOrders();
    } catch {
      toast({ title: 'Poisto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function backToList() {
    setView('list');
    setSelected(null);
  }

  // Direct, list-level phase transition — no need to open the full detail
  // view just to advance an order that doesn't need any custom editing.
  async function movePhaseDirect(id: string, phaseId: string, successMsg: string) {
    setSaving(true);
    try {
      await hailer.activity.update([{ _id: id, phaseId }], {});
      toast({ title: successMsg, status: 'success' });
      await loadOrders();
    } catch {
      toast({ title: 'Toiminto epäonnistui', status: 'error' });
    } finally {
      setSaving(false);
    }
  }



  // Every "document" button opens the SAME native Hailer sidenav — Hailer's
  // own activity view already has a print/document picker listing every
  // template configured on this workflow (Tilausvahvistus, Työkortti,
  // Lähete, Lähetyslappu, Käteiskuitti, Laskun tarkastus). We don't
  // reimplement a PDF viewer; we just hand off to it. The `name` argument
  // is kept so each button's intent stays documented in the JSX even
  // though the action is identical.
  const openPreview = (_name: string) => {
    if (selected) void hailer.ui.activity.open(selected._id, { tab: 'detail' });
  };

  // ---- LIST VIEW ---- (matches orders-list.js / final-ui.css exactly)
  if (view === 'list') {
    // Matches orders-list.js nextLabel() + advance() dispatch — clicking the
    // single action pill performs the transition directly, no confirm
    // dialog (the reference doesn't gate this action either).
    const rowAdvance = (o: Activity, phaseName: string): { label: string; done: boolean; onClick: () => void } => {
      if (phaseName === 'Laskutettu') return { label: '✓ Valmis', done: true, onClick: () => void hailer.ui.activity.open(o._id, { tab: 'detail' }) };
      if (phaseName === 'Vahvistettu' || phaseName === 'Luonnos')
        return { label: 'Aloita tuotanto →', done: false, onClick: () => void movePhaseDirect(o._id, OP.tuotannossa, 'Tilaus siirretty tuotantoon.') };
      if (phaseName === 'Tuotannossa')
        return { label: 'Kuittaa valmiiksi →', done: false, onClick: () => void movePhaseDirect(o._id, OP.valmis, 'Tilaus merkitty valmiiksi.') };
      if (phaseName === 'Valmis' || phaseName === 'Toimitettu')
        return {
          label: 'Laskun tarkastus →',
          done: false,
          onClick: () =>
            void (async () => {
              await movePhaseDirect(o._id, OP.laskutusvalmis, 'Tilaus siirretty laskun tarkastukseen.');
              // Hailer's own document/print picker already has "Laskun
              // tarkastus" available for this workflow.
              await hailer.ui.activity.open(o._id, { tab: 'detail' });
            })(),
        };
      // One button, exactly like every other stage — opens the confirm-gated
      // approve dialog directly (row click still opens the native sidenav
      // to view the actual invoice document beforehand, same as any row).
      if (phaseName === 'Laskutusvalmis') return { label: 'Tarkista lasku →', done: false, onClick: () => setApproveInvoiceTargetId(o._id) };
      return { label: 'Avaa', done: false, onClick: () => void hailer.ui.activity.open(o._id, { tab: 'detail' }) };
    };

    return (
      <VStack align="stretch" spacing="14px">
        {!archiveOnly && (
          <Box>
            <Text as="h1" fontSize="32px" fontWeight={800} letterSpacing="-0.015em" lineHeight="1.1" color={brand.charcoal}>
              Tilaukset
            </Text>
            <Text mt="4px" color="subtleText" fontSize="15px">
              Jokainen tilan muutos tehdään omalla painikkeella. Dokumenttien avaaminen tai tulostus ei muuta tilaa.
            </Text>
          </Box>
        )}
        <Box>
          <Input
            mb={archiveOnly ? 0 : '14px'}
            h="44px"
            bg="#FBFAF9"
            border="1px solid #D3D0CB"
            borderRadius="10px"
            placeholder="Hae tilausnumero, asiakas tai tuote"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {!archiveOnly && (
            <Box position="relative" pt="25px">
              <Text position="absolute" top={0} left="1px" color="#65707C" fontSize="10px" fontWeight="900" letterSpacing="0.12em">
                RYHMÄT
              </Text>
              <Flex gap="8px" flexWrap="wrap">
                {(['Kaikki', ...MAIN_ORDER_STAGES, 'Myöhässä'] as string[]).map((name) => {
                  const isLate = name === 'Myöhässä';
                  const count = MAIN_ORDER_STAGES.includes(name)
                    ? phaseCounts[name] || 0
                    : mainFilterCounts[name as keyof typeof mainFilterCounts] || 0;
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
                      border="1px solid"
                      borderColor={isLate && !active ? '#EFC2BD' : '#D6DCE3'}
                      bg={active ? (isLate ? '#B42318' : `linear-gradient(135deg, ${brand.orangeLight}, ${brand.orange})`) : isLate ? '#FFF7F6' : 'linear-gradient(180deg, #fff, #f8fafb)'}
                      color={active ? 'white' : isLate ? '#B42318' : '#303942'}
                      onClick={() => setPhaseFilter(name)}
                      rightIcon={
                        <Box as="span" minW="24px" h="22px" display="inline-grid" placeItems="center" px="7px" borderRadius="999px" bg={active ? 'rgba(255,255,255,.25)' : '#EDF1F4'} color={active ? 'white' : '#3F4851'} fontSize="10px">
                          {count}
                        </Box>
                      }
                    >
                      {isLate ? '⚠ ' : ''}{name}
                    </Button>
                  );
                })}
              </Flex>
            </Box>
          )}
        </Box>

        {!archiveOnly && (
          <Flex justify="flex-end" mt="12px">
            <Button leftIcon={<HailerPlus />} h="40px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} onClick={openNew}>
              Uusi tilaus
            </Button>
          </Flex>
        )}

        {loading ? (
          <Spinner color={brand.orange} mt={4} />
        ) : filteredOrders.length === 0 ? (
          <Text color="subtleText" mt={4}>Ei tilauksia näillä hakuehdoilla.</Text>
        ) : (
          <>
            {/* Desktop table */}
            <Box display={{ base: 'none', md: 'block' }} mt="16px" border="1px solid #DFE4E9" borderRadius="11px" bg="white" overflowX="auto">
              <Table minW="1000px" style={{ tableLayout: 'fixed' }}>
                <Thead>
                  <Tr>
                    <Th w="11%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tilaus</Th>
                    <Th w="9%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Deadline</Th>
                    <Th w="15%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Asiakas</Th>
                    <Th w="21%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tuotteet</Th>
                    <Th w="12%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Status</Th>
                    <Th w="8%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E" isNumeric>Kate</Th>
                    <Th w="24%" fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Seuraava vaihe</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredOrders.map((o) => {
                    const custName = readLink(o.fields?.[OF.asiakas]).name || '\u2013';
                    const phaseName = orderStatusOf(o);
                    const overdue = orderIsLate(o);
                    const colors = phaseColor[phaseName] || { bg: '#EDF1F4', color: '#3F4851' };
                    const act = rowAdvance(o, phaseName);
                    return (
                      <Tr key={o._id} cursor="pointer" _hover={{ bg: '#FFF8F1' }} onClick={() => void hailer.ui.activity.open(o._id, { tab: 'detail' })}>
                        <Td fontWeight="800">{o.name}</Td>
                        <Td>
                          <Text fontWeight="bold">{formatDate(o.fields?.[OF.toimituspiv])}</Text>
                          {overdue && <Text fontSize="10px" fontWeight="800" color="#B42318">MYÖHÄSSÄ</Text>}
                        </Td>
                        <Td>{custName}</Td>
                        <Td fontSize="xs" whiteSpace="normal">
                          {lineSummary[o._id] || '\u2013'}
                        </Td>
                        <Td>
                          <Badge bg={colors.bg} color={colors.color} borderRadius="full" px="9px" py="5px" fontSize="10px" fontWeight="900">
                            {phaseName}
                          </Badge>
                        </Td>
                        <Td isNumeric fontSize="xs" fontWeight={700} color={(() => { const p = Number(readValue(o.fields?.[OF.kateProsentti])); return Number.isFinite(p) && p < 20 ? '#B3261E' : undefined; })()}>
                          {(() => { const p = readValue(o.fields?.[OF.kateProsentti]); return p == null || p === '' ? '\u2013' : `${Number(p).toFixed(0)} %`; })()}
                        </Td>
                        <Td onClick={(e) => e.stopPropagation()}>
                          <VStack spacing="4px" align="stretch">
                            <Button
                              size="sm"
                              w="100%"
                              minH="42px"
                              fontSize="12px"
                              fontWeight="900"
                              borderRadius="10px"
                              border={act.done ? '1px solid #259650' : `1px solid ${brand.orange}`}
                              bg={act.done ? 'linear-gradient(180deg, #35AD65, #259650)' : `linear-gradient(180deg, ${brand.orangeLight}, ${brand.orange})`}
                              color="white"
                              onClick={act.onClick}
                            >
                              {act.label}
                            </Button>
                            {(phaseName === 'Vahvistettu' || phaseName === 'Tuotannossa') && (
                              <Button size="xs" variant="ghost" color="#B3261E" fontWeight={700} onClick={() => setCancelTargetId(o._id)}>
                                Peruuta tilaus
                              </Button>
                            )}
                          </VStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </Box>

            {/* Mobile cards */}
            <VStack display={{ base: 'flex', md: 'none' }} align="stretch" spacing={2} mt={3}>
              {filteredOrders.map((o) => {
                const custName = readLink(o.fields?.[OF.asiakas]).name || '\u2013';
                const phaseName = orderStatusOf(o);
                const overdue = orderIsLate(o);
                const colors = phaseColor[phaseName] || { bg: '#EDF1F4', color: '#3F4851' };
                const act = rowAdvance(o, phaseName);
                return (
                  <Box key={o._id} bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={3} onClick={() => void hailer.ui.activity.open(o._id, { tab: 'detail' })}>
                    <HStack justify="space-between">
                      <Text fontWeight="800">{o.name}</Text>
                      <Badge bg={colors.bg} color={colors.color} borderRadius="full" px="8px" fontSize="10px">
                        {phaseName}
                      </Badge>
                    </HStack>
                    <Text fontSize="xs" color="subtleText" mt={1}>
                      {custName} · Toimitus {formatDate(o.fields?.[OF.toimituspiv])}
                    </Text>
                    <Text fontSize="xs" color="subtleText" noOfLines={1}>
                      {lineSummary[o._id] || '\u2013'}
                    </Text>
                    {overdue && (
                      <Badge colorScheme="red" mt={1}>
                        Myöhässä
                      </Badge>
                    )}
                    <Button
                      mt={2}
                      w="100%"
                      minH="44px"
                      fontSize="12px"
                      fontWeight="900"
                      borderRadius="10px"
                      bg={act.done ? 'linear-gradient(180deg, #35AD65, #259650)' : `linear-gradient(180deg, ${brand.orangeLight}, ${brand.orange})`}
                      color="white"
                      onClick={(e) => {
                        e.stopPropagation();
                        act.onClick();
                      }}
                    >
                      {act.label}
                    </Button>
                  </Box>
                );
              })}
            </VStack>
          </>
        )}

        <ConfirmDialog
          isOpen={!!approveInvoiceTargetId}
          title="Hyväksytäänkö lasku?"
          body="Tilaus siirtyy Laskutettu-vaiheeseen."
          confirmLabel="Hyväksy lasku"
          confirmColorScheme="green"
          isLoading={saving}
          onConfirm={() => approveInvoiceTargetId && void movePhaseDirect(approveInvoiceTargetId, OP.laskutettu, 'Lasku hyväksytty.').then(() => setApproveInvoiceTargetId(null))}
          onCancel={() => setApproveInvoiceTargetId(null)}
        />

        <ConfirmDialog
          isOpen={!!cancelTargetId}
          title="Perutaanko tilaus?"
          body="Tilaus siirtyy Peruttu-tilaan. Tietoja ei poisteta, ja tilaus jää näkyviin Kaikki-suodattimella."
          confirmLabel="Peruuta tilaus"
          confirmColorScheme="red"
          isLoading={saving}
          onConfirm={() => cancelTargetId && void movePhaseDirect(cancelTargetId, OP.peruttu, 'Tilaus peruttu.').then(() => setCancelTargetId(null))}
          onCancel={() => setCancelTargetId(null)}
        />
      </VStack>
    );
  }

  // ---- FORM VIEW ----
  if (view === 'form' && form) {
    return (
      <VStack align="stretch" spacing={5} maxW="900px">
        <HStack justify="space-between">
          <Text fontSize="xl" fontWeight="bold" color={brand.charcoal}>
            {form._id ? 'Muokkaa tilausta' : 'Uusi tilaus'}
          </Text>
          <Button variant="ghost" onClick={() => (dirty ? setConfirmClose(true) : setView('list'))}>
            Peruuta
          </Button>
        </HStack>

        {selected && selected.currentPhase !== OP.vahvistettu && (
          <Box bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="10px" p={3}>
            <Text fontSize="sm" color="orange.700">
              §42 — Tuotanto näkee varoituksen, kun tilausta muokataan tuotannon alkamisen jälkeen.
            </Text>
          </Box>
        )}

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
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          asiakasId: e.target.value,
                          // Snapshot the customer's billing details onto the
                          // order — only for a brand-new order, never
                          // overwriting a manually-edited value.
                          ...(!f._id && c
                            ? {
                                ytunnus: String(c.fields?.[AF.ytunnus] ?? f.ytunnus),
                                verkkolaskuosoite: String(c.fields?.[AF.verkkolaskuosoite] ?? f.verkkolaskuosoite),
                                valittajatunnus: String(c.fields?.[AF.valittajatunnus] ?? f.valittajatunnus),
                                laskutusosoite: String(c.fields?.[AF.laskutusosoite] ?? f.laskutusosoite),
                                maksuehtoPv: String(c.fields?.[AF.maksuehtoPv] ?? f.maksuehtoPv),
                              }
                            : {}),
                        }
                      : f,
                  );
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
                const created = await hailer.ui.activity.create(WF.asiakkaat, {
                  fields: { '6ab22e4f991a8feac7574d65': 'Prospekti', '6a9fdfb32921da91c45bbd79': 21 },
                });
                if (created) {
                  const fresh = await listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c');
                  setCustomers(fresh);
                  setForm((f) => (f ? { ...f, asiakasId: created._id } : f));
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
              Aikataulu ja toimitus
            </Text>
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Tilauspäivä</FormLabel>
                <Input h="40px" type="date" value={form.tilauspaiva} onChange={(e) => { setForm((f) => (f ? { ...f, tilauspaiva: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Toimituspäivä</FormLabel>
                <Input h="40px" type="date" value={form.toimituspiv} onChange={(e) => { setForm((f) => (f ? { ...f, toimituspiv: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Tuotannon deadline</FormLabel>
                <Input h="40px" type="date" value={form.tuotannonDeadline} onChange={(e) => { setForm((f) => (f ? { ...f, tuotannonDeadline: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Toimitustapa</FormLabel>
                <Select h="40px" value={form.toimitustapa} onChange={(e) => { setForm((f) => (f ? { ...f, toimitustapa: e.target.value } : f)); setDirty(true); }}>
                  <option value="Nouto">Nouto</option>
                  <option value="Posti">Posti</option>
                  <option value="PostNord">PostNord</option>
                  <option value="Toimitetaan">Toimitetaan</option>
                </Select>
              </FormControl>
              <Box borderTop={`1px solid ${brand.border}`} pt={3}>
                <Text fontSize="xs" fontWeight="bold" color="subtleText" mb={2}>
                  TOIMITUSOSOITE
                </Text>
                <SimpleGrid columns={2} gap={2} mb={2}>
                  <FormControl>
                    <FormLabel fontSize="xs">Vastaanottaja</FormLabel>
                    <Input h="36px" value={form.toimVastaanottaja} onChange={(e) => { setForm((f) => (f ? { ...f, toimVastaanottaja: e.target.value } : f)); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Katuosoite</FormLabel>
                    <Input h="36px" value={form.toimKatuosoite} onChange={(e) => { setForm((f) => (f ? { ...f, toimKatuosoite: e.target.value } : f)); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Postinumero</FormLabel>
                    <Input h="36px" value={form.toimPostinumero} onChange={(e) => { setForm((f) => (f ? { ...f, toimPostinumero: e.target.value } : f)); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Kaupunki</FormLabel>
                    <Input h="36px" value={form.toimKaupunki} onChange={(e) => { setForm((f) => (f ? { ...f, toimKaupunki: e.target.value } : f)); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Maa</FormLabel>
                    <Input h="36px" value={form.toimMaa} onChange={(e) => { setForm((f) => (f ? { ...f, toimMaa: e.target.value } : f)); setDirty(true); }} />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Lisätiedot</FormLabel>
                    <Input h="36px" value={form.toimLisatiedot} onChange={(e) => { setForm((f) => (f ? { ...f, toimLisatiedot: e.target.value } : f)); setDirty(true); }} />
                  </FormControl>
                </SimpleGrid>
                <FormControl>
                  <FormLabel fontSize="xs">Muut toimitusosoitteet (jos useampia)</FormLabel>
                  <Textarea rows={2} value={form.toimitusosoite} onChange={(e) => { setForm((f) => (f ? { ...f, toimitusosoite: e.target.value } : f)); setDirty(true); }} />
                </FormControl>
              </Box>
            </VStack>
          </Box>

          <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
            <Text fontWeight="bold" mb={3}>
              Laskutus ja verotus
            </Text>
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Y-tunnus</FormLabel>
                <Input h="40px" value={form.ytunnus} onChange={(e) => { setForm((f) => (f ? { ...f, ytunnus: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Asiakkaan maa</FormLabel>
                <Input h="40px" value={form.asiakkaanMaa} onChange={(e) => { setForm((f) => (f ? { ...f, asiakkaanMaa: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Laskutusosoite</FormLabel>
                <Textarea rows={2} value={form.laskutusosoite} onChange={(e) => { setForm((f) => (f ? { ...f, laskutusosoite: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Verkkolaskuosoite</FormLabel>
                <Input h="40px" value={form.verkkolaskuosoite} onChange={(e) => { setForm((f) => (f ? { ...f, verkkolaskuosoite: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Välittäjätunnus</FormLabel>
                <Input h="40px" value={form.valittajatunnus} onChange={(e) => { setForm((f) => (f ? { ...f, valittajatunnus: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Asiakkaan viite / PO</FormLabel>
                <Input h="40px" value={form.asiakkaanViitePo} onChange={(e) => { setForm((f) => (f ? { ...f, asiakkaanViitePo: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Maksuehto (pv)</FormLabel>
                <NumberInput min={0} value={form.maksuehtoPv} onChange={(v) => { setForm((f) => (f ? { ...f, maksuehtoPv: v } : f)); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">ALV %</FormLabel>
                <Select h="40px" value={form.alv} onChange={(e) => { setForm((f) => (f ? { ...f, alv: e.target.value } : f)); setDirty(true); }}>
                  <option value="25.5">25,5 % (kotimaa)</option>
                  <option value="0">0 % (vienti)</option>
                </Select>
              </FormControl>
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
            {form.lines.length === 0 && <Text color="subtleText" fontSize="sm">Ei tuoteriveja.</Text>}
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
              Muut maksut
            </Text>
            <VStack align="stretch" spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Toimitushinta (€)</FormLabel>
                <NumberInput min={0} value={form.toimitushinta} onChange={(v) => { setForm((f) => (f ? { ...f, toimitushinta: v } : f)); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Aloitusmaksu (€)</FormLabel>
                <NumberInput min={0} value={form.aloitusmaksu} onChange={(v) => { setForm((f) => (f ? { ...f, aloitusmaksu: v } : f)); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Laskutuslisä (€)</FormLabel>
                <NumberInput min={0} value={form.laskutuslisa} onChange={(v) => { setForm((f) => (f ? { ...f, laskutuslisa: v } : f)); setDirty(true); }}>
                  <NumberInputField h="40px" />
                </NumberInput>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Sisäiset muistiinpanot</FormLabel>
                <Textarea rows={2} value={form.sisisetMuistiinpanot} onChange={(e) => { setForm((f) => (f ? { ...f, sisisetMuistiinpanot: e.target.value } : f)); setDirty(true); }} />
              </FormControl>
            </VStack>
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
        </SimpleGrid>

        <HStack justify="space-between" spacing={3} pb={6} flexWrap="wrap">
          <HStack spacing={3}>
            {form._id && selected && selected.currentPhase !== OP.laskutettu && (
              <>
                <Button variant="outline" h="40px" onClick={handleCopyAsNew} isLoading={saving}>
                  Kopioi uudeksi tilaukseksi
                </Button>
                <Button variant="outline" h="40px" colorScheme="red" onClick={() => setConfirmDelete(true)} isDisabled={saving}>
                  Poista tilaus
                </Button>
              </>
            )}
          </HStack>
          <HStack spacing={3}>
            <Button variant="ghost" h="40px" onClick={() => (dirty ? setConfirmClose(true) : setView('list'))} isDisabled={saving}>
              Sulje / Takaisin
            </Button>
            <Button h="40px" bg={brand.orange} color={brand.charcoal} _hover={{ bg: brand.orangeAccent, color: 'white' }} onClick={handleSaveAndClose} isLoading={saving}>
              Tallenna
            </Button>
          </HStack>
        </HStack>

        {selected && (
          <ConfirmDialog
            isOpen={confirmDelete}
            title="Poistetaanko tilaus?"
            body={`Haluatko varmasti poistaa tilauksen "${selected.name}"? Toimintoa ei voi perua.`}
            confirmLabel="Poista tilaus"
            confirmColorScheme="red"
            isLoading={saving}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}

        <ConfirmDialog
          isOpen={confirmClose}
          title="Hylätäänkö tallentamattomat muutokset?"
          body="Sinulla on tallentamattomia muutoksia."
          confirmLabel="Hylkää muutokset"
          confirmColorScheme="red"
          onConfirm={() => {
            setConfirmClose(false);
            setView('list');
          }}
          onCancel={() => setConfirmClose(false)}
        />
      </VStack>
    );
  }

  // ---- DETAIL VIEW ----
  if (view === 'detail' && selected) {
    const phaseName = orderStatusOf(selected);
    const custName = readLink(selected.fields?.[OF.asiakas]).name || '\u2013';

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

        <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
          <Box bg={brand.white} borderRadius="10px" border={`1px solid ${brand.border}`} p={3}>
            <Text fontSize="xs" color="subtleText">
              Toimituspäivä
            </Text>
            <Text fontWeight="bold">{formatDate(selected.fields?.[OF.toimituspiv])}</Text>
          </Box>
          <Box bg={brand.white} borderRadius="10px" border={`1px solid ${brand.border}`} p={3}>
            <Text fontSize="xs" color="subtleText">
              Tuotannon deadline
            </Text>
            <Text fontWeight="bold">{formatDate(selected.fields?.[OF.tuotannonDeadline])}</Text>
          </Box>
          <Box bg={brand.white} borderRadius="10px" border={`1px solid ${brand.border}`} p={3}>
            <Text fontSize="xs" color="subtleText">
              Toimitustapa
            </Text>
            <Text fontWeight="bold">{String(selected.fields?.[OF.toimitustapa] ?? '\u2013')}</Text>
          </Box>
          <Box bg={brand.white} borderRadius="10px" border={`1px solid ${brand.border}`} p={3}>
            <Text fontSize="xs" color="subtleText">
              Yhteensä sis. ALV
            </Text>
            <Text fontWeight="bold">{formatEUR(selected.fields?.[OF.loppusumma] ?? selected.fields?.[OF.myyntiYhteensa])}</Text>
          </Box>
        </SimpleGrid>

        {String(selected.fields?.[OF.muutettuTuotannonJalkeen] ?? '') === 'Kyllä' && (
          <Box bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="10px" p={3}>
            <Text fontSize="sm" color="orange.700" fontWeight="bold">
              ⚠ Tilausta on muokattu tuotannon alkamisen jälkeen — tarkista tuotantotiedot.
            </Text>
          </Box>
        )}

        {selected.currentPhase === OP.tuotannossa ? (
          // ---- Dedicated inline editable work order (matches the
          // reference's workorder-* markup — never shows prices) ----
          <Box bg="linear-gradient(110deg,#24292D,#171A1D)" color="white" borderRadius="15px" overflow="hidden" borderBottom={`6px solid ${brand.orange}`} boxShadow="0 10px 30px rgba(24,32,40,.06)">
            <Flex justify="space-between" align="center" gap={5} p="20px 22px" borderBottom={`6px solid ${brand.orange}`}>
              <Box>
                <Text fontSize="22px" fontWeight="950" letterSpacing="-0.04em" mb={1}>
                  COPY<Text as="span" color={brand.orange}>-SET</Text>
                </Text>
                <Text fontSize="10px" fontWeight="950" letterSpacing="0.16em" color="#EF9A49">
                  TYÖMÄÄRÄYS
                </Text>
                <Text fontSize="lg" fontWeight="bold" mt={1}>
                  {selected.name}
                </Text>
                <Text fontSize="xs" color="#CBD1D5">
                  {custName} · kaikki tuotannon tiedot ilman hintoja
                </Text>
              </Box>
              <HStack>
                <Button size="sm" variant="outline" borderColor="#697078" color="white" _hover={{ bg: '#30363B' }} onClick={() => openPreview('Työkortti')}>
                  Tulosta työkortti
                </Button>
                <Button size="sm" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} onClick={saveWorkOrder} isLoading={woSaving}>
                  ✓ Tallenna muutokset
                </Button>
              </HStack>
            </Flex>
            <Box bg="#F6F8F9" p="16px 18px" borderBottom={`1px solid ${brand.border}`}>
              <SimpleGrid columns={{ base: 1, md: 4 }} gap="10px">
                <FormControl>
                  <FormLabel fontSize="10px" color="#56616B" fontWeight="900" textTransform="uppercase">Deadline</FormLabel>
                  <Input h="40px" bg="white" color="#202428" type="date" value={woDeadline} onChange={(e) => setWoDeadline(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="10px" color="#56616B" fontWeight="900" textTransform="uppercase">Toimitustapa</FormLabel>
                  <Select h="40px" bg="white" color="#202428" value={woToimitustapa} onChange={(e) => setWoToimitustapa(e.target.value)}>
                    <option value="Posti">Posti</option>
                    <option value="Lähetti">Lähetti</option>
                    <option value="Nouto">Nouto</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="10px" color="#56616B" fontWeight="900" textTransform="uppercase">Tuotanto</FormLabel>
                  <Select h="40px" bg="white" color="#202428" value={woTuotanto} onChange={(e) => setWoTuotanto(e.target.value)}>
                    <option value="Copy-Set">Copy-Set</option>
                    <option value="Alihankkija">Alihankkija</option>
                  </Select>
                </FormControl>
              </SimpleGrid>
            </Box>
            <Box p="4px 18px 18px" bg="white" color={brand.charcoal}>
              {selectedLines.map(({ line, extras }, idx) => (
                <Box key={line._id} border={`1px solid ${brand.border}`} borderRadius="11px" mt="14px" overflow="hidden">
                  <Flex justify="space-between" align="center" p="11px 13px" bg="#F1F3F5">
                    <Text fontSize="9px" color="#6D7780" fontWeight="950" textTransform="uppercase" letterSpacing="0.09em">
                      Tuote {idx + 1}
                    </Text>
                    <Text fontWeight="bold">{readLink(line.fields?.[ORF.tuote]).name}</Text>
                  </Flex>
                  <SimpleGrid columns={{ base: 1, md: 3 }} gap="11px" p="13px">
                    <FormControl>
                      <FormLabel fontSize="10px">Määrä (kpl)</FormLabel>
                      <Input
                        h="40px"
                        type="number"
                        value={woLines[line._id]?.maara ?? ''}
                        onChange={(e) => setWoLines((prev) => ({ ...prev, [line._id]: { ...prev[line._id], maara: e.target.value } }))}
                      />
                    </FormControl>
                    <FormControl gridColumn={{ md: 'span 2' }}>
                      <FormLabel fontSize="10px">Työohje / aineisto</FormLabel>
                      <Textarea
                        rows={2}
                        value={woLines[line._id]?.spesifikaatiot ?? ''}
                        onChange={(e) => setWoLines((prev) => ({ ...prev, [line._id]: { ...prev[line._id], spesifikaatiot: e.target.value } }))}
                      />
                    </FormControl>
                  </SimpleGrid>
                  {extras.filter((e) => e.fields?.[LF.nimi]).length > 0 && (
                    <Box px="13px" pb="12px">
                      <Text fontSize="9px" fontWeight="950" letterSpacing="0.09em" color="#8A5B31" mb={1}>
                        LISÄTYÖT / TYÖVAIHEET
                      </Text>
                      <Flex gap="6px" flexWrap="wrap">
                        {extras
                          .filter((e) => e.fields?.[LF.nimi])
                          .map((e) => (
                            <Box key={e._id} border="1px solid #F2C79F" borderRadius="99px" bg="#FFFAF5" color="#874708" fontSize="10px" fontWeight="800" px="9px" py="6px">
                              □ {String(e.fields?.[LF.nimi])}
                            </Box>
                          ))}
                      </Flex>
                    </Box>
                  )}
                </Box>
              ))}
              <FormControl mt="14px">
                <FormLabel fontSize="10px">Tuotannon yhteiset ohjeet</FormLabel>
                <Textarea rows={2} placeholder="Aineisto, pakkaus, toimitus tai muu tuotannon huomio" value={woNotes} onChange={(e) => setWoNotes(e.target.value)} />
              </FormControl>
            </Box>
          </Box>
        ) : (
          <Box bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={5}>
            <Text fontWeight="bold" mb={3}>
              Tuotteet
            </Text>
            {selectedLines.length === 0 && <Text color="subtleText" fontSize="sm">Ei tuoteriveja.</Text>}
            {selectedLines.map(({ line, extras }) => (
              <Box key={line._id} borderBottom={`1px solid ${brand.border}`} py={2}>
                <HStack justify="space-between">
                  <Text fontWeight="medium">
                    {readLink(line.fields?.[ORF.tuote]).name} × {String(line.fields?.[ORF.maara] ?? '')}
                  </Text>
                  <Text fontWeight="bold">{formatEUR(line.fields?.[ORF.rivinHinta])}</Text>
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
          </Box>
        )}

        {/* Documents row — exactly which docs() exposes per stage in the reference */}
        {(selected.currentPhase === OP.vahvistettu) && (
          <HStack justify="flex-end">
            <Button variant="outline" h="40px" leftIcon={<HailerPrint />} onClick={() => openPreview('Tilausvahvistus')}>
              Tilausvahvistus
            </Button>
          </HStack>
        )}
        {(selected.currentPhase === OP.valmis) && (
          <HStack justify="flex-end" flexWrap="wrap">
            <Button variant="outline" h="40px" leftIcon={<HailerPrint />} onClick={() => openPreview('Lähete')}>
              Lähete <Text as="span" fontSize="10px" color="subtleText" ml={1}>ei hintoja</Text>
            </Button>
            <Button variant="outline" h="40px" leftIcon={<HailerPrint />} onClick={() => openPreview('Lähetyslappu')}>
              Lähetyslappu
            </Button>
            <Button variant="outline" h="40px" leftIcon={<HailerPrint />} onClick={() => openPreview('Käteiskuitti')}>
              Käteiskuitti
            </Button>
          </HStack>
        )}
        {(selected.currentPhase === OP.laskutusvalmis || selected.currentPhase === OP.laskutettu) && (
          <HStack justify="flex-end">
            <Button variant="outline" h="40px" leftIcon={<HailerPrint />} onClick={() => openPreview('Käteiskuitti')}>
              Käteiskuitti
            </Button>
          </HStack>
        )}

        {/* Footer action bar — left: Kopioi/Muokkaa/Poista (hidden once
            Laskutettu, and NOT shown during Tuotannossa which has its own
            "Muokkaa koko tilausta" secondary instead), right: the single
            primary next-step button exactly as action(o) in the reference. */}
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={3} pt={2} borderTop={`1px solid ${brand.border}`}>
          <HStack spacing={3} flexWrap="wrap">
            {selected.currentPhase === OP.tuotannossa && (
              <Button variant="outline" h="40px" onClick={() => void openEdit()}>
                Muokkaa koko tilausta
              </Button>
            )}
            {selected.currentPhase !== OP.laskutettu && selected.currentPhase !== OP.tuotannossa && (
              <>
                <Button variant="outline" h="40px" onClick={handleCopyAsNew} isLoading={saving}>
                  Kopioi uudeksi tilaukseksi
                </Button>
                <Button variant="outline" h="40px" onClick={() => void openEdit()}>
                  Muokkaa
                </Button>
                <Button variant="outline" h="40px" colorScheme="red" onClick={() => setConfirmDelete(true)}>
                  Poista tilaus
                </Button>
              </>
            )}
          </HStack>

          <HStack>
            {selected.currentPhase === OP.laskutusvalmis && (
              <Button h="42px" bg={brand.green} color="white" _hover={{ bg: brand.greenHover }} onClick={() => setConfirmApproveInvoice(true)} isLoading={saving}>
                ✓ Hyväksy lasku
              </Button>
            )}
            {(selected.currentPhase === OP.vahvistettu) && (
              <Button h="42px" minW="230px" bg={`linear-gradient(180deg, ${brand.orangeLight}, ${brand.orange})`} color="white" _hover={{ bg: brand.orangeAccent }} onClick={() => movePhase(OP.tuotannossa, 'Tuotanto aloitettu.')} isLoading={saving}>
                Aloita tuotanto →
              </Button>
            )}
            {(selected.currentPhase === OP.valmis) && (
              <Button h="42px" minW="230px" bg={`linear-gradient(180deg, ${brand.orangeLight}, ${brand.orange})`} color="white" _hover={{ bg: brand.orangeAccent }} onClick={handleMoveToInvoiceReview} isLoading={saving}>
                Siirrä laskun tarkastukseen →
              </Button>
            )}
          </HStack>
        </Flex>

        <ConfirmDialog
          isOpen={confirmDelete}
          title="Poistetaanko tilaus?"
          body={`Haluatko varmasti poistaa tilauksen "${selected.name}"? Toimintoa ei voi perua.`}
          confirmLabel="Poista tilaus"
          confirmColorScheme="red"
          isLoading={saving}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
        <ConfirmDialog
          isOpen={confirmProductionDone}
          title="Kuitataanko tuotanto valmiiksi?"
          body="Tilaus siirtyy Valmis-vaiheeseen ja lähetysasiakirjat tulevat saatavilla."
          confirmLabel="Kuittaa valmiiksi"
          confirmColorScheme="green"
          isLoading={saving}
          onConfirm={() => {
            setConfirmProductionDone(false);
            void movePhase(OP.valmis, 'Tuotanto kuitattu valmiiksi.');
          }}
          onCancel={() => setConfirmProductionDone(false)}
        />
        <ConfirmDialog
          isOpen={confirmApproveInvoice}
          title="Hyväksytäänkö lasku?"
          body="Tilaus siirtyy Laskutettu-vaiheeseen. Tarkista rivit ja summat ennen hyväksyntää."
          confirmLabel="Hyväksy lasku"
          confirmColorScheme="green"
          isLoading={saving}
          onConfirm={() => {
            setConfirmApproveInvoice(false);
            void movePhase(OP.laskutettu, 'Lasku hyväksytty.');
          }}
          onCancel={() => setConfirmApproveInvoice(false)}
        />
      </VStack>
    );
  }

  return null;
}
