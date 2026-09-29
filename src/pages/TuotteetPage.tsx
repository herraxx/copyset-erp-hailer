import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, VStack, HStack, Text, Input, Button, Badge, SimpleGrid, Spinner, useToast } from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import { WF, TUOTTEET_FIELDS as PF } from '../hailer/workspace-bindings';
import { listAllPhase } from '../lib/hailerData';
import { formatEUR, readLink } from '../lib/format';
import { HailerSearch } from '../hailer/theme/icons/HailerSearch';
import { HailerPlus } from '../hailer/theme/icons/HailerPlus';

interface Props {
  hailer: HailerApi;
  onQuoteForProduct: (product: { id: string; name: string; perushinta: number; aloitusmaksu: number }) => void;
}

export default function TuotteetPage({ hailer, onQuoteForProduct }: Props) {
  const toast = useToast();
  const [products, setProducts] = useState<Activity[]>([]);
  const [groups, setGroups] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([
        listAllPhase(hailer, WF.tuotteet, '6a9fde6e0429f4bd513ae38f'),
        listAllPhase(hailer, WF.tuoteryhmat, '6a9fde6e0429f4bd513ae389'),
      ]);
      p.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(p);
      setGroups(g);
    } catch {
      toast({ title: 'Tuotteiden lataus epäonnistui', status: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (groupFilter !== 'all' && readLink(p.fields?.[PF.tuoteryhma]).id !== groupFilter) return false;
      if (!search.trim()) return true;
      return p.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [products, groupFilter, search]);

  async function openProduct(id: string) {
    // Native sidenav — editing perushinta/aloituskustannus/kustannushinta
    // etc. is exactly what Hailer's own activity editor already does well.
    await hailer.ui.activity.open(id, { tab: 'detail' });
    await load();
  }

  async function createNewProduct() {
    const created = await hailer.ui.activity.create(WF.tuotteet, { fields: { [PF.aktiivinen]: 'Kyllä' } });
    if (created) toast({ title: 'Tuote luotu.', status: 'success' });
    await load();
  }

  return (
    <VStack align="stretch" spacing={4}>
      <HStack flexWrap="wrap" gap={2}>
        <Box position="relative" flex="1" minW="220px">
          <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="gray.400">
            <HailerSearch />
          </Box>
          <Input pl={9} h="40px" bg={brand.white} placeholder="Hae tuotetta…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Box>
        <Button h="40px" leftIcon={<HailerPlus />} variant="outline" onClick={createNewProduct}>
          Uusi tuote
        </Button>
      </HStack>

      <HStack flexWrap="wrap" gap={2}>
        <Badge px={3} py={1.5} borderRadius="full" cursor="pointer" bg={groupFilter === 'all' ? brand.charcoal : 'white'} color={groupFilter === 'all' ? 'white' : brand.charcoal} border={`1px solid ${brand.border}`} onClick={() => setGroupFilter('all')}>
          Kaikki ({products.length})
        </Badge>
        {groups.map((g) => (
          <Badge key={g._id} px={3} py={1.5} borderRadius="full" cursor="pointer" bg={groupFilter === g._id ? brand.charcoal : 'white'} color={groupFilter === g._id ? 'white' : brand.charcoal} border={`1px solid ${brand.border}`} onClick={() => setGroupFilter(g._id)}>
            {g.name}
          </Badge>
        ))}
      </HStack>

      {loading ? (
        <Spinner color={brand.orange} />
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={3}>
          {filtered.map((p) => (
            <Box key={p._id} bg={brand.white} borderRadius="12px" border={`1px solid ${brand.border}`} p={4} cursor="pointer" _hover={{ borderColor: brand.orange }} onClick={() => void openProduct(p._id)}>
              <HStack justify="space-between">
                <Text fontWeight="bold" color={brand.charcoal} noOfLines={1}>
                  {p.name}
                </Text>
                <Badge colorScheme={String(p.fields?.[PF.aktiivinen]) === 'Kyllä' ? 'green' : 'gray'} borderRadius="full">
                  {String(p.fields?.[PF.aktiivinen] ?? '\u2013')}
                </Badge>
              </HStack>
              <Text fontSize="sm" color="subtleText" mt={1}>
                {readLink(p.fields?.[PF.tuoteryhma]).name || 'Ei ryhmää'}
              </Text>
              <HStack mt={2} fontSize="sm" justify="space-between">
                <Text>Perushinta</Text>
                <Text fontWeight="bold">{formatEUR(p.fields?.[PF.perushinta])}</Text>
              </HStack>
              <HStack fontSize="sm" justify="space-between">
                <Text>Aloituskustannus</Text>
                <Text>{formatEUR(p.fields?.[PF.aloituskustannus])}</Text>
              </HStack>
              <HStack fontSize="sm" justify="space-between">
                <Text>Kustannushinta / yks.</Text>
                <Text>{formatEUR(p.fields?.[PF.kustannushinta])}</Text>
              </HStack>
              <Button
                mt={3}
                w="100%"
                size="sm"
                h="36px"
                bg={brand.orange}
                color="white"
                _hover={{ bg: brand.orangeAccent }}
                onClick={(e) => {
                  e.stopPropagation();
                  onQuoteForProduct({
                    id: p._id,
                    name: p.name,
                    perushinta: Number(p.fields?.[PF.perushinta]) || 0,
                    aloitusmaksu: Number(p.fields?.[PF.aloituskustannus]) || 0,
                  });
                }}
              >
                Tee tarjous
              </Button>
            </Box>
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}
