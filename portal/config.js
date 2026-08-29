/* CUSTOM+ portal-configuratie.
   Leeg laten = demomodus: de portal en het beheer draaien dan volledig op
   voorbeelddata (portal/demo-data.js) met wijzigingen in localStorage, zodat
   alles lokaal en op de live site te proberen is zonder Supabase-project.
   Zodra het Supabase-project bestaat: vul beide velden en de apps schakelen
   automatisch over op echte auth, echte data en signed URLs.

   notifySharedSecret: alleen nodig als je klantmeldingen per e-mail aan wilt
   zetten (zie netlify/functions/notify-client.mjs). Moet EXACT gelijk zijn
   aan de NOTIFY_SHARED_SECRET env var op Netlify. Dit bestand staat in de
   publieke site — dit is dus geen echt geheim, alleen een drempel tegen
   toevallig misbruik van de mailfunctie. Laat leeg om klantmeldingen uit te
   zetten (werkt ook los van de Supabase-velden hierboven). */
window.CP_PORTAL_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  notifySharedSecret: ''
};
