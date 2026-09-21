/* CUSTOM+ — test voor de Supabase-hersteltest (agent "backup-restore",
   voorstel 50: back-up en hersteltest van Supabase).
   ------------------------------------------------------------------
   Draait scripts/supabase-restore-drill.mjs ECHT (geen mock): alle
   migraties in supabase/portal/ laden in een verse in-memory PGlite-
   database en het resultaat toetsen. Dit is dus geen unittest op
   geïsoleerde logica maar een echte, herhaalbare uitvoering van de
   hersteltest zelf — zo telt "node test/run.mjs is groen" ook mee als
   bewijs dat het schema foutloos herhaalbaar is vanaf een lege database.

   hersteltest() geeft bij een module-import (in plaats van directe
   node-uitvoering) alleen het resultaat-object terug, zonder
   console-output of process.exit — zie de argv[1]-wachter onderaan
   scripts/supabase-restore-drill.mjs.
   ------------------------------------------------------------------ */
import { hersteltest } from '../scripts/supabase-restore-drill.mjs';

export default async function (t) {
  const r = await hersteltest();

  t.group('migraties (dynamisch gevonden en gesorteerd, niet hardcoded)');
  t.true(r.migraties.gevonden > 0, 'er zijn migraties gevonden in supabase/portal/');
  t.eq(r.migraties.gelukt, r.migraties.gevonden, 'elke gevonden migratie draait zonder fout vanaf een lege database');
  const nummer = (f) => parseInt(/^(\d+)_/.exec(f)[1], 10);
  const opVolgorde = r.migraties.bestanden.every((f, i, arr) => i === 0 || nummer(arr[i - 1]) < nummer(f));
  t.true(opVolgorde, 'de migraties zijn op nummer gesorteerd, niet op bestandsnaam-tekst');
  t.true(r.migraties.bestanden.includes('0001_portal_schema.sql'), 'de eerste migratie (0001_portal_schema.sql) zit in de lijst');
  t.true(r.migraties.bestanden.includes('0021_portaal_acties.sql'), 'de jongste migratie tot nu toe (0021_portaal_acties.sql) zit in de lijst');

  t.group('kerntabellen (afgeleid uit de migraties zelf, geen verzonnen lijst)');
  t.true(r.tabellen.kern >= 40, 'er zijn minstens de bekende ~45 kerntabellen gevonden in de migraties');
  t.eq(r.tabellen.aanwezig, r.tabellen.kern, 'elke kerntabel uit de migraties bestaat ook echt na het afspelen');
  t.deep(r.tabellen.ontbrekend, [], 'geen enkele kerntabel ontbreekt');
  for (const naam of ['clients', 'projects', 'project_stages', 'invoices', 'doc_slots', 'client_contacts']) {
    t.true(r.tabellen.lijst.includes(naam), 'kerntabel "' + naam + '" is gevonden');
  }

  t.group('RLS op elke tabel met een klant- of projectkolom');
  t.true(r.rls.totaal > 0, 'er zijn tabellen met een client_id- of project_id-kolom gevonden');
  t.eq(r.rls.aan, r.rls.totaal, 'RLS staat aan op elke tabel met een klant- of projectkolom');
  t.deep(r.rls.zonder, [], 'geen enkele tabel met een klant- of projectkolom mist RLS');
  for (const naam of ['projects', 'invoices', 'client_contacts', 'doc_slots']) {
    t.true(r.rls.lijst.includes(naam), '"' + naam + '" is herkend als klant-/projectgebonden tabel');
  }

  t.group('de twee kernfuncties van de RLS-laag');
  t.true(r.functies.is_staff, 'de functie is_staff() bestaat na migratie');
  t.true(r.functies.owns_project, 'de functie owns_project(uuid) bestaat na migratie');

  t.group('eindresultaat');
  t.deep(r.afwijkingen, [], 'geen enkele afwijking: het schema is foutloos herhaalbaar vanaf een lege database');
  t.true(r.ok, 'hersteltest() meldt ok: true');
  t.true(typeof r.rapport === 'string' && r.rapport.indexOf('afwijking') > -1, 'het Nederlandse rapport bevat de afwijkingenregel');
}
