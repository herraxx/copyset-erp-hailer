import type { HailerApi, Activity } from '@hailer/app-sdk';
import {
  WF,
  TILAUKSET_FIELDS as OF,
  TILAUKSET_PHASES as OP,
  TILAUSRIVIT_FIELDS as ORF,
  LISATYOT_FIELDS as LF,
} from '../hailer/workspace-bindings';
import { listAllPhase } from './hailerData';
import { readLink } from './format';

/**
 * Duplicates an order into a new editable "Vahvistettu" order, copying
 * header fields, all line items, and their extras. Matches the reference's
 * `root.orderCommands.duplicate(id)` — used from both the order edit form
 * and the Arkisto (archive) list's "Kopioi uudeksi" action.
 */
export async function duplicateOrder(hailer: HailerApi, orderId: string): Promise<string> {
  const source = await hailer.activity.get(orderId);
  if (!source) throw new Error('Tilausta ei löytynyt.');

  const asiakasId = readLink(source.fields?.[OF.asiakas]).id;
  if (!asiakasId) throw new Error('Tilaukselta puuttuu asiakas.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {
    [OF.asiakas]: asiakasId,
    [OF.toimituspiv]: null,
    [OF.tuotannonDeadline]: null,
    [OF.projektinNimi]: source.fields?.[OF.projektinNimi] ?? null,
    [OF.toimitustapa]: source.fields?.[OF.toimitustapa] ?? 'Nouto',
    [OF.toimitusosoite]: source.fields?.[OF.toimitusosoite] ?? null,
    [OF.toimVastaanottaja]: source.fields?.[OF.toimVastaanottaja] ?? null,
    [OF.toimKatuosoite]: source.fields?.[OF.toimKatuosoite] ?? null,
    [OF.toimPostinumero]: source.fields?.[OF.toimPostinumero] ?? null,
    [OF.toimKaupunki]: source.fields?.[OF.toimKaupunki] ?? null,
    [OF.toimMaa]: source.fields?.[OF.toimMaa] ?? null,
    [OF.toimLisatiedot]: source.fields?.[OF.toimLisatiedot] ?? null,
    [OF.laskutusosoite]: source.fields?.[OF.laskutusosoite] ?? null,
    [OF.ytunnus]: source.fields?.[OF.ytunnus] ?? null,
    [OF.asiakkaanMaa]: source.fields?.[OF.asiakkaanMaa] ?? null,
    [OF.verkkolaskuosoite]: source.fields?.[OF.verkkolaskuosoite] ?? null,
    [OF.valittajatunnus]: source.fields?.[OF.valittajatunnus] ?? null,
    [OF.maksuehtoPv]: source.fields?.[OF.maksuehtoPv] ?? 21,
    [OF.alv]: source.fields?.[OF.alv] ?? 25.5,
    [OF.toimitushinta]: source.fields?.[OF.toimitushinta] ?? 0,
    [OF.aloitusmaksu]: source.fields?.[OF.aloitusmaksu] ?? 50,
    [OF.laskutuslisa]: source.fields?.[OF.laskutuslisa] ?? 6,
  };

  const created = await hailer.activity.create(WF.tilaukset, [{ name: 'TIL-' + Date.now(), fields }], { phaseId: OP.vahvistettu });
  const newId = Array.isArray(created) ? (created[0] as Activity)?._id : (created as unknown as Activity)?._id;
  if (!newId) throw new Error('Kopiointi epäonnistui.');

  const allLines = await listAllPhase(hailer, WF.tilausrivit, '6a9fde6e0429f4bd513ae3b4');
  const sourceLines = allLines.filter((l) => readLink(l.fields?.[ORF.tilaus]).id === orderId);
  const allExtras = await listAllPhase(hailer, WF.lisatyot, '6ab22888e066bd5d051623d2');

  for (const line of sourceLines) {
    const tuoteId = readLink(line.fields?.[ORF.tuote]).id;
    if (!tuoteId) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineFields: Record<string, any> = {
      [ORF.tilaus]: newId,
      [ORF.tuote]: tuoteId,
      [ORF.maara]: line.fields?.[ORF.maara] ?? 0,
      [ORF.yksikkohinta]: line.fields?.[ORF.yksikkohinta] ?? 0,
      [ORF.spesifikaatiot]: line.fields?.[ORF.spesifikaatiot] ?? null,
    };
    const createdLine = await hailer.activity.create(WF.tilausrivit, [{ name: readLink(line.fields?.[ORF.tuote]).name || 'Rivi', fields: lineFields }], {});
    const newLineId = Array.isArray(createdLine) ? (createdLine[0] as Activity)?._id : (createdLine as unknown as Activity)?._id;
    if (!newLineId) continue;

    const extras = allExtras.filter((e) => readLink(e.fields?.[LF.tilausrivi]).id === line._id);
    for (const extra of extras) {
      const nimi = extra.fields?.[LF.nimi];
      if (!nimi) continue;
      await hailer.activity.create(
        WF.lisatyot,
        [{ name: String(nimi), fields: { [LF.tilausrivi]: newLineId, [LF.nimi]: nimi, [LF.hinta]: extra.fields?.[LF.hinta] ?? 0 } }],
        {},
      );
    }
  }

  return newId;
}
