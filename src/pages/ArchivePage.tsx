import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Table, Thead, Tbody, Tr, Th, Td, Text, Input, Button, useToast, Spinner } from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import { WF, TILAUKSET_FIELDS as OF, TILAUKSET_PHASES as OP, TILAUSRIVIT_FIELDS as ORF } from '../hailer/workspace-bindings';
import { listAllPhase, listAllWorkflow } from '../lib/hailerData';
import { formatEUR, formatDate, readLink } from '../lib/format';
import { duplicateOrder } from '../lib/orderDuplicate';

interface Props {
  hailer: HailerApi;
}

// Matches the live reference's archive.js exactly: laskutetut (invoiced)
// orders only, a simple searchable table, row click opens the order (native
// Hailer sidenav here), and "Kopioi uudeksi" duplicates it into a fresh
// editable order.
export default function ArchivePage({ hailer }: Props) {
  const toast = useToast();
  const [orders, setOrders] = useState<Activity[]>([]);
  const [lineSummary, setLineSummary] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, lines] = await Promise.all([
        listAllWorkflow(hailer, WF.tilaukset, Object.values(OP)),
        listAllPhase(hailer, WF.tilausrivit, '6a9fde6e0429f4bd513ae3b4'),
      ]);
      const invoiced = o.filter((x) => x.currentPhase === OP.laskutettu).sort((a, b) => Number(b.created) - Number(a.created));
      setOrders(invoiced);
      const invoicedIds = new Set(invoiced.map((x) => x._id));
      const byOrder: Record<string, string[]> = {};
      for (const l of lines) {
        const orderId = readLink(l.fields?.[ORF.tilaus]).id;
        if (!orderId || !invoicedIds.has(orderId)) continue;
        const productName = readLink(l.fields?.[ORF.tuote]).name || 'Tuote';
        (byOrder[orderId] ||= []).push(`${productName} \u00b7 ${l.fields?.[ORF.maara] ?? 0} kpl`);
      }
      const summary: Record<string, string> = {};
      for (const [id, rows] of Object.entries(byOrder)) summary[id] = rows.join(', ');
      setLineSummary(summary);
    } catch {
      toast({ title: 'Arkiston lataus epäonnistui', status: 'error' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const customerName = readLink(o.fields?.[OF.asiakas]).name?.toLowerCase() || '';
      return o.name.toLowerCase().includes(q) || customerName.includes(q) || (lineSummary[o._id] || '').toLowerCase().includes(q);
    });
  }, [orders, search, lineSummary]);

  async function handleCopy(id: string) {
    setCopying(id);
    try {
      const newId = await duplicateOrder(hailer, id);
      toast({ title: 'Uusi tilaus luotu kopiona.', status: 'success' });
      await hailer.ui.activity.open(newId, { tab: 'detail' });
    } catch (e) {
      toast({ title: 'Kopiointi epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
    } finally {
      setCopying(null);
    }
  }

  return (
    <Box bg={brand.white} border={`1px solid ${brand.border}`} borderRadius="16px" boxShadow="0 8px 28px rgba(28,35,43,.06)" p="18px">
      <Text fontSize="xl" fontWeight="bold" color={brand.charcoal}>
        Arkisto / vanhat tilaukset
      </Text>
      <Text fontSize="xs" color="subtleText" mt={1} mb="14px">
        Hae laskutettu työ ja kopioi se uudeksi muokattavaksi tilaukseksi.
      </Text>
      <Input
        h="44px"
        bg="#FBFCFD"
        border="1px solid #CFD6DE"
        borderRadius="10px"
        placeholder="Hae asiakas, tilausnumero, tuote, viite tai päivämäärä"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        mb="14px"
      />

      {loading ? (
        <Spinner color={brand.orange} />
      ) : (
        <Box border="1px solid #DFE4E9" borderRadius="11px" bg="white" overflowX="auto">
          <Table minW="900px">
            <Thead>
              <Tr>
                <Th fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tilaus</Th>
                <Th fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Päivä</Th>
                <Th fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Asiakas</Th>
                <Th fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Tuotteet</Th>
                <Th fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E">Myynti alv 0</Th>
                <Th fontSize="9px" letterSpacing="0.08em" bg="#F3F5F7" color="#59636E"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {filtered.length === 0 && (
                <Tr>
                  <Td colSpan={6}>
                    <Text textAlign="center" color="subtleText" py={8}>
                      Arkistosta ei löytynyt töitä.
                    </Text>
                  </Td>
                </Tr>
              )}
              {filtered.map((o) => (
                <Tr key={o._id} cursor="pointer" _hover={{ bg: '#FFF8F1' }} onClick={() => void hailer.ui.activity.open(o._id, { tab: 'detail' })}>
                  <Td fontWeight="800">{o.name}</Td>
                  <Td>{formatDate(o.fields?.[OF.tilauspaiva] ?? (o.created ? Number(o.created) / 1000 : undefined))}</Td>
                  <Td>{readLink(o.fields?.[OF.asiakas]).name || '\u2013'}</Td>
                  <Td fontSize="xs" whiteSpace="normal">{lineSummary[o._id] || '\u2013'}</Td>
                  <Td>{formatEUR(o.fields?.[OF.nettoYhteensa] ?? o.fields?.[OF.myyntiYhteensa])}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" bg={brand.orange} color="white" _hover={{ bg: brand.orangeAccent }} isLoading={copying === o._id} onClick={() => void handleCopy(o._id)}>
                      Kopioi uudeksi
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
