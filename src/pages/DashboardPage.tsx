import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Grid, HStack, Text, SimpleGrid, Spinner, Input, Button, Table, Thead, Tbody, Tr, Th, Td } from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import {
  WF,
  TILAUKSET_FIELDS as OF,
  TILAUKSET_PHASES as OP,
  TILAUSRIVIT_FIELDS as ORF,
  TARJOUKSET_FIELDS as TF,
  TARJOUKSET_PHASES as TP,
} from '../hailer/workspace-bindings';
import { listAllWorkflow, listAllPhase } from '../lib/hailerData';
import { formatEUR, formatNumber, readLink, readValue } from '../lib/format';

type Preset = 'day' | 'week' | 'month' | 'year' | 'custom';

interface Props {
  hailer: HailerApi;
}

// Matches the live reference's dashboard exactly: hero + period pills,
// 5-card KPI grid (first card "featured"/dark), and two bar-chart insight
// cards (by product group, by customer).
function startOfPeriod(preset: Preset, customFrom: string): number {
  const now = new Date();
  if (preset === 'day') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (preset === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 6);
    return start.getTime();
  }
  if (preset === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (preset === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
  return customFrom ? new Date(customFrom).getTime() : 0;
}

export default function DashboardPage({ hailer }: Props) {
  const [orders, setOrders] = useState<Activity[]>([]);
  const [lines, setLines] = useState<Activity[]>([]);
  const [products, setProducts] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<Activity[]>([]);
  const [offers, setOffers] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, l, p, g, of] = await Promise.all([
        listAllWorkflow(hailer, WF.tilaukset, Object.values(OP)),
        listAllPhase(hailer, WF.tilausrivit, '6a9fde6e0429f4bd513ae3b4'),
        listAllPhase(hailer, WF.tuotteet, '6a9fde6e0429f4bd513ae38f'),
        listAllPhase(hailer, WF.tuoteryhmat, '6a9fde6e0429f4bd513ae389'),
        listAllWorkflow(hailer, WF.tarjoukset, Object.values(TP)),
      ]);
      setOrders(o);
      setLines(l);
      setProducts(p);
      setGroups(g);
      setOffers(of);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  useEffect(() => {
    void load();
  }, [load]);

  const from = startOfPeriod(preset, customFrom);
  const to = preset === 'custom' && customTo ? new Date(customTo).getTime() + 86_400_000 : Date.now() + 86_400_000;

  const orderDate = useCallback((o: Activity): number => {
    const raw = o.fields?.[OF.tilauspaiva];
    const ms = typeof raw === 'number' && raw < 10_000_000_000 ? raw * 1000 : Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : Number(o.created);
  }, []);

  const ordersInRange = useMemo(() => orders.filter((o) => orderDate(o) >= from && orderDate(o) < to), [orders, from, to, orderDate]);

  const net = useCallback((o: Activity) => Number(o.fields?.[OF.nettoYhteensa] ?? o.fields?.[OF.myyntiYhteensa]) || 0, []);

  const sales = useMemo(() => ordersInRange.reduce((s, o) => s + net(o), 0), [ordersInRange, net]);
  const average = ordersInRange.length ? sales / ordersInRange.length : 0;
  const inProduction = ordersInRange.filter((o) => o.currentPhase === OP.tuotannossa).length;
  const ready = ordersInRange.filter((o) => o.currentPhase === OP.valmis || o.currentPhase === OP.laskutusvalmis).length;
  const invoiced = ordersInRange.filter((o) => o.currentPhase === OP.laskutettu).length;

  const byProduct = useMemo(() => {
    const productGroup: Record<string, string> = {};
    for (const p of products) productGroup[p._id] = readLink(p.fields?.['6a9fdefae70f672af842184b']).id || '';
    const groupName: Record<string, string> = {};
    for (const g of groups) groupName[g._id] = g.name;
    const orderIds = new Set(ordersInRange.map((o) => o._id));
    const map = new Map<string, number>();
    for (const l of lines) {
      const orderId = readLink(l.fields?.[ORF.tilaus]).id;
      if (!orderId || !orderIds.has(orderId)) continue;
      const productId = readLink(l.fields?.[ORF.tuote]).id;
      const groupId = productId ? productGroup[productId] : '';
      const name = groupName[groupId] || 'Muu';
      map.set(name, (map.get(name) || 0) + (Number(l.fields?.[ORF.rivinHinta]) || 0));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [lines, products, groups, ordersInRange]);

  const byCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of ordersInRange) {
      const name = readLink(o.fields?.[OF.asiakas]).name || 'Tuntematon asiakas';
      map.set(name, (map.get(name) || 0) + net(o));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [ordersInRange, net]);

  // ---- Kate (margin) — reads the native Kate/Kate% function fields directly, no re-derivation. ----
  const kate = useCallback((o: Activity) => Number(readValue(o.fields?.[OF.kate])) || 0, []);
  const katePct = useCallback((o: Activity) => {
    const v = readValue(o.fields?.[OF.kateProsentti]);
    return v == null || v === '' ? null : Number(v);
  }, []);
  const marginSum = useMemo(() => ordersInRange.reduce((s, o) => s + kate(o), 0), [ordersInRange, kate]);
  const marginPctOfSales = sales ? (marginSum / sales) * 100 : null;

  // ---- Offer hit-rate — matches the reference's hitRate(): won = Hyväksytty
  // (accepted, whether or not an order was created), lost = Hylätty. Drafts
  // and open (Lähetetty/Valmis lähetettäväksi) offers are not yet decided. ----
  const offerDate = useCallback((o: Activity): number => {
    const raw = o.fields?.[TF.tarjouspaiva];
    const ms = typeof raw === 'number' && raw < 10_000_000_000 ? raw * 1000 : Number(raw);
    return Number.isFinite(ms) && ms > 0 ? ms : Number(o.created);
  }, []);
  const offersInRange = useMemo(() => offers.filter((o) => offerDate(o) >= from && offerDate(o) < to), [offers, from, to, offerDate]);
  const offerNet = useCallback((o: Activity) => Number(readValue(o.fields?.[TF.nettoYhteensa])) || 0, []);
  const hitRate = useMemo(() => {
    const won = offersInRange.filter((o) => o.currentPhase === TP.hyvaksytty);
    const lost = offersInRange.filter((o) => o.currentPhase === TP.hylatty);
    const open = offersInRange.filter((o) => o.currentPhase === TP.lahetetty || o.currentPhase === TP.valmisLahetettavaksi);
    const wonValue = won.reduce((s, o) => s + offerNet(o), 0);
    const lostValue = lost.reduce((s, o) => s + offerNet(o), 0);
    const decided = won.length + lost.length;
    return {
      won: won.length,
      lost: lost.length,
      open: open.length,
      openValue: open.reduce((s, o) => s + offerNet(o), 0),
      wonValue,
      pct: decided ? (won.length / decided) * 100 : null,
      valuePct: wonValue + lostValue ? (wonValue / (wonValue + lostValue)) * 100 : null,
    };
  }, [offersInRange, offerNet]);

  const marginByCustomer = useMemo(() => {
    const map = new Map<string, { name: string; net: number; margin: number; jobs: number }>();
    for (const o of ordersInRange) {
      const name = readLink(o.fields?.[OF.asiakas]).name || 'Tuntematon asiakas';
      const row = map.get(name) || { name, net: 0, margin: 0, jobs: 0 };
      row.net += net(o);
      row.margin += kate(o);
      row.jobs += 1;
      map.set(name, row);
    }
    return [...map.values()].sort((a, b) => b.margin - a.margin).slice(0, 10);
  }, [ordersInRange, net, kate]);

  const marginByJob = useMemo(() => {
    return [...ordersInRange]
      .map((o) => ({ o, net: net(o), margin: kate(o), pct: katePct(o) }))
      .sort((a, b) => (b.o.name || '').localeCompare(a.o.name || ''))
      .slice(0, 15);
  }, [ordersInRange, net, kate, katePct]);

  function barRows(data: [string, number][]) {
    if (data.length === 0)
      return (
        <Box p="30px" textAlign="center" color="#6E7882">
          Ei myyntiä valitulla ajanjaksolla.
        </Box>
      );
    const max = Math.max(1, ...data.map((x) => x[1]));
    return data.slice(0, 8).map(([label, value], i) => (
      <Grid key={label} templateColumns="25px minmax(115px,1.1fr) minmax(120px,2.2fr) auto" alignItems="center" gap="9px" py="9px" borderTop={i === 0 ? 'none' : '1px solid #EDF0F2'} fontSize="11px">
        <Box display="grid" placeItems="center" w="23px" h="23px" borderRadius="7px" bg="#F1F3F5" color="#68737D" fontSize="9px" fontWeight="900">
          {i + 1}
        </Box>
        <Text noOfLines={1}>{label}</Text>
        <Box h="9px" overflow="hidden" borderRadius="99px" bg="#EDF1F4">
          <Box h="100%" borderRadius="99px" bg="linear-gradient(90deg, #F58A24, #FFAD62)" w={`${Math.max(3, (value / max) * 100)}%`} />
        </Box>
        <Text as="strong" color="#29343D" whiteSpace="nowrap">
          {formatEUR(value)}
        </Text>
      </Grid>
    ));
  }

  const periods: [Preset, string][] = [
    ['day', 'Päivä'],
    ['week', 'Viikko'],
    ['month', 'Kuukausi'],
    ['year', 'Vuosi'],
    ['custom', 'Oma väli'],
  ];

  if (loading) return <Spinner color={brand.orange} />;

  return (
    <Box display="grid" gap="16px">
      <HStack
        justify="space-between"
        align="center"
        gap="20px"
        p="22px 24px"
        border={`1px solid ${brand.border}`}
        borderRadius="16px"
        bg="linear-gradient(135deg, #fff 0%, #fafbfc 68%, #fff4e9 100%)"
        boxShadow="0 8px 28px rgba(28,35,43,.06)"
        flexWrap="wrap"
      >
        <Box>
          <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
            LIIKETOIMINNAN TILANNE
          </Text>
          <Text as="h2" m="3px 0 5px" color="#242B31" fontSize="25px" lineHeight="1.15">
            Dashboard
          </Text>
          <Text m={0} color="#65707C" fontSize="13px">
            Myynti, tuotanto, asiakkaat ja tuoteryhmät valitulla ajanjaksolla.
          </Text>
        </Box>
        <HStack flexWrap="wrap" justify="flex-end" gap="7px">
          {periods.map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              h="38px"
              bg={preset === key ? brand.orange : 'white'}
              color={preset === key ? 'white' : brand.charcoal}
              border={`1px solid ${preset === key ? brand.orange : brand.border}`}
              _hover={{ bg: preset === key ? brand.orangeAccent : '#f8fafb' }}
              onClick={() => setPreset(key)}
            >
              {label}
            </Button>
          ))}
        </HStack>
      </HStack>

      {preset === 'custom' && (
        <HStack align="flex-end" gap="10px" p="14px 16px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" flexWrap="wrap">
          <Box minW="190px">
            <Text color="#66717B" fontSize="10px" fontWeight="850" textTransform="uppercase" mb="5px">
              Alkaen
            </Text>
            <Input h="40px" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </Box>
          <Box minW="190px">
            <Text color="#66717B" fontSize="10px" fontWeight="850" textTransform="uppercase" mb="5px">
              Saakka
            </Text>
            <Input h="40px" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </Box>
        </HStack>
      )}

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: '1.35fr repeat(4, 1fr)' }} gap="12px">
        <Box minH="122px" p="18px" borderRadius="14px" bg="linear-gradient(145deg, #3B3B3B, #292929)" color="white" gridColumn={{ base: '1/-1', lg: 'auto' }}>
          <Text color="#F1CDA9" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Myynti alv 0
          </Text>
          <Text m="12px 0 7px" color="white" fontSize="29px" fontWeight="bold">
            {formatEUR(sales)}
          </Text>
          <Text color="#D9DDE0" fontSize="sm">
            {ordersInRange.length} tilausta valitulla jaksolla
          </Text>
        </Box>
        <Box minH="122px" p="18px" border="1px solid #DCE2E8" borderRadius="14px" bg="white" boxShadow="0 6px 20px rgba(28,35,43,.05)">
          <Text color="#68737E" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Keskimääräinen tilaus
          </Text>
          <Text m="12px 0 7px" color="#27313A" fontSize="24px" fontWeight="bold">
            {formatEUR(average)}
          </Text>
          <Text color="#7A858F" fontSize="sm">
            alv 0 %
          </Text>
        </Box>
        <Box minH="122px" p="18px" border="1px solid #DCE2E8" borderRadius="14px" bg="white" boxShadow="0 6px 20px rgba(28,35,43,.05)">
          <Text color="#68737E" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Tuotannossa
          </Text>
          <Text m="12px 0 7px" color="#27313A" fontSize="24px" fontWeight="bold">
            {inProduction}
          </Text>
          <Text color="#7A858F" fontSize="sm">
            aktiivista työtä
          </Text>
        </Box>
        <Box minH="122px" p="18px" border="1px solid #DCE2E8" borderRadius="14px" bg="white" boxShadow="0 6px 20px rgba(28,35,43,.05)">
          <Text color="#68737E" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Valmiina
          </Text>
          <Text m="12px 0 7px" color="#27313A" fontSize="24px" fontWeight="bold">
            {ready}
          </Text>
          <Text color="#7A858F" fontSize="sm">
            toimitukseen tai laskutukseen
          </Text>
        </Box>
        <Box minH="122px" p="18px" border="1px solid #DCE2E8" borderRadius="14px" bg="white" boxShadow="0 6px 20px rgba(28,35,43,.05)">
          <Text color="#68737E" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Laskutettu
          </Text>
          <Text m="12px 0 7px" color="#27313A" fontSize="24px" fontWeight="bold">
            {invoiced}
          </Text>
          <Text color="#7A858F" fontSize="sm">
            tilausta
          </Text>
        </Box>
        <Box minH="122px" p="18px" border="1px solid #DCE2E8" borderRadius="14px" bg="white" boxShadow="0 6px 20px rgba(28,35,43,.05)">
          <Text color="#68737E" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Kate
          </Text>
          <Text m="12px 0 7px" color="#27313A" fontSize="24px" fontWeight="bold">
            {formatEUR(marginSum)}
          </Text>
          <Text color="#7A858F" fontSize="sm">
            {marginPctOfSales == null ? '\u2013' : `${formatNumber(marginPctOfSales, 1)} % myynnistä`}
          </Text>
        </Box>
        <Box minH="122px" p="18px" border="1px solid #DCE2E8" borderRadius="14px" bg="white" boxShadow="0 6px 20px rgba(28,35,43,.05)">
          <Text color="#68737E" fontSize="10px" fontWeight="900" textTransform="uppercase" letterSpacing="0.08em">
            Tarjousten voitto-%
          </Text>
          <Text m="12px 0 7px" color="#27313A" fontSize="24px" fontWeight="bold">
            {hitRate.pct == null ? '\u2013' : `${formatNumber(hitRate.pct, 1)} %`}
          </Text>
          <Text color="#7A858F" fontSize="sm">
            {hitRate.won}/{hitRate.won + hitRate.lost} ratkaistua
          </Text>
        </Box>
      </Grid>

      <Box p="19px" border="1px solid #DCE2E8" borderRadius="15px" bg="white" boxShadow="0 7px 24px rgba(28,35,43,.05)">
        <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
          TARJOUKSET
        </Text>
        <Text as="h3" m="4px 0 16px" color="#27313A" fontSize="17px">
          Tarjousten voittoprosentti
        </Text>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap="12px">
          <Box>
            <Text fontSize="21px" fontWeight="bold" color="#27313A">{hitRate.pct == null ? '\u2013' : `${formatNumber(hitRate.pct, 1)} %`}</Text>
            <Text fontSize="xs" color="#7A858F">Voittoprosentti kappaleista</Text>
          </Box>
          <Box>
            <Text fontSize="21px" fontWeight="bold" color="#27313A">{hitRate.valuePct == null ? '\u2013' : `${formatNumber(hitRate.valuePct, 1)} %`}</Text>
            <Text fontSize="xs" color="#7A858F">Voittoprosentti arvosta · {formatEUR(hitRate.wonValue)} voitettu</Text>
          </Box>
          <Box>
            <Text fontSize="21px" fontWeight="bold" color="#27313A">{hitRate.won} / {hitRate.lost}</Text>
            <Text fontSize="xs" color="#7A858F">Hyväksytty / hylätty</Text>
          </Box>
          <Box>
            <Text fontSize="21px" fontWeight="bold" color="#27313A">{hitRate.open}</Text>
            <Text fontSize="xs" color="#7A858F">Avoinna · {formatEUR(hitRate.openValue)}</Text>
          </Box>
        </SimpleGrid>
        <Text mt="10px" fontSize="xs" color="#8A9199">
          Tarjoukset, joiden päiväys on valitulla aikavälillä. Luonnokset ja avoimet tarjoukset eivät vaikuta prosenttiin.
        </Text>
      </Box>

      <Box p="19px" border="1px solid #DCE2E8" borderRadius="15px" bg="white" boxShadow="0 7px 24px rgba(28,35,43,.05)">
        <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
          ASIAKKAAT
        </Text>
        <Text as="h3" m="4px 0 16px" color="#27313A" fontSize="17px">
          Kate ja voittoprosentti asiakkaittain
        </Text>
        {marginByCustomer.length === 0 ? (
          <Text color="#6E7882" fontSize="sm">Ei tilauksia valitulla aikavälillä.</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th fontSize="10px">Asiakas</Th>
                  <Th fontSize="10px" isNumeric>Myynti alv 0</Th>
                  <Th fontSize="10px" isNumeric>Kate €</Th>
                  <Th fontSize="10px" isNumeric>Kate %</Th>
                  <Th fontSize="10px" isNumeric>Tilauksia</Th>
                </Tr>
              </Thead>
              <Tbody>
                {marginByCustomer.map((c) => {
                  const pct = c.net ? (c.margin / c.net) * 100 : null;
                  return (
                    <Tr key={c.name}>
                      <Td fontSize="xs" fontWeight={700}>{c.name}</Td>
                      <Td fontSize="xs" isNumeric>{formatEUR(c.net)}</Td>
                      <Td fontSize="xs" isNumeric>{formatEUR(c.margin)}</Td>
                      <Td fontSize="xs" isNumeric color={pct != null && pct < 20 ? '#B3261E' : undefined} fontWeight={pct != null && pct < 20 ? 700 : undefined}>
                        {pct == null ? '\u2013' : `${formatNumber(pct, 0)} %`}
                      </Td>
                      <Td fontSize="xs" isNumeric>{c.jobs}</Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Box>

      <Box p="19px" border="1px solid #DCE2E8" borderRadius="15px" bg="white" boxShadow="0 7px 24px rgba(28,35,43,.05)">
        <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
          TYÖT
        </Text>
        <Text as="h3" m="4px 0 16px" color="#27313A" fontSize="17px">
          Kate töittäin
        </Text>
        {marginByJob.length === 0 ? (
          <Text color="#6E7882" fontSize="sm">Ei tilauksia valitulla aikavälillä.</Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th fontSize="10px">Tilaus</Th>
                  <Th fontSize="10px">Asiakas</Th>
                  <Th fontSize="10px" isNumeric>Myynti alv 0</Th>
                  <Th fontSize="10px" isNumeric>Kate €</Th>
                  <Th fontSize="10px" isNumeric>Kate %</Th>
                </Tr>
              </Thead>
              <Tbody>
                {marginByJob.map(({ o, net: n, margin, pct }) => (
                  <Tr key={o._id} cursor="pointer" _hover={{ bg: '#FFF8F1' }} onClick={() => void hailer.ui.activity.open(o._id, { tab: 'detail' })}>
                    <Td fontSize="xs" fontWeight={700}>{o.name}</Td>
                    <Td fontSize="xs">{readLink(o.fields?.[OF.asiakas]).name || '\u2013'}</Td>
                    <Td fontSize="xs" isNumeric>{formatEUR(n)}</Td>
                    <Td fontSize="xs" isNumeric>{formatEUR(margin)}</Td>
                    <Td fontSize="xs" isNumeric color={pct != null && pct < 20 ? '#B3261E' : undefined} fontWeight={pct != null && pct < 20 ? 700 : undefined}>
                      {pct == null ? '\u2013' : `${formatNumber(pct, 0)} %`}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
        <Text mt="10px" fontSize="xs" color="#8A9199">
          Kate lasketaan tuotteiden kustannusosuuksista, ellei tilaukselle ole kirjattu toteutuneita kustannuksia (Ylläpito → Tilaus → Toteuma). Alle 20 %:n kate näkyy punaisena.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="14px">
        <Box p="19px" border="1px solid #DCE2E8" borderRadius="15px" bg="white" boxShadow="0 7px 24px rgba(28,35,43,.05)">
          <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
            TUOTTEET
          </Text>
          <Text as="h3" m="4px 0 16px" color="#27313A" fontSize="17px">
            Myynti tuoteryhmittäin
          </Text>
          {barRows(byProduct)}
        </Box>
        <Box p="19px" border="1px solid #DCE2E8" borderRadius="15px" bg="white" boxShadow="0 7px 24px rgba(28,35,43,.05)">
          <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
            ASIAKKAAT
          </Text>
          <Text as="h3" m="4px 0 16px" color="#27313A" fontSize="17px">
            Myynti asiakkaittain
          </Text>
          {barRows(byCustomer)}
        </Box>
      </SimpleGrid>
    </Box>
  );
}
