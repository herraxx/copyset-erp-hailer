import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Grid, HStack, Text, Input, Button, Badge, SimpleGrid, Spinner, useToast } from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import { WF, ASIAKKAAT_FIELDS as AF, TILAUKSET_FIELDS as OF, TILAUKSET_PHASES as OP } from '../hailer/workspace-bindings';
import { listAllPhase, listAllWorkflow } from '../lib/hailerData';
import { formatEUR, readLink } from '../lib/format';
import { HailerPlus } from '../hailer/theme/icons/HailerPlus';

interface Props {
  hailer: HailerApi;
  onCreateOfferForCustomer: (customerId: string) => void;
}

// Matches the live reference's "copyset-register" CRM layout exactly
// (hero + 3 summary cards + searchable register table). Row click and
// "Muokkaa" both hand off to Hailer's native activity sidenav — cleaner
// than re-implementing a field editor, and it comes with discussion/files/
// linkedFrom (which already lists every offer/order tied to this customer).
export default function AsiakkaatPage({ hailer, onCreateOfferForCustomer }: Props) {
  const toast = useToast();
  const [customers, setCustomers] = useState<Activity[]>([]);
  const [orders, setOrders] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, o] = await Promise.all([
        listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c'),
        listAllWorkflow(hailer, WF.tilaukset, Object.values(OP)),
      ]);
      c.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(c);
      setOrders(o);
    } catch {
      toast({ title: 'Asiakastietojen lataus epäonnistui', status: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  useEffect(() => {
    void load();
  }, [load]);

  const salesByCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const cid = readLink(o.fields?.[OF.asiakas]).id;
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + (Number(o.fields?.[OF.nettoYhteensa] ?? o.fields?.[OF.myyntiYhteensa]) || 0);
    }
    return map;
  }, [orders]);

  const jobsByCustomer = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      const cid = readLink(o.fields?.[OF.asiakas]).id;
      if (!cid) continue;
      map[cid] = (map[cid] || 0) + 1;
    }
    return map;
  }, [orders]);

  const totalSales = useMemo(() => Object.values(salesByCustomer).reduce((s, v) => s + v, 0), [salesByCustomer]);
  const activeCount = useMemo(() => customers.filter((c) => String(c.fields?.[AF.status] ?? '') === 'Aktiivinen').length, [customers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.fields?.[AF.shkposti] ?? '').toLowerCase().includes(q) ||
        String(c.fields?.[AF.ytunnus] ?? '').toLowerCase().includes(q) ||
        String(c.fields?.[AF.puhelin] ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  async function openCustomer(id: string) {
    await hailer.ui.activity.open(id, { tab: 'detail' });
    await load();
  }

  async function createNewCustomer() {
    try {
      const created = await hailer.ui.activity.create(WF.asiakkaat, {
        fields: { [AF.status]: 'Prospekti', [AF.maksuehtoPv]: 21 },
      });
      if (created) toast({ title: 'Asiakas luotu.', status: 'success' });
      await load();
    } catch {
      toast({ title: 'Luonti epäonnistui', status: 'error' });
    }
  }

  const ROW_COLUMNS = 'minmax(210px,1.5fr) minmax(105px,.7fr) minmax(170px,1.1fr) 70px minmax(135px,.9fr) auto';

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
            REKISTERI
          </Text>
          <Text as="h2" m="3px 0 5px" color="#242B31" fontSize="25px" lineHeight="1.15">
            Asiakas CRM
          </Text>
          <Text m={0} color="#65707C" fontSize="13px">
            Asiakastiedot, yhteyshenkilöt, tarjoukset ja tilaushistoria yhdessä näkymässä.
          </Text>
        </Box>
        <Button h="42px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} leftIcon={<HailerPlus />} onClick={createNewCustomer}>
          Lisää asiakas
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="12px">
        <Box p="16px 18px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" boxShadow="0 5px 18px rgba(28,35,43,.045)">
          <Text display="block" mb="7px" color="#6A7580" fontSize="10px" fontWeight="850" textTransform="uppercase" letterSpacing="0.08em">
            Asiakkaita
          </Text>
          <Text color="#283139" fontSize="21px" fontWeight="bold">
            {customers.length}
          </Text>
        </Box>
        <Box p="16px 18px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" boxShadow="0 5px 18px rgba(28,35,43,.045)">
          <Text display="block" mb="7px" color="#6A7580" fontSize="10px" fontWeight="850" textTransform="uppercase" letterSpacing="0.08em">
            Aktiivisia
          </Text>
          <Text color="#283139" fontSize="21px" fontWeight="bold">
            {activeCount}
          </Text>
        </Box>
        <Box p="16px 18px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" boxShadow="0 5px 18px rgba(28,35,43,.045)">
          <Text display="block" mb="7px" color="#6A7580" fontSize="10px" fontWeight="850" textTransform="uppercase" letterSpacing="0.08em">
            Myynti yhteensä alv 0
          </Text>
          <Text color="#283139" fontSize="21px" fontWeight="bold">
            {formatEUR(totalSales)}
          </Text>
        </Box>
      </SimpleGrid>

      <Box overflow="hidden" border="1px solid #D9DFE5" borderRadius="16px" bg="white" boxShadow="0 8px 28px rgba(28,35,43,.055)">
        <HStack justify="space-between" align="flex-end" gap="18px" p="17px 18px" borderBottom="1px solid #E5E9ED" bg="#FBFCFD" flexWrap="wrap">
          <Box>
            <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
              ASIAKASREKISTERI
            </Text>
            <Text mt="4px" color="#303942" fontSize="14px" fontWeight="bold">
              {filtered.length} asiakasta
            </Text>
          </Box>
          <Input
            maxW={{ base: '100%', md: '520px' }}
            minH="43px"
            border="1px solid #CCD4DC"
            borderRadius="10px"
            placeholder="Hae yritys, Y-tunnus, yhteyshenkilö tai sähköposti"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </HStack>
        <Box overflowX="auto">
          <Grid templateColumns={ROW_COLUMNS} gap="14px" minW="900px" alignItems="center" minH="38px" py="9px" px="16px" bg="#F3F5F7" color="#59636E" fontSize="9px" fontWeight="900" letterSpacing="0.08em" textTransform="uppercase">
            <Text>Yritys</Text>
            <Text>Y-tunnus</Text>
            <Text>Yhteyshenkilö</Text>
            <Text>Työt</Text>
            <Text>Myynti alv 0</Text>
            <Text></Text>
          </Grid>
          {filtered.length === 0 && (
            <Box p="30px" textAlign="center" color="#6E7882">
              Asiakkaita ei löytynyt.
            </Box>
          )}
          {filtered.map((c) => (
            <Grid
              key={c._id}
              templateColumns={ROW_COLUMNS}
              gap="14px"
              minW="900px"
              alignItems="center"
              p="12px 16px"
              borderBottom="1px solid #EDF0F2"
              color="#303942"
              fontSize="12px"
              cursor="pointer"
              _hover={{ bg: '#FFFAF5' }}
              onClick={() => void openCustomer(c._id)}
            >
              <Box>
                <Text as="strong" display="block" color="#25303A" fontSize="13px">
                  {c.name}
                </Text>
                <Text display="block" mt="4px" color="#74808A" fontSize="11px">
                  {String(c.fields?.[AF.shkposti] ?? 'Ei sähköpostia')}
                </Text>
              </Box>
              <Text>{String(c.fields?.[AF.ytunnus] ?? '\u2013')}</Text>
              <Box>
                <Text as="b" display="block" color="#25303A" fontSize="13px">
                  {String(c.fields?.[AF.puhelin] ?? '\u2013')}
                </Text>
              </Box>
              <Badge display="inline-grid" placeItems="center" minW="30px" h="27px" borderRadius="99px" bg="#EEF2F5" color="#34414C" fontWeight="900">
                {jobsByCustomer[c._id] || 0}
              </Badge>
              <Text as="b" color="#25303A" fontSize="13px">
                {formatEUR(salesByCustomer[c._id] || 0)}
              </Text>
              <HStack onClick={(e) => e.stopPropagation()} justify="flex-end">
                <Button size="sm" variant="outline" onClick={() => void openCustomer(c._id)}>
                  Muokkaa
                </Button>
                <Button
                  size="sm"
                  bg={brand.orange}
                  color="white"
                  _hover={{ bg: brand.orangeAccent }}
                  onClick={() => onCreateOfferForCustomer(c._id)}
                >
                  + Tarjous
                </Button>
              </HStack>
            </Grid>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
