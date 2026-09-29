// Hand-written workspace bindings for CopySet ERP.
// The auto-codegen from `hailer-mcp bootstrap` targeted the wrong workspace
// in this environment (a restaurant-reservation workspace) — do NOT re-run
// codegen blindly; if you do, diff against this file before trusting it.
//
// Source of truth: workspace/enums.ts in the SDK project root.

export const workspaceId = '6a9fdd39e70f672af842080c';

export const WF = {
  asiakkaat: '6a9fde6e0429f4bd513ae37d',
  yhteyshenkilot: '6a9fde6e0429f4bd513ae384',
  tuoteryhmat: '6a9fde6e0429f4bd513ae38a',
  tuotteet: '6a9fde6e0429f4bd513ae390',
  hinnastot: '6a9fde6e0429f4bd513ae396',
  tuotehinnat: '6a9fde6e0429f4bd513ae39d',
  asiakashinnat: '6a9fde6e0429f4bd513ae3a3',
  alihankkijat: '6a9fde6e0429f4bd513ae3a9',
  tilaukset: '6a9fde6e0429f4bd513ae3af',
  tilausrivit: '6a9fde6e0429f4bd513ae3b5',
  tarjoukset: '6a9ff73d2921da91c45c866f',
  tarjousrivit: '6a9ff73d2921da91c45c8675',
  asetukset: '6a9ff73d2921da91c45c867b',
  lisatyot: '6ab22888e066bd5d051623d3',
  listyohinnasto: '6ab25f56a718a364baea9b33',
  tuotevalinnat: '6ab69060f0fa24a41131ec7e',
  painikkeet: '6ab69061f0fa24a41131eca8',
} as const;

export const ASIAKKAAT_FIELDS = {
  ytunnus: '6a9fdef8e70f672af84217c8',
  asiakasnumero: '6a9fdef8e70f672af84217cb',
  asiakasryhma: '6a9fdef8e70f672af84217ce',
  toimiala: '6a9fdef8e70f672af84217d1',
  kieli: '6a9fdef8e70f672af84217d4',
  hinnasto: '6a9fdef8e70f672af84217d7',
  yleinenAlennus: '6a9fdef8e70f672af84217dc',
  laskutusosoite: '6a9fdef8e70f672af84217df',
  toimitusosoite: '6a9fdef9e70f672af84217e2',
  puhelin: '6a9fdef9e70f672af84217e5',
  shkposti: '6a9fdef9e70f672af84217e8',
  muistiinpanot: '6a9fdef9e70f672af84217eb',
  maksuehtoPv: '6a9fdfb32921da91c45bbd79',
  osoite: '6aa17ec5d67c1324ccaac6c8',
  status: '6ab22e4f991a8feac7574d65',
  verkkolaskuosoite: '6ab22e4f991a8feac7574d68',
  valittajatunnus: '6ab22e4f991a8feac7574d6f',
} as const;

export const ASIAKKAAT_PHASES = {
  kaikki: '6a9fde6e0429f4bd513ae37c',
} as const;

export const YHTEYSHENKILOT_FIELDS = {
  asiakas: '6a9fdefae70f672af8421868',
  shkposti: '6a9fdefae70f672af842186d',
  puhelin: '6a9fdefae70f672af8421870',
  rooliTitteli: '6a9fdefae70f672af8421874',
  kieli: '6a9fdefbe70f672af8421879',
  markkinointilupa: '6a9fdefbe70f672af842187c',
} as const;

export const TUOTERYHMAT_FIELDS = {
  kuvaus: '6a9fdefae70f672af8421848',
} as const;

export const TUOTTEET_FIELDS = {
  tuoteryhma: '6a9fdefae70f672af842184b',
  perushinta: '6a9fdefae70f672af842184e',
  aloituskustannus: '6a9fdefae70f672af8421851',
  arvioituTyoaikaMin: '6a9fdefae70f672af8421855',
  oletustoimitustapa: '6a9fdefae70f672af8421858',
  oletusalihankkija: '6a9fdefae70f672af842185c',
  aktiivinen: '6a9fdefae70f672af842185f',
  kuvaus: '6a9fdefae70f672af8421862',
  seurataanVarastoa: '6aa0419ccad478e8de81bdcb',
  varastomaara: '6aa0419ccad478e8de81bdce',
  halytysraja: '6aa0419ccad478e8de81bdd1',
  yksikko: '6aa0419ccad478e8de81bdd4',
  kustannushinta: '6aa0514711a3656851f4465c',
  kustannusosuus: '6ab6904beae1d71a4c741a21',
} as const;

export const HINNASTOT_FIELDS = {
  kuvaus: '6a9fdef9e70f672af84217ee',
  oletushinnasto: '6a9fdef9e70f672af84217f1',
} as const;

export const HINNASTOT_PHASES = {
  kaikki: '6a9fde6e0429f4bd513ae395',
} as const;

export const TUOTEHINNAT_FIELDS = {
  hinnasto: '6a9fdefae70f672af842183c',
  tuote: '6a9fdefae70f672af842183f',
  yksikkohinta: '6a9fdefae70f672af8421844',
  maaraAlkaenKpl: '6a9fdf1119aab6369cc50d5a',
  kokonaishinta: '6ab6a936eae1d71a4c776d25',
} as const;

export const TUOTEHINNAT_PHASES = {
  kaikki: '6a9fde6e0429f4bd513ae39c',
} as const;

export const ASIAKASHINNAT_FIELDS = {
  asiakas: '6a9fdef8e70f672af84217b9',
  tuote: '6a9fdef8e70f672af84217bc',
  sopimushinta: '6a9fdef8e70f672af84217bf',
  voimassaAlkaen: '6a9fdef8e70f672af84217c2',
  muistiinpano: '6a9fdef8e70f672af84217c5',
} as const;

export const ASIAKASHINNAT_PHASES = {
  kaikki: '6a9fde6e0429f4bd513ae3a2',
} as const;

export const ALIHANKKIJAT_FIELDS = {
  yhteyshenkilo: '6a9fdef8e70f672af84217a8',
  shkposti: '6a9fdef8e70f672af84217ab',
  puhelin: '6a9fdef8e70f672af84217af',
  palvelu: '6a9fdef8e70f672af84217b2',
  oletuskustannus: '6a9fdef8e70f672af84217b6',
} as const;

export const TILAUKSET_FIELDS = {
  asiakas: '6a9fdef9e70f672af84217f4',
  yhteyshenkilo: '6a9fdef9e70f672af84217f9',
  lahde: '6a9fdef9e70f672af84217fd',
  prioriteetti: '6a9fdef9e70f672af8421802',
  toimituspiv: '6a9fdef9e70f672af8421805',
  toimitustapa: '6a9fdef9e70f672af8421808',
  asiakkaanViitePo: '6a9fdef9e70f672af842180b',
  toimitusosoite: '6a9fdef9e70f672af8421812',
  laskutusosoite: '6a9fdef9e70f672af8421815',
  seurantatunnus: '6a9fdef9e70f672af8421818',
  sisisetMuistiinpanot: '6a9fdef9e70f672af842181b',
  maksuehtoPv: '6a9fdf1019aab6369cc50d24',
  alv: '6a9fdf1019aab6369cc50d27',
  myyntiYhteensa: '6a9fe0449a9ad12d5dd1a294',
  kustannusYhteensa: '6a9fe0449a9ad12d5dd1a298',
  kate: '6a9fe06319aab6369cc51417',
  kateProsentti: '6a9fe06419aab6369cc5141a',
  tilausrivitLinkedfrom: '6aa017770429f4bd513d0b7a',
  muutettuTuotannonJalkeen: '6aa04101cad478e8de81b90a',
  tilausvahvistusLahetetty: '6aa16acdf92c04f95f91c878',
  tuotannonDeadline: '6ab229bc6b37e6b380b4dfcb',
  projektinNimi: '6ab229bc6b37e6b380b4dfce',
  tuotanto: '6ab229bd6b37e6b380b4dfd1',
  alihankkija: '6ab229bd6b37e6b380b4dfd4',
  toimitushinta: '6ab229bd6b37e6b380b4dfd7',
  aloitusmaksu: '6ab229bd6b37e6b380b4dfda',
  laskutuslisa: '6ab229bd6b37e6b380b4dfdd',
  nettoYhteensa: '6ab229bd6b37e6b380b4dfe0',
  alvMaara: '6ab229bd6b37e6b380b4dfe3',
  loppusumma: '6ab229be6b37e6b380b4dfe7',
  maksutapaKateiskuitti: '6ab229be6b37e6b380b4dfea',
  tilauspaiva: '6ab3ea70ca02da30f19011a1',
  ytunnus: '6ab3ea70ca02da30f19011a4',
  asiakkaanMaa: '6ab3ea70ca02da30f19011a7',
  verkkolaskuosoite: '6ab3ea70ca02da30f19011aa',
  valittajatunnus: '6ab3ea70ca02da30f19011ad',
  toimVastaanottaja: '6ab3ea70ca02da30f19011b1',
  toimKatuosoite: '6ab3ea71ca02da30f19011b5',
  toimPostinumero: '6ab3ea71ca02da30f19011b8',
  toimKaupunki: '6ab3ea71ca02da30f19011bb',
  toimMaa: '6ab3ea71ca02da30f19011bf',
  toimLisatiedot: '6ab3ea71ca02da30f19011c2',
  toteumaMateriaalit: '6ab690fb3013c7328bc0b901',
  toteumaTyo: '6ab690fb3013c7328bc0b905',
  toteumaAlihankinta: '6ab690fb3013c7328bc0b908',
  toteumaMuut: '6ab690fb3013c7328bc0b90b',
} as const;

// Exact 5-stage flow (matches the reference implementation) plus a justified
// "Peruttu" (cancel) terminal phase — the reference hard-deletes cancelled
// orders, which is unsafe for real accounting records, so cancellation here
// is a non-destructive phase move instead.
export const TILAUKSET_PHASES = {
  vahvistettu: '6a9fdfe319aab6369cc511ca',
  tuotannossa: '6a9fdfe319aab6369cc511d3',
  valmis: '6a9fdfe319aab6369cc511dc',
  laskutusvalmis: '6ab22ac00a6c5337c16d94b6',
  laskutettu: '6a9fdfe319aab6369cc511ee',
  peruttu: '6a9fdfe419aab6369cc51200',
} as const;

export const TILAUSRIVIT_FIELDS = {
  tilaus: '6a9fdef9e70f672af842181e',
  tuote: '6a9fdef9e70f672af8421821',
  maara: '6a9fdef9e70f672af8421824',
  yksikkohinta: '6a9fdef9e70f672af8421827',
  yksikkokustannus: '6a9fdefae70f672af842182a',
  alihankkija: '6a9fdefae70f672af842182d',
  arvioituTyoaikaMin: '6a9fdefae70f672af8421830',
  prioriteetti: '6a9fdefae70f672af8421833',
  toimituspiv: '6a9fdefae70f672af8421836',
  spesifikaatiot: '6a9fdefae70f672af8421839',
  rivinHinta: '6a9fe0255182163a53a7a100',
  rivinKustannus: '6a9fe0255182163a53a7a103',
  lisatyotYhteensa: '6ab228c7991a8feac7570861',
  lisatyotKuvaus: '6ab228c8991a8feac7570865',
} as const;

export const TILAUSRIVIT_PHASES = {
  odottaa: '6a9fde6e0429f4bd513ae3b4',
  tyossa: '6a9fdfe419aab6369cc5120e',
  valmis: '6a9fdfe419aab6369cc5121c',
  peruttu: '6a9fdfe419aab6369cc51226',
} as const;

export const TARJOUKSET_FIELDS = {
  asiakas: '6a9ff774cad478e8de7fce50',
  yhteyshenkilo: '6a9ff774cad478e8de7fce53',
  voimassaAsti: '6a9ff774cad478e8de7fce56',
  maksuehtoPv: '6a9ff774cad478e8de7fce59',
  alv: '6a9ff774cad478e8de7fce5c',
  ehdotJaHuomiot: '6a9ff774cad478e8de7fce5f',
  sisisetMuistiinpanot: '6a9ff774cad478e8de7fce62',
  asiakkaanViesti: '6a9ff774cad478e8de7fce65',
  yhteensa: '6a9ff7c00429f4bd513c1d1b',
  tarjousrivitLinkedfrom: '6aa017770429f4bd513d0b77',
  toimitustapa: '6ab229bb6b37e6b380b4dfa0',
  toimitusosoitteet: '6ab229bb6b37e6b380b4dfa3',
  tuotanto: '6ab229bb6b37e6b380b4dfa6',
  alihankkija: '6ab229bb6b37e6b380b4dfa9',
  toimituspiv: '6ab229bb6b37e6b380b4dfac',
  tuotannonDeadline: '6ab229bb6b37e6b380b4dfaf',
  projektinNimi: '6ab229bb6b37e6b380b4dfb2',
  asiakkaanReferenssi: '6ab229bc6b37e6b380b4dfb6',
  toimitushinta: '6ab229bc6b37e6b380b4dfb9',
  aloitusmaksu: '6ab229bc6b37e6b380b4dfbc',
  laskutuslisa: '6ab229bc6b37e6b380b4dfbf',
  nettoYhteensa: '6ab229bc6b37e6b380b4dfc2',
  alvMaara: '6ab229bc6b37e6b380b4dfc5',
  loppusumma: '6ab229bc6b37e6b380b4dfc8',
  luotuTilaus: '6ab3e141c581290c3aee32d4',
  tarjouspaiva: '6ab3ea70ca02da30f190117d',
  laskutusosoite: '6ab3ea70ca02da30f1901180',
  ytunnus: '6ab3ea70ca02da30f1901183',
  asiakkaanMaa: '6ab3ea70ca02da30f1901186',
  verkkolaskuosoite: '6ab3ea70ca02da30f1901189',
  valittajatunnus: '6ab3ea70ca02da30f190118c',
  toimVastaanottaja: '6ab3ea70ca02da30f190118f',
  toimKatuosoite: '6ab3ea70ca02da30f1901192',
  toimPostinumero: '6ab3ea70ca02da30f1901195',
  toimKaupunki: '6ab3ea70ca02da30f1901198',
  toimMaa: '6ab3ea70ca02da30f190119b',
  toimLisatiedot: '6ab3ea70ca02da30f190119e',
} as const;

// Exact 5-stage flow matching the reference implementation:
// Luonnos → Valmis lähetettäväksi → Lähetetty → Hyväksytty / Hylätty
export const TARJOUKSET_PHASES = {
  luonnos: '6a9ff73d2921da91c45c866e',
  valmisLahetettavaksi: '6ab22abd0a6c5337c16d949e',
  lahetetty: '6a9ff7785182163a53a84277',
  hyvaksytty: '6a9ff7785182163a53a84292',
  hylatty: '6a9ff7795182163a53a8429b',
} as const;

export const TARJOUSRIVIT_FIELDS = {
  tarjous: '6a9ff774cad478e8de7fce68',
  tuote: '6a9ff774cad478e8de7fce6b',
  maara: '6a9ff774cad478e8de7fce6e',
  yksikkohinta: '6a9ff774cad478e8de7fce71',
  vaihtoehdonNimi: '6a9ff774cad478e8de7fce74',
  asiakkaanValitsema: '6a9ff774cad478e8de7fce77',
  spesifikaatiot: '6a9ff774cad478e8de7fce7a',
  rivinHinta: '6a9ff7a49a9ad12d5dd2c905',
  lisatyotYhteensa: '6ab228c6991a8feac7570828',
  lisatyotKuvaus: '6ab228c7991a8feac757084c',
} as const;

export const TARJOUSRIVIT_PHASES = {
  kaikki: '6a9ff73d2921da91c45c8674',
} as const;

export const ASETUKSET_FIELDS = {
  yrityksenNimi: '6a9ff774cad478e8de7fce32',
  ytunnus: '6a9ff774cad478e8de7fce35',
  osoite: '6a9ff774cad478e8de7fce38',
  puhelin: '6a9ff774cad478e8de7fce3d',
  shkposti: '6a9ff774cad478e8de7fce40',
  verkkosivu: '6a9ff774cad478e8de7fce44',
  oletusAlv: '6a9ff774cad478e8de7fce47',
  oletusmaksuehtoPv: '6a9ff774cad478e8de7fce4a',
  brandivarinHexKoodi: '6a9ff774cad478e8de7fce4d',
  oletusAloitusmaksu: '6ab22a6b6b37e6b380b4e562',
  oletusLaskutuslisa: '6ab22a6b6b37e6b380b4e565',
  vientiAlvVaihtoehto: '6ab22a6b6b37e6b380b4e579',
  iban: '6ab6904aeae1d71a4c7419d6',
  bic: '6ab6904aeae1d71a4c7419da',
  tuntikustannus: '6ab6904aeae1d71a4c7419dd',
  oletusKustannusosuus: '6ab6904aeae1d71a4c7419e1',
  lisatoidenKustannusosuus: '6ab6904aeae1d71a4c7419e5',
  oletuskate: '6ab6904aeae1d71a4c7419e8',
  tarjouksenVoimassaoloPv: '6ab6904beae1d71a4c7419ed',
  variOranssi: '6ab6904beae1d71a4c7419f1',
  variKeltainen: '6ab6904beae1d71a4c7419f5',
  variVihrea: '6ab6904beae1d71a4c7419f9',
  variSininen: '6ab6904beae1d71a4c7419fd',
  variVioletti: '6ab6904beae1d71a4c741a01',
  variHarmaa: '6ab6904beae1d71a4c741a05',
  variValkoinen: '6ab6904beae1d71a4c741a09',
  variPunainen: '6ab6904beae1d71a4c741a0d',
  taustaSivu: '6ab6904beae1d71a4c741a10',
  taustaYlavalikko: '6ab6904beae1d71a4c741a15',
  taustaKortti: '6ab6904beae1d71a4c741a1b',
} as const;

/** Tone key -> Asetukset field id, in the exact order the reference's admin page groups them. */
export const TONE_FIELD_ORDER: { tone: ToneKey; field: string; defaultHex: string }[] = [
  { tone: 'Oranssi', field: '6ab6904beae1d71a4c7419f1', defaultHex: '#F7941D' },
  { tone: 'Keltainen', field: '6ab6904beae1d71a4c7419f5', defaultHex: '#FFD95A' },
  { tone: 'Vihreä', field: '6ab6904beae1d71a4c7419f9', defaultHex: '#8FD19E' },
  { tone: 'Sininen', field: '6ab6904beae1d71a4c7419fd', defaultHex: '#9CCBEF' },
  { tone: 'Violetti', field: '6ab6904beae1d71a4c741a01', defaultHex: '#C9B6EA' },
  { tone: 'Harmaa', field: '6ab6904beae1d71a4c741a05', defaultHex: '#E4E2DE' },
  { tone: 'Valkoinen', field: '6ab6904beae1d71a4c741a09', defaultHex: '#FFFFFF' },
  { tone: 'Punainen', field: '6ab6904beae1d71a4c741a0d', defaultHex: '#B3261E' },
];

export type ToneKey = 'Oranssi' | 'Keltainen' | 'Vihreä' | 'Sininen' | 'Violetti' | 'Harmaa' | 'Valkoinen' | 'Punainen';

export const ASETUKSET_PHASES = {
  kaikki: '6a9ff73d2921da91c45c867a',
} as const;

export const LISATYOT_FIELDS = {
  tarjousrivi: '6ab2289c7375af1afc6445d4',
  tilausrivi: '6ab2289c7375af1afc6445d9',
  nimi: '6ab2289c7375af1afc6445e0',
  hinta: '6ab2289c7375af1afc6445e4',
} as const;

export const LISTYOHINNASTO_FIELDS = {
  oletushinta: '6ab25f78a718a364baea9ca8',
  hinnoittelutapa: '6ab690fb3013c7328bc0b8f9',
  tuoteryhma: '6ab690fb3013c7328bc0b8fc',
} as const;

export const LISTYOHINNASTO_PHASES = {
  kaikki: '6ab25f56a718a364baea9b32',
} as const;

export const TUOTEVALINNAT_FIELDS = {
  tuoteryhma: '6ab69090f0fa24a41131f513',
  ryhmanNimi: '6ab69090f0fa24a41131f518',
  kohdekentta: '6ab69090f0fa24a41131f51b',
  vaihtoehdonNimi: '6ab69090f0fa24a41131f520',
  tapa: '6ab69090f0fa24a41131f533',
  arvo: '6ab69090f0fa24a41131f539',
  jarjestys: '6ab69090f0fa24a41131f53c',
  oletusvalinta: '6ab69090f0fa24a41131f540',
} as const;

export const TUOTEVALINNAT_PHASES = {
  kaikki: '6ab69060f0fa24a41131ec7d',
} as const;

export const PAINIKKEET_FIELDS = {
  avain: '6ab6908ff0fa24a41131f4ec',
  selite: '6ab69090f0fa24a41131f4f0',
  ryhma: '6ab69090f0fa24a41131f4f4',
  vari: '6ab69090f0fa24a41131f500',
  jarjestys: '6ab69090f0fa24a41131f50f',
} as const;

export const PAINIKKEET_PHASES = {
  kaikki: '6ab69061f0fa24a41131eca6',
} as const;

export const HAILER_MEMBERS = {
  workspace: 'network_6a9fdd39e70f672af842080c',
  johanWickholm: 'user_663a2456ecfe839f4ddfbdb5',
  robertBroman: 'user_68a2bea86cc0abe93f8a3506',
  olliHouttu: 'user_6152b283de51db02c1714525',
} as const;

// Document template ids (Tilaukset workflow) — resolve by NAME at runtime via
// hailer.workflow.list()/get(), these are fallbacks only.
export const TEMPLATE_NAMES = {
  tarjous: 'Tarjous',
  tilausvahvistus: 'Tilausvahvistus',
  tyokortti: 'Työkortti',
  lahetyslappu: 'Lähetyslappu',
  lahete: 'Lähete',
  laskunTarkastus: 'Laskun tarkastus',
  kateiskuitti: 'Käteiskuitti',
} as const;
