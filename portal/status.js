/* CUSTOM+ statusmotor — één bron voor de statuszinnen die het portaal
   (nextStep() in portal.html, de cockpit) en het beheer (notifyClient-
   fasemails in beheer.html) tegen de klant uitspreken. NEDERLANDS is de
   bron: portal.html haalt elke zin door i18nT()/i18nTpl(), dus de strings
   hieronder zijn tegelijk de i18n-sleutels in portal/i18n.js — wie hier
   een letter wijzigt, wijzigt óók de sleutel en moet portal/i18n.js in
   alle vier de talen meebewegen. Laden ná portal/shipping.js, in beide
   apps, vóór het hoofdscript. */
window.CP_STATUS = (function () {
  'use strict';

  var templates = {
    /* cockpit — de "volgende stap"-zinnen van nextStep(), vaste
       prioriteit: sample → factuur → vraag → foto's → niets nodig */
    sampleAwait:     'Sample {x} wacht op jouw akkoord.',
    invoiceOne:      'Er staat een factuur voor je open.',
    invoiceMany:     'Er staan {n} facturen voor je open.',
    questionWaiting: 'Je vraag ligt bij Steffan.',
    questionMeta:    '‘{q}’ — je hoort binnen 1 werkdag van hem.',
    mediaOne:        'Er staat een nieuwe foto van je product klaar.',
    mediaMany:       'Er staan {n} nieuwe foto’s van je product klaar.',
    allDone:         'Alle fases zijn afgerond — je project is klaar.',
    nothingNeeded:   'Niets nodig van jou — {fase} loopt.',

    /* fasemails — beheer.html vult hiermee de bodyLine van notifyClient
       bij fasestatus done/awaiting_approval, zodat mail en cockpit uit
       dezelfde motor spreken */
    stageDone:       '{fase} is afgerond.',
    stageAwaiting:   '{fase} wacht op jouw goedkeuring.'
  };

  /* simpele sjabloonvuller voor beheer.html (geen i18n-laag, spreekt NL);
     portal.html blijft i18nTpl gebruiken: eerst vertalen, dan vullen */
  function fill(tpl, vars) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars && vars[k] != null) ? String(vars[k]) : m;
    });
  }

  return { templates: templates, fill: fill };
})();
