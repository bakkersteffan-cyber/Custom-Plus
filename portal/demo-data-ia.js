/* ============================================================
   CUSTOM+ demodata — de aanvulling voor de nieuwe beheer-UI (blok A t/m J)

   WAAROM DIT EEN APART BESTAND IS
   De seed hoort inhoudelijk in portal/demo-data.js, maar dat bestand wordt
   op dit moment door een andere bouw aangeraakt (factuurmodule + fixronde).
   Twee sessies die hetzelfde bestand herschrijven leveren gegarandeerd een
   verloren wijziging op. Daarom staat de aanvulling hier: demo-data.js
   blijft ongemoeid en dit bestand VULT window.CP_DEMO AAN zodra het geladen
   is. Wie de twee ooit wil samenvoegen, plakt de waarden hieronder in
   demo-data.js en gooit dit bestand weg — de veldnamen zijn identiek.

   HOE JE HEM LAADT
   Eén script-tag, altijd NA portal/demo-data.js (dit bestand heeft
   window.CP_DEMO nodig en maakt hem niet zelf aan):

       <script src="portal/demo-data.js"></script>
       <script src="portal/demo-data-ia.js"></script>

   Staat de tag er niet, dan draait het beheer gewoon door: elk nieuw veld is
   dan leeg en de schermen tonen hun eerlijke lege stand. Er breekt niets.

   ÉÉN VALKUIL BIJ HET TESTEN. De demomodus leest bij het opstarten eerst
   localStorage (sleutel cp_portal_demo_v1) en pas als dat leeg is de seed.
   Wie al met de demo heeft gewerkt, houdt dus zijn eigen opslag en ziet de
   nieuwe records uit dit bestand (req-03, q-02 t/m q-05, de contactmomenten)
   NIET verschijnen — de schema-drift-aanvulling in beheer.html vult alleen
   collecties aan die helemaal ontbreken, geen records binnen een collectie
   die al bestaat. Zie je de standen hieronder niet terug, wis dan eerst de
   demo-opslag; dat is geen fout in deze seed.

   WAT HIJ AANVULT
   De bouwlijst uit hoofdstuk 7 van .claude/beheer-ui-mockup-spec.md, met
   exact de veldnamen uit supabase/portal/0020_beheer_ia.sql — daar in
   snake_case, hier in camelCase, want dat is wat de datalaag van een
   Supabase-rij maakt (camelRij in portal/admin-data.js, toCamelKey/camelRow
   in beheer.html).
     A  fabrieksdossier          → status, specialties, photoUrl, country
                                   (openbaar) + qualityScore, leadtimeScore,
                                   contactName/Role/Email/Phone/AvatarUrl,
                                   notes (INTERN — zie hieronder)
     B  fabriek aan project      → projects.factoryId
     C  avatars                  → contacts.avatarUrl (en teamleden)
     D  projectvelden            → deadline, category, lead
     E  klantvelden              → country, tagline, logoUrl
     F  aanvraagvelden           → country, source, files
     G  gespreksdraad            → demo.questionMessages (nieuw)
     H  team en rechten          → demo.teamMembers (nieuw)
     I  werkdruk                 → demo.contactMoments (nieuw gevuld) +
                                   settings.itemState + capacityPerWeekday
     J  bewaartermijn/back-up    → settings.retentionDays, lastBackupAt

   HET FABRIEKSDOSSIER STAAT LIVE IN TWEE TABELLEN — HIER IN ÉÉN OBJECT
   0020_beheer_ia.sql zet de onschadelijke helft van een fabriek (naam,
   regio, stad, NNN-datum, status, specialties, photoUrl, country) op
   factories_partners, en de INTERNE helft (notes, de vijf contact*-velden en
   de twee scores) in de aparte staf-tabel factory_private. Reden: Postgres
   kent geen leesrecht per KOLOM, en factories_partners is sinds 0001
   leesbaar voor elke ingelogde gebruiker — ook voor een klant. Zonder die
   splitsing zou een klant de inkoopnotitie en het rapportcijfer van zijn
   eigen leverancier via de REST API kunnen opvragen.
   In DEMOMODUS bestaat die splitsing niet: daar houdt de browser één plat
   record per fabriek in state.factories, en portal/admin-data.js zet het in
   live modus weer tot datzelfde platte object samen. De VELDNAMEN hieronder
   zijn daarom letterlijk gelijkgetrokken met FABRIEK_OPENBARE_VELDEN en
   FABRIEK_INTERNE_VELDEN uit admin-data.js. Een tikfout hier is een veld dat
   in demo werkt en live leeg blijft, en dat valt pas op als de eigenaar zijn
   eigen dossier kwijt is.

   DE INTERNE NOTITIES BLIJVEN INTERN
   fabriek.notes gaat over inkoopprijzen, staffels en aanbetalingstermijnen.
   Dat veld hoort bij de fabriek en NERGENS anders: niet op een project, niet
   op een klant en niet in een onderschrift. Let op dat clients[].notes in
   demo-data.js een heel ander veld is (de vrije notitie ván het beheer óver
   de klant); ze delen alleen hun naam. Kopieer nooit de een naar de ander.

   IDEMPOTENT
   toepassen() twee keer aanroepen verandert de tweede keer niets:
     · een veld wordt alleen gezet als het nog niet BESTAAT (typeof
       undefined). Een veld dat al een waarde heeft — ook een lege string,
       ook null — blijft staan. Zo overschrijft deze seed nooit iets dat de
       eigenaar of een andere bouw al heeft ingevuld;
     · een record wordt alleen toegevoegd als er nog geen record met dat id
       in de lijst staat;
     · elke waarde wordt gekopieerd voordat hij in de staat komt, zodat twee
       records nooit dezelfde array delen (een chip toevoegen bij fabriek A
       mag nooit bij fabriek B verschijnen).

   BIJNA GEEN BESTANDEN IN DEZE SEED
   Alle *Url-velden blijven leeg, op één na. Een foto of avatar als data-URI
   meebakken blaast dit bestand op, en de opslag hoort via de bestaande
   plumbing te lopen (demomodus: IndexedDB via portal/demo-files.js; live: de
   private bucket beheer-intern). Leeg betekent hier: de UI toont initialen of
   een neutrale tegel, en dat is een volwaardige variant die sowieso moet
   werken — dus die staat wordt hier ook echt getest.
   DE ENE UITZONDERING is clients[cli-noor].logoUrl. De GEVULDE tegel moet
   net zo goed getest worden als de lege, en zonder verwijzing is dat in demo
   onmogelijk: admin-data.js avatarUrl() laat alleen http(s):, data: en blob:
   ongemoeid en zoekt al het andere op in IndexedDB, waar een verzonnen
   sleutel niets oplevert. Het is daarom een inline SVG van 460 tekens — een
   logo is van nature vector, dus dat is geen truc maar de normale vorm.
   Fabrieksfoto's blijven wél leeg: een 300x200 foto nabootsen met een
   tekening zou een foto SUGGEREREN die er niet is.

   WELKE STANDEN DEZE SEED BEWUST DEKT
   Elke regel hieronder is een stand die anders pas in productie voor het
   eerst zou voorkomen. Wie hier iets weghaalt, haalt een test weg.
     · fabriek MET beoordeling (Chen 4/3) en fabriek ZONDER (Wei null/null)
     · fabriek met zeven specialisaties (Chen) → de overloopchip "+n" krijgt
       echt werk; fabriek met drie (Wei) → chiprij zonder overloop
     · geen enkele fabriek heeft een foto → de neutrale tegel, tweemaal
     · project MET deadline (geurflacon, diffuser) en ZONDER (cookset)
     · project met factoryId als VELD (diffuser) en twee projecten waar de
       oude afleiding via media.factoryId het werk moet doen
     · klant MET tagline en logo (Atelier Noor) en klant ZONDER allebei
       (Fjell Outdoor)
     · aanvraag MET bijlage (req-01, één bestand; req-03, twee bestanden) en
       ZONDER (req-02); aanvraag ZONDER bekende bron (req-03, source leeg)
     · gespreksdraad van VIER beurten (q-01, q-02), van TWEE beurten (q-04),
       een onbeantwoorde vraag van één beurt (q-03) en een onbeantwoorde
       vraag waar de klant zelf al twee keer heeft getypt (q-05)
     · teamlid per rol (eigenaar, beheerder, medewerker, lezer), alle drie de
       statussen, en een UITGENODIGD lid dat nog nooit heeft ingelogd
       (Youssef: invitedAt gevuld, lastSeenAt null)
     · een week met een ECHT overbelaste dag — maandag 31 augustus 2026, vier
       acties tegen een capaciteit van drie. Zie het blok bij instellingen()
       voor de vier acties en waarom ze daar staan.

   DE TOON VAN DE INHOUD
   Dit is een DEMOSEED: de voorbeeldwaarden hieronder zijn verzonnen, maar
   realistisch voor een bureau dat maatwerk in China laat maken — met echte
   aantallen, echte data en echte specificaties, omdat een scherm vol
   plaatsvervangende zinnen niets bewijst. In de live modus komt geen letter
   hiervan mee: daar staat elk veld leeg tot de eigenaar het zelf invult.
   ============================================================ */
(function(){
  'use strict';

  var VERSION = '1.1.0';

  /* ---------- gereedschap ---------- */

  /* Diepe kopie van een seedwaarde. JSON.parse(JSON.stringify(...)) zou ook
     kunnen, maar dat maakt van een undefined stilletjes niets en van een
     datum een string; dit blijft voorspelbaar. */
  function kopie(v){
    var uit, i, k;
    if(v === null || typeof v !== 'object') return v;
    if(Object.prototype.toString.call(v) === '[object Array]'){
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

  /* Vult ontbrekende velden aan op één record.
     De regel is met opzet "typeof undefined" en niet "leeg of null":
       · een veld dat er nog niet is  → seedwaarde;
       · een veld dat er wel is       → blijft, ook als het '' of null is.
     Daardoor kan deze seed een bewuste null neerzetten (bv. een fabriek
     zonder oordeel) zonder dat een tweede aanroep hem alsnog vult. */
  function vulAan(rec, velden){
    var k;
    if(!rec || typeof rec !== 'object') return rec;
    for(k in velden){
      if(!Object.prototype.hasOwnProperty.call(velden, k)) continue;
      if(typeof rec[k] === 'undefined') rec[k] = kopie(velden[k]);
    }
    return rec;
  }

  /* Zoekt een record op id in een lijst; null als de lijst of het record
     ontbreekt. Bewust geen fout: een demo-opslag van een oudere versie mag
     gerust een collectie missen. */
  function zoek(lijst, id){
    var i;
    if(!lijst || typeof lijst.length !== 'number') return null;
    for(i = 0; i < lijst.length; i++){
      if(lijst[i] && lijst[i].id === id) return lijst[i];
    }
    return null;
  }

  /* Zorgt dat demo[sleutel] een array is en geeft hem terug. */
  function lijst(demo, sleutel){
    if(Object.prototype.toString.call(demo[sleutel]) !== '[object Array]'){
      demo[sleutel] = [];
    }
    return demo[sleutel];
  }

  /* Voegt een record toe zolang er nog geen record met dat id staat. */
  function voegToe(doel, rec){
    if(!rec || !rec.id) return;
    if(zoek(doel, rec.id)) return;
    doel.push(kopie(rec));
  }

  /* Zorgt dat demo.settings een gewoon object is en geeft het terug. */
  function instellingenObject(demo){
    if(!demo.settings || typeof demo.settings !== 'object' ||
       Object.prototype.toString.call(demo.settings) === '[object Array]'){
      demo.settings = {};
    }
    return demo.settings;
  }

  /* ---------- A. FABRIEKSDOSSIER ---------- */
  /* Een fabriek was drie velden; de mockup toont een dossier. Hieronder de
     twee bestaande fabrieken uit demo-data.js, met dezelfde id's.

     DE VELDNAMEN. Openbaar (live: factories_partners): status, specialties,
     photoUrl, country. Intern (live: factory_private): qualityScore,
     leadtimeScore, contactName, contactRole, contactEmail, contactPhone,
     contactAvatarUrl, notes. In demomodus staan ze door elkaar op één plat
     record, precies zoals admin-data.js ze na de samenvoeging teruggeeft.

     BEWUST LEEG — DRIE STANDEN IN DIT BLOK:
       1. Toolmaker Wei heeft GEEN kwaliteits- en doorlooptijdscore. null
          betekent "nog niet beoordeeld" en dat is iets anders dan een 1: de
          UI hoort vijf lege stippen te tonen en nooit een nul. De notitie bij
          Wei legt uit waarom hij nog geen oordeel heeft — één mal is te
          weinig om iemand een cijfer te geven.
       2. Chen draagt ZEVEN specialisaties. Dat is meer dan er in de chiprij
          van scherm 5.6 passen, dus de overloopchip "+n" (component 4.16,
          met een title die de rest opsomt) krijgt hier echt werk. Wei heeft
          er drie: dezelfde rij zonder overloop, zodat allebei de kanten van
          die component getest zijn.
       3. Geen van beide heeft een photoUrl. De neutrale tegel met het
          fabrieksicoon is dus de stand die je in de demo ziet — zie de
          uitleg over bestanden bovenaan dit bestand.

     De notities zijn INTERN (factory_private.notes): inkoopprijzen, staffels
     en aanbetalingstermijnen. Ze staan met opzet in dit veld en in geen
     enkel ander; een klant hoort de marge op zijn eigen order niet te lezen. */
  function fabrieken(demo){
    var f = demo.factories;
    var chen = zoek(f, 'fac-chen');
    var wei  = zoek(f, 'fac-wei');

    if(chen){
      vulAan(chen, {
        /* openbaar */
        status: 'actief',
        specialties: ['spuitgieten', 'glasverwerking', 'assemblage', 'verpakking',
                      'zeefdruk', 'tampondruk', 'metaalinleg'],
        photoUrl: '',
        country: 'China',
        /* intern */
        qualityScore: 4,
        leadtimeScore: 3,
        contactName: 'Chen Wenjie',
        contactRole: 'Fabrieksmanager',
        contactEmail: 'wenjie@chen-mfg.cn',
        contactPhone: '+86 138 2411 7702',
        contactAvatarUrl: '',
        notes: 'INTERN. Vaste partner sinds september 2025, draait zowel het glaswerk als de '
             + 'spuitgietdelen. Antwoordt binnen een uur op WeChat en traag op mail. '
             + 'Inkoop diffuservat: 2,05 USD per stuk vanaf 3.000, 1,88 vanaf 10.000; onder de '
             + '1.000 rekent hij 3,40 en dan zijn we duurder uit dan bij Wei. Betaling 40% '
             + 'aanbetaling bij order, 60% tegen kopie B/L. De mallen blijven ons eigendom, zo '
             + 'staat het in de NNN van 2 april 2026.'
      });
    }

    if(wei){
      vulAan(wei, {
        /* openbaar */
        status: 'actief',
        specialties: ['malbouw', 'staalbewerking', 'vonkerosie'],
        photoUrl: '',
        country: 'China',
        /* intern */
        qualityScore: null,
        leadtimeScore: null,
        contactName: 'Wei Jianguo',
        contactRole: 'Eigenaar',
        contactEmail: 'jianguo@weitooling.cn',
        contactPhone: '+86 137 6089 5514',
        contactAvatarUrl: '',
        notes: 'INTERN. Kleine werkplaats van acht man, doet alleen mallen. Binnengekomen via '
             + 'Chen. Mal diffuservat: 4.850 USD voor een viervoudige matrijs in P20-staal, 50% '
             + 'aanbetaling en 50% na goedkeuring van T1. Nog geen oordeel gegeven: hij heeft '
             + 'één mal voor ons gemaakt en die liep goed, maar één project is te weinig om een '
             + 'cijfer aan te hangen.'
      });
    }
  }

  /* ---------- B + D. PROJECTVELDEN ---------- */
  /* factoryId is nieuw; de afleiding via media.factoryId blijft in de code
     staan als terugval voor oude rijen. Die terugval wordt hier ook echt
     getest:
       · prj-geurflacon houdt factoryId LEEG. Het is een afgerond project uit
         2025 — precies de oude rij waarvoor de terugval bedoeld is. Al zijn
         foto's dragen fac-chen, dus de afleiding hoort "Fabriek Chen" op te
         leveren zonder dat het veld gevuld is (koppelingBron 'afgeleid');
       · prj-diffuser draagt factoryId WEL, dus daar wint het echte veld
         (koppelingBron 'veld');
       · prj-cookset houdt factoryId ook leeg, maar om een derde reden: het
         staat nog in het offertetraject, er is nog niets gekozen en geen
         enkele foto draagt een fabrieks-id. Dat is de echte lege stand,
         waar koppelingBron null blijft.

     deadline is de met de hand beloofde einddatum, LOS van de zes afgeleide
     datumprojecties. prj-cookset heeft er geen: er is nog niets beloofd, en
     een verzonnen deadline is erger dan geen deadline. De deadline van
     prj-diffuser (vrijdag 23 oktober) ligt bewust net ná het ETA-venster van
     zending shp-02 (12 t/m 18 oktober), zodat de kalender de belofte en de
     projectie naast elkaar toont zonder dat ze elkaar tegenspreken. Het is
     een vrijdag en geen weekenddag: een belofte aan een klant valt op een
     werkdag. De deadline van prj-geurflacon (28 februari) valt wél op een
     zaterdag, en dat mag: dat was een maandeindebelofte ("in huis vóór eind
     februari"), geen afspraak over een werkdag.

     lead draagt de NAAM van een teamlid (zie blok H); de avatar wordt
     opgezocht door die naam te matchen. Twee verschillende leiders in de
     seed, zodat dat matchen ook echt iets te doen heeft. */
  function projecten(demo){
    var p = demo.projects;
    var geur = zoek(p, 'prj-geurflacon');
    var diff = zoek(p, 'prj-diffuser');
    var cook = zoek(p, 'prj-cookset');

    if(geur){
      vulAan(geur, {
        factoryId: null,
        deadline: '2026-02-28',
        category: 'Interieur',
        lead: 'Steffan Bakker'
      });
    }

    if(diff){
      vulAan(diff, {
        factoryId: 'fac-chen',
        deadline: '2026-10-23',
        category: 'Interieur',
        lead: 'Steffan Bakker'
      });
    }

    if(cook){
      vulAan(cook, {
        factoryId: null,
        deadline: null,
        category: 'Outdoor',
        lead: 'Marit Groen'
      });
    }
  }

  /* ---------- E. KLANTVELDEN ---------- */
  /* Twee klanten, twee tegenovergestelde standen, want de klantkaart moet
     allebei aankunnen:
       · Atelier Noor is een lopende klant: tagline (letterlijk de regel uit
         de mockup) én een logo. De logoUrl is de enige verwijzing naar een
         bestand in deze hele seed; de reden staat bovenaan dit bestand. Het
         is een inline SVG van 460 tekens: een crème vlak met de amberkleurige
         flacon uit hun merk. Bewust GEEN monogram "AN", want dat is precies
         wat de lege stand ook tekent (initialen) — dan zou je aan de tegel
         niet kunnen zien of het logo geladen is.
       · Fjell Outdoor is nog in het offertetraject: eerste call op 21
         augustus, verder niets. We hebben van ze geen logo en geen regel die
         zegt wat ze maken, dus tagline en logoUrl blijven allebei LEEG. De
         kaart hoort dan de regel weg te laten (niet in te vullen) en de
         initialen FO op zwart te tonen. Vult de eigenaar ze later in, dan
         raakt vulAan ze niet meer aan. */
  var NOOR_LOGO = 'data:image/svg+xml;base64,'
    + 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+'
    + 'PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjZjJlY2UxIi8+PHJlY3QgeD0iMjYiIHk9'
    + 'IjciIHdpZHRoPSIxMiIgaGVpZ2h0PSI3IiByeD0iMyIgZmlsbD0iIzJmMmEyNCIvPjxwYXRoIGQ9Ik0y'
    + 'OCAxM2g4djZjNyAzIDExIDkgMTEgMTYgMCA5LTcgMTYtMTUgMTZzLTE1LTctMTUtMTZjMC03IDQtMTMg'
    + 'MTEtMTZ6IiBmaWxsPSIjYjQ3MTJhIi8+PHBhdGggZD0iTTMyIDMwYzMgMyA1IDUgNSA4YTUgNSAwIDAg'
    + 'MS0xMCAwYzAtMyAyLTUgNS04eiIgZmlsbD0iI2YyZWNlMSIvPjwvc3ZnPg==';

  function klanten(demo){
    var c = demo.clients;
    var noor  = zoek(c, 'cli-noor');
    var fjell = zoek(c, 'cli-fjell');

    if(noor){
      vulAan(noor, {
        country: 'Nederland',
        tagline: 'Hervulbare diffusers & interieuritems',
        logoUrl: NOOR_LOGO
      });
    }

    if(fjell){
      vulAan(fjell, {
        country: 'Noorwegen',
        tagline: '',
        logoUrl: ''
      });
    }
  }

  /* ---------- F. AANVRAAGVELDEN ---------- */
  /* files is een array van {name, path, size, type}, precies zoals het
     schema hem beschrijft. path verwijst in demomodus naar IndexedDB en in
     live modus naar de private bucket beheer-intern.

     LET OP: de paden hieronder zijn LEEG. Er zit geen blob achter — een seed
     draagt geen bytes, en een verzonnen sleutel zou de UI naar een bestand
     laten zoeken dat nergens staat. Zo toont het scherm de naam en de
     grootte met de nette "bestand niet beschikbaar"-terugval eronder; dat is
     dezelfde stand als bij de documenten in demo-data.js, die ook geen
     fileRef dragen.

     DRIE AANVRAGEN, DRIE STANDEN:
       · req-01  één bijlage, bron bekend (het formulier op de site);
       · req-02  géén bijlage, bron bekend (doorverwijzing);
       · req-03  twee bijlagen (dus ook de meervoudstand van de lijst) en een
                 LEGE bron. Die aanvraag kwam als doorgestuurde mail binnen,
                 dus er is niets ingevuld waar hij vandaan komt. Het scherm
                 hoort dat als "onbekend" te tonen en niet stilletjes iets aan
                 te nemen. */
  function aanvragen(demo){
    var a = demo.aanvragen;
    var lotte = zoek(a, 'req-01');
    var jonas = zoek(a, 'req-02');

    if(lotte){
      vulAan(lotte, {
        country: 'Nederland',
        source: 'Contactformulier op de site',
        files: [
          { name: 'moodboard-mok.pdf', path: '', size: 1842000, type: 'application/pdf' }
        ]
      });
    }

    if(jonas){
      vulAan(jonas, {
        country: 'Duitsland',
        source: 'Doorverwijzing via Atelier Noor',
        files: []
      });
    }

    voegToe(a, {
      id: 'req-03', name: 'Ana Ferreira', email: 'ana@casadelinho.pt',
      company: 'Casa de Linho', lang: 'en',
      product: 'Geëmailleerde gietijzeren braadpan 24 cm in twee kleuren, deksel met '
             + 'gietijzeren knop, eerste oplage 800 stuks',
      status: 'nieuw', clientId: null, projectId: null,
      createdAt: '2026-08-28T08:12:00Z',
      country: 'Portugal',
      source: '',
      files: [
        { name: 'braadpan-maatvoering.pdf', path: '', size: 964000, type: 'application/pdf' },
        { name: 'referentie-emaillekleuren.jpg', path: '', size: 2380000, type: 'image/jpeg' }
      ]
    });
  }

  /* ---------- C. CONTACTPERSONEN ---------- */
  /* role bestond al sinds golf 5 (ct-01 is 'Boekhouding') en blijft dus
     staan; vulAan raakt hem niet aan. Nieuw is alleen avatarUrl, en die
     blijft leeg: initialen op zwart, precies zoals de mockup het toont voor
     mensen zonder foto. */
  function contactpersonen(demo){
    var ct = zoek(demo.contacts, 'ct-01');
    if(ct){
      vulAan(ct, {
        role: 'Boekhouding',
        avatarUrl: ''
      });
    }
  }

  /* ---------- H. TEAM EN RECHTEN ---------- */
  /* Vier leden, vier rollen, en alle drie de statussen komen voor — meer
     statussen dan drie zijn er niet, dus "elk lid een andere status" kan
     niet en hoeft ook niet: wat telt is dat elke stand één keer in de seed
     zit.
       · eigenaar   actief      — Steffan zelf; hetzelfde e-mailadres als
                                  demo.staff, want in live modus komt deze rij
                                  uit staff_users;
       · beheerder  actief      — een tweede paar handen dat alles mag;
       · medewerker uitgenodigd — invitedAt gevuld, lastSeenAt LEEG: iemand
                                  die nog nooit heeft ingelogd. Dat is de
                                  stand die de UI moet tonen als een streepje
                                  en nooit als "onbekend";
       · lezer      inactief    — de boekhouder die alleen tijdens de
                                  kwartaalafsluiting meekijkt. De rij blijft
                                  bestaan (en dus de geschiedenis) zonder mee
                                  te tellen in de lijst.
     avatarUrl staat overal leeg: initialen.

     Marit Groen is niet toevallig ook de projectleider van prj-cookset (blok
     D): lead draagt een NAAM, en die naam moet dus echt in deze lijst te
     vinden zijn, anders test het opzoeken van de avatar niets.

     EERLIJKHEIDSEIS uit de spec: de rollen hieronder worden op
     databaseniveau NIET afgedwongen (RLS kent alleen is_staff()). Het scherm
     hoort dat met zoveel woorden te zeggen; deze seed vult alleen de
     ledenlijst en belooft niets over rechten. */
  function team(demo){
    var doel = lijst(demo, 'teamMembers');
    var leden = [
      {
        id: 'tm-steffan', name: 'Steffan Bakker', email: 'steffan@customplus.nl',
        role: 'eigenaar', status: 'actief', avatarUrl: '',
        invitedAt: null, lastSeenAt: '2026-08-29T16:52:00Z',
        createdAt: '2025-06-02T09:00:00Z'
      },
      {
        id: 'tm-marit', name: 'Marit Groen', email: 'marit@customplus.nl',
        role: 'beheerder', status: 'actief', avatarUrl: '',
        invitedAt: '2026-02-16T10:04:00Z', lastSeenAt: '2026-08-28T14:05:00Z',
        createdAt: '2026-02-16T10:00:00Z'
      },
      {
        id: 'tm-youssef', name: 'Youssef el Amrani', email: 'youssef@customplus.nl',
        role: 'medewerker', status: 'uitgenodigd', avatarUrl: '',
        invitedAt: '2026-08-25T11:06:00Z', lastSeenAt: null,
        createdAt: '2026-08-25T11:05:00Z'
      },
      {
        id: 'tm-hilde', name: 'Hilde Vos', email: 'hilde@vosadministratie.nl',
        role: 'lezer', status: 'inactief', avatarUrl: '',
        invitedAt: '2026-03-11T10:00:00Z', lastSeenAt: '2026-07-04T09:20:00Z',
        createdAt: '2026-03-11T09:55:00Z'
      }
    ];
    var i;
    for(i = 0; i < leden.length; i++) voegToe(doel, leden[i]);
  }

  /* ---------- G. GESPREKSDRAAD ---------- */
  /* demo-data.js kende één vraag (q-01) met één antwoord. De mockup toont
     een draad met meerdere beurten, dus er komen vier vragen bij zodat elke
     lengte in de seed voorkomt:
       · q-01  beantwoord, draad van VIER beurten (vraag, antwoord, vervolg
               van de klant, antwoord);
       · q-02  beantwoord, draad van VIER beurten;
       · q-04  beantwoord, draad van precies TWEE beurten: gevraagd,
               geantwoord, klaar. Verreweg de meest voorkomende vorm, en de
               enige waarin de draad even lang is als de oude
               question/answer-kolommen;
       · q-03  OPEN: gesteld, nog niet beantwoord. Eén beurt. Die stand kwam
               in de seed nog niet voor terwijl het beheer er wel op stuurt
               (de Inbox en de afgeleide antwoorddeadline);
       · q-05  OPEN met TWEE beurten, allebei van de klant: hij stelde de
               vraag en stuurde er zeventien minuten later een aanvulling
               achteraan. De draad wacht dus op een antwoord terwijl er al
               meer dan één bericht staat — een stand die je alleen krijgt als
               je hem expliciet in de seed zet.

     De eerste twee berichten van elke beantwoorde draad zijn WOORDELIJK de
     bestaande question en answer, met hun ECHTE tijdstempels. Dat is precies
     wat de datamigratie in 0020_beheer_ia.sql in de live database doet, dus
     demo en live tonen dezelfde draad. question_threads.question en .answer
     blijven daarnaast gewoon staan — er wordt niets weggegooid.

     author ('client' of 'staff') bepaalt de weergave, nooit authorName: dat
     is vrije tekst. De namen hieronder houden zich aan wat de RLS-policy een
     klant toestaat — zijn eigen contactpersoon- of bedrijfsnaam.

     De inhoud volgt de bestaande records: de doffe schouder hoort bij med-05
     en de polijstronde van T2, de flowlijn bij insp-02 (IPQC, 2 kleine
     afwijkingen op 200 stuks, binnen norm) en med-08, de stickervraag bij
     med-07 (start van de run van 5.000), de palletvraag bij med-g2 (het
     archiefproject, batch 1 ingepakt) en de nestingvraag bij med-09, de
     eerste schets voor Fjell. */
  function vragenEnDraad(demo){
    var vragen = lijst(demo, 'questions');
    var draad  = lijst(demo, 'questionMessages');
    var i;

    /* Zet de bestaande vraag en het bestaande antwoord om in de eerste twee
       berichten van de draad — dezelfde omzetting als de datamigratie in
       0020_beheer_ia.sql. De tekst en de tijd worden UIT HET VRAAGRECORD
       gelezen en niet overgetypt, zodat de draad en de oude kolommen niet uit
       elkaar kunnen lopen. Een lege vraag of een leeg antwoord levert geen
       bericht op: een leeg bericht is geen beurt in een gesprek. */
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

    var nieuweVragen = [
      {
        id: 'q-02', projectId: 'prj-diffuser', mediaId: 'med-08', stageKey: 'production',
        question: 'Op de IPQC-foto zie ik een lijn onder de schouder lopen. Zit die op alle 5.000 stuks?',
        answer: 'Nee. We vonden hem op 2 van de 200 gecontroleerde stuks, allebei uit hetzelfde nest, '
              + 'en hij valt binnen de AQL-norm die we hebben afgesproken. De fabriek heeft de nadruk '
              + 'op dat nest bijgesteld; de rest van de run loopt zonder.',
        askedAt: '2026-08-26T15:40:00Z', answeredAt: '2026-08-27T03:12:00Z'
      },
      {
        id: 'q-04', projectId: 'prj-geurflacon', mediaId: 'med-g2', stageKey: 'logistics',
        question: 'De pallets op de foto zitten in zwarte folie. Zit daar een vochtwerende laag in of '
                + 'moet ik dat zelf regelen voor de opslag?',
        answer: 'De folie is vochtwerend en er ligt één droogmiddelzak van 500 gram per pallet. Voor '
              + 'een verwarmde ruimte hoef je niets te doen; zet je ze in een onverwarmde loods, leg '
              + 'er dan een tweede zak bij en vervang die na zes weken.',
        askedAt: '2026-01-12T11:30:00Z', answeredAt: '2026-01-12T15:48:00Z'
      },
      {
        id: 'q-05', projectId: 'prj-diffuser', mediaId: 'med-07', stageKey: 'production',
        question: 'Nog iets over de eerste 500 voor het hotel: kunnen daar stickers met hun eigen logo '
                + 'op de bodem? Of moet dat in een tweede ronde?',
        answer: '', askedAt: '2026-08-28T16:35:00Z', answeredAt: null
      },
      {
        id: 'q-03', projectId: 'prj-cookset', mediaId: 'med-09', stageKey: 'concept',
        question: 'De nestingschets ziet er goed uit. Passen er ook twee borden in dezelfde stapel, of '
                + 'wordt hij dan te hoog voor onze doos van 12 cm?',
        answer: '', askedAt: '2026-08-29T09:05:00Z', answeredAt: null
      }
    ];
    for(i = 0; i < nieuweVragen.length; i++) voegToe(vragen, nieuweVragen[i]);

    /* Draad bij q-01 — de bestaande vraag over de doffe schouder. Beurt 3 en
       4 komen erbij; de eerste twee komen uit het vraagrecord zelf. Alle vier
       de berichten hangen aan de vraag, dus als die er niet meer is voegen we
       ook niets toe. */
    if(zoek(vragen, 'q-01')){
      eersteBerichten('q-01', 'qm-01', 'Noor van Dijk');
      voegToe(draad, {
        id: 'qm-01-3', questionId: 'q-01', author: 'client', authorName: 'Noor van Dijk',
        body: 'Helder. Haalt T2 het dan nog voor de fotoshoot half juli? Ik heb er dan drie flacons voor nodig.',
        createdAt: '2026-06-26T14:20:00Z'
      });
      voegToe(draad, {
        id: 'qm-01-4', questionId: 'q-01', author: 'staff', authorName: 'Steffan Bakker',
        body: 'De polijstronde kost Wei drie werkdagen, dus T2 komt half juli uit de mal en gaat dezelfde dag per koerier naar je toe. Drie stuks lukt; ik hou er twee hier voor de maatcontrole.',
        createdAt: '2026-06-27T06:48:00Z'
      });
    }

    /* Draad bij q-02 — vier beurten, dezelfde opbouw. */
    eersteBerichten('q-02', 'qm-02', 'Noor van Dijk');
    voegToe(draad, {
      id: 'qm-02-3', questionId: 'q-02', author: 'client', authorName: 'Noor van Dijk',
      body: 'Oke. Kunnen de stuks met die lijn eruit gehouden worden? De eerste 500 gaan naar een hotel en die kijken er anders naar dan mijn webshopklanten.',
      createdAt: '2026-08-27T07:55:00Z'
    });
    voegToe(draad, {
      id: 'qm-02-4', questionId: 'q-02', author: 'staff', authorName: 'Steffan Bakker',
      body: 'Doen we. Bij de eindcontrole voor verscheping laat ik op dat punt honderd procent visueel kijken en gaan de afwijkers apart; het aantal komt in het FQC-rapport te staan.',
      createdAt: '2026-08-27T09:30:00Z'
    });

    /* Draad bij q-04 — precies twee beurten: gevraagd en geantwoord, verder
       niets. Er komt hier met opzet géén derde bericht bij. */
    eersteBerichten('q-04', 'qm-04', 'Noor van Dijk');

    /* Draad bij q-05 — twee beurten, allebei van de klant, en nog geen
       antwoord. De aanvulling staat los van de vraag omdat hij later kwam;
       samen in één bericht plakken zou juist de stand wegpoetsen die we hier
       willen testen. */
    eersteBerichten('q-05', 'qm-05', 'Noor van Dijk');
    voegToe(draad, {
      id: 'qm-05-2', questionId: 'q-05', author: 'client', authorName: 'Noor van Dijk',
      body: 'Aanvulling: de sticker is 30 mm rond, mat wit met zwarte opdruk. Past het niet meer in deze run, dan plakken we ze hier zelf — laat het vooral weten.',
      createdAt: '2026-08-28T16:52:00Z'
    });

    /* Draad bij q-03 — één beurt, want er is nog niet geantwoord. Zo test de
       weergave ook de draad die met één bericht op een antwoord wacht. */
    eersteBerichten('q-03', 'qm-03', 'Mats Berger');
  }

  /* ---------- I. DE ACTIES DIE DE WEEK VULLEN ---------- */
  /* contactMoments (functie 27) is de CRM-tijdlijn per klant: handmatige
     calls en berichten met een optionele herinnerdatum. De collectie bestond
     wel maar stond leeg, en daardoor was BRON 5 van workload() — de
     follow-up-herinnering — in de hele demo dood.

     Drie momenten, en ze doen alle drie iets:
       · cm-01  heeft een herinnering op MAANDAG 31 AUGUSTUS 2026 en is nog
                niet afgevinkt. Dit is één van de vier acties die die dag
                overbelast maken (zie instellingen() hieronder);
       · cm-02  heeft een herinnering op vrijdag 28 augustus die óók nog
                openstaat. Die dag raakt niet overbelast (capaciteit 4, één
                actie) maar de staaf is wel gevuld, zodat de week ervoor niet
                leeg oogt — en een herinnering die over de datum is heen
                gelopen is precies wat de "achterstallig"-stand moet tonen;
       · cm-03  heeft GEEN herinnering. Een moment is niet altijd een taak, en
                die stand hoort de tijdlijn ook aan te kunnen.

     De teksten verwijzen naar bestaande records (de laatste 15% is inv-04,
     de ETA is die van shp-02, de flowlijn is q-02), zodat de tijdlijn en de
     rest van de demo hetzelfde verhaal vertellen. */
  function contactmomenten(demo){
    var doel = lijst(demo, 'contactMoments');
    var momenten = [
      {
        id: 'cm-01', clientId: 'cli-noor', kind: 'call',
        note: 'Gebeld over de laatste 15%. Noor wil pas betalen als batch A in Rotterdam staat en '
            + 'vroeg om een bevestigde aankomstdatum. Afgesproken dat ik maandag terugbel zodra '
            + 'Maersk het venster bevestigt.',
        at: '2026-08-27', remindAt: '2026-08-31', remindDone: false,
        createdAt: '2026-08-27T16:10:00Z'
      },
      {
        id: 'cm-02', clientId: 'cli-fjell', kind: 'call',
        note: 'Eerste call met Mats: 800 sets in het eerste jaar, drie pannen in één silhouet, '
            + 'doelprijs 34 euro per set af fabriek. Offerte toegezegd, nabellen als hij niet '
            + 'reageert.',
        at: '2026-08-21', remindAt: '2026-08-28', remindDone: false,
        createdAt: '2026-08-21T11:40:00Z'
      },
      {
        id: 'cm-03', clientId: 'cli-noor', kind: 'whatsapp',
        note: 'Beelden van de IPQC-ronde doorgestuurd. Noor reageerde meteen met de vraag over de '
            + 'flowlijn onder de schouder; die staat als q-02 in de Inbox.',
        at: '2026-08-26', remindAt: null, remindDone: false,
        createdAt: '2026-08-26T15:35:00Z'
      }
    ];
    var i;
    for(i = 0; i < momenten.length; i++) voegToe(doel, momenten[i]);
  }

  /* ---------- I + J. INSTELLINGEN ---------- */
  /* Vier sleutels in het bestaande instellingenobject. Drie ervan zijn in de
     live database rijen in admin_settings (capacity_per_weekday,
     retention_days, last_backup_at); de vierde, itemState, is een bestaand
     beheer-only blok uit golf 4.

     I — WERKDRUK, EN DE DAG DIE ECHT OVERBELAST RAAKT.
     capacityPerWeekday zegt hoeveel acties de eigenaar op zo'n dag aankan.
     De bezetting staat hier NIET: die telt workload() uit de zes bestaande
     datumprojecties, en overbelasting is het deel daarboven. Er staat hier
     dus met opzet geen fabriekscapaciteit en geen bezettingsgraad — dat
     meten we niet.
     Een object met Nederlandse dagafkortingen en geen array van zeven, want
     bij een array leest de een index 0 als zondag (JavaScript getDay) en de
     ander als maandag (de kalender loopt ma t/m zo).

     De cijfers: dinsdag t/m donderdag staan op zes, de default uit de
     migratie. Maandag staat op DRIE omdat de maandagochtend in deze demo
     naar de belronde met de fabrieken gaat (zes uur tijdsverschil), en
     vrijdag op VIER omdat dat de administratiedag is. Zaterdag en zondag
     nul, ook precies de default.

     DE OVERBELASTE DAG IS MAANDAG 31 AUGUSTUS 2026 — vier acties tegen een
     capaciteit van drie, dus de derde reeks in de staafgrafiek is één hoog
     en daarmee echt zichtbaar. De vier acties, elk uit een andere bron van
     workload():
       1. antwoordklok van q-05, gesteld vrijdag 28 augustus (bron 2: de
          belofte van één werkdag schuift over het weekend heen naar maandag);
       2. antwoordklok van q-03, gesteld zaterdag 29 augustus (idem);
       3. de follow-up-herinnering van cm-01 (bron 5);
       4. factuur inv-04 komt terug uit uitstel (bron 4, itemState hieronder).
     Wie de grafiek wil zien, zet de week op maandag 31 augustus 2026. De
     week ervóór (24 t/m 30 augustus) heeft één actie op vrijdag en raakt dus
     niet overbelast; dat is geen omissie maar het normale beeld waar de
     overbelaste dag tegen afsteekt.
     Er zijn nog TWEE overbelaste dagen, en die zijn niet geregisseerd maar
     gerekend:
       · zaterdag 26 september — factuur inv-04 heeft geen eigen dueDate, dus
         workload() projecteert hem op aanmaak plus dertig dagen (27 augustus
         + 30) en dat valt in het weekend;
       · zondag 18 oktober — daar sluit het ETA-venster van zending shp-02.
     Allebei vallen ze op een dag met capaciteit nul, en dat is precies
     waarom het weekend op nul staat en niet op één: werk dat in het weekend
     landt hóórt op te vallen in plaats van weg te vallen.

     I — UITSTEL (itemState, golf 4). De sleutel is de itemsleutel uit
     computeSignals(); 'inv:inv-04' is de openstaande factuur van 15% voor de
     pre-shipment QC. Hij is naar maandag geschoven met een reden erbij,
     precies zoals de snoozeknop in het beheer dat wegschrijft (snoozedUntil,
     snoozeReason, pinned, pinnedAt). Vóór 31 augustus staat hij daardoor
     onder "Uitgesteld" en vanaf 31 augustus onder "Terug" — twee secties van
     het overzicht die zonder deze regel nooit iets te tonen hadden.

     J — retentionDays is de bewaartermijn van de prullenbak: zeven dagen,
     exact het venster dat vandaag hardgecodeerd in beheer.html staat, zodat
     de demo zich niet anders gedraagt dan voorheen.

     J — lastBackupAt blijft null. Er is in deze demo nooit een back-up
     gemaakt, dus dat is wat het scherm hoort te tonen. Een tijdstempel
     verzinnen zou een back-up suggereren die niet bestaat. */
  function instellingen(demo){
    var s = instellingenObject(demo);
    vulAan(s, {
      capacityPerWeekday: { ma: 3, di: 6, wo: 6, do: 6, vr: 4, za: 0, zo: 0 },
      retentionDays: 7,
      lastBackupAt: null,
      itemState: {
        'inv:inv-04': {
          snoozedUntil: '2026-08-31',
          snoozeReason: 'Noor betaalt de laatste 15% pas als batch A in Rotterdam staat.',
          pinned: false,
          pinnedAt: null
        }
      }
    });
  }

  /* ---------- de aanvulling zelf ---------- */
  /* Neemt het CP_DEMO-object, vult het aan en geeft het terug. Elk blok
     controleert zelf of de collectie en het record bestaan, dus een
     onvolledige of oudere seed levert geen fout op maar gewoon minder
     aanvulling. */
  function toepassen(demo){
    if(!demo || typeof demo !== 'object') return demo;
    if(Object.prototype.toString.call(demo.factories) === '[object Array]') fabrieken(demo);
    if(Object.prototype.toString.call(demo.projects)  === '[object Array]') projecten(demo);
    if(Object.prototype.toString.call(demo.clients)   === '[object Array]') klanten(demo);
    if(Object.prototype.toString.call(demo.aanvragen) === '[object Array]') aanvragen(demo);
    if(Object.prototype.toString.call(demo.contacts)  === '[object Array]') contactpersonen(demo);
    team(demo);
    vragenEnDraad(demo);
    contactmomenten(demo);
    instellingen(demo);
    return demo;
  }

  window.CP_DEMO_IA = {
    VERSION: VERSION,
    toepassen: toepassen
  };

  /* Automatisch toepassen zodra de seed er is, zodat een pagina alleen de
     script-tag hoeft toe te voegen. Ontbreekt window.CP_DEMO (de tag staat
     te vroeg, of de pagina laadt de demoseed helemaal niet), dan gebeurt er
     niets en kan een aanroeper CP_DEMO_IA.toepassen(...) later zelf doen. */
  if(window.CP_DEMO) toepassen(window.CP_DEMO);
})();
