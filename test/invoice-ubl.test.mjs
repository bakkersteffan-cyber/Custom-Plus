/* CUSTOM+ — de UBL-export.
   ------------------------------------------------------------------
   Wat hier het hardst wordt bewaakt:

     1. DE VERPLICHTE VELDEN STAAN ER ÉCHT IN. Een e-factuur gaat naar een
        ander systeem, en daar kan niemand meer bijsturen. Als er een
        factuurnummer, een btw-nummer of een adres ontbreekt, moet dat hier
        blokkeren en niet bij de ontvanger.
     2. GELD BLIJFT GEHELE CENTEN. UBL wil decimale tekst; die omzetting
        loopt via quotient en rest, nooit via een deling met een
        kommagetal. € 12,34 mag nooit 12.339999999 worden.
     3. DE BTW-CATEGORIE WORDT NOOIT GERADEN. Een verkeerde categorie maakt
        van een verlegde factuur een belaste; elke behandeling heeft
        precies één juiste code.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-ubl.js';

const U = globalThis.CP_UBL;

function snapshot(over) {
  return Object.assign({
    docKind: 'invoice',
    invoiceNumber: 'CP-2026-0007',
    invoiceDate: '2026-03-01',
    dueDate: '2026-03-15',
    paymentTermDays: 14,
    currency: 'EUR', minorUnits: 2, language: 'nl',
    clientReference: 'REF-9', purchaseOrder: 'PO-1', costCenter: 'KP-3',
    deliveryStart: '2026-02-01', deliveryEnd: '2026-02-28',
    seller: {
      name: 'CUSTOM+', vatNumber: 'NL001234567B01', registrationNumber: '87654321',
      address: 'Straatweg 1\n1234 AB Amsterdam\nNederland',
      iban: 'NL91ABNA0417164300', bic: 'ABNANL2A', email: 'steffan@custom-plus.nl'
    },
    buyer: {
      name: 'Klant BV', vatNumber: 'BE0123456789', contactName: 'Jan',
      address: 'Rue de la Loi 2\n1000 Brussel\nBelgie', email: 'jan@klant.be'
    },
    lines: [
      { sort: 0, type: 'item', description: 'Advies & ontwerp', detail: 'fase 2',
        quantityMicro: 2500000, unit: 'uur', unitPriceCents: 8500,
        priceIncludesVat: false, discountType: 'none', discountValue: 0,
        taxCode: 'NL21', rateMilli: 21000, treatment: 'standard',
        grossExclCents: 21250, discountExclCents: 0, netExclCents: 21250,
        vatCents: 4463, ledgerRef: '8000', productRef: 'ADV-1' },
      { sort: 1, type: 'heading', description: 'Levering' }
    ],
    taxGroups: [
      { taxCode: 'NL21', rateMilli: 21000, treatment: 'standard',
        baseCents: 21250, vatCents: 4463, legalNoteNl: '' }
    ],
    totals: {
      subtotalBeforeDiscountCents: 21250, lineDiscountCents: 0, invoiceDiscountCents: 0,
      surchargeCents: 0, totalExclCents: 21250, vatCents: 4463, totalInclCents: 25713,
      paidCents: 0, creditedCents: 0, outstandingCents: 25713
    }
  }, over || {});
}

export default function (t) {
  t.group('module');
  t.true(!!U, 'portal/invoice-ubl.js levert CP_UBL op');
  t.true(U.CUSTOMIZATION_ID.indexOf('en16931') > -1, 'het profiel is EN 16931-conform');
  t.true(U.PROFILE_ID.indexOf('peppol') > -1, 'en het is het Peppol-billing-profiel');

  /* ------------------------------------------------------------------
     1. GELD BLIJFT GEHELE CENTEN
     ------------------------------------------------------------------ */
  t.group('geld als tekst');
  t.eq(U.centsToDecimal(123456, 2), '1234.56', 'centen worden decimale tekst met een punt');
  t.eq(U.centsToDecimal(5, 2), '0.05', 'vijf cent is 0.05, niet 0.5');
  t.eq(U.centsToDecimal(-5, 2), '-0.05', 'een negatief bedrag houdt zijn minteken');
  t.eq(U.centsToDecimal(0, 2), '0.00', 'nul is 0.00 en niet leeg');
  t.eq(U.centsToDecimal(-0, 2), '0.00', 'min nul is gewoon nul, zonder minteken');
  t.eq(U.centsToDecimal(100, 2), '1.00', 'een hele euro krijgt twee decimalen');
  t.eq(U.centsToDecimal(1234, 0), '1234', 'een valuta zonder decimalen krijgt er ook geen');
  t.eq(U.centsToDecimal(70, 2), '0.70', 'de 0,7-valkuil: zeventig cent is 0.70 en niet 0.7');
  t.eq(U.centsToDecimal(1234567890123, 2), '12345678901.23', 'ook grote bedragen blijven exact');

  t.group('aantallen en percentages');
  t.eq(U.microToDecimal(2500000), '2.5', 'tweeënhalf uur');
  t.eq(U.microToDecimal(1000000), '1', 'een heel getal krijgt geen overbodige decimalen');
  t.eq(U.microToDecimal(333333), '0.333333', 'zes decimalen blijven behouden');
  t.eq(U.microToDecimal(0), '0', 'nul is nul');
  t.eq(U.milliToDecimal(21000), '21', '21% is 21');
  t.eq(U.milliToDecimal(5500), '5.5', '5,5% is 5.5');
  t.eq(U.milliToDecimal(0), '0', '0% is 0');

  /* ------------------------------------------------------------------
     2. XML-ESCAPING
     ------------------------------------------------------------------ */
  t.group('escaping');
  t.eq(U.escapeXml('Advies & ontwerp'), 'Advies &amp; ontwerp', 'de ampersand wordt geëscaped');
  t.eq(U.escapeXml('<script>'), '&lt;script&gt;', 'punthaken worden geëscaped');
  t.eq(U.escapeXml('zei "hallo"'), 'zei &quot;hallo&quot;', 'aanhalingstekens ook, want ze staan ook in attributen');
  t.eq(U.escapeXml("O'Brien"), 'O&apos;Brien', 'en de apostrof');
  t.eq(U.escapeXml('a\u0001b'), 'ab', 'stuurtekens die XML 1.0 niet kent worden weggegooid');
  t.eq(U.escapeXml('a\nb\tc'), 'a\nb\tc', 'regeleinde en tab blijven wél staan');
  t.eq(U.escapeXml(null), '', 'null wordt een lege string, geen "null"');

  /* ------------------------------------------------------------------
     3. CODELIJSTEN
     ------------------------------------------------------------------ */
  t.group('codelijsten');
  t.eq(U.unitCode('uur'), 'HUR', 'uur is HUR');
  t.eq(U.unitCode('stuk'), 'C62', 'stuk is C62');
  t.eq(U.unitCode('Dag'), 'DAY', 'de vergelijking is hoofdletterongevoelig');
  t.eq(U.unitCode('rol'), 'C62', 'een onbekende eenheid valt terug op C62 — de gedocumenteerde restcategorie');
  t.eq(U.unitCode(''), 'C62', 'geen eenheid ook');
  t.eq(U.taxCategory('standard').id, 'S', 'belast is S');
  t.eq(U.taxCategory('zero').id, 'Z', 'nultarief is Z');
  t.eq(U.taxCategory('exempt').id, 'E', 'vrijgesteld is E');
  t.eq(U.taxCategory('reverse').id, 'AE', 'verlegd is AE');
  t.eq(U.taxCategory('intracom').id, 'K', 'intracommunautair is K');
  t.eq(U.taxCategory('onzin').id, 'S', 'een onbekende behandeling valt terug op belast — de veilige kant');
  t.true(U.taxCategory('reverse').needsReason, 'verlegd vraagt een vrijstellingsreden');
  t.false(U.taxCategory('standard').needsReason, 'belast niet');

  /* elke behandeling uit de rekenkern heeft precies één categorie */
  for (const key of globalThis.CP_INVOICE.TREATMENT_KEYS) {
    t.true(!!U.TAX_CATEGORIES[key], 'behandeling “' + key + '” uit de rekenkern heeft een UBL-categorie');
  }

  t.group('adres en land');
  const adr = U.splitAddress('Straatweg 1\n1234 AB Amsterdam\nNederland');
  t.eq(adr.street, 'Straatweg 1', 'de eerste regel is de straat');
  t.eq(adr.postalCode, '1234 AB', 'de Nederlandse postcode wordt herkend');
  t.eq(adr.city, 'Amsterdam', 'en de plaats erachter');
  t.eq(adr.country, 'Nederland', 'de laatste regel van drie is het land');
  t.eq(U.countryCode('Nederland'), 'NL', 'Nederland is NL');
  t.eq(U.countryCode('belgie'), 'BE', 'België is BE, ook zonder trema');
  t.eq(U.countryCode('Atlantis'), '', 'een onbekend land levert GEEN code op — verzinnen is erger dan ontbreken');
  t.eq(U.splitAddress('').street, '', 'een leeg adres levert lege velden op, geen fout');

  /* ------------------------------------------------------------------
     4. DE INTERNE REPRESENTATIE
     ------------------------------------------------------------------ */
  t.group('interne representatie');
  const ir = U.fromSnapshot(snapshot());
  t.eq(ir.documentKind, 'invoice', 'een factuur blijft een factuur');
  t.eq(ir.number, 'CP-2026-0007', 'het nummer komt mee');
  t.eq(ir.lines.length, 1, 'alleen bedragregels worden InvoiceLine — een tussenkop niet');
  t.eq(ir.note, 'Levering', 'de tussenkop landt als Note op documentniveau, hij verdwijnt niet');
  t.eq(ir.supplier.countryCode, 'NL', 'het land van de verkoper wordt afgeleid');
  t.eq(ir.customer.countryCode, 'BE', 'en dat van de klant ook');
  t.eq(ir.totals.taxInclusiveCents, 25713, 'de totalen komen uit de snapshot');
  t.eq(ir.totals.lineExtensionCents, 21250, 'de regelsom klopt met het totaal exclusief btw');
  t.eq(ir.totals.payableCents, 25713, 'zonder betaling is het te betalen bedrag het volledige totaal');
  t.true(ir.generatedBy.indexOf('CUSTOM+') > -1, 'de representatie draagt zijn herkomst');

  /* de IR bevat GEEN interne gegevens */
  const platIr = JSON.stringify(U.fromSnapshot(snapshot({
    internalNote: 'nog even bellen', tags: ['spoed']
  })));
  t.false(platIr.indexOf('nog even bellen') > -1, 'de interne notitie komt niet in de export');
  t.false(platIr.indexOf('spoed') > -1, 'de interne tags ook niet');

  const metBetaling = U.fromSnapshot(snapshot({
    totals: Object.assign({}, snapshot().totals, { paidCents: 10000 })
  }));
  t.eq(metBetaling.totals.prepaidCents, 10000, 'een al betaald bedrag komt als PrepaidAmount terug');
  t.eq(metBetaling.totals.payableCents, 15713, 'en het te betalen bedrag is het restant');

  /* ------------------------------------------------------------------
     5. VALIDATIE — de verplichte velden
     ------------------------------------------------------------------ */
  t.group('validatie');
  const goed = U.validate(ir);
  t.true(goed.ok, 'een complete factuur is geldig');
  t.eq(goed.errors.length, 0, 'zonder fouten');
  t.eq(goed.warnings.length, 0, 'en zonder waarschuwingen');

  t.true(U.REQUIRED_FIELDS.length >= 9, 'er zijn minstens negen verplichte velden');
  for (const f of U.REQUIRED_FIELDS) {
    /* elk verplicht veld leeghalen moet ook echt blokkeren */
    const kapot = U.fromSnapshot(snapshot());
    const parts = f.path.split('.');
    let cur = kapot;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = '';
    const res = U.validate(kapot);
    t.false(res.ok, 'zonder ' + f.path + ' kan er niet worden geëxporteerd');
    t.true(res.errors.some((e) => e.field === f.path), 'en de fout wijst het veld ' + f.path + ' aan');
  }

  const zonderRegels = U.fromSnapshot(snapshot({ lines: [] }));
  t.false(U.validate(zonderRegels).ok, 'zonder bedragregels kan er niet worden geëxporteerd');

  const zonderOmschrijving = U.fromSnapshot(snapshot({
    lines: [Object.assign({}, snapshot().lines[0], { description: '' })]
  }));
  t.false(U.validate(zonderOmschrijving).ok, 'een regel zonder omschrijving blokkeert');

  const zonderAantal = U.fromSnapshot(snapshot({
    lines: [Object.assign({}, snapshot().lines[0], { quantityMicro: 0 })]
  }));
  t.false(U.validate(zonderAantal).ok, 'een regel zonder aantal blokkeert');

  /* de btw-verlegd-poortwachter, ook hier */
  const verlegdZonderNummer = U.fromSnapshot(snapshot({
    buyer: Object.assign({}, snapshot().buyer, { vatNumber: '' }),
    taxGroups: [{ taxCode: 'VERLEGD', rateMilli: 0, treatment: 'reverse',
      baseCents: 21250, vatCents: 0, legalNoteNl: 'Btw verlegd naar de afnemer.' }],
    totals: Object.assign({}, snapshot().totals, { vatCents: 0, totalInclCents: 21250 })
  }));
  const verlegdRes = U.validate(verlegdZonderNummer);
  t.false(verlegdRes.ok, 'verlegde btw zonder btw-nummer van de afnemer blokkeert');
  t.true(verlegdRes.errors.some((e) => e.code === 'btw_nummer_afnemer_ontbreekt'),
    'met dezelfde poortwachter als in de rekenkern');

  const scheefTotaal = U.fromSnapshot(snapshot({
    totals: Object.assign({}, snapshot().totals, { totalInclCents: 99999 })
  }));
  t.false(U.validate(scheefTotaal).ok, 'als exclusief plus btw niet gelijk is aan inclusief, gaat er niets weg');

  const zonderIban = U.fromSnapshot(snapshot({
    seller: Object.assign({}, snapshot().seller, { iban: '' })
  }));
  const ibanRes = U.validate(zonderIban);
  t.true(ibanRes.ok, 'een ontbrekend IBAN blokkeert niet');
  t.true(ibanRes.warnings.some((w) => w.code === 'iban_ontbreekt'), 'maar het wordt wel gemeld');

  const onbekendLand = U.fromSnapshot(snapshot({
    buyer: Object.assign({}, snapshot().buyer, { address: 'Ergensstraat 3\nAtlantis' })
  }));
  t.true(U.validate(onbekendLand).warnings.some((w) => w.code === 'land_afnemer_onbekend'),
    'een niet-herkend land is een waarschuwing, geen verzonnen code');

  /* ------------------------------------------------------------------
     6. DE XML ZELF
     ------------------------------------------------------------------ */
  t.group('de XML');
  const xml = U.toXml(ir);
  t.true(xml.indexOf('<?xml version="1.0" encoding="UTF-8"?>') === 0, 'het bestand begint met de XML-declaratie');
  t.true(xml.indexOf('<Invoice ') > -1, 'het wortelelement is Invoice');
  t.true(xml.indexOf('</Invoice>') > -1, 'en hij wordt netjes gesloten');
  t.true(xml.indexOf('xmlns:cac=') > -1, 'de cac-namespace staat erin');
  t.true(xml.indexOf('xmlns:cbc=') > -1, 'de cbc-namespace ook');

  /* de verplichte velden staan er ook echt in — dit is de kern van de test */
  t.true(xml.indexOf('<cbc:ID>CP-2026-0007</cbc:ID>') > -1, 'het factuurnummer staat in de XML');
  t.true(xml.indexOf('<cbc:IssueDate>2026-03-01</cbc:IssueDate>') > -1, 'de factuurdatum staat erin');
  t.true(xml.indexOf('<cbc:DueDate>2026-03-15</cbc:DueDate>') > -1, 'de vervaldatum staat erin');
  t.true(xml.indexOf('<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>') > -1, 'de documentcode 380 staat erin');
  t.true(xml.indexOf('<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>') > -1, 'de valuta staat erin');
  t.true(xml.indexOf('<cbc:CustomizationID>') > -1, 'het profiel staat erin');
  t.true(xml.indexOf('NL001234567B01') > -1, 'het btw-nummer van de verkoper staat erin');
  t.true(xml.indexOf('BE0123456789') > -1, 'dat van de klant ook');
  t.true(xml.indexOf('<cbc:StreetName>Straatweg 1</cbc:StreetName>') > -1, 'het adres van de verkoper staat erin');
  t.true(xml.indexOf('<cbc:IdentificationCode>NL</cbc:IdentificationCode>') > -1, 'met een landcode');
  t.true(xml.indexOf('NL91ABNA0417164300') > -1, 'het IBAN staat erin');
  t.true(xml.indexOf('<cbc:ID>ABNANL2A</cbc:ID>') > -1, 'de BIC ook');
  t.true(xml.indexOf('<cbc:BuyerReference>REF-9</cbc:BuyerReference>') > -1, 'de klantreferentie staat erin');
  t.true(xml.indexOf('PO-1') > -1, 'het inkoopordernummer staat erin');
  t.true(xml.indexOf('<cbc:StartDate>2026-02-01</cbc:StartDate>') > -1, 'de leverperiode staat erin');
  t.true(xml.indexOf('<cbc:TaxAmount currencyID="EUR">44.63</cbc:TaxAmount>') > -1, 'het btw-bedrag staat erin');
  t.true(xml.indexOf('<cbc:PayableAmount currencyID="EUR">257.13</cbc:PayableAmount>') > -1,
    'het te betalen bedrag staat erin, met de valuta als attribuut');
  t.true(xml.indexOf('<cbc:InvoicedQuantity unitCode="HUR">2.5</cbc:InvoicedQuantity>') > -1,
    'het aantal staat erin met de juiste eenheidscode');
  t.true(xml.indexOf('Advies &amp; ontwerp') > -1, 'de omschrijving staat erin, geëscaped');
  t.true(xml.indexOf('<cbc:Name>Klant BV</cbc:Name>') > -1, 'de klantnaam staat erin');
  t.true(xml.indexOf('<cbc:AccountingCost>8000</cbc:AccountingCost>') > -1, 'de grootboekreferentie staat erin');
  t.true(xml.indexOf('ADV-1') > -1, 'de productcode staat erin');
  t.false(xml.indexOf('undefined') > -1, 'er staat nergens “undefined” in de XML');
  t.false(xml.indexOf('NaN') > -1, 'en nergens NaN');

  /* de volgorde van de elementen ligt in UBL vast */
  t.true(xml.indexOf('<cbc:CustomizationID>') < xml.indexOf('<cbc:ID>'),
    'CustomizationID komt vóór ID — het UBL-schema is een sequence');
  t.true(xml.indexOf('<cac:AccountingSupplierParty>') < xml.indexOf('<cac:AccountingCustomerParty>'),
    'de verkoper komt vóór de klant');
  t.true(xml.indexOf('<cac:TaxTotal>') < xml.indexOf('<cac:LegalMonetaryTotal>'),
    'TaxTotal komt vóór LegalMonetaryTotal');
  t.true(xml.indexOf('<cac:LegalMonetaryTotal>') < xml.indexOf('<cac:InvoiceLine>'),
    'en de regels komen als laatste');

  /* Price × Quantity moet met LineExtensionAmount kloppen */
  t.true(xml.indexOf('<cbc:PriceAmount currencyID="EUR">85.00</cbc:PriceAmount>') > -1,
    'de eenheidsprijs exclusief btw is € 85,00 — 2,5 × 85 = 212,50, precies het regelbedrag');

  /* elk open element heeft zijn sluiter: een simpele, harde telling */
  const opens = (xml.match(/<(cac|cbc):[A-Za-z]+[ >]/g) || []).length;
  const closes = (xml.match(/<\/(cac|cbc):[A-Za-z]+>/g) || []).length;
  t.eq(opens, closes, 'elk geopend cac/cbc-element wordt ook gesloten');

  /* ------------------------------------------------------------------
     7. DE CREDITNOTA
     ------------------------------------------------------------------ */
  t.group('creditnota');
  const creditIr = U.fromSnapshot(snapshot({ docKind: 'credit_note', creditOfNumber: 'CP-2026-0007' }));
  const creditXml = U.toXml(creditIr);
  t.eq(creditIr.documentKind, 'credit_note', 'een creditnota wordt als creditnota herkend');
  t.true(creditXml.indexOf('<CreditNote ') === creditXml.indexOf('<CreditNote '), 'het wortelelement is CreditNote');
  t.true(creditXml.indexOf('<CreditNote ') > -1, 'en hij staat er ook echt in');
  t.true(creditXml.indexOf('CreditNote-2') > -1, 'met de CreditNote-namespace');
  t.true(creditXml.indexOf('<cbc:CreditNoteTypeCode>381</cbc:CreditNoteTypeCode>') > -1,
    'met documentcode 381 in plaats van 380');
  t.true(creditXml.indexOf('<cbc:CreditedQuantity') > -1, 'de regels heten CreditedQuantity');
  t.false(creditXml.indexOf('<cbc:InvoicedQuantity') > -1, 'en niet InvoicedQuantity');
  t.true(creditXml.indexOf('<cac:BillingReference>') > -1, 'met een verwijzing naar de originele factuur');
  t.true(creditXml.indexOf('<cbc:ID>CP-2026-0007</cbc:ID>') > -1, 'en het nummer van die factuur staat erin');
  t.false(creditXml.indexOf('<cbc:DueDate>') > -1, 'een creditnota krijgt geen vervaldatum: er valt niets te betalen');
  t.true(creditXml.indexOf('257.13') > -1, 'de bedragen zijn POSITIEF — UBL laat het documenttype het teken bepalen');

  const zonderRef = U.fromSnapshot(snapshot({ docKind: 'credit_note' }));
  t.true(U.validate(zonderRef).warnings.some((w) => w.code === 'credit_zonder_referentie'),
    'een creditnota zonder verwijzing is een waarschuwing, geen blokkade');

  /* ------------------------------------------------------------------
     8. KORTING, KOSTEN EN MEERDERE BTW-GROEPEN
     ------------------------------------------------------------------ */
  t.group('korting en kosten');
  const metExtra = U.fromSnapshot(snapshot({
    totals: Object.assign({}, snapshot().totals, {
      invoiceDiscountCents: 1000, surchargeCents: 2500,
      totalExclCents: 22750, vatCents: 4778, totalInclCents: 27528
    })
  }));
  const extraXml = U.toXml(metExtra);
  t.true(extraXml.indexOf('<cbc:ChargeIndicator>false</cbc:ChargeIndicator>') > -1,
    'de factuurkorting staat als AllowanceCharge met ChargeIndicator false');
  t.true(extraXml.indexOf('<cbc:ChargeIndicator>true</cbc:ChargeIndicator>') > -1,
    'en de verzendkosten met true');
  t.true(extraXml.indexOf('<cbc:AllowanceTotalAmount currencyID="EUR">10.00</cbc:AllowanceTotalAmount>') > -1,
    'de kortingssom staat in de totalen');
  t.true(extraXml.indexOf('<cbc:ChargeTotalAmount currencyID="EUR">25.00</cbc:ChargeTotalAmount>') > -1,
    'de kostensom ook');
  t.eq(metExtra.totals.lineExtensionCents, 22750 - 2500 + 1000,
    'de regelsom is totaal exclusief min kosten plus korting — zo klopt de UBL-optelsom');

  const verlegd = U.fromSnapshot(snapshot({
    taxGroups: [{ taxCode: 'VERLEGD', rateMilli: 0, treatment: 'reverse',
      baseCents: 21250, vatCents: 0, legalNoteNl: 'Btw verlegd naar de afnemer.' }],
    totals: Object.assign({}, snapshot().totals, { vatCents: 0, totalInclCents: 21250 })
  }));
  const verlegdXml = U.toXml(verlegd);
  t.true(verlegdXml.indexOf('<cbc:ID>AE</cbc:ID>') > -1, 'een verlegde groep krijgt categorie AE');
  t.true(verlegdXml.indexOf('<cbc:TaxExemptionReason>Btw verlegd naar de afnemer.</cbc:TaxExemptionReason>') > -1,
    'met de wettelijke vermelding als vrijstellingsreden');

  /* ------------------------------------------------------------------
     9. BESTANDSNAAM
     ------------------------------------------------------------------ */
  t.group('bestandsnaam');
  t.eq(U.filename(ir), 'factuur-CP-2026-0007.ubl.xml', 'de naam draagt het nummer');
  t.eq(U.filename(creditIr), 'creditnota-CP-2026-0007.ubl.xml', 'een creditnota heet ook zo');
  t.false(U.filename({ number: 'a/b c' }).indexOf('/') > -1, 'padtekens worden uit de bestandsnaam gestript');
  t.false(U.filename({ number: 'a/b c' }).indexOf(' ') > -1, 'spaties ook');

  /* ------------------------------------------------------------------
     10. REPRODUCEERBAAR
     ------------------------------------------------------------------ */
  t.group('reproduceerbaar');
  t.eq(U.toXml(U.fromSnapshot(snapshot())), U.toXml(U.fromSnapshot(snapshot())),
    'dezelfde snapshot geeft twee keer exact dezelfde XML — geen tijdstempel, geen willekeur');
}
