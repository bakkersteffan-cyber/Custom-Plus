/* CUSTOM+ — tekenlaag van de nieuwe beheerindeling.
   ------------------------------------------------------------------
   WAARVOOR DIT BESTAND BESTAAT
   De tien mockups van de eigenaar staan vol grafiek: een voortgangsring in
   elke tegel, een sparkline op de klantkaart, gestapelde vlakken bij
   "Portfolio gezondheid", staven bij "Operaties deze week", twee donuts,
   een deadlinekalender en — het karakteristiekste element van de hele set —
   het golvende fasepad op het projectdetail. Al die vormen zijn met de hand
   in SVG geschreven. Er zit geen grafiekbibliotheek in dit project, er komt
   er ook geen: dit bestand is kleiner dan de kleinste chartlibrary, kent de
   tokens uit de mockupspec van binnen en heeft geen buildstap nodig.

   .claude/beheer-ui-mockup-spec.md is de enige waarheid over het uiterlijk.
   Elke maat, elke tint en elke radius hieronder komt uit hoofdstuk 1, 2 en 4
   van dat bestand. Waar dit bestand daarvan afwijkt staat dat er met zoveel
   woorden bij, met de reden erbij — en die reden is elke keer hoofdstuk 8.

   VIJF AFSPRAKEN DIE DE REST VERKLAREN

   1. GEEN COMPONENT LEEST APPSTATE. Zelfde afspraak als in admin-ui.js: er
      staat hier geen DS, geen adminSettings en geen refresh(). Alles komt
      via opts binnen en gaat via callbacks terug. Een grafiek weet dus nooit
      welk project open staat en kan daardoor ook nooit het verkeerde tonen.

   2. NOOIT innerHTML — ook niet voor SVG. Alles via el() en svg(). Dat is
      geen stijlkwestie: klantnamen, fabrieksnamen en fasetitels komen uit de
      database en gaan hier ongefilterd doorheen. textContent en
      setAttribute maken injectie onmogelijk. Een SVG-pad dat als tekst wordt
      samengeplakt en via innerHTML wordt gezet is precies de plek waar dat
      een keer misgaat.

   3. NOOIT EEN NaN IN EEN PAD. Elk coördinaat loopt door nr(): niet-eindige
      waarden worden 0, nooit "M NaN,NaN". Elke functie verdraagt een lege
      reeks, één punt, alleen nullen, alleen gelijke waarden, negatieve
      waarden, een max van nul en ontbrekende velden. Het resultaat is dan
      een LEGE maar geldige SVG — met opts.leegtekst gecentreerd erin — en
      nooit een uitzondering. Een halve render mag geen leeg scherm geven.

   4. TOEGANKELIJKHEID IS GEEN GARNERING (hoofdstuk 8). Elke grafiek is
      role="img" met een <title> als eerste kind en een aria-label dat de
      ECHTE waarden in het Nederlands noemt: "Cashflow per maand: december
      400 euro, januari 1.225 euro". Wie de grafiek niet ziet krijgt de
      cijfers. opts.beschrijving overschrijft dat label altijd. Decoratie
      (het golvende pad zelf, de takjes) is aria-hidden en de bediening
      staat als echte knoppen in de leesvolgorde eronder.

   5. GEEN ENKELE EXTERNE BRON. Geen kaarttegels, geen fonts, geen CDN,
      geen canvas. Alles is hier getekend.

   6. EEN COMPONENT DAT IN EEN KNOP KAN LANDEN, BOUWT MET span EN NOOIT MET
      div. Het inhoudsmodel van <button> is frasering-inhoud; een div daar
      binnenin is ongeldige HTML en sommige schermlezers slaan de inhoud dan
      over. De projectkaart van hoofdstuk 5.3 IS één grote knop en er staat
      een stepper in, dus stepper(), stagePath() en ratingDots() bouwen hun
      omhulsels als span en halen hun display uit het stijlblok.
      Wat NIET in een knop past en dat ook niet gaat proberen: areaChart,
      barChart en donut dragen een <ul> als legenda, mapCard een <p> als
      bijschrift en miniCalendar zijn eigen <button>s per dag. Die drie
      vormen mogen per definitie niet in een knop staan; een span-omhulsel
      zou dat verbergen in plaats van oplossen. Wie zo'n grafiek in een
      klikbare kaart wil, zet de knop ernaast en niet eromheen.

   MAATVOERING EN SCHALING
   Ringen, donuts en avatars hebben in de mockup een vaste pixelmaat en
   krijgen die ook (width/height in px). Alle andere grafieken krijgen een
   viewBox plus width:100%/height:auto, zodat CSS de maat bepaalt: opts.breedte
   en opts.hoogte zijn dan de ONTWERPMAAT die de verhouding vastlegt, niet een
   harde pixelmaat. Astekst staat binnen die SVG en schaalt dus mee met de
   grafiek — dat is bewust: labels die met de grafiek meeschalen botsen nooit.
   Tekst die niet aan de geometrie vastzit (legenda's, kalender, de labels
   onder het fasepad) staat als gewone HTML naast de SVG: beter leesbaar,
   selecteerbaar, en op elke breedte precies de opgegeven puntgrootte.

   STIJL
   Kleuren komen uit de tokens van hoofdstuk 1, altijd als var(--token,#hex):
   de hex is de letterlijke waarde uit de spec, zodat een grafiek ook klopt
   voordat admin-ui.css de nieuwe tokens heeft. Layout van de HTML-delen zit
   in één stijlblok dat dit bestand eenmalig injecteert (id cp-chart-stijl),
   met uitsluitend enkelvoudige .cpch-* selectors van specificiteit 0,1,0.
   Die belofte is de reden dat dit blok überhaupt geïnjecteerd MAG worden:
   een componentbibliotheek die je niet kunt overschrijven is een tijdbom, en
   elke gewone klasseregel in portal/admin-ui.css moet er moeiteloos van
   winnen. Twee technieken houden dat waar:
     · een TOESTAND die JavaScript al kent wordt een eigen klasse
       (.cpch-cijfer-vandaag, .cpch-fase-label-actief) in plaats van een
       nakomelingselector op een aria-attribuut — 0,1,0 in plaats van 0,3,0;
     · een toestand die alleen de browser kent (:hover, :focus-visible) gaat
       in :where(), want :where() telt voor 0. `:where(.cpch-dag:hover)
       .cpch-cijfer` is dus 0,1,0 en niet 0,3,0.
   EEN uitzondering, met opzet: de regel onder prefers-reduced-motion gebruikt
   !important. Dat is geen specificiteit maar het overrulet wél alles, en dat
   hoort ook zo — geen enkele latere stijlregel mag beweging terugzetten bij
   iemand die daar last van heeft.

   ANIMATIE
   Alleen de intekenanimatie van ring en fasepad, uitsluitend via
   CSS-klassen (nooit setInterval), en onder prefers-reduced-motion volledig
   uit.

   Publieke API (globalThis.CP_CHART, en module.exports in Node):
     VERSION
     svg / el / leeg                     de bouwhelpers
     path(punten, opts)                  {x,y}[] → vloeiend kubiek Bezierpad
     ring / sparkline / areaChart / barChart / donut
     miniCalendar / stagePath / stepper / ratingDots
     leafOrnament / mapCard / iconSet
     getal / bedrag / euroWoord          Nederlandse getalnotatie (extra,
                                         maar nodig in elk aria-label)

   LADEN
     browser : BEDOELD als <script src="portal/admin-charts.js"></script> in
               beheer.html en dev/admin-ui.html, NA admin-model.js en VOOR
               admin-ui.js. Het bestand zet zichzelf op globalThis als
               CP_CHART.
               STAND VAN VANDAAG: dat scripttag staat er nog nergens —
               beheer.html laadt alleen config/demo-data/invoice-*, en
               dev/admin-ui.html laadt model, ui en shell. Deze laag is dus
               nog niet aangesloten. admin-ui.js houdt daar rekening mee: die
               vraagt CP_CHART op via globalThis en heeft overal een terugval
               als hij er niet is. Dit blok belooft dus geen bestaande
               werkelijkheid, het beschrijft waar het scripttag hoort zodra
               de schermen worden ingehangen.
     node    : importeerbaar voor tests. Het factory-lichaam raakt bij het
               laden geen document en geen window aan — alle DOM-toegang zit
               binnen de functies — dus importeren zonder DOM klapt niet.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_CHART = api;
  /* zelfde reden als in invoice-core.js en admin-ui.js: er is geen
     package.json met "type":"module", dus in Node is dit CJS en is dit een
     echte export. Draait het ooit als ESM, dan bestaat `module` niet en
     blijft alleen globalThis over. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 1.1.0: de fixronde op de dertien bevindingen van de controleur. Geen
     enkele publieke naam of parameter is veranderd, alleen gedrag — vandaar
     de tweede cijfer en niet het eerste. Zelfde stap als admin-ui.js zette. */
  var VERSION = '1.1.0';
  var NS = 'http://www.w3.org/2000/svg';

  /* ============================================================
     0. KALE HULPJES
     ============================================================ */

  function arr(v) { return Array.isArray(v) ? v : []; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function opt(v) { return isObj(v) ? v : {}; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function fn(v) { return typeof v === 'function' ? v : null; }

  /* isGetal() beantwoordt één vraag: IS hier een getal meegegeven? Alleen een
     eindig number of een tekst die volledig uit een getal bestaat telt mee.
     null, undefined, "", "  ", true, [], [7], {} en "abc" zijn géén getal.

     Dat lijkt muggenzifterij tot je Number() erop loslaat: Number(null),
     Number(''), Number([]) en Number(false) zijn allemaal 0 — en allemaal
     eindig. Wie op isFinite(Number(v)) vertrouwt, ziet "leeg" dus als "nul".
     Hoofdstuk 7 van de spec voert juist nullable velden in (deadline,
     quality_score, leadtime_score, photo_url): in dit project IS null de
     normale vorm van leeg, en een leeg veld mag nooit stilletjes een nul
     worden die de grafiek wél tekent. */
  function isGetal(v) {
    if (typeof v === 'number') return isFinite(v);
    if (typeof v === 'string') {
      var s = v.replace(/^\s+|\s+$/g, '');
      if (!s) return false;
      var n = Number(s);
      return isFinite(n);
    }
    return false;
  }

  /* num() is de enige poort waardoor een getal dit bestand binnenkomt.
     Alles wat GEEN getal is (undefined, null, "", "abc", NaN, Infinity,
     true, [], {}) wordt de terugval — precies wat het commentaar hier altijd
     al beloofde en wat de oude Number()-versie niet waarmaakte. Hierop rust
     zowel de belofte dat er nooit een NaN in een pad belandt als de belofte
     dat een ontbrekend veld op zijn standaardwaarde uitkomt: num(o.maat, 72)
     hoort 72 te geven als maat null is, niet 0 (en dus geen ring van nul,
     geen kalender van het jaar 0 en geen sparkline met negatieve x). */
  function num(v, terugval) {
    if (isGetal(v)) return Number(v);
    return terugval === undefined ? 0 : terugval;
  }

  function klem(v, laag, hoog) {
    if (!isFinite(v)) return laag;
    if (v < laag) return laag;
    if (v > hoog) return hoog;
    return v;
  }

  /* de globale scope opnieuw bepalen: de factory krijgt hem niet mee (het
     modulepatroon komt letterlijk uit invoice-core.js) en we hebben hem
     alleen nodig voor CP_CITY_COORDS in mapCard() */
  function G() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    return null;
  }

  /* oplopende teller voor id's die SVG nodig heeft (gradients, clipPaths,
     aria-labelledby). Bewust geen willekeur: bij een herrender wil je in de
     inspector kunnen zien welk verloop bij welke grafiek hoort. */
  var teller = 0;
  function uid(voorvoegsel) { teller++; return 'c' + str(voorvoegsel) + teller; }

  /* ============================================================
     1. NEDERLANDSE GETALNOTATIE — één plek, overal gebruikt
     ============================================================
     Duizendtallen met een punt, decimalen met een komma. Bewust NIET via
     toLocaleString: die hangt af van de taalinstelling van de browser en
     zou op een Engelstalig systeem 1,225.00 opleveren in een Nederlandse
     grafiek. Dit moet deterministisch zijn, ook in een test in Node. */

  function groepeer(cijfers) {
    var s = str(cijfers), uit = '', n = 0, i;
    for (i = s.length - 1; i >= 0; i--) {
      uit = s.charAt(i) + uit;
      n++;
      if (n % 3 === 0 && i > 0) uit = '.' + uit;
    }
    return uit;
  }

  /* getal(1234.5, 1) → "1.234,5". Geen getal → lege tekst, zodat een
     ontbrekende waarde nooit als "NaN" én nooit als een verzonnen "0" op het
     scherm komt. Dat laatste is dezelfde val als in num(): Number(null) is 0
     en zou een leeg veld als een echte nul laten lezen. */
  function getal(waarde, decimalen) {
    if (!isGetal(waarde)) return '';
    var w = Number(waarde);
    var d = klem(Math.round(num(decimalen, 0)), 0, 6);
    var vast = Math.abs(w).toFixed(d);
    var stukken = vast.split('.');
    var uit = groepeer(stukken[0]) + (stukken.length > 1 ? ',' + stukken[1] : '');
    return (w < 0 && Number(vast) !== 0 ? '-' : '') + uit;
  }

  /* GELD KOMT ALTIJD IN CENTEN BINNEN en wordt pas hier gedeeld — precies
     de afspraak uit invoice-core.js. Er wordt in dit bestand nergens met
     een kommabedrag gerekend; de deling door 100 is een gehele deling met
     een gehele rest, dus 12,34 euro blijft 12,34 euro.
     opts: {euro:true} zet het euroteken ervoor, {decimalen:false} laat de
     centen altijd weg, {decimalen:true} toont ze altijd. Standaard: centen
     alleen tonen als ze er zijn (een cashflowlabel van "1.225" leest beter
     dan "1.225,00"). */
  function bedrag(centen, opts) {
    var o = opt(opts);
    var c = Math.round(num(centen, 0));
    var negatief = c < 0;
    var absoluut = Math.abs(c);
    var heel = Math.floor(absoluut / 100);
    var rest = absoluut - heel * 100;
    var toonRest = o.decimalen === true || (o.decimalen !== false && rest !== 0);
    var tekst = groepeer(String(heel));
    if (toonRest) tekst += ',' + (rest < 10 ? '0' : '') + String(rest);
    if (negatief && (heel !== 0 || rest !== 0)) tekst = '-' + tekst;
    return (o.euro ? '€ ' : '') + tekst;
  }

  /* voor aria-labels: "1.225 euro" leest een schermlezer goed voor, het
     euroteken wordt afhankelijk van de stem "euro 1225" of helemaal niets. */
  function euroWoord(centen) { return bedrag(centen) + ' euro'; }

  /* grootste-restverdeling, zodat een legenda met percentages optelt tot
     precies 100 en niet tot 99 of 101 */
  function procentVerdeling(waarden) {
    var lijst = [], totaal = 0, uit = [], resten = [], som = 0, i, n;
    for (i = 0; i < arr(waarden).length; i++) {
      n = num(waarden[i], 0);
      if (n < 0) n = 0;
      lijst.push(n);
      totaal += n;
    }
    if (totaal <= 0) {
      for (i = 0; i < lijst.length; i++) uit.push(0);
      return uit;
    }
    for (i = 0; i < lijst.length; i++) {
      var exact = lijst[i] * 100 / totaal;
      var heel = Math.floor(exact);
      uit.push(heel);
      som += heel;
      resten.push({ i: i, r: exact - heel });
    }
    resten.sort(function (a, b) { return (b.r - a.r) || (a.i - b.i); });
    var tekort = 100 - som;
    for (i = 0; i < tekort && i < resten.length; i++) uit[resten[i].i] += 1;
    return uit;
  }

  /* ============================================================
     2. KLEUREN — hoofdstuk 1 van de mockupspec, letterlijk
     ============================================================
     Altijd var(--token, #hex): het token wint zodra admin-ui.css het nieuwe
     palet heeft, de hex is de vangnetwaarde uit de spec zodat een grafiek
     ook vandaag al de goede kleur heeft. Een aanroeper mag ook een kale
     kleur meegeven ("#8fae7c", "rgb(...)", "var(--x)"); die gaat ongemoeid
     door. */

  var TOKENS = {
    'paper': '#f9f7f3', 'side': '#fbf9f6', 'card': '#ffffff', 'card-2': '#fdfcfa',
    'tint-ink': '#f1eee8', 'line': '#ebe6dd', 'line-2': '#f3efe8',
    'ink': '#14120f', 'ink-2': '#4a443c', 'ink-3': '#8a8175', 'ink-4': '#b3aba0',
    'ok': '#5f8a4f', 'ok-soft': '#eaf1e5',
    'warn': '#d98b4a', 'warn-soft': '#fbeee2',
    'crit': '#c5563f', 'crit-soft': '#f9e9e5',
    'info': '#6d92b8', 'info-soft': '#eaf0f6',
    'cat-1': '#8fae7c', 'cat-1-soft': '#e8efe2',
    'cat-2': '#e0a878', 'cat-2-soft': '#fbeee1',
    'cat-3': '#8aa6c4', 'cat-3-soft': '#e9eff6',
    'cat-4': '#a698c4', 'cat-4-soft': '#efebf6',
    'cat-5': '#cbbfa8', 'cat-5-soft': '#f5f1e8',
    'cat-6': '#6f6a62', 'cat-6-soft': '#eeece8'
  };

  function tok(naam) { return 'var(--' + naam + ',' + TOKENS[naam] + ')'; }

  function kleur(waarde, terugval) {
    var t = str(waarde).replace(/^\s+|\s+$/g, '');
    if (!t) return terugval ? kleur(terugval) : tok('ink');
    if (TOKENS[t]) return tok(t);
    /* al een kale kleur of een eigen var() — ongemoeid doorlaten */
    return t;
  }

  /* de categorische reeks in de volgorde van de spec; wordt rondgedraaid
     zodra een grafiek meer reeksen heeft dan er tinten zijn */
  var CAT = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'];
  function catKleur(i, zacht) {
    var naam = CAT[((num(i, 0) % CAT.length) + CAT.length) % CAT.length];
    return tok(zacht ? naam + '-soft' : naam);
  }

  /* statuskleuren: kleur draagt hier BETEKENIS en blijft dus kleur
     (hoofdstuk 0 van de spec: alleen merkgroen wordt zwart) */
  var STATUS_KLEUR = {
    kritiek: 'crit', crit: 'crit', critical: 'crit', telaat: 'crit',
    wacht: 'warn', warn: 'warn', aandacht: 'warn',
    extern: 'info', info: 'info', onderweg: 'info',
    gereed: 'ok', ok: 'ok', betaald: 'ok', koers: 'ok'
  };
  /* zwaarte voor "de stip krijgt de kleur van het ZWAARSTE item van die dag" */
  var STATUS_ZWAARTE = { crit: 4, warn: 3, info: 2, ok: 1 };
  var STATUS_WOORD = { crit: 'kritiek', warn: 'wacht', info: 'extern', ok: 'gereed' };

  function statusSleutel(toon) {
    var t = str(toon).toLowerCase();
    return STATUS_KLEUR[t] || null;
  }

  /* ============================================================
     3. BOUWHELPERS — el() en svg()
     ============================================================ */

  /* el() is LETTERLIJK de helper uit beheer.html regel 2233, admin-ui.js en
     admin-shell.js. Niet "ongeveer": een vijfde variant die ook maar één
     attribuut anders behandelt is een fout die pas veel later opvalt. */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'class') { n.className = v; }
        else if (k === 'text') { n.textContent = v; }
        else if (k === 'value') { n.value = v; }
        else if (k === 'checked') { n.checked = !!v; }
        else if (k === 'disabled') { n.disabled = !!v; }
        else if (k.indexOf('on') === 0 && typeof v === 'function') { n.addEventListener(k.slice(2), v); }
        else { n.setAttribute(k, v); }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return n;
  }

  /* svg() heeft dezelfde semantiek als el(), met drie verschillen die
     allemaal uit de SVG-DOM zelf komen:
       · createElementNS — zonder de namespace maakt de browser een
         onzichtbaar HTML-element met de naam "circle";
       · 'class' gaat via setAttribute en NIET via .className, want className
         is op een SVG-element een SVGAnimatedString (alleen-lezen object);
         n.className = 'x' maakt daar stilletjes niets van;
       · alle andere attributen gaan via setAttribute en nooit via een
         property: n.width = 100 op een <rect> zet geen breedte, dat is een
         SVGAnimatedLength.
     xlink is nergens nodig — <use href> volstaat en wij gebruiken zelfs dat
     niet. */
  function svg(tag, attrs, children) {
    var n = document.createElementNS(NS, str(tag) || 'g');
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'text') { n.textContent = str(v); }
        else if (k.indexOf('on') === 0 && typeof v === 'function') { n.addEventListener(k.slice(2), v); }
        else { n.setAttribute(k, str(v)); }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return n;
  }

  function leeg(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ============================================================
     4. HET STIJLBLOK — eenmalig, enkelvoudige selectors
     ============================================================
     Alleen wat niet in een attribuut kan: rasters die van het aantal
     kolommen afhangen (via --cpch-n), hovertoestanden, de mediaquery voor
     de takjes, en de intekenanimatie. Alle kleuren staan er als
     var(--token,#hex), dus dit blok schrijft geen enkele nieuwe waarde voor.

     ELKE REGEL HIERONDER IS 0,1,0. Geen nakomelingselectors, geen
     attribuutselectors, geen kale elementnamen: een toestand die JS kent
     krijgt een eigen klasse, en :hover/:focus-visible zitten in :where(),
     dat voor 0 telt. Zo wint een gewone .klasse-regel in admin-ui.css het
     altijd van dit blok. Wie hier een regel bij zet: houd hem 0,1,0. */

  var STIJL_ID = 'cp-chart-stijl';
  var STIJL = [
    /* display:block staat er expliciet bij omdat de omhulsels van stepper(),
       stagePath() en ratingDots() GEEN div meer zijn maar een span: die
       componenten landen in een klikbare kaart, en een div binnen een
       <button> is ongeldige HTML (het inhoudsmodel van een knop is
       frasering-inhoud). Een span is van zichzelf inline; zonder deze regel
       vallen die drie omhulsels op de tekstbasislijn. De componenten die
       hieronder een eigen display zetten (.cpch-donut, .cpch-rating) staan
       LATER in deze lijst en winnen dus op gelijke specificiteit. */
    '.cpch{position:relative;display:block}',
    '.cpch-svg{display:block;width:100%;height:auto;overflow:visible}',
    /* tabular-nums op elk getal dat in een kolom kan komen te staan */
    '.cpch-num{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}',
    '.cpch-knop{margin:0;padding:0;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer}',
    /* :where(:focus-visible) in plaats van :focus-visible — zelfde gedrag,
       maar 0,1,0 in plaats van 0,2,0 */
    '.cpch-knop:where(:focus-visible){outline:2px solid var(--ink,#14120f);outline-offset:2px;border-radius:8px}',

    /* legenda — vierkantje 9px radius 2px + label 12.5px (spec 4.4).
       De <li> krijgt een eigen klasse: ".cpch-legenda li" zou 0,1,1 zijn en
       bovendien elke andere li binnen een legenda meepakken. */
    '.cpch-legenda{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 12px;padding:0;list-style:none}',
    '.cpch-legenda-item{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink-2,#4a443c)}',
    '.cpch-vlag{width:9px;height:9px;border-radius:2px;flex:none}',

    /* donutlegenda — rij per segment met stip 9px, label 14px, waarde rechts */
    '.cpch-dlegenda{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:9px;width:100%}',
    '.cpch-dlegenda-item{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink-2,#4a443c)}',
    '.cpch-bol{width:9px;height:9px;border-radius:999px;flex:none}',
    /* De waarde rechts is 13,5px. Spec 4.5 noemt daar --ink-3, maar
       hoofdstuk 8 gaat vóór elke pixel: --ink-3 haalt 3.6:1 en mag niet
       onder 14px voor tekst die informatie draagt — en DIT is de informatie,
       het percentage zelf. Vandaar --ink-2, precies de uitwijk die elders in
       dit bestand voor 12-13px microtekst al gemaakt is. */
    '.cpch-w{margin-left:auto;color:var(--ink-2,#4a443c);font-size:13.5px}',
    '.cpch-donut{display:flex;flex-direction:column;align-items:center}',

    /* kalender (spec 4.6) */
    '.cpch-kal-kop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}',
    '.cpch-kal-maand{font-size:15px;font-weight:500;color:var(--ink,#14120f)}',
    '.cpch-kal-nav{display:flex;gap:6px}',
    '.cpch-rond{width:28px;height:28px;border-radius:999px;border:1px solid var(--line,#ebe6dd);background:var(--card,#fff);color:var(--ink-2,#4a443c);display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:pointer}',
    '.cpch-rond:where(:hover){background:var(--tint-ink,#f1eee8)}',
    '.cpch-rij{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}',
    '.cpch-wd{font-size:12px;color:var(--ink-2,#4a443c);text-align:center;padding:4px 0 6px}',
    /* De cel is 36px en het cijferschijfje 32px. Die twee GECENTREERD op
       elkaar laat onderaan maar 2px vrij, en daar past de gebeurtenisstip van
       4px niet in: die kwam dan bovenop de zwarte vandaag-cirkel te liggen in
       plaats van eronder. Het schijfje staat daarom bovenaan de cel (0..32) en
       de stip in de vrijgekomen strook eronder (32..36) — spec 4.6: "een stip
       4px onder het cijfer". De dagen buiten de maand krijgen dezelfde
       uitlijning plus line-height 32px, anders staan hun cijfers 2px lager
       dan de rest van het raster. */
    '.cpch-dag{position:relative;height:36px;display:flex;align-items:flex-start;justify-content:center;font-size:15px;color:var(--ink-2,#4a443c)}',
    '.cpch-cijfer{width:32px;height:32px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;line-height:1}',
    /* de hovertoestand kent alleen de browser, dus :where() om 0,1,0 te
       houden; vandaag en gekozen kent JS wél en krijgen een eigen klasse */
    ':where(.cpch-dag:hover) .cpch-cijfer{background:var(--tint-ink,#f1eee8)}',
    '.cpch-cijfer-vandaag{background:var(--ink,#14120f);color:#fff}',
    '.cpch-cijfer-gekozen{box-shadow:inset 0 0 0 2px var(--ink,#14120f)}',
    '.cpch-dag-uit{height:36px;display:flex;align-items:flex-start;justify-content:center;font-size:15px;line-height:32px;color:var(--ink-4,#b3aba0)}',
    '.cpch-dagstip{position:absolute;left:50%;bottom:0;width:4px;height:4px;margin-left:-2px;border-radius:999px}',

    /* fasepad (spec 4.11) en stepper (spec 4.14) delen het kolomraster */
    '.cpch-kolommen{display:grid;grid-template-columns:repeat(var(--cpch-n,6),minmax(0,1fr));gap:0}',
    '.cpch-fase{display:block;width:100%;padding:10px 6px 0;text-align:center}',
    /* HET AFKAPPEN IS DE UITZONDERING, NIET DE REGEL. Het korte label uit
       `kort` (zie de meting bij naamPaar) is de oplossing; deze twee regels
       vangen alleen op wat er ondanks die meting toch nog overheen gaat.
       Twee regels voor het fasepad, want daar is de fasenaam de kop van een
       kolom van 124px met nog drie regels eronder; één regel voor de stepper,
       want in 63px past niets meer.
       Ze staan hier ÓÓK, en niet alleen in admin-ui.css, zodat het component
       zelfstandig klopt: admin-charts.js kan zonder die stylesheet gebruikt
       worden en mag dan geen brij tonen. De regels zijn letterlijk gelijk aan
       hun tegenhangers daar (hoofdstuk 8u), dus het maakt niet uit welke van
       de twee wint. Wie ze hier wijzigt, wijzigt ze daar mee. */
    /* alleen de -webkit-vorm en niet ook de standaard `line-clamp`: die
       laatste zet volgens CSS Overflow 4 ook `continue:discard` en maakt van
       het element een flow-root. Gemeten in Chrome verandert dan de gebruikte
       display, en dat is een ander gedrag dan admin-ui.css hier al jaren
       neerzet. Twee regels afkappen is de bedoeling, geen tweede weg ernaast. */
    '.cpch-fase-label{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;color:var(--ink-3,#8a8175);line-height:1.3}',
    '.cpch-fase-label-actief{font-weight:500;color:var(--ink,#14120f)}',
    '.cpch-fase-regel{display:block;font-size:13px;color:var(--ink-2,#4a443c);line-height:1.45;margin-top:4px}',
    '.cpch-fase-nadruk{display:block;font-size:15px;font-weight:500;color:var(--ink,#14120f);margin-top:4px}',
    '.cpch-stap{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 4px}',
    '.cpch-stap-label{display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;color:var(--ink-2,#4a443c);text-align:center;line-height:1.3}',
    '.cpch-stap-label-actief{font-weight:500;color:var(--ink,#14120f)}',
    /* het merkje is 18px hoog, zijn hart ligt dus op 9px; een lijn van 1px
       moet daarom op 8,5px beginnen om er middendoor te lopen.
       display:block: dit is sinds deze ronde een span (zie .cpch hierboven).
       Een absoluut geplaatst element wordt weliswaar vanzelf een blok, maar
       dat expliciet opschrijven scheelt de volgende lezer een opzoekbeurt. */
    '.cpch-stap-lijn{display:block;position:absolute;top:8.5px;height:1px;background:var(--line,#ebe6dd);left:calc(50% / var(--cpch-n,5));right:calc(50% / var(--cpch-n,5))}',
    '.cpch-stepper{position:relative;display:block}',

    /* beoordelingsstippen (spec 4.15) */
    '.cpch-rating{display:flex;align-items:center;gap:10px}',
    '.cpch-rating-label{font-size:13px;color:var(--ink-2,#4a443c)}',
    '.cpch-rating-stippen{display:flex;gap:5px}',
    '.cpch-rating-stip{border-radius:999px}',

    /* kaart (spec 4.17) */
    '.cpch-map-bij{margin:8px 0 0;font-size:13px;color:var(--ink-2,#4a443c)}',

    /* takjes (spec 4.20) — verdwijnen onder 900px */
    '.cpch-blad{position:absolute;pointer-events:none;opacity:.35}',
    '.cpch-blad-lb{top:0;left:0}',
    '.cpch-blad-rb{top:0;right:0}',
    '.cpch-blad-ro{bottom:0;right:0}',
    '.cpch-blad-lo{bottom:0;left:0}',
    '@media (max-width:899.98px){.cpch-blad{display:none}}',

    /* intekenanimatie — uitsluitend CSS, nooit setInterval. Er staat er
       precies één, want er wordt precies één ding geanimeerd: het intekenen
       van de ring en van het afgelegde deel van het fasepad. Een tweede
       animatie (cpch-op, een opacityfade) stond hier zonder dat één regel
       code hem ooit opzette — weg, want dode CSS in een injectieblok is
       stijl die je later niet durft aan te raken.
       Het !important is de bewuste uitzondering op de 0,1,0-belofte: onder
       prefers-reduced-motion mag geen enkele latere regel de beweging
       terugzetten. */
    '@keyframes cpch-teken{from{stroke-dashoffset:var(--cpch-lengte,0)}to{stroke-dashoffset:0}}',
    '.cpch-teken{animation:cpch-teken .9s cubic-bezier(.4,0,.2,1) both}',
    '@media (prefers-reduced-motion:reduce){.cpch-teken{animation:none!important;stroke-dashoffset:0!important}}'
  ].join('\n');

  function zorgStijl() {
    if (typeof document === 'undefined' || !document.head) return;
    if (document.getElementById(STIJL_ID)) return;
    var s = document.createElement('style');
    s.id = STIJL_ID;
    s.textContent = STIJL;
    document.head.appendChild(s);
  }

  /* ============================================================
     5. TOEGANKELIJKHEID — hoofdstuk 8, op één plek
     ============================================================ */

  /* role="img" + <title> als EERSTE kind + aria-label met de echte waarden.
     De <title> is er voor lezers die de aria-label niet oppikken en voor de
     tooltip; het aria-label wint als beide er zijn. */
  function toegankelijk(node, label, titel) {
    var l = str(label);
    node.setAttribute('role', 'img');
    if (l) node.setAttribute('aria-label', l);
    var t = svg('title', { text: str(titel) || l });
    if (node.firstChild) node.insertBefore(t, node.firstChild);
    else node.appendChild(t);
    return node;
  }

  function decoratief(node) {
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('focusable', 'false');
    return node;
  }

  /* de tekstuele tegenhanger van een reeksgrafiek: "Cashflow per maand:
     december 400 euro, januari 1.225 euro, ..." — hoofdstuk 8 vraagt
     letterlijk om de ECHTE waarden, niet om "een grafiek met zes staven". */
  function waardeTekst(waarde, o) {
    if (o.centen) return euroWoord(waarde);
    var t = getal(waarde, num(o.decimalen, 0));
    var e = str(o.eenheid);
    if (!e) return t;
    return e === '%' ? t + '%' : t + ' ' + e;
  }

  /* Een reeks mag zichzelf als "altijdLabel" aanbieden. Dat is nodig sinds
     areaChart en barChart hun staven en hun overlaylijn ook in het label
     zetten: bij één gewone reeks is de reeksnaam overbodig (de titel zegt het
     al), maar "norm: maandag 40, dinsdag 40" moet ALTIJD te onderscheiden
     zijn van de staafwaarden — anders leest een schermlezer twee rijen
     getallen achter elkaar zonder te weten welke waarvan is. */
  function reeksTekst(titel, reeksen, xLabels, o) {
    var delen = [], i, j;
    for (i = 0; i < reeksen.length; i++) {
      var r = reeksen[i];
      var stukken = [];
      for (j = 0; j < r.waarden.length; j++) {
        var lab = str(xLabels[j]);
        stukken.push((lab ? lab + ' ' : '') + waardeTekst(r.waarden[j], o));
      }
      var toonLabel = !!r.label && (reeksen.length > 1 || r.altijdLabel === true);
      delen.push((toonLabel ? r.label + ': ' : '') + stukken.join(', '));
    }
    var kop = str(titel);
    if (!delen.length) return kop ? kop + ': geen gegevens' : 'Geen gegevens';
    return (kop ? kop + ': ' : '') + delen.join('. ');
  }

  /* ============================================================
     6. DE KROMME — Catmull-Rom naar kubieke Bezier
     ============================================================
     De mockups hebben overal zachte curven en nergens een kaarsrecht
     lijnstuk. Catmull-Rom loopt door alle punten heen (in tegenstelling tot
     een gewone B-spline) en is daarmee de juiste keuze voor data.

     DE KLEM IS HET BELANGRIJKSTE DEEL. Ongeklemd schiet Catmull-Rom over
     een lokaal uiterste heen: een cashflowreeks 0, 1200, 0 duikt tussen de
     tweede en derde maand ONDER nul en dan staat er een verlies op het
     scherm dat nergens in de data staat. Daarom worden de controlepunten
     per segment geklemd binnen het bereik van de twee eindpunten van dat
     segment. Gevolg: de curve blijft monotoon tussen twee punten en kan
     nooit buiten het databereik komen. De prijs is een fractie minder
     "zwier" bij scherpe knikken; dat is hier de goede ruil. */

  function schoonPunten(punten) {
    var uit = [], i, p, x, y;
    var lijst = arr(punten);
    for (i = 0; i < lijst.length; i++) {
      p = lijst[i];
      if (!p) continue;
      /* isGetal en niet Number(): {x:null,y:3} zou anders een punt op x=0
         worden en de kromme naar de linkerrand trekken, terwijl er in de
         data helemaal geen x stond. Een half punt is geen punt. */
      if (!isGetal(p.x) || !isGetal(p.y)) continue;
      x = Number(p.x); y = Number(p.y);
      uit.push({ x: x, y: y });
    }
    return uit;
  }

  /* nr(): de laatste zeef vóór een coördinaat in een pad belandt. Twee
     decimalen is ruim genoeg voor een viewBox van een paar honderd
     eenheden en houdt de d-tekenreeks kort. */
  function nr(v) {
    /* hier is 0 de terugval en niet "leeg": een coördinaat MOET een getal
       zijn, anders staat er "M NaN,NaN" in het pad. Dat is het enige punt in
       dit bestand waar een ontbrekende waarde wél een nul mag worden, en
       daarom loopt het expliciet via num(v, 0). */
    return String(Math.round(num(v, 0) * 100) / 100);
  }

  /* de segmentenlijst wordt EENMAAL berekend en daarna hergebruikt door
     path() én door stagePath(), die hem op een puntgrens doorknipt. Dat is
     de reden dat dit een aparte functie is: twee losse path()-aanroepen op
     twee deelreeksen geven aan de knip een andere kromming en dus een
     zichtbare naad. */
  function krommeSegmenten(punten, opts) {
    var o = opt(opts);
    var sp = klem(num(o.spanning, 0.5), 0, 1);   /* 0 = recht, 0.5 = klassiek Catmull-Rom */
    var klemAan = o.klem !== false;
    var p = schoonPunten(punten);
    var segs = [], i;
    for (i = 0; i < p.length - 1; i++) {
      var p0 = p[i > 0 ? i - 1 : 0];
      var p1 = p[i];
      var p2 = p[i + 1];
      var p3 = p[i + 2 < p.length ? i + 2 : p.length - 1];
      var c1x = p1.x + (p2.x - p0.x) * sp / 3;
      var c1y = p1.y + (p2.y - p0.y) * sp / 3;
      var c2x = p2.x - (p3.x - p1.x) * sp / 3;
      var c2y = p2.y - (p3.y - p1.y) * sp / 3;
      if (klemAan) {
        var yl = Math.min(p1.y, p2.y), yh = Math.max(p1.y, p2.y);
        var xl = Math.min(p1.x, p2.x), xh = Math.max(p1.x, p2.x);
        c1y = klem(c1y, yl, yh); c2y = klem(c2y, yl, yh);
        c1x = klem(c1x, xl, xh); c2x = klem(c2x, xl, xh);
      }
      segs.push({ c1x: c1x, c1y: c1y, c2x: c2x, c2y: c2y, x: p2.x, y: p2.y });
    }
    return { punten: p, segmenten: segs };
  }

  /* deel van een kromme als pad-tekenreeks; van/tot zijn SEGMENTindexen */
  function padUitSegmenten(kromme, van, tot) {
    var p = kromme.punten, segs = kromme.segmenten;
    if (!p.length) return '';
    var v = klem(Math.round(num(van, 0)), 0, segs.length);
    var t = klem(Math.round(num(tot, segs.length)), v, segs.length);
    var start = p[v] || p[0];
    var d = 'M' + nr(start.x) + ',' + nr(start.y);
    for (var i = v; i < t; i++) {
      var s = segs[i];
      d += 'C' + nr(s.c1x) + ',' + nr(s.c1y) + ' ' + nr(s.c2x) + ',' + nr(s.c2y) + ' ' + nr(s.x) + ',' + nr(s.y);
    }
    return d;
  }

  /* path(punten, opts) — de publieke vorm. Lege reeks → lege tekenreeks
     (een <path d=""> tekent niets en klapt niet). Eén punt → "M x,y", ook
     dat tekent niets maar is geldig. */
  function path(punten, opts) {
    var k = krommeSegmenten(punten, opts);
    return padUitSegmenten(k, 0, k.segmenten.length);
  }

  /* een gevuld vlak onder een kromme: de kromme heen, en langs de basislijn
     terug. Geen tweede kromme nodig, dus geen kans op een spleet. */
  function vlakPad(kromme, basisY) {
    var p = kromme.punten;
    if (p.length < 2) return '';
    var d = padUitSegmenten(kromme, 0, kromme.segmenten.length);
    var laatste = p[p.length - 1];
    return d + 'L' + nr(laatste.x) + ',' + nr(basisY) + 'L' + nr(p[0].x) + ',' + nr(basisY) + 'Z';
  }

  /* een gestapeld vlak tussen twee krommen: bovenkromme heen, onderkromme
     achterstevoren terug. De onderkromme wordt uit ZIJN EIGEN segmenten
     opgebouwd, van achter naar voren, zodat boven- en ondergrens exact op
     elkaar aansluiten. */
  function tussenPad(boven, onder) {
    var bp = boven.punten, op = onder.punten;
    if (bp.length < 2 || op.length < 2) return '';
    var d = padUitSegmenten(boven, 0, boven.segmenten.length);
    var laatste = op[op.length - 1];
    d += 'L' + nr(laatste.x) + ',' + nr(laatste.y);
    for (var i = onder.segmenten.length - 1; i >= 0; i--) {
      var s = onder.segmenten[i];
      var doel = op[i];
      /* achterstevoren: de controlepunten wisselen van plaats */
      d += 'C' + nr(s.c2x) + ',' + nr(s.c2y) + ' ' + nr(s.c1x) + ',' + nr(s.c1y) + ' ' + nr(doel.x) + ',' + nr(doel.y);
    }
    return d + 'Z';
  }

  /* een rechthoek met alleen bovenaan een radius (spec 4.4: radius 4px
     alleen bovenaan de bovenste stapel) */
  function staafPad(x, y, breedte, hoogte, radius) {
    var b = num(breedte, 0), h = num(hoogte, 0);
    if (b <= 0 || h <= 0) return '';
    var r = klem(num(radius, 0), 0, Math.min(b / 2, h));
    var x0 = num(x, 0), y0 = num(y, 0);
    return 'M' + nr(x0) + ',' + nr(y0 + h) +
      'L' + nr(x0) + ',' + nr(y0 + r) +
      'A' + nr(r) + ',' + nr(r) + ' 0 0 1 ' + nr(x0 + r) + ',' + nr(y0) +
      'L' + nr(x0 + b - r) + ',' + nr(y0) +
      'A' + nr(r) + ',' + nr(r) + ' 0 0 1 ' + nr(x0 + b) + ',' + nr(y0 + r) +
      'L' + nr(x0 + b) + ',' + nr(y0 + h) + 'Z';
  }

  /* ============================================================
     7. ICONEN — outline, stroke 1.6, currentColor, viewBox 0 0 24 24
     ============================================================
     Met de hand getekend, geen fill, ronde uiteinden. Precies de acht die de
     grafieken nodig hebben; een negende erbij is een regel in deze tabel. */

  var ICONEN = {
    vinkje: [{ t: 'path', d: 'M5 12.6 L9.6 17.2 L19 6.8' }],
    pijl: [{ t: 'path', d: 'M4 12 H19.5' }, { t: 'path', d: 'M13.5 6 L19.5 12 L13.5 18' }],
    vrachtwagen: [
      { t: 'path', d: 'M2.6 6.4 H13.6 V16 H2.6 Z' },
      { t: 'path', d: 'M13.6 10.2 H17 L20.4 13.4 V16 H13.6 Z' },
      { t: 'circle', cx: 7, cy: 18, r: 1.9 },
      { t: 'circle', cx: 17.2, cy: 18, r: 1.9 },
      { t: 'path', d: 'M5.1 16 H8.9 M15.3 16 H19.1' }
    ],
    doos: [
      { t: 'path', d: 'M3.2 7.4 L12 3.3 L20.8 7.4 V16.6 L12 20.7 L3.2 16.6 Z' },
      { t: 'path', d: 'M3.2 7.4 L12 11.5 L20.8 7.4' },
      { t: 'path', d: 'M12 11.5 V20.7' }
    ],
    lamp: [
      { t: 'path', d: 'M8.4 14.5 A6 6 0 1 1 15.6 14.5 C14.9 15.2 14.6 16 14.6 16.9 H9.4 C9.4 16 9.1 15.2 8.4 14.5 Z' },
      { t: 'path', d: 'M9.7 19.4 H14.3' },
      { t: 'path', d: 'M10.8 21.8 H13.2' }
    ],
    fabriek: [
      { t: 'path', d: 'M3 20.4 V11 L7.7 14 V11 L12.4 14 V11 L17.1 14 V20.4 Z' },
      { t: 'path', d: 'M2.2 20.4 H21.8' },
      { t: 'path', d: 'M17.1 14 V6.2 H20.3 V20.4' }
    ],
    winkelwagen: [
      { t: 'path', d: 'M2.5 4 H5.3 L7.7 15 H17.6 L20 7.6 H6.2' },
      { t: 'circle', cx: 9.4, cy: 19, r: 1.7 },
      { t: 'circle', cx: 16.6, cy: 19, r: 1.7 }
    ],
    gereedschap: [
      { t: 'path', d: 'M16.4 3.6 A5 5 0 0 0 11.8 10.5 L4 18.3 A2.1 2.1 0 0 0 7 21.3 L14.8 13.5 A5 5 0 0 0 21.4 6.8 L18.3 9.9 L15.5 9.5 L15.1 6.7 Z' }
    ]
  };

  /* de vormen als <g>, zodat een icoon ook binnenin een grotere SVG kan
     staan (de ring met het vinkje doet dat) */
  function icoonGroep(naam, opts) {
    var o = opt(opts);
    var vormen = ICONEN[str(naam)] || [];
    var draai = num(o.draai, 0);
    var g = svg('g', {
      fill: 'none',
      stroke: o.kleur ? kleur(o.kleur) : 'currentColor',
      'stroke-width': num(o.dikte, 1.6),
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      /* draaien gebeurt op DEZE groep en nooit op het <svg>-element
         eromheen: het transform-attribuut op een buitenste <svg> wordt door
         Chrome niet toegepast, waardoor het icoon ongedraaid blijft staan of
         zelfs buiten zijn knop belandt. Op een <g> werkt het overal. */
      transform: draai ? 'rotate(' + nr(draai) + ' 12 12)' : null
    });
    for (var i = 0; i < vormen.length; i++) {
      var v = vormen[i];
      if (v.t === 'circle') g.appendChild(svg('circle', { cx: v.cx, cy: v.cy, r: v.r }));
      else g.appendChild(svg('path', { d: v.d }));
    }
    return g;
  }

  function icoonSvg(naam, opts) {
    var o = opt(opts);
    var maat = num(o.maat, 24);
    var s = svg('svg', {
      viewBox: '0 0 24 24',
      width: maat, height: maat,
      class: 'cpch-icoon' + (o.klasse ? ' ' + str(o.klasse) : '')
    }, [icoonGroep(naam, o)]);
    /* een icoon is standaard decoratie naast een woord (hoofdstuk 8: kleur
       en vorm zijn nooit de enige drager). Alleen met een expliciete titel
       wordt het een zelfstandige afbeelding. */
    if (o.titel) toegankelijk(s, o.titel); else decoratief(s);
    return s;
  }

  function iconSet() {
    var uit = { namen: Object.keys(ICONEN), maak: icoonSvg };
    Object.keys(ICONEN).forEach(function (naam) {
      uit[naam] = function (opts) { return icoonSvg(naam, opts); };
    });
    return uit;
  }

  /* ============================================================
     8. LEGE TOESTAND — één vorm voor alle grafieken
     ============================================================ */

  /* Er stond een vijfde parameter `vast` in deze functie met overal een
     `vast ? ... : ...`-tak erachter. Geen van de vijf aanroepers gaf hem ooit
     mee, dus de helft van deze functie was code die nooit gedraaid heeft en
     dus ook nooit getest is. Weg. Wie ooit een lege stand op vaste
     pixelmaat nodig heeft bouwt hem dan bewust, met een test erbij. */
  function leegVlak(o, breedte, hoogte, titel) {
    var b = Math.max(20, num(breedte, 200)), h = Math.max(20, num(hoogte, 100));
    var s = svg('svg', {
      viewBox: '0 0 ' + nr(b) + ' ' + nr(h),
      class: 'cpch-svg',
      width: '100%'
    });
    /* Zonder standaardwaarde is de lege stand een volstrekt blanco vlak: wie
       leegtekst vergeet, laat een gebruiker naar niets kijken zonder te weten
       of de grafiek stuk is of gewoon leeg. Een expliciete lege tekst
       ('leegtekst': '') blijft wél leeg — dat is dan een keuze. */
    var tekst = (o.leegtekst === undefined || o.leegtekst === null)
      ? 'Geen gegevens' : str(o.leegtekst);
    if (tekst) {
      /* De leegtekst staat in de SVG en schaalt dus mee met de viewBox. In
         een kolom die breder is dan de ontwerpmaat zou "Geen gegevens" daardoor
         uitgroeien tot een kop van veertig pixels. Vandaar de max-breedte: de
         lege toestand wordt nooit groter dan zijn ontwerpmaat en de tekst
         blijft de 13px die hij hoort te zijn. */
      s.style.maxWidth = nr(b) + 'px';
      s.appendChild(svg('text', {
        x: b / 2, y: h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 13, fill: tok('ink-2'), text: tekst
      }));
    }
    toegankelijk(s, str(o.beschrijving) || (str(titel) ? str(titel) + ': geen gegevens' : 'Geen gegevens'), titel);
    return s;
  }

  /* ============================================================
     9. ring(opts) — spec 4.1
     ============================================================
     opts: {waarde, max, maat, dikte, tekst, subtekst, icoon, toon, label,
            percentage, beschrijving, animeer}
     Boog begint bovenaan (12 uur) en loopt met de klok mee — dat is precies
     wat rotate(-90) om het middelpunt doet bij een <circle> met een
     dasharray, want een cirkel start standaard op 3 uur.
     Vaste pixelmaat: de spec noemt 72 / 56 / 110 met zoveel woorden. */

  function ring(opts) {
    zorgStijl();
    var o = opt(opts);
    var maat = Math.max(16, num(o.maat, 72));
    var dikte = Math.max(2, num(o.dikte, Math.round(maat * 8 / 72)));
    var r = (maat - dikte) / 2;
    if (r <= 0) r = maat / 4;
    var c = maat / 2;
    var omtrek = 2 * Math.PI * r;

    var max = num(o.max, 100);
    var waarde = num(o.waarde, 0);
    /* max <= 0 kan niet gedeeld worden; dan is er geen boog, alleen spoor */
    var deel = max > 0 ? klem(waarde / max, 0, 1) : 0;
    var procent = Math.round(deel * 100);
    /* De boog en het percentage zijn geklemd; de GETOONDE waarde moet dat dus
       ook zijn, anders vertelt de ring drie verschillende verhalen. Bij
       waarde -5 stond er "-5 van 100, 0 procent" in het aria-label bij een
       leeg spoor, en bij 130 van 100 een vol getekende ring naast een getal
       dat nergens op de ring te zien is. Wie het rauwe getal wél in het
       midden wil, geeft opts.tekst mee — dat blijft ongemoeid. */
    var getoond = max > 0 ? klem(waarde, 0, max) : 0;

    var s = svg('svg', { viewBox: '0 0 ' + nr(maat) + ' ' + nr(maat), width: maat, height: maat, class: 'cpch-ring' });

    /* spoor: altijd de volle cirkel (spec: "bij waarde 0 een volledig spoor
       en geen boog") */
    s.appendChild(svg('circle', {
      cx: c, cy: c, r: r, fill: 'none',
      stroke: kleur(o.spoor || 'line-2'), 'stroke-width': dikte
    }));

    var boogKleur = kleur(o.toon || 'ink');
    if (deel >= 1) {
      /* volle ring zonder naad: geen dasharray, dus geen twee uiteinden die
         elkaar net wel of net niet raken */
      s.appendChild(svg('circle', {
        cx: c, cy: c, r: r, fill: 'none', stroke: boogKleur, 'stroke-width': dikte
      }));
    } else if (deel > 0) {
      var lengte = omtrek * deel;
      var boog = svg('circle', {
        cx: c, cy: c, r: r, fill: 'none', stroke: boogKleur, 'stroke-width': dikte,
        'stroke-linecap': 'round',
        'stroke-dasharray': nr(lengte) + ' ' + nr(omtrek),
        transform: 'rotate(-90 ' + nr(c) + ' ' + nr(c) + ')',
        'class': o.animeer === false ? null : 'cpch-teken'
      });
      /* de intekenanimatie loopt via een CSS-variabele; onder
         prefers-reduced-motion zet het stijlblok de animatie uit en staat de
         boog meteen op zijn eindstand */
      if (o.animeer !== false) boog.style.setProperty('--cpch-lengte', nr(lengte));
      s.appendChild(boog);
    }

    /* midden: icoon, of tekst, of het getal */
    if (o.icoon) {
      var im = num(o.icoonMaat, Math.round(maat * 0.30));
      var k = im / 24;
      var g = icoonGroep(o.icoon, { kleur: o.icoonKleur || o.toon || 'ink', dikte: num(o.icoonDikte, 1.6) / k });
      g.setAttribute('transform', 'translate(' + nr(c - im / 2) + ',' + nr(c - im / 2) + ') scale(' + nr(k) + ')');
      s.appendChild(g);
    } else {
      var midden = str(o.tekst);
      if (!midden && o.percentage) midden = getal(procent, 0) + '%';
      /* isGetal en niet "!== undefined && !== null": met waarde:'' of
         waarde:{} stond er anders een verzonnen "0" in het midden van de
         ring, terwijl er helemaal geen meting was */
      if (!midden && isGetal(o.waarde)) midden = getal(getoond, num(o.decimalen, 0));
      var sub = str(o.subtekst);
      if (midden) {
        /* 72px → 34px, 56px → 15px (spec 4.1). Met een subregel erbij wordt
           het getal kleiner, anders raken de twee regels de ring. */
        var basis = maat >= 96 ? 24 : (maat >= 68 ? 34 : 15);
        var groot = num(o.tekstMaat, sub ? Math.round(maat * 0.26) : basis);
        var dy = sub ? -Math.round(maat * 0.05) : 0;
        s.appendChild(svg('text', {
          x: c, y: c + dy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': groot, 'font-weight': 500, fill: kleur(o.tekstKleur || 'ink'),
          'class': 'cpch-num', text: midden
        }));
        if (sub) {
          s.appendChild(svg('text', {
            x: c, y: c + dy + groot * 0.78, 'text-anchor': 'middle', 'dominant-baseline': 'central',
            'font-size': Math.max(10, Math.round(maat * 0.13)), fill: tok('ink-2'), text: sub
          }));
        }
      }
    }

    var label = str(o.label) || 'Voortgang';
    var beschrijving = str(o.beschrijving) ||
      (label + ': ' + getal(getoond, num(o.decimalen, 0)) + ' van ' + getal(Math.max(max, 0), 0) + ', ' + getal(procent, 0) + ' procent');
    toegankelijk(s, beschrijving, label);
    return s;
  }

  /* ============================================================
     10. sparkline(opts) — spec 4.2
     ============================================================
     opts: {reeks, breedte, hoogte, toon, eindpunt, eindpuntMaat, vulling,
            centen, eenheid, label, beschrijving, leegtekst} */

  function sparkline(opts) {
    zorgStijl();
    var o = opt(opts);
    /* een ontwerpmaat van 0 of minder bestaat niet: dan wordt de stap tussen
       twee punten negatief en loopt de hele lijn linksbuiten het beeld. De
       ondergrens is klein genoeg om nooit een echte maat te raken. */
    var b = Math.max(20, num(o.breedte, 130));
    var h = Math.max(12, num(o.hoogte, 58));
    var titel = str(o.label) || 'Verloop';

    var ruw = arr(o.reeks), waarden = [], i;
    for (i = 0; i < ruw.length; i++) {
      /* isGetal en niet Number(): een meetpunt dat null is IS er niet, en
         mag geen duik naar nul in de lijn tekenen die nergens in de data
         staat. Zo'n punt valt weg, precies als "abc" of undefined. */
      var rv = isObj(ruw[i]) ? ruw[i].waarde : ruw[i];
      if (isGetal(rv)) waarden.push(Number(rv));
    }
    /* minder dan twee punten: er is geen lijn te trekken. Lege maar geldige
       SVG terug, nooit een uitzondering. */
    if (waarden.length < 2) return leegVlak(o, b, h, titel);

    var lijnKleur = kleur(o.toon || 'ink');
    /* de marge mag nooit meer dan een kwart van de maat opeten, anders keren
       de tekenruimte en daarmee de stap tussen twee punten om */
    var pad = klem(num(o.padding, 3), 0, Math.min(b, h) / 4);
    var top = pad, bodem = h - pad;
    var laag = waarden[0], hoog = waarden[0];
    for (i = 1; i < waarden.length; i++) {
      if (waarden[i] < laag) laag = waarden[i];
      if (waarden[i] > hoog) hoog = waarden[i];
    }
    var span = hoog - laag;
    var stap = (b - 2 * pad) / (waarden.length - 1);
    var punten = [];
    for (i = 0; i < waarden.length; i++) {
      /* een vlakke reeks (alle waarden gelijk) heeft span 0: dan geen
         deling, maar een horizontale lijn precies in het midden */
      var y = span > 0 ? bodem - ((waarden[i] - laag) / span) * (bodem - top) : (top + bodem) / 2;
      punten.push({ x: pad + i * stap, y: y });
    }
    var kromme = krommeSegmenten(punten, { spanning: num(o.spanning, 0.5) });
    var d = padUitSegmenten(kromme, 0, kromme.segmenten.length);

    /* preserveAspectRatio="none": een sparkline is een sfeerlijn in een
       vaste hoogte en mag horizontaal met zijn tegel meerekken. Daarom staat
       de lijn op vector-effect non-scaling-stroke, anders wordt hij bij dat
       rekken dunner of dikker dan de 2px uit de spec. */
    var s = svg('svg', {
      viewBox: '0 0 ' + nr(b) + ' ' + nr(h),
      'class': 'cpch-svg cpch-spark', width: '100%',
      preserveAspectRatio: 'none'
    });
    s.style.height = nr(h) + 'px';

    if (o.vulling !== false) {
      var gid = uid('sv');
      s.appendChild(svg('defs', null, [
        svg('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' }, [
          svg('stop', { offset: '0', 'stop-color': lijnKleur, 'stop-opacity': '0.14' }),
          svg('stop', { offset: '1', 'stop-color': lijnKleur, 'stop-opacity': '0' })
        ])
      ]));
      s.appendChild(svg('path', { d: vlakPad(kromme, h), fill: 'url(#' + gid + ')', stroke: 'none' }));
    }

    s.appendChild(svg('path', {
      d: d, fill: 'none', stroke: lijnKleur, 'stroke-width': num(o.dikte, 2),
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'vector-effect': 'non-scaling-stroke'
    }));

    if (o.eindpunt) {
      var laatst = punten[punten.length - 1];
      /* GEEN <circle>. Deze SVG staat op preserveAspectRatio="none" en rekt
         horizontaal mee met zijn tegel; een gevulde cirkel rekt dan gewoon
         mee en wordt in een tegel van 260px een ellips van 8 bij 4. De lijn
         ontsnapt daaraan met non-scaling-stroke, en dat werkt hier ook: een
         subpad van lengte nul met een RONDE lijnuiteinde tekent per SVG-spec
         een rondje ter grootte van de lijndikte. Dikte 4 geeft dus exact de
         "gevulde cirkel 4px" uit spec 4.2, in elke tegelbreedte even rond. */
      var stipMaat = Math.max(1, num(o.eindpuntMaat, 4));
      s.appendChild(svg('path', {
        d: 'M' + nr(laatst.x) + ',' + nr(laatst.y) + 'L' + nr(laatst.x) + ',' + nr(laatst.y),
        fill: 'none', stroke: lijnKleur, 'stroke-width': stipMaat,
        'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke'
      }));
    }

    toegankelijk(s, str(o.beschrijving) || reeksTekst(titel, [{ label: '', waarden: waarden }], arr(o.xLabels), o), titel);
    return s;
  }

  /* ============================================================
     11. Gedeelde reeksnormalisatie voor areaChart en barChart
     ============================================================ */

  function reeksenUit(bron) {
    var uit = [], i, j;
    var lijst = arr(bron);
    for (i = 0; i < lijst.length; i++) {
      var r = opt(lijst[i]);
      var ruw = arr(Array.isArray(r.punten) ? r.punten : r.waarden);
      var w = [];
      for (j = 0; j < ruw.length; j++) {
        var v = isObj(ruw[j]) ? (ruw[j].y !== undefined ? ruw[j].y : ruw[j].waarde) : ruw[j];
        /* hier wél 0 en niet weglaten: de plek in de rij IS de x-positie, dus
           een punt overslaan zou de hele reeks een kolom opschuiven. Een
           ontbrekende waarde is dan een gat op de basislijn, niet een
           verschoven grafiek. */
        w.push(isGetal(v) ? Number(v) : 0);
      }
      uit.push({ label: str(r.label), kleur: r.kleur, dekking: r.dekking, waarden: w });
    }
    return uit;
  }

  function langste(reeksen) {
    var n = 0;
    for (var i = 0; i < reeksen.length; i++) if (reeksen[i].waarden.length > n) n = reeksen[i].waarden.length;
    return n;
  }

  /* legenda boven de grafiek: vierkantje 9px radius 2px + label 12.5px */
  function legendaLijst(items) {
    var ul = el('ul', { 'class': 'cpch-legenda' });
    for (var i = 0; i < items.length; i++) {
      var it = opt(items[i]);
      var vlag = el('span', { 'class': 'cpch-vlag', 'aria-hidden': 'true' });
      vlag.style.background = kleur(it.kleur || catKleur(i));
      /* eigen klasse op de li: zie het stijlblok — ".cpch-legenda li" zou
         0,1,1 zijn en de 0,1,0-belofte breken */
      ul.appendChild(el('li', { 'class': 'cpch-legenda-item' }, [vlag, el('span', { text: str(it.label) })]));
    }
    return ul;
  }

  /* ============================================================
     12. areaChart(opts) — spec 4.3
     ============================================================
     opts: {reeksen:[{label,kleur,punten}], xLabels, gestapeld,
            staven:{punten,kleur,label}, overlay:{punten,gestreept,kleur,label},
            hoogte, breedte, max, legenda, yLabels, eenheid, centen, titel,
            beschrijving, leegtekst}
     De labels bij staven en overlay zijn optioneel en dienen het aria-label:
     zonder eigen naam heten ze "staven" en "norm".
     Eén functie voor twee vormen uit de mockup:
       · "Portfolio gezondheid" — gestapelde pastelvlakken plus een
         gestreepte overlaylijn (gestapeld:true, overlay:{...});
       · "Cashflow overzicht"   — lichte staven ACHTER een vloeiende curve
         (staven:[...] plus één reeks).
     De staven worden eerst getekend en staan daardoor echt achter het vlak. */

  function areaChart(opts) {
    zorgStijl();
    var o = opt(opts);
    var titel = str(o.titel) || 'Grafiek';
    var B = num(o.breedte, 640);
    var H = num(o.hoogte, 220);
    var reeksen = reeksenUit(o.reeksen);
    var xLabels = arr(o.xLabels);
    var overlay = opt(o.overlay);
    var overlayPunten = arr(overlay.punten);
    var staven = arr(isObj(o.staven) ? o.staven.punten : o.staven);
    var n = Math.max(langste(reeksen), staven.length, overlayPunten.length, xLabels.length);

    /* GESTAPELD KAN NIET MET NEGATIEVE WAARDEN. Eén negatieve waarde trekt de
       bovengrens van die band ONDER de band eronder, en dan tekent tussenPad
       een omgekeerd vlak dat over zijn buren heen ligt: de lezer ziet een
       stapel die niet klopt. barChart klemt daarom al op nul (delen: w < 0 ?
       0 : w) en areaChart doet dat nu net zo — hier meteen aan de bron, zodat
       ook het bereik en het aria-label vertellen wat er getekend staat.
       Zonder stapeling blijft een negatieve waarde gewoon staan: daar is de
       basislijn nul en een dalende cashflowlijn is dan de waarheid. */
    if (o.gestapeld) {
      for (var ri = 0; ri < reeksen.length; ri++) {
        for (var rj = 0; rj < reeksen[ri].waarden.length; rj++) {
          if (reeksen[ri].waarden[rj] < 0) reeksen[ri].waarden[rj] = 0;
        }
      }
    }

    var wrap = el('div', { 'class': 'cpch cpch-area' });
    if (n < 2) {
      /* met minder dan twee kolommen is er geen vlak en geen curve */
      wrap.appendChild(leegVlak(o, B, H, titel));
      return wrap;
    }

    var yLabels = arr(o.yLabels);
    /* staan er staven achter de curve, dan moet het tekenvlak een halve
       staafbreedte inspringen: het eerste en laatste datapunt liggen precies
       op de rand en anders valt de helft van die twee staven buiten beeld */
    var sBreedte = klem(num(isObj(o.staven) ? o.staven.breedte : o.staafBreedte, 18), 2, B / 4);
    var staafInspring = staven.length ? sBreedte / 2 + 2 : 0;
    var mL = num(o.margeLinks, (yLabels.length ? 34 : 6) + staafInspring);
    var mR = num(o.margeRechts, 6 + staafInspring);
    var mB = num(o.margeOnder, xLabels.length ? 24 : 6);
    var mT = num(o.margeBoven, 10);
    var basisY = H - mB;
    var topY = mT;
    var stap = (B - mL - mR) / (n - 1);

    /* bereik bepalen — staven, reeksen en overlay tellen allemaal mee,
       anders loopt er iets buiten beeld */
    var hoog = 0, laag = 0, i, j;
    function meet(v) { if (v > hoog) hoog = v; if (v < laag) laag = v; }
    if (o.gestapeld) {
      for (j = 0; j < n; j++) {
        var som = 0;
        for (i = 0; i < reeksen.length; i++) som += num(reeksen[i].waarden[j], 0);
        meet(som);
      }
    } else {
      for (i = 0; i < reeksen.length; i++) for (j = 0; j < n; j++) meet(num(reeksen[i].waarden[j], 0));
    }
    for (j = 0; j < staven.length; j++) meet(num(isObj(staven[j]) ? staven[j].waarde : staven[j], 0));
    for (j = 0; j < overlayPunten.length; j++) meet(num(isObj(overlayPunten[j]) ? overlayPunten[j].waarde : overlayPunten[j], 0));
    for (j = 0; j < yLabels.length; j++) meet(isObj(yLabels[j]) ? num(yLabels[j].waarde, 0) : num(yLabels[j], 0));

    var min = Math.min(0, laag);
    var max = num(o.max, hoog);
    /* alles nul of alles gelijk: zonder deze regel deelt schaalY() door nul */
    if (max <= min) max = min + 1;

    function schaalY(v) {
      /* KLEMMEN, net als barChart. Geeft een aanroeper een expliciete max mee
         die kleiner is dan de data (een vaste as van 100 bij een uitschieter
         van 130), dan zou de curve zonder deze klem boven het kader
         uitschieten — en .cpch-svg staat op overflow:visible, dus dat tekent
         dwars over de buurtegel heen in plaats van dat het afgeknipt wordt.
         Nu ligt alles binnen het tekenvlak; het aria-label houdt de echte
         waarden, dus de cijfers gaan niet verloren. */
      return basisY - ((klem(num(v, 0), min, max) - min) / (max - min)) * (basisY - topY);
    }
    function schaalX(idx) { return mL + idx * stap; }

    var s = svg('svg', { viewBox: '0 0 ' + nr(B) + ' ' + nr(H), 'class': 'cpch-svg', width: '100%' });

    /* hairlines op de y-waarden */
    for (i = 0; i < yLabels.length; i++) {
      var yl = isObj(yLabels[i]) ? num(yLabels[i].waarde, 0) : num(yLabels[i], 0);
      var yy = schaalY(yl);
      s.appendChild(svg('line', { x1: mL, y1: yy, x2: B - mR, y2: yy, stroke: tok('line-2'), 'stroke-width': 1 }));
      s.appendChild(svg('text', {
        x: mL - 8, y: yy, 'text-anchor': 'end', 'dominant-baseline': 'central',
        'font-size': 11, fill: kleur(o.asKleur || 'ink-2'), 'class': 'cpch-num',
        text: isObj(yLabels[i]) ? str(yLabels[i].label) : getal(yl, 0)
      }));
    }

    /* staven achter het vlak (Cashflow) */
    if (staven.length) {
      /* nu pas begrenzen op de kolomafstand: breder dan de kolom zou de
         staven op elkaar laten lopen */
      if (sBreedte > stap * 0.85) sBreedte = Math.max(2, stap * 0.85);
      var sKleur = kleur(isObj(o.staven) ? (o.staven.kleur || 'line-2') : 'line-2');
      for (j = 0; j < staven.length; j++) {
        var sv = num(isObj(staven[j]) ? staven[j].waarde : staven[j], 0);
        var sy = schaalY(sv), s0 = schaalY(0);
        var dPad = staafPad(schaalX(j) - sBreedte / 2, Math.min(sy, s0), sBreedte, Math.abs(s0 - sy), 4);
        if (dPad) s.appendChild(svg('path', { d: dPad, fill: sKleur }));
      }
    }

    /* vlakken — gestapeld of los */
    var vorige = null;
    for (i = 0; i < reeksen.length; i++) {
      var reeks = reeksen[i];
      var vlakKleur = kleur(reeks.kleur || catKleur(i));
      var punten = [], stapelWaarden = [];
      for (j = 0; j < n; j++) {
        var w = num(reeks.waarden[j], 0);
        var totaal = (o.gestapeld && vorige) ? num(vorige.waarden[j], 0) + w : w;
        stapelWaarden.push(totaal);
        punten.push({ x: schaalX(j), y: schaalY(totaal) });
      }
      var kromme = krommeSegmenten(punten, { spanning: num(o.spanning, 0.5) });

      if (o.gestapeld) {
        /* gestapeld: egale pasteltint, geen verloop — zo staan de mockups
           erbij en zo blijven meerdere lagen uit elkaar te houden */
        var dg = vorige ? tussenPad(kromme, vorige.kromme) : vlakPad(kromme, basisY);
        if (dg) s.appendChild(svg('path', { d: dg, fill: vlakKleur, 'fill-opacity': num(reeks.dekking, 1) }));
        vorige = { waarden: stapelWaarden, kromme: kromme };
      } else {
        /* los: verticaal verloop van 14% naar 0% plus een lijn van 2px,
           precies de sparkline-behandeling op grafiekformaat */
        var gid = uid('ag');
        s.appendChild(svg('defs', null, [
          svg('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' }, [
            svg('stop', { offset: '0', 'stop-color': vlakKleur, 'stop-opacity': '0.14' }),
            svg('stop', { offset: '1', 'stop-color': vlakKleur, 'stop-opacity': '0' })
          ])
        ]));
        var dv = vlakPad(kromme, basisY);
        if (dv) s.appendChild(svg('path', { d: dv, fill: 'url(#' + gid + ')' }));
        s.appendChild(svg('path', {
          d: padUitSegmenten(kromme, 0, kromme.segmenten.length),
          fill: 'none', stroke: vlakKleur, 'stroke-width': num(o.lijnDikte, 2),
          'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
      }
    }

    /* gestreepte overlaylijn */
    if (overlayPunten.length > 1) {
      var op = [];
      for (j = 0; j < overlayPunten.length; j++) {
        var ov = num(isObj(overlayPunten[j]) ? overlayPunten[j].waarde : overlayPunten[j], 0);
        op.push({ x: schaalX(j), y: schaalY(ov) });
      }
      s.appendChild(svg('path', {
        d: path(op, { spanning: num(o.spanning, 0.5) }),
        fill: 'none', stroke: kleur(overlay.kleur || 'ink-3'),
        'stroke-width': num(overlay.dikte, 1.5),
        'stroke-dasharray': overlay.gestreept === false ? null : '5 5',
        'stroke-linecap': 'round'
      }));
    }

    /* x-labels: binnen de SVG, zodat ze op elke breedte precies onder hun
       kolom blijven staan. De eerste en laatste worden naar binnen
       uitgelijnd, anders vallen ze half buiten het kader. */
    for (j = 0; j < xLabels.length && j < n; j++) {
      var lab = str(xLabels[j]);
      if (!lab) continue;
      s.appendChild(svg('text', {
        x: schaalX(j), y: H - 6,
        'text-anchor': j === 0 ? 'start' : (j === n - 1 ? 'end' : 'middle'),
        'font-size': 12, fill: kleur(o.asKleur || 'ink-2'), text: lab
      }));
    }

    /* HET LABEL VERTELT ALLES WAT ER GETEKEND STAAT — hoofdstuk 8 en afspraak
       4 in het kopblok. Dit is precies de grafiek uit spec 4.3 met drie soorten
       inhoud: reeksen, staven erachter (Cashflow) en een gestreepte
       overlaylijn (Portfolio gezondheid, en bij Operaties de capaciteitsnorm).
       Alleen de reeksen noemen liet de staafwaarden en de norm volledig
       wegvallen voor wie de grafiek niet ziet: die kreeg een halve grafiek
       voorgelezen zonder te merken dat er een helft ontbrak. De staven en de
       lijn krijgen daarom hun eigen benoemde rij in het label, met een
       standaardnaam als de aanroeper er geen meegeeft. */
    var labelReeksen = reeksen.slice(0);
    if (staven.length) {
      var staafWaarden = [];
      for (j = 0; j < staven.length; j++) staafWaarden.push(num(isObj(staven[j]) ? staven[j].waarde : staven[j], 0));
      labelReeksen.push({
        label: str(isObj(o.staven) ? o.staven.label : '') || 'staven',
        waarden: staafWaarden, altijdLabel: true
      });
    }
    if (overlayPunten.length) {
      var overlayWaarden = [];
      for (j = 0; j < overlayPunten.length; j++) overlayWaarden.push(num(isObj(overlayPunten[j]) ? overlayPunten[j].waarde : overlayPunten[j], 0));
      labelReeksen.push({
        label: str(overlay.label) || 'norm',
        waarden: overlayWaarden, altijdLabel: true
      });
    }
    toegankelijk(s, str(o.beschrijving) || reeksTekst(titel, labelReeksen, xLabels, o), titel);

    if (o.legenda) wrap.appendChild(legendaLijst(o.legenda === true ? reeksen : arr(o.legenda)));
    wrap.appendChild(s);
    return wrap;
  }

  /* ============================================================
     13. barChart(opts) — spec 4.4
     ============================================================
     opts: {groepen:[{label, delen:[{kleur,waarde,label}]}], max, yLabels,
            overlay:{punten,gestreept,kleur,label}, hoogte, breedte, legenda,
            eenheid, titel, beschrijving, leegtekst}
     overlay.label komt in het aria-label ("capaciteitsnorm: ma 40, di 40");
     zonder eigen naam heet die lijn daar "norm".
     Staven 26px, radius 4px alleen bovenaan de bovenste stapel. */

  function barChart(opts) {
    zorgStijl();
    var o = opt(opts);
    var titel = str(o.titel) || 'Staafdiagram';
    var B = num(o.breedte, 640);
    var H = num(o.hoogte, 220);
    var wrap = el('div', { 'class': 'cpch cpch-bar' });

    var groepen = [], i, j;
    var ruw = arr(o.groepen);
    for (i = 0; i < ruw.length; i++) {
      var g = opt(ruw[i]);
      var delen = [];
      var rd = arr(g.delen);
      for (j = 0; j < rd.length; j++) {
        var d = opt(rd[j]);
        var w = num(d.waarde, 0);
        delen.push({ label: str(d.label), kleur: d.kleur, waarde: w < 0 ? 0 : w });
      }
      groepen.push({ label: str(g.label), delen: delen });
    }
    if (!groepen.length) { wrap.appendChild(leegVlak(o, B, H, titel)); return wrap; }

    /* y-as: standaard 0/25/50/75/100 met hairlines (spec 4.4) */
    var yLabels = arr(o.yLabels);
    var eenheid = o.eenheid === undefined ? (yLabels.length ? '' : '%') : str(o.eenheid);
    var max = num(o.max, 0);
    if (max <= 0) {
      for (i = 0; i < groepen.length; i++) {
        var som = 0;
        for (j = 0; j < groepen[i].delen.length; j++) som += groepen[i].delen[j].waarde;
        if (som > max) max = som;
      }
    }
    var overlay = opt(o.overlay);
    var overlayPunten = arr(overlay.punten);
    for (j = 0; j < overlayPunten.length; j++) {
      var ow = num(isObj(overlayPunten[j]) ? overlayPunten[j].waarde : overlayPunten[j], 0);
      if (ow > max) max = ow;
    }
    for (i = 0; i < yLabels.length; i++) {
      var yv = isObj(yLabels[i]) ? num(yLabels[i].waarde, 0) : num(yLabels[i], 0);
      if (yv > max) max = yv;
    }
    /* alle waarden nul: max blijft 0 en delen door 0 mag nooit. Dan een
       geldig raster met staven van hoogte nul.
       DEZE REGEL STAAT BEWUST VÓÓR het maken van de standaardlabels. Stond
       hij erna, dan werden de labels uit max=0 gerekend en kwamen er vijf
       nullen uit: vijf hairlines exact op elkaar op de basislijn met vijf
       keer het woord "0" over elkaar heen. Dat is precies de stand die je bij
       een lege week te zien krijgt, dus de stand die het vaakst getest wordt. */
    if (max <= 0) max = 1;
    if (!yLabels.length) yLabels = (eenheid === '%') ? [0, 25, 50, 75, 100] : [0, max / 4, max / 2, max * 3 / 4, max];
    /* en het aantal decimalen volgt uit de afstand tussen twee labels: bij
       een as van 0 tot 1 rondt getal(x, 0) vier verschillende waarden op
       dezelfde tekst af, en dan staat er alsnog vier keer hetzelfde */
    var asStap = max / 4;
    var asDec = (asStap >= 1) ? 0 : (asStap >= 0.1 ? 1 : 2);

    var mL = num(o.margeLinks, 36);
    var mR = num(o.margeRechts, 8);
    var mT = num(o.margeBoven, 10);
    var mB = num(o.margeOnder, 26);
    var basisY = H - mB, topY = mT;
    var kolom = (B - mL - mR) / groepen.length;
    var staafB = klem(num(o.staafBreedte, 26), 2, Math.max(2, kolom * 0.7));

    function schaalY(v) { return basisY - (klem(num(v, 0), 0, max) / max) * (basisY - topY); }
    function midX(idx) { return mL + kolom * (idx + 0.5); }

    var s = svg('svg', { viewBox: '0 0 ' + nr(B) + ' ' + nr(H), 'class': 'cpch-svg', width: '100%' });

    var getekendeY = [];
    for (i = 0; i < yLabels.length; i++) {
      var lw = isObj(yLabels[i]) ? num(yLabels[i].waarde, 0) : num(yLabels[i], 0);
      var ly = schaalY(lw);
      /* twee labels op dezelfde hoogte geven twee hairlines op elkaar en twee
         teksten door elkaar; de tweede voegt niets toe en wordt overgeslagen */
      var alGetekend = false;
      for (j = 0; j < getekendeY.length; j++) if (Math.abs(getekendeY[j] - ly) < 0.5) alGetekend = true;
      if (alGetekend) continue;
      getekendeY.push(ly);
      s.appendChild(svg('line', { x1: mL, y1: ly, x2: B - mR, y2: ly, stroke: tok('line-2'), 'stroke-width': 1 }));
      s.appendChild(svg('text', {
        x: mL - 8, y: ly, 'text-anchor': 'end', 'dominant-baseline': 'central',
        'font-size': 11, fill: kleur(o.asKleur || 'ink-2'), 'class': 'cpch-num',
        text: isObj(yLabels[i]) ? str(yLabels[i].label) : (getal(lw, asDec) + (eenheid === '%' ? '%' : ''))
      }));
    }

    /* stapels: van onder naar boven; alleen de BOVENSTE zichtbare stapel
       krijgt de radius, want een radius halverwege een stapel geeft witte
       spleten tussen de delen */
    for (i = 0; i < groepen.length; i++) {
      var delen2 = groepen[i].delen;
      var bovenste = -1;
      for (j = 0; j < delen2.length; j++) if (delen2[j].waarde > 0) bovenste = j;
      var cum = 0;
      var x = midX(i) - staafB / 2;
      for (j = 0; j < delen2.length; j++) {
        var v = delen2[j].waarde;
        if (v <= 0) continue;
        var y0 = schaalY(cum + v), y1 = schaalY(cum);
        var dPad2 = (j === bovenste) ? staafPad(x, y0, staafB, y1 - y0, 4)
          : 'M' + nr(x) + ',' + nr(y0) + 'H' + nr(x + staafB) + 'V' + nr(y1) + 'H' + nr(x) + 'Z';
        if (dPad2) s.appendChild(svg('path', { d: dPad2, fill: kleur(delen2[j].kleur || catKleur(j)) }));
        cum += v;
      }
    }

    if (overlayPunten.length > 1) {
      var op2 = [];
      for (j = 0; j < overlayPunten.length && j < groepen.length; j++) {
        var ov2 = num(isObj(overlayPunten[j]) ? overlayPunten[j].waarde : overlayPunten[j], 0);
        op2.push({ x: midX(j), y: schaalY(ov2) });
      }
      s.appendChild(svg('path', {
        d: path(op2, { spanning: num(o.spanning, 0.5) }),
        fill: 'none', stroke: kleur(overlay.kleur || 'ink-3'),
        'stroke-width': num(overlay.dikte, 1.5),
        'stroke-dasharray': overlay.gestreept === false ? null : '5 5',
        'stroke-linecap': 'round'
      }));
    }

    for (i = 0; i < groepen.length; i++) {
      if (!groepen[i].label) continue;
      s.appendChild(svg('text', {
        x: midX(i), y: H - 8, 'text-anchor': 'middle',
        'font-size': 12, fill: kleur(o.asKleur || 'ink-2'), text: groepen[i].label
      }));
    }

    /* tekstuele tegenhanger: per groep alle delen met naam en waarde */
    var zinnen = [];
    for (i = 0; i < groepen.length; i++) {
      var stukken = [];
      for (j = 0; j < groepen[i].delen.length; j++) {
        stukken.push((groepen[i].delen[j].label ? groepen[i].delen[j].label + ' ' : '') +
          waardeTekst(groepen[i].delen[j].waarde, { eenheid: eenheid, centen: o.centen, decimalen: o.decimalen }));
      }
      zinnen.push((groepen[i].label ? groepen[i].label + ': ' : '') + stukken.join(', '));
    }
    /* De gestreepte lijn hoort er ook in. Bij "Operaties deze week" IS die
       lijn de capaciteitsnorm: zonder die getallen weet een schermlezer wel
       hoeveel werk er op donderdag staat, maar niet dat het boven de norm
       ligt — en dat is nou juist waar die grafiek over gaat. */
    if (overlayPunten.length) {
      var normStukken = [];
      for (j = 0; j < overlayPunten.length; j++) {
        var nw = num(isObj(overlayPunten[j]) ? overlayPunten[j].waarde : overlayPunten[j], 0);
        var nl = (j < groepen.length) ? groepen[j].label : '';
        normStukken.push((nl ? nl + ' ' : '') +
          waardeTekst(nw, { eenheid: eenheid, centen: o.centen, decimalen: o.decimalen }));
      }
      zinnen.push((str(overlay.label) || 'norm') + ': ' + normStukken.join(', '));
    }
    toegankelijk(s, str(o.beschrijving) || (titel + ': ' + (zinnen.length ? zinnen.join('. ') : 'geen gegevens')), titel);

    if (o.legenda) {
      var items = (o.legenda === true) ? [] : arr(o.legenda);
      if (o.legenda === true) {
        for (j = 0; j < groepen[0].delen.length; j++) {
          items.push({ label: groepen[0].delen[j].label, kleur: groepen[0].delen[j].kleur || catKleur(j) });
        }
      }
      wrap.appendChild(legendaLijst(items));
    }
    wrap.appendChild(s);
    return wrap;
  }

  /* ============================================================
     14. donut(opts) — spec 4.5
     ============================================================
     opts: {segmenten:[{label,waarde,kleur}], maat, dikte,
            midden:{waarde,label}, legenda:'percentage'|'waarde'|false,
            titel, beschrijving, centen}
     De 2px witte tussenruimte komt uit stroke-dasharray en NIET uit losse
     paden: met losse paden moet je per segment twee booguiteinden uitrekenen
     en dan is elk afrondingsverschil een zichtbare spleet of overlap. Eén
     cirkel per segment met een dasharray heeft dat probleem niet. */

  function donut(opts) {
    zorgStijl();
    var o = opt(opts);
    var titel = str(o.titel) || 'Verdeling';
    var maat = Math.max(60, num(o.maat, 200));
    var dikte = Math.max(4, num(o.dikte, Math.round(maat * 22 / 200)));
    var r = (maat - dikte) / 2;
    /* Dezelfde vangnetregel als in ring(). Een dikte die groter is dan de
       maat (donut({maat:60, dikte:200})) geeft een negatieve straal, en dan
       staat er letterlijk <circle r="-70"> in de DOM: een foutwaarde, een
       negatieve omtrek en daarmee een negatieve dasharray. Afspraak 3 in het
       kopblok belooft een lege maar GELDIGE SVG voor elke onzinwaarde, voor
       elke functie — dus ook hier. Een kwart van de maat is dezelfde
       terugval die ring gebruikt en houdt de ring zichtbaar. */
    if (r <= 0) r = maat / 4;
    var c = maat / 2;
    var omtrek = 2 * Math.PI * r;
    var gat = klem(num(o.tussenruimte, 2), 0, omtrek / 8);

    var segmenten = [], i, totaal = 0;
    var ruw = arr(o.segmenten);
    for (i = 0; i < ruw.length; i++) {
      var seg = opt(ruw[i]);
      var w = num(seg.waarde, 0);
      if (w < 0) w = 0;
      segmenten.push({ label: str(seg.label), waarde: w, kleur: kleur(seg.kleur || catKleur(i)) });
      totaal += w;
    }

    var wrap = el('div', { 'class': 'cpch cpch-donut' });
    var s = svg('svg', { viewBox: '0 0 ' + nr(maat) + ' ' + nr(maat), width: maat, height: maat });

    /* spoor: altijd aanwezig, ook als alles nul is (spec: "alle waarden nul
       geeft een egaal spoor plus de tekst in het midden, geen NaN") */
    s.appendChild(svg('circle', { cx: c, cy: c, r: r, fill: 'none', stroke: tok('line-2'), 'stroke-width': dikte }));

    var gevuld = 0;
    for (i = 0; i < segmenten.length; i++) if (segmenten[i].waarde > 0) gevuld++;

    if (totaal > 0 && gevuld === 1) {
      /* precies één segment met alles erin → volle ring zonder gat */
      for (i = 0; i < segmenten.length; i++) {
        if (segmenten[i].waarde <= 0) continue;
        s.appendChild(svg('circle', { cx: c, cy: c, r: r, fill: 'none', stroke: segmenten[i].kleur, 'stroke-width': dikte }));
      }
    } else if (totaal > 0) {
      var begonnen = 0;
      for (i = 0; i < segmenten.length; i++) {
        var deel = segmenten[i].waarde / totaal;
        var lengte = deel * omtrek;
        if (lengte <= 0) continue;
        /* zichtbare lengte minus de tussenruimte; nooit onder nul, anders
           komt er een negatieve dasharray in de DOM */
        var zichtbaar = Math.max(lengte - gat, 0.4);
        s.appendChild(svg('circle', {
          cx: c, cy: c, r: r, fill: 'none',
          stroke: segmenten[i].kleur, 'stroke-width': dikte,
          'stroke-dasharray': nr(zichtbaar) + ' ' + nr(Math.max(omtrek - zichtbaar, 0.01)),
          'stroke-dashoffset': nr(-(begonnen * omtrek + gat / 2)),
          transform: 'rotate(-90 ' + nr(c) + ' ' + nr(c) + ')'
        }));
        begonnen += deel;
      }
    }

    var midden = opt(o.midden);
    var mWaarde = str(midden.waarde);
    /* isGetal en niet "!== undefined": met centen:null (een bedrag dat er nog
       niet is) stond er anders "€ 0" in het hart van de donut — een verzonnen
       getal, precies wat regel 1 van hoofdstuk 7 verbiedt */
    if (!mWaarde && isGetal(midden.centen)) mWaarde = bedrag(midden.centen, { euro: true });
    if (mWaarde) {
      s.appendChild(svg('text', {
        x: c, y: c - (midden.label ? Math.round(maat * 0.055) : 0),
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': num(midden.maat, 40), 'font-weight': 500, fill: tok('ink'),
        'class': 'cpch-num', text: mWaarde
      }));
    }
    if (midden.label) {
      s.appendChild(svg('text', {
        x: c, y: c + (mWaarde ? Math.round(maat * 0.13) : 0),
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': 13, fill: tok('ink-2'), text: str(midden.label)
      }));
    }

    var procenten = procentVerdeling(segmenten.map(function (x) { return x.waarde; }));
    var zinnen = [];
    for (i = 0; i < segmenten.length; i++) {
      zinnen.push(segmenten[i].label + ' ' +
        (o.centen ? euroWoord(segmenten[i].waarde) : getal(segmenten[i].waarde, num(o.decimalen, 0))) +
        ', ' + getal(procenten[i], 0) + ' procent');
    }
    toegankelijk(s, str(o.beschrijving) || (titel + ': ' + (zinnen.length ? zinnen.join('; ') : 'geen gegevens')), titel);
    wrap.appendChild(s);

    if (o.legenda !== false && segmenten.length) {
      var ul = el('ul', { 'class': 'cpch-dlegenda' });
      for (i = 0; i < segmenten.length; i++) {
        var bol = el('span', { 'class': 'cpch-bol', 'aria-hidden': 'true' });
        bol.style.background = segmenten[i].kleur;
        var rechts = (o.legenda === 'waarde')
          ? (o.centen ? bedrag(segmenten[i].waarde, { euro: true }) : getal(segmenten[i].waarde, num(o.decimalen, 0)))
          : getal(procenten[i], 0) + '%';
        ul.appendChild(el('li', { 'class': 'cpch-dlegenda-item' }, [
          bol,
          el('span', { text: segmenten[i].label }),
          el('span', { 'class': 'cpch-w cpch-num', text: rechts })
        ]));
      }
      wrap.appendChild(ul);
    }
    return wrap;
  }

  /* ============================================================
     15. miniCalendar(opts) — spec 4.6
     ============================================================
     opts: {maand (1-12), jaar, vandaag, gekozen, gebeurtenissen:[{iso,toon}],
            onKies, onMaand}
     Maandag als eerste dag. Volledig toetsenbordbedienbaar: roving tabindex,
     pijltjes ook over week- en maandgrenzen, Home/End naar begin en eind van
     de week, PageUp/PageDown naar de vorige en volgende maand, Enter en
     spatie kiezen.

     De component houdt ZIJN EIGEN kijkvenster bij (welke maand er staat en
     welke dag de focus heeft). Dat is geen appstate: het is de stand van dit
     ene widget, en zonder die stand kan een kalender geen pijltjesnavigatie
     hebben. Welke dag GEKOZEN is gaat via onKies terug naar de aanroeper. */

  var DAGNAMEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
  var DAGKORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
  var MAANDNAMEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

  /* Date.UTC() heeft één valstrik die je nergens ziet aankomen: een jaartal
     van 0 tot en met 99 wordt stilletjes 1900 + dat getal. Een kalender die
     op jaar 50 gezet wordt, toont dan het raster van 1950 met "50" in de kop.
     Elk jaartal dat dit onderdeel binnenkomt gaat daarom eerst hierdoorheen. */
  function veiligJaar(j, terugval) {
    return klem(Math.round(num(j, terugval)), 100, 9999);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + String(n); }
  function pad4(n) { var s = String(Math.abs(n)); while (s.length < 4) s = '0' + s; return (n < 0 ? '-' : '') + s; }
  function isoVan(jaar, maand, dag) { return pad4(jaar) + '-' + pad2(maand) + '-' + pad2(dag); }

  /* schrikkeljaren komen hier vanzelf goed: dag 0 van de VOLGENDE maand is
     de laatste dag van deze. Nergens een hardgecodeerde daglengte. */
  function dagenInMaand(jaar, maand) { return new Date(Date.UTC(jaar, maand, 0)).getUTCDate(); }
  function weekdagMa(jaar, maand, dag) { return (new Date(Date.UTC(jaar, maand - 1, dag)).getUTCDay() + 6) % 7; }
  function verschuif(jaar, maand, dag, dagen) {
    var d = new Date(Date.UTC(jaar, maand - 1, dag));
    d.setUTCDate(d.getUTCDate() + num(dagen, 0));
    return { jaar: d.getUTCFullYear(), maand: d.getUTCMonth() + 1, dag: d.getUTCDate() };
  }
  /* alles in UTC gerekend: met lokale tijd kan een dag rond een
     zomertijdovergang 23 of 25 uur duren en springt een pijltje er dan
     overheen of blijft het staan */
  function isoOntleed(waarde) {
    if (waarde instanceof Date) {
      if (!isFinite(waarde.getTime())) return null;
      return { jaar: waarde.getFullYear(), maand: waarde.getMonth() + 1, dag: waarde.getDate() };
    }
    var m = str(waarde).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var maand = Number(m[2]), dag = Number(m[3]);
    if (maand < 1 || maand > 12 || dag < 1 || dag > 31) return null;
    return { jaar: Number(m[1]), maand: maand, dag: dag };
  }

  function miniCalendar(opts) {
    zorgStijl();
    var o = opt(opts);
    var onKies = fn(o.onKies), onMaand = fn(o.onMaand);

    var nu = new Date();
    var vandaag = isoOntleed(o.vandaag) || { jaar: nu.getFullYear(), maand: nu.getMonth() + 1, dag: nu.getDate() };
    var gekozen = isoOntleed(o.gekozen);

    /* gebeurtenissen per dag: de stip krijgt de kleur van het ZWAARSTE item
       van die dag (kritiek > wacht > extern > gereed) */
    var perDag = {}, gi;
    var lijst = arr(o.gebeurtenissen);
    for (gi = 0; gi < lijst.length; gi++) {
      var geb = opt(lijst[gi]);
      var d0 = isoOntleed(geb.iso);
      if (!d0) continue;
      var sleutel = isoVan(d0.jaar, d0.maand, d0.dag);
      var toon = statusSleutel(geb.toon) || 'info';
      var vak = perDag[sleutel];
      if (!vak) { vak = { aantal: 0, zwaarste: null }; perDag[sleutel] = vak; }
      vak.aantal++;
      if (!vak.zwaarste || STATUS_ZWAARTE[toon] > STATUS_ZWAARTE[vak.zwaarste]) vak.zwaarste = toon;
    }

    var toonJaar = veiligJaar(o.jaar, vandaag.jaar);
    var toonMaand = klem(Math.round(num(o.maand, vandaag.maand)), 1, 12);
    /* de dag met tabindex 0: de gekozen dag, anders vandaag, anders de 1e */
    var focusDag = (gekozen && gekozen.jaar === toonJaar && gekozen.maand === toonMaand) ? gekozen.dag
      : ((vandaag.jaar === toonJaar && vandaag.maand === toonMaand) ? vandaag.dag : 1);
    /* KLEMMEN OP DE ECHTE MAANDLENGTE. isoOntleed laat elke dag van 1 t/m 31
       door zonder de maand te kennen, dus gekozen:'2026-02-30' geeft
       focusDag 30 in een februari van 28 dagen. Geen enkele cel krijgt dan
       tabindex="0" en het hele raster is met Tab onbereikbaar — de kalender
       is dan alleen nog met de muis te bedienen, precies wat spec 4.6
       verbiedt. verplaats(), verplaatsMaand() en cpchToonMaand() klemden al;
       alleen deze eerste render deed het niet. */
    focusDag = klem(Math.round(focusDag), 1, dagenInMaand(toonJaar, toonMaand));
    var moetFocus = false;

    var kopId = uid('kal');
    var wrap = el('div', { 'class': 'cpch cpch-kal' });
    var maandTekst = el('div', { 'class': 'cpch-kal-maand', id: kopId });
    var raster = el('div', { role: 'grid', 'aria-labelledby': kopId });

    function verplaats(dagen) {
      var n = verschuif(toonJaar, toonMaand, focusDag, dagen);
      var anderMaand = (n.maand !== toonMaand || n.jaar !== toonJaar);
      toonJaar = n.jaar; toonMaand = n.maand; focusDag = n.dag;
      moetFocus = true;
      teken();
      if (anderMaand && onMaand) onMaand(toonMaand, toonJaar);
    }

    /* vanToetsenbord: ALLEEN de toetsenbordtak vraagt de focus naar het
       raster. PageUp en PageDown horen de focus mee te nemen naar de nieuwe
       maand, maar een MUISKLIK op ‹ of › mag hem niet uit die knop wegtrekken:
       dan springt de focus het raster in en schuift een tweede Enter geen
       maand meer op maar kiest hij een dag. Datzelfde geldt voor Enter ÓP de
       pijlknop — de gebruiker staat daar met opzet. */
    function verplaatsMaand(richting, vanToetsenbord) {
      var m = toonMaand + (richting > 0 ? 1 : -1), j = toonJaar;
      if (m > 12) { m = 1; j++; }
      if (m < 1) { m = 12; j--; }
      /* 31 maart + PageDown mag geen 31 april worden */
      focusDag = Math.min(focusDag, dagenInMaand(j, m));
      toonMaand = m; toonJaar = j;
      if (vanToetsenbord) moetFocus = true;
      teken();
      if (onMaand) onMaand(toonMaand, toonJaar);
    }

    /* teken() bouwt het raster helemaal opnieuw op en sloopt daarmee de knop
       waar de focus op stond. Zonder de vlag viel de focus na Enter terug
       naar <body> en deden de pijltjes daarna niets meer: spec 4.6 brak dus
       na precies één toetsaanslag. Ook een muisklik op een dag verloor zijn
       focus; teken() vangt dat nu zelf op door te kijken of de focus ín het
       raster stond. */
    function kies(dag, vanToetsenbord) {
      focusDag = klem(Math.round(num(dag, 1)), 1, dagenInMaand(toonJaar, toonMaand));
      gekozen = { jaar: toonJaar, maand: toonMaand, dag: focusDag };
      if (vanToetsenbord) moetFocus = true;
      teken();
      if (onKies) onKies(isoVan(toonJaar, toonMaand, focusDag), { jaar: toonJaar, maand: toonMaand, dag: focusDag });
    }

    function toets(e, dag) {
      var k = e.key;
      var wd = weekdagMa(toonJaar, toonMaand, dag);
      if (k === 'ArrowLeft') verplaats(-1);
      else if (k === 'ArrowRight') verplaats(1);
      else if (k === 'ArrowUp') verplaats(-7);
      else if (k === 'ArrowDown') verplaats(7);
      else if (k === 'Home') verplaats(-wd);
      else if (k === 'End') verplaats(6 - wd);
      else if (k === 'PageUp') verplaatsMaand(-1, true);
      else if (k === 'PageDown') verplaatsMaand(1, true);
      else if (k === 'Enter' || k === ' ' || k === 'Spacebar') kies(dag, true);
      else return;
      e.preventDefault();
      e.stopPropagation();
    }

    function dagCel(dagNr) {
      var iso = isoVan(toonJaar, toonMaand, dagNr);
      var isVandaag = (vandaag.jaar === toonJaar && vandaag.maand === toonMaand && vandaag.dag === dagNr);
      var isGekozen = !!gekozen && gekozen.jaar === toonJaar && gekozen.maand === toonMaand && gekozen.dag === dagNr;
      var info = perDag[iso] || null;

      var label = DAGNAMEN[weekdagMa(toonJaar, toonMaand, dagNr)] + ' ' + dagNr + ' ' +
        MAANDNAMEN[toonMaand - 1] + ' ' + toonJaar;
      if (isVandaag) label += ', vandaag';
      if (info) {
        label += ', ' + info.aantal + (info.aantal === 1 ? ' gebeurtenis' : ' gebeurtenissen');
        /* hoofdstuk 8: kleur is nooit de enige drager — de zwaarte staat ook
           als woord in het label */
        if (info.zwaarste) label += ', zwaarste: ' + STATUS_WOORD[info.zwaarste];
      }

      /* De aria-attributen blijven staan (die vertellen het verhaal aan
         hulpsoftware), maar het UITERLIJK hangt aan een eigen klasse. Een
         selector als .cpch-dag[aria-current="date"] .cpch-cijfer is 0,3,0 en
         daar wint geen enkele gewone regel in admin-ui.css van; met een
         klasse is het 0,1,0 en klopt de belofte in het kopblok. */
      var cijferKlasse = 'cpch-cijfer cpch-num' +
        (isVandaag ? ' cpch-cijfer-vandaag' : '') +
        (isGekozen ? ' cpch-cijfer-gekozen' : '');

      var knop = el('button', {
        type: 'button', 'class': 'cpch-knop cpch-dag', role: 'gridcell',
        tabindex: (dagNr === focusDag) ? '0' : '-1',
        'aria-label': label,
        'aria-selected': isGekozen ? 'true' : 'false',
        'aria-current': isVandaag ? 'date' : null,
        onclick: function () { kies(dagNr); },
        onkeydown: function (e) { toets(e, dagNr); }
      }, [el('span', { 'class': cijferKlasse, text: String(dagNr) })]);

      if (info && info.zwaarste) {
        var stip = el('span', { 'class': 'cpch-dagstip', 'aria-hidden': 'true' });
        stip.style.background = tok(info.zwaarste);
        knop.appendChild(stip);
      }
      return knop;
    }

    function teken() {
      /* STOND DE FOCUS IN HET RASTER? Dat moet vóór leeg(raster), want daarna
         is het element waar de focus op stond weg en is de vraag niet meer te
         beantwoorden. Stond hij erin, dan hoort hij er ook weer in te landen:
         zo overleeft de focus een Enter (kies), een muisklik op een dag en een
         maandsprong met PageUp/PageDown. Stond hij er NIET in — bijvoorbeeld
         op de knop ‹ of › — dan blijft hij waar hij was en kaapt het opnieuw
         tekenen niets. */
      var hadFocus = false;
      try {
        var actiefNu = (typeof document !== 'undefined') ? document.activeElement : null;
        hadFocus = !!(actiefNu && raster.contains && raster.contains(actiefNu));
      } catch (e) { hadFocus = false; }

      maandTekst.textContent = MAANDNAMEN[toonMaand - 1] + ' ' + toonJaar;
      raster.setAttribute('aria-label', 'Kalender ' + MAANDNAMEN[toonMaand - 1] + ' ' + toonJaar);
      leeg(raster);

      var kop = el('div', { 'class': 'cpch-rij', role: 'row' }), w;
      for (w = 0; w < 7; w++) {
        kop.appendChild(el('div', { 'class': 'cpch-wd', role: 'columnheader', 'aria-label': DAGNAMEN[w], text: DAGKORT[w] }));
      }
      raster.appendChild(kop);

      var totaal = dagenInMaand(toonJaar, toonMaand);
      var eerste = weekdagMa(toonJaar, toonMaand, 1);
      var vorigeLengte = dagenInMaand(toonMaand === 1 ? toonJaar - 1 : toonJaar, toonMaand === 1 ? 12 : toonMaand - 1);
      var cellen = Math.ceil((eerste + totaal) / 7) * 7;
      var rij = null, i;

      for (i = 0; i < cellen; i++) {
        if (i % 7 === 0) { rij = el('div', { 'class': 'cpch-rij', role: 'row' }); raster.appendChild(rij); }
        var dagNr = i - eerste + 1;
        if (dagNr < 1 || dagNr > totaal) {
          /* dagen buiten de maand: zichtbaar in --ink-4, maar niet focusbaar
             en niet klikbaar. Wie er met een pijltje heen navigeert schuift
             het hele kijkvenster naar die maand op — dan staat de dag als
             gewone dag in beeld en is er nooit twijfel over welke maand je
             bewerkt. */
          var vulNr = (dagNr < 1) ? (vorigeLengte + dagNr) : (dagNr - totaal);
          rij.appendChild(el('div', { 'class': 'cpch-dag-uit cpch-num', role: 'gridcell', 'aria-disabled': 'true', text: String(vulNr) }));
          continue;
        }
        rij.appendChild(dagCel(dagNr));
      }

      if (moetFocus || hadFocus) {
        moetFocus = false;
        var actief = raster.querySelector ? raster.querySelector('.cpch-dag[tabindex="0"]') : null;
        if (actief && actief.focus) actief.focus();
      }
    }

    /* dezelfde pijl, een halve slag gedraaid — geen tweede icoon nodig */
    var vorige = el('button', {
      type: 'button', 'class': 'cpch-knop cpch-rond', 'aria-label': 'Vorige maand',
      onclick: function () { verplaatsMaand(-1); }
    }, [icoonSvg('pijl', { maat: 15, draai: 180 })]);
    var volgende = el('button', {
      type: 'button', 'class': 'cpch-knop cpch-rond', 'aria-label': 'Volgende maand',
      onclick: function () { verplaatsMaand(1); }
    }, [icoonSvg('pijl', { maat: 15 })]);

    wrap.appendChild(el('div', { 'class': 'cpch-kal-kop' }, [
      maandTekst,
      el('div', { 'class': 'cpch-kal-nav' }, [vorige, volgende])
    ]));
    wrap.appendChild(raster);
    teken();

    /* kleine bedieningsvorm voor de aanroeper: van buitenaf een maand zetten
       zonder de hele kalender opnieuw te bouwen */
    wrap.cpchToonMaand = function (maand, jaar) {
      toonMaand = klem(Math.round(num(maand, toonMaand)), 1, 12);
      toonJaar = veiligJaar(jaar, toonJaar);
      /* ook hier de ondergrens 1: Math.min alleen zou een focusDag van 0 of
         lager (nooit een geldige cel) laten staan en dan is er weer geen
         tabstop */
      focusDag = klem(Math.round(focusDag), 1, dagenInMaand(toonJaar, toonMaand));
      teken();
    };
    return wrap;
  }

  /* ============================================================
     16. stagePath(opts) — spec 4.11, het karakteristiekste element
     ============================================================
     opts: {fases:[{sleutel,label,kort,status,onder:[regels],nadruk,icoon}],
            actiefIndex, breedte, hoogte, onKies, titel, beschrijving}
     label is de VOLLEDIGE fasenaam, kort het korte label dat op het scherm
     komt; zie naamPaar() hieronder, met de gemeten ruimte erbij.

     Drie dingen maken dit element wat het is:

     1. DE CURVE WORDT GESPLITST, NIET OVERLAPT. Het afgelegde deel is inkt,
        de rest is lijnkleur. Twee krommen over elkaar leggen geeft op de
        overgang een naad van een halve lijndikte die je bij elke zoomstand
        anders ziet. Daarom worden de Bezier-segmenten ÉÉN keer berekend en
        daarna in twee paden verdeeld op een puntgrens: exact dezelfde
        kromming links en rechts van de knip, dus geen naad.

     2. DE LABELS STAAN ALS HTML ONDER DE CURVE. Beter leesbaar, selecteerbaar
        en op elke breedte precies 14px in plaats van meegeschaalde SVG-tekst.
        De fasepunten liggen op x = (i+0,5) × kolombreedte, waardoor de labels
        een doodgewoon raster van n gelijke kolommen zijn en op elke breedte
        vanzelf uitgelijnd blijven.

     3. DE CURVE IS DECORATIE. aria-hidden, en de fasen eronder zijn gewone
        knoppen in leesvolgorde met een volledig toegankelijk label.

     De fasenamen komen van de aanroeper; die geeft de Nederlandse labels uit
     de STAGES-tabel van beheer.html mee, nooit de kale sleutels — dat is de
     bewuste afwijking van de mockup die de spec bij 4.11 vastlegt. */

  /* ------------------------------------------------------------------
     TWEE NAMEN PER STAP EN PER FASE — naamPaar()
     ------------------------------------------------------------------
     Elke stap van stepper() en elke fase van stagePath() mag twee namen
     dragen:

       label   de VOLLEDIGE naam ("Bloksourcing & Engineering Sampling").
               Die gaat altijd naar title en naar het aria-label.
       kort    het KORTE label ("Sourcing"). Dat is wat er op het scherm
               komt te staan. Ontbreekt het, dan staat de volledige naam er.

     DE VAL DIE HIER ONDER LAG. Het aria-label werd opgebouwd uit hetzelfde
     veld dat op het scherm stond. Zodra dat veld kort wordt, is de volledige
     naam ook voor een schermlezer weg — en juist die lezer kan de tooltip
     niet aanwijzen. Daarom lopen de twee namen hier uit elkaar: de ZICHTBARE
     tekst wordt kort, het aria-label en de title houden de volledige naam.
     Wie de knop niet ziet hoort dus MEER dan er staat, nooit minder.

     TWEE SCHRIJFWIJZEN, ÉÉN UITKOMST. Aanroepers van vóór deze ronde zetten
     de korte naam in `label` en de volledige in `volledig` (of in `titel`),
     omdat dit bestand toen geen tweede naam kende. Beide schrijfwijzen worden
     gelezen, zodat geen enkele bestaande aanroep zijn volledige naam
     verliest:
       {label:'Sourcing', volledig:'Bloksourcing & …'}  — de oude weg
       {label:'Bloksourcing & …', kort:'Sourcing'}      — de nieuwe weg
     Beide leveren hetzelfde op. De nieuwe weg heeft de voorkeur: daar staat
     de volledige naam in het veld dat `label` heet, en dat is wat een lezer
     verwacht.

     ------------------------------------------------------------------
     HOE KORT MOET "KORT" ZIJN? — DE METING
     ------------------------------------------------------------------
     Gemeten in de echte pagina (beheer, scherm Projecten, 1536px breed,
     Hanken Grotesk zoals de spec hem laadt), niet geschat:

       STEPPER OP DE PROJECTKAART (spec 4.14, 5.3)
         kaart 792px → tekstkolom (.u-projectcard-body) 378px
         378 / 6 fasen            = 63,0px per kolom
         .cpch-stap heeft 4px padding links en rechts
         netto tekstruimte        = 55,0px
         letterbreedte 13px/500   = 6,585px (gemiddelde kleine letter)
         55,0 / 6,585             = 8,35

       → EEN KORT LABEL VAN TEN HOOGSTE 8 TEKENS PAST ALTIJD.

     Acht is echt de bovengrens, geen ruwe schatting: de breedste achtletter
     die hier langskomt is "Monsters" met 54,55px en houdt 0,45px over.
     Negen tekens is een gok die van de letters afhangt — "Kwaliteit" haalt
     50,0px en past, maar "Productie" is 55,9px en past NET niet. Elf tekens
     ("Prototyping", 67,4px) kapt zichtbaar af tot "Prototyp…", en dat is
     precies de brij die dit veld moest oplossen.

       FASEPAD OP HET PROJECTDETAIL (spec 4.11)
         kolom 124,3px, .cpch-fase heeft 6px padding → netto 112px
         letterbreedte 14px/500   = 7,09px
         112 / 7,09               = 15,8, en het label mag twee regels hoog

       → HIER PAST ONGEVEER 15 TEKENS PER REGEL, DUS ±30 IN TOTAAL.

     Het fasepad heeft dus ruimte zat en mag de volledige naam tonen zolang
     die onder de dertig tekens blijft; alleen de langste fasenamen hebben
     daar een `kort` nodig. De stepper heeft hem altijd nodig.

     EN ALS ACHT TEKENS TE WEINIG IS? Dan is het geen fout in dit bestand
     maar een ontwerpprobleem van de kaart: zes kolommen van 63px zijn te
     smal voor een leesbaar Nederlands zelfstandig naamwoord, en dan moet de
     projectkaart de stepper meer breedte geven (bijvoorbeeld door de
     stepperrij over de volle kaartbreedte te laten lopen in plaats van
     alleen over de tekstkolom: 792 - 40 padding = 752 / 6 = 125px per
     kolom, en dan past hetzelfde als in het fasepad). Dit bestand kan die
     keuze niet maken — het tekent wat het meekrijgt in de ruimte die het
     krijgt. */

  function naamPaar(bron) {
    var b = opt(bron);
    /* de volledige naam: expliciet meegegeven wint, anders is `label` hem,
       en als laatste redmiddel de sleutel — een lege kop is nooit goed */
    var vol = str(b.volledig) || str(b.titel) || str(b.label) || str(b.sleutel);
    /* de zichtbare naam: `kort` wint, anders `label`, anders de volledige */
    var kort = str(b.kort) || str(b.label) || vol;
    return { vol: vol, kort: kort };
  }

  function stagePath(opts) {
    zorgStijl();
    var o = opt(opts);
    var onKies = fn(o.onKies);
    var fases = [], i;
    var ruw = arr(o.fases);
    for (i = 0; i < ruw.length; i++) {
      var f = opt(ruw[i]);
      var naam = naamPaar(f);
      fases.push({
        sleutel: str(f.sleutel),
        /* label = de ZICHTBARE naam (kort als die er is), volledig = de naam
           die title en aria-label dragen. Zie naamPaar hierboven. */
        label: naam.kort,
        volledig: naam.vol,
        status: str(f.status),
        nadruk: str(f.nadruk),
        onder: arr(f.onder),
        icoon: str(f.icoon)
      });
    }
    /* span en geen div: het fasepad is hetzelfde soort blok als de stepper en
       kan net zo goed in een klikbare kaart belanden — zie de toelichting bij
       .cpch in het stijlblok. */
    var wrap = el('span', { 'class': 'cpch cpch-stage' });
    var titel = str(o.titel) || 'Fasepad';
    if (!fases.length) { wrap.appendChild(leegVlak(o, num(o.breedte, 900), num(o.hoogte, 130), titel)); return wrap; }

    var n = fases.length;
    var B = num(o.breedte, 900);
    var H = num(o.hoogte, 130);
    var actief = klem(Math.round(num(o.actiefIndex, -1)), -1, n - 1);
    var kolom = B / n;
    var mid = H / 2;
    var amp = klem(num(o.amplitude, H * 0.20), 0, Math.max(0, H / 2 - 24));

    /* de golf: één volledige sinusperiode over de hele breedte. Bij zes
       fasen geeft dat de vorm uit de mockup — omhoog, over de top, omlaag,
       door het dal en terug naar het midden. */
    var punten = [];
    for (i = 0; i < n; i++) {
      var faseHoek = (n > 1) ? (i / (n - 1)) * Math.PI * 2 : 0;
      punten.push({ x: kolom * (i + 0.5), y: mid - amp * Math.sin(faseHoek) });
    }
    var kromme = krommeSegmenten(punten, { spanning: num(o.spanning, 0.5) });

    var s = svg('svg', { viewBox: '0 0 ' + nr(B) + ' ' + nr(H), 'class': 'cpch-svg', width: '100%' });
    decoratief(s);

    /* de gloed achter de actieve fase (spec 4.11: radial-gradient in
       --ok-soft, 64px). Eén verloop, hergebruikt. */
    var gid = uid('gl');
    s.appendChild(svg('defs', null, [
      svg('radialGradient', { id: gid }, [
        svg('stop', { offset: '0', 'stop-color': tok('ok-soft'), 'stop-opacity': '1' }),
        svg('stop', { offset: '1', 'stop-color': tok('ok-soft'), 'stop-opacity': '0' })
      ])
    ]));

    /* eerst het hele pad in lijnkleur, daarna het afgelegde deel in inkt —
       beide uit dezelfde segmentenlijst, dus geen naad en geen vormverschil */
    s.appendChild(svg('path', {
      d: padUitSegmenten(kromme, 0, kromme.segmenten.length),
      fill: 'none', stroke: tok('line'), 'stroke-width': num(o.dikte, 1.5),
      'stroke-linecap': 'round'
    }));
    if (actief > 0) {
      var afgelegd = svg('path', {
        d: padUitSegmenten(kromme, 0, actief),
        fill: 'none', stroke: tok('ink'), 'stroke-width': num(o.dikte, 1.5),
        'stroke-linecap': 'round',
        'class': o.animeer === false ? null : 'cpch-teken'
      });
      if (o.animeer !== false) {
        /* de intekenlengte hoeft niet exact te zijn: een ruime bovengrens
           (de koordelengte × 1,5 is altijd meer dan de booglengte van een
           geklemde Bezier) laat de streep buiten beeld beginnen en netjes
           binnenlopen. getTotalLength() zou hier layout afdwingen op een
           element dat nog niet in de DOM staat. */
        var ruwLengte = 0;
        for (i = 0; i < actief && i < kromme.punten.length - 1; i++) {
          var dx = kromme.punten[i + 1].x - kromme.punten[i].x;
          var dy = kromme.punten[i + 1].y - kromme.punten[i].y;
          ruwLengte += Math.sqrt(dx * dx + dy * dy) * 1.5;
        }
        afgelegd.setAttribute('stroke-dasharray', nr(ruwLengte) + ' ' + nr(ruwLengte));
        afgelegd.style.setProperty('--cpch-lengte', nr(ruwLengte));
      }
      s.appendChild(afgelegd);
    }

    /* per fase: gloed (alleen actief), een schijfje in kaartkleur zodat de
       curve niet dwars door het icoon loopt, en het icoon zelf 30px */
    for (i = 0; i < n; i++) {
      var p = punten[i];
      var isActief = (i === actief);
      if (isActief) s.appendChild(svg('circle', { cx: p.x, cy: p.y, r: 32, fill: 'url(#' + gid + ')' }));
      s.appendChild(svg('circle', {
        cx: p.x, cy: p.y, r: 21, fill: tok('card'),
        stroke: isActief ? tok('ink') : tok('line'), 'stroke-width': isActief ? 1.5 : 1
      }));
      var im = num(o.icoonMaat, 30);
      var k = im / 24;
      var g = icoonGroep(fases[i].icoon || 'doos', {
        kleur: isActief ? 'ink' : (i < actief ? 'ink-2' : 'ink-4'),
        dikte: 1.6 / k
      });
      g.setAttribute('transform', 'translate(' + nr(p.x - im / 2) + ',' + nr(p.y - im / 2) + ') scale(' + nr(k) + ')');
      s.appendChild(g);
    }
    wrap.appendChild(s);

    /* de fasen als knoppen, in leesvolgorde */
    var rij = el('span', { 'class': 'cpch-kolommen', role: 'list' });
    rij.style.setProperty('--cpch-n', String(n));
    for (i = 0; i < n; i++) rij.appendChild(faseKnop(fases[i], i, n, actief, onKies));
    wrap.appendChild(rij);
    return wrap;
  }

  function faseKnop(f, i, n, actief, onKies) {
    var isActief = (i === actief);
    var kinderen = [el('span', {
      /* de actieve stand als eigen klasse in plaats van
         .cpch-fase[aria-current="step"] .cpch-fase-label (0,3,0): zelfde
         uiterlijk, maar admin-ui.css kan er nu overheen */
      'class': 'cpch-fase-label' + (isActief ? ' cpch-fase-label-actief' : ''),
      text: f.label
    })];
    if (f.status) kinderen.push(el('span', { 'class': 'cpch-fase-regel', text: f.status }));
    if (isActief && f.nadruk) kinderen.push(el('span', { 'class': 'cpch-fase-nadruk cpch-num', text: f.nadruk }));
    var onderRegels = [];
    for (var j = 0; j < f.onder.length; j++) {
      var regel = str(f.onder[j]);
      if (!regel) continue;
      onderRegels.push(regel);
      kinderen.push(el('span', { 'class': 'cpch-fase-regel', text: regel }));
    }

    /* het toegankelijke label draagt alles wat de curve visueel vertelt:
       waar in de rij, welke fase, welke stand — EN de regels eronder.
       Een aria-label VERVANGT de inhoud van het element; alles wat er niet in
       staat bestaat voor een schermlezer domweg niet. De onder-regels stonden
       er wel op het scherm ("levering 12 maart", "3 van 5 monsters goed") maar
       niet in het label, en waren daarmee onzichtbaar voor precies de lezer
       die ze het hardst nodig heeft.

       En daarom staat hier f.volledig en niet f.label: op het scherm mag de
       fase "Sourcing" heten, in dit label heet ze voluit. Zou hier f.label
       staan, dan zou het invoeren van korte labels de volledige fasenaam
       precies wegnemen bij de lezer die hem niet kan aanwijzen. */
    var label = 'Fase ' + (i + 1) + ' van ' + n + ': ' + f.volledig +
      (isActief ? ' — huidige fase' : (i < actief ? ' — afgerond' : ' — nog te doen')) +
      (f.status ? '. ' + f.status : '') +
      (isActief && f.nadruk ? '. ' + f.nadruk : '') +
      (onderRegels.length ? '. ' + onderRegels.join('. ') : '');

    if (onKies) {
      return el('button', {
        type: 'button', 'class': 'cpch-knop cpch-fase',
        'aria-current': isActief ? 'step' : null,
        'aria-label': label,
        /* de volledige naam ook voor de muis: wie het korte label leest en
           twijfelt, wijst het aan */
        title: f.volledig || null,
        onclick: function () { onKies(f.sleutel, i); }
      }, kinderen);
    }
    /* span en geen div: deze fase kan binnen een klikbare kaart staan */
    return el('span', {
      'class': 'cpch-fase', role: 'listitem',
      'aria-current': isActief ? 'step' : null,
      'aria-label': label,
      title: f.volledig || null
    }, kinderen);
  }

  /* ============================================================
     17. stepper(opts) — spec 4.14
     ============================================================
     opts: {stappen:[{label,kort,status,sleutel}], huidigIndex, onKies}
     status: 'gereed' | 'huidig' | 'toekomst'. Ontbreekt hij, dan wordt hij
     afgeleid uit huidigIndex.
     gereed = gevuld vinkje-cirkel 16px in --ok; huidig = open ring 16px met
     2px --ink; toekomstig = stip 6px --ink-4.

     label is de VOLLEDIGE naam en gaat naar title en aria-label; kort is wat
     er op het scherm komt. In de projectkaart is daar 55px voor, oftewel acht
     tekens — de hele meting staat bij naamPaar() hierboven, en wie een `kort`
     verzint moet die meting gelezen hebben. */

  function stapMerk(status) {
    var s = svg('svg', { viewBox: '0 0 18 18', width: 18, height: 18 });
    decoratief(s);
    if (status === 'gereed') {
      s.appendChild(svg('circle', { cx: 9, cy: 9, r: 8, fill: tok('ok') }));
      s.appendChild(svg('path', {
        d: 'M5.4 9.2 L7.9 11.7 L12.6 6.6', fill: 'none', stroke: '#ffffff',
        'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    } else if (status === 'huidig') {
      s.appendChild(svg('circle', { cx: 9, cy: 9, r: 7, fill: tok('card'), stroke: tok('ink'), 'stroke-width': 2 }));
    } else {
      s.appendChild(svg('circle', { cx: 9, cy: 9, r: 3, fill: tok('ink-4') }));
    }
    return s;
  }

  function stepper(opts) {
    zorgStijl();
    var o = opt(opts);
    var onKies = fn(o.onKies);
    var ruw = arr(o.stappen);
    /* DRIE KEER span EN GEEN div (hoofdstuk 8 vóór een pixel).
       De stepper zit in de projectkaart, en die kaart is één grote <button>.
       Het inhoudsmodel van een knop is frasering-inhoud: een div daarbinnen
       is ongeldige HTML, en er zijn schermlezers die de inhoud van zo'n knop
       dan overslaan — dan is de hele voortgangsrij er voor die lezer niet.
       Een span mag er wel in staan en ziet er met display uit de CSS exact
       hetzelfde uit. Zie ook .cpch, .cpch-stepper en .cpch-stap-lijn in het
       stijlblok, die daarvoor hun display expliciet opschrijven. */
    var wrap = el('span', { 'class': 'cpch cpch-stepper' });
    if (!ruw.length) return wrap;

    var n = ruw.length;
    var huidig = Math.round(num(o.huidigIndex, -1));
    var lijn = el('span', { 'class': 'cpch-stap-lijn', 'aria-hidden': 'true' });
    var rij = el('span', { 'class': 'cpch-kolommen', role: 'list' });
    rij.style.setProperty('--cpch-n', String(n));
    lijn.style.setProperty('--cpch-n', String(n));

    var woorden = { gereed: 'afgerond', huidig: 'huidige stap', toekomst: 'nog te doen' };
    for (var i = 0; i < n; i++) {
      var st = opt(ruw[i]);
      var status = str(st.status);
      if (status !== 'gereed' && status !== 'huidig' && status !== 'toekomst') {
        status = (huidig < 0) ? 'toekomst' : (i < huidig ? 'gereed' : (i === huidig ? 'huidig' : 'toekomst'));
      }
      /* twee namen: naam.kort staat er, naam.vol wordt voorgelezen en
         aangewezen. Zie naamPaar() met de meting erbij. */
      var naam = naamPaar(st);
      /* hoofdstuk 8: de stand staat ook als woord in het label, niet alleen
         als vorm en kleur. En het is naam.vol en niet naam.kort: het korte
         label is een RUIMTEmaatregel en mag nooit de naam zijn die een
         schermlezer als enige te horen krijgt. */
      var ariaLabel = 'Stap ' + (i + 1) + ' van ' + n + ': ' + naam.vol + ' — ' + woorden[status];
      var kinderen = [stapMerk(status), el('span', {
        /* eigen klasse in plaats van .cpch-stap[aria-current="step"]
           .cpch-stap-label — zie het stijlblok, alles blijft 0,1,0 */
        'class': 'cpch-stap-label' + (status === 'huidig' ? ' cpch-stap-label-actief' : ''),
        text: naam.kort
      })];
      if (onKies) {
        rij.appendChild(el('button', {
          type: 'button', 'class': 'cpch-knop cpch-stap',
          'aria-current': status === 'huidig' ? 'step' : null,
          'aria-label': ariaLabel,
          title: naam.vol || null,
          onclick: (function (sleutel, idx) { return function () { onKies(sleutel, idx); }; })(str(st.sleutel), i)
        }, kinderen));
      } else {
        /* span: deze stap staat in de projectkaart binnen een <button> */
        rij.appendChild(el('span', {
          'class': 'cpch-stap', role: 'listitem',
          'aria-current': status === 'huidig' ? 'step' : null,
          'aria-label': ariaLabel,
          title: naam.vol || null
        }, kinderen));
      }
    }
    wrap.appendChild(lijn);
    wrap.appendChild(rij);
    return wrap;
  }

  /* ============================================================
     18. ratingDots(opts) — spec 4.15
     ============================================================
     opts: {label, waarde, max, toon, maat, beschrijving} */

  function ratingDots(opts) {
    zorgStijl();
    var o = opt(opts);
    /* BOVENGRENS. Zonder klem bouwt ratingDots({max:1e9}) een miljard spans
       en staat de browser stil op een getal dat nooit een beoordelingsschaal
       kan zijn — één verkeerd doorgegeven veld en het scherm is weg. Spec
       4.15 vraagt vijf stippen; twintig is nog te tellen zonder ze te lezen
       en ruim genoeg voor elke schaal die hier ooit langskomt. Wat getekend
       wordt is ook wat het aria-label meldt: de geklemde stand, niet een
       getal dat nergens staat. */
    var max = klem(Math.round(num(o.max, 5)), 0, 20);
    var waarde = klem(Math.round(num(o.waarde, 0)), 0, max);
    var maat = klem(num(o.maat, 8), 2, 64);
    var vol = kleur(o.toon || 'ink');
    var leegKleur = tok('line');

    /* span en geen div, net als bij de stepper: een beoordelingsrij hoort bij
       een fabriek of een product en die rijen zijn op meer dan één scherm een
       knop. Het uiterlijk zit in .cpch-rating (flex) en
       .cpch-rating-stippen (flex), dus er verandert niets zichtbaars. */
    var stippen = el('span', { 'class': 'cpch-rating-stippen', role: 'img' });
    stippen.setAttribute('aria-label', str(o.beschrijving) ||
      ((str(o.label) ? str(o.label) + ': ' : '') + getal(waarde, 0) + ' van ' + getal(max, 0)));
    for (var i = 0; i < max; i++) {
      var stip = el('span', { 'class': 'cpch-rating-stip' });
      stip.style.width = maat + 'px';
      stip.style.height = maat + 'px';
      stip.style.background = (i < waarde) ? vol : leegKleur;
      stippen.appendChild(stip);
    }
    var wrap = el('span', { 'class': 'cpch cpch-rating' });
    if (o.label) wrap.appendChild(el('span', { 'class': 'cpch-rating-label', text: str(o.label) }));
    wrap.appendChild(stippen);
    return wrap;
  }

  /* ============================================================
     19. leafOrnament(opts) — spec 4.20
     ============================================================
     opts: {hoek:'linksboven'|'rechtsboven'|'rechtsonder'|'linksonder',
            variant:0..2, maat, dekking}
     Zelfgetekende takjes in --line op ~35% dekking, aria-hidden, en onder
     900px verborgen (dat laatste zit in het stijlblok).
     Drie takgeometrieën, en de hoek spiegelt de tak: rechtsboven is niet
     dezelfde tak nog een keer, want twee identieke ornamenten op één kaart
     vallen meteen op. */

  var TAKKEN = [
    { stam: 'M4 4 C 30 16, 52 36, 66 70', blad: [[12, 12, -40], [22, 21, -32], [32, 31, -24], [43, 44, -14], [19, 27, 46], [30, 39, 54]] },
    { stam: 'M6 2 C 14 28, 34 48, 72 60', blad: [[12, 14, -8], [21, 25, -4], [33, 37, 4], [47, 47, 14], [26, 16, -56], [40, 27, -48]] },
    { stam: 'M2 12 C 28 10, 50 26, 70 58', blad: [[14, 10, -18], [26, 14, -8], [38, 22, 6], [52, 36, 20], [24, 24, 62], [36, 33, 70]] }
  ];
  var BLAD_PAD = 'M0,0 C4,-5 12,-6 18,0 C12,6 4,5 0,0 Z';
  var HOEK_KLASSE = { linksboven: 'cpch-blad-lb', rechtsboven: 'cpch-blad-rb', rechtsonder: 'cpch-blad-ro', linksonder: 'cpch-blad-lo' };
  var HOEK_SPIEGEL = { linksboven: [1, 1], rechtsboven: [-1, 1], rechtsonder: [-1, -1], linksonder: [1, -1] };
  var HOEK_VARIANT = { linksboven: 0, rechtsboven: 1, rechtsonder: 2, linksonder: 0 };

  function leafOrnament(opts) {
    zorgStijl();
    var o = opt(opts);
    var hoek = HOEK_KLASSE[str(o.hoek)] ? str(o.hoek) : 'rechtsboven';
    var maat = num(o.maat, 160);
    var variant = Math.abs(Math.round(num(o.variant, HOEK_VARIANT[hoek]))) % TAKKEN.length;
    var tak = TAKKEN[variant];
    var sp = HOEK_SPIEGEL[hoek];

    var s = svg('svg', {
      viewBox: '0 0 80 80', width: maat, height: maat,
      'class': 'cpch-blad ' + HOEK_KLASSE[hoek]
    });
    decoratief(s);
    if (o.dekking !== undefined) s.style.opacity = String(klem(num(o.dekking, 0.35), 0, 1));

    /* spiegelen om het midden van de viewBox, zodat de tak altijd vanuit de
       hoek naar binnen groeit */
    var g = svg('g', { transform: 'translate(40,40) scale(' + sp[0] + ',' + sp[1] + ') translate(-40,-40)' });
    g.appendChild(svg('path', { d: tak.stam, fill: 'none', stroke: tok('line'), 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
    for (var i = 0; i < tak.blad.length; i++) {
      var b = tak.blad[i];
      g.appendChild(svg('path', {
        d: BLAD_PAD, fill: tok('line'), stroke: 'none',
        transform: 'translate(' + nr(b[0]) + ',' + nr(b[1]) + ') rotate(' + nr(b[2]) + ') scale(0.8)'
      }));
    }
    s.appendChild(g);
    return s;
  }

  /* ============================================================
     20. mapCard(opts) — spec 4.17
     ============================================================
     opts: {pins:[{naam,lat,lon}], hoogte, breedte, titel, beschrijving,
            bijschrift, leegtekst}

     Zelfgetekende achtergrond, geen tegelserver, geen externe bron — de CSP
     van dit project laat dat niet toe en een kaart-API is hier overbodig:
     de pins staan op stadsniveau en de achtergrond is expliciet schematisch.

     TWEE COÖRDINAATRUIMTEN, EN NOOIT DOOR ELKAAR
     Een pin mag lat/lon meekrijgen; die worden equirectangulair geprojecteerd
     (x = lon × cos(middenbreedtegraad), y = -lat) zodat de verhoudingen op
     deze breedtegraad kloppen. Heeft een pin dat niet, dan wordt zijn naam
     opgezocht in CP_CITY_COORDS uit portal/config.js. Die twee door elkaar in
     één omhullende rechthoek stoppen zou de kaart verminken. Daarom kiest
     deze functie één ruimte per aanroep: zodra er ergens een geldige lat/lon
     staat wint lat/lon, anders de stadstabel. Pins die in de gekozen ruimte
     geen plek hebben worden niet getekend maar wél in het aria-label genoemd
     — stil weglaten zou een ontbrekende fabriek onzichtbaar maken.

     DE STADSTABEL WORDT NIET GENORMALISEERD, EN DAT IS HET HELE PUNT
     CP_CITY_COORDS zijn x/y-punten IN de viewBox "0 0 600 520" van de
     China-kaart die portal.html tekent (renderFactoryMap). Het zijn geen
     graden en het is geen willekeurige eenheid: het is een plek op een
     bestaande kaart. Die punten opnieuw uitrekken over een omhullende
     rechthoek maakte de onderlinge afstanden betekenisloos — Dongguan,
     Shenzhen en Guangzhou liggen in die tabel binnen zeven eenheden van
     elkaar en werden zo over de hele tegel uitgesmeerd, op een achtergrond
     die die kaart niet was. Drie fabrieken in dezelfde agglomeratie zagen
     eruit als drie fabrieken door heel China.
     Daarom tekent deze functie in de stadsruimte de ACHTERGROND in dezelfde
     viewBox, met dezelfde omtrek als portal.html, en zet ze de pins op hun
     eigen x/y. De gevraagde breedte/hoogte bepalen dan alleen nog het
     UITSNEDEVENSTER binnen die kaart (dezelfde schaal, dus leesbare labels en
     kloppende afstanden), nooit een oprekking. Normaliseren gebeurt alleen
     nog waar het wél mag: bij echte lat/lon, want dan is er geen bestaande
     kaart om op te leggen. */

  /* Letterlijk de omtrek uit portal.html (CHINA_OUTLINE en CHINA_HAINAN,
     viewBox 0 0 600 520). Bewust gekopieerd en niet uit portal.html gelezen:
     die pagina is een andere applicatie die dit bestand niet laadt, en een
     grafiek mag nooit van een pagina afhangen. Verandert daar de kaart, dan
     moet deze mee — vandaar dat de maat er als KAART_RUIMTE bij staat. */
  var KAART_RUIMTE = { breedte: 600, hoogte: 520 };
  var CHINA_OMTREK = 'M462 28 L508 73 L539 88 L577 95 L546 168 L540 175 L507 187 ' +
    'L483 208 L454 224 L453 195 L426 220 L424 227 L435 237 L457 239 L468 244 ' +
    'L439 269 L440 279 L462 321 L453 336 L462 341 L451 368 L441 393 L426 415 ' +
    'L414 429 L388 441 L370 452 L357 469 L353 455 L336 453 L324 440 L307 436 ' +
    'L280 459 L263 447 L242 420 L252 392 L241 364 L219 353 L187 371 L163 368 ' +
    'L128 361 L92 337 L74 320 L70 300 L46 277 L34 247 L37 215 L49 201 L85 177 ' +
    'L106 137 L133 112 L174 101 L192 139 L231 171 L272 172 L305 184 L338 175 ' +
    'L371 157 L415 149 L444 117 L421 79 L452 45 Z';
  var CHINA_HAINAN = 'M344 480 Q352 472 361 478 Q368 484 361 492 Q351 499 344 491 Q339 486 344 480 Z';

  function mapCard(opts) {
    zorgStijl();
    var o = opt(opts);
    var titel = str(o.titel) || 'Kaart';
    var wrap = el('div', { 'class': 'cpch cpch-map' });

    var g0 = G();
    var steden = (g0 && isObj(g0.CP_CITY_COORDS)) ? g0.CP_CITY_COORDS : {};
    var ruw = arr(o.pins), i;

    /* isGetal en niet isFinite(Number(...)): met lat:null en lon:null is
       Number() nul en nul is een geldige coördinaat — de pin zou dan als
       "graden" tellen en in de Golf van Guinee belanden, en erger: één zo'n
       pin zet de hele kaart in de gradenruimte en verjaagt de stadstabel. */
    var heeftGraden = false;
    for (i = 0; i < ruw.length; i++) {
      var pp = opt(ruw[i]);
      if (isGetal(pp.lat) && isGetal(pp.lon)) { heeftGraden = true; break; }
    }

    /* De ontwerpmaat. Zonder graden is de natuurlijke maat die van de kaart
       zelf, want daar horen de coördinaten bij. De boven- en ondergrens zijn
       er tegen onzin (breedte:1e9 zou miljoenen rasterlijnen tekenen). */
    var B = klem(num(o.breedte, heeftGraden ? 620 : KAART_RUIMTE.breedte), 120, 4000);
    var H = klem(num(o.hoogte, heeftGraden ? 320 : KAART_RUIMTE.hoogte), 100, 4000);

    var somLat = 0, telLat = 0;
    if (heeftGraden) {
      for (i = 0; i < ruw.length; i++) {
        var q = opt(ruw[i]);
        if (isGetal(q.lat) && isGetal(q.lon)) { somLat += Number(q.lat); telLat++; }
      }
    }
    var middenLat = telLat ? somLat / telLat : 0;
    var cosLat = Math.cos(middenLat * Math.PI / 180);
    /* vlak bij de polen wordt cos(lat) nul en zou de kaart tot een streep
       samenvallen; dan liever onvervormd dan gedeeld door bijna nul */
    if (!isFinite(cosLat) || Math.abs(cosLat) < 0.05) cosLat = 1;

    var pins = [], zonder = [];
    for (i = 0; i < ruw.length; i++) {
      var p = opt(ruw[i]);
      var naam = str(p.naam) || str(p.name) || str(p.label);
      if (heeftGraden) {
        if (isGetal(p.lat) && isGetal(p.lon)) {
          pins.push({ naam: naam, u: Number(p.lon) * cosLat, v: -Number(p.lat), toon: p.toon });
        } else zonder.push(naam || 'onbekend');
      } else {
        var stad = steden[naam] || steden[str(p.stad)];
        if (stad && isGetal(stad.x) && isGetal(stad.y)) {
          pins.push({ naam: naam, u: Number(stad.x), v: Number(stad.y), toon: p.toon });
        } else zonder.push(naam || 'onbekend');
      }
    }

    if (!pins.length) { wrap.appendChild(leegVlak(o, B, H, titel)); return wrap; }

    /* de omhullende rechthoek van de pins — in de gradenruimte om op te
       schalen, in de stadsruimte alleen om het venster op te richten */
    var uMin = pins[0].u, uMax = pins[0].u, vMin = pins[0].v, vMax = pins[0].v;
    for (i = 1; i < pins.length; i++) {
      if (pins[i].u < uMin) uMin = pins[i].u;
      if (pins[i].u > uMax) uMax = pins[i].u;
      if (pins[i].v < vMin) vMin = pins[i].v;
      if (pins[i].v > vMax) vMax = pins[i].v;
    }

    var vX, vY, vB, vH;   /* het venster: de viewBox waarin getekend wordt */

    if (heeftGraden) {
      /* GRADENRUIMTE — hier mág genormaliseerd worden: er is geen bestaande
         kaart waar deze punten bij horen, dus de omhullende rechthoek IS de
         enige schaal die er is. */
      var uSpan = uMax - uMin, vSpan = vMax - vMin;
      /* één pin, of alle pins op één lijn: de spanwijdte is dan 0 en delen op
         nul mag nooit. Een kunstmatige spanwijdte zet de pin(nen) in het midden. */
      if (!(uSpan > 0)) { uSpan = 1; uMin -= 0.5; }
      if (!(vSpan > 0)) { vSpan = 1; vMin -= 0.5; }

      var mL = num(o.margeLinks, 54), mR = num(o.margeRechts, 150);
      var mT = num(o.margeBoven, 44), mB = num(o.margeOnder, 44);
      var vlakB = Math.max(10, B - mL - mR), vlakH = Math.max(10, H - mT - mB);
      /* dezelfde schaal in beide richtingen: anders wordt de kaart uitgerekt
         en klopt de onderlinge ligging van de steden niet meer */
      var schaal = Math.min(vlakB / uSpan, vlakH / vSpan);
      var offsetX = mL + (vlakB - uSpan * schaal) / 2;
      var offsetY = mT + (vlakH - vSpan * schaal) / 2;
      for (i = 0; i < pins.length; i++) {
        pins[i].x = offsetX + (pins[i].u - uMin) * schaal;
        pins[i].y = offsetY + (pins[i].v - vMin) * schaal;
      }
      vX = 0; vY = 0; vB = B; vH = H;
    } else {
      /* STADSRUIMTE — de pins staan al op hun plek en blijven daar staan.
         De gevraagde verhouding B:H bepaalt alleen het VENSTER op de kaart:
         breder gevraagd betekent een lagere band van dezelfde kaart, niet
         dezelfde kaart uitgerekt. De schaal blijft dus ongeveer één eenheid
         per pixel, waardoor de labels leesbaar blijven en de afstand
         Shenzhen-Guangzhou een afstand van zeven eenheden blijft. */
      for (i = 0; i < pins.length; i++) { pins[i].x = pins[i].u; pins[i].y = pins[i].v; }

      var verhouding = (H > 0) ? (B / H) : (KAART_RUIMTE.breedte / KAART_RUIMTE.hoogte);
      vB = KAART_RUIMTE.breedte; vH = KAART_RUIMTE.hoogte;
      if (verhouding >= vB / vH) vH = vB / verhouding; else vB = vH * verhouding;

      /* het venster moet alle pins bevatten, met ruimte voor hun labels; past
         het niet, dan groeit het evenredig (uitzoomen mag, uitrekken niet) */
      var randte = 70;
      var groei = Math.max(1,
        ((uMax - uMin) + randte * 2) / vB,
        ((vMax - vMin) + randte * 2) / vH);
      vB = vB * groei; vH = vH * groei;

      /* op het midden van de pins richten en daarna, zolang het venster
         binnen de kaart past, binnen de kaart houden — anders zou een
         hoekgeval de halve tegel met leegte vullen */
      vX = (uMin + uMax) / 2 - vB / 2;
      vY = (vMin + vMax) / 2 - vH / 2;
      vX = (vB <= KAART_RUIMTE.breedte) ? klem(vX, 0, KAART_RUIMTE.breedte - vB) : (KAART_RUIMTE.breedte - vB) / 2;
      vY = (vH <= KAART_RUIMTE.hoogte) ? klem(vY, 0, KAART_RUIMTE.hoogte - vH) : (KAART_RUIMTE.hoogte - vH) / 2;
    }

    var s = svg('svg', {
      viewBox: nr(vX) + ' ' + nr(vY) + ' ' + nr(vB) + ' ' + nr(vH),
      'class': 'cpch-svg', width: '100%'
    });

    /* achtergrond: kaartvlak, een raster van hairlines en het land */
    s.appendChild(svg('rect', { x: vX, y: vY, width: vB, height: vH, rx: 20, fill: tok('card-2') }));
    var kl = uid('mk');
    s.appendChild(svg('defs', null, [
      svg('clipPath', { id: kl }, [svg('rect', { x: vX, y: vY, width: vB, height: vH, rx: 20 })])
    ]));
    var achter = svg('g', { 'clip-path': 'url(#' + kl + ')' });
    var rasterStap = 60, lijnPos;
    for (lijnPos = Math.ceil(vY / rasterStap) * rasterStap; lijnPos < vY + vH; lijnPos += rasterStap) {
      achter.appendChild(svg('line', { x1: vX, y1: lijnPos, x2: vX + vB, y2: lijnPos, stroke: tok('line-2'), 'stroke-width': 1 }));
    }
    for (lijnPos = Math.ceil(vX / rasterStap) * rasterStap; lijnPos < vX + vB; lijnPos += rasterStap) {
      achter.appendChild(svg('line', { x1: lijnPos, y1: vY, x2: lijnPos, y2: vY + vH, stroke: tok('line-2'), 'stroke-width': 1 }));
    }
    if (heeftGraden) {
      /* zonder een bestaande kaart om op te leggen: twee zachte landvormen,
         bewust abstract — dit beweert geen echte kustlijn te zijn */
      var land = svg('g', { transform: 'scale(' + nr(B / 620) + ',' + nr(H / 320) + ')', stroke: 'none', fill: tok('tint-ink') });
      land.appendChild(svg('path', { d: 'M-20,96 C60,52 132,74 196,52 C258,32 300,58 344,96 C388,134 372,188 316,214 C256,242 180,236 118,258 C56,280 4,264 -20,232 Z' }));
      land.appendChild(svg('path', { d: 'M392,232 C424,196 470,182 520,196 C572,210 610,246 640,290 L640,340 L376,340 C368,304 366,262 392,232 Z' }));
      achter.appendChild(land);
    } else {
      /* de echte omtrek, in de eigen viewBox van de stadstabel: hier staan de
         pins op de plek waar ze horen en betekent een afstand weer iets */
      var china = svg('g', { fill: tok('tint-ink'), stroke: tok('line'), 'stroke-width': 1, 'stroke-linejoin': 'round' });
      china.appendChild(svg('path', { d: CHINA_OMTREK }));
      china.appendChild(svg('path', { d: CHINA_HAINAN }));
      achter.appendChild(china);
    }
    s.appendChild(achter);
    s.appendChild(svg('rect', { x: vX + 0.5, y: vY + 0.5, width: Math.max(1, vB - 1), height: Math.max(1, vH - 1), rx: 20, fill: 'none', stroke: tok('line'), 'stroke-width': 1 }));

    /* labels die te dicht op elkaar zitten uit elkaar duwen: Shenzhen,
       Dongguan en Guangzhou liggen in de stadstabel binnen zeven eenheden
       van elkaar en zouden anders over elkaar heen staan */
    var volgorde = pins.slice(0).sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
    var laatsteY = -1e9;
    for (i = 0; i < volgorde.length; i++) {
      volgorde[i].labelY = volgorde[i].y;
      if (volgorde[i].labelY - laatsteY < 15) volgorde[i].labelY = laatsteY + 15;
      laatsteY = volgorde[i].labelY;
    }

    for (i = 0; i < pins.length; i++) {
      var pin = pins[i];
      var pinStatus = statusSleutel(pin.toon);
      var pk = kleur(pinStatus || 'ink');
      /* de druppelvorm: een kop met een punt eronder, hoogte 22 */
      s.appendChild(svg('path', {
        d: 'M' + nr(pin.x) + ',' + nr(pin.y) +
          'c-4.6,-5.6 -7.4,-8.6 -7.4,-12.3 a7.4,7.4 0 1 1 14.8,0 c0,3.7 -2.8,6.7 -7.4,12.3 z',
        fill: pk
      }));
      s.appendChild(svg('circle', { cx: pin.x, cy: pin.y - 12.3, r: 2.8, fill: tok('card') }));
      if (!pin.naam) continue;
      /* Hoofdstuk 8: kleur is nooit de enige drager. De pin kleurt naar
         status, dus staat de status er ook als WOORD bij — voor wie de kaart
         ziet naast de naam, en verderop in het aria-label voor wie hem niet
         ziet. Zonder dat woord is een kritieke fabriek alleen te herkennen
         aan een rode druppel. */
      var pinTekst = pin.naam + (pinStatus ? ' · ' + STATUS_WOORD[pinStatus] : '');
      var naarRechts = (pin.x + 12 + 90) < (vX + vB - 6);
      s.appendChild(svg('text', {
        x: naarRechts ? (pin.x + 12) : (pin.x - 12),
        y: pin.labelY - 10,
        'text-anchor': naarRechts ? 'start' : 'end',
        'dominant-baseline': 'central',
        'font-size': 12.5, 'font-weight': 500, fill: tok('ink-2'), text: pinTekst
      }));
    }

    var namen = [];
    for (i = 0; i < pins.length; i++) {
      if (!pins[i].naam) continue;
      var ns = statusSleutel(pins[i].toon);
      namen.push(pins[i].naam + (ns ? ' (' + STATUS_WOORD[ns] + ')' : ''));
    }
    var label = str(o.beschrijving) || (titel + ': ' +
      (namen.length ? namen.join(', ') : getal(pins.length, 0) + ' locaties') +
      (zonder.length ? '. Zonder coördinaat: ' + zonder.join(', ') : ''));
    toegankelijk(s, label, titel);
    wrap.appendChild(s);
    if (o.bijschrift) wrap.appendChild(el('p', { 'class': 'cpch-map-bij', text: str(o.bijschrift) }));
    return wrap;
  }

  /* ============================================================
     21. EXPORT — deze lijst en het kopblok houden elkaar bij
     ============================================================ */

  return {
    VERSION: VERSION,

    /* bouwhelpers */
    svg: svg,
    el: el,
    leeg: leeg,
    path: path,

    /* getalnotatie — ook naar buiten, omdat elk aria-label en elke legenda
       in het beheer dezelfde Nederlandse notatie moet gebruiken */
    getal: getal,
    bedrag: bedrag,
    euroWoord: euroWoord,

    /* grafieken en primitieven */
    ring: ring,
    sparkline: sparkline,
    areaChart: areaChart,
    barChart: barChart,
    donut: donut,
    miniCalendar: miniCalendar,
    stagePath: stagePath,
    stepper: stepper,
    ratingDots: ratingDots,
    leafOrnament: leafOrnament,
    mapCard: mapCard,
    iconSet: iconSet
  };
});
