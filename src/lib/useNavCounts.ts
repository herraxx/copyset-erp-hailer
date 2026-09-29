// Nav badge counts — matches the reference's navHTML() cnt object exactly:
// offers = not Hylätty and not (Hyväksytty with an order already created);
// orders = not Laskutettu; archive = Laskutettu count; plus flat counts for
// the register workflows. Refetches whenever `refreshKey` changes so callers
// can bump it after a mutation (accept/create/etc.) without a full page poll.
import { useEffect, useState } from 'react';
import type { HailerApi } from '@hailer/app-sdk';
import { listAllWorkflow, listAllPhase } from './hailerData';
import { readLink } from './format';
import {
  WF,
  TARJOUKSET_PHASES as TP,
  TARJOUKSET_FIELDS as TF,
  TILAUKSET_PHASES as OP,
} from '../hailer/workspace-bindings';
import type { PageKey } from '../components/NavShell';

export function useNavCounts(hailer: HailerApi | undefined, refreshKey: number): Partial<Record<PageKey, number>> {
  const [counts, setCounts] = useState<Partial<Record<PageKey, number>>>({});

  useEffect(() => {
    if (!hailer) return;
    let cancelled = false;
    (async () => {
      try {
        const [offers, orders, customers, products, suppliers] = await Promise.all([
          listAllWorkflow(hailer, WF.tarjoukset, Object.values(TP)),
          listAllWorkflow(hailer, WF.tilaukset, Object.values(OP)),
          listAllPhase(hailer, WF.asiakkaat, '6a9fde6e0429f4bd513ae37c'),
          listAllPhase(hailer, WF.tuotteet, '6a9fde6e0429f4bd513ae38f'),
          listAllPhase(hailer, WF.alihankkijat, '6a9fde6e0429f4bd513ae3a8'),
        ]);
        if (cancelled) return;
        const openOffers = offers.filter((o) => {
          if (o.currentPhase === TP.hylatty) return false;
          if (o.currentPhase === TP.hyvaksytty && readLink(o.fields?.[TF.luotuTilaus]).id) return false;
          return true;
        }).length;
        const activeOrders = orders.filter((o) => o.currentPhase !== OP.laskutettu).length;
        const archived = orders.filter((o) => o.currentPhase === OP.laskutettu).length;
        setCounts({
          tarjoukset: openOffers,
          tilaukset: activeOrders,
          arkisto: archived,
          asiakkaat: customers.length,
          tuotteet: products.length,
          alihankkijat: suppliers.length,
        });
      } catch {
        // Badge counts are cosmetic — silently keep the previous values on error.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hailer, refreshKey]);

  return counts;
}
