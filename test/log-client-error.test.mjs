/* CUSTOM+ foutlogboek — tests zonder netwerk.
   ------------------------------------------------------------------
   Twee lagen:
     1. validateBody(): de velden zelf — app/message/stack/url/lang/client_id,
        afkappen versus weigeren, de originecontrole op het url-veld.
     2. de functie zelf (handler): methode, CORS, de config-check (204 zonder
        Supabase-omgeving), de snelheidslimiet en de vorm van de RPC-aanroep
        naar log_client_error. Supabase wordt nagebootst via globalThis.fetch;
        er gaat niets de deur uit.
   ------------------------------------------------------------------ */

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL', 'PORTAL_BASE_URL'];

function req(body, extra) {
  extra = extra || {};
  const headers = { 'content-type': 'application/json', origin: 'https://custom-plus.nl', 'x-forwarded-for': extra.ip || '10.0.0.1' };
  if (extra.origin !== undefined) { if (extra.origin) headers.origin = extra.origin; else delete headers.origin; }
  const method = extra.method || 'POST';
  return new Request('https://custom-plus.nl/.netlify/functions/log-client-error', {
    method, headers, body: method === 'GET' ? undefined : (extra.rawBody !== undefined ? extra.rawBody : JSON.stringify(body))
  });
}

export default async function (t) {
  const origFetch = globalThis.fetch;
  const origEnv = {};
  ENV_KEYS.forEach((k) => { origEnv[k] = process.env[k]; delete process.env[k]; });

  try {
    const lce = await import('../netlify/functions/log-client-error.mjs');
    lce.__resetState();

    /* ================================================================ 1. validatie */
    t.group('validatie: velden');

    t.deep(lce.APP_VALUES, ['site', 'portal', 'beheer'], 'drie toegestane apps');
    t.eq(lce.MAX_MESSAGE_CHARS, 500, 'message hoogstens 500 tekens');
    t.eq(lce.MAX_STACK_CHARS, 4000, 'stack hoogstens 4000 tekens (afgekapt)');
    t.eq(lce.MAX_URL_CHARS, 300, 'url hoogstens 300 tekens');
    t.eq(lce.RATE_LIMIT, 30, 'per IP 30 per uur');
    t.eq(lce.RATE_WINDOW_MS, 60 * 60 * 1000, 'snelheidsvenster is een uur');

    const fakeReq = { url: 'https://custom-plus.nl/.netlify/functions/log-client-error' };

    t.eq(lce.validateBody(fakeReq, null).error, 'bad-json', 'lege body: bad-json');
    t.eq(lce.validateBody(fakeReq, {}).error, 'invalid-app', 'geen app: invalid-app');
    t.eq(lce.validateBody(fakeReq, { app: 'anders', message: 'x' }).error, 'invalid-app', 'onbekende app: invalid-app');
    ['site', 'portal', 'beheer'].forEach((app) => {
      const v = lce.validateBody(fakeReq, { app, message: 'Een fout' });
      t.eq(v.error, undefined, 'app "' + app + '" is toegestaan');
      t.eq(v.app, app, 'app "' + app + '" komt terug in het resultaat');
    });

    t.eq(lce.validateBody(fakeReq, { app: 'site' }).error, 'invalid-message', 'geen message: invalid-message');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: '   ' }).error, 'invalid-message', 'alleen witruimte: invalid-message');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'x'.repeat(500) }).error, undefined, '500 tekens mag nog');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'x'.repeat(501) }).error, 'invalid-message', '501 tekens: invalid-message, geweigerd (niet afgekapt)');

    const metStack = lce.validateBody(fakeReq, { app: 'site', message: 'fout', stack: 'y'.repeat(5000) });
    t.eq(metStack.error, undefined, 'een lange stack wordt niet geweigerd');
    t.eq(metStack.stack.length, 4000, 'de stack wordt afgekapt op 4000 tekens');

    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'fout', url: 'https://custom-plus.nl/' + 'a'.repeat(300) }).error, 'invalid-url', 'te lange url: invalid-url');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'fout', url: 'https://custom-plus.nl/pagina' }).error, undefined, 'url op de eigen oorsprong mag');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'fout', url: 'https://kwaad.example/pagina' }).error, 'invalid-url', 'url op een vreemde oorsprong: invalid-url');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'fout', url: 'niet-een-url' }).error, 'invalid-url', 'onparsbare url: invalid-url');
    t.eq(lce.validateBody(fakeReq, { app: 'site', message: 'fout' }).url, '', 'geen url: leeg, geen fout');

    const localReq = { url: 'http://localhost:8888/.netlify/functions/log-client-error' };
    t.eq(lce.validateBody(localReq, { app: 'site', message: 'fout', url: 'http://localhost:3000/pagina' }).error, undefined, 'lokaal (welke poort dan ook) mag ook voor het url-veld');

    const metLang = lce.validateBody(fakeReq, { app: 'site', message: 'fout', lang: 'nederlands-lang-woord' });
    t.eq(metLang.lang.length, 10, 'lang wordt afgekapt op 10 tekens');

    const metClient = lce.validateBody(fakeReq, { app: 'site', message: 'fout', client_id: 'ab cd!$%ef_gh-12' + 'z'.repeat(60) });
    t.true(/^[A-Za-z0-9_-]+$/.test(metClient.clientId), 'client_id houdt alleen brave tekens over');
    t.true(metClient.clientId.length <= 64, 'client_id wordt afgekapt op 64 tekens');
    t.eq(metClient.clientId.indexOf(' '), -1, 'spaties zijn uit client_id gestript');

    t.eq(lce.validateBody(fakeReq, { app: 'site', message: '  fout met spaties  ' }).message, 'fout met spaties', 'message wordt getrimd');

    /* ================================================================ 2. methode en CORS */
    t.group('functie: methode en CORS');
    const handler = lce.default;

    let r = await handler(req({ app: 'site', message: 'x' }, { method: 'GET' }));
    t.eq(r.status, 405, 'GET is niet toegestaan');

    r = await handler(req({ app: 'site', message: 'x' }, { origin: 'https://kwaad.example' }));
    t.eq(r.status, 403, 'vreemde oorsprong wordt geweigerd');

    r = await handler(req(null, { rawBody: '{niet json' }));
    t.eq(r.status, 400, 'kapotte JSON: 400');
    t.eq((await r.json()).error, 'bad-json', 'foutcode bad-json');

    /* ================================================================ 3. niet geconfigureerd */
    t.group('functie: niet geconfigureerd');
    let calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };

    r = await handler(req({ app: 'site', message: 'Kapotte knop' }));
    t.eq(r.status, 204, 'zonder Supabase-omgeving: 204, geen verzonnen succes');
    const txt = await r.text();
    t.eq(txt, '', 'een 204-antwoord heeft geen inhoud');
    t.eq(calls.length, 0, 'zonder omgeving wordt Supabase niet aangeroepen, er wordt niets gelogd');

    /* alleen SUPABASE_URL, geen sleutel: nog steeds niet geconfigureerd */
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    r = await handler(req({ app: 'site', message: 'Kapotte knop' }));
    t.eq(r.status, 204, 'alleen SUPABASE_URL zonder sleutel telt nog als niet geconfigureerd');
    delete process.env.SUPABASE_URL;

    /* ================================================================ 4. opslaan via de RPC */
    t.group('functie: opslaan via de RPC');
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-sleutel';
    process.env.URL = 'https://custom-plus.nl';
    lce.__resetState();

    calls = [];
    r = await handler(req({ app: 'portal', message: '  Fout bij opslaan  ', stack: 'Error: x\n  at y', url: 'https://custom-plus.nl/factuur', lang: 'nl', client_id: 'bezoeker-1' }, { ip: '198.51.100.1' }));
    t.eq(r.status, 200, 'een geldige melding met Supabase geconfigureerd: 200');
    const j1 = await r.json();
    t.eq(j1.ok, true, 'antwoord meldt ok:true bij een gelukte RPC');
    t.eq(calls.length, 1, 'precies één aanroep naar Supabase');
    const rpcCall = calls[0];
    t.true(rpcCall.url.indexOf('/rest/v1/rpc/log_client_error') >= 0, 'de aanroep gaat naar de log_client_error RPC');
    t.eq(rpcCall.init.headers.apikey, 'service-test-sleutel', 'apikey-header is de service-role-sleutel');
    t.eq(rpcCall.init.headers.Authorization, 'Bearer service-test-sleutel', 'Authorization-header draagt dezelfde sleutel');
    const rpcBody = JSON.parse(rpcCall.init.body);
    t.deep(Object.keys(rpcBody).sort(), ['p_app', 'p_client_id', 'p_lang', 'p_message', 'p_stack', 'p_url'], 'de RPC-body heeft precies de zes parameters van log_client_error');
    t.eq(rpcBody.p_app, 'portal', 'p_app komt over');
    t.eq(rpcBody.p_message, 'Fout bij opslaan', 'p_message is getrimd');
    t.eq(rpcBody.p_stack, 'Error: x\n  at y', 'p_stack komt over');
    t.eq(rpcBody.p_url, 'https://custom-plus.nl/factuur', 'p_url komt over');
    t.eq(rpcBody.p_lang, 'nl', 'p_lang komt over');
    t.eq(rpcBody.p_client_id, 'bezoeker-1', 'p_client_id komt over');
    t.false(JSON.stringify(rpcBody).indexOf('198.51.100.1') >= 0, 'het IP-adres staat nergens in de RPC-body (geen PII)');
    t.false('ip' in rpcBody || 'user_agent' in rpcBody || 'userAgent' in rpcBody, 'geen ip- of user agent-veld in de RPC-body');

    calls = [];
    r = await handler(req({ app: 'beheer', message: 'Minimale melding' }, { ip: '198.51.100.2' }));
    const rpcBody2 = JSON.parse(calls[0].init.body);
    t.eq(rpcBody2.p_stack, null, 'ontbrekende stack wordt null, geen lege string');
    t.eq(rpcBody2.p_url, null, 'ontbrekende url wordt null');
    t.eq(rpcBody2.p_lang, null, 'ontbrekende lang wordt null');
    t.eq(rpcBody2.p_client_id, null, 'ontbrekend client_id wordt null');

    /* de RPC zelf mislukt: dat mag de functie niet laten klappen, en het
       antwoord mag geen succes verzinnen */
    globalThis.fetch = async () => new Response('boom', { status: 500 });
    r = await handler(req({ app: 'site', message: 'Faalt bij Supabase' }, { ip: '198.51.100.3' }));
    t.eq(r.status, 200, 'een mislukte RPC blijft toch 200 (fire-and-forget, nooit blokkerend)');
    t.eq((await r.json()).ok, false, 'maar het antwoord meldt eerlijk ok:false, geen verzonnen succes');

    globalThis.fetch = async () => { throw new Error('offline'); };
    r = await handler(req({ app: 'site', message: 'Netwerk weg' }, { ip: '198.51.100.4' }));
    t.eq(r.status, 200, 'een onbereikbare Supabase laat de functie niet klappen');
    t.eq((await r.json()).ok, false, 'en meldt ok:false');

    /* ================================================================ 5. snelheidslimiet */
    t.group('functie: snelheidslimiet');
    globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{}', { status: 200 }); };
    lce.__resetState();
    calls = [];
    let ok30 = true;
    for (let i = 0; i < 30; i++) {
      const rr = await handler(req({ app: 'site', message: 'melding ' + i }, { ip: '203.0.113.9' }));
      if (rr.status !== 200) ok30 = false;
    }
    t.true(ok30, '30 meldingen per uur van één IP mogen');
    r = await handler(req({ app: 'site', message: 'melding 31' }, { ip: '203.0.113.9' }));
    t.eq(r.status, 429, 'de 31e melding van hetzelfde IP wordt geweigerd');
    t.eq((await r.json()).error, 'rate-limited', 'foutcode rate-limited');
    r = await handler(req({ app: 'site', message: 'ander IP' }, { ip: '203.0.113.10' }));
    t.eq(r.status, 200, 'een ander IP mag gewoon door');

    lce.__resetState();
  } finally {
    globalThis.fetch = origFetch;
    ENV_KEYS.forEach((k) => { if (origEnv[k] === undefined) delete process.env[k]; else process.env[k] = origEnv[k]; });
  }
}
