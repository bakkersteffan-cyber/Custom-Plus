/* CUSTOM+ — het factuursjabloon (portal/invoice-pdf.js).
   ------------------------------------------------------------------
   Wat hier wordt bewaakt, in volgorde van belangrijkheid:

     1. VERSIE-VASTHEID. Een bewaarde PDF verandert niet als de huisstijl
        verandert. Dat is geen stijlkwestie maar een administratieve: de
        klant heeft een bestand gekregen en dát bestand moet je over drie
        jaar nog kunnen laten zien. De test doet precies wat de applicatie
        doet — genereren, bewaren, huisstijl omzetten — en kijkt daarna of
        de bewaarde bytes nog letterlijk dezelfde zijn.
     2. GELD. Alles komt als gehele centen binnen en gaat als tekst naar
        buiten. Er wordt in dit bestand niet gerekend, dus de test kijkt of
        er ook echt niets wordt verrekend: 123456 centen is € 1.234,56 en
        niets anders, in elke taal.
     3. HET VEL. Staan de verplichte vermeldingen erop, wikkelen lange
        omschrijvingen, klopt de paginatelling bij 60 regels, en zeggen de
        voetteksten het juiste totaal.
     4. TAAL. Elke bronstring die dit bestand op het klantvel zet, bestaat
        in alle vier de woordenboeken.

   De snapshots komen uit de ECHTE rekenkern en de ECHTE snapshotbouwer —
   geen handgeschreven testfixture. Zou er in invoice-core iets wijzigen aan
   de vorm van een regel, dan valt dat hier om.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-finalize.js';
import '../portal/pdf.js';
import '../portal/invoice-pdf.js';

const core = globalThis.CP_INVOICE;
const FINAL = globalThis.CP_INVOICE_FINAL;
const PDF = globalThis.CP_PDF;
const TPL = globalThis.CP_INVOICE_PDF;

/* de browserlaag nabootsen, precies zoals test/i18n-invoice.test.mjs doet:
   qr.js en i18n.js zetten zichzelf op window */
const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
if (!hadWindow) globalThis.window = globalThis;
await import('../portal/qr.js');
await import('../portal/i18n.js');
const dicts = globalThis.CP_PORTAL_I18N;
const QR = globalThis.CP_QR;
if (!hadWindow) delete globalThis.window;

function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
function pageCount(bytes) {
  return (latin1(bytes).match(/\/Type \/Page[^s]/g) || []).length;
}

const SELLER = {
  name: 'CUSTOM+', address: 'Keizersgracht 1\n1015 CJ Amsterdam',
  registrationNumber: '87654321', vatNumber: 'NL003456789B01',
  email: 'hallo@customplus.nl', iban: 'NL91ABNA0417164300', bic: 'ABNANL2A'
};
const BUYER = {
  name: 'Atelier Noord BV', tradeName: 'Atelier Noord', contactName: 'Marieke de Vries',
  email: 'facturen@atelier-noord.nl', address: 'Havenstraat 44\n9711 AB Groningen',
  registrationNumber: '12345678', vatNumber: 'NL001234567B01'
};

/* een snapshot zoals het definitief maken hem vastlegt */
function maakSnapshot(opts = {}) {
  const n = opts.lineCount === undefined ? 3 : opts.lineCount;
  const lines = [];
  if (opts.heading) lines.push({ type: 'heading', description: 'Ontwerp en engineering' });
  for (let i = 0; i < n; i++) {
    lines.push({
      type: 'item',
      description: opts.longText
        ? 'Zeer uitgebreide omschrijving nummer ' + (i + 1) + ' die met zekerheid over meerdere regels moet wikkelen zonder de kolom met bedragen te raken'
        : 'Regel ' + (i + 1),
      detail: i === 0 ? 'Met een detailregel eronder' : '',
      quantity: '2', unit: 'stuk', unitPrice: '100,00',
      discountType: 'none', taxCode: opts.taxCode || 'NL21'
    });
  }
  const payload = {
    currency: opts.currency || 'EUR', pricesIncludeVat: false,
    invoiceNumber: opts.number || 'CP-2026-0042', status: 'draft',
    invoiceDate: '2026-08-30', dueDate: '2026-09-13', paymentTermDays: 14,
    seller: SELLER, buyer: BUYER, lines,
    surcharges: [], discount: { type: 'none', value: 0 }, payments: [], credits: []
  };
  const computed = core.computeInvoice(payload, {});
  return FINAL.buildSnapshot({
    docKind: opts.docKind || 'invoice', administration: 'CP', seriesId: 'r1',
    invoiceNumber: payload.invoiceNumber, invoiceDate: payload.invoiceDate,
    dueDate: payload.dueDate, paymentTermDays: 14,
    deliveryStart: '2026-08-01', deliveryEnd: '2026-08-28',
    currency: payload.currency, rateToEur: opts.currency && opts.currency !== 'EUR' ? 1.085 : null,
    pricesIncludeVat: false, language: opts.lang || 'nl',
    template: opts.template || 'standaard',
    clientReference: 'Order voorjaar', purchaseOrder: 'PO-99231',
    introText: 'Hierbij de factuur voor de eerste productieronde.',
    outroText: 'Vragen? Antwoord gerust op de mail.',
    paymentInstructions: 'Betaling binnen 14 dagen onder vermelding van het kenmerk.',
    discount: payload.discount, seller: SELLER, buyer: BUYER,
    computed, takenAt: '2026-08-30T10:00:00.000Z'
  });
}

export default function (t) {

  t.group('geld — gehele centen in, tekst uit');
  t.eq(TPL.formatMoney(123456, 'EUR', 2, 'nl'), '€ 1.234,56', 'Nederlands: punt als duizendtal, komma als decimaal');
  t.eq(TPL.formatMoney(123456, 'EUR', 2, 'en'), '€1,234.56', 'Engels: andersom, en het teken plakt aan het bedrag');
  t.eq(TPL.formatMoney(123456, 'EUR', 2, 'de'), '1.234,56 €', 'Duits: het valutateken staat achter het bedrag');
  t.eq(TPL.formatMoney(123456, 'EUR', 2, 'fr'), '1 234,56 €', 'Frans: een gewone spatie als duizendtal — geen smalle vaste spatie, die kan een standaardfont niet tekenen');
  t.eq(TPL.formatMoney(0, 'EUR', 2, 'nl'), '€ 0,00', 'nul is een echt bedrag, geen streepje');
  t.eq(TPL.formatMoney(5, 'EUR', 2, 'nl'), '€ 0,05', 'vijf cent');
  t.eq(TPL.formatMoney(-2550, 'EUR', 2, 'nl'), '-€ 25,50', 'het minteken staat vóór het valutateken, niet ertussen');
  t.eq(TPL.formatMoney(1000000000, 'EUR', 2, 'nl'), '€ 10.000.000,00', 'tien miljoen euro: elke drie cijfers een scheiding');
  t.eq(TPL.formatMoney(1234, 'JPY', 0, 'nl'), 'JPY 1.234', 'een valuta zonder decimalen krijgt er ook geen');
  t.eq(TPL.formatMoney(1234, 'CNY', 2, 'nl'), '¥ 12,34', 'de yuan heeft een eigen teken dat in WinAnsi bestaat');
  t.eq(TPL.formatMoney(999, 'XYZ', 2, 'nl'), 'XYZ 9,99', 'een onbekende valuta valt terug op zijn ISO-code, nooit op een verkeerd teken');

  /* geen enkele deling met kommagetallen: de uitkomst van 1 cent minder
     mag nooit door afronding gelijk worden aan de oorspronkelijke */
  t.true(TPL.formatMoney(123456, 'EUR', 2, 'nl') !== TPL.formatMoney(123455, 'EUR', 2, 'nl'),
    'één cent verschil is één cent verschil — er wordt nergens weggerond');
  t.eq(TPL.formatMoney(70, 'EUR', 2, 'nl'), '€ 0,70', 'zeventig cent (0,7 in floating point is de klassieke valkuil)');
  t.eq(TPL.formatMoney(1e15 + 7, 'EUR', 2, 'nl'), '€ 10.000.000.000.000,07',
    'ook net onder de veilige integergrens blijft elke cent staan');

  t.group('aantallen en percentages');
  t.eq(TPL.formatQuantity(2500000, 'nl'), '2,5', 'anderhalf keer zoveel: micro-eenheden worden leesbaar');
  t.eq(TPL.formatQuantity(3000000, 'nl'), '3', 'een rond aantal krijgt geen nutteloze nullen');
  t.eq(TPL.formatQuantity(3000000, 'en'), '3', 'in het Engels ook');
  t.eq(TPL.formatQuantity(1500000, 'en'), '1.5', 'maar het decimaalteken volgt de taal');
  t.eq(TPL.formatQuantity(-2500000, 'nl'), '-2,5', 'een negatief aantal (creditregel) blijft negatief');
  t.eq(TPL.formatQuantity(12000000000, 'nl'), '12.000', 'een groot aantal krijgt duizendtalscheiding');
  t.eq(TPL.formatPercent(21000, 'nl'), '21%', 'eenentwintig procent');
  t.eq(TPL.formatPercent(5500, 'nl'), '5,5%', 'vijf en een half procent');
  t.eq(TPL.formatPercent(0, 'nl'), '0%', 'nul procent is een echt tarief (0%-export, verlegd)');

  t.group('datums');
  t.eq(TPL.formatDate('', 'nl'), '', 'een lege datum blijft leeg — geen "1 januari 1970"');
  t.true(TPL.formatDate('2026-08-30', 'nl').indexOf('2026') > -1, 'het jaar staat in de datum');
  t.true(TPL.formatDate('2026-08-30', 'nl').indexOf('30') > -1, 'en de dag');
  t.eq(TPL.formatDate('niet-een-datum', 'nl'), 'niet-een-datum', 'onherkenbare invoer wordt letterlijk doorgegeven, niet stil weggegooid');

  t.group('huisstijl');
  const d = TPL.brandDefaults();
  t.eq(d.template, 'standaard', 'de standaard is het standaardsjabloon');
  t.eq(TPL.normalizeBrand({ accent: 'geen-kleur' }).accent, d.accent, 'een ongeldige kleur valt terug op de huisstijlkleur');
  t.eq(TPL.normalizeBrand({ accent: '#ABC' }).accent, '#ABC', 'de korte hexvorm mag');
  t.eq(TPL.normalizeBrand({ template: 'bestaat-niet' }).template, 'standaard', 'een onbekend sjabloon valt terug op de standaard');
  t.eq(TPL.normalizeBrand({ logoWidthMm: 900 }).logoWidthMm, 70, 'een absurd brede logobreedte wordt begrensd');
  t.eq(TPL.normalizeBrand({ logoWidthMm: 2 }).logoWidthMm, d.logoWidthMm, 'een te smalle valt terug op de standaard');
  t.eq(TPL.normalizeBrand(null).template, 'standaard', 'geen huisstijl is ook een huisstijl');

  t.group('de PDF zelf');
  const snap = maakSnapshot({ lineCount: 3, heading: true });
  const bytes = TPL.render(snap, { date: new Date(0) });
  const text = latin1(bytes);
  t.eq(text.slice(0, 8), '%PDF-1.4', 'de factuur is een echte PDF');
  t.true(text.trimEnd().endsWith('%%EOF'), 'en hij is compleet');
  t.true(text.indexOf('(CP-2026-0042)') > -1, 'het factuurnummer staat op het vel');
  t.true(text.indexOf('(FACTUUR)') > -1, 'het documenttype staat er groot boven');
  t.true(text.indexOf('(Atelier Noord BV)') > -1, 'de klantnaam staat erop');
  t.true(text.indexOf('(NL91ABNA0417164300)') > -1, 'de IBAN staat in het betaalblok');
  t.true(text.indexOf('(ABNANL2A)') > -1, 'en de BIC');
  t.true(text.indexOf('Btw-nummer NL003456789B01') > -1, 'het btw-nummer van de verkoper');
  t.true(text.indexOf('Btw-nummer NL001234567B01') > -1, 'en dat van de afnemer — verplicht bij verlegging');
  t.true(text.indexOf('(PO-99231)') > -1, 'het inkoopordernummer');
  t.true(text.indexOf('Registratienummer 87654321') > -1, 'het registratienummer van de verkoper');
  t.true(text.indexOf('(Totaal inclusief btw)') > -1, 'het totaal inclusief btw staat erop');
  t.true(text.indexOf('(Totaal exclusief btw)') > -1, 'en het totaal exclusief');
  t.true(text.indexOf('(Te betalen)') > -1, 'en wat er daadwerkelijk betaald moet worden');
  t.true(text.indexOf('(Pagina 1 van 1)') > -1 || text.indexOf('(Pagina 1 van 2)') > -1, 'de voettekst nummert de paginas');
  t.true(text.indexOf('(BTW-SPECIFICATIE)') > -1, 'de btw-specificatie per code staat op het vel');

  t.group('bedragen op het vel');
  /* 3 regels × 2 stuks × € 100,00 = € 600,00 excl., 21% btw = € 126,00 */
  t.eq(snap.totals.totalExclCents, 60000, 'de rekenkern komt op 600 euro exclusief');
  t.eq(snap.totals.vatCents, 12600, 'en 126 euro btw');
  t.eq(snap.totals.totalInclCents, 72600, 'samen 726 euro');
  t.true(text.indexOf(PDF.pdfString(TPL.formatMoney(72600, 'EUR', 2, 'nl'))) > -1,
    'exact dat bedrag staat als tekst in de PDF — de PDF rekent zelf niets uit');

  t.group('taal van het vel');
  const en = TPL.render(maakSnapshot({ lang: 'en' }), { lang: 'en', date: new Date(0) });
  const enText = latin1(en);
  t.true(enText.indexOf('(Total including VAT)') > -1, 'in het Engels staat de Engelse term uit het woordenboek');
  t.true(enText.indexOf('(INVOICE)') > -1, 'ook het documenttype vertaalt mee');
  t.true(enText.indexOf('(Page 1 of ') > -1, 'en de paginanummering');
  t.true(enText.indexOf('(Totaal inclusief btw)') < 0, 'er staat geen Nederlands meer op een Engelse factuur');

  t.group('woordenboeken compleet');
  for (const taal of ['en', 'de', 'fr', 'es']) {
    const dict = dicts && dicts[taal];
    const missend = TPL.CLIENT_STRINGS.filter(function (s) {
      return !(dict && typeof dict[s] === 'string' && dict[s]);
    });
    t.eq(missend.length, 0, 'alle klantzichtbare strings van de PDF staan in het woordenboek ' + taal +
      (missend.length ? ' — ontbreekt: ' + missend.slice(0, 5).join(' | ') : ''));
  }

  t.group('lange facturen breken netjes af');
  const lang60 = maakSnapshot({ lineCount: 60, longText: true, heading: true });
  const b60 = TPL.render(lang60, { date: new Date(0) });
  const t60 = latin1(b60);
  const p60 = pageCount(b60);
  t.true(p60 >= 5, 'een factuur met 60 wikkelende regels loopt over meerdere paginas (' + p60 + ')');
  t.true(t60.indexOf('(Pagina 1 van ' + p60 + ')') > -1, 'pagina 1 kent het juiste totaal');
  t.true(t60.indexOf('(Pagina ' + p60 + ' van ' + p60 + ')') > -1, 'en de laatste pagina ook');
  t.eq((t60.match(/\(Pagina \d+ van /g) || []).length, p60, 'elke pagina draagt precies één paginanummer');
  t.true((t60.match(/\(Omschrijving\)/g) || []).length > 1, 'de kolomkoppen worden op elke vervolgpagina herhaald');
  t.true(t60.indexOf('(Vervolg)') > -1, 'een vervolgpagina zegt dat hij een vervolg is');
  t.eq((t60.match(/\(Te betalen\)/g) || []).length, 1, 'het te betalen bedrag staat er precies één keer op');

  t.group('sjablonen doen echt iets');
  const compact = TPL.render(maakSnapshot({ lineCount: 60, longText: true, heading: true, template: 'compact' }), { date: new Date(0) });
  const pCompact = pageCount(compact);
  t.true(pCompact < p60, 'compact past dezelfde 60 regels op minder paginas (' + pCompact + ' tegen ' + p60 + ')');
  t.true(latin1(compact).indexOf('(CP-2026-0042)') > -1, 'en het is nog steeds dezelfde factuur');
  /* het sjabloon van de FACTUUR wint van dat van de huisstijl: anders zou
     het omzetten van de standaard elke bestaande factuur van vorm veranderen */
  const gedwongen = TPL.render(maakSnapshot({ lineCount: 60, longText: true, heading: true, template: 'compact' }),
    { brand: { template: 'standaard' }, date: new Date(0) });
  t.eq(pageCount(gedwongen), pCompact, 'de snapshot bepaalt het sjabloon, niet de huisstijl van vandaag');
  const geforceerd = TPL.render(maakSnapshot({ lineCount: 60, longText: true, heading: true, template: 'compact' }),
    { forceTemplate: 'standaard', date: new Date(0) });
  t.eq(pageCount(geforceerd), p60, 'alleen het live voorbeeld in de instellingen mag dat overrulen (forceTemplate)');

  t.group('de betaal-QR');
  t.true(!!QR, 'portal/qr.js is geladen');
  const metQr = latin1(TPL.render(snap, { date: new Date(0) }));
  const zonderQr = latin1(TPL.render(snap, { qr: false, date: new Date(0) }));
  t.true(metQr.length > zonderQr.length, 'de QR voegt echte vectorpaden toe aan het bestand');
  t.true(metQr.indexOf('(Scan met je bank-app)') > -1, 'met QR staat het bijschrift erbij');
  t.true(zonderQr.indexOf('(Scan met je bank-app)') < 0, 'zonder QR staat er geen bijschrift dat nergens naar wijst');
  /* de QR is GEEN plaatje maar een pad: er staat geen beeld-XObject in */
  t.true(metQr.indexOf('/Subtype /Image') < 0, 'de QR wordt als vectorpad getekend, niet als rasterbeeld');
  const creditSnap = maakSnapshot({ docKind: 'credit_note' });
  t.true(latin1(TPL.render(creditSnap, { date: new Date(0) })).indexOf('(Scan met je bank-app)') < 0,
    'een creditnota krijgt geen betaal-QR — daar valt niets te betalen');
  t.true(latin1(TPL.render(creditSnap, { date: new Date(0) })).indexOf('(CREDITNOTA)') > -1,
    'maar hij heet wel duidelijk een creditnota');

  t.group('bestandsnaam');
  t.eq(TPL.filename(snap), 'Factuur-CP-2026-0042.pdf', 'de bestandsnaam draagt het factuurnummer');
  t.eq(TPL.filename(creditSnap), 'Creditnota-CP-2026-0042.pdf', 'een creditnota heet ook zo');
  t.eq(TPL.filename({ invoiceNumber: 'CP/2026 0001' }), 'Factuur-CP-2026-0001.pdf', 'tekens die geen bestandsnaam mogen zijn worden vervangen');

  t.group('reproduceerbaar');
  const a1 = latin1(TPL.render(snap, { date: new Date(0) }));
  const a2 = latin1(TPL.render(snap, { date: new Date(0) }));
  t.eq(a1, a2, 'dezelfde snapshot geeft byte voor byte dezelfde PDF');

  t.group('VERSIE-VAST: een huisstijlwijziging raakt een bestaande PDF niet');
  /* Dit is de kern van deze fase. De opslag hieronder doet precies wat
     DS.attachInvoicePdf doet: één keer schrijven, daarna weigeren. */
  const kluis = {};
  TPL.setStore(function (meta, snapshot) {
    const key = snapshot.invoiceNumber;
    if (kluis[key]) throw new Error('Deze factuur heeft al een definitieve PDF.');
    kluis[key] = {
      bytes: meta.bytes.slice(),
      template: meta.template,
      templateVersion: meta.templateVersion,
      brand: meta.brand
    };
    return { detail: 'bewaard' };
  });

  const groen = { template: 'standaard', accent: '#1B6E45', logoData: '', logoWidthMm: 34, footerNote: '' };
  const oranje = { template: 'compact', accent: '#C2410C', logoData: '', logoWidthMm: 60, footerNote: 'Nieuwe voetregel' };

  return Promise.resolve(TPL.generate(snap, { brand: groen, date: new Date(0) })).then(function (res) {
    t.true(res.ok, 'de generator maakt en bewaart de PDF');
    t.eq(kluis['CP-2026-0042'].template, 'standaard', 'de gebruikte sjabloonnaam wordt bij de factuur bewaard');
    t.eq(kluis['CP-2026-0042'].templateVersion, TPL.TEMPLATE_VERSION, 'en de sjabloonVERSIE, zodat een latere wijziging uitlegbaar blijft');
    t.eq(kluis['CP-2026-0042'].brand.accent, '#1B6E45', 'en de huisstijl waarmee hij is gemaakt');

    const bewaardVoor = latin1(kluis['CP-2026-0042'].bytes);
    const groenBytes = latin1(TPL.render(snap, { brand: groen, date: new Date(0) }));
    t.eq(bewaardVoor, groenBytes, 'wat er is bewaard is precies wat er is gerenderd');

    /* DE HUISSTIJL GAAT OM — dit is wat de eigenaar morgen doet */
    const naOranje = latin1(TPL.render(snap, { brand: oranje, forceTemplate: 'compact', date: new Date(0) }));
    t.true(naOranje !== groenBytes, 'een NIEUWE factuur ziet er met de nieuwe huisstijl anders uit (anders zou de instelling niets doen)');

    const bewaardNa = latin1(kluis['CP-2026-0042'].bytes);
    t.eq(bewaardNa, bewaardVoor, 'de al bewaarde PDF is byte voor byte onveranderd — dít is de versie-vastheid');
    t.eq(kluis['CP-2026-0042'].brand.accent, '#1B6E45', 'en hij draagt nog steeds de huisstijl van tóen, niet die van nu');

    /* en een tweede poging op dezelfde factuur wordt geweigerd */
    return Promise.resolve(TPL.generate(snap, { brand: oranje, date: new Date(0) })).then(function () {
      t.true(false, 'een tweede PDF voor dezelfde factuur hoort te worden geweigerd');
    }, function (e) {
      t.true(/al een definitieve PDF/.test(e.message), 'een tweede PDF voor dezelfde factuur wordt geweigerd met een duidelijke reden');
    });
  }).then(function () {
    t.group('zonder opslag');
    TPL.setStore(null);
    return Promise.resolve(TPL.generate(snap, { brand: groen, date: new Date(0) })).then(function (res) {
      t.true(res.ok, 'zonder aangesloten opslag komt er nog steeds een PDF');
      t.true(/niet bewaard/.test(res.detail), 'maar dan zegt de melding eerlijk dat er niets is bewaard');
      t.true(res.bytes && res.bytes.length > 1000, 'en de bytes worden gewoon teruggegeven');
    });
  });
}
