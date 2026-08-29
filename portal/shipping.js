/* CUSTOM+ zendingen — gedeelde constanten en checks voor portal.html én
   beheer.html (feature "De Reis"). Laden ná portal/demo-data.js.
   Bewust dom en statisch: mijlpaalsjablonen, carrierlinks en de ISO 6346
   controlecijfercheck. Een echte tracking-API kan hier later achter komen
   zonder dat de UI verandert — de portal linkt tot die tijd eerlijk door
   naar de officiële pagina van de vervoerder. */
window.CP_SHIPPING = (function () {
  'use strict';

  var TYPES = [
    { key: 'koerier',     label: 'Koerier' },
    { key: 'zeevracht',   label: 'Zeevracht' },
    { key: 'luchtvracht', label: 'Luchtvracht' }
  ];

  /* Vast sjabloon van negen mijlpalen voor zeevracht: samples en de
     productiebatch lopen zo nooit door elkaar. */
  var MILESTONES_SEA = [
    { key: 'vertrek_fabriek',           label: 'Vertrek uit de fabriek' },
    { key: 'aankomst_haven',            label: 'Aankomst in de vertrekhaven' },
    { key: 'geladen_schip',             label: 'Geladen op het schip' },
    { key: 'vertrek_zee',               label: 'Vertrokken over zee' },
    { key: 'aankomst_bestemmingshaven', label: 'Aankomst in de bestemmingshaven' },
    { key: 'douane',                    label: 'Bij de douane' },
    { key: 'inklaring',                 label: 'Ingeklaard' },
    { key: 'laatste_km',                label: 'Laatste kilometer' },
    { key: 'geleverd',                  label: 'Geleverd' }
  ];

  /* Kort sjabloon van vijf voor koerierzendingen (T0/T1/T2, golden sample);
     luchtvracht volgt hetzelfde korte sjabloon. */
  var MILESTONES_COURIER = [
    { key: 'opgehaald',  label: 'Opgehaald' },
    { key: 'vertrokken', label: 'Vertrokken' },
    { key: 'onderweg',   label: 'Onderweg' },
    { key: 'laatste_km', label: 'Laatste kilometer' },
    { key: 'geleverd',   label: 'Geleverd' }
  ];

  function enc(nr) { return encodeURIComponent(String(nr == null ? '' : nr).trim()); }

  /* Officiële trackingpagina per vervoerder; 'anders' valt terug op 17track. */
  var CARRIERS = {
    dhl:       { name: 'DHL',        trackUrl: function (n) { return 'https://www.dhl.com/nl-nl/home/tracking.html?tracking-id=' + enc(n) + '&submit=1'; } },
    fedex:     { name: 'FedEx',      trackUrl: function (n) { return 'https://www.fedex.com/fedextrack/?trknbr=' + enc(n); } },
    ups:       { name: 'UPS',        trackUrl: function (n) { return 'https://www.ups.com/track?loc=nl_NL&tracknum=' + enc(n); } },
    sf:        { name: 'SF Express', trackUrl: function (n) { return 'https://www.sf-express.com/we/ow/chn/sc/waybill/waybill-detail/' + enc(n); } },
    maersk:    { name: 'Maersk',     trackUrl: function (n) { return 'https://www.maersk.com/tracking/' + enc(n); } },
    msc:       { name: 'MSC',        trackUrl: function (n) { return 'https://www.msc.com/en/track-a-shipment?trackingNumber=' + enc(n); } },
    cmacgm:    { name: 'CMA CGM',    trackUrl: function (n) { return 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference=' + enc(n); } },
    cosco:     { name: 'COSCO',      trackUrl: function (n) { return 'https://elines.coscoshipping.com/ebusiness/cargotracking?trackingType=CONTAINER&number=' + enc(n); } },
    evergreen: { name: 'Evergreen',  trackUrl: function (n) { return 'https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do?TYPE=CargoTracking&NO=' + enc(n); } },
    one:       { name: 'ONE',        trackUrl: function (n) { return 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?ctrack-field=' + enc(n) + '&trakNoParam=' + enc(n); } },
    anders:    { name: '17track',    trackUrl: function (n) { return 'https://t.17track.net/nl#nums=' + enc(n); } }
  };
  var CARRIER_ORDER = ['dhl', 'fedex', 'ups', 'sf', 'maersk', 'msc', 'cmacgm', 'cosco', 'evergreen', 'one', 'anders'];

  /* ISO 6346 letterwaarden: A=10 en verder oplopend, waarbij veelvouden
     van 11 (11, 22, 33) worden overgeslagen. */
  var LETTER_VALUES = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21,
    L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32,
    V: 34, W: 35, X: 36, Y: 37, Z: 38
  };

  function normalize(nr) {
    return String(nr == null ? '' : nr).toUpperCase().replace(/[\s-]/g, '');
  }
  function isContainerFormat(nr) {
    return /^[A-Z]{4}\d{7}$/.test(normalize(nr));
  }
  /* ISO 6346 controlecijfervalidatie: de eerste tien tekens wegen mee met
     machten van 2 (1, 2, 4, … 512); som mod 11, daarna mod 10, moet gelijk
     zijn aan het elfde cijfer. */
  function isoCheck(nr) {
    var s = normalize(nr);
    if (!/^[A-Z]{4}\d{7}$/.test(s)) return false;
    var sum = 0, weight = 1, i, ch, v;
    for (i = 0; i < 10; i++) {
      ch = s.charAt(i);
      v = (ch >= '0' && ch <= '9') ? (ch.charCodeAt(0) - 48) : LETTER_VALUES[ch];
      sum += v * weight;
      weight *= 2;
    }
    return (sum % 11) % 10 === (s.charCodeAt(10) - 48);
  }
  /* Grove herkenning: containerformaat (4 letters + 7 cijfers) versus een
     koeriernummer. Leeg geeft ''. */
  function detectType(nr) {
    var s = normalize(nr);
    if (!s) return '';
    return isContainerFormat(s) ? 'container' : 'koerier';
  }
  function milestonesFor(type) {
    return type === 'zeevracht' ? MILESTONES_SEA : MILESTONES_COURIER;
  }
  function milestoneLabel(type, key) {
    var list = milestonesFor(type);
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i].label;
    }
    return key || '';
  }
  function typeLabel(key) {
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].key === key) return TYPES[i].label;
    }
    return key || '';
  }

  return {
    TYPES: TYPES,
    MILESTONES_SEA: MILESTONES_SEA,
    MILESTONES_COURIER: MILESTONES_COURIER,
    CARRIERS: CARRIERS,
    CARRIER_ORDER: CARRIER_ORDER,
    normalize: normalize,
    isContainerFormat: isContainerFormat,
    isoCheck: isoCheck,
    detectType: detectType,
    milestonesFor: milestonesFor,
    milestoneLabel: milestoneLabel,
    typeLabel: typeLabel
  };
})();
