/* CUSTOM+ site: de vertaalbronnen kloppen met elkaar.
   ------------------------------------------------------------------
   De site staat Nederlands in de HTML en wordt in de browser vertaald. Dat
   werkt alleen als elke bron compleet is; een ontbrekende regel geeft geen
   foutmelding, de zin blijft dan gewoon Nederlands staan. Deze tests lezen
   alleen bronbestanden (geen build nodig):
     1. content/vertalingen.json: elke Nederlandse tekst heeft alle vier de
        talen, met dezelfde {plekhouders} en zonder lange streepjes.
     2. content/blog-vertalingen/: elk artikel heeft per taal dezelfde
        blokken als het origineel, en hoort nog bij de huidige tekst.
     3. de afspraken waar de vertaalslag in custom-plus.html op leunt.
   Wat een bezoeker werkelijk ziet, meet scripts/i18n-live.mjs in een browser.
   ------------------------------------------------------------------ */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TALEN = ['en', 'de', 'fr', 'es'];
const lees = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const plek = (s) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(' ');

export default function (t) {
  t.group('vertalingen.json');
  const vert = lees('content/vertalingen.json');
  const teksten = vert.teksten || {};
  const sleutels = Object.keys(teksten);
  t.true(sleutels.length > 200, 'het bestand bevat de Nederlands geschreven teksten (' + sleutels.length + ' regels)');
  t.true(Array.isArray(vert.zelfde) && vert.zelfde.length > 0, 'er is een lijst met namen die in elke taal gelijk blijven');

  const onvolledig = [], plekFout = [], streep = [], witruimte = [];
  for (const nl of sleutels) {
    if (nl !== nl.replace(/\s+/g, ' ').trim()) witruimte.push(nl);
    for (const taal of TALEN) {
      const v = teksten[nl][taal];
      if (typeof v !== 'string' || !v.trim()) { onvolledig.push(taal + ': ' + nl.slice(0, 50)); continue; }
      if (plek(v) !== plek(nl)) plekFout.push(taal + ': ' + nl.slice(0, 50));
      if (/[–—]/.test(v)) streep.push(taal + ': ' + nl.slice(0, 50));
    }
  }
  t.eq(onvolledig.join(' | '), '', 'elke regel heeft Engels, Duits, Frans en Spaans');
  t.eq(plekFout.join(' | '), '', 'elke vertaling heeft dezelfde {plekhouders} als de Nederlandse tekst');
  t.eq(streep.join(' | '), '', 'geen lange streepjes in vertalingen');
  t.eq(witruimte.join(' | '), '', 'sleutels staan zonder spaties ervoor of erna en zonder dubbele spaties');

  /* de teksten waar het hele verzoek om begon: ze moeten er gewoon in staan */
  const rest = lees('content/restpartijen.json');
  const moet = [rest.kop.hoofd, rest.kop.sub, rest.aanvraag.knop, rest.teaser.kop, 'Restpartijen'];
  t.eq(moet.filter((nl) => !teksten[nl]).join(' | '), '', 'de koppen en knoppen van de restpartijenpagina hebben een vertaling');

  const seo = lees('content/seo-nl.json');
  const zonderTitel = [];
  for (const [pagina, v] of Object.entries(seo)) {
    if (!v || typeof v !== 'object' || pagina.charAt(0) === '_') continue;
    const titel = String(v.title || '').replace(/ \| CUSTOM\+$/, '');
    if (titel && !teksten[titel]) zonderTitel.push(pagina + ' (titel)');
    if (v.description && !teksten[v.description]) zonderTitel.push(pagina + ' (omschrijving)');
  }
  t.eq(zonderTitel.join(' | '), '', 'elke paginatitel en omschrijving uit seo-nl.json heeft een vertaling');

  t.group('blogvertalingen');
  const blogDir = join(ROOT, 'content', 'blog');
  const vertDir = join(ROOT, 'content', 'blog-vertalingen');
  const artikelen = readdirSync(blogDir).filter((f) => f.endsWith('.json'));
  t.true(artikelen.length > 0, 'er zijn blogartikelen');
  for (const f of artikelen) {
    const art = lees('content/blog/' + f);
    const pad = join(vertDir, f);
    t.true(existsSync(pad), art.slug + ': er is een vertaalbestand');
    if (!existsSync(pad)) continue;
    const alle = JSON.parse(readFileSync(pad, 'utf8'));
    const bron = createHash('sha256')
      .update(JSON.stringify([art.title || '', art.dek || '', art.series || '', art.body || []])).digest('hex').slice(0, 12);
    t.eq(alle.bron, bron, art.slug + ': de vertaling hoort bij de huidige Nederlandse tekst (anders opnieuw vertalen en "bron" bijwerken)');
    for (const taal of TALEN) {
      const v = alle[taal] || {};
      t.true(typeof v.title === 'string' && v.title.length > 0, art.slug + ' ' + taal + ': heeft een titel');
      t.eq((v.body || []).map((b) => b.type).join(' '), art.body.map((b) => b.type).join(' '), art.slug + ' ' + taal + ': dezelfde blokken in dezelfde volgorde');
      const lijsten = art.body.map((b, i) => (b.type === 'ul' ? [(b.items || []).length, ((v.body || [])[i] || {}).items ? v.body[i].items.length : -1] : null)).filter(Boolean);
      t.true(lijsten.every((p) => p[0] === p[1]), art.slug + ' ' + taal + ': elke opsomming heeft evenveel punten');
      t.true(!/[–—]/.test(JSON.stringify(v)), art.slug + ' ' + taal + ': geen lange streepjes');
      t.eq(!!v.series, !!art.series, art.slug + ' ' + taal + ': serienaam alleen als het origineel er een heeft');
    }
  }

  t.group('vertaalslag in de app');
  const html = readFileSync(join(ROOT, 'custom-plus.html'), 'utf8');
  t.true(html.indexOf("var I18N_TRANSLATE_ATTRS = ['placeholder', 'aria-label', 'alt'];") > 0, 'placeholder, aria-label en alt worden meevertaald');
  t.true(/function setLang\(code\)\{[\s\S]{0,700}location\.reload\(\);/.test(html), 'een taalwissel bouwt de pagina opnieuw op (location.reload)');
  t.true(html.indexOf("document.documentElement.classList.remove('cp-lang-wait');") > 0, 'de app toont de pagina zodra de vertaling er staat');
  t.true(html.indexOf('.cp-lang-wait .fl{ visibility:hidden; }') > 0, 'de stylesheet houdt de Nederlandse HTML uit beeld tot de vertaling er is');
  const gen = readFileSync(join(ROOT, 'scripts', 'build-site.mjs'), 'utf8');
  t.true(gen.indexOf('LANG_SCRIPT') > 0 && gen.indexOf('cp-lang-wait') > 0, 'de generator zet de taal al in de head');
  t.true(gen.indexOf("content', 'vertalingen.json'") > 0, 'de generator leest content/vertalingen.json');
  /* alles wat de taalknoppen omvat mag niet meer buiten de vertaalslag vallen */
  t.true(!/id="lang-switch-(topbar|mobile)"[^>]*data-no-i18n/.test(html), 'het label van de taalknoppen vertaalt mee');
  t.true(!/href="\/restpartijen" data-no-i18n/.test(html), 'het menu-item Restpartijen vertaalt mee');
}
