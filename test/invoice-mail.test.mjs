/* CUSTOM+ — fase 4: tokens, webhook-idempotentie en statusafleiding.
   ------------------------------------------------------------------
   Drie dingen worden hier vastgelegd omdat ze stil kunnen breken:

   1. DE TOKENGENERATIE. Een token dat korter, voorspelbaarder of uit een
      ander alfabet wordt, is nog steeds "een string die werkt" — de
      klantlink blijft openen en niets in de UI verandert. Alleen een test
      merkt dat de entropie is weggezakt.

   2. DE IDEMPOTENTIE. Een webhook die twee keer wordt afgeleverd, hoort
      één rij op te leveren. In Supabase doet een unieke index dat; in
      demomodus doet isDuplicateEvent() dat. Beide moeten dezelfde regel
      hanteren, anders klopt de tijdlijn in de ene modus wel en in de
      andere niet.

   3. DE STATUSAFLEIDING. 'verstuurd' en 'bezorgd' zijn twee verschillende
      dingen. De verleiding om na een geslaagde verzending 'bezorgd' te
      tonen is groot en de test hieronder is de rem daarop.
   ------------------------------------------------------------------ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import '../portal/invoice-mail.js';
/* advies 35: de statusvertaler van het portaal is de referentie voor de
   vier woorden in de mail — beide worden hieronder naast elkaar gelegd */
import * as portaalModule from '../portal/portaal-model.js';

const M = globalThis.CP_INVOICE_MAIL;
const PORTAAL = (portaalModule && portaalModule.default) || globalThis.CP_PORTAAL;

/* de browserlaag nabootsen vóór het woordenboek geladen wordt — zelfde
   truc als in i18n-invoice.test.mjs, zodat portal/i18n.js gewoon
   geïmporteerd kan worden zoals de browser hem laadt */
const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
if (!hadWindow) globalThis.window = globalThis;
await import('../portal/i18n.js');
const DICTS = globalThis.CP_PORTAL_I18N;
if (!hadWindow) delete globalThis.window;

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/* een willekeurbron met bekende inhoud, zodat de uitkomst narekenbaar is */
function fixedBytes(fill) {
  return function (n) {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) b[i] = typeof fill === 'function' ? fill(i) : fill;
    return b;
  };
}

export default async function (t) {

  /* ============================================================
     1. TOKENGENERATIE — ENTROPIE EN VORM
     ============================================================ */
  t.group('token: vorm');

  const tok = M.newToken();
  t.eq(typeof tok, 'string', 'newToken geeft een string terug');
  t.eq(tok.length, 43, 'een token is 43 tekens lang (32 bytes als base64url)');
  t.true(M.TOKEN_RE.test(tok), 'een token bevat uitsluitend base64url-tekens');
  t.true(M.tokenLooksValid(tok), 'een vers token komt door tokenLooksValid');

  t.eq(M.TOKEN_BYTES, 32, 'er worden 32 bytes gebruikt, dus 256 bits entropie');

  /* het aantal opgevraagde bytes is de entropie: vraagt iemand er ooit
     minder op, dan valt dat hier om */
  let gevraagd = 0;
  M.newToken(function (n) { gevraagd = n; return new Uint8Array(n); });
  t.eq(gevraagd, 32, 'newToken vraagt precies 32 bytes aan de willekeurbron');

  /* een bron die te weinig levert wordt geweigerd in plaats van stil een
     kort token te maken */
  t.throws(function () {
    M.newToken(function () { return new Uint8Array(8); });
  }, 'een willekeurbron die te weinig bytes levert wordt geweigerd');
  t.throws(function () {
    M.newToken(function () { return null; });
  }, 'een willekeurbron die niets levert wordt geweigerd');

  t.group('token: bytes werken echt door');

  /* 32 nulbytes zijn 43 keer de eerste letter van het alfabet — als er
     ergens een byte wordt weggegooid of hergebruikt, klopt dit niet meer */
  t.eq(M.newToken(fixedBytes(0)), 'A'.repeat(43), '32 nulbytes geven 43 keer A');

  /* kruiscontrole met Node's eigen base64url: dezelfde 32 bytes moeten
     dezelfde tekst opleveren als de standaardimplementatie */
  const oplopend = new Uint8Array(32);
  for (let i = 0; i < 32; i++) oplopend[i] = i * 7 % 256;
  const eigen = M.bytesToBase64Url(oplopend);
  const node = Buffer.from(oplopend).toString('base64url');
  t.eq(eigen, node, 'de eigen base64url komt exact overeen met die van Node');

  /* elke byte moet doorwerken: één byte anders geeft een ander token */
  const a1 = M.newToken(fixedBytes(function (i) { return i; }));
  const a2 = M.newToken(fixedBytes(function (i) { return i === 31 ? 1 : i; }));
  t.true(a1 !== a2, 'een verschil in de laatste byte geeft een ander token');

  t.group('token: uniek');

  /* 2000 echte tokens: geen enkele mag dubbel zijn. Dit vangt de klassieke
     fout van een gecachte buffer die niet opnieuw wordt gevuld. */
  const gezien = Object.create(null);
  let dubbel = 0;
  for (let i = 0; i < 2000; i++) {
    const x = M.newToken();
    if (gezien[x]) dubbel++;
    gezien[x] = true;
  }
  t.eq(dubbel, 0, '2000 tokens achter elkaar leveren geen enkele dubbele op');

  /* grove verdeelcontrole: over 2000 tokens van 43 tekens moet elk van de
     64 alfabettekens voorkomen. Bij een kapotte bron (altijd dezelfde
     byte, of alleen de lage 4 bits) valt dit meteen om. */
  const tekens = Object.create(null);
  Object.keys(gezien).forEach(function (x) {
    for (let i = 0; i < x.length; i++) tekens[x[i]] = true;
  });
  t.true(Object.keys(tekens).length >= 60,
    'over 2000 tokens komt vrijwel het hele base64url-alfabet voor (' + Object.keys(tekens).length + '/64)');

  t.group('token: afgekeurde vormen');
  t.false(M.tokenLooksValid(''), 'een leeg token is ongeldig');
  t.false(M.tokenLooksValid('A'.repeat(42)), 'een token van 42 tekens is ongeldig');
  t.false(M.tokenLooksValid('A'.repeat(44)), 'een token van 44 tekens is ongeldig');
  t.false(M.tokenLooksValid('A'.repeat(42) + '+'), 'een plus hoort niet in base64url');
  t.false(M.tokenLooksValid('A'.repeat(42) + '/'), 'een schuine streep hoort niet in base64url');
  t.false(M.tokenLooksValid('A'.repeat(42) + '='), 'padding hoort er niet in');
  t.false(M.tokenLooksValid(null), 'null is geen token');
  t.false(M.tokenLooksValid(12345), 'een getal is geen token');

  t.group('token: hash');

  /* de bekende SHA-256-testvector; hiermee staat vast dat we echt SHA-256
     doen en niet iets dat er alleen op lijkt */
  const h = await M.sha256Hex('abc');
  t.eq(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'sha256Hex("abc") komt overeen met de bekende testvector');
  t.eq(h.length, 64, 'een SHA-256-hash is 64 hextekens');

  const hTok = await M.sha256Hex(tok);
  const hTok2 = await M.sha256Hex(tok);
  t.eq(hTok, hTok2, 'dezelfde invoer geeft dezelfde hash');
  const hAnder = await M.sha256Hex(tok.slice(0, 42) + (tok[42] === 'A' ? 'B' : 'A'));
  t.true(hTok !== hAnder, 'een token dat één teken verschilt geeft een andere hash');

  t.group('token: intrekken en verlopen');

  const nu = '2026-05-01T12:00:00.000Z';
  t.eq(M.tokenState({ revokedAt: null, expiresAt: null }, nu).usable, true,
    'een token zonder intrekking en zonder vervaldatum is bruikbaar');
  t.eq(M.tokenState({ revokedAt: '2026-04-30T00:00:00.000Z' }, nu).code, 'ingetrokken',
    'een ingetrokken token is niet meer bruikbaar');
  t.eq(M.tokenState({ revokedAt: '2026-04-30T00:00:00.000Z' }, nu).usable, false,
    'een ingetrokken token geeft usable:false');
  /* ook een token dat NA het intrekken nog niet verlopen is, blijft dicht:
     intrekken wint altijd */
  t.eq(M.tokenState({ revokedAt: nu, expiresAt: '2099-01-01T00:00:00.000Z' }, nu).code, 'ingetrokken',
    'intrekken wint van een vervaldatum die nog ver weg ligt');
  t.eq(M.tokenState({ expiresAt: '2026-04-30T00:00:00.000Z' }, nu).code, 'verlopen',
    'een token met een verstreken vervaldatum is verlopen');
  t.eq(M.tokenState({ expiresAt: '2026-05-02T00:00:00.000Z' }, nu).code, 'geldig',
    'een token met een vervaldatum in de toekomst is geldig');
  /* exact op de seconde van verlopen telt als verlopen, niet als geldig */
  t.eq(M.tokenState({ expiresAt: nu }, nu).code, 'verlopen',
    'precies op het vervalmoment is het token verlopen');
  t.eq(M.tokenState(null, nu).code, 'onbekend', 'een onbekende tokenrij geeft "onbekend"');
  /* de snake_case-vorm uit de database moet net zo goed werken */
  t.eq(M.tokenState({ revoked_at: nu }, nu).code, 'ingetrokken',
    'ook de snake_case-kolomnamen uit de database worden gelezen');

  t.group('token: de link');

  const url = M.tokenUrl('https://custom-plus.nl/factuur.html', tok);
  t.eq(url, 'https://custom-plus.nl/factuur.html#t=' + tok,
    'het token staat in het hash-deel, niet in de query');
  t.true(url.indexOf('?') < 0, 'er staat niets in de query van de klantlink');
  t.eq(M.parseTokenFromHash('#t=' + tok), tok, 'het token wordt uit de hash teruggelezen');
  t.eq(M.parseTokenFromHash(url), tok, 'parseTokenFromHash werkt ook op de hele URL');
  t.eq(M.parseTokenFromHash('#lang=nl&t=' + tok), tok, 'het token wordt ook naast andere hash-velden gevonden');
  t.eq(M.parseTokenFromHash('#'), '', 'een lege hash geeft geen token');
  t.eq(M.parseTokenFromHash(''), '', 'geen hash geeft geen token');
  t.eq(M.tokenUrl('https://x.nl/factuur.html#oud', tok), 'https://x.nl/factuur.html#t=' + tok,
    'een bestaande hash op de basis-URL wordt vervangen, niet aangeplakt');

  /* ============================================================
     2. ONTVANGERS
     ============================================================ */
  t.group('ontvangers');

  const plan = M.planRecipients({
    to: ['klant@voorbeeld.nl'],
    cc: ['boekhouder@voorbeeld.nl', 'klant@voorbeeld.nl'],
    bcc: ['ik@custom-plus.nl', 'kapot']
  });
  t.deep(plan.to, ['klant@voorbeeld.nl'], 'de hoofdontvanger blijft staan');
  t.deep(plan.cc, ['boekhouder@voorbeeld.nl'], 'een cc die al in "aan" staat wordt weggelaten');
  t.deep(plan.bcc, ['ik@custom-plus.nl'], 'een ongeldig bcc-adres wordt weggelaten');
  t.eq(plan.dropped.length, 2, 'er wordt bijgehouden wat er is weggelaten en waarom');
  t.eq(plan.total, 3, 'het totaal telt alleen de adressen die overblijven');
  /* hoofdletters mogen geen dubbele verzending opleveren */
  const plan2 = M.planRecipients({ to: ['Klant@Voorbeeld.nl'], cc: ['klant@voorbeeld.nl'] });
  t.eq(plan2.cc.length, 0, 'hetzelfde adres met andere hoofdletters telt als dubbel');

  t.deep(M.splitAddresses('a@b.nl, c@d.nl; e@f.nl'), ['a@b.nl', 'c@d.nl', 'e@f.nl'],
    'komma, puntkomma en regeleinde scheiden allemaal adressen');
  t.deep(M.splitAddresses(''), [], 'een lege tekst geeft geen adressen');

  /* ============================================================
     3. STATUSAFLEIDING UIT GEBEURTENISSEN
     ============================================================ */
  t.group('status: verstuurd is niet bezorgd');

  function ev(event, tijd, extra) {
    return Object.assign({ event: event, occurredAt: tijd }, extra || {});
  }

  const leeg = M.deliveryState([]);
  t.eq(leeg.status, 'nooit_verstuurd', 'zonder gebeurtenissen is er niets verstuurd');
  t.eq(leeg.webhookNeeded, false, 'zonder verzending is er ook geen ontbrekend bezorgbericht');

  const alleenGepland = M.deliveryState([ev('queued', '2026-05-01T09:00:00Z')]);
  t.eq(alleenGepland.status, 'ingepland', 'alleen een inplanning is "ingepland"');

  const verstuurd = M.deliveryState([
    ev('queued', '2026-05-01T09:00:00Z'),
    ev('sent', '2026-05-01T09:00:05Z', { mailMessageId: 'msg-1', recipient: 'klant@voorbeeld.nl' })
  ]);
  t.eq(verstuurd.status, 'verstuurd', 'verzonden zonder bezorgbericht blijft "verstuurd"');
  t.eq(verstuurd.webhookNeeded, true, 'dan staat er expliciet dat de bezorgstatus onbekend is');
  t.deep(verstuurd.messageIds, ['msg-1'], 'het Resend message-id wordt bewaard');
  t.deep(verstuurd.recipients, ['klant@voorbeeld.nl'], 'de ontvanger wordt bewaard');
  t.eq(verstuurd.attempts, 1, 'er is één verzendpoging geteld');

  const bezorgd = M.deliveryState([
    ev('sent', '2026-05-01T09:00:05Z', { mailMessageId: 'msg-1' }),
    ev('delivered', '2026-05-01T09:00:20Z', { mailMessageId: 'msg-1' })
  ]);
  t.eq(bezorgd.status, 'bezorgd', 'met een bezorgbericht is de status "bezorgd"');
  t.eq(bezorgd.webhookNeeded, false, 'dan is er niets meer onbekend');
  t.eq(bezorgd.deliveredAt, '2026-05-01T09:00:20Z', 'het bezorgmoment wordt bewaard');

  t.group('status: bounce, klacht en fout');

  const gebounced = M.deliveryState([
    ev('sent', '2026-05-01T09:00:05Z'),
    ev('delivered', '2026-05-01T09:00:20Z'),
    ev('bounced', '2026-05-01T09:05:00Z', { detail: 'mailbox full' })
  ]);
  t.eq(gebounced.status, 'gebounced', 'een bounce ná de bezorging wint van de bezorging');
  t.eq(gebounced.lastError, 'mailbox full', 'de reden van de bounce wordt bewaard');

  const geklaagd = M.deliveryState([
    ev('sent', '2026-05-01T09:00:00Z'),
    ev('delivered', '2026-05-01T09:00:10Z'),
    ev('complained', '2026-05-02T10:00:00Z')
  ]);
  t.eq(geklaagd.status, 'geklaagd', 'een spamklacht is het zwaarste signaal en wint van alles');

  /* opnieuw verstuurd ná een bounce: de oude bounce mag de nieuwe poging
     niet meer overschaduwen — anders blijft een opgeloste bounce eeuwig
     rood staan */
  const opnieuw = M.deliveryState([
    ev('sent', '2026-05-01T09:00:00Z'),
    ev('bounced', '2026-05-01T09:01:00Z', { detail: 'typfout in het adres' }),
    ev('sent', '2026-05-01T10:00:00Z'),
    ev('delivered', '2026-05-01T10:00:30Z')
  ]);
  t.eq(opnieuw.status, 'bezorgd', 'na een corrigerende tweede verzending telt de nieuwe uitkomst');
  t.eq(opnieuw.attempts, 2, 'beide verzendpogingen zijn geteld');

  const mislukt = M.deliveryState([ev('failed', '2026-05-01T09:00:00Z', { detail: 'upstream-502' })]);
  t.eq(mislukt.status, 'mislukt', 'een mislukte verzendpoging zonder verzending is "mislukt"');
  t.eq(mislukt.lastError, 'upstream-502', 'de foutmelding wordt bewaard');

  /* een oude mislukking vóór een geslaagde verzending mag niet blijven
     hangen als eindstatus */
  const herstel = M.deliveryState([
    ev('failed', '2026-05-01T08:00:00Z', { detail: 'netwerkfout' }),
    ev('sent', '2026-05-01T09:00:00Z')
  ]);
  t.eq(herstel.status, 'verstuurd', 'een geslaagde verzending ná een mislukking wint');

  t.group('status: weergave en downloads door de klant');

  const bekeken = M.deliveryState([
    ev('sent', '2026-05-01T09:00:00Z'),
    ev('delivered', '2026-05-01T09:00:10Z'),
    ev('portal_viewed', '2026-05-01T11:00:00Z'),
    ev('pdf_downloaded', '2026-05-01T11:00:30Z'),
    ev('portal_viewed', '2026-05-03T08:00:00Z'),
    ev('pdf_downloaded', '2026-05-03T08:00:20Z')
  ]);
  t.eq(bekeken.firstViewedAt, '2026-05-01T11:00:00Z', 'de eerste weergave van de klantpagina wordt bewaard');
  t.eq(bekeken.lastViewedAt, '2026-05-03T08:00:00Z', 'de laatste weergave ook');
  t.eq(bekeken.viewCount, 2, 'het aantal weergaven wordt geteld');
  t.eq(bekeken.downloadCount, 2, 'het aantal downloads wordt geteld');
  t.eq(bekeken.status, 'bezorgd', 'een weergave verandert de bezorgstatus niet');

  /* volgorde mag niet uitmaken: de afleiding sorteert zelf op tijd */
  const doorElkaar = M.deliveryState([
    ev('delivered', '2026-05-01T09:00:10Z'),
    ev('portal_viewed', '2026-05-01T11:00:00Z'),
    ev('sent', '2026-05-01T09:00:00Z')
  ]);
  t.eq(doorElkaar.status, 'bezorgd', 'de afleiding sorteert zelf op tijd, ongeacht de volgorde in de lijst');
  t.eq(doorElkaar.sentAt, '2026-05-01T09:00:00Z', 'het verzendmoment blijft correct bij een onsorteerde lijst');

  /* de snake_case-vorm uit de database moet net zo goed werken */
  const snake = M.deliveryState([
    { event: 'sent', occurred_at: '2026-05-01T09:00:00Z', mail_message_id: 'm-9', template_key: 'factuur' },
    { event: 'delivered', occurred_at: '2026-05-01T09:00:10Z' }
  ]);
  t.eq(snake.status, 'bezorgd', 'de databasevorm (snake_case) wordt net zo gelezen');
  t.deep(snake.messageIds, ['m-9'], 'mail_message_id wordt ook gelezen');
  t.eq(snake.lastTemplate, 'factuur', 'het gebruikte sjabloon wordt bewaard');

  /* ============================================================
     4. WEBHOOK — VERTALING EN IDEMPOTENTIE
     ============================================================ */
  t.group('webhook: vertaling van een Resend-bericht');

  const bezorgBericht = {
    type: 'email.delivered',
    created_at: '2026-05-01T09:00:20.000Z',
    data: { email_id: 're_123', to: ['klant@voorbeeld.nl'], subject: 'Factuur CP-2026-00007' }
  };
  const genorm = M.normalizeResendEvent(bezorgBericht, { eventId: 'msg_svix_1' });
  t.eq(genorm.event, 'delivered', 'email.delivered wordt de gebeurtenis "delivered"');
  t.eq(genorm.messageId, 're_123', 'het Resend message-id wordt overgenomen');
  t.eq(genorm.recipient, 'klant@voorbeeld.nl', 'de ontvanger wordt overgenomen');
  t.eq(genorm.eventId, 'msg_svix_1', 'de svix-id wordt de idempotentiesleutel');
  t.eq(genorm.occurredAt, '2026-05-01T09:00:20.000Z', 'het moment komt uit het bericht, niet van onze klok');

  const bounce = M.normalizeResendEvent({
    type: 'email.bounced',
    created_at: '2026-05-01T09:01:00.000Z',
    data: { email_id: 're_124', to: ['fout@voorbeeld.nl'], bounce: { message: 'Mailbox does not exist' } }
  }, { eventId: 'msg_svix_2' });
  t.eq(bounce.event, 'bounced', 'email.bounced wordt "bounced"');
  t.eq(bounce.detail, 'Mailbox does not exist', 'de reden van de bounce reist mee');

  t.eq(M.normalizeResendEvent({ type: 'email.delivery_delayed', data: {} }, { eventId: 'x' }), null,
    'een vertraging is nog geen uitkomst en wordt genegeerd');
  t.eq(M.normalizeResendEvent({ type: 'contact.created', data: {} }, { eventId: 'x' }), null,
    'een onbekend berichttype wordt genegeerd');
  t.eq(M.normalizeResendEvent(null, {}), null, 'een leeg bericht wordt genegeerd');
  t.eq(M.normalizeResendEvent('nope', {}), null, 'een bericht dat geen object is wordt genegeerd');

  t.group('webhook: openingsregistratie staat uit tenzij expliciet aan');

  const opening = { type: 'email.opened', created_at: '2026-05-01T12:00:00Z', data: { email_id: 're_1' } };
  t.eq(M.normalizeResendEvent(opening, { eventId: 'e1' }), null,
    'een opening wordt standaard WEGGEGOOID, ook als Resend hem stuurt');
  t.eq(M.normalizeResendEvent(opening, { eventId: 'e1', allowOpen: false }), null,
    'expliciet uit is ook uit');
  const openingAan = M.normalizeResendEvent(opening, { eventId: 'e1', allowOpen: true });
  t.eq(openingAan && openingAan.event, 'opened',
    'alleen met de instelling expliciet aan wordt een opening vastgelegd');
  const klik = { type: 'email.clicked', created_at: '2026-05-01T12:00:00Z', data: { email_id: 're_1' } };
  t.eq(M.normalizeResendEvent(klik, { eventId: 'e2' }), null,
    'een kliklogging valt onder dezelfde instelling en staat dus ook standaard uit');

  t.group('webhook: idempotentie');

  const bestaand = [
    { event: 'sent', providerEventId: '', occurredAt: '2026-05-01T09:00:00Z' },
    { event: 'delivered', providerEventId: 'msg_svix_1', occurredAt: '2026-05-01T09:00:20Z' }
  ];
  t.true(M.isDuplicateEvent(bestaand, 'msg_svix_1'),
    'dezelfde svix-id een tweede keer is een dubbele en landt niet nog eens');
  t.false(M.isDuplicateEvent(bestaand, 'msg_svix_2'),
    'een nieuwe svix-id is geen dubbele');
  t.false(M.isDuplicateEvent(bestaand, ''),
    'onze eigen gebeurtenissen hebben geen provider-id en mogen vaker voorkomen');
  t.false(M.isDuplicateEvent([], 'msg_svix_1'), 'in een lege lijst is niets dubbel');
  t.true(M.isDuplicateEvent([{ provider_event_id: 'msg_svix_9' }], 'msg_svix_9'),
    'ook de snake_case-kolom uit de database telt mee');

  /* de hele beweging: drie keer hetzelfde bericht afleveren mag precies
     één rij opleveren — dit is de regel die de unieke index in Supabase en
     de demomodus allebei volgen */
  const rijen = [];
  for (let i = 0; i < 3; i++) {
    const e = M.normalizeResendEvent(bezorgBericht, { eventId: 'msg_svix_1' });
    if (!M.isDuplicateEvent(rijen, e.eventId)) {
      rijen.push({ event: e.event, providerEventId: e.eventId, occurredAt: e.occurredAt });
    }
  }
  t.eq(rijen.length, 1, 'drie keer dezelfde aflevering geeft precies één rij');
  t.eq(M.deliveryState(rijen).status, 'bezorgd', 'en de afgeleide status blijft kloppen');

  /* twee VERSCHILLENDE gebeurtenissen over dezelfde mail moeten er wél
     allebei in */
  const e2 = M.normalizeResendEvent(bounce ? {
    type: 'email.complained', created_at: '2026-05-02T09:00:00Z', data: { email_id: 're_123' }
  } : null, { eventId: 'msg_svix_3' });
  if (!M.isDuplicateEvent(rijen, e2.eventId)) {
    rijen.push({ event: e2.event, providerEventId: e2.eventId, occurredAt: e2.occurredAt });
  }
  t.eq(rijen.length, 2, 'een andere gebeurtenis over dezelfde mail landt wel');
  t.eq(M.deliveryState(rijen).status, 'geklaagd', 'en verandert de status');

  /* ============================================================
     5. INPLANNEN
     ============================================================ */
  t.group('inplannen');

  const wachtrij = [
    { id: 'a', status: 'gepland', sendAt: '2026-05-01T08:00:00Z' },
    { id: 'b', status: 'gepland', sendAt: '2026-05-01T10:00:00Z' },
    { id: 'c', status: 'gepland', sendAt: '2026-05-02T10:00:00Z' },
    { id: 'd', status: 'verzonden', sendAt: '2026-04-01T10:00:00Z' },
    { id: 'e', status: 'geannuleerd', sendAt: '2026-04-01T10:00:00Z' }
  ];
  const nuIso = '2026-05-01T10:00:00Z';
  const aanDeBeurt = M.dueSchedules(wachtrij, nuIso);
  t.deep(aanDeBeurt.map(function (s) { return s.id; }), ['a', 'b'],
    'alleen geplande verzendingen waarvan het moment is bereikt zijn aan de beurt');
  t.eq(M.dueSchedules(wachtrij, '2026-04-01T00:00:00Z').length, 0,
    'vóór het eerste moment is er niets aan de beurt');
  t.eq(M.dueSchedules(wachtrij, '2026-06-01T00:00:00Z').length, 3,
    'later zijn alle drie de geplande verzendingen aan de beurt');
  t.eq(M.dueSchedules([], nuIso).length, 0, 'een lege wachtrij levert niets op');

  /* ============================================================
     6. WAT DE KLANT WEL EN NIET TE ZIEN KRIJGT
     ============================================================ */
  t.group('klantpagina: de filter');

  const snapshot = {
    docKind: 'invoice',
    invoiceNumber: 'CP-2026-00007',
    invoiceDate: '2026-05-01',
    dueDate: '2026-05-15',
    currency: 'EUR',
    minorUnits: 2,
    language: 'nl',
    seller: { name: 'CUSTOM+', iban: 'NL91ABNA0417164300', vatNumber: 'NL001234567B01', geheim: 'mag niet mee' },
    buyer: { name: 'Voorbeeld BV', address: 'Straat 1' },
    lines: [
      { type: 'item', description: 'Ontwerpuren', quantityMicro: 12500000, unitPriceCents: 8500,
        netExclCents: 106250, vatCents: 22313, inclCents: 128563, ledgerRef: '8000' }
    ],
    taxGroups: [{ taxCode: 'NL21', rateMilli: 21000, baseCents: 106250, vatCents: 22313 }],
    totals: { totalExclCents: 106250, vatCents: 22313, totalInclCents: 128563, paidCents: 0, outstandingCents: 128563 }
  };
  const view = M.clientView(snapshot, {
    statusCode: 'sent', payUrl: 'https://pay.example/x', projectName: 'Lamp', pdfAvailable: true
  });
  t.eq(view.invoiceNumber, 'CP-2026-00007', 'het factuurnummer gaat mee');
  t.eq(view.totals.totalInclCents, 128563, 'het totaal incl. btw gaat mee, in centen');
  t.eq(view.totals.outstandingCents, 128563, 'het openstaande bedrag gaat mee');
  t.eq(view.seller.iban, 'NL91ABNA0417164300', 'de IBAN gaat mee — die staat toch al op elke factuur');
  t.eq(view.seller.vatNumber, 'NL001234567B01', 'het btw-nummer van de verkoper gaat mee, onder exact de snapshot-veldnaam');
  t.eq(view.seller.geheim, undefined, 'een onbekend veld op de verkoper komt er NIET doorheen');
  t.eq(view.lines[0].ledgerRef, undefined, 'de grootboekreferentie is intern en gaat niet mee');
  t.eq(view.payUrl, 'https://pay.example/x', 'de betaallink gaat mee als hij is ingevuld');
  t.eq(view.pdfAvailable, true, 'de klantpagina weet of er een PDF is');

  /* de belangrijkste: interne velden mogen er onder geen beding in zitten */
  const metIntern = M.clientView(Object.assign({}, snapshot, {
    internalNote: 'klant belt altijd te laat', tags: ['risico']
  }), { statusCode: 'sent' });
  const platgeslagen = JSON.stringify(metIntern);
  t.true(platgeslagen.indexOf('klant belt altijd te laat') < 0,
    'de interne notitie komt nooit op de klantpagina terecht');
  t.true(platgeslagen.indexOf('risico') < 0,
    'interne tags komen nooit op de klantpagina terecht');

  /* het openstaande bedrag valt terug op incl. min betaald als de
     opgeslagen waarde ontbreekt — nooit op nul */
  const zonderOpenstaand = M.clientView({
    totals: { totalInclCents: 10000, paidCents: 4000 }
  }, {});
  t.eq(zonderOpenstaand.totals.outstandingCents, 6000,
    'zonder opgeslagen openstaand bedrag wordt het berekend uit totaal min betaald');

  t.group('klantpagina: de status die de klant leest');

  t.eq(M.clientStatus('sent', 12856, '2026-05-15', '2026-05-01T00:00:00Z'), 'open',
    'een openstaande factuur vóór de vervaldatum is "open"');
  t.eq(M.clientStatus('sent', 12856, '2026-05-15', '2026-05-20T00:00:00Z'), 'verlopen',
    'na de vervaldatum is hij "verlopen"');
  t.eq(M.clientStatus('partially_paid', 5000, '2026-05-15', '2026-05-01T00:00:00Z'), 'deels_betaald',
    'een deelbetaling is "deels betaald"');
  t.eq(M.clientStatus('sent', 0, '2026-05-15', '2026-05-20T00:00:00Z'), 'betaald',
    'nul openstaand is betaald, ook als de status nog "sent" zegt');
  t.eq(M.clientStatus('paid', 0, '2026-05-15', '2026-05-20T00:00:00Z'), 'betaald',
    'een betaalde factuur is betaald');
  t.eq(M.clientStatus('cancelled', 12856, '2026-05-15', '2026-05-20T00:00:00Z'), 'geannuleerd',
    'een geannuleerde factuur toont dat, ook al staat er nog een bedrag open');
  t.eq(M.clientStatus('credited', 12856, '2026-05-15', '2026-05-20T00:00:00Z'), 'gecrediteerd',
    'een gecrediteerde factuur toont dat');
  /* beheerstaal hoort niet op een klantpagina */
  t.eq(M.clientStatus('disputed', 12856, '2026-05-15', '2026-05-01T00:00:00Z'), 'open',
    'interne codes als "disputed" vallen terug op "open" — dat is beheerstaal');
  t.eq(M.clientStatus('uncollectible', 12856, '2026-05-15', '2026-05-01T00:00:00Z'), 'open',
    'interne codes als "uncollectible" ook');

  /* ============================================================
     7. DE KLANTPAGINA IN VIJF TALEN
     ============================================================
     De huisregel is: NL is de bron, en elke klantzichtbare string krijgt
     en/de/fr/es. Die regel is makkelijk te vergeten bij het toevoegen van
     één zinnetje aan factuur.html. Deze test vergeet hem niet: hij leest
     de pagina zelf en faalt bij het eerste gat.
     ============================================================ */
  t.group('klantpagina: vijf talen');

  const pagina = readFileSync(ROOT + 'factuur.html', 'utf8');
  const talen = ['en', 'de', 'fr', 'es'];
  t.true(!!DICTS, 'portal/i18n.js levert een woordenboek op');
  talen.forEach(function (taal) {
    t.true(!!(DICTS && DICTS[taal]), 'woordenboek ' + taal + ' bestaat');
  });

  /* alle letterlijke i18nT('…') en i18nTpl('…') uit de pagina */
  const bronnen = new Set();
  for (const m of pagina.matchAll(/i18nT(?:pl)?\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    bronnen.add(m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  }
  /* plus de strings die via een tabel door i18nT() gaan: de foutredenen,
     de statusnamen, de kolomkoppen, de veldlabels en de eenheden */
  [
    'Deze link is ingetrokken. Vraag om een nieuwe link.',
    'Deze link is verlopen. Vraag om een nieuwe link.',
    'Deze link is niet bekend. Controleer of je hem volledig hebt gekopieerd — hij is lang en breekt makkelijk af in een e-mail.',
    'Deze factuur is nog niet definitief. Er valt hier nog niets te tonen.',
    'De factuur kon niet worden geladen. Controleer je verbinding en probeer het zo nog eens.',
    'Deze link werkt niet meer', 'Deze pagina kon niet worden geladen', 'Probeer het zo nog eens.',
    'Betaald', 'Open', 'Deels betaald', 'Verlopen', 'Geannuleerd', 'Gecrediteerd',
    'Omschrijving', 'Aantal', 'Prijs', 'Bedrag',
    'Factuurdatum', 'Vervaldatum', 'Project', 'Jouw referentie', 'Inkoopordernummer',
    'Reeds betaald', 'Totaal excl. btw', 'Totaal incl. btw', 'Openstaand', 'Btw verlegd',
    'uur', 'stuk', 'dag', 'abonnement', 'Factuur', 'Creditnota'
  ].forEach(function (s) { bronnen.add(s); });

  t.true(bronnen.size > 50, 'de klantpagina levert een flinke set bronstrings op (' + bronnen.size + ')');

  const gaten = [];
  bronnen.forEach(function (s) {
    talen.forEach(function (taal) {
      const d = DICTS && DICTS[taal];
      if (!d || typeof d[s] !== 'string' || !d[s]) gaten.push(taal + ': ' + s);
    });
  });
  t.eq(gaten.length, 0, 'elke klantzichtbare string van factuur.html staat in alle vier de woordenboeken' +
    (gaten.length ? ' — ontbreekt: ' + gaten.slice(0, 5).join(' | ') : ''));

  /* de mail zelf is ook klantzichtbaar: de knoptekst en de labels van de
     gegevensstrook (factuurnummer, bedrag, vervaldatum) reizen vanuit
     beheer.html mee naar notify-client.mjs en worden daar letterlijk
     afgedrukt. Ze horen dus in dezelfde vier woordenboeken. */
  ['Bekijk je factuur', 'Factuurnummer', 'Bedrag', 'Vervaldatum'].forEach(function (s) {
    talen.forEach(function (taal) {
      const d = DICTS && DICTS[taal];
      t.true(!!(d && typeof d[s] === 'string' && d[s]),
        taal + ': "' + s + '" (klantzichtbaar in de factuurmail) is vertaald');
    });
  });

  /* de sjabloonsleutels moeten hun plaatshouder houden: een vertaling die
     {datum} kwijtraakt, toont de klant een zin zonder datum */
  ['Te betalen vóór {datum}.', 'De vervaldatum van {datum} is verstreken.'].forEach(function (s) {
    talen.forEach(function (taal) {
      const v = DICTS[taal][s];
      t.true(typeof v === 'string' && v.indexOf('{datum}') >= 0,
        taal + ': de vertaling van "' + s + '" houdt de plaatshouder {datum}');
    });
  });

  /* de pagina mag geen innerHTML met data gebruiken — DOM via
     createElement/textContent is hier de huisregel en dit is de bewaker */
  t.false(/\.\s*(innerHTML|outerHTML)\s*=/.test(pagina),
    'factuur.html schrijft nergens naar innerHTML of outerHTML');
  t.false(/insertAdjacentHTML/.test(pagina),
    'factuur.html gebruikt ook geen insertAdjacentHTML');

  /* en het token hoort nooit in een query-parameter te belanden */
  t.true(pagina.indexOf('?t=') < 0, 'het token staat nergens als query-parameter in de pagina');

  /* ============================================================
     7b. DE VIER WOORDEN VAN DE KLANT — OOK IN DE MAIL (advies 35)
     ============================================================
     Het portaal laat de klant vier woorden lezen (Open · Gemeld · Betaald ·
     Bezwaar) en een mail hoort er niet anders over te praten. De vertaler
     staat in invoice-mail.js zodat de browser en notify-client.mjs
     dezelfde lezen; hieronder staat vast dat hij (1) de goede woorden
     geeft, (2) woordelijk dezelfde rangorde volgt als
     factuurStatusVoorKlant() in portaal-model.js, (3) nooit beheerstaal
     laat lezen en (4) bedragen en datums schrijft zoals het portaal.
     ============================================================ */
  t.group('klantmail: de vier woorden');

  const vandaag = '2026-05-01';
  const deels = M.klantStatus({ statusCode: 'partially_paid', totalInclCents: 312500, paidCents: 100000, dueDate: '2026-05-15', currency: 'EUR' }, vandaag);
  t.eq(deels.woord, 'Open', 'een deels betaalde factuur heet "Open", niet "Deels betaald"');
  t.eq(deels.toelichting, '{betaald} van {totaal} ontvangen', 'met de toelichting "{betaald} van {totaal} ontvangen"');
  t.eq(M.statusRegel(deels, 'nl'), 'Open · € 1.000 van € 3.125 ontvangen',
    'en leest in de mail als "Open · € 1.000 van € 3.125 ontvangen" — hele bedragen zonder centen');

  const gemeld = M.klantStatus({ statusCode: 'sent', totalInclCents: 312500, paidCents: 0, dueDate: '2026-05-15' }, vandaag, { gemeld: true });
  t.eq(gemeld.woord, 'Gemeld', 'een gemelde betaling heet "Gemeld"');
  t.eq(M.statusRegel(gemeld, 'nl'), 'Gemeld · Steffan controleert je betaling', 'met de toelichting dat Steffan controleert');
  const gemeldBezwaar = M.klantStatus({ statusCode: 'disputed', totalInclCents: 312500, paidCents: 0 }, vandaag, { gemeld: [{ verifiedAt: null }] });
  t.eq(gemeldBezwaar.woord, 'Gemeld', 'gemeld wint van bezwaar — de melding is de laatste handeling van de klant');
  const gemeldBevestigd = M.klantStatus({ statusCode: 'sent', totalInclCents: 312500, paidCents: 0 }, vandaag, { gemeld: [{ verifiedAt: '2026-04-30' }] });
  t.eq(gemeldBevestigd.woord, 'Open', 'een al bevestigde melding telt niet meer als gemeld');

  const bezwaar = M.klantStatus({ statusCode: 'disputed', totalInclCents: 312500, paidCents: 0, dueDate: '2026-04-01' }, vandaag);
  t.eq(bezwaar.woord, 'Bezwaar', 'een betwiste factuur heet "Bezwaar"');
  t.eq(bezwaar.toelichting, '', 'zonder toelichting — ook al is de vervaldatum verstreken, de bal ligt bij Steffan');
  t.eq(M.statusRegel(bezwaar, 'nl'), 'Bezwaar', 'en de regel is alleen het woord');

  const betaald = M.klantStatus({ statusCode: 'paid', totalInclCents: 312500, paidCents: 312500 }, vandaag);
  t.eq(M.statusRegel(betaald, 'nl'), 'Betaald', 'een betaalde factuur heet "Betaald"');
  t.eq(M.klantStatus({ statusCode: 'sent', totalInclCents: 312500, paidCents: 312500 }, vandaag).woord, 'Betaald',
    'nul openstaand is "Betaald", ook als de code nog "sent" zegt');

  const teLaat = M.klantStatus({ statusCode: 'overdue', totalInclCents: 312500, paidCents: 0, dueDate: '2026-04-24' }, vandaag);
  t.eq(teLaat.woord, 'Open', 'te laat is geen vijfde woord maar "Open"');
  t.eq(M.statusRegel(teLaat, 'nl'), 'Open · Vervaldatum was 24 apr 2026', 'met de korte datum ernaast');
  const deelsTeLaat = M.klantStatus({ statusCode: 'partially_paid', totalInclCents: 312500, paidCents: 100000, dueDate: '2026-04-24' }, vandaag);
  t.eq(M.statusRegel(deelsTeLaat, 'nl'), 'Open · € 1.000 van € 3.125 ontvangen', 'een deelbetaling die óók te laat is houdt de bedragtoelichting');

  const credit = M.klantStatus({ statusCode: 'credited', totalInclCents: 312500, paidCents: 0, creditedCents: 312500 }, vandaag);
  t.eq(M.statusRegel(credit, 'nl'), 'Betaald · Creditnota, verrekend', 'gecrediteerd is "Betaald" met de creditnota in de toelichting');
  const deelsCredit = M.klantStatus({ statusCode: 'partially_paid', totalInclCents: 312500, paidCents: 50000, creditedCents: 50000, dueDate: '2026-05-15' }, vandaag);
  t.eq(M.statusRegel(deelsCredit, 'nl'), 'Open · € 1.000 van € 3.125 ontvangen',
    '{betaald} telt betaald én verrekend, net als het portaalscherm');
  const geann = M.klantStatus({ statusCode: 'cancelled', totalInclCents: 312500 }, vandaag);
  t.eq(geann.woord, '', 'een geannuleerde factuur heeft geen woord');
  t.eq(M.statusRegel(geann, 'nl'), 'Vervallen', 'alleen de toelichting "Vervallen"');
  t.eq(M.statusRegel(M.klantStatus({ statusCode: 'draft', totalInclCents: 100 }, vandaag), 'nl'), '', 'een concept zegt niets');
  t.eq(M.statusRegel(M.klantStatus(null, vandaag), 'nl'), '', 'geen rij is geen factuur en zegt niets');

  const rij = M.klantStatus({ status_code: 'partially_paid', total_incl_cents: 312500, paid_cents: 100000, due_date: '2026-05-15', currency: 'EUR' }, vandaag);
  t.eq(M.statusRegel(rij, 'nl'), 'Open · € 1.000 van € 3.125 ontvangen', 'een Supabase-rij (snake_case) geeft dezelfde regel');
  const alleenOpen = M.klantStatus({ status_code: 'sent', outstanding_cents: 212500, paid_cents: 100000, due_date: '2026-05-15' }, vandaag);
  t.eq(M.statusRegel(alleenOpen, 'nl'), 'Open · € 1.000 van € 3.125 ontvangen', 'een rij die alleen zijn openstaande bedrag kent, rekent het totaal terug');

  const EN = { 'Stand': 'Status', 'Open': 'Open', 'Betaald': 'Paid', '{betaald} van {totaal} ontvangen': '{betaald} of {totaal} received' };
  const tEn = (s) => EN[s] || s;
  t.eq(M.statusRegel(deels, 'en', tEn), 'Open · €1,000 of €3,125 received', 'in het Engels met de Engelse schrijfwijze van de PDF en het portaal');
  t.deep(M.statusFact(deels, 'nl'), { label: 'Stand', value: 'Open · € 1.000 van € 3.125 ontvangen' }, 'de rij voor de gegevensstrook heet "Stand", net als de kolom in het portaal');
  t.deep(M.statusFact(deels, 'en', tEn), { label: 'Status', value: 'Open · €1,000 of €3,125 received' }, 'en vertaald "Status"');
  t.eq(M.statusFact(M.klantStatus({ statusCode: 'draft' }, vandaag), 'nl'), null, 'een concept levert geen rij op');

  t.group('klantmail: dezelfde rangorde als het portaal');

  t.true(!!(PORTAAL && typeof PORTAAL.factuurStatusVoorKlant === 'function'), 'portaal-model.js levert factuurStatusVoorKlant als referentie');
  const gevallen = [];
  M.STATUS_CODES.forEach(function (code) {
    [[312500, 0, 0], [312500, 100000, 0], [312500, 312500, 0], [312500, 0, 312500], [312500, 100000, 212500], [0, 0, 0]].forEach(function (b) {
      ['2026-04-24', '2026-05-15', ''].forEach(function (due) {
        [false, true].forEach(function (gm) { gevallen.push({ code: code, tot: b[0], paid: b[1], cred: b[2], due: due, gm: gm }); });
      });
    });
  });
  const verschillen = [];
  gevallen.forEach(function (g) {
    const inv = { statusCode: g.code, totalCents: g.tot, paidCents: g.paid, creditedCents: g.cred, dueDate: g.due, currency: 'EUR' };
    const a = M.klantStatus(inv, vandaag, { gemeld: g.gm });
    const b = PORTAAL.factuurStatusVoorKlant(inv, vandaag, { gemeld: g.gm });
    /* 'toon' (de kleur op het scherm) doet bewust niet mee: een mail toont
       geen kleur, en een portaalwijziging aan alleen de kleuren mag deze
       test niet rood maken. Alles wat de klant LEEST staat er wel in. */
    ['woord', 'toelichting', 'stand', 'open', 'deels', 'gemeld', 'bezwaar', 'gesloten', 'betaald', 'verstreken', 'openCents', 'totaalCents', 'betaaldCents', 'gecrediteerdCents', 'vervaltISO'].forEach(function (k) {
      if (a[k] !== b[k]) verschillen.push(g.code + ' ' + g.paid + '/' + g.cred + '/' + g.tot + ' due=' + g.due + ' gemeld=' + g.gm + ' → ' + k + ': ' + JSON.stringify(a[k]) + ' vs ' + JSON.stringify(b[k]));
    });
  });
  t.eq(verschillen.length, 0, 'klantStatus geeft in alle ' + gevallen.length + ' gevallen exact wat factuurStatusVoorKlant geeft' +
    (verschillen.length ? ' — ' + verschillen.slice(0, 3).join(' | ') : ''));
  t.deep(M.STATUS_CODES, PORTAAL.STATUS_CODES || M.STATUS_CODES, 'de lijst van twaalf codes is dezelfde als in het portaal (als het portaal hem exporteert)');

  t.group('klantmail: geen beheerstaal');

  const beheerstaal = M.STATUS_CODES.concat(['Deels betaald', 'Verlopen', 'Definitief', 'Betwist', 'Oninbaar', 'Gecrediteerd', 'Concept', 'Ingepland']);
  function bevatBeheerstaal(tekst) {
    return beheerstaal.filter(function (w) {
      return new RegExp('(^|[^A-Za-z0-9_])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])').test(tekst);
    });
  }
  const lekken = [];
  M.STATUS_CODES.forEach(function (code) {
    [[312500, 0, 0], [312500, 100000, 0], [312500, 312500, 0]].forEach(function (b) {
      [false, true].forEach(function (gm) {
        const st = M.klantStatus({ statusCode: code, totalCents: b[0], paidCents: b[1], creditedCents: b[2], dueDate: '2026-04-24' }, vandaag, { gemeld: gm });
        const regel = M.statusRegel(st, 'nl');
        const fout = bevatBeheerstaal(regel);
        if (fout.length) lekken.push(code + ' → "' + regel + '" bevat ' + fout.join(', '));
        if (regel && ['Open', 'Gemeld', 'Betaald', 'Bezwaar', 'Vervallen'].indexOf(regel.split(' · ')[0]) < 0) lekken.push(code + ' → "' + regel + '" begint niet met een van de vier woorden');
      });
    });
  });
  t.eq(lekken.length, 0, 'geen enkele standregel bevat een interne code of een beheerlabel' + (lekken.length ? ' — ' + lekken.slice(0, 3).join(' | ') : ''));

  t.group('klantmail: bedragen en datums zoals het portaal');

  t.eq(M.mailBedrag(312500, 'EUR', 'nl'), '€ 3.125', 'een heel bedrag krijgt geen centen: "€ 3.125"');
  t.eq(M.mailBedrag(312550, 'EUR', 'nl'), '€ 3.125,50', 'centen blijven staan als ze er zijn');
  t.eq(M.mailBedrag(312505, 'EUR', 'nl'), '€ 3.125,05', 'ook een enkele cent, met voorloopnul');
  t.eq(M.mailBedrag(0, 'EUR', 'nl'), '€ 0', 'nul is "€ 0"');
  t.eq(M.mailBedrag(-2550, 'EUR', 'nl'), '-€ 25,50', 'het minteken staat vóór het valutateken, zoals op de PDF');
  t.eq(M.mailBedrag(312500, 'USD', 'nl'), '$ 3.125', 'dollars met het dollarteken');
  t.eq(M.mailBedrag(1250, 'SEK', 'nl'), 'SEK 12,50', 'een munt zonder teken krijgt zijn ISO-code');
  t.eq(M.mailBedrag(312500, 'EUR', 'en'), '€3,125', 'Engels: komma als duizendtal, teken zonder spatie — de schrijfwijze van de PDF');
  t.eq(M.mailBedrag(312550, 'EUR', 'en'), '€3,125.50', 'Engels: punt als decimaal');
  t.eq(M.mailBedrag(312500, 'EUR', 'de'), '3.125 €', 'Duits: het teken achter het bedrag');
  t.eq(M.mailBedrag('312500', 'EUR', 'nl'), '€ 3.125', 'een tekstgetal in centen wordt gelezen');

  t.eq(M.mailDatum('2026-04-24', 'nl'), '24 apr 2026', 'een datum is kort: "24 apr 2026"');
  t.eq(M.mailDatum('2026-03-03', 'nl'), '3 mrt 2026', 'zonder voorloopnul, met de Nederlandse afkorting mrt');
  t.eq(M.mailDatum('2026-04-24T10:00:00Z', 'nl'), '24 apr 2026', 'een tijdstempel wordt op de dag afgekapt');
  t.eq(M.mailDatum('2026-04-24', 'en'), '24 Apr 2026', 'Engels met de Engelse afkorting');
  t.eq(M.mailDatum('', 'nl'), '', 'geen datum is een lege tekst');
  t.eq(M.mailDatum('2026-13-45', 'nl'), '2026-13-45', 'een onmogelijke datum wordt niet in een woord vertaald');
  t.true(M.mailDatum('2026-04-24', 'de').indexOf('2026') >= 0 && M.mailDatum('2026-04-24', 'de').indexOf('24') >= 0,
    'Duits (via Intl) bevat dag en jaar: ' + M.mailDatum('2026-04-24', 'de'));

  t.group('klantmail: schoonmaak van wat het beheer meestuurt');

  t.eq(M.vertaalStatusWaarde('partially_paid'), 'Open', 'een losse interne code wordt het klantwoord');
  t.eq(M.vertaalStatusWaarde('Deels betaald'), 'Open', 'het fijne beheerlabel ook');
  t.eq(M.vertaalStatusWaarde('disputed'), 'Bezwaar', '"disputed" wordt "Bezwaar"');
  t.eq(M.vertaalStatusWaarde('paid'), 'Betaald', '"paid" wordt "Betaald"');
  t.eq(M.vertaalStatusWaarde('Definitief'), 'Open', '"Definitief" wordt "Open"');
  t.eq(M.vertaalStatusWaarde('Verlopen'), 'Open', '"Verlopen" wordt "Open"');
  t.eq(M.vertaalStatusWaarde('credited'), 'Betaald · Creditnota, verrekend', '"credited" wordt "Betaald" met de creditnota erbij');
  t.eq(M.vertaalStatusWaarde('cancelled'), 'Vervallen', '"cancelled" wordt "Vervallen"');
  t.eq(M.vertaalStatusWaarde('draft'), '', '"draft" wordt niets — een concept beweert niets');
  t.eq(M.vertaalStatusWaarde('CP-2026-00007'), null, 'een factuurnummer is geen status en blijft met rust (null)');
  t.eq(M.vertaalStatusWaarde('Open'), null, 'een klantwoord is geen beheerstaal');
  t.eq(M.vertaalStatusWaarde('paid', tEn), 'Paid', 'met een vertaler komt het vertaalde woord');

  t.eq(M.mailWaardeVoorKlant('partially_paid', 'nl'), 'Open', 'een strookwaarde die een code is wordt het woord');
  t.eq(M.mailWaardeVoorKlant('€ 3.125,00', 'nl'), '€ 3.125', 'een strookbedrag met lege centen verliest ze');
  t.eq(M.mailWaardeVoorKlant('€ 3.125,50', 'nl'), '€ 3.125,50', 'een bedrag mét centen blijft staan');
  t.eq(M.mailWaardeVoorKlant('2026-04-24', 'nl'), '24 apr 2026', 'een ISO-datum in de strook wordt kort');
  t.eq(M.mailWaardeVoorKlant('24 april 2026', 'nl'), '24 apr 2026', 'een lange maandnaam wordt kort');
  t.eq(M.mailWaardeVoorKlant('24 April 2026', 'en'), '24 Apr 2026', 'ook in het Engels');
  t.eq(M.mailWaardeVoorKlant('CP-2026-00007', 'nl'), 'CP-2026-00007', 'een factuurnummer blijft een factuurnummer');

  t.eq(M.bedragZonderCenten('Factuur van € 3.125,00, te voldoen'), 'Factuur van € 3.125, te voldoen', 'lege centen na het euroteken verdwijnen, de komma van de zin blijft');
  t.eq(M.bedragZonderCenten('for €3,125.00 due'), 'for €3,125 due', 'ook in de Engelse schrijfwijze');
  t.eq(M.bedragZonderCenten('3.125,00 EUR en 3.125,00 €'), '3.125 EUR en 3.125 €', 'ook met de munt achter het bedrag');
  t.eq(M.bedragZonderCenten('om 10.00 uur'), 'om 10.00 uur', 'een tijd is geen bedrag en blijft staan');
  t.eq(M.bedragZonderCenten('€ 12.000 en € 2.000,00'), '€ 12.000 en € 2.000', 'een duizendtal wordt niet aangezien voor centen');
  t.eq(M.bedragZonderCenten('€ 0,00'), '€ 0', 'nul euro');

  t.eq(M.vervangInterneStatus('Status: partially_paid — zie Deels betaald'), 'Status: Open — zie Open', 'beheerstaal midden in een zin wordt het klantwoord');
  t.eq(M.vervangInterneStatus('the first draft was sent and credited to you'), 'the first draft was sent and credited to you',
    'gewone Engelse woorden (draft, sent, credited) blijven in lopende tekst met rust');
  t.true(M.bevatInterneStatus('de factuur is finalized'), 'bevatInterneStatus herkent een code');
  t.false(M.bevatInterneStatus('Open · Betaald · Bezwaar · Gemeld'), 'de vier woorden zijn geen beheerstaal');
  t.eq(M.telInterneStatus('finalized, Verlopen en partially_paid'), 3, 'de teller telt elk stukje beheerstaal');
  t.eq(M.mailTekstVoorKlant('Factuur “CP-2026-00007” van € 3.125,00, te voldoen vóór 24 april 2026 (status: partially_paid).', 'nl'),
    'Factuur “CP-2026-00007” van € 3.125, te voldoen vóór 24 apr 2026 (status: Open).',
    'de hele schoonmaak in één zin: bedrag, datum en status zoals het portaal');

  t.group('klantmail: de bronstrings');

  t.true(M.KLANT_BRONSTRINGEN.length >= 10, 'de module benoemt zijn bronstrings (' + M.KLANT_BRONSTRINGEN.length + ')');
  ['Stand', 'Open', 'Gemeld', 'Betaald'].forEach(function (s) {
    talen.forEach(function (taal) {
      t.true(!!(DICTS[taal] && DICTS[taal][s]), taal + ': "' + s + '" staat al in het woordenboek van het portaal');
    });
  });

  /* ============================================================
     8. DE ECHTE FUNCTIES: WEBHOOK EN TOKENVERZILVERING
     ============================================================
     Hierboven is de LOGICA getest; hieronder draaien de twee Netlify
     Functions zelf, met een nagebootste Supabase erachter. Dat is waar de
     handtekeningcontrole en de idempotentie echt gebeuren, en het is het
     verschil tussen "de regel klopt" en "de functie past hem toe".
     ============================================================ */
  t.group('resend-webhook: handtekening');

  const ECHT_SECRET = 'whsec_' + Buffer.from('een-geheim-van-precies-genoeg-bytes').toString('base64');
  const SB_URL = 'https://voorbeeld.supabase.co';

  /* nagebootste Supabase: onthoudt welke provider-gebeurtenissen al binnen
     zijn, precies zoals de unieke index dat in het echt doet */
  function maakSupabaseStub(opts) {
    opts = opts || {};
    const gezien = new Set();
    const aanroepen = [];
    return {
      aanroepen: aanroepen,
      gezien: gezien,
      fetch: async function (url, init) {
        const u = String(url);
        aanroepen.push(u);
        if (u.indexOf('/rest/v1/admin_settings') >= 0) {
          return new Response(JSON.stringify([{ value: { aan: !!opts.openingsregistratie } }]), { status: 200 });
        }
        if (u.indexOf('/rpc/record_mail_event') >= 0) {
          const body = JSON.parse(init.body);
          if (body.p_message_id !== 're_bekend') return new Response('"onbekende-mail"', { status: 200 });
          if (gezien.has(body.p_provider_event_id)) return new Response('"dubbel"', { status: 200 });
          gezien.add(body.p_provider_event_id);
          return new Response('"nieuw"', { status: 200 });
        }
        return new Response('[]', { status: 200 });
      }
    };
  }

  function tekenSvix(secret, id, timestamp, body) {
    const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const key = Buffer.from(raw, 'base64');
    return 'v1,' + createHmac('sha256', key).update(id + '.' + timestamp + '.' + body, 'utf8').digest('base64');
  }

  function webhookVerzoek(payload, opts) {
    opts = opts || {};
    const body = JSON.stringify(payload);
    const id = opts.id || 'msg_test_1';
    const ts = String(opts.ts || Math.floor(Date.now() / 1000));
    const sig = opts.sig !== undefined ? opts.sig : tekenSvix(opts.secret || ECHT_SECRET, id, ts, body);
    return new Request('https://voorbeeld.nl/.netlify/functions/resend-webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': sig },
      body: body
    });
  }

  const bezorgBericht2 = {
    type: 'email.delivered',
    created_at: '2026-05-01T09:00:20.000Z',
    data: { email_id: 're_bekend', to: ['klant@voorbeeld.nl'], subject: 'Factuur CP-2026-00007' }
  };

  const origFetch = globalThis.fetch;
  const origEnv = {
    secret: process.env.RESEND_WEBHOOK_SECRET,
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  try {
    const webhook = (await import('../netlify/functions/resend-webhook.mjs')).default;

    /* zonder omgevingsvariabelen is de functie UIT — geen half open eindpunt */
    delete process.env.RESEND_WEBHOOK_SECRET;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    let res = await webhook(webhookVerzoek(bezorgBericht2));
    t.eq(res.status, 503, 'zonder configuratie antwoordt de webhook 503 en verandert er niets');
    res = await webhook(new Request('https://x/', { method: 'GET' }));
    t.eq(res.status, 200, 'de health-check antwoordt ook zonder configuratie');
    t.eq((await res.json()).configured, false, 'en zegt eerlijk dat hij niet geconfigureerd is');

    process.env.RESEND_WEBHOOK_SECRET = ECHT_SECRET;
    process.env.SUPABASE_URL = SB_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-sleutel';

    res = await webhook(new Request('https://x/', { method: 'GET' }));
    t.eq((await res.json()).configured, true, 'met alle drie de variabelen meldt de health-check configured:true');

    let stub = maakSupabaseStub();
    globalThis.fetch = stub.fetch;

    /* een verkeerde handtekening wordt geweigerd VÓÓR er iets met de
       database gebeurt — dat is de hele reden dat de volgorde zo is */
    res = await webhook(webhookVerzoek(bezorgBericht2, { sig: 'v1,ditkloptniet' }));
    t.eq(res.status, 401, 'een verkeerde handtekening wordt geweigerd');
    t.eq(stub.aanroepen.length, 0, 'en er is geen enkele databaseronde geweest');

    res = await webhook(webhookVerzoek(bezorgBericht2, { secret: 'whsec_' + Buffer.from('ander-geheim').toString('base64') }));
    t.eq(res.status, 401, 'een handtekening met een ander geheim wordt geweigerd');

    /* ontbrekende koppen: geen handtekening, geen toegang */
    res = await webhook(new Request('https://x/', { method: 'POST', body: JSON.stringify(bezorgBericht2) }));
    t.eq(res.status, 401, 'zonder svix-koppen wordt het verzoek geweigerd');

    /* replay: een bericht van gisteren wordt geweigerd op de tijdstempel */
    const oud = String(Math.floor(Date.now() / 1000) - 3600);
    res = await webhook(webhookVerzoek(bezorgBericht2, { ts: oud }));
    t.eq(res.status, 401, 'een bericht met een verouderde tijdstempel wordt geweigerd (replay)');

    t.group('resend-webhook: idempotentie in de echte functie');

    stub = maakSupabaseStub();
    globalThis.fetch = stub.fetch;

    res = await webhook(webhookVerzoek(bezorgBericht2, { id: 'msg_a' }));
    let body = await res.json();
    t.eq(res.status, 200, 'een geldig ondertekend bericht wordt geaccepteerd');
    t.eq(body.result, 'nieuw', 'de eerste aflevering levert een nieuwe rij op');

    res = await webhook(webhookVerzoek(bezorgBericht2, { id: 'msg_a' }));
    body = await res.json();
    t.eq(body.result, 'dubbel', 'exact dezelfde aflevering een tweede keer landt niet nog eens');

    res = await webhook(webhookVerzoek(bezorgBericht2, { id: 'msg_a' }));
    body = await res.json();
    t.eq(body.result, 'dubbel', 'en een derde keer ook niet');
    t.eq(stub.gezien.size, 1, 'er is precies één gebeurtenis weggeschreven na drie afleveringen');

    /* een ANDER bericht over dezelfde mail moet er wel in */
    res = await webhook(webhookVerzoek({
      type: 'email.bounced', created_at: '2026-05-01T09:05:00.000Z',
      data: { email_id: 're_bekend', to: ['klant@voorbeeld.nl'], bounce: { message: 'Mailbox full' } }
    }, { id: 'msg_b' }));
    body = await res.json();
    t.eq(body.result, 'nieuw', 'een andere gebeurtenis over dezelfde mail landt wel');
    t.eq(body.event, 'bounced', 'en wordt als bounce weggeschreven');
    t.eq(stub.gezien.size, 2, 'er staan nu twee gebeurtenissen');

    /* een mail die niet bij een factuur hoort (gewone projectmail) */
    res = await webhook(webhookVerzoek({
      type: 'email.delivered', created_at: '2026-05-01T09:00:00.000Z',
      data: { email_id: 're_onbekend', to: ['x@y.nl'] }
    }, { id: 'msg_c' }));
    body = await res.json();
    t.eq(body.result, 'onbekende-mail', 'een mail zonder factuur wordt herkend en genegeerd');

    t.group('resend-webhook: openingsregistratie');

    stub = maakSupabaseStub({ openingsregistratie: false });
    globalThis.fetch = stub.fetch;
    res = await webhook(webhookVerzoek({
      type: 'email.opened', created_at: '2026-05-01T12:00:00.000Z', data: { email_id: 're_bekend' }
    }, { id: 'msg_open_1' }));
    body = await res.json();
    t.eq(body.ignored, true, 'met de openingsregistratie uit wordt een opening weggegooid');
    t.eq(stub.gezien.size, 0, 'en er wordt niets weggeschreven');

    stub = maakSupabaseStub({ openingsregistratie: true });
    globalThis.fetch = stub.fetch;
    res = await webhook(webhookVerzoek({
      type: 'email.opened', created_at: '2026-05-01T12:00:00.000Z', data: { email_id: 're_bekend' }
    }, { id: 'msg_open_2' }));
    body = await res.json();
    t.eq(body.result, 'nieuw', 'met de instelling expliciet aan wordt een opening wel vastgelegd');

    t.group('invoice-link: het token verzilveren');

    const link = (await import('../netlify/functions/invoice-link.mjs')).default;
    const geldigToken = M.newToken();
    const geldigeHash = await M.sha256Hex(geldigToken);

    /* nagebootste Supabase met één factuur en één token */
    let verzilverd = 0;
    let gelogd = [];
    globalThis.fetch = async function (url, init) {
      const u = String(url);
      if (u.indexOf('/rpc/redeem_invoice_token') >= 0) {
        const b = JSON.parse(init.body);
        verzilverd++;
        if (b.p_hash !== geldigeHash) {
          return new Response(JSON.stringify([{ invoice_id: null, token_id: null, ok: false, reason: 'onbekend' }]), { status: 200 });
        }
        return new Response(JSON.stringify([{ invoice_id: 'inv-1', token_id: 'tok-1', ok: true, reason: 'geldig' }]), { status: 200 });
      }
      if (u.indexOf('/rest/v1/invoices') >= 0) {
        return new Response(JSON.stringify([{
          id: 'inv-1', project_id: 'prj-1', invoice_number: 'CP-2026-00007', status_code: 'sent',
          snapshot: Object.assign({}, snapshot, { internalNote: 'NOOIT NAAR DE KLANT', tags: ['risico'] }),
          pay_url: '', pdf_path: 'prj-1/facturen/inv-1.pdf', pdf_filename: 'Factuur.pdf',
          paid_cents: 0, outstanding_cents: 128563, total_incl_cents: 128563, currency: 'EUR', due_date: '2026-05-15'
        }]), { status: 200 });
      }
      if (u.indexOf('/rest/v1/projects') >= 0) {
        return new Response(JSON.stringify([{ name: 'Lamp' }]), { status: 200 });
      }
      if (u.indexOf('/rest/v1/invoice_email_events') >= 0) {
        gelogd.push(JSON.parse(init.body).event);
        return new Response('', { status: 201 });
      }
      return new Response('[]', { status: 200 });
    };

    /* een token dat niet eens de juiste VORM heeft, hoeft de database niet
       te zien — dat scheelt een ronde bij elke willekeurige bezoeker */
    verzilverd = 0;
    res = await link(new Request('https://x/', {
      method: 'POST', body: JSON.stringify({ token: 'te-kort', action: 'view' })
    }));
    body = await res.json();
    t.eq(body.ok, false, 'een token met de verkeerde vorm wordt geweigerd');
    t.eq(body.reason, 'ongeldig', 'en krijgt hetzelfde nietszeggende antwoord als een onbekend token');
    t.eq(verzilverd, 0, 'zonder de database ook maar aan te raken');

    /* een token met de juiste vorm dat niet bestaat */
    res = await link(new Request('https://x/', {
      method: 'POST', body: JSON.stringify({ token: 'A'.repeat(43), action: 'view' })
    }));
    body = await res.json();
    t.eq(body.ok, false, 'een onbekend token levert geen factuur op');
    t.eq(body.reason, 'onbekend', 'met de reden die de database teruggaf');

    /* en nu het echte token */
    gelogd = [];
    res = await link(new Request('https://x/', {
      method: 'POST', headers: { 'user-agent': 'Testbrowser' },
      body: JSON.stringify({ token: geldigToken, action: 'view' })
    }));
    body = await res.json();
    t.eq(body.ok, true, 'het juiste token levert de factuur op');
    t.eq(body.invoice.invoiceNumber, 'CP-2026-00007', 'met het juiste factuurnummer');
    t.eq(body.invoice.totals.outstandingCents, 128563, 'en het openstaande bedrag in centen');
    t.eq(body.invoice.projectName, 'Lamp', 'en de projectnaam');
    t.eq(body.invoice.pdfAvailable, true, 'en de wetenschap dat er een PDF is');
    t.deep(gelogd, ['portal_viewed'], 'de weergave van de klantpagina wordt geregistreerd');

    /* DE BELANGRIJKSTE: interne velden mogen het antwoord niet verlaten */
    const plat = JSON.stringify(body);
    t.true(plat.indexOf('NOOIT NAAR DE KLANT') < 0,
      'de interne notitie uit de snapshot verlaat de server niet');
    t.true(plat.indexOf('risico') < 0, 'de interne tags ook niet');

    /* het antwoord mag nergens blijven hangen */
    t.true(String(res.headers.get('cache-control') || '').indexOf('no-store') >= 0,
      'een antwoord met factuurgegevens draagt no-store');

    t.group('invoice-link: vraag melden');

    gelogd = [];
    res = await link(new Request('https://x/', {
      method: 'POST',
      body: JSON.stringify({ token: geldigToken, action: 'question', text: 'De betaling ketst af.' })
    }));
    body = await res.json();
    t.eq(body.ok, true, 'een vraag van de klant wordt aangenomen');

    res = await link(new Request('https://x/', {
      method: 'POST', body: JSON.stringify({ token: geldigToken, action: 'question', text: '   ' })
    }));
    body = await res.json();
    t.eq(body.ok, false, 'een leeg bericht wordt geweigerd');
    t.eq(body.reason, 'leeg', 'met een duidelijke reden');

    res = await link(new Request('https://x/', {
      method: 'POST', body: JSON.stringify({ token: geldigToken, action: 'stiekem' })
    }));
    t.eq(res.status, 400, 'een verzonnen actie wordt geweigerd');
  } finally {
    globalThis.fetch = origFetch;
    if (origEnv.secret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = origEnv.secret;
    if (origEnv.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = origEnv.url;
    if (origEnv.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = origEnv.key;
  }
}
