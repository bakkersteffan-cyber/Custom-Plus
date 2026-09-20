/* ============================================================
   CUSTOM+ demodata — de aanvulling voor het klantportaal (migratie 0021)

   WAAROM DIT EEN APART BESTAND IS
   portal/demo-data.js is de basisseed en portal/demo-data-ia.js de
   aanvulling voor de beheer-UI; allebei zijn ze van een andere bouw en
   worden ze in deze ronde door niemand aangeraakt. Dit bestand doet voor
   het portaal wat demo-data-ia.js voor het beheer deed: het VULT
   window.CP_DEMO AAN met precies de rijen en velden die de nieuwe
   klantacties uit .claude/portaal-spec.md (hoofdstuk 1, de veertien
   regels) nodig hebben om in de demo iets te laten zien — een fase die op
   akkoord wacht, een sample dat op een beslissing wacht, een gemelde
   betaling die het beheer nog moet controleren, een bezwaar, een bestand
   van de klant, een lopende herbestelling, eigen contactpersonen en twee
   gesprekken waarin de bal aan een verschillende kant ligt. Wie de drie
   ooit wil samenvoegen, plakt de waarden hieronder in demo-data.js en
   gooit dit bestand weg — de veldnamen zijn identiek.

   HOE JE HEM LAADT
   Eén script-tag, altijd NA portal/demo-data.js en NA portal/demo-data-ia.js,
   in BEIDE apps — het beheer heeft deze rijen net zo hard nodig als het
   portaal, want de gemelde betaling, het bestand van de klant, de
   samplebeslissing en het bezwaar zijn precies de vier nieuwe Inbox-typen
   uit hoofdstuk 2 van de spec:

       <script src="portal/demo-data.js"></script>
       <script src="portal/demo-data-ia.js"></script>
       <script src="portal/demo-data-portaal.js"></script>

   Dit bestand maakt window.CP_DEMO niet zelf aan. Ontbreekt demo-data-ia.js,
   dan draait het toch: de collecties die het nodig heeft (questionMessages,
   auditLog) maakt het zelf aan als ze er niet zijn. Alleen de draden q-01
   t/m q-05 komen dan niet mee, want die zijn van demo-data-ia.js.

   OOK OP EEN BESTAANDE OPSLAG — DE VALKUIL, EN HET HAAKJE ERTEGEN
   De demomodus leest bij het opstarten eerst localStorage (sleutel
   cp_portal_demo_v1, gedeeld door portaal én beheer) en pas als dat leeg is
   de seed. Wie al met de demo heeft gewerkt, ziet de rijen hieronder dus
   NIET vanzelf: de schema-drift-aanvulling van portal.html vult alleen een
   vaste lijst collecties aan die helemaal ontbreken, en de zes nieuwe
   (questionMessages, reorderRequests, clientContacts, invoicePayments,
   invoiceAudit, auditLog) staan niet in die lijst. beheer.html lost dat voor
   demo-data-ia.js op door na het inlezen van localStorage expliciet
   CP_DEMO_IA.toepassen(state) aan te roepen. Doe voor dit bestand hetzelfde:

       if (window.CP_DEMO_PORTAAL) window.CP_DEMO_PORTAAL.toepassen(state);

   Dat is veilig, want toepassen() vult alleen aan (zie IDEMPOTENT). Zie je
   de standen hieronder niet, wis dan de demo-opslag; dat is geen fout in
   deze seed.

   WAT HIJ AANVULT — met exact de veldnamen uit supabase/portal/0021_portaal_acties.sql,
   daar in snake_case, hier in camelCase (dat is wat camelRow()/camelRij()
   van een Supabase-rij maakt):
     A  fases            → stages[].approvedBy, approvedVia ('portaal'|'beheer'|null)
                           + ÉÉN fase op 'awaiting_approval' (zie de uitzondering)
     B  samplerondes     → samples[].clientDecision ('goedgekeurd'|'aanpassing'|null),
                           clientNote, clientDecidedAt, clientMarks [{x, y, tekst}]
                           + een nieuwe ronde op 'reviewed' die op de klant wacht
     C  betalingen       → demo.invoicePayments (reportedByClient, clientReference,
                           verifiedAt) + demo.invoiceAudit; een factuur met
                           statusCode 'disputed' en reminderPaused
     D  documenten       → documents[].uploadedBy ('staf'|'klant'), clientNote,
                           slotId; docSlots[] met expectedFrom (zie hieronder)
     E  herbestelling    → demo.reorderRequests (tabel reorder_requests)
     F  contactpersonen  → demo.clientContacts (tabel client_contacts) +
                           clients[].portalLang / mailPrefs (0005, nu klant-schrijfbaar)
     G  gesprekken       → questions[] + questionMessages[] (0020)
     H  logboeken        → accessLog[] (klantzichtbaar) en demo.auditLog
                           (kind 'klant'): per klantactie dezelfde twee
                           regels die portaal_log() in 0021 schrijft, met
                           woordelijk dezelfde tekst

   TWEE DINGEN DIE 0021 SINDS DE KETENFIX WÉL KENT, EN ÉÉN DAT HET NIET KENT
     1. docSlots[].expectedFrom ('klant'|'staf') is de kolom
        doc_slots.expected_from (0021 blok 2, standaard 'staf'). De
        insertpolicy voor klantuploads eist 'klant' en de datalaag weigert
        een stafslot met slot_niet_van_klant; portal/portaal-model.js leest
        hetzelfde veld, met als terugval het documenttype (logo, artwork,
        specificatie). Elk slot in de seed draagt het veld expliciet.
     2. docType 'artwork' en 'specificatie'. De check op documents.doc_type
        (0001) en doc_slots.doc_type (0005) kende alleen nnn, quote, invoice,
        inspection, compliance, shipping en other; 0021 blok 5 verruimt hem
        met logo, artwork en specificatie (KLANT_DOC_TYPES), zodat deze seed
        ook live geldig is.
     3. De vorm van een markering. 0021 eist alleen "een array van objecten"
        en noemt als voorbeeld {x, y, note}; het actiecontract van deze ronde
        zegt {x, y, tekst}. Deze seed volgt het contract. x en y zijn
        breukdelen (0–1) van de foto, zoals het kolomcommentaar voorschrijft.

   IDEMPOTENT
   toepassen() twee keer aanroepen verandert de tweede keer niets:
     · een veld wordt alleen gezet als het nog niet BESTAAT (typeof
       undefined); een veld met een waarde — ook '' of null — blijft staan;
     · een record wordt alleen toegevoegd als er nog geen record met dat id
       in de lijst staat;
     · elke waarde wordt gekopieerd voordat hij in de staat komt, zodat twee
       records nooit dezelfde array delen.
   DE ENE UITZONDERING. De opdracht ging ervan uit dat er al een fase op
   "wacht op akkoord" in de seed staat. Dat is niet zo: demo-data.js kent
   alleen done, current en upcoming. Zonder zo'n fase heeft akkoordGeven()
   in de demo geen doel en blijft "Wat we van jou nodig hebben" zonder
   akkoord-item. Daarom zet blok A de fase production van het diffuservat
   ÉÉN keer van 'current' naar 'awaiting_approval' — uitsluitend als die
   fase nog exact de basisstand van demo-data.js heeft (status 'current',
   geen approvedAt, nog nooit door deze seed gestempeld). Is de eigenaar
   daar intussen zelf aan geweest, dan blijft alles staan. Een tweede
   aanroep vindt de fase gestempeld en doet niets.

   BIJNA GEEN BESTANDEN IN DEZE SEED
   Het aangeleverde bestand van de klant (doc-10) draagt naam, grootte en
   type maar geen fileRef en geen bytes: een seed draagt geen blobs, en een
   verzonnen sleutel zou de UI naar een bestand laten zoeken dat nergens
   staat. Het portaal toont dan zijn nette "bestand niet beschikbaar"-
   terugval, dezelfde stand als bij de aanvraagbijlagen in demo-data-ia.js.
   avatarUrl van elke contactpersoon blijft leeg: initialen.

   WELKE STANDEN DEZE SEED BEWUST DEKT
     · fase goedgekeurd VIA HET PORTAAL (diffuser tooling: Noor van Dijk,
       portaal), via het BEHEER (diffuser concept/dfm/sourcing: de eigenaar
       legde haar akkoord per mail vast) en van VÓÓR 0021 (geurflacon:
       approvedBy '' en approvedVia null — eerlijk onbekend, geen naam)
     · fase op WACHT OP AKKOORD (diffuser production), met de logregel
       waaruit het portaal en het beheer "sinds wanneer" afleiden
     · sampleronde met beslissing AANPASSING + opmerking + één markering
       (T1), met GOEDGEKEURD (T2, de golden sample), zonder beslissing
       omdat de staf hem zelf verdrong (T0), en een nieuwe ronde P1 die op
       de klant WACHT (reviewed, clientDecision null)
     · gemelde betaling op inv-04 die NOG NIET is geverifieerd — het item
       dat in de beheer-Inbox onder "betaling gemeld" hoort; de factuur
       zelf blijft open, want een melding is geen boeking
     · factuur met BEZWAAR (inv-05, meerwerk) met de reden op de drie
       plekken waar 0021 hem zet: invoiceAudit, auditLog en accessLog
     · gevuld slot met een bestand VAN DE KLANT (geurflacon, artwork) én een
       leeg slot dat op de klant WACHT (diffuser, specificatie) — allebei de
       kanten van bestandAanleveren(); de twee bestaande slots blijven van
       de staf (expectedFrom 'staf')
     · herbestelling op STAP 2 (offerte) van het gearchiveerde geurflacon-
       project, met wijziging, gekoppeld aan het aangeleverde artwork
     · twee contactpersonen per klant met verschillende mailcategorieën,
       per klant één met canLogin — en de eerlijkheidseis uit 0021: dat
       veld is een WENS, geen account
     · een gesprek waarin STEFFAN het laatst sprak (q-06: de klant is aan
       zet, en het gevraagde staat als slot klaar) en een beantwoord gesprek
       waarin de KLANT daarna nog iets zei (q-07: de oude kolommen zeggen
       "beantwoord", de draad zegt "wacht op Steffan")

   DE TOON VAN DE INHOUD
   Dit is een DEMOSEED: de waarden zijn verzonnen, maar realistisch voor
   een bureau dat maatwerk in China laat maken, en ze vertellen hetzelfde
   verhaal als de rest van de demo (de doffe schouder van T1, de polijstronde
   op de mal, batch A op zee, de laatste 15%). In de live modus komt geen
   letter hiervan mee: daar staat elk veld leeg tot een klant het zelf doet.
   ============================================================ */
(function(){
  'use strict';

  var VERSION = '1.0.0';

  /* ---------- gereedschap (zelfde recept als demo-data-ia.js) ---------- */

  function isLijst(v){
    return Object.prototype.toString.call(v) === '[object Array]';
  }

  /* Diepe kopie van een seedwaarde; JSON.parse(JSON.stringify()) zou een
     undefined stilletjes laten verdwijnen, dit blijft voorspelbaar. */
  function kopie(v){
    var uit, i, k;
    if(v === null || typeof v !== 'object') return v;
    if(isLijst(v)){
      uit = [];
      for(i = 0; i < v.length; i++) uit.push(kopie(v[i]));
      return uit;
    }
    uit = {};
    for(k in v){
      if(Object.prototype.hasOwnProperty.call(v, k)) uit[k] = kopie(v[k]);
    }
    return uit;
  }

  /* Vult ontbrekende velden aan op één record. Met opzet "typeof undefined"
     en niet "leeg of null": een bewuste null (geen beslissing, geen kanaal)
     moet blijven staan en mag door een tweede aanroep niet alsnog gevuld
     worden. */
  function vulAan(rec, velden){
    var k;
    if(!rec || typeof rec !== 'object') return rec;
    for(k in velden){
      if(!Object.prototype.hasOwnProperty.call(velden, k)) continue;
      if(typeof rec[k] === 'undefined') rec[k] = kopie(velden[k]);
    }
    return rec;
  }

  /* Record op id; null als de lijst of het record ontbreekt. Bewust geen
     fout: een oudere demo-opslag mag een collectie missen. */
  function zoek(lijstIn, id){
    var i;
    if(!isLijst(lijstIn)) return null;
    for(i = 0; i < lijstIn.length; i++){
      if(lijstIn[i] && lijstIn[i].id === id) return lijstIn[i];
    }
    return null;
  }

  /* Zorgt dat demo[sleutel] een array is en geeft hem terug. */
  function lijst(demo, sleutel){
    if(!isLijst(demo[sleutel])) demo[sleutel] = [];
    return demo[sleutel];
  }

  /* Voegt een record toe zolang er nog geen record met dat id staat. */
  function voegToe(doel, rec){
    if(!rec || !rec.id) return;
    if(zoek(doel, rec.id)) return;
    doel.push(kopie(rec));
  }

  /* Fases hebben in de demo geen eigen id: ze zitten genest onder het
     project en heten naar hun sleutel. Dat is ook hoe de datalaag ze in
     demomodus aanwijst (projectId + stageKey). */
  function zoekFase(project, stageKey){
    var i, st;
    if(!project || !isLijst(project.stages)) return null;
    for(i = 0; i < project.stages.length; i++){
      st = project.stages[i];
      if(st && st.stageKey === stageKey) return st;
    }
    return null;
  }

  /* ---------- H. DE LOGSCHRIJVER ---------- */
  /* Elke klantactie laat live twee sporen na (portaal_log() in 0021): een
     regel in access_log — de tijdlijn die de klant zelf leest — en een regel
     in admin_audit_log met kind 'klant', zodat het beheer de klantacties als
     eigen soort kan filteren. Hier precies hetzelfde, met dezelfde tekst,
     zodat demo en live dezelfde tijdlijn tonen. De id's zijn vast (geen
     Date.now()), anders zou een tweede aanroep een tweede regel maken. */
  function klantActie(demo, a){
    voegToe(lijst(demo, 'accessLog'), {
      id: a.logId, projectId: a.projectId, actor: 'client',
      assetKind: a.assetKind, assetId: a.assetId || null, action: a.action,
      detail: a.detail, createdAt: a.at
    });
    voegToe(lijst(demo, 'auditLog'), {
      id: a.audId, kind: 'klant', clientId: a.clientId, projectId: a.projectId,
      detail: a.detail, createdAt: a.at
    });
  }

  /* De Nederlandse fasenaam voor logregels: kopie van stage_label_nl() in
     0021 en van STAGES in beheer.html. Het beheer toont de regel letterlijk,
     dus hier hoort de naam en niet de sleutel. */
  var FASE_NAAM = {
    concept:    'Concept & Industrieel Ontwerp',
    dfm:        'Ontwerp voor Produceerbaarheid',
    sourcing:   'Fabriekssourcing & Screening',
    tooling:    'Tooling, Sampling & Iteratie',
    production: 'Massaproductie & Kwaliteitscontrole',
    logistics:  'Compliance & Logistiek'
  };

  var NOOR = 'Noor van Dijk';
  var NOOR_MAIL = 'noor@ateliernoor.nl';

  /* ---------- A. FASES: WIE GAF AKKOORD, EN LANGS WELKE WEG ---------- */
  /* approved_at bestond al; 0021 zet er approved_by en approved_via naast.
     Drie herkomsten, alle drie in de seed:
       · 'portaal'  — de klant klikte zelf akkoord (approve_stage). Diffuser
                      tooling: Noor keurde op 21 juli de golden sample T2
                      goed en daarmee de toolingfase; de datum staat al als
                      approvedAt in demo-data.js, hier komen naam en kanaal.
       · 'beheer'   — de eigenaar zette de fase op done in het beheer en
                      legde de naam vast. Diffuser concept, dfm en sourcing:
                      Noor gaf toen per mail akkoord en Steffan typte het over.
       · null + ''  — van vóór 0021: onbekend. Het hele geurflacon-project
                      (2025) en de twee nog niet afgeronde projecten. Geen
                      verzonnen naam; het beheer toont dan geen "door".

     DE UITZONDERING (zie kopblok): diffuser production gaat één keer van
     'current' naar 'awaiting_approval'. Het verhaal klopt met de rest van
     de seed: de IPQC van batch A is op 26 augustus goed doorgekomen, op 27
     augustus publiceerde het beheer de factuur voor de laatste 15% (inv-04,
     fase logistics) en zette het de productiefase op wacht op akkoord. Het
     beheer schrijft bij zo'n wissel altijd de regel 'Fasestatus gewijzigd:
     <fasenaam> → Wacht op akkoord' in het toegangslogboek (setStageStatus);
     portaal en beheer lezen daar "sinds wanneer" uit terug. Die regel wordt
     alleen geschreven als de wissel hier ook echt gebeurt — anders zou hij
     over een stand spreken die de eigenaar zelf al anders heeft gezet. */
  function fases(demo){
    var diff = zoek(demo.projects, 'prj-diffuser');
    var prod = zoekFase(diff, 'production');
    var i, j, p, st;

    if(prod && typeof prod.approvedBy === 'undefined' && prod.status === 'current' && !prod.approvedAt){
      prod.status = 'awaiting_approval';
      voegToe(lijst(demo, 'accessLog'), {
        id: 'log-p04', projectId: 'prj-diffuser', actor: 'staff',
        assetKind: 'system', assetId: null, action: 'update',
        detail: 'Fasestatus gewijzigd: ' + FASE_NAAM.production + ' → Wacht op akkoord',
        createdAt: '2026-08-27T09:40:00Z'
      });
    }

    if(diff){
      vulAan(zoekFase(diff, 'concept'),  { approvedBy: NOOR, approvedVia: 'beheer' });
      vulAan(zoekFase(diff, 'dfm'),      { approvedBy: NOOR, approvedVia: 'beheer' });
      vulAan(zoekFase(diff, 'sourcing'), { approvedBy: NOOR, approvedVia: 'beheer' });
      vulAan(zoekFase(diff, 'tooling'),  { approvedBy: NOOR, approvedVia: 'portaal' });
    }

    /* alle overige fases van alle projecten: de databasestandaard
       (approved_by '' not null, approved_via null) — eerlijk onbekend */
    for(i = 0; i < demo.projects.length; i++){
      p = demo.projects[i];
      if(!p || !isLijst(p.stages)) continue;
      for(j = 0; j < p.stages.length; j++){
        st = p.stages[j];
        if(st) vulAan(st, { approvedBy: '', approvedVia: null });
      }
    }

    /* de activiteitregel van het portaalakkoord op tooling — de tekst is
       die van approve_stage(): 'Fase goedgekeurd door <naam>: <fasenaam>' */
    if(diff && zoekFase(diff, 'tooling')){
      klantActie(demo, {
        logId: 'log-p03', audId: 'aud-p03',
        projectId: 'prj-diffuser', clientId: 'cli-noor',
        assetKind: 'stage', assetId: null, action: 'approve',
        detail: 'Fase goedgekeurd door ' + NOOR + ': ' + FASE_NAAM.tooling,
        at: '2026-07-21T10:44:00Z'
      });
    }
  }

  /* ---------- B. SAMPLERONDES: DE KLANTBESLISSING ---------- */
  /* status ('reviewed' | 'approved' | 'superseded') blijft het stafveld;
     de klantbeslissing staat ernaast en blijft staan, óók als de staf later
     een nieuwe ronde maakt — zo ziet het beheer altijd wat de klant zei.

       · T1 (smp-t1): AANPASSING. Het verhaal staat al in de seed: q-01 gaat
         over de doffe plek op de schouder van T1, Steffan antwoordde dat T2
         een polijstronde krijgt, en op 27 juni legde Noor het formeel vast:
         aanpassing, met één aanwijzing op de foto (med-05, de schouder).
         De staf verdrong T1 daarna zelf met T2; de status is dus
         'superseded' en dat blijft zo — de beslissing is geschiedenis.
       · T2 (smp-t2): GOEDGEKEURD op 21 juli, vier minuten vóór het akkoord
         op de toolingfase (blok A). decide_sample zet de ronde dan op
         approved; dat staat hij al.
       · T0 en de twee geurflaconrondes: null/''/null/[] — de databasestandaard.
         T0 is nooit aan Noor voorgelegd (de staf verdrong hem zelf) en de
         geurflacon is van vóór 0021: "door jou goedgekeurd" in die notitie
         ging per mail, er is geen vastgelegde beslissing.
       · P1 (smp-p1): NIEUW en WACHT OP DE KLANT. Batch A is op zee; wat er
         tijdens de productie nog te beoordelen valt is de verpakking. Dit
         is de eerste proefdruk van de geschenkdoos, door Steffan beoordeeld
         (status reviewed) en zonder klantbeslissing — het item dat in
         "Wat we van jou nodig hebben" bovenaan komt en in de beheer-Inbox
         onder "wacht op klant". De foto (med-10) verwijst naar een bestaand
         sitebeeld, zoals elke foto in de demo. Geen decisionDue: 0021 kent
         geen beslisdatum op een ronde en een verzonnen datum is erger dan
         geen datum.

     De logregels zijn woordelijk die van decide_sample(): bij aanpassing
     eindigt hij op '(1 aanwijzing(en) op de foto)', precies zoals de
     functie hem samenstelt. */
  function samples(demo){
    var s = lijst(demo, 'samples');
    var t1 = zoek(s, 'smp-t1');
    var t2 = zoek(s, 'smp-t2');
    var i;

    var T1_NOTE = 'De klik en de maat zijn goed. De schouder is nog dof en dat valt naast het '
                + 'referentievat meteen op; die moet glanzend worden zoals in de render.';
    var T2_NOTE = 'Precies zoals de render, ook op de schouder. Dit is hem.';

    if(t1){
      vulAan(t1, {
        clientDecision: 'aanpassing',
        clientNote: T1_NOTE,
        clientDecidedAt: '2026-06-27T08:15:00Z',
        clientMarks: [ { x: 0.52, y: 0.36, tekst: 'Hier is de schouder nog dof' } ]
      });
      klantActie(demo, {
        logId: 'log-p01', audId: 'aud-p01',
        projectId: 'prj-diffuser', clientId: 'cli-noor',
        assetKind: 'sample', assetId: 'smp-t1', action: 'decide',
        detail: 'Sample T1: aanpassing gevraagd door klant — ' + T1_NOTE + ' (1 aanwijzing(en) op de foto)',
        at: '2026-06-27T08:15:00Z'
      });
    }

    if(t2){
      vulAan(t2, {
        clientDecision: 'goedgekeurd',
        clientNote: T2_NOTE,
        clientDecidedAt: '2026-07-21T10:40:00Z',
        clientMarks: []
      });
      klantActie(demo, {
        logId: 'log-p02', audId: 'aud-p02',
        projectId: 'prj-diffuser', clientId: 'cli-noor',
        assetKind: 'sample', assetId: 'smp-t2', action: 'decide',
        detail: 'Sample T2 goedgekeurd door klant — ' + T2_NOTE,
        at: '2026-07-21T10:40:00Z'
      });
    }

    /* de nieuwe ronde, en de foto waar hij naar wijst */
    voegToe(lijst(demo, 'media'), {
      id: 'med-10', projectId: 'prj-diffuser', stageKey: 'production', kind: 'photo',
      src: 'images/occ-renewal.jpg',
      caption: 'Proefdruk P1 van de geschenkdoos, naast het golden sample.',
      factoryId: 'fac-chen', capturedAt: '2026-09-03'
    });
    voegToe(s, {
      id: 'smp-p1', projectId: 'prj-diffuser', roundLabel: 'P1', mediaId: 'med-10',
      status: 'reviewed',
      note: 'Eerste proefdruk van de geschenkdoos: mat zwart karton, blinddruk van het logo op '
          + 'het deksel. Kleur en positie graag beoordelen; de binnenzijde volgt in P2.',
      roundDate: '2026-09-04',
      clientDecision: null, clientNote: '', clientDecidedAt: null, clientMarks: []
    });

    /* alle overige rondes: de databasestandaard */
    for(i = 0; i < s.length; i++){
      if(s[i]) vulAan(s[i], { clientDecision: null, clientNote: '', clientDecidedAt: null, clientMarks: [] });
    }
  }

  /* ---------- C. BETALINGEN: GEMELD, EN BETWIST ---------- */
  /* Twee facturen, twee verschillende wachtstanden, bewust niet op dezelfde
     rij — een melding en een bezwaar op één factuur zouden elkaar in de
     Inbox in de weg zitten.

     DE GEMELDE BETALING (inv-04, de laatste 15%). Op 27 augustus wilde Noor
     nog wachten tot batch A in Rotterdam stond (cm-01 in demo-data-ia.js);
     op 28 augustus bevestigde Maersk het venster, en op 4 september meldde
     ze in het portaal dat ze op 3 september had overgemaakt. De rij staat
     in invoicePayments met reportedByClient true en verifiedAt NULL: een
     VOORSTEL, geen boeking. De factuur zelf verandert daarom niet — geen
     paidCents, geen status — want recalc_invoice_settlement() telt een
     onbevestigde melding niet mee (0021, blok 7). Pas als het beheer
     verify_payment_report() aanroept, wordt hij betaald. Dit is het item
     voor de beheer-Inbox "betaling gemeld — controleren".
     De velden zijn die van invoice_payments (0008/0012) plus de drie uit
     0021; createdBy volgt het patroon 'klant:<mail>' van report_payment().
     Geen betaalbewijs (proof*), geen interne notitie: dat is stafwerk.

     HET BEZWAAR (inv-05, NIEUW). Tussen T1 en T2 heeft Toolmaker Wei de mal
     gepolijst; het beheer stuurde daar op 28 juli een meerwerkfactuur voor.
     Noor vindt dat dat in de toolingprijs zat en maakte op 1 september
     bezwaar. dispute_invoice() zet statusCode op 'disputed', pauzeert de
     herinneringen en schrijft de reden op drie plekken (invoiceAudit met
     event 'bezwaar_klant', auditLog, accessLog) — hier alle drie, met
     dezelfde tekst. De factuur blijft OPEN (het geld is niet
     kwijtgescholden), maar het portaal vraagt er niet meer om: de bal ligt
     bij Steffan. fromStatus is 'overdue': de vervaldatum (27 augustus) was
     al verstreken toen het bezwaar kwam.
     De rij draagt de golf-1-velden (status 'open', amountCents) én de
     factuurmodulevelden die het portaal en de statusvertaler lezen
     (statusCode, dueDate, paidCents, creditedCents, outstandingCents).
     Geen invoiceNumber: de andere demofacturen hebben er ook geen, en een
     verzonnen nummer zou de nummeringswaakhond van het beheer tegenspreken.
     Alle bedragen in centen. */
  function betalingen(demo){
    var inv = lijst(demo, 'invoices');
    var REDEN = 'De polijstronde van de mal stond niet als meerwerk in de offerte van 6 april. '
              + 'Volgens die offerte zat het afwerken van de mal tot een goedgekeurd golden sample '
              + 'in de toolingprijs. Graag eerst overleg voor ik dit betaal.';
    var LABEL_05 = 'Meerwerk — polijstronde mal (T2)';
    var KENMERK = 'REQ 0402 laatste 15%';

    /* de betwiste factuur */
    voegToe(inv, {
      id: 'inv-05', projectId: 'prj-diffuser', stageKey: 'tooling',
      label: LABEL_05, amountCents: 42000, currency: 'EUR',
      status: 'open', paidAt: null, createdAt: '2026-07-28', documentId: null,
      docKind: 'invoice', statusCode: 'disputed', invoiceNumber: '',
      invoiceDate: '2026-07-28', paymentTermDays: 30, dueDate: '2026-08-27',
      publishStatus: 'published', publishedAt: '2026-07-28T14:05:00Z',
      totalInclCents: 42000, paidCents: 0, creditedCents: 0, outstandingCents: 42000,
      reminderPaused: true, updatedAt: '2026-09-01T09:05:00Z'
    });
    voegToe(lijst(demo, 'invoiceAudit'), {
      id: 'iau-p01', invoiceId: 'inv-05', event: 'bezwaar_klant',
      fromStatus: 'overdue', toStatus: 'disputed', detail: REDEN, changes: null,
      aiUsed: false, aiModel: '', actor: NOOR_MAIL, createdAt: '2026-09-01T09:05:00Z'
    });
    klantActie(demo, {
      logId: 'log-p06', audId: 'aud-p07',
      projectId: 'prj-diffuser', clientId: 'cli-noor',
      assetKind: 'invoice', assetId: 'inv-05', action: 'dispute',
      detail: 'Bezwaar op factuur ' + LABEL_05 + ': ' + REDEN,
      at: '2026-09-01T09:05:00Z'
    });

    /* de gemelde, nog niet geverifieerde betaling — alleen als de factuur
       waar hij op wijst er is; een melding zonder factuur is een wees */
    if(zoek(inv, 'inv-04')){
      voegToe(lijst(demo, 'invoicePayments'), {
        id: 'pay-p01', invoiceId: 'inv-04', paidOn: '2026-09-03', amountCents: 187500,
        currency: 'EUR', method: 'overboeking', transactionRef: '', internalNote: '',
        reportedByClient: true, clientReference: KENMERK, verifiedAt: null,
        provider: '', providerEventId: '',
        createdBy: 'klant:' + NOOR_MAIL, createdAt: '2026-09-04T10:15:00Z'
      });
      voegToe(lijst(demo, 'invoiceAudit'), {
        id: 'iau-p02', invoiceId: 'inv-04', event: 'betaling_gemeld',
        fromStatus: 'finalized', toStatus: 'finalized',
        detail: 'Klant meldt betaling van € 1.875,00 op 3 sep 2026, kenmerk ' + KENMERK,
        changes: null, aiUsed: false, aiModel: '', actor: NOOR_MAIL,
        createdAt: '2026-09-04T10:15:00Z'
      });
      klantActie(demo, {
        logId: 'log-p08', audId: 'aud-p11',
        projectId: 'prj-diffuser', clientId: 'cli-noor',
        assetKind: 'invoice', assetId: 'inv-04', action: 'report_payment',
        detail: 'Betaling gemeld op factuur 15% — pre-shipment QC: € 1.875,00 op 3 sep 2026, kenmerk ' + KENMERK,
        at: '2026-09-04T10:15:00Z'
      });
    }
  }

  /* ---------- D. DOCUMENTEN EN SLOTS: HET BESTAND VAN DE KLANT ---------- */
  /* uploaded_by zegt uit welke bucket het bestand komt en wie het aanleverde;
     de standaard 'staf' maakt van elk bestaand document een stafdocument,
     en dat stempelt deze seed hier ook op elke rij zonder het veld — een
     document zonder uploadedBy is per definitie van vóór 0021 of uit het
     beheer. slotId is de nieuwe verwijzing van document naar slot (0021
     legt uit waarom die andersom nodig was dan doc_slots.document_id).

     TWEE SLOTS VAN DE KLANT, TWEE STANDEN:
       · slot-03 (geurflacon, artwork) is GEVULD: de herbestelling van blok E
         is "met wijziging" — het etiket in de nieuwe huisstijl — en Steffan
         zette daarom op 2 september een slot klaar; op 3 september leverde
         Noor het aan, met opmerking. Het document draagt uploadedBy 'klant',
         clientNote en slotId; het slot wijst terug (documentId, gevuld).
         Dat is precies wat de trigger documents_fill_slot() live doet.
       · slot-04 (diffuser, specificatie) is LEEG en wacht op de klant: in
         gesprek q-06 (blok G) vroeg Steffan om het afleveradres, een
         contactpersoon en de venstertijden voor batch A. Dit is het doel
         van bestandAanleveren() in de demo, en het item "lever je
         specificatie aan" in "Wat we van jou nodig hebben".
     De twee bestaande slots (slot-01 compliance, slot-02 offerte) zijn wat
     STEFFAN levert; demo-data.js zet er sinds de ketenfix zelf expectedFrom
     'staf' op en hier gebeurt dat nog eens op id (voor een oudere opslag),
     niet generiek: een slot dat de eigenaar later aanmaakt hoort die keuze
     zelf te dragen en niet stil door deze seed gestempeld te worden.
     Het bestand zelf: naam, grootte en type zoals addDocument() ze in de
     demo neerzet, maar geen fileRef — zie "bijna geen bestanden". */
  function documenten(demo){
    var docs = lijst(demo, 'documents');
    var slots = lijst(demo, 'docSlots');
    var i;
    var TITEL = 'Etiket amberflacon — nieuwe huisstijl';
    var NOTE = 'Dit is de definitieve versie. Achtergrond in Pantone 7527 C, tekst in zwart; '
             + 'de maat is gelijk aan het oude etiket.';

    vulAan(zoek(slots, 'slot-01'), { expectedFrom: 'staf' });
    vulAan(zoek(slots, 'slot-02'), { expectedFrom: 'staf' });

    voegToe(slots, {
      id: 'slot-03', projectId: 'prj-geurflacon', docType: 'artwork', stageKey: 'sourcing',
      status: 'gevuld', documentId: 'doc-10', expectedFrom: 'klant',
      createdAt: '2026-09-02T14:32:00Z'
    });
    voegToe(docs, {
      id: 'doc-10', projectId: 'prj-geurflacon', stageKey: 'sourcing', docType: 'artwork',
      title: TITEL, version: 1, shipmentId: null,
      fileRef: null, fileName: 'etiket-amberflacon-huisstijl.pdf', fileSize: 1264000,
      mimeType: 'application/pdf', publishStatus: 'published',
      uploadedBy: 'klant', clientNote: NOTE, slotId: 'slot-03',
      createdAt: '2026-09-03T09:48:00Z'
    });
    klantActie(demo, {
      logId: 'log-p07', audId: 'aud-p10',
      projectId: 'prj-geurflacon', clientId: 'cli-noor',
      assetKind: 'document', assetId: 'doc-10', action: 'upload',
      detail: 'Bestand aangeleverd door klant: ' + TITEL + ' — ' + NOTE,
      at: '2026-09-03T09:48:00Z'
    });

    voegToe(slots, {
      id: 'slot-04', projectId: 'prj-diffuser', docType: 'specificatie', stageKey: 'logistics',
      status: 'verwacht', documentId: null, expectedFrom: 'klant',
      createdAt: '2026-09-04T09:08:00Z'
    });

    /* alle overige documenten: de databasestandaard */
    for(i = 0; i < docs.length; i++){
      if(docs[i]) vulAan(docs[i], { uploadedBy: 'staf', clientNote: '', slotId: null });
    }
  }

  /* ---------- E. HERBESTELLING: DE VIERSTAPSPIJPLIJN ---------- */
  /* Vroeger was een herbestelling een vraag met het voorvoegsel
     HERBESTELLING: en leefde de pijplijnstand in settings.reorderPipeline;
     0021 maakt er een echte rij van. De vier statussen zijn de sleutels van
     REORDER_STAGES (aanvraag, offerte, akkoord, project) — opgeslagen
     waarden, niet hernoemen.
     ro-01 staat op STAP 2: Noor vroeg op 31 augustus 3.000 stuks van de
     amberglazen flacon aan, met wijziging (het etiket), en Steffan schoof
     hem op 2 september door naar offerte (updatedAt). Zo toont het portaal
     de pijplijnstand en de beheer-Inbox een aanvraag die al is opgepakt.
     wantedBy ligt na de aanvraagdatum en binnen drie jaar, zoals
     request_reorder() het eist. clientId staat er apart op, zodat "mijn
     herbestellingen" één filter is (0021). De logregel is die van de
     trigger reorder_requests_log(). */
  function herbestelling(demo){
    var WIJZIGING = 'Zelfde flacon en dop, maar het etiket in onze nieuwe huisstijl (nieuwe '
                  + 'achtergrondkleur, zelfde maat). De pomp blijft ongewijzigd.';
    voegToe(lijst(demo, 'reorderRequests'), {
      id: 'ro-01', projectId: 'prj-geurflacon', clientId: 'cli-noor',
      qty: 3000, wantedBy: '2026-11-20', sameSpec: false, changeNote: WIJZIGING,
      status: 'offerte',
      createdAt: '2026-08-31T10:12:00Z', updatedAt: '2026-09-02T14:30:00Z'
    });
    klantActie(demo, {
      logId: 'log-p05', audId: 'aud-p06',
      projectId: 'prj-geurflacon', clientId: 'cli-noor',
      assetKind: 'reorder', assetId: 'ro-01', action: 'reorder',
      detail: 'Herbestelling aangevraagd: 3000 stuks, gewenst op 20 nov 2026, met wijziging: ' + WIJZIGING,
      at: '2026-08-31T10:12:00Z'
    });
  }

  /* ---------- F. CONTACTPERSONEN EN VOORKEUREN VAN DE KLANT ---------- */
  /* client_contacts is de lijst die de KLANT zelf beheert, bewust apart van
     admin_contacts (de staflijst; ct-01 Rens de Boer blijft daar staan en
     komt hier niet nog eens in). Twee per klant, met verschillende
     mailcategorieën uit de zes die notifyClient kent (fase, update, sample,
     zending, factuur, relatie), en per klant precies één met canLogin —
     zodat het scherm beide standen toont.
     canLogin is een WENS: het maakt geen account aan en geeft geen toegang
     (inloggen loopt via Supabase Auth en de uitnodiging door de staf). Het
     portaal hoort dat er bij te zeggen; deze seed belooft niets.
     role is vrije tekst in de woorden van de klant, en Fjell Outdoor
     schrijft Engels: dat veld wordt niet vertaald, en zo zie je dat ook.
     De auditregels zijn die van de trigger client_contacts_log(): alleen
     auditLog, geen accessLog, want een contactpersoon hangt aan de klant
     en niet aan een project.

     Daarnaast de twee klantvoorkeuren uit 0005 die 0021 klant-schrijfbaar
     maakt (taalKiezen, meldingenOpslaan): portalLang en mailPrefs. Noor
     leest Nederlands; Fjell Outdoor is Noors en gebruikt het portaal in
     het Engels. mailPrefs is de map {categorie: false} van uitgezette
     categorieën — leeg betekent: alles aan, de standaard. */
  function contactpersonen(demo){
    var doel = lijst(demo, 'clientContacts');
    var audit = lijst(demo, 'auditLog');
    var mensen = [
      {
        id: 'cc-01', clientId: 'cli-noor', name: 'Sanne Vermeulen', email: 'sanne@ateliernoor.nl',
        role: 'Operations & inkoop', mailCategories: ['fase', 'sample', 'zending'],
        canLogin: true, avatarUrl: '',
        createdAt: '2026-08-30T15:20:00Z', updatedAt: '2026-08-30T15:20:00Z', audId: 'aud-p04'
      },
      {
        id: 'cc-02', clientId: 'cli-noor', name: 'Iris Molenaar', email: 'iris@ateliernoor.nl',
        role: 'Marketing & content', mailCategories: ['update'],
        canLogin: false, avatarUrl: '',
        createdAt: '2026-08-30T15:24:00Z', updatedAt: '2026-08-30T15:24:00Z', audId: 'aud-p05'
      },
      {
        id: 'cc-03', clientId: 'cli-fjell', name: 'Ingrid Solberg', email: 'ingrid@fjelloutdoor.no',
        role: 'Purchasing', mailCategories: ['fase', 'factuur'],
        canLogin: true, avatarUrl: '',
        createdAt: '2026-09-02T11:40:00Z', updatedAt: '2026-09-02T11:40:00Z', audId: 'aud-p08'
      },
      {
        id: 'cc-04', clientId: 'cli-fjell', name: 'Erik Haugen', email: 'erik@fjelloutdoor.no',
        role: 'Product design', mailCategories: ['sample', 'update'],
        canLogin: false, avatarUrl: '',
        createdAt: '2026-09-02T11:43:00Z', updatedAt: '2026-09-02T11:43:00Z', audId: 'aud-p09'
      }
    ];
    var i, m, rec;
    for(i = 0; i < mensen.length; i++){
      m = mensen[i];
      rec = kopie(m);
      delete rec.audId; /* hulpveld van deze seed, geen kolom */
      voegToe(doel, rec);
      voegToe(audit, {
        id: m.audId, kind: 'klant', clientId: m.clientId, projectId: null,
        detail: 'Contactpersoon toegevoegd door klant: ' + m.name + ' <' + m.email + '>',
        createdAt: m.createdAt
      });
    }

    vulAan(zoek(demo.clients, 'cli-noor'),  { portalLang: 'nl', mailPrefs: {} });
    vulAan(zoek(demo.clients, 'cli-fjell'), { portalLang: 'en', mailPrefs: {} });
  }

  /* ---------- G. GESPREKKEN: WIE IS AAN ZET ---------- */
  /* demo-data-ia.js levert al draden waarin de klant het laatst sprak (q-03,
     q-05). Wat het portaal daarnaast moet kunnen tonen, komt hier bij:
       · q-06 — Steffan sprak het LAATST, dus de klant is aan zet. Noor vroeg
         of batch A rechtstreeks naar hun fulfilmentcentrum kan; Steffan zei
         ja en vroeg om adres, contactpersoon en venstertijden. Dat is het
         slot-04 uit blok D: het gesprek en het slot vertellen één verhaal.
         Binnen zeven dagen is zo'n draad een uitnodiging om te antwoorden
         (VERS_DAGEN in portaal-model.js).
       · q-07 — BEANTWOORD, maar daarna zei de KLANT nog iets. De oude
         kolommen question/answer zeggen "afgehandeld"; de draad zegt dat
         Steffan aan zet is. Dat verschil is precies wat de Inbox van het
         beheer sinds 0020 uit de draad moet lezen en niet uit de kolom.
     De eerste twee berichten van elke draad worden UIT HET VRAAGRECORD
     gelezen, niet overgetypt — dezelfde omzetting als de datamigratie in
     0020 en als eersteBerichten() in demo-data-ia.js — zodat draad en
     kolommen nooit uit elkaar lopen. */
  function gesprekken(demo){
    var vragen = lijst(demo, 'questions');
    var draad  = lijst(demo, 'questionMessages');

    function eersteBerichten(vraagId, prefix, klantnaam){
      var q = zoek(vragen, vraagId);
      if(!q) return;
      if(q.question){
        voegToe(draad, {
          id: prefix + '-1', questionId: vraagId, author: 'client', authorName: klantnaam,
          body: q.question, createdAt: q.askedAt
        });
      }
      if(q.answer){
        voegToe(draad, {
          id: prefix + '-2', questionId: vraagId, author: 'staff', authorName: 'Steffan Bakker',
          body: q.answer, createdAt: q.answeredAt || q.askedAt
        });
      }
    }

    voegToe(vragen, {
      id: 'q-06', projectId: 'prj-diffuser', mediaId: null, stageKey: 'logistics',
      question: 'Kan batch A rechtstreeks bij ons fulfilmentcentrum in Almere worden afgeleverd '
              + 'in plaats van bij ons in Amsterdam?',
      answer: 'Ja, dat kan, zolang we het vóór de inklaring in Rotterdam doorgeven. Stuur me het '
            + 'afleveradres, een contactpersoon ter plaatse en de venstertijden voor vrachtwagens; '
            + 'ik heb er onder Bestanden een slot voor klaargezet, dan zet ik het op de vrachtbrief.',
      askedAt: '2026-09-04T08:20:00Z', answeredAt: '2026-09-04T09:05:00Z'
    });
    eersteBerichten('q-06', 'qm-06', NOOR);

    voegToe(vragen, {
      id: 'q-07', projectId: 'prj-geurflacon', mediaId: 'med-g1', stageKey: 'tooling',
      question: 'Voor de nieuwe batch: kunnen we naast de 100 ml ook een 30 ml reisformaat '
              + 'meenemen, of is dat een nieuwe mal?',
      answer: 'Een 30 ml is een nieuwe mal: de hals en de pomp blijven gelijk, maar het glaslichaam '
            + 'moet opnieuw. Ik vraag Chen om een prijs voor de mal en een staffel vanaf 1.000 stuks '
            + 'en neem dat mee in de offerte.',
      askedAt: '2026-09-05T15:12:00Z', answeredAt: '2026-09-07T07:30:00Z'
    });
    eersteBerichten('q-07', 'qm-07', NOOR);
    voegToe(draad, {
      id: 'qm-07-3', questionId: 'q-07', author: 'client', authorName: NOOR,
      body: 'Fijn. Neem dan ook een prijs voor 2.000 stuks mee; de 30 ml wordt ons hotelformaat.',
      createdAt: '2026-09-07T08:02:00Z'
    });
  }

  /* ---------- de aanvulling zelf ---------- */
  /* Neemt het CP_DEMO-object, vult het aan en geeft het terug. Elk blok
     controleert zelf of de collectie en het record bestaan; een onvolledige
     of oudere seed levert geen fout op maar gewoon minder aanvulling. De
     volgorde is niet vrij: blok A moet vóór de generieke fasestempel zijn
     wissel doen (staat in het blok zelf), en blok D leest het slot dat
     blok E's verhaal aankondigt — inhoudelijk, niet technisch. */
  function toepassen(demo){
    if(!demo || typeof demo !== 'object') return demo;
    if(isLijst(demo.projects)) fases(demo);
    samples(demo);
    betalingen(demo);
    documenten(demo);
    herbestelling(demo);
    if(isLijst(demo.clients)) contactpersonen(demo);
    gesprekken(demo);
    return demo;
  }

  window.CP_DEMO_PORTAAL = {
    VERSION: VERSION,
    toepassen: toepassen
  };

  /* Automatisch toepassen zodra de seed er is, zodat een pagina alleen de
     script-tag hoeft toe te voegen. Ontbreekt window.CP_DEMO (de tag staat
     te vroeg, of de pagina laadt de demoseed niet), dan gebeurt er niets en
     kan een aanroeper CP_DEMO_PORTAAL.toepassen(...) later zelf doen —
     bijvoorbeeld op de staat uit localStorage, zie het kopblok. */
  if(window.CP_DEMO) toepassen(window.CP_DEMO);
})();
