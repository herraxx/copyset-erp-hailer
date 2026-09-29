import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Grid, HStack, Text, Input, Button, Badge, SimpleGrid, Spinner, useToast } from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import { WF, ALIHANKKIJAT_FIELDS as SF, TILAUKSET_FIELDS as OF, TILAUKSET_PHASES as OP } from '../hailer/workspace-bindings';
import { listAllPhase, listAllWorkflow } from '../lib/hailerData';
import { readLink } from '../lib/format';
import { HailerPlus } from '../hailer/theme/icons/HailerPlus';

interface Props {
  hailer: HailerApi;
}

// Matches the live reference's "copyset-register" Alihankkijat layout
// exactly (hero + 3 summary cards + searchable register table). Row click
// and "Muokkaa" both hand off to Hailer's native activity sidenav.
export default function AlihankkijatPage({ hailer }: Props) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Activity[]>([]);
  const [orders, setOrders] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([
        listAllPhase(hailer, WF.alihankkijat, '6a9fde6e0429f4bd513ae3a8'),
        listAllWorkflow(hailer, WF.tilaukset, Object.values(OP)),
      ]);
      s.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(s);
      setOrders(o);
    } catch {
      toast({ title: 'Alihankkijoiden lataus epäonnistui', status: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.fields?.[SF.palvelu] ?? '').toLowerCase().includes(q) ||
        String(s.fields?.[SF.yhteyshenkilo] ?? '').toLowerCase().includes(q) ||
        String(s.fields?.[SF.shkposti] ?? '').toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const specialties = useMemo(() => new Set(suppliers.map((s) => String(s.fields?.[SF.palvelu] ?? '')).filter(Boolean)).size, [suppliers]);

  const ordersForSupplier = useCallback(
    (supplierId: string) => orders.filter((o) => readLink(o.fields?.[OF.alihankkija]).id === supplierId),
    [orders],
  );

  const outsourcedCount = useMemo(() => orders.filter((o) => readLink(o.fields?.[OF.alihankkija]).id).length, [orders]);

  async function openSupplier(id: string) {
    await hailer.ui.activity.open(id, { tab: 'detail' });
    await load();
  }

  async function createNewSupplier() {
    try {
      const created = await hailer.ui.activity.create(WF.alihankkijat, {});
      if (created) toast({ title: 'Alihankkija luotu.', status: 'success' });
      await load();
    } catch {
      toast({ title: 'Luonti epäonnistui', status: 'error' });
    }
  }

  const ROW_COLUMNS = 'minmax(190px,1.35fr) minmax(150px,1fr) minmax(150px,1fr) 115px minmax(200px,1.25fr) auto';

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
            Alihankkijat
          </Text>
          <Text m={0} color="#65707C" fontSize="13px">
            Kumppanit, erikoisalat, yhteyshenkilöt ja tilaushistoria samassa näkymässä.
          </Text>
        </Box>
        <Button h="42px" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} leftIcon={<HailerPlus />} onClick={createNewSupplier}>
          Lisää alihankkija
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 1, md: 3 }} gap="12px">
        <Box p="16px 18px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" boxShadow="0 5px 18px rgba(28,35,43,.045)">
          <Text display="block" mb="7px" color="#6A7580" fontSize="10px" fontWeight="850" textTransform="uppercase" letterSpacing="0.08em">
            Alihankkijoita
          </Text>
          <Text color="#283139" fontSize="21px" fontWeight="bold">
            {suppliers.length}
          </Text>
        </Box>
        <Box p="16px 18px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" boxShadow="0 5px 18px rgba(28,35,43,.045)">
          <Text display="block" mb="7px" color="#6A7580" fontSize="10px" fontWeight="850" textTransform="uppercase" letterSpacing="0.08em">
            Erikoisaloja
          </Text>
          <Text color="#283139" fontSize="21px" fontWeight="bold">
            {specialties}
          </Text>
        </Box>
        <Box p="16px 18px" border="1px solid #DCE2E8" borderRadius="13px" bg="white" boxShadow="0 5px 18px rgba(28,35,43,.045)">
          <Text display="block" mb="7px" color="#6A7580" fontSize="10px" fontWeight="850" textTransform="uppercase" letterSpacing="0.08em">
            Ulkoistettuja tilauksia
          </Text>
          <Text color="#283139" fontSize="21px" fontWeight="bold">
            {outsourcedCount}
          </Text>
        </Box>
      </SimpleGrid>

      <Box overflow="hidden" border="1px solid #D9DFE5" borderRadius="16px" bg="white" boxShadow="0 8px 28px rgba(28,35,43,.055)">
        <HStack justify="space-between" align="flex-end" gap="18px" p="17px 18px" borderBottom="1px solid #E5E9ED" bg="#FBFCFD" flexWrap="wrap">
          <Box>
            <Text as="span" display="block" color="#D96808" fontSize="9px" fontWeight="950" letterSpacing="0.15em">
              KUMPPANIREKISTERI
            </Text>
            <Text mt="4px" color="#303942" fontSize="14px" fontWeight="bold">
              {filtered.length} alihankkijaa
            </Text>
          </Box>
          <Input
            maxW={{ base: '100%', md: '520px' }}
            minH="43px"
            border="1px solid #CCD4DC"
            borderRadius="10px"
            placeholder="Hae yritys, erikoisala, yhteyshenkilö tai sähköposti"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </HStack>
        <Box overflowX="auto">
          <Grid templateColumns={ROW_COLUMNS} gap="14px" minW="900px" alignItems="center" minH="38px" py="9px" px="16px" bg="#F3F5F7" color="#59636E" fontSize="9px" fontWeight="900" letterSpacing="0.08em" textTransform="uppercase">
            <Text>Yritys</Text>
            <Text>Erikoisala</Text>
            <Text>Yhteyshenkilö</Text>
            <Text>Tilauksia</Text>
            <Text>Yhteystiedot</Text>
            <Text></Text>
          </Grid>
          {filtered.length === 0 && (
            <Box p="30px" textAlign="center" color="#6E7882">
              Alihankkijoita ei löytynyt.
            </Box>
          )}
          {filtered.map((s) => (
            <Grid
              key={s._id}
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
              onClick={() => void openSupplier(s._id)}
            >
              <Text as="strong" color="#25303A" fontSize="13px">
                {s.name}
              </Text>
              <Badge display="inline-flex" alignItems="center" minH="27px" px="9px" borderRadius="99px" bg="#FFF0E2" color="#A64E04" fontSize="10px" fontWeight="850" w="fit-content">
                {String(s.fields?.[SF.palvelu] ?? 'Muu')}
              </Badge>
              <Text as="b" color="#25303A" fontSize="13px">
                {String(s.fields?.[SF.yhteyshenkilo] ?? '\u2013')}
              </Text>
              <Badge display="inline-flex" alignItems="center" minH="27px" px="9px" borderRadius="99px" bg="#EAF4ED" color="#216F3D" fontSize="10px" fontWeight="850" w="fit-content">
                {ordersForSupplier(s._id).length}
              </Badge>
              <Box>
                <Text as="b" display="block" color="#25303A" fontSize="13px">
                  {String(s.fields?.[SF.shkposti] ?? '\u2013')}
                </Text>
                <Text display="block" mt="4px" color="#74808A" fontSize="11px">
                  {String(s.fields?.[SF.puhelin] ?? '')}
                </Text>
              </Box>
              <HStack onClick={(e) => e.stopPropagation()} justify="flex-end">
                <Button size="sm" variant="outline" onClick={() => void openSupplier(s._id)}>
                  Muokkaa
                </Button>
              </HStack>
            </Grid>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
