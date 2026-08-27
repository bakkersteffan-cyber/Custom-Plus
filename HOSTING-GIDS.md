# CUSTOM+ live zetten met een visuele tekst-editor

Je site staat nu klaar op je Mac in `~/Projects/custom-plus` (een echte git-repo, niet meer in een tijdelijke map). Om hem live te zetten met een bewerkbare tekst-editor (Decap CMS) volg je deze stappen. Ik kan deze stappen niet voor je uitvoeren — het aanmaken van accounts en het koppelen van diensten is iets wat jij zelf moet doen — maar hieronder staat exact wat je moet klikken.

## Wat er al klaarstaat

- `custom-plus.html` — de site zelf
- `content/` — alle bewerkbare tekst, plus `content/blog/` met de blogartikelen (Nederlands: Engels, want dat is de brontaal — vertalingen blijven apart beheerd)
- `admin/` — de configuratie voor de visuele editor (Decap CMS)

## Stap 1 — GitHub: een plek voor je code

1. Ga naar [github.com](https://github.com) en log in (of maak een account als je die nog niet hebt).
2. Klik rechtsboven op **+** → **New repository**.
3. Naam: bijvoorbeeld `custom-plus`. Laat "Public" of "Private" staan zoals je wilt (Private kan, Netlify kan ook bij private repo's).
4. **Belangrijk:** vink NIETS aan bij "Initialize this repository" (geen README, geen .gitignore) — de repo bestaat al lokaal.
5. Klik **Create repository**.
6. GitHub toont dan een pagina met commando's onder "…or push an existing repository from the command line". Kopieer de regel die begint met `git remote add origin`.

Stuur mij die twee regels (of gewoon de repository-URL, bijv. `https://github.com/jouwnaam/custom-plus.git`) en dan koppel en push ik de lokale repo voor je — ik vraag dan om jouw akkoord voordat ik daadwerkelijk push.

## Stap 2 — Netlify: de site hosten

1. Ga naar [netlify.com](https://netlify.com) en log in met je GitHub-account (knop "Log in with GitHub" — makkelijkst, want dan is de koppeling meteen gelegd).
2. Klik **Add new site** → **Import an existing project**.
3. Kies **GitHub**, geef Netlify toestemming, en selecteer je `custom-plus` repository.
4. Bij de build-instellingen hoef je **niets** in te vullen: het bestand `netlify.toml` in de repo regelt alles al (build command, publish map en de map met serverfuncties). Laat de velden staan zoals Netlify ze voorstelt.
5. Klik **Deploy site**. Na een halve minuut krijg je een URL zoals `iets-random.netlify.app`.
6. Test die URL: je zou de site moeten zien zoals hij er nu uitziet.

Bij elke deploy draait automatisch een klein script dat de blogindex, de RSS feed en de sitemap opnieuw opbouwt. Dat script vult ook je echte adres in: zodra je site op Netlify staat (en later, zodra je een eigen domein koppelt), komt dat domein vanzelf in de sitemap, de feed en robots.txt te staan. Je hoeft daar niets handmatig aan te passen.

Optioneel: onder **Site settings → Domain management** kun je later een eigen domein (bijv. customplus.io) koppelen als je die al hebt of registreert.

## Stap 3 — Netlify Identity + Git Gateway: de editor kan inloggen

Dit is de stap die de visuele editor (Decap CMS) daadwerkelijk laat werken — zonder dit kun je wel de site zien, maar niet inloggen op `/admin`.

1. In je Netlify-site: **Site configuration → Identity** (of "Identity" in het linkermenu) → **Enable Identity**.
2. Ga naar **Identity → Settings and usage**.
3. Bij **Registration preferences**: zet dit op **Invite only** (zodat niemand anders zichzelf kan registreren als editor).
4. Scroll naar **Services** → **Git Gateway** → klik **Enable Git Gateway**. Dit laat de editor namens jou naar GitHub schrijven zonder dat je zelf een GitHub-token hoeft te delen.
5. Ga terug naar **Identity** → klik **Invite users** → vul jouw eigen e-mailadres in → verstuur.
6. Je krijgt een e-mail met een link. Klik erop, stel een wachtwoord in.

## Stap 4 — Inloggen en tekst bewerken

1. Ga naar `https://jouw-site.netlify.app/admin` (of je eigen domein + `/admin`).
2. Log in met het account dat je in stap 3 hebt aangemaakt.
3. Je ziet links twee groepen: **Website content** (Home page, Services page, Blog page, FAQ page, enzovoort) en **Blog articles**, waar je met de knop **New Article** een nieuw blogartikel schrijft. Artikelen bouw je op uit blokken: paragraaf, tussenkop, opsomming, citaat, cijfer met bron, en beeld.
4. Klik op een onderdeel, wijzig een veld, klik **Save**, en dan **Publish** (rechtsboven). De wijziging wordt automatisch als een git-commit naar GitHub gestuurd, en Netlify bouwt de site binnen enkele seconden opnieuw.

**Aanrader om als eerste te doen:** open **"Trust & accountability page"** → **Founder** en **Legal & registration**. Daar staan nog placeholder-teksten zoals `[Founder name]` en `[00000000]` — dat zijn geen echte gegevens, maar duidelijk gemarkeerde plekken die op de site een oranje gestippelde rand krijgen totdat jij ze invult. Zodra je er een echte naam/nummer intypt, verdwijnt die markering automatisch.

## Wat is WEL en NIET bewerkbaar via de editor

**Wel:** vrijwel alle lopende tekst — koppen, paragrafen, case-studies, FAQ-antwoorden, glossarium, alle Trust-pagina content (inclusief de downloadbare NNN/AQL/DFM-sjablonen), SEO-titels/omschrijvingen per pagina.

**Bewust niet:** knoplabels die ook als technische sleutel dienen in de rekentools (bijv. "Simple/Moderate/Complex" bij de kostencalculator, de antwoordopties van de scope-check quiz). Die tekst zomaar wijzigen zou de rekentool of formulier-vooraf-invullen stil kunnen breken — vandaar dat die bewust buiten de editor blijft en in de broncode staat. Twee velden die ALS technische sleutel fungeren (case-categorie, fase-nummers) zijn wel in de editor te wijzigen maar dragen nu een waarschuwing in het veldlabel.

**Vertalingen (NL/DE/FR/ES):** blijven zoals afgesproken buiten de editor — die beheer ik apart, handmatig, wanneer je me vraagt de Engelse brontekst bij te werken.

## Belangrijk: de Claude-artifact link werkt hierna niet meer als volledige preview

Tot nu toe kon je de site altijd bekijken via de Claude-artifact link (`claude.ai/code/artifact/...`), omdat dat één zelfstandig HTML-bestand was. Door alle tekst nu naar aparte `content/*.json`-bestanden te verplaatsen — nodig om de editor te laten werken — kan die artifact-link de tekst niet meer ophalen (hij kent alleen het ene HTML-bestand, niet de losse contentbestanden ernaast). De pagina's zullen er daar dus leeg/kapot uitzien.

Zodra Netlify draait (stap 2), is die URL de nieuwe "echte" plek om de site te bekijken en te delen — die werkt wel volledig, want daar staan alle bestanden gewoon naast elkaar. Zeg het me als je wilt dat ik iets anders doe met de oude artifact-link.

## AI productcheck activeren (na livegang)

De AI-check op de Ecommerce-pagina draait via een Netlify Function (`netlify/functions/product-check.mjs`). De functie deployt automatisch mee; hij werkt pas als de API key is ingesteld:

1. Maak een API key aan op https://console.mistral.ai (gratis account, betaal per gebruik; dit model kost fracties van centen per vraag).
2. In Netlify: **Site settings → Environment variables → Add a variable**:
   - `MISTRAL_API_KEY` = jouw key
   - `MISTRAL_SEARCH_AGENT_ID` = `ag_01a034c0396e74778205aa18c6268043` (de zoekagent die bij prijsvragen actuele prijzen opzoekt; laat je hem leeg, dan maakt de functie er zelf een aan)
   - optioneel `MISTRAL_MODEL` = een ander Mistral model (standaard `mistral-small-latest`)
3. Deploy opnieuw (of wacht op de volgende publish vanuit het CMS).

Zolang de key ontbreekt of de site lokaal draait, toont de sectie een eerlijke melding en verwijst hij naar de briefing — er wordt nooit een nepantwoord getoond.

## Korte checklist voor de livegang

Wat ik al voor je klaar heb gezet:

- de site, de blog, het CMS en de serverfunctie voor de AI staan compleet in de repo
- `netlify.toml` regelt de build, de publish map en de functies, dus Netlify hoeft niets gevraagd te worden
- sitemap, RSS feed en robots.txt vullen zichzelf met jouw echte domein bij de eerste deploy
- je API sleutel staat in `.env`, en dat bestand staat in `.gitignore` — hij is nooit meegecommit en gaat dus niet mee naar GitHub

Wat jij zelf moet doen (accounts en koppelingen kan ik niet voor je aanmaken):

1. GitHub repository aanmaken (stap 1) en mij de URL geven, dan push ik alles
2. Netlify koppelen aan die repository (stap 2)
3. Identity en Git Gateway aanzetten en jezelf uitnodigen (stap 3), zodat je op `/admin` kunt inloggen
4. De twee omgevingsvariabelen voor de AI invullen (laatste hoofdstuk), anders toont de productcheck netjes dat hij nog niet live is
5. Eventueel je eigen domein koppelen onder Domain management

Punt 4 en 5 kunnen ook later; de site werkt zonder allebei gewoon.
