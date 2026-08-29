/* CUSTOM+ portal-configuratie.
   Leeg laten = demomodus: de portal en het beheer draaien dan volledig op
   voorbeelddata (portal/demo-data.js) met wijzigingen in localStorage, zodat
   alles lokaal en op de live site te proberen is zonder Supabase-project.
   Zodra het Supabase-project bestaat: vul beide velden en de apps schakelen
   automatisch over op echte auth, echte data en signed URLs.

   notifySharedSecret: alleen nodig als je klantmeldingen per e-mail aan wilt
   zetten (zie netlify/functions/notify-client.mjs). Moet EXACT gelijk zijn
   aan de NOTIFY_SHARED_SECRET env var op Netlify. Dit bestand staat in de
   publieke site — dit is dus geen echt geheim, alleen een drempel tegen
   toevallig misbruik van de mailfunctie. Laat leeg om klantmeldingen uit te
   zetten (werkt ook los van de Supabase-velden hierboven). */
window.CP_PORTAL_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  notifySharedSecret: ''
};

/* Indicatieve planning per fase, in weken vanaf projectstart (De Weeklijn).
   Alleen gebruikt voor de gestippelde toekomst op de tijdlijn in portal.html
   en daar expliciet gelabeld als indicatie — echte datums komen uitsluitend
   uit goedgekeurde fases (approvedAt), nooit uit deze tabel. */
window.CP_PLANNED_WEEKS = {
  concept:    [0, 2],
  dfm:        [2, 5],
  sourcing:   [4, 6],
  tooling:    [6, 14],
  production: [14, 20],
  logistics:  [20, 24]
};

/* Acceptatiegetallen (Ac) uit de gepubliceerde ANSI/ASQ Z1.4-tabel,
   algemeen keuringsniveau II, AQL 2,5 — enkelvoudige steekproef, normale
   keuring. Dit is standaard normdata, geen eigen cijfers; gebruikt door
   het kwaliteitspaneel in portal.html ("Kwaliteit in Beeld"). Bij een
   steekproefomvang tussen twee brackets geldt de dichtstbijzijnde
   tabelwaarde (8 → 0 is zo'n dichtstbijzijnde waarde). */
window.CP_AQL_ACCEPT = [
  { size: 8,   accept: 0 },
  { size: 13,  accept: 1 },
  { size: 20,  accept: 1 },
  { size: 32,  accept: 2 },
  { size: 50,  accept: 3 },
  { size: 80,  accept: 5 },
  { size: 125, accept: 7 },
  { size: 200, accept: 10 },
  { size: 315, accept: 14 },
  { size: 500, accept: 21 }
];

/* Vaktaal Uitgelegd: de termen die in het portaal voorkomen, met een
   korte NL-uitleg voor de popover in portal.html. De "Lees meer"-link
   opent de glossary op de hoofdsite in een nieuw tabblad; termen die
   daar (nog) geen eigen anker hebben linken naar de glossarypagina
   zelf. `pattern` is optioneel en alleen nodig als de term ook met
   een andere schrijfwijze voorkomt (zoals "golden sample"). */
window.CP_GLOSSARY = [
  { id: 'aql', term: 'AQL', full: 'Acceptable Quality Limit', url: 'custom-plus.html#/glossary#term-aql',
    def: 'De statistische norm die bepaalt hoeveel afwijkingen een steekproef mag bevatten voordat de hele batch wordt afgekeurd. Elke inspectie in je portaal wordt tegen deze norm gemeten.' },
  { id: 'nnn', term: 'NNN', full: 'Non Disclosure, Non Use, Non Circumvention', url: 'custom-plus.html#/glossary#term-nnn',
    def: 'Een contract dat is opgesteld om afdwingbaar te zijn bij Chinese rechtbanken, getekend vóór er één bestand de deur uit gaat. Een westerse NDA alleen is dat in de praktijk vaak niet.' },
  { id: 'dfm', term: 'DFM', full: 'Design For Manufacturability', url: 'custom-plus.html#/glossary#term-dfm',
    def: 'De stap waarin je ontwerp wordt getoetst aan het productieproces dat het echt gaat maken, vóór er tooling wordt besteld. Een mooi CAD bestand en een maakbaar onderdeel zijn niet hetzelfde.' },
  { id: 'moq', term: 'MOQ', full: 'Minimum Order Quantity', url: 'custom-plus.html#/glossary#term-moq',
    def: 'De kleinste oplage die een fabriek wil draaien. Voor spuitgietwerk ligt die doorgaans hoger dan voor CNC of plaatwerk, omdat de mal moet worden terugverdiend.' },
  { id: 'iqc', term: 'IQC', full: 'Incoming Quality Control', url: 'custom-plus.html#/glossary#term-iqc',
    def: 'De controle van binnenkomend materiaal vóórdat de productie start, zodat een afwijking in de grondstof nooit een hele run kan raken.' },
  { id: 'ipqc', term: 'IPQC', full: 'In Process Quality Control', url: 'custom-plus.html#/glossary#term-ipqc',
    def: 'Controles tijdens de productierun zelf, niet pas aan het einde — zo wordt een afwijking gevonden terwijl die nog goedkoop te herstellen is.' },
  { id: 'fqc', term: 'FQC', full: 'Final Quality Control', url: 'custom-plus.html#/glossary#term-fqc',
    def: 'De eindcontrole op de afgeronde batch, vlak vóór verzending, gemeten tegen hetzelfde golden sample waarmee de run begon.' },
  { id: 't0', term: 'T0', full: 'Eerste proefronde uit de mal', url: 'custom-plus.html#/glossary',
    def: 'Het allereerste schot uit een nieuwe mal. Een T0 is zelden meteen goed — deze ronde laat zien wat er aan de mal moet worden bijgesteld.' },
  { id: 't1', term: 'T1', full: 'Tweede proefronde, na bijstelling', url: 'custom-plus.html#/glossary',
    def: 'De sampleronde na de eerste bijstelling van de mal. Elke volgende ronde brengt het sample dichter bij het exemplaar dat jij goedkeurt.' },
  { id: 't2', term: 'T2', full: 'Derde proefronde, na verfijning', url: 'custom-plus.html#/glossary',
    def: 'De ronde na de tweede bijstelling, vaak de laatste verfijning zoals polijstwerk aan de mal. Keur jij deze goed, dan wordt dit exemplaar meestal het golden sample.' },
  { id: 'golden-sample', term: 'Golden sample', pattern: '[Gg]olden sample', url: 'custom-plus.html#/glossary',
    full: 'Het goedgekeurde referentiesample',
    def: 'Het sample dat jij goedkeurt als dé standaard. Elke inspectie tijdens de productie meet de batch tegen precies dit exemplaar — niet tegen een gevoel.' },
  { id: 'bl', term: 'B/L', full: 'Bill of Lading', url: 'custom-plus.html#/glossary',
    def: 'Het officiële vervoersdocument van een zeevracht: het bewijs dat de lading aan boord is én het document waarmee de container op de bestemming wordt vrijgegeven.' }
];

/* Vaste stadscoördinaten voor "Fabriek op de Kaart": x/y in de viewBox
   (0 0 600 520) van de vereenvoudigde China-kaart in portal.html.
   Bewust alleen stadsniveau — nooit een adres. Het fabrieksbeheer in
   beheer.html kiest uit precies deze lijst. */
window.CP_CITY_COORDS = {
  'Dongguan':  { x: 388, y: 433 },
  'Shenzhen':  { x: 391, y: 439 },
  'Guangzhou': { x: 384, y: 432 },
  'Ningbo':    { x: 459, y: 342 },
  'Shanghai':  { x: 458, y: 324 },
  'Yiwu':      { x: 445, y: 349 },
  'Xiamen':    { x: 427, y: 414 },
  'Qingdao':   { x: 448, y: 259 }
};
