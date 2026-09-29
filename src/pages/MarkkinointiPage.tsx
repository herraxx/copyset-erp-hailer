import { useEffect, useMemo, useState } from 'react';
import { Box, VStack, HStack, Text, Badge, SimpleGrid, Spinner, Checkbox, Button, useToast } from '@chakra-ui/react';
import type { HailerApi, Activity } from '@hailer/app-sdk';
import { brand } from '../theme/brand';
import { WF, ASIAKKAAT_FIELDS as AF } from '../hailer/workspace-bindings';
import { listAllPhase } from '../lib/hailerData';

interface Props {
  hailer: HailerApi;
}

type SegmentFilter = 'all' | 'Aktiivinen' | 'Prospekti' | 'Passiivinen';

export default function MarkkinointiPage({ hailer }: Props) {
  const toast = useToast();
  const [customers, setCustomers] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [segment, setSegment] = useState<SegmentFilter>('all');
  const [emailOnly, setEmailOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c')
      .then((c) => setCustomers(c.sort((a, b) => a.name.localeCompare(b.name))))
      .finally(() => setLoading(false));
  }, [hailer]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (segment !== 'all' && String(c.fields?.[AF.status] ?? '') !== segment) return false;
      if (emailOnly && !String(c.fields?.[AF.shkposti] ?? '').trim()) return false;
      return true;
    });
  }, [customers, segment, emailOnly]);

  useEffect(() => {
    setSelectedIds(new Set(filtered.map((c) => c._id)));
  }, [filtered]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows = filtered.filter((c) => selectedIds.has(c._id));
    if (rows.length === 0) {
      toast({ title: 'Ei valittuja vastaanottajia.', status: 'warning' });
      return;
    }
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['Yritys', 'Sähköposti', 'Puhelin', 'Status'];
    const csvRows = [header.join(',')];
    for (const c of rows) {
      csvRows.push(
        [esc(c.name), esc(c.fields?.[AF.shkposti]), esc(c.fields?.[AF.puhelin]), esc(c.fields?.[AF.status])].join(','),
      );
    }
    const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'markkinointilista.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast({ title: `${rows.length} vastaanottajaa vietiin CSV-tiedostoon.`, status: 'success' });
  }

  return (
    <VStack align="stretch" spacing={5}>
      <Text fontSize="xl" fontWeight="bold" color={brand.charcoal}>
        Markkinointi
      </Text>

      <HStack flexWrap="wrap" gap={2}>
        {(['all', 'Aktiivinen', 'Prospekti', 'Passiivinen'] as SegmentFilter[]).map((s) => (
          <Badge
            key={s}
            px={3}
            py={1.5}
            borderRadius="full"
            cursor="pointer"
            bg={segment === s ? brand.charcoal : 'white'}
            color={segment === s ? 'white' : brand.charcoal}
            border={`1px solid ${brand.border}`}
            onClick={() => setSegment(s)}
          >
            {s === 'all' ? 'Kaikki' : s}
          </Badge>
        ))}
        <Checkbox colorScheme="green" isChecked={emailOnly} onChange={(e) => setEmailOnly(e.target.checked)}>
          Vain asiakkaat, joilla sähköposti
        </Checkbox>
      </HStack>

      <HStack justify="space-between">
        <Text fontWeight="bold">
          Valittu {selectedIds.size} / {filtered.length}
        </Text>
        <Button h="40px" bg={brand.orange} color={brand.charcoal} _hover={{ bg: brand.orangeAccent, color: 'white' }} onClick={exportCsv}>
          Lataa vastaanottajalista (CSV)
        </Button>
      </HStack>
      <Text fontSize="xs" color="subtleText">
        Sähköpostit lähetetään omalla sähköpostityökalullasi CSV-listan avulla — tämä sovellus ei lähetä sähköposteja
        automaattisesti.
      </Text>

      {loading ? (
        <Spinner color={brand.orange} />
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
          {filtered.map((c) => (
            <HStack key={c._id} bg={brand.white} borderRadius="10px" border={`1px solid ${brand.border}`} p={3} justify="space-between">
              <Checkbox colorScheme="green" isChecked={selectedIds.has(c._id)} onChange={() => toggle(c._id)}>
                <Box>
                  <Text fontWeight="medium">{c.name}</Text>
                  <Text fontSize="xs" color="subtleText">
                    {String(c.fields?.[AF.shkposti] ?? 'Ei sähköpostia')}
                  </Text>
                </Box>
              </Checkbox>
              <Badge colorScheme={String(c.fields?.[AF.status]) === 'Aktiivinen' ? 'green' : 'gray'}>{String(c.fields?.[AF.status] ?? '\u2013')}</Badge>
            </HStack>
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}
