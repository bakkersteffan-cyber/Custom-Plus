/* CUSTOM+ sitechat — de knop rechtsonder en het paneel op de publieke site.
   ------------------------------------------------------------------
   Zelfstandig bestand: ES5, geen innerHTML, geen afhankelijkheid van de
   app in /assets/app.js. Praat met /.netlify/functions/site-chat (zie dat
   bestand voor de acties) en bewaart het gesprek in sessionStorage zodat het
   meegaat naar de volgende pagina van de site.

   WAAROM ER ALTIJD DRIE UITWEGEN ONDERAAN STAAN
   De chat is een startpunt, geen eindstation. Een bezoeker die een echte
   vraag heeft moet op elk moment naar Steffan kunnen zonder dat de chat hem
   eerst iets moet "toestaan": de briefing (met het gesprek voorgevuld), een
   gesprek plannen, of het gesprek per mail. Ook als de chat uitvalt, is dat
   blok het antwoord in plaats van een foutmelding.

   WAAROM DE BRIEFING VIA localStorage.cp_form_state GAAT
   De site heeft een formuliergeheugen: op /contact herstelt de app een
   opgeslagen brief uit die sleutel (zie custom-plus.html, cpRestoreAll).
   Door daar de samenvatting van het gesprek in te zetten en dan gewoon naar
   /contact te navigeren, staat het gesprek in de brief zonder dat de app
   iets van deze chat hoeft te weten. Bestaat er al een concept, dan wordt
   de samenvatting eronder gezet en niets overschreven.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  /* Alleen op de publieke site: portaal, beheer en factuur hebben een eigen
     wereld en eigen bezoekers. */
  if (/\/(portal|beheer|factuur)\.html$/i.test(window.location.pathname)) return;
  if (window.CP_CHAT_DISABLED) return;
  if (!window.fetch || !window.Promise || !document.createElement) return;

  var ENDPOINT = '/.netlify/functions/site-chat';
  var STORE_KEY = 'cp_chat_v1';
  var FORM_KEY = 'cp_form_state';
  var BRIEF_KEY = 'cp_chat_brief';
  var MAX_CHARS = 1000;
  var NEAR_CHARS = 800;
  var MAX_HISTORY = 12;
  /* dezelfde link als content/global.json (callBooking.url); die wordt bij
     het openen opgehaald en wint, dit is alleen de terugval */
  var CAL_FALLBACK = 'https://cal.com/steffan-bakker-isqvg1/30min';
  var CODES = ['nl', 'en', 'de', 'fr', 'es'];

  /* ---------------------------------------------------------- woordenboek
     NL is de bron; de vier vertalingen spreken de bezoeker aan zoals de
     site dat doet (jij, you, Sie, vous, usted). */
  var DICT = {
    'Chat met CUSTOM+': { en: 'Chat with CUSTOM+', de: 'Chat mit CUSTOM+', fr: 'Discuter avec CUSTOM+', es: 'Chatear con CUSTOM+' },
    'Vraag het CUSTOM+': { en: 'Ask CUSTOM+', de: 'Fragen Sie CUSTOM+', fr: 'Demandez à CUSTOM+', es: 'Pregunte a CUSTOM+' },
    'Antwoorden uit de site, geen offerte': { en: 'Answers from the site, not a quote', de: 'Antworten aus der Website, kein Angebot', fr: 'Réponses issues du site, pas un devis', es: 'Respuestas del sitio, no un presupuesto' },
    'Vraag': { en: 'Question', de: 'Frage', fr: 'Question', es: 'Pregunta' },
    'Productidee': { en: 'Product idea', de: 'Produktidee', fr: 'Idée de produit', es: 'Idea de producto' },
    'Sluiten': { en: 'Close', de: 'Schließen', fr: 'Fermer', es: 'Cerrar' },
    'Stel je vraag over hoe wij werken. Ik antwoord alleen met wat er op deze site staat.': { en: 'Ask how we work. I only answer with what this site says.', de: 'Stellen Sie Ihre Frage zu unserer Arbeitsweise. Ich antworte nur mit dem, was auf dieser Website steht.', fr: 'Posez votre question sur notre façon de travailler. Je réponds uniquement avec ce que dit ce site.', es: 'Pregunte cómo trabajamos. Solo respondo con lo que dice este sitio.' },
    'Beschrijf je productidee. Je krijgt een eerste inschatting van materiaal, MOQ en de logische eerste stap.': { en: 'Describe your product idea. You get a first read on material, MOQ and the logical first step.', de: 'Beschreiben Sie Ihre Produktidee. Sie erhalten eine erste Einschätzung zu Material, MOQ und dem logischen ersten Schritt.', fr: 'Décrivez votre idée de produit. Vous recevez une première lecture du matériau, du MOQ et de la première étape logique.', es: 'Describa su idea de producto. Recibirá una primera lectura del material, el MOQ y el primer paso lógico.' },
    'Typ je vraag': { en: 'Type your question', de: 'Ihre Frage', fr: 'Votre question', es: 'Su pregunta' },
    'Beschrijf je productidee': { en: 'Describe your product idea', de: 'Beschreiben Sie Ihre Produktidee', fr: 'Décrivez votre idée de produit', es: 'Describa su idea de producto' },
    'Verstuur': { en: 'Send', de: 'Senden', fr: 'Envoyer', es: 'Enviar' },
    'Assistent typt': { en: 'Assistant is typing', de: 'Assistent schreibt', fr: 'L’assistant écrit', es: 'El asistente escribe' },
    'Lees meer:': { en: 'Read more:', de: 'Mehr lesen:', fr: 'En savoir plus :', es: 'Leer más:' },
    'Op de site': { en: 'On the site', de: 'Auf der Website', fr: 'Sur le site', es: 'En el sitio' },
    'Start je briefing': { en: 'Start your briefing', de: 'Starten Sie Ihr Briefing', fr: 'Lancez votre brief', es: 'Empiece su briefing' },
    'Plan een gesprek': { en: 'Plan a call', de: 'Gespräch vereinbaren', fr: 'Planifier un appel', es: 'Agendar una llamada' },
    'Mail me dit gesprek': { en: 'Mail me this chat', de: 'Chat per Mail senden', fr: 'Recevoir cet échange par mail', es: 'Enviarme este chat por correo' },
    'Je e-mailadres': { en: 'Your email address', de: 'Ihre E-Mail-Adresse', fr: 'Votre adresse e-mail', es: 'Su correo electrónico' },
    'Verzenden': { en: 'Send', de: 'Senden', fr: 'Envoyer', es: 'Enviar' },
    'Annuleren': { en: 'Cancel', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar' },
    'Verstuurd. Steffan heeft het gesprek en je adres en reageert persoonlijk.': { en: 'Sent. Steffan has the chat and your address and replies personally.', de: 'Gesendet. Steffan hat den Chat und Ihre Adresse und antwortet persönlich.', fr: 'Envoyé. Steffan a l’échange et votre adresse et vous répond personnellement.', es: 'Enviado. Steffan tiene el chat y su dirección y responde personalmente.' },
    'Versturen is niet gelukt. Start je briefing of plan een gesprek, dan komt het goed.': { en: 'Sending did not work. Start your briefing or plan a call instead.', de: 'Das Senden hat nicht geklappt. Starten Sie Ihr Briefing oder vereinbaren Sie ein Gespräch.', fr: 'L’envoi n’a pas abouti. Lancez votre brief ou planifiez un appel.', es: 'No se pudo enviar. Empiece su briefing o agende una llamada.' },
    'Vul een geldig e-mailadres in.': { en: 'Enter a valid email address.', de: 'Bitte eine gültige E-Mail-Adresse eingeben.', fr: 'Saisissez une adresse e-mail valide.', es: 'Introduzca un correo electrónico válido.' },
    'De chat is even niet beschikbaar.': { en: 'The chat is unavailable right now.', de: 'Der Chat ist gerade nicht verfügbar.', fr: 'Le chat est indisponible pour le moment.', es: 'El chat no está disponible ahora mismo.' },
    'Stel je vraag via de briefing, dan antwoordt Steffan persoonlijk.': { en: 'Ask through the briefing and Steffan answers personally.', de: 'Stellen Sie Ihre Frage über das Briefing, Steffan antwortet persönlich.', fr: 'Posez votre question via le brief, Steffan vous répond personnellement.', es: 'Pregunte a través del briefing y Steffan responde personalmente.' },
    'Geen verbinding. Probeer het zo nog eens, of start je briefing.': { en: 'No connection. Try again in a moment, or start your briefing.', de: 'Keine Verbindung. Versuchen Sie es gleich noch einmal oder starten Sie Ihr Briefing.', fr: 'Pas de connexion. Réessayez dans un instant ou lancez votre brief.', es: 'Sin conexión. Inténtelo de nuevo en un momento o empiece su briefing.' },
    'Enter verstuurt, Shift+Enter voor een nieuwe regel': { en: 'Enter sends, Shift+Enter for a new line', de: 'Enter sendet, Shift+Enter für eine neue Zeile', fr: 'Entrée envoie, Maj+Entrée pour une nouvelle ligne', es: 'Enter envía, Shift+Enter para una nueva línea' },
    'Nieuw gesprek': { en: 'New chat', de: 'Neuer Chat', fr: 'Nouvelle discussion', es: 'Nuevo chat' },
    'Uit de sitechat:': { en: 'From the site chat:', de: 'Aus dem Website-Chat:', fr: 'Extrait du chat du site :', es: 'Del chat del sitio:' },
    'Ik': { en: 'Me', de: 'Ich', fr: 'Moi', es: 'Yo' },
    'Assistent': { en: 'Assistant', de: 'Assistent', fr: 'Assistant', es: 'Asistente' },
    'opent in een nieuw tabblad': { en: 'opens in a new tab', de: 'öffnet in einem neuen Tab', fr: 'ouvre dans un nouvel onglet', es: 'se abre en una pestaña nueva' }
  };

  /* Drie vragen per pagina. Een chip is een echte vraag aan de chat, geen
     link, dus de tekst moet iets zijn waar de site een antwoord op heeft. */
  var CHIPS = {
    home: [
      { nl: 'Wat doet CUSTOM+ precies?', en: 'What exactly does CUSTOM+ do?', de: 'Was genau macht CUSTOM+?', fr: 'Que fait CUSTOM+ exactement ?', es: '¿Qué hace exactamente CUSTOM+?' },
      { nl: 'Hoe lang duurt een project?', en: 'How long does a project take?', de: 'Wie lange dauert ein Projekt?', fr: 'Combien de temps dure un projet ?', es: '¿Cuánto dura un proyecto?' },
      { nl: 'Hoe werkt betalen in fases?', en: 'How do staged payments work?', de: 'Wie funktioniert die Zahlung in Phasen?', fr: 'Comment fonctionnent les paiements par étapes ?', es: '¿Cómo funcionan los pagos por fases?' }
    ],
    diensten: [
      { nl: 'Hoe lang duurt tooling?', en: 'How long does tooling take?', de: 'Wie lange dauert das Tooling?', fr: 'Combien de temps prend l’outillage ?', es: '¿Cuánto tarda el tooling?' },
      { nl: 'Wat gebeurt er in de samplefase?', en: 'What happens in the sampling phase?', de: 'Was passiert in der Sampling-Phase?', fr: 'Que se passe-t-il pendant la phase d’échantillonnage ?', es: '¿Qué ocurre en la fase de muestras?' },
      { nl: 'Wanneer betaal ik wat?', en: 'When do I pay what?', de: 'Wann zahle ich was?', fr: 'Quand est-ce que je paie quoi ?', es: '¿Cuándo pago qué?' }
    ],
    relatiegeschenken: [
      { nl: 'Wat is de minimale oplage?', en: 'What is the minimum quantity?', de: 'Was ist die Mindestmenge?', fr: 'Quelle est la quantité minimale ?', es: '¿Cuál es la cantidad mínima?' },
      { nl: 'Kan ik eerst een sample krijgen?', en: 'Can I get a sample first?', de: 'Kann ich zuerst ein Muster bekommen?', fr: 'Puis-je d’abord recevoir un échantillon ?', es: '¿Puedo recibir primero una muestra?' },
      { nl: 'Welke gelegenheden passen bij een geschenkdoos?', en: 'Which occasions suit a gift box?', de: 'Welche Anlässe passen zu einer Geschenkbox?', fr: 'Quelles occasions conviennent à un coffret cadeau ?', es: '¿Qué ocasiones encajan con una caja de regalo?' }
    ],
    ecommerce: [
      { nl: 'Wat is white label?', en: 'What is white label?', de: 'Was ist White Label?', fr: 'Qu’est-ce que le White Label ?', es: '¿Qué es White Label?' },
      { nl: 'Werken jullie in mijn sector?', en: 'Do you work in my sector?', de: 'Arbeiten Sie in meiner Branche?', fr: 'Travaillez-vous dans mon secteur ?', es: '¿Trabajan en mi sector?' },
      { nl: 'Hoe bescherm ik mijn ontwerp?', en: 'How do I protect my design?', de: 'Wie schütze ich mein Design?', fr: 'Comment protéger mon design ?', es: '¿Cómo protejo mi diseño?' }
    ],
    blog: [
      { nl: 'Wat is AQL?', en: 'What is AQL?', de: 'Was ist AQL?', fr: 'Qu’est-ce que l’AQL ?', es: '¿Qué es AQL?' },
      { nl: 'Wat kost een sample echt?', en: 'What does a sample really cost?', de: 'Was kostet ein Muster wirklich?', fr: 'Combien coûte vraiment un échantillon ?', es: '¿Cuánto cuesta realmente una muestra?' },
      { nl: 'Is een MOQ onderhandelbaar?', en: 'Is an MOQ negotiable?', de: 'Ist eine MOQ verhandelbar?', fr: 'Un MOQ est-il négociable ?', es: '¿Es negociable un MOQ?' }
    ],
    faq: [
      { nl: 'Hoe beschermen jullie mijn IP?', en: 'How do you protect my IP?', de: 'Wie schützen Sie mein geistiges Eigentum?', fr: 'Comment protégez-vous ma propriété intellectuelle ?', es: '¿Cómo protegen mi propiedad intelectual?' },
      { nl: 'Wat als de productie afwijkt?', en: 'What if production comes back off spec?', de: 'Was, wenn die Produktion abweicht?', fr: 'Et si la production n’est pas conforme ?', es: '¿Y si la producción no cumple la especificación?' },
      { nl: 'Hoe verschilt dit van een sourcing agent?', en: 'How is this different from a sourcing agent?', de: 'Was unterscheidet Sie von einem Sourcing-Agenten?', fr: 'Quelle différence avec un agent de sourcing ?', es: '¿En qué se diferencia de un agente de sourcing?' }
    ],
    'waarom-china': [
      { nl: 'Welke risico’s dekken jullie af?', en: 'Which risks do you cover?', de: 'Welche Risiken decken Sie ab?', fr: 'Quels risques couvrez-vous ?', es: '¿Qué riesgos cubren?' },
      { nl: 'Wat is een NNN?', en: 'What is an NNN?', de: 'Was ist ein NNN?', fr: 'Qu’est-ce qu’un NNN ?', es: '¿Qué es un NNN?' },
      { nl: 'Hoe controleren jullie kwaliteit?', en: 'How do you check quality?', de: 'Wie prüfen Sie die Qualität?', fr: 'Comment contrôlez-vous la qualité ?', es: '¿Cómo controlan la calidad?' }
    ],
    product: [
      { nl: '10.000 notitieboekjes met ons logo', en: '10,000 notebooks with our logo', de: '10.000 Notizbücher mit unserem Logo', fr: '10 000 carnets avec notre logo', es: '10.000 cuadernos con nuestro logo' },
      { nl: 'Een siliconen keukenhulp in onze kleur', en: 'A silicone kitchen tool in our colour', de: 'Ein Küchenhelfer aus Silikon in unserer Farbe', fr: 'Un ustensile de cuisine en silicone à notre couleur', es: 'Un utensilio de cocina de silicona en nuestro color' },
      { nl: 'Een verpakking voor onze cosmetica', en: 'Packaging for our cosmetics', de: 'Eine Verpackung für unsere Kosmetik', fr: 'Un emballage pour nos cosmétiques', es: 'Un envase para nuestros cosméticos' }
    ]
  };

  /* ------------------------------------------------------------- hulpjes */
  function readLang() {
    var v = '';
    try { v = window.localStorage.getItem('cp_lang') || ''; } catch (e) { v = ''; }
    if (CODES.indexOf(v) < 0) v = String(document.documentElement.lang || '').slice(0, 2).toLowerCase();
    return CODES.indexOf(v) >= 0 ? v : 'nl';
  }
  var lang = readLang();
  function T(nl) {
    if (lang === 'nl') return nl;
    var row = DICT[nl];
    return (row && row[lang]) || nl;
  }
  function chipText(c) { return c[lang] || c.nl; }

  /* DOM zonder innerHTML: el('p', { 'class': 'x', text: 'hoi' }, [kind]) */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'text') n.appendChild(document.createTextNode(attrs[k]));
        else if (k === 'class') n.className = attrs[k];
        else n.setAttribute(k, attrs[k]);
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        if (children[i] == null) continue;
        n.appendChild(typeof children[i] === 'string' ? document.createTextNode(children[i]) : children[i]);
      }
    }
    return n;
  }
  function svg(paths, size) {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', size || '1.8');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < paths.length; i++) {
      var p = document.createElementNS(NS, 'path'); p.setAttribute('d', paths[i]); s.appendChild(p);
    }
    return s;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  var reduced = false;
  try { reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduced = false; }

  function pageKey() {
    var p = window.location.pathname;
    if (p === '/' || p === '/index.html') return 'home';
    var m = p.match(/^\/(diensten|relatiegeschenken|ecommerce|blog|faq|waarom-china)(\/|$)/);
    return m ? m[1] : 'home';
  }

  /* ------------------------------------------------------------- toestand */
  var state = { mode: 'site', open: false, threads: { site: [], product: [] } };
  function loadState() {
    try {
      var raw = window.sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return;
      if (s.mode === 'product') state.mode = 'product';
      state.open = !!s.open;
      if (s.threads && typeof s.threads === 'object') {
        ['site', 'product'].forEach(function (m) {
          if (Array.isArray(s.threads[m])) {
            state.threads[m] = s.threads[m].filter(function (x) {
              return x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string';
            }).slice(-MAX_HISTORY * 2);
          }
        });
      }
    } catch (e) { /* geen opslag: het gesprek leeft dan alleen op deze pagina */ }
  }
  function saveState() {
    try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* zie boven */ }
  }
  function thread() { return state.threads[state.mode]; }

  /* --------------------------------------------------------------- opbouw */
  var fab = el('button', { 'class': 'cpc-fab', type: 'button', 'aria-label': T('Chat met CUSTOM+'), 'aria-expanded': 'false', 'aria-controls': 'cpc-panel' });
  var fabOpen = svg(['M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.2V17H6.5A2.5 2.5 0 0 1 4 14.5z', 'M8 9h8', 'M8 12.5h5'], '1.7');
  fabOpen.setAttribute('class', 'cpc-fab__open');
  var fabClose = svg(['M6 6 L18 18', 'M18 6 L6 18'], '1.8');
  fabClose.setAttribute('class', 'cpc-fab__close');
  fab.appendChild(fabOpen); fab.appendChild(fabClose);

  var titleEl = el('h2', { 'class': 'cpc-title', id: 'cpc-title', text: T('Vraag het CUSTOM+') });
  var subEl = el('span', { 'class': 'cpc-sub', text: T('Antwoorden uit de site, geen offerte') });
  var closeBtn = el('button', { 'class': 'cpc-close', type: 'button', 'aria-label': T('Sluiten') }, [svg(['M6 6 L18 18', 'M18 6 L6 18'], '1.6')]);
  /* het avatarvlak is decoratie naast de kop; de kop zelf benoemt het venster */
  var avatar = el('span', { 'class': 'cpc-avatar', 'aria-hidden': 'true', text: 'C+' });
  var head = el('div', { 'class': 'cpc-head' }, [avatar, el('div', { 'class': 'cpc-head__text' }, [titleEl, subEl]), closeBtn]);

  var modeSite = el('button', { 'class': 'cpc-mode', type: 'button', 'aria-pressed': 'true', text: T('Vraag') });
  var modeProduct = el('button', { 'class': 'cpc-mode', type: 'button', 'aria-pressed': 'false', text: T('Productidee') });
  var modes = el('div', { 'class': 'cpc-modes', role: 'group', 'aria-label': T('Vraag') + ' / ' + T('Productidee') }, [modeSite, modeProduct]);

  var threadEl = el('div', { 'class': 'cpc-thread', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  var chipsEl = el('div', { 'class': 'cpc-chips' });

  var input = el('textarea', { 'class': 'cpc-input', rows: '1', maxlength: String(MAX_CHARS), 'aria-label': T('Typ je vraag'), placeholder: T('Typ je vraag') + '…', autocomplete: 'off' });
  var sendBtn = el('button', { 'class': 'cpc-send', type: 'submit', 'aria-label': T('Verstuur') }, [svg(['M12 19V6', 'M6 12l6-6 6 6'], '1.8')]);
  var bar = el('div', { 'class': 'cpc-bar' }, [input, sendBtn]);
  var counter = el('span', { 'class': 'cpc-counter', 'aria-live': 'off', text: '0/' + MAX_CHARS });
  var hint = el('span', { 'class': 'cpc-hint', text: T('Enter verstuurt, Shift+Enter voor een nieuwe regel') });
  var form = el('form', { 'class': 'cpc-form', novalidate: '' }, [bar, el('div', { 'class': 'cpc-meta' }, [hint, counter])]);

  var briefBtn = el('button', { 'class': 'cpc-exit cpc-exit--primary', type: 'button', text: T('Start je briefing') });
  var callLink = el('a', { 'class': 'cpc-exit', href: CAL_FALLBACK, target: '_blank', rel: 'noopener', 'aria-label': T('Plan een gesprek') + ' (' + T('opent in een nieuw tabblad') + ')', text: T('Plan een gesprek') });
  var mailBtn = el('button', { 'class': 'cpc-exit', type: 'button', 'aria-expanded': 'false', text: T('Mail me dit gesprek') });
  var mailInput = el('input', { type: 'email', 'aria-label': T('Je e-mailadres'), placeholder: T('Je e-mailadres'), autocomplete: 'email' });
  var hp = el('input', { 'class': 'cpc-hp', type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  var mailSend = el('button', { 'class': 'cpc-exit cpc-exit--primary', type: 'submit', text: T('Verzenden') });
  var mailCancel = el('button', { 'class': 'cpc-exit', type: 'button', text: T('Annuleren') });
  var mailNote = el('p', { 'class': 'cpc-mail__note', 'aria-live': 'polite' });
  var mailForm = el('form', { 'class': 'cpc-mail', novalidate: '', hidden: '' }, [mailInput, hp, mailSend, mailCancel, mailNote]);
  var exits = el('div', { 'class': 'cpc-exits' }, [briefBtn, callLink, mailBtn, mailForm]);

  var panel = el('div', { 'class': 'cpc-panel', id: 'cpc-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cpc-title', hidden: '' },
    [head, modes, threadEl, chipsEl, form, exits]);

  /* de knop ná het paneel in de DOM, zodat de CSS-regel "paneel open →
     knop weg op mobiel" met een broerselector kan */
  document.body.appendChild(panel);
  document.body.appendChild(fab);

  /* --------------------------------------------------------------- weergave */
  function scrollDown() {
    try { threadEl.scrollTo({ top: threadEl.scrollHeight, behavior: reduced ? 'auto' : 'smooth' }); }
    catch (e) { threadEl.scrollTop = threadEl.scrollHeight; }
  }
  function bubble(role, text, muted) {
    var b = el('div', { 'class': 'cpc-msg cpc-msg--' + (role === 'user' ? 'user' : 'ai') + (muted ? ' is-muted' : '') });
    b.appendChild(document.createTextNode(text || ''));
    threadEl.appendChild(b);
    return b;
  }
  function typingOn() {
    typingOff();
    var t = el('div', { 'class': 'cpc-typing', role: 'status', 'aria-label': T('Assistent typt') }, [el('i'), el('i'), el('i')]);
    t.setAttribute('data-typing', '');
    threadEl.appendChild(t);
    scrollDown();
  }
  function typingOff() {
    var t = threadEl.querySelector('[data-typing]');
    if (t) threadEl.removeChild(t);
  }
  function sourcesRow(list) {
    if (!list || !list.length) return null;
    var row = el('div', { 'class': 'cpc-sources' }, [el('span', { 'class': 'cpc-sources__label', text: T('Op de site') })]);
    for (var i = 0; i < list.length; i++) {
      if (!list[i] || !list[i].url) continue;
      row.appendChild(el('a', { href: list[i].url, text: list[i].titel || list[i].url }));
    }
    return row;
  }
  function fallbackBlock() {
    var b = el('button', { 'class': 'cpc-exit cpc-exit--primary', type: 'button', text: T('Start je briefing') });
    b.addEventListener('click', startBriefing);
    var block = el('div', { 'class': 'cpc-fallback', role: 'status' }, [
      el('strong', { text: T('De chat is even niet beschikbaar.') }),
      el('p', { text: T('Stel je vraag via de briefing, dan antwoordt Steffan persoonlijk.') }),
      b
    ]);
    threadEl.appendChild(block);
    scrollDown();
  }

  /* "Lees meer: titel"-regels uit de tekst halen; de titel wordt een link
     als hij bij een meegestuurde bron hoort. */
  function splitReadMore(text, sources) {
    var label = T('Lees meer:').toLowerCase();
    var lines = String(text).split('\n');
    var keep = [], links = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (ln.toLowerCase().indexOf(label) === 0) {
        var title = ln.slice(label.length).trim().replace(/[.]+$/, '');
        var hit = null;
        for (var j = 0; j < sources.length; j++) {
          if (sources[j].titel && sources[j].titel.toLowerCase() === title.toLowerCase()) { hit = sources[j]; break; }
        }
        if (!hit) {
          for (j = 0; j < sources.length; j++) {
            if (sources[j].titel && (sources[j].titel.toLowerCase().indexOf(title.toLowerCase()) >= 0 || title.toLowerCase().indexOf(sources[j].titel.toLowerCase()) >= 0)) { hit = sources[j]; break; }
          }
        }
        if (hit) { if (links.indexOf(hit) < 0) links.push(hit); continue; }
        /* niet herkend: de regel blijft gewone tekst, er wordt geen link verzonnen */
      }
      keep.push(lines[i]);
    }
    return { text: keep.join('\n').replace(/\n{3,}/g, '\n\n').trim(), links: links };
  }

  function renderAnswer(parts, sources, unknown) {
    var links = [];
    var last = null;
    for (var i = 0; i < parts.length; i++) {
      var r = splitReadMore(parts[i], sources || []);
      links = links.concat(r.links.filter(function (l) { return links.indexOf(l) < 0; }));
      if (r.text) last = bubble('assistant', r.text, false);
    }
    if (!unknown) {
      /* geen bron genoemd maar wel een antwoord: toon dan de stukken die de
         server gebruikte, zodat de bezoeker altijd kan controleren */
      if (!links.length && sources && sources.length) links = sources.slice(0, 2);
      var row = sourcesRow(links);
      if (row) threadEl.appendChild(row);
    }
    return last;
  }

  function renderThread() {
    clear(threadEl);
    bubble('assistant', T(state.mode === 'product'
      ? 'Beschrijf je productidee. Je krijgt een eerste inschatting van materiaal, MOQ en de logische eerste stap.'
      : 'Stel je vraag over hoe wij werken. Ik antwoord alleen met wat er op deze site staat.'), true);
    var msgs = thread();
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user') bubble('user', msgs[i].content);
      else renderAnswer(msgs[i].parts || [msgs[i].content], msgs[i].sources || [], !!msgs[i].unknown);
    }
    renderChips();
    scrollDown();
  }

  function renderChips() {
    clear(chipsEl);
    var hasUser = thread().some(function (m) { return m.role === 'user'; });
    if (hasUser) { chipsEl.setAttribute('hidden', ''); return; }
    chipsEl.removeAttribute('hidden');
    var list = state.mode === 'product' ? CHIPS.product : (CHIPS[pageKey()] || CHIPS.home);
    for (var i = 0; i < list.length; i++) {
      (function (txt) {
        var chev = svg(['M9 6l6 6-6 6'], '1.6');
        chev.setAttribute('class', 'cpc-chip__chev');
        var c = el('button', { 'class': 'cpc-chip', type: 'button' }, [el('span', { text: txt }), chev]);
        c.addEventListener('click', function () { input.value = txt; send(); });
        chipsEl.appendChild(c);
      })(chipText(list[i]));
    }
  }

  function setMode(m) {
    if (state.mode === m) return;
    state.mode = m;
    modeSite.setAttribute('aria-pressed', m === 'site' ? 'true' : 'false');
    modeProduct.setAttribute('aria-pressed', m === 'product' ? 'true' : 'false');
    var ph = T(m === 'product' ? 'Beschrijf je productidee' : 'Typ je vraag');
    input.setAttribute('placeholder', ph + '…'); input.setAttribute('aria-label', ph);
    saveState();
    renderThread();
    input.focus();
  }
  modeSite.addEventListener('click', function () { setMode('site'); });
  modeProduct.addEventListener('click', function () { setMode('product'); });

  /* --------------------------------------------------------------- invoer */
  function updateCounter() {
    var n = input.value.length;
    counter.firstChild.nodeValue = n + '/' + MAX_CHARS;
    /* de teller komt pas in beeld als het maximum in zicht is; de verstuurknop
       wordt pas donker zodra er echt iets te versturen valt */
    counter.className = n >= MAX_CHARS ? 'cpc-counter is-max' : (n >= NEAR_CHARS ? 'cpc-counter is-near' : 'cpc-counter');
    bar.className = input.value.trim() ? 'cpc-bar is-ready' : 'cpc-bar';
    input.style.height = 'auto';
    input.style.height = Math.min(120, input.scrollHeight) + 'px';
  }
  input.addEventListener('input', updateCounter);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(); });

  var busy = false;
  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    input.disabled = b;
    if (!b) { input.focus(); }
  }

  /* SSE-stroom van de functie lezen. Geen ReadableStream (oude browser)? Dan
     het hele antwoord in één keer. */
  function parseEvents(chunk, onEvent) {
    var evs = chunk.split('\n\n');
    for (var i = 0; i < evs.length; i++) {
      var lines = evs[i].split('\n');
      for (var j = 0; j < lines.length; j++) {
        var ln = lines[j];
        if (ln.indexOf('data:') !== 0) continue;
        var d = null;
        try { d = JSON.parse(ln.slice(5).trim()); } catch (e) { d = null; }
        if (d) onEvent(d);
      }
    }
  }
  function streamPost(payload, h) {
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) {
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('text/event-stream') < 0) {
          return res.json().then(function (d) { h.json(d, res.status); }, function () { h.json(null, res.status); });
        }
        if (!res.body || !window.TextDecoder) {
          return res.text().then(function (t) { parseEvents(t, h.event); h.end(); });
        }
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var buf = '';
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) { if (buf) parseEvents(buf, h.event); h.end(); return; }
            buf += dec.decode(r.value, { stream: true });
            var idx;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              parseEvents(buf.slice(0, idx), h.event);
              buf = buf.slice(idx + 2);
            }
            return pump();
          });
        }
        return pump();
      })
      .then(null, h.error);
  }

  function send() {
    if (busy) return;
    var q = input.value.trim();
    if (!q) return;
    if (q.length > MAX_CHARS) q = q.slice(0, MAX_CHARS);
    var msgs = thread();
    msgs.push({ role: 'user', content: q });
    bubble('user', q);
    input.value = ''; updateCounter();
    renderChips();
    saveState();
    setBusy(true);
    typingOn();

    var history = msgs.slice(-MAX_HISTORY).map(function (m) { return { role: m.role, content: m.content }; });
    var sources = [];
    var acc = '';
    var bubbles = [];
    var finished = false;

    /* (a) live typen toont een delta al vóór het server side gefilterd wordt
       (stripInventedAmounts en co draaien pas op de volledige tekst in
       finish()/fail()), dus een verzonnen bedrag kan héél even in beeld
       staan tijdens het typen. Dat venster volledig dichten zonder het live
       typen zelf op te geven kan niet redelijk binnen deze scope: het zou
       betekenen dat er niets getoond wordt voor het hele antwoord binnen
       is. Bewust geaccepteerd risico dus, kort van duur: zodra done()
       binnenkomt worden deze bubbels hieronder altijd weggehaald en
       vervangen door de gefilterde ev.parts, nooit door de ruwe acc. */
    function liveRender() {
      var parts = acc.split(/\n[ \t]*-{3,}[ \t]*\n?/);
      for (var i = 0; i < parts.length; i++) {
        if (!bubbles[i]) bubbles[i] = bubble('assistant', '');
        bubbles[i].firstChild.nodeValue = parts[i].replace(/^\s+/, '');
      }
      scrollDown();
    }
    function done(ev) {
      if (finished) return;
      finished = true;
      typingOff();
      for (var i = 0; i < bubbles.length; i++) threadEl.removeChild(bubbles[i]);
      bubbles = [];
      /* alleen de gefilterde parts van de server tonen of bewaren, nooit de
         ruwe opgetelde acc: zie fix (b) hieronder bij end(), en de reden
         daarvoor in de uitleg boven liveRender(). Een leeg parts-array
         (server hield na filteren niets verifieerbaars over) valt dus ook
         niet meer terug op de ruwe tekst, maar op het foutscherm hieronder. */
      var parts = (ev && ev.parts) ? ev.parts : [];
      var unknown = !!(ev && ev.unknown);
      if (!parts.length) { fallbackBlock(); setBusy(false); return; }
      renderAnswer(parts, sources, unknown);
      msgs.push({ role: 'assistant', content: parts.join('\n\n'), parts: parts, sources: sources, unknown: unknown });
      saveState();
      setBusy(false);
      scrollDown();
      if (!state.open) fab.className = 'cpc-fab has-unread';
      if (unknown && state.mode === 'site') {
        /* de vraag waarop de site geen antwoord had, gaat naar de lijst
           waarmee Steffan de site kan aanvullen; stil, niets voor de bezoeker */
        try {
          fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unanswered', vraag: q, page: window.location.pathname, lang: lang }) })
            .then(null, function () { });
        } catch (e) { /* niets */ }
      }
    }
    function fail() {
      if (finished) return;
      finished = true;
      typingOff();
      for (var i = 0; i < bubbles.length; i++) threadEl.removeChild(bubbles[i]);
      bubbles = [];
      fallbackBlock();
      setBusy(false);
    }

    streamPost({ action: 'chat', messages: history, lang: lang, page: window.location.pathname, mode: state.mode }, {
      event: function (d) {
        /* het slotevent draagt ook de bronnen mee, dus eerst op done toetsen */
        if (d.done) { if (d.sources) sources = d.sources; done(d); return; }
        if (d.fallback) { fail(); return; }
        if (d.sources) { sources = d.sources; return; }
        if (typeof d.delta === 'string') { typingOff(); acc += d.delta; liveRender(); }
      },
      /* Eindigt de stroom zonder dat er ooit een done-event binnenkwam, dan
         is de opgetelde acc nooit server side gefilterd (geen
         stripInventedAmounts, geen stripReadMore). Vroeger viel dit terug op
         die ruwe tekst (done(null) las dan acc.trim() als parts), en die
         belandde zo permanent in de gespreksgeschiedenis in sessionStorage.
         Nu behandelen we dit net als elke andere foutmelding: fail(), met
         hetzelfde foutscherm/dezelfde uitweg als de andere foutpaden. Nooit
         ongeverifieerde tekst tonen of bewaren. */
      end: function () { if (!finished) fail(); },
      json: function (d) {
        /* JSON in plaats van een stroom: uitval, limiet of budget. Het
           briefingblok is hier het antwoord, geen foutmelding. */
        if (d && d.error === 'too-long') { fail(); return; }
        fail();
      },
      error: function () {
        if (finished) return;
        finished = true;
        typingOff();
        for (var i = 0; i < bubbles.length; i++) threadEl.removeChild(bubbles[i]);
        bubbles = [];
        bubble('assistant', T('Geen verbinding. Probeer het zo nog eens, of start je briefing.'), true);
        setBusy(false);
      }
    });
  }

  /* --------------------------------------------------------------- uitwegen */
  function summary() {
    var msgs = thread();
    var lines = [T('Uit de sitechat:')];
    for (var i = 0; i < msgs.length; i++) {
      lines.push((msgs[i].role === 'user' ? T('Ik') : T('Assistent')) + ': ' + msgs[i].content.replace(/\s+/g, ' ').trim());
    }
    var s = lines.join('\n');
    return s.length > 1500 ? s.slice(0, 1497) + '…' : s;
  }
  function startBriefing() {
    var sum = summary();
    try { window.sessionStorage.setItem(BRIEF_KEY, sum); } catch (e) { /* niets */ }
    try {
      var existing = null;
      try { existing = JSON.parse(window.localStorage.getItem(FORM_KEY) || 'null'); } catch (e2) { existing = null; }
      if (!existing || typeof existing !== 'object') existing = {};
      var brief = (existing.brief && typeof existing.brief === 'object') ? existing.brief : {};
      brief.door = brief.door || 'scratch';
      var had = typeof brief.message === 'string' ? brief.message.trim() : '';
      if (had.indexOf(sum) < 0) brief.message = had ? had + '\n\n' + sum : sum;
      existing.brief = brief;
      existing.updatedAt = Date.now();
      window.localStorage.setItem(FORM_KEY, JSON.stringify(existing));
    } catch (e) { /* zonder opslag komt de bezoeker toch op /contact uit */ }
    /* een hook voor de app zelf, als die er ooit is; anders de gewone weg */
    if (typeof window.cpSetBriefPrefill === 'function') {
      try { window.cpSetBriefPrefill({ message: sum }); } catch (e3) { /* niets */ }
    }
    window.location.assign('/contact');
  }
  briefBtn.addEventListener('click', startBriefing);

  mailBtn.addEventListener('click', function () {
    var open = mailForm.hasAttribute('hidden');
    if (open) { mailForm.removeAttribute('hidden'); mailBtn.setAttribute('aria-expanded', 'true'); mailInput.focus(); }
    else { mailForm.setAttribute('hidden', ''); mailBtn.setAttribute('aria-expanded', 'false'); }
  });
  mailCancel.addEventListener('click', function () {
    mailForm.setAttribute('hidden', ''); mailBtn.setAttribute('aria-expanded', 'false'); mailBtn.focus();
  });
  function note(text) { clear(mailNote); mailNote.appendChild(document.createTextNode(text)); }
  mailForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = mailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note(T('Vul een geldig e-mailadres in.')); mailInput.focus(); return; }
    var transcript = thread().slice(-MAX_HISTORY).map(function (m) { return { role: m.role, content: m.content }; });
    mailSend.disabled = true;
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lead', email: email, transcript: transcript, page: window.location.pathname, lang: lang, website: hp.value }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (x) {
        mailSend.disabled = false;
        /* alleen "gelukt" zeggen als de server dat ook echt zegt */
        if (x.ok && x.d && x.d.ok) { note(T('Verstuurd. Steffan heeft het gesprek en je adres en reageert persoonlijk.')); mailInput.value = ''; }
        else note(T('Versturen is niet gelukt. Start je briefing of plan een gesprek, dan komt het goed.'));
      }, function () {
        mailSend.disabled = false;
        note(T('Versturen is niet gelukt. Start je briefing of plan een gesprek, dan komt het goed.'));
      });
  });

  /* de echte agenda-URL uit de sitecontent; pas bij het openen, één keer */
  var calLoaded = false;
  function loadCal() {
    if (calLoaded) return;
    calLoaded = true;
    fetch('/content/global.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (g) {
      var u = g && g.callBooking && g.callBooking.url;
      if (typeof u === 'string' && /^https:\/\//i.test(u.trim())) callLink.href = u.trim();
    }, function () { /* terugval blijft staan */ });
  }

  /* --------------------------------------------------------------- open/dicht */
  var opener = null;
  function focusables() {
    var all = panel.querySelectorAll('button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (n.disabled || n.getAttribute('aria-hidden') === 'true') continue;
      var p = n;
      var hidden = false;
      while (p && p !== panel) { if (p.hasAttribute('hidden')) { hidden = true; break; } p = p.parentNode; }
      if (!hidden) out.push(n);
    }
    return out;
  }
  function openPanel(focusInput) {
    if (state.open && !panel.hasAttribute('hidden')) return;
    opener = document.activeElement;
    state.open = true; saveState();
    panel.removeAttribute('hidden');
    fab.setAttribute('aria-expanded', 'true');
    fab.className = 'cpc-fab';
    document.documentElement.className += ' cpc-lock';
    loadCal();
    /* de klasse ná het tonen zetten, anders speelt de overgang niet */
    window.setTimeout(function () { panel.className = 'cpc-panel is-open'; }, 10);
    if (focusInput !== false) window.setTimeout(function () { input.focus(); }, reduced ? 0 : 200);
    scrollDown();
  }
  function closePanel() {
    if (panel.hasAttribute('hidden')) return;
    state.open = false; saveState();
    panel.className = 'cpc-panel';
    fab.setAttribute('aria-expanded', 'false');
    document.documentElement.className = document.documentElement.className.replace(/\s*cpc-lock/g, '');
    window.setTimeout(function () { panel.setAttribute('hidden', ''); }, reduced ? 0 : 350);
    /* terug naar waar de bezoeker vandaan kwam; was dat nergens (body), dan
       naar de knop, anders verdwijnt de focus in het niets */
    var back = (opener && opener.focus && opener !== document.body && opener !== document.documentElement
      && document.body.contains(opener) && !panel.contains(opener)) ? opener : fab;
    back.focus();
  }
  fab.addEventListener('click', function () {
    if (panel.hasAttribute('hidden')) openPanel(true); else closePanel();
  });
  closeBtn.addEventListener('click', closePanel);
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* --------------------------------------------------------------- start */
  loadState();
  if (state.mode === 'product') {
    modeSite.setAttribute('aria-pressed', 'false'); modeProduct.setAttribute('aria-pressed', 'true');
    input.setAttribute('placeholder', T('Beschrijf je productidee') + '…'); input.setAttribute('aria-label', T('Beschrijf je productidee'));
  }
  renderThread();
  /* stond het paneel open op de vorige pagina, dan blijft het open; zonder
     de focus te stelen van de pagina die net laadt */
  if (state.open) { state.open = false; openPanel(false); }

  /* voor de testpagina en eventuele koppelingen vanuit de app */
  window.CP_CHAT = { open: function () { openPanel(true); }, close: closePanel, send: function (q) { input.value = q; send(); }, setMode: setMode, lang: lang };
  /* haak voor de e-commercepagina: paneel open in productmodus en meteen de
     eerste vraag stellen; send() bewaakt zelf de busy-vergrendeling en het maximum */
  window.cpChat = {
    open: function () { openPanel(true); },
    setMode: function (m) { setMode(m); },
    ask: function (q) {
      setMode('product'); openPanel(true);
      if (q) { input.value = String(q).slice(0, MAX_CHARS); updateCounter(); send(); }
    }
  };
})();
