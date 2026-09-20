/* CUSTOM+ — de PDF-schrijver (portal/pdf.js).
   ------------------------------------------------------------------
   Deze tests kijken NIET of een PDF er mooi uitziet — dat kan een test
   niet en dat hoort een mens te doen. Ze kijken of het bestand KLOPT:

     · begint het met %PDF en eindigt het met %%EOF;
     · wijst elke regel in de cross-reference-tabel precies naar het begin
       van het object dat hij belooft (dit is de fout die een PDF onopenbaar
       maakt zonder dat je het aan de tekst ziet);
     · klopt de /Length van elke contentstream met wat er werkelijk in staat;
     · komt elk stuk tekst dat is getekend ook echt in het bestand terecht;
     · breekt hij netjes af naar een volgende pagina en klopt "pagina x van y".

   De xref-test is er niet voor niets: tijdens het bouwen van dit bestand
   ging precies dát fout (regeleindes werden onderweg spaties, waardoor de
   offsets nergens meer op sloegen). CoreGraphics zei alleen "failed to find
   start of cross-reference table" en verder niets. Deze test zegt het wél.
   ------------------------------------------------------------------ */
import P from '../portal/pdf.js';

function latin1(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/* de xref-tabel teruglezen zoals een PDF-lezer dat doet */
function readXref(bytes) {
  const s = latin1(bytes);
  const at = s.lastIndexOf('startxref');
  if (at < 0) return { ok: false, reason: 'geen startxref' };
  const start = Number(s.slice(at + 9).trim().split(/\s/)[0]);
  if (!isFinite(start) || start <= 0 || start >= bytes.length) return { ok: false, reason: 'startxref wijst buiten het bestand' };
  if (s.slice(start, start + 4) !== 'xref') return { ok: false, reason: 'startxref wijst niet naar "xref" maar naar ' + JSON.stringify(s.slice(start, start + 12)) };
  const head = s.slice(start + 4).match(/^\s*(\d+)\s+(\d+)/);
  if (!head) return { ok: false, reason: 'geen subsectiekop' };
  const first = Number(head[1]);
  const count = Number(head[2]);
  const bodyAt = start + 4 + head[0].length + 1;
  const offsets = [];
  for (let i = 0; i < count; i++) {
    const line = s.slice(bodyAt + i * 20, bodyAt + i * 20 + 20);
    offsets.push({ offset: Number(line.slice(0, 10)), type: line[17], raw: line });
  }
  return { ok: true, first, count, offsets, source: s };
}

/* elke /Length moet kloppen met de echte lengte van de stream ertussen —
   een lezer telt letterlijk zoveel bytes en raakt anders het spoor kwijt */
function checkStreamLengths(text) {
  for (const m of text.matchAll(/\/Length (\d+) >>\s*stream\r?\n/g)) {
    const declared = Number(m[1]);
    const from = m.index + m[0].length;
    const eind = text.indexOf('\nendstream', from);
    if (eind < 0) return 'geen endstream gevonden na offset ' + from;
    const echt = eind - from;
    if (echt !== declared) return 'gedeclareerd ' + declared + ', werkelijk ' + echt;
  }
  return '';
}

export default function (t) {
  t.group('bytes en structuur');

  const doc = P.createDoc({ title: 'Structuurtest', date: new Date('2026-01-02T03:04:05Z') });
  doc.setFooter(function (d, nr, total) {
    d.text('pagina ' + nr + ' van ' + total, 105, 288, { align: 'center', size: 8 });
  });
  doc.text('Eerste pagina', 15, 30, { size: 11 });
  doc.text('Bedrag rechts', 195, 30, { align: 'right', font: 'mono', size: 9 });
  doc.rect(15, 40, 60, 20, { fill: '#faf8f5', stroke: '#e8e4de', radius: 3 });
  doc.line(15, 65, 195, 65, {});
  doc.addPage();
  doc.text('Tweede pagina', 15, 30, {});
  const bytes = doc.build();
  const text = latin1(bytes);

  t.eq(text.slice(0, 8), '%PDF-1.4', 'het bestand begint met de PDF-versieregel');
  t.true(text.trimEnd().endsWith('%%EOF'), 'het bestand eindigt met %%EOF');
  t.true(bytes[9] === 0x25 && bytes[10] > 127, 'na de versieregel staat de binaire commentaarregel (anders "verbetert" een doorgeefluik de regeleindes)');

  t.group('cross-reference-tabel');
  const xr = readXref(bytes);
  t.true(xr.ok, 'de xref-tabel is vindbaar en leesbaar' + (xr.ok ? '' : ' — ' + xr.reason));
  if (xr.ok) {
    t.eq(xr.first, 0, 'de subsectie begint bij object 0');
    t.eq(xr.offsets[0].type, 'f', 'object 0 is de vrije kop van de lijst');
    let alleGoed = true;
    let fout = '';
    for (let i = 1; i < xr.count; i++) {
      const off = xr.offsets[i].offset;
      const verwacht = i + ' 0 obj';
      if (xr.source.slice(off, off + verwacht.length) !== verwacht) {
        alleGoed = false;
        fout = 'object ' + i + ': offset ' + off + ' wijst naar ' + JSON.stringify(xr.source.slice(off, off + 20));
        break;
      }
    }
    t.true(alleGoed, 'elke xref-regel wijst exact naar het begin van zijn object' + (alleGoed ? '' : ' — ' + fout));
    t.true(xr.offsets.every(function (o, i) { return i === 0 || o.type === 'n'; }), 'alle objecten na 0 staan als in gebruik gemarkeerd');
  }

  t.group('streams');
  const streamFout = checkStreamLengths(text);
  t.eq(streamFout, '', 'elke stream-/Length klopt met de werkelijke inhoud');

  t.group('paginas en voettekst');
  const paginas = (text.match(/\/Type \/Page[^s]/g) || []).length;
  t.eq(paginas, 2, 'twee addPage-aanroepen geven twee pagina-objecten');
  t.true(text.indexOf('(pagina 1 van 2)') > -1, 'de voettekst kent het TOTALE aantal paginas — dat is pas bij build() bekend');
  t.true(text.indexOf('(pagina 2 van 2)') > -1, 'de voettekst staat op elke pagina, met het juiste nummer');
  t.true(text.indexOf('(Eerste pagina)') > -1, 'getekende tekst belandt letterlijk in het bestand');
  t.true(text.indexOf('(Tweede pagina)') > -1, 'ook de tekst van de tweede pagina');

  t.group('fonts');
  t.true(text.indexOf('/BaseFont /Helvetica-Bold') < 0, 'een font dat niet is gebruikt komt niet in het bestand');
  t.true(text.indexOf('/BaseFont /Courier') > -1, 'het gebruikte monospace-font staat er wel in');
  t.true(text.indexOf('/Encoding /WinAnsiEncoding') > -1, 'de standaardfonts worden met WinAnsi gedeclareerd');

  t.group('tekstcodering');
  t.deep(P.winAnsiBytes('AZ'), [65, 90], 'gewone ASCII gaat één op één');
  t.deep(P.winAnsiBytes('é'), [0xE9], 'Latin-1 met accent gaat één op één');
  t.deep(P.winAnsiBytes('€'), [0x80], 'het euroteken gaat naar zijn WinAnsi-plek 0x80');
  t.deep(P.winAnsiBytes('—'), [0x97], 'het em-streepje gaat naar 0x97');
  t.deep(P.winAnsiBytes('中'), [0x3F], 'wat een standaardfont niet kan tekenen wordt een vraagteken, geen kapotte byte');
  t.deep(P.winAnsiBytes('a\nb'), [97, 32, 98], 'in GETEKENDE tekst wordt een regeleinde een spatie (een Tj-string kent geen regels)');
  t.deep(P.rawBytes('a\nb'), [97, 10, 98], 'in de SYNTAX blijft het regeleinde staan — dat is precies het verschil dat de xref stuk kan maken');
  t.eq(P.pdfString('a(b)c\\d'), '(a\\(b\\)c\\\\d)', 'haakjes en backslash worden ontsnapt');
  t.eq(P.pdfString('é'), '(\\351)', 'hoge bytes worden octaal geschreven zodat de stream ASCII blijft');

  t.group('breedte en wikkeling');
  /* Helvetica: alle cijfers zijn 556/1000 breed. Daarom lijnt een kolom
     bedragen uit zonder monospace-font, en daarom staat de bedragenkolom
     van de factuur in Helvetica. */
  const w1 = P.textWidth('11111', 'regular', 10);
  const w2 = P.textWidth('90876', 'regular', 10);
  t.true(Math.abs(w1 - w2) < 0.0001, 'alle cijfers zijn in Helvetica even breed (tabellarisch)');
  t.true(P.textWidth('M', 'regular', 10) > P.textWidth('i', 'regular', 10), 'een brede letter is breder dan een smalle');
  t.eq(P.textWidth('aaaa', 'mono', 12), P.textWidth('MMMM', 'mono', 12), 'Courier is monospace: elk teken even breed');
  t.eq(Math.round(P.textWidth('é', 'regular', 10) * 1000), Math.round(P.textWidth('e', 'regular', 10) * 1000),
    'een letter met accent heeft in deze fonts exact de breedte van zijn grondletter');

  const regels = P.wrapText('een twee drie vier vijf zes zeven acht negen tien', 20, { size: 9 });
  t.true(regels.length > 1, 'lange tekst wikkelt over meerdere regels');
  t.true(regels.every(function (r) { return P.textWidth(r, 'regular', 9) <= 20.0001; }),
    'geen enkele gewikkelde regel is breder dan de kolom');
  const langWoord = P.wrapText('WOORDDATVEELTEBREEDISVOORDEKOLOMENNERGENSKANBREKEN', 15, { size: 9 });
  t.true(langWoord.length > 1, 'een woord dat zelf al te breed is wordt hard gebroken in plaats van buiten de kolom te lopen');
  t.true(langWoord.every(function (r) { return P.textWidth(r, 'regular', 9) <= 15.0001; }), 'ook de hard gebroken stukken passen');
  t.deep(P.wrapText('een\ntwee', 100, { size: 9 }), ['een', 'twee'], 'een regeleinde in de invoer blijft een regeleinde');

  /* HARD BREKEN MAG NIET AFHANGEN VAN DE PLEK IN DE REGEL.
     De harde breuk zat eerst in de tak die een LEGE regel eiste. Een te
     breed woord werd daardoor alleen gebroken als het toevallig het eerste
     van de regel was; stond er iets voor, dan liep het ongebroken de kolom
     uit en viel het op een factuur over de bedragenkolom heen. De
     omschrijvingskolom van het factuursjabloon is ongeveer 40 mm breed. */
  const KOLOM = 40;
  const CODE200 = new Array(201).join('X');       /* 200 tekens */
  const middenin = P.wrapText('Levering ' + CODE200 + ' compleet', KOLOM, { size: 9 });
  t.true(middenin.every(function (r) { return P.textWidth(r, 'regular', 9) <= KOLOM + 0.0001; }),
    'een woord van 200 tekens wordt ook gebroken als er al een woord vóór staat');
  t.true(middenin.join('').indexOf(CODE200) > -1,
    'bij het hard breken raakt er geen enkel teken van het woord zoek');
  const tweeLange = P.wrapText('kop ' + CODE200 + ' ' + CODE200, KOLOM, { size: 9 });
  t.true(tweeLange.every(function (r) { return P.textWidth(r, 'regular', 9) <= KOLOM + 0.0001; }),
    'twee te brede woorden achter elkaar worden allebei gebroken');
  const metUrl = P.wrapText(
    'Zie https://voorbeeld.example/factuur/2026/000123/betaalkenmerk-9f3c2a1b8e voor de details',
    30, { size: 8 });
  t.true(metUrl.every(function (r) { return P.textWidth(r, 'regular', 8) <= 30.0001; }),
    'een lange URL midden in een zin blijft binnen de kolom');
  const duits = P.wrapText('Levering Rindfleischetikettierungsueberwachungsaufgabenuebertragungsgesetz nu', 25, { size: 9 });
  t.true(duits.every(function (r) { return P.textWidth(r, 'regular', 9) <= 25.0001; }),
    'ook een Duitse samenstelling na een gewoon woord blijft binnen de kolom');

  t.group('afkappen');
  const kort = P.ellipsize('een hele lange omschrijving die niet past', 20, 'regular', 9);
  t.true(P.textWidth(kort, 'regular', 9) <= 20.0001, 'afgekapte tekst past binnen de opgegeven breedte');
  t.true(kort.slice(-1) === '…', 'afkappen zet er een echte ellips achter');
  t.eq(P.ellipsize('kort', 40, 'regular', 9), 'kort', 'wat past wordt niet aangeraakt');
  /* dezelfde valkuil als bij het wikkelen: de lus stopte bij één
     overgebleven teken, en dat teken plus de ellips liep in een hele smalle
     kolom alsnog buiten de kolom */
  t.eq(P.ellipsize('omschrijving', 1, 'regular', 9), '…',
    'in een kolom waar niets in past blijft alleen de ellips over, niet nog een teken ervoor');

  t.group('getallen en kleuren');
  t.eq(P.num(1), '1', 'een geheel getal blijft geheel');
  t.eq(P.num(10.0001), '10', 'onder de duizendste wordt weggerond');
  t.eq(P.num(-0.0001), '0', 'er komt nooit een "-0" in het bestand');
  t.eq(P.num(1.5), '1.5', 'een halve blijft een halve');
  t.eq(P.rgbOf('#000000'), '0 0 0', 'zwart');
  t.eq(P.rgbOf('#ffffff'), '1 1 1', 'wit');
  t.eq(P.rgbOf('#fff'), '1 1 1', 'de korte hexvorm werkt ook');
  t.eq(P.rgbOf('kaboem'), '0 0 0', 'een onzinkleur valt terug op zwart in plaats van de PDF te breken');

  t.group('base64');
  t.deep(Array.from(P.base64ToBytes('AAECAw==')), [0, 1, 2, 3], 'base64 zonder atob of Buffer');
  t.eq(P.bytesToBase64(new Uint8Array([0, 1, 2, 3])), 'AAECAw==', 'en weer terug');
  t.deep(Array.from(P.base64ToBytes(P.bytesToBase64(new Uint8Array([255, 128, 7])))), [255, 128, 7], 'heen en terug geeft dezelfde bytes');
  t.deep(Array.from(P.dataUriToBytes('data:image/jpeg;base64,AAEC')), [0, 1, 2], 'een data-URI wordt uitgepakt');
  t.eq(P.dataUriToBytes('data:image/png,niet-base64'), null, 'een data-URI zonder base64 wordt eerlijk geweigerd');

  t.group('svg-paden naar pdf-paden');
  /* dit is precies de vorm die portal/qr.js levert: één samengevoegd pad
     met horizontale runs */
  const cmds = P.parsePath('M0 0h3v1h-3zM5 2h1v1h-1z');
  t.eq(cmds.length, 10, 'twee vierkanten geven twee keer m + drie l + h');
  t.deep(cmds[0], ['m', 0, 0], 'het pad begint met een moveto op de opgegeven plek');
  t.deep(cmds[1], ['l', 3, 0], 'h3 wordt een lineto naar rechts');
  t.deep(cmds[2], ['l', 3, 1], 'v1 wordt een lineto naar beneden');
  t.deep(cmds[4], ['h'], 'z sluit het pad');
  t.deep(cmds[5], ['m', 5, 2], 'na een z begint het volgende deelpad op de juiste plek');
  t.eq(P.parsePath('').length, 0, 'een leeg pad geeft niets, en klapt niet');

  t.group('beeldherkenning');
  /* een piepkleine, met de hand gemaakte JPEG-kop: SOI + SOF0 met
     8 bits, 16 hoog, 32 breed, 3 kanalen */
  const jpg = new Uint8Array([
    0xFF, 0xD8,
    0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20, 0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xFF, 0xD9
  ]);
  const jinfo = P.imageInfo(jpg);
  t.true(!!jinfo, 'een JPEG wordt herkend');
  t.eq(jinfo && jinfo.kind, 'jpeg', 'als JPEG');
  t.eq(jinfo && jinfo.width, 32, 'de breedte wordt uit het SOF-blok gelezen');
  t.eq(jinfo && jinfo.height, 16, 'en de hoogte');
  t.eq(jinfo && jinfo.channels, 3, 'en het aantal kleurkanalen');
  t.eq(P.imageInfo(new Uint8Array([1, 2, 3, 4])), null, 'onbekende bytes worden niet voor een beeld aangezien');

  t.group('beeld in het document');
  const doc2 = P.createDoc({ date: new Date(0) });
  let gooide = '';
  try { doc2.image(jpg, 10, 10, 20, 10); } catch (e) { gooide = e.message; }
  t.eq(gooide, '', 'een geldige JPEG kan worden geplaatst');
  const box = doc2.imageBox(jpg, 40, 40);
  t.true(!!box && Math.abs(box.height / box.width - 0.5) < 0.001, 'imageBox houdt de verhouding van het beeld aan (32×16 = 2:1)');
  const b2 = doc2.build();
  const t2 = latin1(b2);
  t.true(t2.indexOf('/Filter /DCTDecode') > -1, 'de JPEG gaat ongewijzigd als DCTDecode het bestand in');
  t.true(t2.indexOf('/Subtype /Image') > -1, 'als beeld-XObject');
  t.true(readXref(b2).ok, 'ook mét een ingesloten beeld klopt de xref nog');
  t.eq(checkStreamLengths(t2), '', 'en de streamlengtes kloppen ook met binaire inhoud erin');

  t.group('automatische paginabreuk');
  const doc3 = P.createDoc({ date: new Date(0) });
  doc3.setFooter(function (d, nr, total) { d.text('blad ' + nr + '/' + total, 105, 288, { size: 8 }); });
  doc3.addPage();
  let brekingen = 0;
  for (let i = 0; i < 120; i++) {
    if (doc3.ensure(6)) brekingen++;
    doc3.text('regel ' + i, 15, doc3.y + 4, { size: 9 });
    doc3.y += 6;
  }
  const b3 = doc3.build();
  const paginas3 = (latin1(b3).match(/\/Type \/Page[^s]/g) || []).length;
  t.true(paginas3 > 1, '120 regels van 6 mm passen niet op één A4 en breken vanzelf af');
  t.eq(paginas3, brekingen + 1, 'elke afbreking levert precies één pagina extra');
  t.true(latin1(b3).indexOf('(blad ' + paginas3 + '/' + paginas3 + ')') > -1, 'de laatste pagina draagt het juiste nummer');

  t.group('reproduceerbaarheid');
  function bouw() {
    const d = P.createDoc({ title: 'Zelfde', date: new Date('2026-05-05T00:00:00Z') });
    d.text('Zelfde inhoud', 15, 30, {});
    return latin1(d.build());
  }
  t.eq(bouw(), bouw(), 'dezelfde invoer met dezelfde datum geeft byte voor byte hetzelfde bestand');
}
