/* CUSTOM+ — minimale, zelfgeschreven QR-encoder + EPC069-12-betaal-QR.
   ------------------------------------------------------------------
   GEEN library, geen provider, geen netwerk. Alleen wat een SEPA-betaal-QR
   nodig heeft, en niets meer:

     · byte-mode (UTF-8), foutcorrectieniveau M, versie 1 t/m 10
     · Reed-Solomon over GF(256) met het QR-primitieve polynoom 0x11D
     · alle acht maskers met de echte strafpuntenregels (N1..N4) — er wordt
       dus geen vast masker gekozen; wint er niets, dan blijft masker 0 over
     · rendering als één SVG-pad (samengevoegde horizontale runs), zodat het
       in de print van de factuur en in het portaal scherp blijft

   Waarom eigen code en niet 'even een library': dit bestand staat in de
   publieke site en gaat mee met elke factuur. Een externe afhankelijkheid
   die morgen verandert of verdwijnt zou een betaalinstructie kunnen breken.
   De tabellen hieronder komen uit ISO/IEC 18004 (dezelfde publieke norm die
   elke andere encoder gebruikt) en zijn met een eigen terugleesbare decoder
   nagerekend: format-bits, timingpatronen, blokstructuur en de RS-syndromen
   van elk blok.

   Publieke API (window.CP_QR):
     encode(text)              → { size, modules[y][x] (bool), version, mask }
     svgMarkup(text, opts)     → SVG-string (opts: size, margin, color, title)
     svgElement(text, opts)    → hetzelfde als echt DOM-element
     epcPayload(opts)          → EPC069-12-tekst (of null als het niet mag)
     ibanCompact(s) / ibanPretty(s) / ibanValid(s)
     bicValid(s)

   Bedragen komen ALTIJD als functie binnen (opts.amountCents): zodra er
   deelbetalingen bestaan geeft de aanroeper het restbedrag mee en rekent
   de QR daar vanzelf mee — hier staat geen aanname over 'het hele bedrag'.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* ============================================================
     1. GF(256) — het rekenveld van Reed-Solomon
     ============================================================ */
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;   /* primitief polynoom x^8+x^4+x^3+x^2+1 */
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* generatorpolynoom van graad `deg`, coëfficiënten hoogste graad eerst */
  var genCache = {};
  function rsGenerator(deg) {
    if (genCache[deg]) return genCache[deg];
    var g = [1];
    for (var i = 0; i < deg; i++) {
      var ng = new Array(g.length + 1);
      for (var z = 0; z < ng.length; z++) ng[z] = 0;
      for (var k = 0; k < g.length; k++) {
        ng[k] ^= g[k];                        /* g * x          */
        ng[k + 1] ^= gmul(g[k], EXP[i]);      /* g * alpha^i    */
      }
      g = ng;
    }
    genCache[deg] = g;
    return g;
  }

  /* de ecLen foutcorrectie-codewoorden bij één datablok */
  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var buf = new Array(data.length + ecLen);
    var i, j;
    for (i = 0; i < data.length; i++) buf[i] = data[i];
    for (i = data.length; i < buf.length; i++) buf[i] = 0;
    for (i = 0; i < data.length; i++) {
      var coef = buf[i];
      if (!coef) continue;
      for (j = 1; j < gen.length; j++) buf[i + j] ^= gmul(gen[j], coef);
    }
    return buf.slice(data.length);
  }

  /* ============================================================
     2. Versietabellen — uitsluitend niveau M, versie 1 t/m 10
     [versie, totaal codewoorden, EC-codewoorden per blok,
      blokken groep 1, datawoorden groep 1, blokken groep 2, datawoorden groep 2]
     ============================================================ */
  var VERSIONS = [
    [1,   26, 10, 1, 16, 0,  0],
    [2,   44, 16, 1, 28, 0,  0],
    [3,   70, 26, 1, 44, 0,  0],
    [4,  100, 18, 2, 32, 0,  0],
    [5,  134, 24, 2, 43, 0,  0],
    [6,  172, 16, 4, 27, 0,  0],
    [7,  196, 18, 4, 31, 0,  0],
    [8,  242, 22, 2, 38, 2, 39],
    [9,  292, 22, 3, 36, 2, 37],
    [10, 346, 26, 4, 43, 1, 44]
  ];
  /* middelpunten van de uitlijnpatronen per versie (versie 1 heeft er geen) */
  var ALIGN = {
    2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function specOf(version) {
    var v = VERSIONS[version - 1];
    return {
      version: v[0], totalCw: v[1], ecPerBlock: v[2],
      g1: v[3], g1Data: v[4], g2: v[5], g2Data: v[6],
      dataCw: v[3] * v[4] + v[5] * v[6]
    };
  }
  /* aantal bytes dat in byte-mode past: databits minus mode (4) en teller */
  function byteCapacity(version) {
    var s = specOf(version);
    var header = 4 + (version >= 10 ? 16 : 8);
    return Math.floor((s.dataCw * 8 - header) / 8);
  }

  /* ============================================================
     3. Tekst → codewoordenstroom
     ============================================================ */
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) { out.push(c); continue; }
      if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); continue; }
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
          var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
          out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
          i++;
          continue;
        }
      }
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function BitBuf() { this.bits = []; }
  BitBuf.prototype.push = function (value, len) {
    for (var i = len - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  };

  function buildCodewords(bytes, version) {
    var spec = specOf(version);
    var bb = new BitBuf();
    bb.push(0x4, 4);                                   /* byte-mode */
    bb.push(bytes.length, version >= 10 ? 16 : 8);     /* tekentelling */
    for (var i = 0; i < bytes.length; i++) bb.push(bytes[i], 8);

    var capBits = spec.dataCw * 8;
    /* afsluiter: maximaal vier nullen, korter als de rest vol is */
    var term = Math.min(4, capBits - bb.bits.length);
    for (i = 0; i < term; i++) bb.bits.push(0);
    while (bb.bits.length % 8 !== 0) bb.bits.push(0);

    var cw = [];
    for (i = 0; i < bb.bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bb.bits[i + j];
      cw.push(b);
    }
    /* vulbytes, afwisselend 11101100 / 00010001 */
    var pad = [0xEC, 0x11], p = 0;
    while (cw.length < spec.dataCw) { cw.push(pad[p]); p ^= 1; }

    /* blokken opdelen, EC per blok, daarna interleaven */
    var blocks = [], ecBlocks = [], pos = 0, k;
    for (k = 0; k < spec.g1; k++) {
      blocks.push(cw.slice(pos, pos + spec.g1Data)); pos += spec.g1Data;
    }
    for (k = 0; k < spec.g2; k++) {
      blocks.push(cw.slice(pos, pos + spec.g2Data)); pos += spec.g2Data;
    }
    for (k = 0; k < blocks.length; k++) ecBlocks.push(rsEncode(blocks[k], spec.ecPerBlock));

    var out = [];
    var maxData = Math.max(spec.g1Data, spec.g2Data || 0);
    for (i = 0; i < maxData; i++) {
      for (k = 0; k < blocks.length; k++) if (i < blocks[k].length) out.push(blocks[k][i]);
    }
    for (i = 0; i < spec.ecPerBlock; i++) {
      for (k = 0; k < ecBlocks.length; k++) out.push(ecBlocks[k][i]);
    }
    return out;
  }

  /* ============================================================
     4. De matrix
     ============================================================ */
  function newGrid(size, fill) {
    var g = new Array(size);
    for (var y = 0; y < size; y++) {
      g[y] = new Array(size);
      for (var x = 0; x < size; x++) g[y][x] = fill;
    }
    return g;
  }

  function getBit(value, i) { return ((value >>> i) & 1) !== 0; }

  function Matrix(version) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = newGrid(this.size, false);
    this.isFunction = newGrid(this.size, false);
  }
  Matrix.prototype.setFn = function (x, y, dark) {
    this.modules[y][x] = !!dark;
    this.isFunction[y][x] = true;
  };
  Matrix.prototype.drawFinder = function (cx, cy) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        var x = cx + dx, y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.setFn(x, y, d !== 2 && d !== 4);
      }
    }
  };
  Matrix.prototype.drawAlign = function (cx, cy) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        this.setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };
  Matrix.prototype.drawFormat = function (mask) {
    /* 5 databits (niveau M = 00, plus 3 maskerbits) + BCH(15,5), XOR 0x5412 */
    var data = (0 << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    var size = this.size;
    for (i = 0; i <= 5; i++) this.setFn(8, i, getBit(bits, i));
    this.setFn(8, 7, getBit(bits, 6));
    this.setFn(8, 8, getBit(bits, 7));
    this.setFn(7, 8, getBit(bits, 8));
    for (i = 9; i < 15; i++) this.setFn(14 - i, 8, getBit(bits, i));
    for (i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, getBit(bits, i));
    for (i = 8; i < 15; i++) this.setFn(8, size - 15 + i, getBit(bits, i));
    this.setFn(8, size - 8, true);   /* de altijd-donkere module */
  };
  Matrix.prototype.drawVersion = function () {
    if (this.version < 7) return;
    var rem = this.version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (this.version << 12) | rem;   /* 18 bits, BCH(18,6) */
    for (i = 0; i < 18; i++) {
      var b = getBit(bits, i);
      var a = this.size - 11 + (i % 3), c = Math.floor(i / 3);
      this.setFn(a, c, b);
      this.setFn(c, a, b);
    }
  };
  Matrix.prototype.drawFunctionPatterns = function () {
    var i, size = this.size;
    for (i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);
    var pos = ALIGN[this.version] || [];
    var n = pos.length;
    for (i = 0; i < n; i++) {
      for (var j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlign(pos[i], pos[j]);
      }
    }
    this.drawFormat(0);   /* reserveert het formaatgebied; echte bits later */
    this.drawVersion();
  };
  Matrix.prototype.drawCodewords = function (cw) {
    var i = 0, size = this.size;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;                 /* kolom 6 is timing */
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < cw.length * 8) {
            this.modules[y][x] = getBit(cw[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  };
  Matrix.prototype.applyMask = function (mask) {
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        var invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; break;
          case 5: invert = (x * y) % 2 + (x * y) % 3 === 0; break;
          case 6: invert = ((x * y) % 2 + (x * y) % 3) % 2 === 0; break;
          default: invert = ((x + y) % 2 + (x * y) % 3) % 2 === 0; break;
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  };

  /* strafpunten N1..N4 uit de norm — hoe lager, hoe leesbaarder */
  function penalty(m) {
    var size = m.size, mods = m.modules, score = 0, x, y;
    var FINDER_A = [true, false, true, true, true, false, true, false, false, false, false];
    var FINDER_B = [false, false, false, false, true, false, true, true, true, false, true];

    function runScore(line) {
      var s = 0, run = 1, k, t;
      for (k = 1; k < line.length; k++) {
        if (line[k] === line[k - 1]) { run++; continue; }
        if (run >= 5) s += 3 + (run - 5);
        run = 1;
      }
      if (run >= 5) s += 3 + (run - 5);
      /* N3: 1:1:3:1:1 met vier lichte modules ernaast */
      for (k = 0; k + 11 <= line.length; k++) {
        var okA = true, okB = true;
        for (t = 0; t < 11; t++) {
          if (line[k + t] !== FINDER_A[t]) okA = false;
          if (line[k + t] !== FINDER_B[t]) okB = false;
        }
        if (okA || okB) s += 40;
      }
      return s;
    }
    for (y = 0; y < size; y++) score += runScore(mods[y]);
    for (x = 0; x < size; x++) {
      var col = new Array(size);
      for (y = 0; y < size; y++) col[y] = mods[y][x];
      score += runScore(col);
    }
    /* N2: elk 2x2-blok van gelijke kleur */
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var v = mods[y][x];
        if (v === mods[y][x + 1] && v === mods[y + 1][x] && v === mods[y + 1][x + 1]) score += 3;
      }
    }
    /* N4: afwijking van 50% donker */
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mods[y][x]) dark++;
    var total = size * size;
    score += Math.floor(Math.abs(dark * 100 / total - 50) / 5) * 10;
    return score;
  }

  /* ============================================================
     5. Publieke encode
     ============================================================ */
  function encode(text) {
    var bytes = utf8Bytes(String(text == null ? '' : text));
    var version = 0;
    for (var v = 1; v <= 10; v++) {
      if (bytes.length <= byteCapacity(v)) { version = v; break; }
    }
    if (!version) {
      throw new Error('QR: payload van ' + bytes.length + ' bytes past niet in versie 10 (max ' + byteCapacity(10) + ').');
    }
    var cw = buildCodewords(bytes, version);
    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var m = new Matrix(version);
      m.drawFunctionPatterns();
      m.drawCodewords(cw);
      m.applyMask(mask);
      m.drawFormat(mask);
      var p = penalty(m);
      if (!best || p < best.penalty) best = { matrix: m, penalty: p, mask: mask };
    }
    return {
      size: best.matrix.size,
      modules: best.matrix.modules,
      version: version,
      mask: best.mask,
      penalty: best.penalty
    };
  }

  /* ============================================================
     6. SVG — één pad, horizontale runs samengevoegd
     ============================================================ */
  function pathData(qr) {
    var d = [], size = qr.size;
    for (var y = 0; y < size; y++) {
      var x = 0;
      while (x < size) {
        if (!qr.modules[y][x]) { x++; continue; }
        var start = x;
        while (x < size && qr.modules[y][x]) x++;
        d.push('M' + start + ' ' + y + 'h' + (x - start) + 'v1h-' + (x - start) + 'z');
      }
    }
    return d.join('');
  }

  function svgParts(text, opts) {
    opts = opts || {};
    var qr = encode(text);
    var margin = typeof opts.margin === 'number' ? opts.margin : 2;   /* stille zone */
    return {
      qr: qr,
      margin: margin,
      box: qr.size + margin * 2,
      px: opts.size || 132,
      color: opts.color || 'currentColor',
      background: opts.background || '#fff',
      title: opts.title ? String(opts.title) : '',
      d: pathData(qr)
    };
  }

  function svgMarkup(text, opts) {
    var p = svgParts(text, opts);
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + p.box + ' ' + p.box + '"' +
      ' width="' + p.px + '" height="' + p.px + '" shape-rendering="crispEdges"' +
      (p.title ? ' role="img" aria-label="' + esc(p.title) + '"' : ' role="presentation" aria-hidden="true"') + '>' +
      (p.title ? '<title>' + esc(p.title) + '</title>' : '') +
      '<rect width="' + p.box + '" height="' + p.box + '" fill="' + esc(p.background) + '"/>' +
      '<g transform="translate(' + p.margin + ' ' + p.margin + ')" fill="' + esc(p.color) + '">' +
      '<path d="' + p.d + '"/></g></svg>';
  }

  /* hetzelfde beeld als echt DOM-element — opgebouwd met createElementNS,
     zodat er nergens markup in een innerHTML hoeft */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgElement(text, opts) {
    var p = svgParts(text, opts);
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('xmlns', SVGNS);
    svg.setAttribute('viewBox', '0 0 ' + p.box + ' ' + p.box);
    svg.setAttribute('width', String(p.px));
    svg.setAttribute('height', String(p.px));
    svg.setAttribute('shape-rendering', 'crispEdges');
    if (p.title) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', p.title);
      var t = document.createElementNS(SVGNS, 'title');
      t.textContent = p.title;
      svg.appendChild(t);
    } else {
      svg.setAttribute('role', 'presentation');
      svg.setAttribute('aria-hidden', 'true');
    }
    var bg = document.createElementNS(SVGNS, 'rect');
    bg.setAttribute('width', String(p.box));
    bg.setAttribute('height', String(p.box));
    bg.setAttribute('fill', p.background);
    svg.appendChild(bg);
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('transform', 'translate(' + p.margin + ' ' + p.margin + ')');
    g.setAttribute('fill', p.color);
    var path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', p.d);
    g.appendChild(path);
    svg.appendChild(g);
    return svg;
  }

  /* ============================================================
     7. IBAN / BIC
     ============================================================ */
  function ibanCompact(s) { return String(s || '').replace(/[\s-]/g, '').toUpperCase(); }
  function ibanPretty(s) { return ibanCompact(s).replace(/(.{4})/g, '$1 ').trim(); }
  function ibanValid(s) {
    var v = ibanCompact(s);
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(v)) return false;
    var re = v.slice(4) + v.slice(0, 4);
    var rem = 0;
    for (var i = 0; i < re.length; i++) {
      var c = re.charCodeAt(i);
      var part = (c >= 65 && c <= 90) ? String(c - 55) : re.charAt(i);
      for (var j = 0; j < part.length; j++) rem = (rem * 10 + (part.charCodeAt(j) - 48)) % 97;
    }
    return rem === 1;
  }
  function bicValid(s) {
    var v = String(s || '').replace(/\s/g, '').toUpperCase();
    return v === '' || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
  }

  /* ============================================================
     8. EPC069-12 (versie 002) — de SEPA-betaal-QR
     ------------------------------------------------------------
     Regelvolgorde volgens de norm:
       1 BCD · 2 002 · 3 tekenset (1 = UTF-8) · 4 SCT · 5 BIC ·
       6 naam begunstigde · 7 IBAN · 8 bedrag (EUR#.##) ·
       9 doelcode · 10 gestructureerde mededeling · 11 vrije mededeling
     Het factuurnummer gaat bewust in regel 11 (vrije mededeling): regel 10
     is voorbehouden aan een ISO-11649-referentie (RF…) en 'CP-2026-0001' is
     dat niet — daar neerzetten levert bij sommige banken een afgekeurde QR.
     De norm staat maar één van beide regels gevuld toe.
     Alleen EUR: de EPC-standaard kent geen andere valuta.
     ============================================================ */
  var EPC_MAX_BYTES = 331;   /* harde grens uit de norm */

  function amountLine(amountCents) {
    var cents = Math.round(Number(amountCents) || 0);
    if (!(cents > 0)) return null;
    if (cents > 99999999999) return null;   /* norm: max 999999999.99 */
    return 'EUR' + (cents / 100).toFixed(2);
  }

  function epcPayload(opts) {
    opts = opts || {};
    if ((opts.currency || 'EUR') !== 'EUR') return null;
    var iban = ibanCompact(opts.iban);
    if (!ibanValid(iban)) return null;
    var name = String(opts.name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 70);
    if (!name) return null;
    var amt = amountLine(opts.amountCents);
    if (!amt) return null;
    var bic = String(opts.bic || '').replace(/\s/g, '').toUpperCase();
    if (!bicValid(bic)) bic = '';
    var ref = String(opts.reference || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 140);
    var text = ['BCD', '002', '1', 'SCT', bic, name, iban, amt, '', '', ref].join('\n');
    if (utf8Bytes(text).length > EPC_MAX_BYTES) return null;
    return text;
  }

  /* alles-in-één: payload + SVG, of null als een gegeven ontbreekt.
     De aanroeper toont dan de tekstuele IBAN/SWIFT-instructie — nooit een
     halve QR met verzonnen gegevens. */
  function epcSvgElement(opts) {
    var payload = epcPayload(opts);
    if (!payload) return null;
    try { return svgElement(payload, (opts && opts.svg) || {}); }
    catch (e) { return null; }   /* te lange payload → geen QR, wel de tekst */
  }
  function epcSvgMarkup(opts) {
    var payload = epcPayload(opts);
    if (!payload) return null;
    try { return svgMarkup(payload, (opts && opts.svg) || {}); }
    catch (e) { return null; }
  }

  window.CP_QR = {
    encode: encode,
    /* fase 3 (PDF): svgParts/pathData waren al de motor onder svgMarkup en
       svgElement; ze staan nu ook in de publieke API zodat portal/pdf.js
       exact hetzelfde pad als PDF-vectorpad kan tekenen. Eén QR-encoder in
       dit project, drie weergaven — een tweede encoder zou vroeg of laat
       een andere code opleveren dan die op het scherm. */
    svgParts: svgParts,
    pathData: pathData,
    svgMarkup: svgMarkup,
    svgElement: svgElement,
    epcPayload: epcPayload,
    epcSvgElement: epcSvgElement,
    epcSvgMarkup: epcSvgMarkup,
    ibanCompact: ibanCompact,
    ibanPretty: ibanPretty,
    ibanValid: ibanValid,
    bicValid: bicValid,
    byteCapacity: byteCapacity,
    _spec: specOf,
    _utf8: utf8Bytes
  };
})();
