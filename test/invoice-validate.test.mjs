/* CUSTOM+ — tests voor netlify/functions/invoice-validate.mjs.
   Draaien: node test/run.mjs
   ------------------------------------------------------------------
   Deze tests draaien de echte handler met een echt Request-object, dus
   ze bewijzen ook dat de rekenkern via `import` in een .mjs bruikbaar is
   (dezelfde regel die de spec vraagt: één plek waar de wiskunde leeft).
   Het gedeelde geheim wordt hier op een testwaarde gezet en daarna
   teruggezet, zodat er niets van blijft hangen.
   ------------------------------------------------------------------ */
import handler from '../netlify/functions/invoice-validate.mjs';

const SECRET = 'testgeheim-alleen-in-de-testrun';

function post(body) {
  return handler(new Request('https://x/.netlify/functions/invoice-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
}
async function readJson(res) { return JSON.parse(await res.text()); }

function goedeFactuur(extra) {
  return Object.assign({
    status: 'draft',
    invoiceNumber: 'CP-2026-0007',
    currency: 'EUR',
    invoiceDate: '2026-04-01',
    dueDate: '2026-04-15',
    paymentTermDays: 14,
    seller: { name: 'CUSTOM+', address: 'Straat 1, Amsterdam', vatNumber: 'NL001234567B01' },
    buyer: { name: 'Klant BV', address: 'Weg 2, Rotterdam' },
    lines: [
      { type: 'item', description: 'Ontwerp', quantity: 2, unitPriceCents: 50000, taxCode: 'NL21' }
    ]
  }, extra || {});
}

export default async function (t) {
  const vorig = process.env.NOTIFY_SHARED_SECRET;

  t.group('zonder geheim');
  delete process.env.NOTIFY_SHARED_SECRET;
  {
    const res = await handler(new Request('https://x/', { method: 'GET' }));
    const b = await readJson(res);
    t.eq(res.status, 200, 'GET antwoordt ook zonder configuratie');
    t.eq(b.configured, false, 'en meldt eerlijk dat de controle uit staat');
    t.true(!!b.version, 'de versie van de rekenkern komt wel mee');
  }
  {
    const res = await post({ invoice: goedeFactuur() });
    t.eq(res.status, 503, 'POST zonder ingesteld geheim is uit, geen open rekenmachine');
  }

  process.env.NOTIFY_SHARED_SECRET = SECRET;

  t.group('toegang');
  {
    const res = await handler(new Request('https://x/', { method: 'GET' }));
    t.eq((await readJson(res)).configured, true, 'met geheim meldt GET dat de controle beschikbaar is');
  }
  {
    const res = await post({ invoice: goedeFactuur() });
    t.eq(res.status, 401, 'POST zonder geheim wordt geweigerd');
  }
  {
    const res = await post({ secret: 'fout', invoice: goedeFactuur() });
    t.eq(res.status, 401, 'POST met het verkeerde geheim wordt geweigerd');
  }
  {
    const res = await handler(new Request('https://x/', { method: 'DELETE' }));
    t.eq(res.status, 405, 'andere methoden dan GET en POST worden geweigerd');
  }

  t.group('herberekening');
  {
    const res = await post({ secret: SECRET, invoice: goedeFactuur() });
    const b = await readJson(res);
    t.eq(res.status, 200, 'een geldige factuur komt door');
    t.true(b.ok, 'en wordt goedgekeurd');
    t.eq(b.totals.totalExclCents, 100000, 'de server rekent € 1.000,00 exclusief');
    t.eq(b.totals.vatCents, 21000, 'de server rekent € 210,00 btw');
    t.eq(b.totals.totalInclCents, 121000, 'de server rekent € 1.210,00 inclusief');
    t.eq(b.groups.length, 1, 'er is één btw-groep');
    t.eq(b.settlement.code, 'open', 'er is nog niets betaald');
  }
  {
    /* dit is waar deze functie voor bestaat: een client die een ander
       totaal beweert dan er uit de regels volgt */
    const res = await post({
      secret: SECRET,
      invoice: goedeFactuur(),
      claimedTotals: { totalInclCents: 100 }
    });
    const b = await readJson(res);
    t.false(b.ok, 'een gemanipuleerd totaal wordt geweigerd');
    t.true(b.errors.some((e) => e.code === 'totalen_wijken_af'), 'en met naam en toenaam benoemd');
  }
  {
    const res = await post({
      secret: SECRET,
      invoice: goedeFactuur(),
      claimedTotals: { totalExclCents: 100000, vatCents: 21000, totalInclCents: 121000 }
    });
    t.true((await readJson(res)).ok, 'kloppende clienttotalen komen wel door');
  }
  {
    /* de payload is data en geen instructie: onbekende velden worden
       weggegooid en kunnen dus nooit de uitkomst sturen */
    const res = await post({
      secret: SECRET,
      invoice: goedeFactuur({ totals: { totalInclCents: 1 }, ok: true, __proto__: {} })
    });
    const b = await readJson(res);
    t.eq(b.totals.totalInclCents, 121000, 'meegestuurde totalen in de payload worden genegeerd');
  }

  t.group('definitief maken');
  {
    const res = await post({ secret: SECRET, invoice: goedeFactuur({ invoiceNumber: '' }), intent: 'finalize' });
    const b = await readJson(res);
    t.false(b.ok, 'definitief maken zonder factuurnummer wordt server-side geweigerd');
    t.true(b.errors.some((e) => e.code === 'nummer_ontbreekt'), 'het ontbrekende nummer wordt benoemd');
  }
  {
    const res = await post({ secret: SECRET, invoice: goedeFactuur(), intent: 'finalize' });
    const b = await readJson(res);
    t.true(b.ok, 'een complete factuur mag van de server definitief worden');
    t.eq(b.intent, 'finalize', 'de bedoeling komt terug in het antwoord');
  }
  {
    const inv = goedeFactuur();
    inv.lines[0].taxCode = 'VERLEGD';
    const res = await post({ secret: SECRET, invoice: inv, intent: 'finalize' });
    const b = await readJson(res);
    t.false(b.ok, 'btw verlegd zonder btw-nummer van de klant wordt ook server-side tegengehouden');
    t.true(b.errors.some((e) => e.code === 'afnemer_btw_ontbreekt'), 'de poortwachter uit golf 1 staat nu ook op de server');
  }
  {
    const res = await post({
      secret: SECRET,
      invoice: goedeFactuur({ currency: 'USD' }),
      intent: 'finalize'
    });
    const b = await readJson(res);
    t.true(b.errors.some((e) => e.code === 'koers_ontbreekt'), 'een USD-factuur zonder koersanker wordt geweigerd');
  }

  t.group('grenzen');
  {
    const veel = goedeFactuur();
    veel.lines = [];
    for (let i = 0; i < 600; i++) {
      veel.lines.push({ type: 'item', description: 'R' + i, quantity: 1, unitPriceCents: 100, taxCode: 'NL21' });
    }
    const res = await post({ secret: SECRET, invoice: veel });
    const b = await readJson(res);
    t.eq(b.lines.length, 500, 'meer dan 500 regels worden afgekapt in plaats van eindeloos gerekend');
  }
  {
    const res = await handler(new Request('https://x/', { method: 'POST', body: 'geen json' }));
    t.eq(res.status, 400, 'onleesbare body geeft 400 en geen stacktrace');
  }
  {
    const res = await post({ secret: SECRET, invoice: { lines: [] } });
    const b = await readJson(res);
    t.false(b.ok, 'een lege factuur wordt afgekeurd');
    t.true(b.errors.some((e) => e.code === 'geen_regels'), 'omdat er geen bedragregel in staat');
  }

  /* ------------------------------------------------------------------
     FASE 2 — DE PAYLOAD DIE DE FACTUUREDITOR STUURT.
     Stap 2 van definitief maken laat de server herrekenen en vergelijkt
     zijn uitkomst met die van de browser; wijkt er iets af, dan gaat de
     factuur niet definitief. De editor typt in ruwe tekst maar stuurt de
     GENORMALISEERDE waarden (quantityMicro, unitPriceCents,
     discountValue), want cleanLine() laat alleen die velden door. Zou de
     browser discountPercent sturen, dan rekende de server met korting nul
     en blokkeerde 'totalen_wijken_af' elke factuur met een regelkorting.
     Deze test legt dat vast — inclusief precies die val.
     ------------------------------------------------------------------ */
  t.group('genormaliseerde payload van de factuureditor');
  {
    const editorFactuur = goedeFactuur({
      pricesIncludeVat: false,
      lines: [
        { type: 'heading', description: 'Ontwerp' },
        { type: 'item', description: 'Ontwerpuren', unit: 'uur',
          quantityMicro: 12500000, unitPriceCents: 8500, priceIncludesVat: false,
          discountType: 'none', discountValue: 0, taxCode: 'NL21' },
        { type: 'item', description: 'Tooling', unit: 'stuk',
          quantityMicro: 1000000, unitPriceCents: 240000, priceIncludesVat: false,
          discountType: 'percent', discountValue: 10000, taxCode: 'NL21' }
      ],
      surcharges: [{ label: 'Verzendkosten', amountCents: 4500, taxCode: 'NL21' }],
      discount: { type: 'percent', value: 5000 }
    });
    const res = await post({ secret: SECRET, invoice: editorFactuur, intent: 'finalize' });
    const b = await readJson(res);
    t.true(b.ok, 'de genormaliseerde payload van de editor wordt goedgekeurd');
    t.eq(b.totals.lineDiscountCents, 24000,
      'de regelkorting van 10% over € 2.400,00 komt op de server aan als € 240,00 — niet als nul');
    t.true(b.totals.invoiceDiscountCents > 0, 'en de factuurkorting rekent mee');
    t.eq(b.lines.length, 3, 'de tussenkop komt mee als regel');
    t.false(b.lines[0].counts, 'maar telt niet mee in enig bedrag');

    /* en dan waar het echt om gaat: dezelfde totalen geven groen, één cent
       verschil geeft rood */
    const gelijk = await readJson(await post({
      secret: SECRET, invoice: editorFactuur, intent: 'finalize',
      claimedTotals: {
        totalExclCents: b.totals.totalExclCents,
        vatCents: b.totals.vatCents,
        totalInclCents: b.totals.totalInclCents
      }
    }));
    t.true(gelijk.ok, 'browser en server komen op exact hetzelfde uit');
    const scheef = await readJson(await post({
      secret: SECRET, invoice: editorFactuur, intent: 'finalize',
      claimedTotals: { totalInclCents: b.totals.totalInclCents + 1 }
    }));
    t.false(scheef.ok, 'één cent verschil blokkeert het definitief maken alsnog');
    t.true(scheef.errors.some((e) => e.code === 'totalen_wijken_af'), 'met de juiste foutcode');
  }

  /* omgeving netjes terugzetten */
  if (vorig === undefined) delete process.env.NOTIFY_SHARED_SECRET;
  else process.env.NOTIFY_SHARED_SECRET = vorig;
}
