/* CUSTOM+ — minimale, zelfgeschreven PDF-schrijver.
   ------------------------------------------------------------------
   GEEN library, geen buildstap, geen netwerk — dezelfde afspraak als
   portal/qr.js en portal/invoice-core.js. Dit bestand schrijft een echte
   PDF 1.4: header, genummerde objecten, cross-reference-tabel en trailer.
   De uitvoer is een Uint8Array; wat de aanroeper daarmee doet (downloaden,
   in IndexedDB bewaren, naar Supabase storage uploaden, als bijlage
   meesturen) is niet de zorg van dit bestand. Dat maakt hem streng
   testbaar: één functie in, bytes uit.

   WAAROM GEEN PRINTDIALOOG
   window.print() geeft geen bestand: het geeft een dialoog waarin de
   gebruiker zelf 'Bewaar als PDF' moet kiezen, met de kop- en voettekst
   van de BROWSER erin en zonder enige garantie over paginering. Een
   factuur is een document dat jaren mee moet en dat je moet kunnen
   e-mailen en archiveren. Dus: echte bytes.

   WAAROM GEEN HUISSTIJLFONTS
   De veertien standaardfonts van PDF (Helvetica, Courier, Times, Symbol,
   ZapfDingbats en varianten) zitten in élke PDF-lezer en hoeven niet te
   worden ingesloten. Hanken Grotesk en JetBrains Mono insluiten zou
   betekenen: het fontbestand in de repo, een TrueType-subsetter schrijven
   (glyf/loca/cmap/hmtx herbouwen) en een licentiecheck per taalgebied.
   Dat kost voor een eenmanszaak meer dan het oplevert. De keuze hier:
     · Helvetica / Helvetica-Bold  voor alle lopende tekst (humanistische
       schreefloze, dezelfde familie-indruk als Hanken Grotesk)
     · Courier / Courier-Bold      voor CODES (factuurnummer, IBAN, BIC,
       btw-nummer, betaalkenmerk) — het enige monospace-standaardfont
     · BEDRAGEN blijven Helvetica: in Helvetica zijn alle cijfers exact
       556/1000 breed, dus tabellarisch. Een kolom bedragen lijnt er
       perfect in uit, en het vel blijft rustiger dan met Courier.
   Dit staat ook in docs/factuurmodule.md, zodat niemand het per ongeluk
   voor een omissie aanziet.

   COORDINATEN
   PDF rekent in punten vanaf LINKSONDER. Dat is voor lay-outcode een
   bron van fouten. De publieke API van dit bestand rekent daarom in
   MILLIMETER vanaf LINKSBOVEN, precies zoals je een vel papier leest;
   de omrekening gebeurt hier, één keer, in mm2pt/flipY.

   COMPRESSIE
   Streams worden ONGECOMPRIMEERD weggeschreven. Deflate zonder library
   zou een eigen zlib betekenen; een factuur van drie pagina's is zo
   ongeveer 30 kB en dat is geen probleem. Een ingesloten JPEG of PNG is
   al gecomprimeerd en gaat er ongewijzigd doorheen.

   Publieke API (globalThis.CP_PDF, en module.exports in Node):
     VERSION, MM_PER_PT, A4
     mm2pt(mm) / pt2mm(pt)
     FONTS                      de sleutels: regular/bold/italic/mono/monoBold
     textWidth(text, font, sizePt)          → mm
     wrapText(text, maxMm, {font,size})     → [regels]
     winAnsiBytes(text)                     → [bytes]
     base64ToBytes(s) / dataUriToBytes(s)
     imageInfo(bytes)           → {kind:'jpeg'|'png', width, height, ...}
     createDoc(opts)            → doc (zie hieronder)

   HET DOCUMENT
     doc.width / doc.height / doc.margin        alles in mm
     doc.addPage()                              nieuwe pagina + kop
     doc.pageCount()
     doc.y                                      vrije lay-outcursor (mm)
     doc.ensure(hoogteMm)                       breekt af als het niet past
     doc.text(str, x, yBaseline, opts)          opts: font,size,color,
                                                align('left'|'right'|'center'),
                                                maxWidth (afkappen met …)
     doc.paragraph(str, x, y, breedte, opts)    → nieuwe y (na de laatste regel)
     doc.line(x1,y1,x2,y2,opts)                 opts: color,width,dash
     doc.rect(x,y,w,h,opts)                     opts: fill,stroke,width,radius
     doc.image(bytes, x, y, w, h)               JPEG of PNG (zie imageInfo)
     doc.svgPath(d, opts)                       SVG-pad → PDF-vectorpad
     doc.setHeader(fn) / doc.setFooter(fn)      fn(doc, paginaNr, totaal)
     doc.build()                                → Uint8Array

   LADEN
     browser : <script src="portal/pdf.js"></script>
     node    : import '../portal/pdf.js'  (CJS, zet zichzelf op globalThis
               én op module.exports — net als invoice-core.js)
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_PDF = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     1. MAAT EN GETAL
     ============================================================ */
  var PT_PER_MM = 72 / 25.4;              /* 1 mm = 2,834645… punt */
  var MM_PER_PT = 25.4 / 72;
  var A4 = { width: 210, height: 297 };

  function mm2pt(mm) { return mm * PT_PER_MM; }
  function pt2mm(pt) { return pt * MM_PER_PT; }

  /* PDF-getallen: hooguit drie decimalen, geen exponentnotatie (die kent
     het formaat niet), en geen "-0" — dat laatste is geldig maar leest als
     een fout in een diff. */
  function num(v) {
    if (!isFinite(v)) v = 0;
    var s = (Math.round(v * 1000) / 1000).toFixed(3);
    s = s.replace(/0+$/, '').replace(/\.$/, '');
    if (s === '-0' || s === '') s = '0';
    return s;
  }

  /* kleur: '#1B6E45' of '#fff' → '0.106 0.431 0.271' */
  function rgbOf(hex) {
    var h = String(hex || '#000').trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) h = '000000';
    var r = parseInt(h.slice(0, 2), 16) / 255;
    var g = parseInt(h.slice(2, 4), 16) / 255;
    var b = parseInt(h.slice(4, 6), 16) / 255;
    return num(r) + ' ' + num(g) + ' ' + num(b);
  }

  /* ============================================================
     2. WINANSI — van JavaScript-tekst naar de bytes die een
        standaardfont begrijpt
     ============================================================
     De veertien standaardfonts worden hier met /WinAnsiEncoding
     gedeclareerd. WinAnsi is Latin-1 met een eigen invulling van 0x80–0x9F
     (euroteken, echte aanhalingstekens, en- en em-streepje). Alles wat er
     niet in past (Chinees, Cyrillisch, emoji) kan een standaardfont
     simpelweg niet tekenen; dat wordt een '?' en dat is eerlijker dan een
     lege plek of een kapotte PDF. */
  var WINANSI_SPECIAL = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F
  };

  function winAnsiBytes(text) {
    var s = String(text == null ? '' : text);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.charCodeAt(i);
      if (cp >= 0x20 && cp <= 0x7E) { out.push(cp); continue; }
      if (cp === 0x0A || cp === 0x0D || cp === 0x09) { out.push(0x20); continue; }
      if (WINANSI_SPECIAL[cp] !== undefined) { out.push(WINANSI_SPECIAL[cp]); continue; }
      if (cp >= 0xA0 && cp <= 0xFF) { out.push(cp); continue; }
      out.push(0x3F);                       /* '?' — niet te tekenen teken */
    }
    return out;
  }

  /* DE SYNTAXSCHRIJVER — niet te verwarren met winAnsiBytes hierboven.
     winAnsiBytes vertaalt TEKST DIE GETEKEND WORDT en maakt daarbij van
     een regeleinde bewust een spatie (een Tj-string kent geen regels).
     De PDF-syntax zelf leeft juist ván regeleindes: 'endobj', 'stream',
     de xref-tabel en 'startxref' moeten elk op hun eigen regel staan.
     Deze functie laat daarom alles staan zoals het is. Twee functies, twee
     taken — ze door elkaar halen levert een bestand op dat er goed uitziet
     en dat geen enkele lezer kan openen. */
  function rawBytes(text) {
    var s = String(text == null ? '' : text);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var cp = s.charCodeAt(i);
      out.push(cp > 255 ? 0x3F : cp);
    }
    return out;
  }

  /* een PDF-tekststring: alles buiten het printbare ASCII-bereik als
     octale escape, zodat de contentstream zelf zuiver ASCII blijft en in
     elke editor leesbaar is */
  function pdfString(text) {
    var bytes = winAnsiBytes(text);
    var out = '(';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b === 0x28 || b === 0x29 || b === 0x5C) out += '\\' + String.fromCharCode(b);
      else if (b >= 0x20 && b <= 0x7E) out += String.fromCharCode(b);
      else out += '\\' + ('00' + b.toString(8)).slice(-3);
    }
    return out + ')';
  }

  /* ============================================================
     3. FONTMETRIEK
     ============================================================
     De breedtes komen uit de Adobe-AFM-bestanden van de standaardfonts,
     in duizendsten van de fontgrootte. ASCII staat als tabel; de
     Latin-1-letters met accent hebben in deze fonts EXACT de breedte van
     hun grondletter (á = a), dus die worden gevouwen in plaats van
     herhaald. De losse tekens (euro, gedachtestreep, aanhalingstekens)
     staan expliciet — die vouwen naar niets. */
  var W_HELV = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
  ];
  var W_HELVB = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
  ];

  /* de hoge helft van WinAnsi: ofwel een verwijzing naar de grondletter
     (index in de ASCII-tabel hierboven), ofwel een vast paar breedtes
     [helvetica, helvetica-bold] */
  var HIGH_FOLD = {};
  (function () {
    function fold(from, to, ch) {
      for (var b = from; b <= to; b++) HIGH_FOLD[b] = ch;
    }
    fold(0xC0, 0xC5, 'A'); fold(0xC8, 0xCB, 'E'); fold(0xCC, 0xCF, 'I');
    fold(0xD2, 0xD6, 'O'); fold(0xD9, 0xDC, 'U');
    fold(0xE0, 0xE5, 'a'); fold(0xE8, 0xEB, 'e'); fold(0xEC, 0xEF, 'i');
    fold(0xF2, 0xF6, 'o'); fold(0xF9, 0xFC, 'u');
    HIGH_FOLD[0xC7] = 'C'; HIGH_FOLD[0xE7] = 'c';
    HIGH_FOLD[0xD1] = 'N'; HIGH_FOLD[0xF1] = 'n';
    HIGH_FOLD[0xDD] = 'Y'; HIGH_FOLD[0xFD] = 'y'; HIGH_FOLD[0xFF] = 'y';
    HIGH_FOLD[0x8A] = 'S'; HIGH_FOLD[0x9A] = 's';
    HIGH_FOLD[0x8E] = 'Z'; HIGH_FOLD[0x9E] = 'z';
    HIGH_FOLD[0x9F] = 'Y';
  })();
  var HIGH_PAIR = {
    0x80: [556, 556], 0x82: [222, 278], 0x83: [556, 556], 0x84: [333, 500],
    0x85: [1000, 1000], 0x86: [556, 556], 0x87: [556, 556], 0x88: [333, 333],
    0x89: [1000, 1000], 0x8B: [333, 333], 0x8C: [1000, 1000],
    0x91: [222, 238], 0x92: [222, 238], 0x93: [333, 500], 0x94: [333, 500],
    0x95: [350, 350], 0x96: [556, 556], 0x97: [1000, 1000], 0x98: [333, 333],
    0x99: [1000, 1000], 0x9B: [333, 333], 0x9C: [944, 944],
    0xA0: [278, 278], 0xA1: [333, 333], 0xA2: [556, 556], 0xA3: [556, 556],
    0xA4: [556, 556], 0xA5: [556, 556], 0xA6: [260, 280], 0xA7: [556, 556],
    0xA8: [333, 333], 0xA9: [737, 737], 0xAA: [370, 370], 0xAB: [556, 556],
    0xAC: [584, 584], 0xAD: [333, 333], 0xAE: [737, 737], 0xAF: [333, 333],
    0xB0: [400, 400], 0xB1: [584, 584], 0xB2: [333, 333], 0xB3: [333, 333],
    0xB4: [333, 333], 0xB5: [556, 611], 0xB6: [537, 556], 0xB7: [278, 278],
    0xB8: [333, 333], 0xB9: [333, 333], 0xBA: [365, 365], 0xBB: [556, 556],
    0xBC: [834, 834], 0xBD: [834, 834], 0xBE: [834, 834], 0xBF: [611, 611],
    0xC6: [1000, 1000], 0xD0: [722, 722], 0xD7: [584, 584], 0xD8: [778, 778],
    0xDE: [667, 667], 0xDF: [500, 611],
    0xE6: [889, 889], 0xF0: [556, 611], 0xF7: [584, 584], 0xF8: [611, 611],
    0xFE: [556, 611]
  };

  /* de vijf fontsleutels van dit bestand */
  var FONTS = {
    regular:  { base: 'Helvetica',      table: W_HELV,  bold: false, mono: false },
    bold:     { base: 'Helvetica-Bold',  table: W_HELVB, bold: true,  mono: false },
    italic:   { base: 'Helvetica-Oblique', table: W_HELV, bold: false, mono: false },
    mono:     { base: 'Courier',         table: null,   bold: false, mono: true },
    monoBold: { base: 'Courier-Bold',    table: null,   bold: true,  mono: true }
  };
  var FONT_KEYS = ['regular', 'bold', 'italic', 'mono', 'monoBold'];

  function fontOf(key) {
    return FONTS[key] || FONTS.regular;
  }

  /* breedte van één WinAnsi-byte, in duizendsten */
  function glyphWidth(byte, f) {
    if (f.mono) return 600;                     /* Courier is per definitie 600 */
    if (byte >= 0x20 && byte <= 0x7E) return f.table[byte - 0x20];
    var ch = HIGH_FOLD[byte];
    if (ch) return f.table[ch.charCodeAt(0) - 0x20];
    var pair = HIGH_PAIR[byte];
    if (pair) return f.bold ? pair[1] : pair[0];
    return 500;                                  /* onbekend: redelijke gok */
  }

  /* breedte van een tekst in MILLIMETER bij een fontgrootte in PUNT */
  function textWidth(text, fontKey, sizePt) {
    var f = fontOf(fontKey);
    var bytes = winAnsiBytes(text);
    var thousandths = 0;
    for (var i = 0; i < bytes.length; i++) thousandths += glyphWidth(bytes[i], f);
    return pt2mm(thousandths * sizePt / 1000);
  }

  /* WOORDWIKKELING
     Breekt op spaties. Een woord dat zelf al breder is dan de kolom (een
     lange productcode, een URL, een Duitse samenstelling) wordt hard
     gebroken op tekens — beter een afgebroken code dan een regel die de
     kolom uit loopt en over het bedrag heen valt. Regelafbreking op \n uit
     de invoer blijft staan.

     DE HARDE BREUK STAAT BEWUST VOOROP EN KIJKT ALLEEN NAAR HET WOORD.
     In de eerste opzet zat hij binnen de "past nog"-tak en eiste hij een
     lege regel. Een te breed woord werd daardoor alleen gebroken als het
     toevallig het eerste van de regel was; stond er al iets voor, dan liep
     de code naar de andere tak (regel afsluiten, woord op de nieuwe regel
     zetten) en werd datzelfde woord nooit meer gebroken. Op een factuur is
     dat een omschrijving die over de bedragenkolom heen valt. De vraag
     "past dit woord überhaupt in de kolom?" hangt niet af van wat er
     toevallig voor staat, dus wordt hij nu ook eerst en los gesteld.

     Wat er al op de regel stond, wordt afgesloten voordat het lange woord
     begint. De rest van de regel volstoppen met het eerste stuk van een
     productcode leest slechter dan de code als één blok. */
  function wrapText(text, maxMm, opts) {
    opts = opts || {};
    var fontKey = opts.font || 'regular';
    var size = opts.size || 10;
    var src = String(text == null ? '' : text);
    var out = [];
    var paras = src.split(/\r\n|\r|\n/);
    for (var p = 0; p < paras.length; p++) {
      var words = paras[p].split(/[ \t]+/).filter(function (w) { return w.length > 0; });
      if (!words.length) { out.push(''); continue; }
      var line = '';
      for (var w = 0; w < words.length; w++) {
        var word = words[w];
        if (textWidth(word, fontKey, size) > maxMm) {
          /* het woord past op zichzelf al niet: ALTIJD hard breken, of er
             nu wel of niet iets op de regel staat */
          if (line) { out.push(line); line = ''; }
          var chunk = '';
          for (var c = 0; c < word.length; c++) {
            /* chunk moet niet-leeg zijn voordat er wordt afgebroken: in een
               kolom die niet eens één teken breed is zou de lus anders
               nooit vorderen */
            if (chunk && textWidth(chunk + word[c], fontKey, size) > maxMm) {
              out.push(chunk);
              chunk = word[c];
            } else {
              chunk += word[c];
            }
          }
          line = chunk;
          continue;
        }
        var probe = line ? line + ' ' + word : word;
        if (textWidth(probe, fontKey, size) <= maxMm) {
          line = probe;
        } else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  /* tekst die op één regel MOET blijven: afkappen met een echte ellips.
     Dezelfde valkuil als in wrapText hierboven, en daarom hier ook
     nagelopen: de lus stopte bij één overgebleven teken, dus in een kolom
     die dat teken plus de ellips niet aankan liep de uitkomst alsnog buiten
     de kolom. Hij mag nu tot nul tekens terug — dan blijft alleen de ellips
     over, en dat is het smalste eerlijke antwoord. Verder komt niemand:
     past de ellips zelf niet, dan is de kolom te smal voor tekst en dat is
     een lay-outkeuze, geen afkapkeuze. */
  function ellipsize(text, maxMm, fontKey, size) {
    var s = String(text == null ? '' : text);
    if (textWidth(s, fontKey, size) <= maxMm) return s;
    var dots = '…';
    var cut = s;
    while (cut.length > 0 && textWidth(cut + dots, fontKey, size) > maxMm) {
      cut = cut.slice(0, -1);
    }
    return cut.replace(/[ ,.;:-]+$/, '') + dots;
  }

  /* ============================================================
     4. BASE64 EN BEELDEN
     ============================================================
     atob() bestaat niet in Node en Buffer niet in de browser, dus dit
     bestand doet het zelf — dan draait dezelfde code in de test én op de
     pagina. */
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64_INV = (function () {
    var m = {};
    for (var i = 0; i < B64.length; i++) m[B64[i]] = i;
    return m;
  })();

  function base64ToBytes(s) {
    var clean = String(s || '').replace(/[^A-Za-z0-9+/=]/g, '');
    var pad = 0;
    while (clean.length && clean[clean.length - 1] === '=') { pad++; clean = clean.slice(0, -1); }
    var out = [];
    var buf = 0, bits = 0;
    for (var i = 0; i < clean.length; i++) {
      var v = B64_INV[clean[i]];
      if (v === undefined) continue;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buf >> bits) & 0xFF);
      }
    }
    return new Uint8Array(out);
  }

  function bytesToBase64(bytes) {
    var out = '';
    var i;
    for (i = 0; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    var rest = bytes.length - i;
    if (rest === 1) {
      var a = bytes[i] << 16;
      out += B64[(a >> 18) & 63] + B64[(a >> 12) & 63] + '==';
    } else if (rest === 2) {
      var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64[(b >> 18) & 63] + B64[(b >> 12) & 63] + B64[(b >> 6) & 63] + '=';
    }
    return out;
  }

  function dataUriToBytes(uri) {
    var s = String(uri || '');
    var comma = s.indexOf(',');
    if (comma < 0) return null;
    var head = s.slice(0, comma);
    if (head.indexOf('base64') < 0) return null;
    return base64ToBytes(s.slice(comma + 1));
  }

  function u16(b, i) { return (b[i] << 8) | b[i + 1]; }
  function u32(b, i) { return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0; }

  /* JPEG: de bytes gaan ONGEWIJZIGD de PDF in als /DCTDecode. Er wordt
     alleen gelezen wat het beeldobject moet weten: afmeting en het aantal
     kleurkanalen. CMYK (4 kanalen) wordt geweigerd — dat vraagt om de
     Adobe-APP14-transform en een omgekeerde /Decode-array, en één fout
     daarin geeft een negatief logo. Liever een nette weigering. */
  function jpegInfo(b) {
    if (b.length < 4 || b[0] !== 0xFF || b[1] !== 0xD8) return null;
    var i = 2;
    while (i + 3 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      var marker = b[i + 1];
      if (marker === 0xFF) { i++; continue; }
      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
      if (marker === 0xD9 || marker === 0xDA) break;
      var len = u16(b, i + 2);
      var isSof = (marker >= 0xC0 && marker <= 0xCF) &&
        marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
      if (isSof) {
        return {
          kind: 'jpeg', bits: b[i + 4],
          height: u16(b, i + 5), width: u16(b, i + 7),
          channels: b[i + 9], bytes: b
        };
      }
      if (len < 2) break;
      i += 2 + len;
    }
    return null;
  }

  /* PNG: de IDAT-bytes zijn al zlib-deflate, en PDF kent /FlateDecode met
     de PNG-predictor. De data mag er dus ONGEWIJZIGD doorheen — er wordt
     geen zlib herschreven. Wat wél wordt geëist: 8 bits per kanaal, niet
     interlaced, en kleurtype 0 (grijs), 2 (RGB) of 3 (palet). Alles met
     transparantie (kleurtype 4 en 6, of een tRNS-blok) wordt geweigerd,
     want zonder de alfa uit te pakken zou een doorzichtig logo als een
     zwart vlak in de factuur belanden. De beheerpagina zet daarom élke
     upload eerst via een canvas om naar JPEG op een witte grond; deze
     PNG-tak is er voor het geval dat de bron al een eenvoudige PNG is. */
  function pngInfo(b) {
    var sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (b.length < 8) return null;
    for (var s = 0; s < 8; s++) if (b[s] !== sig[s]) return null;
    var i = 8, ihdr = null, palette = null, idat = [], total = 0, hasTrns = false;
    while (i + 8 <= b.length) {
      var len = u32(b, i);
      var type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
      var data = i + 8;
      if (data + len > b.length) break;
      if (type === 'IHDR') {
        ihdr = {
          width: u32(b, data), height: u32(b, data + 4),
          bits: b[data + 8], colorType: b[data + 9],
          compression: b[data + 10], filter: b[data + 11], interlace: b[data + 12]
        };
      } else if (type === 'PLTE') {
        palette = b.subarray(data, data + len);
      } else if (type === 'tRNS') {
        hasTrns = true;
      } else if (type === 'IDAT') {
        idat.push(b.subarray(data, data + len));
        total += len;
      } else if (type === 'IEND') {
        break;
      }
      i = data + len + 4;
    }
    if (!ihdr) return null;
    if (ihdr.interlace !== 0) return { kind: 'png', unsupported: 'interlaced' };
    if (ihdr.bits !== 8) return { kind: 'png', unsupported: 'bitdiepte ' + ihdr.bits };
    if (hasTrns) return { kind: 'png', unsupported: 'transparantie (tRNS)' };
    if (ihdr.colorType === 4 || ihdr.colorType === 6) return { kind: 'png', unsupported: 'alfakanaal' };
    if ([0, 2, 3].indexOf(ihdr.colorType) < 0) return { kind: 'png', unsupported: 'kleurtype ' + ihdr.colorType };
    if (ihdr.colorType === 3 && !palette) return { kind: 'png', unsupported: 'palet ontbreekt' };
    var flat = new Uint8Array(total);
    var at = 0;
    for (var k = 0; k < idat.length; k++) { flat.set(idat[k], at); at += idat[k].length; }
    return {
      kind: 'png', width: ihdr.width, height: ihdr.height, bits: 8,
      colorType: ihdr.colorType, palette: palette, data: flat,
      channels: ihdr.colorType === 2 ? 3 : 1
    };
  }

  function imageInfo(bytes) {
    if (!bytes || !bytes.length) return null;
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return jpegInfo(bytes);
    if (bytes[0] === 137 && bytes[1] === 80) return pngInfo(bytes);
    return null;
  }

  /* ============================================================
     5. SVG-PADEN → PDF-VECTORPADEN
     ============================================================
     portal/qr.js levert de betaal-QR al als één samengevoegd SVG-pad
     ("M0 0h7v1h-7z…"). Dat pad wordt hier niet nagetekend maar VERTAALD:
     elk SVG-commando krijgt zijn PDF-tegenhanger (m/l/c/h). Zo blijft er
     één QR-implementatie in dit project en is de code in de PDF exact de
     code op het scherm — een tweede encoder zou vroeg of laat afwijken.
     Ondersteund: M m L l H h V v C c S s Z z. Meer heeft qr.js niet nodig
     en meer verzinnen we hier niet. */
  function parsePath(d) {
    var s = String(d || '');
    var tokens = s.match(/[MmLlHhVvCcSsZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
    var cmds = [];
    var i = 0, cur = '';
    var x = 0, y = 0, startX = 0, startY = 0;
    var lastC = null;
    function n() { return parseFloat(tokens[i++]); }
    while (i < tokens.length) {
      var t = tokens[i];
      if (/^[MmLlHhVvCcSsZz]$/.test(t)) { cur = t; i++; }
      else if (!cur) { i++; continue; }
      switch (cur) {
        case 'M': case 'm': {
          var mx = n(), my = n();
          if (cur === 'm') { x += mx; y += my; } else { x = mx; y = my; }
          startX = x; startY = y;
          cmds.push(['m', x, y]);
          cur = (cur === 'M') ? 'L' : 'l';       /* volgende paren = lineto */
          lastC = null;
          break;
        }
        case 'L': case 'l': {
          var lx = n(), ly = n();
          if (cur === 'l') { x += lx; y += ly; } else { x = lx; y = ly; }
          cmds.push(['l', x, y]);
          lastC = null;
          break;
        }
        case 'H': case 'h': {
          var hx = n();
          x = (cur === 'h') ? x + hx : hx;
          cmds.push(['l', x, y]);
          lastC = null;
          break;
        }
        case 'V': case 'v': {
          var vy = n();
          y = (cur === 'v') ? y + vy : vy;
          cmds.push(['l', x, y]);
          lastC = null;
          break;
        }
        case 'C': case 'c': {
          var c1x = n(), c1y = n(), c2x = n(), c2y = n(), ex = n(), ey = n();
          if (cur === 'c') { c1x += x; c1y += y; c2x += x; c2y += y; ex += x; ey += y; }
          cmds.push(['c', c1x, c1y, c2x, c2y, ex, ey]);
          lastC = [c2x, c2y];
          x = ex; y = ey;
          break;
        }
        case 'S': case 's': {
          var s2x = n(), s2y = n(), sex = n(), sey = n();
          if (cur === 's') { s2x += x; s2y += y; sex += x; sey += y; }
          var r1x = lastC ? (2 * x - lastC[0]) : x;
          var r1y = lastC ? (2 * y - lastC[1]) : y;
          cmds.push(['c', r1x, r1y, s2x, s2y, sex, sey]);
          lastC = [s2x, s2y];
          x = sex; y = sey;
          break;
        }
        case 'Z': case 'z': {
          /* Z heeft geen argumenten; het token is hierboven al opgegeten */
          cmds.push(['h']);
          x = startX; y = startY;
          lastC = null;
          cur = '';
          break;
        }
        default:
          i++;
      }
    }
    return cmds;
  }

  /* ============================================================
     6. HET DOCUMENT
     ============================================================ */
  function createDoc(opts) {
    opts = opts || {};
    var W = opts.width || A4.width;
    var H = opts.height || A4.height;
    var margin = opts.margin || {};
    var doc = {
      version: VERSION,
      width: W,
      height: H,
      margin: {
        top: margin.top === undefined ? 18 : margin.top,
        right: margin.right === undefined ? 16 : margin.right,
        bottom: margin.bottom === undefined ? 20 : margin.bottom,
        left: margin.left === undefined ? 16 : margin.left
      },
      title: opts.title || '',
      subject: opts.subject || '',
      author: opts.author || '',
      /* vaste datum = reproduceerbare bytes. De factuurlaag geeft hier het
         moment van definitief maken mee, zodat tweemaal renderen van
         dezelfde snapshot exact dezelfde PDF geeft. */
      date: opts.date || new Date(),
      y: 0,
      _pages: [],
      _active: -1,
      _images: [],
      _imageKeys: {},
      _usedFonts: {},
      _header: null,
      _footer: null
    };

    function page() {
      if (doc._active < 0) doc.addPage();
      return doc._pages[doc._active];
    }
    function push(op) { page().ops.push(op); }

    doc.contentWidth = function () { return doc.width - doc.margin.left - doc.margin.right; };
    doc.bottomLimit = function () { return doc.height - doc.margin.bottom; };
    doc.pageCount = function () { return doc._pages.length; };

    /* mm vanaf linksboven → punt vanaf linksonder */
    function X(mm) { return mm2pt(mm); }
    function Y(mm) { return mm2pt(doc.height - mm); }

    doc.addPage = function () {
      doc._pages.push({ ops: [] });
      doc._active = doc._pages.length - 1;
      doc.y = doc.margin.top;
      if (typeof doc._header === 'function') doc._header(doc, doc._pages.length);
      return doc;
    };

    doc.setHeader = function (fn) { doc._header = fn; return doc; };
    doc.setFooter = function (fn) { doc._footer = fn; return doc; };

    /* past er nog `h` millimeter onder de cursor? zo niet: nieuwe pagina.
       Geeft true terug als er is afgebroken, zodat de aanroeper zijn
       kolomkoppen kan herhalen. */
    doc.ensure = function (h) {
      if (doc._active < 0) { doc.addPage(); return true; }
      if (doc.y + h <= doc.bottomLimit()) return false;
      doc.addPage();
      return true;
    };

    doc.text = function (str, x, y, o) {
      o = o || {};
      var fontKey = o.font || 'regular';
      var size = o.size || 10;
      var s = String(str == null ? '' : str);
      if (!s) return doc;
      if (o.maxWidth) s = ellipsize(s, o.maxWidth, fontKey, size);
      var w = textWidth(s, fontKey, size);
      var tx = x;
      if (o.align === 'right') tx = x - w;
      else if (o.align === 'center') tx = x - w / 2;
      doc._usedFonts[fontKey] = true;
      var ops = [];
      ops.push('q');
      ops.push(rgbOf(o.color || '#111111') + ' rg');
      ops.push('BT');
      ops.push('/' + fontResName(fontKey) + ' ' + num(size) + ' Tf');
      if (o.charSpace) ops.push(num(o.charSpace) + ' Tc');
      ops.push('1 0 0 1 ' + num(X(tx)) + ' ' + num(Y(y)) + ' Tm');
      ops.push(pdfString(s) + ' Tj');
      ops.push('ET');
      ops.push('Q');
      push(ops.join('\n'));
      /* onderstrepen is met een lijn eerlijker dan met een fonttruc */
      if (o.underline) {
        doc.line(tx, y + pt2mm(size * 0.13), tx + w, y + pt2mm(size * 0.13),
          { color: o.color || '#111111', width: 0.2 });
      }
      return doc;
    };

    /* meerdere regels tekst binnen een kolombreedte.
       y is de BASISLIJN van de eerste regel; de teruggegeven waarde is de
       BASISLIJN DIE DE VOLGENDE REGEL ZOU KRIJGEN. Dat is de enige
       afspraak die stapelen zonder overlap mogelijk maakt: wie
       "y = doc.paragraph(...)" schrijft, zet het volgende blok er precies
       onder — niet er half overheen. */
    doc.paragraph = function (str, x, y, widthMm, o) {
      o = o || {};
      var size = o.size || 10;
      var lead = o.leading || pt2mm(size * 1.35);
      var lines = wrapText(str, widthMm, { font: o.font || 'regular', size: size });
      if (o.maxLines && lines.length > o.maxLines) {
        lines = lines.slice(0, o.maxLines);
        lines[lines.length - 1] = ellipsize(lines[lines.length - 1] + ' …', widthMm, o.font || 'regular', size);
      }
      var cy = y;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i]) doc.text(lines[i], x, cy, o);
        cy += lead;
      }
      return cy;
    };

    doc.line = function (x1, y1, x2, y2, o) {
      o = o || {};
      var ops = ['q', rgbOf(o.color || '#e8e4de') + ' RG', num(o.width || 0.3) + ' w'];
      if (o.dash) ops.push('[' + num(o.dash) + ' ' + num(o.dash) + '] 0 d');
      ops.push(num(X(x1)) + ' ' + num(Y(y1)) + ' m');
      ops.push(num(X(x2)) + ' ' + num(Y(y2)) + ' l');
      ops.push('S', 'Q');
      push(ops.join('\n'));
      return doc;
    };

    doc.rect = function (x, y, w, h, o) {
      o = o || {};
      var ops = ['q'];
      if (o.fill) ops.push(rgbOf(o.fill) + ' rg');
      if (o.stroke) {
        ops.push(rgbOf(o.stroke) + ' RG');
        ops.push(num(o.width || 0.3) + ' w');
      }
      if (o.radius) {
        /* afgeronde hoek met vier bezierbogen — 0.5523 is de klassieke
           kappa waarmee een bezier een kwartcirkel benadert */
        var r = Math.min(o.radius, w / 2, h / 2);
        var k = r * 0.5523;
        var x0 = X(x), x1 = X(x + w), y0 = Y(y + h), y1 = Y(y);
        ops.push(num(x0 + r) + ' ' + num(y1) + ' m');
        ops.push(num(x1 - r) + ' ' + num(y1) + ' l');
        ops.push(num(x1 - r + k) + ' ' + num(y1) + ' ' + num(x1) + ' ' + num(y1 - r + k) + ' ' + num(x1) + ' ' + num(y1 - r) + ' c');
        ops.push(num(x1) + ' ' + num(y0 + r) + ' l');
        ops.push(num(x1) + ' ' + num(y0 + r - k) + ' ' + num(x1 - r + k) + ' ' + num(y0) + ' ' + num(x1 - r) + ' ' + num(y0) + ' c');
        ops.push(num(x0 + r) + ' ' + num(y0) + ' l');
        ops.push(num(x0 + r - k) + ' ' + num(y0) + ' ' + num(x0) + ' ' + num(y0 + r - k) + ' ' + num(x0) + ' ' + num(y0 + r) + ' c');
        ops.push(num(x0) + ' ' + num(y1 - r) + ' l');
        ops.push(num(x0) + ' ' + num(y1 - r + k) + ' ' + num(x0 + r - k) + ' ' + num(y1) + ' ' + num(x0 + r) + ' ' + num(y1) + ' c');
        ops.push('h');
      } else {
        ops.push(num(X(x)) + ' ' + num(Y(y + h)) + ' ' + num(mm2pt(w)) + ' ' + num(mm2pt(h)) + ' re');
      }
      ops.push(o.fill && o.stroke ? 'B' : (o.fill ? 'f' : 'S'));
      ops.push('Q');
      push(ops.join('\n'));
      return doc;
    };

    /* een SVG-pad tekenen. De padcoordinaten zijn "gebruikerseenheden" van
       de SVG; scale zet ze om naar millimeter, x/y is de linkerbovenhoek.
       De y-as van SVG loopt naar beneden, die van PDF naar boven — de
       transformatiematrix keert hem daarom om. */
    doc.svgPath = function (d, o) {
      o = o || {};
      var scale = o.scale || 1;
      var ox = o.x || 0, oy = o.y || 0;
      var cmds = parsePath(d);
      if (!cmds.length) return doc;
      var ops = ['q', rgbOf(o.fill || '#111111') + ' rg'];
      function px(v) { return num(X(ox + v * scale)); }
      function py(v) { return num(Y(oy + v * scale)); }
      for (var i = 0; i < cmds.length; i++) {
        var c = cmds[i];
        if (c[0] === 'm') ops.push(px(c[1]) + ' ' + py(c[2]) + ' m');
        else if (c[0] === 'l') ops.push(px(c[1]) + ' ' + py(c[2]) + ' l');
        else if (c[0] === 'c') ops.push(px(c[1]) + ' ' + py(c[2]) + ' ' + px(c[3]) + ' ' + py(c[4]) + ' ' + px(c[5]) + ' ' + py(c[6]) + ' c');
        else if (c[0] === 'h') ops.push('h');
      }
      ops.push('f', 'Q');
      push(ops.join('\n'));
      return doc;
    };

    /* een beeld plaatsen. bytes = de rauwe JPEG- of PNG-bytes; identieke
       bytes delen één XObject, zodat een logo op vijf pagina's maar één
       keer in het bestand staat. Gooit een Nederlandse fout als het
       formaat niet kan — de aanroeper vangt die en zet er tekst neer. */
    doc.image = function (bytes, x, y, w, h) {
      var info = imageInfo(bytes);
      if (!info) throw new Error('Dit beeldformaat wordt niet herkend — gebruik JPEG of een eenvoudige PNG.');
      if (info.unsupported) throw new Error('Deze PNG kan niet worden ingesloten (' + info.unsupported + '). Sla het logo op als JPEG.');
      if (info.kind === 'jpeg' && info.channels !== 1 && info.channels !== 3) {
        throw new Error('Deze JPEG heeft ' + info.channels + ' kleurkanalen (waarschijnlijk CMYK). Sla het logo op als RGB-JPEG.');
      }
      var key = info.kind + ':' + bytes.length + ':' + bytes[bytes.length - 1] + ':' + bytes[Math.floor(bytes.length / 2)];
      var idx = doc._imageKeys[key];
      if (idx === undefined) {
        idx = doc._images.length;
        doc._images.push({ info: info, bytes: bytes });
        doc._imageKeys[key] = idx;
      }
      push(['q',
        num(mm2pt(w)) + ' 0 0 ' + num(mm2pt(h)) + ' ' + num(X(x)) + ' ' + num(Y(y + h)) + ' cm',
        '/Im' + idx + ' Do', 'Q'].join('\n'));
      return doc;
    };

    /* de natuurlijke verhouding van een beeld, zodat de aanroeper een
       logo op breedte kan schalen zonder het uit te rekken */
    doc.imageBox = function (bytes, maxW, maxH) {
      var info = imageInfo(bytes);
      if (!info || info.unsupported || !info.width || !info.height) return null;
      var ratio = info.height / info.width;
      var w = maxW, h = maxW * ratio;
      if (h > maxH) { h = maxH; w = maxH / ratio; }
      return { width: w, height: h };
    };

    function fontResName(key) {
      return 'F' + (FONT_KEYS.indexOf(key) + 1);
    }

    /* ---------- bouwen ---------- */
    doc.build = function () {
      if (!doc._pages.length) doc.addPage();

      /* de voettekst kent pas hier het totale aantal pagina's — dat is
         precies waarom "pagina 1 van 3" niet bij het tekenen van pagina 1
         kan worden gezet. Elke pagina wordt even opnieuw de actieve
         pagina, zodat doc.text() in de voettekst gewoon werkt. */
      if (typeof doc._footer === 'function') {
        var total = doc._pages.length;
        var keep = doc._active;
        for (var p = 0; p < total; p++) {
          doc._active = p;
          doc._footer(doc, p + 1, total);
        }
        doc._active = keep;
      }

      var objects = [];                    /* index 0 = object 1 */
      function addObject(body) { objects.push(body); return objects.length; }

      var fontKeys = FONT_KEYS.filter(function (k) { return doc._usedFonts[k]; });
      if (!fontKeys.length) fontKeys = ['regular'];

      var fontObjNr = {};
      fontKeys.forEach(function (k) {
        var f = fontOf(k);
        fontObjNr[k] = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /' + f.base +
          ' /Encoding /WinAnsiEncoding >>');
      });

      var imageObjNr = [];
      doc._images.forEach(function (im, i) {
        var info = im.info;
        var dict, data;
        if (info.kind === 'jpeg') {
          dict = '<< /Type /XObject /Subtype /Image /Width ' + info.width +
            ' /Height ' + info.height +
            ' /ColorSpace ' + (info.channels === 1 ? '/DeviceGray' : '/DeviceRGB') +
            ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.bytes.length + ' >>';
          data = im.bytes;
        } else {
          var cs;
          if (info.colorType === 3) {
            cs = '[/Indexed /DeviceRGB ' + (info.palette.length / 3 - 1) + ' <' +
              hexOf(info.palette) + '>]';
          } else {
            cs = info.colorType === 0 ? '/DeviceGray' : '/DeviceRGB';
          }
          dict = '<< /Type /XObject /Subtype /Image /Width ' + info.width +
            ' /Height ' + info.height + ' /ColorSpace ' + cs +
            ' /BitsPerComponent 8 /Filter /FlateDecode' +
            ' /DecodeParms << /Predictor 15 /Colors ' + info.channels +
            ' /BitsPerComponent 8 /Columns ' + info.width + ' >>' +
            ' /Length ' + info.data.length + ' >>';
          data = info.data;
        }
        imageObjNr[i] = addObject({ dict: dict, stream: data });
      });

      var resParts = ['/ProcSet [/PDF /Text /ImageB /ImageC /ImageI]'];
      resParts.push('/Font << ' + fontKeys.map(function (k) {
        return '/' + fontResName(k) + ' ' + fontObjNr[k] + ' 0 R';
      }).join(' ') + ' >>');
      if (imageObjNr.length) {
        resParts.push('/XObject << ' + imageObjNr.map(function (nr, i) {
          return '/Im' + i + ' ' + nr + ' 0 R';
        }).join(' ') + ' >>');
      }
      var resources = '<< ' + resParts.join(' ') + ' >>';

      /* de Pages-node moet zijn kinderen kennen en omgekeerd; hij krijgt
         daarom eerst een gereserveerd nummer */
      var pagesNr = addObject('');            /* placeholder, straks gevuld */
      var pageNrs = [];
      doc._pages.forEach(function (pg) {
        var content = pg.ops.join('\n');
        var contentNr = addObject({ dict: '<< /Length ' + rawBytes(content).length + ' >>', text: content });
        pageNrs.push(addObject('<< /Type /Page /Parent ' + pagesNr + ' 0 R' +
          ' /MediaBox [0 0 ' + num(mm2pt(doc.width)) + ' ' + num(mm2pt(doc.height)) + ']' +
          ' /Resources ' + resources +
          ' /Contents ' + contentNr + ' 0 R >>'));
      });
      objects[pagesNr - 1] = '<< /Type /Pages /Count ' + pageNrs.length +
        ' /Kids [' + pageNrs.map(function (n2) { return n2 + ' 0 R'; }).join(' ') + '] >>';

      var catalogNr = addObject('<< /Type /Catalog /Pages ' + pagesNr + ' 0 R >>');
      var infoNr = addObject('<< /Title ' + pdfString(doc.title) +
        ' /Subject ' + pdfString(doc.subject) +
        ' /Author ' + pdfString(doc.author) +
        ' /Creator ' + pdfString('CUSTOM+ beheer') +
        ' /Producer ' + pdfString('CUSTOM+ portal/pdf.js ' + VERSION) +
        ' /CreationDate (' + pdfDate(doc.date) + ') /ModDate (' + pdfDate(doc.date) + ') >>');

      /* ---- bytes ---- */
      var out = [];
      var offsets = new Array(objects.length + 1);
      function put(str) {
        var bytes = rawBytes(str);
        for (var i = 0; i < bytes.length; i++) out.push(bytes[i]);
      }
      function putRaw(bytes) {
        for (var i = 0; i < bytes.length; i++) out.push(bytes[i]);
      }

      put('%PDF-1.4\n');
      /* de binaire commentaarregel vertelt elke doorgeefluik (mail, git,
         ftp) dat dit géén tekstbestand is en er niets aan de regeleindes
         mag worden 'verbeterd' */
      putRaw([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]);

      for (var oi = 0; oi < objects.length; oi++) {
        offsets[oi + 1] = out.length;
        var body = objects[oi];
        put((oi + 1) + ' 0 obj\n');
        if (typeof body === 'string') {
          put(body + '\n');
        } else if (body.stream) {
          put(body.dict + '\nstream\n');
          putRaw(body.stream);
          put('\nendstream\n');
        } else {
          put(body.dict + '\nstream\n');
          put(body.text);
          put('\nendstream\n');
        }
        put('endobj\n');
      }

      var xrefAt = out.length;
      put('xref\n0 ' + (objects.length + 1) + '\n');
      put('0000000000 65535 f \n');
      for (var xi = 1; xi <= objects.length; xi++) {
        put(('0000000000' + offsets[xi]).slice(-10) + ' 00000 n \n');
      }
      put('trailer\n<< /Size ' + (objects.length + 1) +
        ' /Root ' + catalogNr + ' 0 R /Info ' + infoNr + ' 0 R >>\n');
      put('startxref\n' + xrefAt + '\n%%EOF\n');

      return new Uint8Array(out);
    };

    return doc;
  }

  function hexOf(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += ('0' + bytes[i].toString(16)).slice(-2);
    return s;
  }

  /* PDF-datum: D:YYYYMMDDHHmmSS+01'00' — altijd in UTC geschreven, dan is
     hij overal ter wereld hetzelfde en reproduceerbaar */
  function pdfDate(d) {
    var dt = (d instanceof Date) ? d : new Date(d || Date.now());
    if (isNaN(dt.getTime())) dt = new Date(0);
    function p(n2) { return ('0' + n2).slice(-2); }
    return 'D:' + dt.getUTCFullYear() + p(dt.getUTCMonth() + 1) + p(dt.getUTCDate()) +
      p(dt.getUTCHours()) + p(dt.getUTCMinutes()) + p(dt.getUTCSeconds()) + 'Z';
  }

  /* een Uint8Array als leesbare tekst — alleen voor tests en foutmeldingen */
  function bytesToLatin1(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  return {
    VERSION: VERSION,
    A4: A4,
    MM_PER_PT: MM_PER_PT,
    PT_PER_MM: PT_PER_MM,
    FONTS: FONTS,
    FONT_KEYS: FONT_KEYS,
    mm2pt: mm2pt,
    pt2mm: pt2mm,
    num: num,
    rgbOf: rgbOf,
    winAnsiBytes: winAnsiBytes,
    rawBytes: rawBytes,
    pdfString: pdfString,
    textWidth: textWidth,
    wrapText: wrapText,
    ellipsize: ellipsize,
    base64ToBytes: base64ToBytes,
    bytesToBase64: bytesToBase64,
    dataUriToBytes: dataUriToBytes,
    imageInfo: imageInfo,
    parsePath: parsePath,
    pdfDate: pdfDate,
    bytesToLatin1: bytesToLatin1,
    createDoc: createDoc
  };
});
