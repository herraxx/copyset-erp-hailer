import type { HailerApi, Activity } from '@hailer/app-sdk';
import {
  WF,
  TARJOUKSET_FIELDS as TF,
  TARJOUKSET_PHASES as TP,
  TARJOUSRIVIT_FIELDS as TRF,
  TILAUKSET_FIELDS as OF,
  TILAUKSET_PHASES as OP,
  TILAUSRIVIT_FIELDS as ORF,
  LISATYOT_FIELDS as LF,
} from '../hailer/workspace-bindings';
import { listAllPhase } from './hailerData';
import { readLink } from './format';

/**
 * Creates exactly one linked order from an approved offer, copying header
 * fields and all line items + extra work. Guards against duplicates via the
 * offer's own "Luotu tilaus" link field (the offer's phase stays Hyväksytty
 * throughout — matches the reference, which never has a separate
 * "converted" status). Pass startProduction=true for the reference's
 * "Hyväksy ja aloita tuotanto heti" choice: the new order is created
 * straight into Tuotannossa/Aloitettu instead of Vahvistettu.
 */
export async function createOrderFromOffer(hailer: HailerApi, offerId: string, startProduction = false): Promise<string> {
  const offer = await hailer.activity.get(offerId);
  if (!offer) throw new Error('Tarjousta ei löytynyt.');
  if (readLink(offer.fields?.[TF.luotuTilaus]).id) {
    throw new Error('Tästä tarjouksesta on jo luotu tilaus.');
  }
  if (offer.currentPhase !== TP.hyvaksytty) {
    throw new Error('Tilaus voidaan luoda vain hyväksytystä tarjouksesta.');
  }

  const asiakasId = readLink(offer.fields?.[TF.asiakas]).id;
  if (!asiakasId) throw new Error('Tarjoukselta puuttuu asiakas.');

  const orderFields: Record<string, any> = {
    [OF.asiakas]: asiakasId,
    [OF.tilauspaiva]: new Date().toISOString().slice(0, 10),
    [OF.toimituspiv]: offer.fields?.[TF.toimituspiv] ?? null,
    [OF.toimitustapa]: offer.fields?.[TF.toimitustapa] ?? 'Nouto',
    [OF.toimitusosoite]: offer.fields?.[TF.toimitusosoitteet] ?? null,
    [OF.toimVastaanottaja]: offer.fields?.[TF.toimVastaanottaja] ?? null,
    [OF.toimKatuosoite]: offer.fields?.[TF.toimKatuosoite] ?? null,
    [OF.toimPostinumero]: offer.fields?.[TF.toimPostinumero] ?? null,
    [OF.toimKaupunki]: offer.fields?.[TF.toimKaupunki] ?? null,
    [OF.toimMaa]: offer.fields?.[TF.toimMaa] ?? null,
    [OF.toimLisatiedot]: offer.fields?.[TF.toimLisatiedot] ?? null,
    [OF.laskutusosoite]: offer.fields?.[TF.laskutusosoite] ?? null,
    [OF.ytunnus]: offer.fields?.[TF.ytunnus] ?? null,
    [OF.asiakkaanMaa]: offer.fields?.[TF.asiakkaanMaa] ?? null,
    [OF.verkkolaskuosoite]: offer.fields?.[TF.verkkolaskuosoite] ?? null,
    [OF.valittajatunnus]: offer.fields?.[TF.valittajatunnus] ?? null,
    [OF.maksuehtoPv]: offer.fields?.[TF.maksuehtoPv] ?? 21,
    [OF.alv]: offer.fields?.[TF.alv] ?? 25.5,
    [OF.asiakkaanViitePo]: offer.fields?.[TF.asiakkaanReferenssi] ?? null,
    [OF.sisisetMuistiinpanot]: offer.fields?.[TF.sisisetMuistiinpanot] ?? null,
    [OF.tuotannonDeadline]: offer.fields?.[TF.tuotannonDeadline] ?? null,
    [OF.projektinNimi]: offer.fields?.[TF.projektinNimi] ?? null,
    [OF.tuotanto]: offer.fields?.[TF.tuotanto] ?? 'Copy-Set',
    [OF.toimitushinta]: offer.fields?.[TF.toimitushinta] ?? 0,
    [OF.aloitusmaksu]: offer.fields?.[TF.aloitusmaksu] ?? 50,
    [OF.laskutuslisa]: offer.fields?.[TF.laskutuslisa] ?? 6,
  };
  const yhteyshenkiloId = readLink(offer.fields?.[TF.yhteyshenkilo]).id;
  if (yhteyshenkiloId) orderFields[OF.yhteyshenkilo] = yhteyshenkiloId;
  const alihankkijaId = readLink(offer.fields?.[TF.alihankkija]).id;
  if (alihankkijaId) orderFields[OF.alihankkija] = alihankkijaId;

  const createdOrder = await hailer.activity.create(WF.tilaukset, [{ name: 'TIL-' + Date.now(), fields: orderFields }], {
    phaseId: startProduction ? OP.tuotannossa : OP.vahvistettu,
  });
  const orderId = Array.isArray(createdOrder) ? (createdOrder[0] as Activity)?._id : (createdOrder as unknown as Activity)?._id;
  if (!orderId) throw new Error('Tilauksen luonti epäonnistui.');

  // Copy line items + extra work.
  const allLines = await listAllPhase(hailer, WF.tarjousrivit, '6a9ff73d2921da91c45c8674');
  const offerLines = allLines.filter((l) => readLink(l.fields?.[TRF.tarjous]).id === offerId);
  const allExtras = await listAllPhase(hailer, WF.lisatyot, '6ab22888e066bd5d051623d2');

  for (const line of offerLines) {
    const tuoteId = readLink(line.fields?.[TRF.tuote]).id;
    if (!tuoteId) continue;
    const orderLineFields: Record<string, any> = {
      [ORF.tilaus]: orderId,
      [ORF.tuote]: tuoteId,
      [ORF.maara]: line.fields?.[TRF.maara] ?? 0,
      [ORF.yksikkohinta]: line.fields?.[TRF.yksikkohinta] ?? 0,
      [ORF.spesifikaatiot]: line.fields?.[TRF.spesifikaatiot] ?? null,
    };
    const createdOrderLine = await hailer.activity.create(
      WF.tilausrivit,
      [{ name: readLink(line.fields?.[TRF.tuote]).name || 'Rivi', fields: orderLineFields }],
      {},
    );
    const orderLineId = Array.isArray(createdOrderLine) ? (createdOrderLine[0] as Activity)?._id : (createdOrderLine as unknown as Activity)?._id;
    if (!orderLineId) continue;

    const extras = allExtras.filter((e) => readLink(e.fields?.[LF.tarjousrivi]).id === line._id);
    for (const extra of extras) {
      const nimi = extra.fields?.[LF.nimi];
      if (!nimi) continue;
      await hailer.activity.create(
        WF.lisatyot,
        [{ name: String(nimi), fields: { [LF.tilausrivi]: orderLineId, [LF.nimi]: nimi, [LF.hinta]: extra.fields?.[LF.hinta] ?? 0 } }],
        {},
      );
    }
  }

  // Link the created order back onto the offer — this is what prevents a
  // second order from being created from the same offer (checked at the top
  // of this function) and what powers "Avaa tilaus" later. The offer's own
  // phase stays Hyväksytty, matching the reference exactly.
  await hailer.activity.update([{ _id: offerId, fields: { [TF.luotuTilaus]: orderId } }], {});

  return orderId;
}
