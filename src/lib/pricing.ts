// Shared pricing resolution — used by both TarjouksetPage and TilauksetPage
// line-item forms, and by the Hinnoittelu admin page. Implements the
// authoritative reference package's exact pricing algorithm (copyset-erp.zip,
// src/app.js: tableTotal/priceConfig), translated onto native Hailer data:
//
//   1. Asiakashinnat (customer contract price) wins outright — no discount
//      stacking, matches "sopimushinta" in the reference exactly.
//   2. Tuotehinnat (price table): qty -> total price (excl. VAT) at default
//      options, INTERPOLATED between rows exactly like the reference's
//      tableTotal(): below the first row, the first row's price is the
//      minimum (per-piece if the first row's qty is 1); above the last row,
//      the last segment's slope continues. This is the reference's own
//      curve, not a step function.
//   3. Tuotteet.perushinta — flat per-unit fallback when no table/contract
//      price exists at all.
// Option groups (🎛️ Tuotevalinnat) then apply on top, exactly like the
// reference's option resolution: "Kerroin" multiplies the unit price,
// "€ / yksikkö" adds a flat €/unit, "€ kertamaksu" adds a one-off € to the
// whole line. Customer's yleinenAlennus % applies after options, except on
// contract prices (matches the reference: sopimushinta is already final).
import type { Activity } from '@hailer/app-sdk';
import { readLink, readValue } from './format';
import {
  TUOTTEET_FIELDS as PF,
  HINNASTOT_FIELDS as HF,
  TUOTEHINNAT_FIELDS as THF,
  ASIAKASHINNAT_FIELDS as AHF,
  ASIAKKAAT_FIELDS as AF,
  TUOTEVALINNAT_FIELDS as TVF,
} from '../hailer/workspace-bindings';

export type PriceSource = 'sopimushinta' | 'hinnasto' | 'perushinta' | 'none';

export interface ResolvedPrice {
  /** Unit price BEFORE the customer's general discount is applied. */
  rawUnitPrice: number;
  /** Unit price AFTER the customer's general discount is applied (what should be written to the line). */
  unitPrice: number;
  source: PriceSource;
  /** Short, human-readable explanation shown next to the price field. */
  label: string;
  discountPct: number;
}

export interface PricingCatalog {
  products: Activity[];
  hinnastot: Activity[];
  tuotehinnat: Activity[];
  asiakashinnat: Activity[];
  customers: Activity[];
  /** Optional — only needed for option-group pricing (priceConfig/resolveLinePrice). */
  tuotevalinnat?: Activity[];
}

function todayUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function dateFieldToSeconds(v: unknown): number | null {
  const raw = readValue<number | string>(v);
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  // date fields are stored in seconds; guard against an accidental ms value
  return n > 10_000_000_000 ? Math.floor(n / 1000) : n;
}

// ---------------------------------------------------------------------------
// Price table interpolation — matches the reference's tableTotal() exactly.
// ---------------------------------------------------------------------------
export interface TableRow {
  qty: number;
  total: number;
}

function tableRowsFor(catalog: PricingCatalog, hinnastoId: string, tuoteId: string): TableRow[] {
  return catalog.tuotehinnat
    .filter((t) => readLink(t.fields?.[THF.hinnasto]).id === hinnastoId && readLink(t.fields?.[THF.tuote]).id === tuoteId)
    .map((t) => ({ qty: Number(readValue(t.fields?.[THF.maaraAlkaenKpl])) || 0, total: Number(readValue(t.fields?.[THF.kokonaishinta])) || 0 }))
    .filter((r) => r.qty > 0 && r.total > 0)
    .sort((a, b) => a.qty - b.qty);
}

/**
 * Quantity -> total price (excl. VAT) at default options, interpolated
 * between rows. Below the first row, the first row's price is the minimum
 * (per-piece if the first row's qty is 1, else a flat minimum). Above the
 * last row, the last segment's slope continues. Returns null when there are
 * no rows at all (caller falls further back down the priority chain).
 */
export function tableTotal(rows: TableRow[], qty: number): number | null {
  if (!rows.length || qty <= 0) return null;
  if (qty <= rows[0].qty) return rows[0].qty === 1 ? rows[0].total * qty : rows[0].total;
  for (let i = 1; i < rows.length; i++) {
    if (qty <= rows[i].qty) {
      const a = rows[i - 1];
      const b = rows[i];
      return a.total + ((b.total - a.total) * (qty - a.qty)) / (b.qty - a.qty);
    }
  }
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const slope = prev ? Math.max(0, (last.total - prev.total) / (last.qty - prev.qty)) : last.total / last.qty;
  return last.total + slope * (qty - last.qty);
}

// ---------------------------------------------------------------------------
// Option groups (🎛️ Tuotevalinnat) — kerroin / €-per-unit / €-flat.
// ---------------------------------------------------------------------------
export type OptionMode = 'Kerroin' | '€ / yksikkö' | '€ kertamaksu';

export interface OptionChoice {
  id: string;
  label: string;
  mode: OptionMode;
  value: number;
  targetField: string;
  isDefault: boolean;
}

export interface OptionGroup {
  name: string;
  choices: OptionChoice[];
}

/** Groups a product category's 🎛️ Tuotevalinnat rows by "Ryhmän nimi", sorted by Järjestys. */
export function optionGroupsFor(catalog: PricingCatalog, tuoteryhmaId: string | undefined): OptionGroup[] {
  if (!tuoteryhmaId || !catalog.tuotevalinnat) return [];
  const rows = catalog.tuotevalinnat.filter((r) => readLink(r.fields?.[TVF.tuoteryhma]).id === tuoteryhmaId);
  const byGroup = new Map<string, OptionChoice[]>();
  const order: string[] = [];
  for (const r of rows) {
    const groupName = String(readValue(r.fields?.[TVF.ryhmanNimi]) ?? '');
    if (!groupName) continue;
    if (!byGroup.has(groupName)) {
      byGroup.set(groupName, []);
      order.push(groupName);
    }
    byGroup.get(groupName)!.push({
      id: r._id,
      label: String(readValue(r.fields?.[TVF.vaihtoehdonNimi]) ?? ''),
      mode: (String(readValue(r.fields?.[TVF.tapa]) ?? 'Kerroin') as OptionMode),
      value: Number(readValue(r.fields?.[TVF.arvo])) ?? 1,
      targetField: String(readValue(r.fields?.[TVF.kohdekentta]) ?? 'Ei mitään'),
      isDefault: String(readValue(r.fields?.[TVF.oletusvalinta]) ?? 'Ei') === 'Kyllä',
    });
  }
  return order.map((name) => {
    const choices = (byGroup.get(name) || []).sort((a, b) => a.label.localeCompare(b.label, 'fi'));
    // Push the default choice first so pickers default sensibly.
    choices.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return { name, choices };
  });
}

export interface LinePriceInput {
  tuoteId: string;
  tuoteryhmaId?: string;
  qty: number;
  customerId: string | null;
  /** Selected choice id per group name, e.g. { Koko: "<choiceId>" }. */
  selectedOptions?: Record<string, string>;
  /** Manual unit price override — when set, skips the table lookup entirely (matches the reference's manualBase). */
  manualUnitPrice?: number;
}

export interface LinePriceResult extends ResolvedPrice {
  /** One-off € added by "€ kertamaksu" options (e.g. rounded corners setup) — not multiplied by qty. */
  fixedAddOn: number;
  /** Free-text summary of the selected options, for the line's "Spesifikaatiot" field. */
  optionSummary: string;
}

/**
 * Full line price: price table (interpolated) or flat base price, with
 * product option-group multipliers/adders applied on top, then the
 * customer's general discount — matches the reference's priceConfig()
 * exactly (options step) layered onto resolveUnitPrice (source step).
 */
export function resolveLinePrice(catalog: PricingCatalog, input: LinePriceInput): LinePriceResult {
  const base = resolveUnitPrice(catalog, input.tuoteId, input.customerId, input.qty, input.manualUnitPrice);
  const groups = optionGroupsFor(catalog, input.tuoteryhmaId);
  let unit = base.rawUnitPrice;
  let fixedAddOn = 0;
  const summaryParts: string[] = [];
  for (const group of groups) {
    const selectedId = input.selectedOptions?.[group.name];
    const choice = group.choices.find((c) => c.id === selectedId) || group.choices.find((c) => c.isDefault) || group.choices[0];
    if (!choice) continue;
    if (choice.mode === 'Kerroin') unit *= choice.value;
    else if (choice.mode === '€ / yksikkö') unit += choice.value;
    else if (choice.mode === '€ kertamaksu') fixedAddOn += choice.value;
    if (choice.targetField && choice.targetField !== 'Ei mitään') summaryParts.push(choice.label);
  }
  // Contract prices (sopimushinta) are already final — the reference never
  // re-applies options on top of a negotiated price either.
  if (base.source === 'sopimushinta') {
    return { ...base, fixedAddOn: 0, optionSummary: summaryParts.join(', ') };
  }
  const discounted = unit * (1 - base.discountPct / 100);
  return { ...base, rawUnitPrice: unit, unitPrice: discounted, fixedAddOn, optionSummary: summaryParts.join(', ') };
}

/**
 * Resolve the unit price for a product at a given quantity, for a given
 * (optional) customer. Never throws — falls back gracefully to "no price
 * found" (rawUnitPrice: 0, source: 'none') so callers can decide what to do.
 */
export function resolveUnitPrice(catalog: PricingCatalog, tuoteId: string, customerId: string | null, qty: number, manualUnitPrice?: number): ResolvedPrice {
  const product = catalog.products.find((p) => p._id === tuoteId);
  const customer = customerId ? catalog.customers.find((c) => c._id === customerId) : undefined;
  const discountPct = Number(readValue(customer?.fields?.[AF.yleinenAlennus]) ?? 0) || 0;

  // 1. Customer contract price (Asiakashinnat) — wins outright, no discount stacking.
  if (customerId) {
    const now = todayUnixSeconds();
    const contractRows = catalog.asiakashinnat.filter(
      (a) => readLink(a.fields?.[AHF.asiakas]).id === customerId && readLink(a.fields?.[AHF.tuote]).id === tuoteId,
    );
    const validContract = contractRows.find((a) => {
      const validFrom = dateFieldToSeconds(a.fields?.[AHF.voimassaAlkaen]);
      return validFrom === null || validFrom <= now;
    });
    if (validContract) {
      const price = Number(readValue(validContract.fields?.[AHF.sopimushinta])) || 0;
      return {
        rawUnitPrice: price,
        unitPrice: price,
        source: 'sopimushinta',
        label: `Sopimushinta (${customer?.name || 'asiakas'})`,
        discountPct: 0,
      };
    }
  }

  // Manual override — matches the reference's manualBase: skips the table lookup entirely.
  if (manualUnitPrice !== undefined) {
    const discounted = manualUnitPrice * (1 - discountPct / 100);
    return { rawUnitPrice: manualUnitPrice, unitPrice: discounted, source: 'perushinta', label: 'Käsin syötetty hinta', discountPct };
  }

  // 2. Price table (Tuotehinnat), interpolated exactly like the reference's tableTotal().
  const assignedHinnastoId = customer ? readLink(customer.fields?.[AF.hinnasto]).id : undefined;
  const defaultHinnasto = catalog.hinnastot.find((h) => String(readValue(h.fields?.[HF.oletushinnasto]) ?? '') === 'Kyllä');
  const hinnastoId = assignedHinnastoId || defaultHinnasto?._id;
  const hinnastoName = catalog.hinnastot.find((h) => h._id === hinnastoId)?.name || 'Hinnasto';

  if (hinnastoId) {
    const rows = tableRowsFor(catalog, hinnastoId, tuoteId);
    const total = tableTotal(rows, qty);
    if (total != null && qty > 0) {
      const raw = total / qty;
      const discounted = raw * (1 - discountPct / 100);
      return {
        rawUnitPrice: raw,
        unitPrice: discounted,
        source: 'hinnasto',
        label: `${hinnastoName}: hintataulukko (${qty} kpl)${discountPct ? ` \u2212 asiakasalennus ${discountPct}%` : ''}`,
        discountPct,
      };
    }
  }

  // 3. Flat fallback — product's base price.
  if (product) {
    const raw = Number(readValue(product.fields?.[PF.perushinta])) || 0;
    const discounted = raw * (1 - discountPct / 100);
    return {
      rawUnitPrice: raw,
      unitPrice: discounted,
      source: 'perushinta',
      label: `Perushinta${discountPct ? ` \u2212 asiakasalennus ${discountPct}%` : ''}`,
      discountPct,
    };
  }

  return { rawUnitPrice: 0, unitPrice: 0, source: 'none', label: '\u2013', discountPct };
}
