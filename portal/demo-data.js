/* Demodata voor de CUSTOM+ portal en het beheer.
   Vorm spiegelt supabase/portal/0001_portal_schema.sql (camelCase).
   Media verwijst naar bestaande sitebeelden zodat de demo zonder uploads werkt.
   Beide apps lezen window.CP_DEMO; mutaties in demomodus gaan via localStorage
   (sleutel cp_portal_demo_v1) zodat de seed hieronder onaangetast blijft. */
window.CP_DEMO = {
  staff: { id: 'staff-steffan', name: 'Steffan Bakker', email: 'steffan@customplus.nl' },

  factories: [
    { id: 'fac-chen', name: 'Fabriek Chen', region: 'Dongguan', nnnSignedAt: '2026-04-02' },
    { id: 'fac-wei',  name: 'Toolmaker Wei', region: 'Shenzhen', nnnSignedAt: '2026-04-18' }
  ],

  clients: [
    {
      id: 'cli-noor',
      company: 'Atelier Noor',
      contactName: 'Noor van Dijk',
      email: 'noor@ateliernoor.nl',
      phone: '+31 6 21 44 87 90',
      notes: 'Woongeurmerk, DTC via Shopify. Wil Q4 lancering halen. Voorkeur voor korte videoupdates boven lange mails.',
      createdAt: '2026-03-28',
      projects: ['prj-diffuser']
    },
    {
      id: 'cli-fjell',
      company: 'Fjell Outdoor',
      contactName: 'Mats Berger',
      email: 'mats@fjelloutdoor.no',
      phone: '+47 917 22 481',
      notes: 'Kampeerkookset, herontwerp rond nesttoleranties. Nog in offertetraject — eerste call gehad 21 aug.',
      createdAt: '2026-08-14',
      projects: ['prj-cookset']
    }
  ],

  projects: [
    {
      id: 'prj-diffuser',
      clientId: 'cli-noor',
      name: 'Hervulbaar diffuservat',
      code: 'REQ 0402',
      status: 'active',
      createdAt: '2026-04-02',
      stages: [
        { stageKey: 'concept',    position: 1, status: 'done',    paymentPct: 25, approvedAt: '2026-04-24' },
        { stageKey: 'dfm',        position: 2, status: 'done',    paymentPct: 0,  approvedAt: '2026-05-15' },
        { stageKey: 'sourcing',   position: 3, status: 'done',    paymentPct: 35, approvedAt: '2026-06-03' },
        { stageKey: 'tooling',    position: 4, status: 'done',    paymentPct: 25, approvedAt: '2026-07-21' },
        { stageKey: 'production', position: 5, status: 'current', paymentPct: 0,  approvedAt: null },
        { stageKey: 'logistics',  position: 6, status: 'upcoming', paymentPct: 15, approvedAt: null }
      ]
    },
    {
      id: 'prj-cookset',
      clientId: 'cli-fjell',
      name: 'Nestbare kampeerkookset',
      code: 'REQ 0814',
      status: 'active',
      createdAt: '2026-08-14',
      stages: [
        { stageKey: 'concept',    position: 1, status: 'current',  paymentPct: 25, approvedAt: null },
        { stageKey: 'dfm',        position: 2, status: 'upcoming', paymentPct: 0,  approvedAt: null },
        { stageKey: 'sourcing',   position: 3, status: 'upcoming', paymentPct: 35, approvedAt: null },
        { stageKey: 'tooling',    position: 4, status: 'upcoming', paymentPct: 25, approvedAt: null },
        { stageKey: 'production', position: 5, status: 'upcoming', paymentPct: 0,  approvedAt: null },
        { stageKey: 'logistics',  position: 6, status: 'upcoming', paymentPct: 15, approvedAt: null }
      ]
    }
  ],

  media: [
    { id: 'med-01', projectId: 'prj-diffuser', stageKey: 'concept',    kind: 'photo', src: 'images/occ-newclient.jpg',  caption: 'Eerste schetsronde naast je referentievat, drie halsvarianten.', factoryId: null,      capturedAt: '2026-04-10' },
    { id: 'med-02', projectId: 'prj-diffuser', stageKey: 'concept',    kind: 'photo', src: 'images/occ-launch.jpg',     caption: 'CAD-render van de gekozen richting, wanddikte 2,4 mm.',          factoryId: null,      capturedAt: '2026-04-21' },
    { id: 'med-03', projectId: 'prj-diffuser', stageKey: 'dfm',        kind: 'photo', src: 'images/occ-opening.jpg',    caption: 'Mold flow simulatie: geen sink marks meer op de schouder.',      factoryId: null,      capturedAt: '2026-05-08' },
    { id: 'med-04', projectId: 'prj-diffuser', stageKey: 'sourcing',   kind: 'photo', src: 'images/occ-newyear.jpg',    caption: 'Vloerbezoek fabriek Chen: de spuitgietlijn die jouw vat draait.', factoryId: 'fac-chen', capturedAt: '2026-05-28' },
    { id: 'med-05', projectId: 'prj-diffuser', stageKey: 'tooling',    kind: 'photo', src: 'images/occ-anniversary.jpg', caption: 'T1 naast T0: de hals is 0,3 mm nauwer, de dop klikt nu.',       factoryId: 'fac-wei',  capturedAt: '2026-06-25' },
    { id: 'med-06', projectId: 'prj-diffuser', stageKey: 'tooling',    kind: 'photo', src: 'images/occ-renewal.jpg',    caption: 'Golden sample T2, door jou goedgekeurd op 21 juli.',             factoryId: 'fac-wei',  capturedAt: '2026-07-18' },
    { id: 'med-07', projectId: 'prj-diffuser', stageKey: 'production', kind: 'photo', src: 'images/occ-events.jpg',     caption: 'Eerste productierun gestart: 5.000 stuks, batch A.',             factoryId: 'fac-chen', capturedAt: '2026-08-19' },
    { id: 'med-08', projectId: 'prj-diffuser', stageKey: 'production', kind: 'photo', src: 'images/occ-christmas.jpg',  caption: 'IPQC-checkpoint halverwege de run, batch A.',                    factoryId: 'fac-chen', capturedAt: '2026-08-26' },
    { id: 'med-09', projectId: 'prj-cookset',  stageKey: 'concept',    kind: 'photo', src: 'images/occ-thankyou.jpg',   caption: 'Eerste nestingschets: drie pannen, één silhouet.',              factoryId: null,      capturedAt: '2026-08-22' }
  ],

  documents: [
    { id: 'doc-01', projectId: 'prj-diffuser', stageKey: 'concept',    docType: 'nnn',        title: 'NNN-overeenkomst (getekend)',        version: 1, createdAt: '2026-04-04' },
    { id: 'doc-02', projectId: 'prj-diffuser', stageKey: 'concept',    docType: 'quote',      title: 'Offerte fase 1-4',                   version: 2, createdAt: '2026-04-06' },
    { id: 'doc-03', projectId: 'prj-diffuser', stageKey: 'concept',    docType: 'invoice',    title: 'Factuur 25% — ontwerpaftekening',     version: 1, createdAt: '2026-04-24' },
    { id: 'doc-04', projectId: 'prj-diffuser', stageKey: 'sourcing',   docType: 'invoice',    title: 'Factuur 35% — start tooling',         version: 1, createdAt: '2026-06-03' },
    { id: 'doc-05', projectId: 'prj-diffuser', stageKey: 'tooling',    docType: 'invoice',    title: 'Factuur 25% — golden sample',         version: 1, createdAt: '2026-07-21' },
    { id: 'doc-06', projectId: 'prj-diffuser', stageKey: 'production', docType: 'inspection', title: 'IQC-rapport grondstoffen',            version: 1, createdAt: '2026-08-12' },
    { id: 'doc-07', projectId: 'prj-diffuser', stageKey: 'production', docType: 'inspection', title: 'IPQC-rapport batch A',                version: 1, createdAt: '2026-08-26' },
    { id: 'doc-08', projectId: 'prj-cookset',  docType: 'nnn',        stageKey: 'concept',    title: 'NNN-overeenkomst (concept)',          version: 1, createdAt: '2026-08-16' }
  ],

  invoices: [
    { id: 'inv-01', projectId: 'prj-diffuser', stageKey: 'concept',  label: '25% — ontwerpaftekening',      amountCents: 312500, currency: 'EUR', status: 'paid', paidAt: '2026-04-27', documentId: 'doc-03' },
    { id: 'inv-02', projectId: 'prj-diffuser', stageKey: 'sourcing', label: '35% — start tooling',          amountCents: 437500, currency: 'EUR', status: 'paid', paidAt: '2026-06-05', documentId: 'doc-04' },
    { id: 'inv-03', projectId: 'prj-diffuser', stageKey: 'tooling',  label: '25% — golden sample',          amountCents: 312500, currency: 'EUR', status: 'paid', paidAt: '2026-07-24', documentId: 'doc-05' },
    { id: 'inv-04', projectId: 'prj-diffuser', stageKey: 'logistics', label: '15% — pre-shipment QC',       amountCents: 187500, currency: 'EUR', status: 'open', paidAt: null, documentId: null }
  ],

  samples: [
    { id: 'smp-t0', projectId: 'prj-diffuser', roundLabel: 'T0', mediaId: 'med-05', status: 'superseded', note: 'Eerste schot uit de mal. Hals te wijd, dop klikt niet.', roundDate: '2026-06-12' },
    { id: 'smp-t1', projectId: 'prj-diffuser', roundLabel: 'T1', mediaId: 'med-05', status: 'superseded', note: 'Hals 0,3 mm nauwer. Klik goed; oppervlak schouder nog dof.', roundDate: '2026-06-25' },
    { id: 'smp-t2', projectId: 'prj-diffuser', roundLabel: 'T2', mediaId: 'med-06', status: 'approved',   note: 'Polijstronde op de mal. Door jou goedgekeurd als golden sample.', roundDate: '2026-07-18' }
  ],

  inspections: [
    { id: 'insp-01', projectId: 'prj-diffuser', stageKey: 'production', checkpoint: 'iqc',  aqlNorm: 'ANSI/ASQ Z1.4 II', sampleSize: 125, defects: [], contextLine: 'Grondstofcontrole: PP-granulaat en kleurmasterbatch binnen spec.', reportDate: '2026-08-12', passed: true },
    { id: 'insp-02', projectId: 'prj-diffuser', stageKey: 'production', checkpoint: 'ipqc', aqlNorm: 'ANSI/ASQ Z1.4 II', sampleSize: 200, defects: [ { severity: 'minor', count: 2, note: 'Lichte flowlijn onder de schouder, binnen norm.', mediaId: 'med-08' } ], contextLine: '2 kleine afwijkingen gevonden en binnen norm afgehandeld.', reportDate: '2026-08-26', passed: true }
  ],

  questions: [
    { id: 'q-01', projectId: 'prj-diffuser', mediaId: 'med-05', stageKey: 'tooling', question: 'Is dat doffe plekje op de schouder normaal in deze fase?', answer: 'Ja — dat is de polijstgraad van de mal na T1. In T2 is de mal gepolijst en is dit weg, zie de volgende ronde.', askedAt: '2026-06-26T09:14:00Z', answeredAt: '2026-06-26T13:02:00Z' }
  ],

  disclosures: [
    { id: 'dis-01', projectId: 'prj-diffuser', documentId: 'doc-02', factoryId: 'fac-chen', disclosedAt: '2026-05-26', underNnn: true, what: 'Productiebestanden vat (STEP + 2D)' },
    { id: 'dis-02', projectId: 'prj-diffuser', documentId: null,     factoryId: 'fac-wei',  disclosedAt: '2026-06-05', underNnn: true, what: 'Malbestanden hals + dop' }
  ],

  accessLog: [
    { id: 'log-01', projectId: 'prj-diffuser', actor: 'client', assetKind: 'document', assetId: 'doc-01', action: 'download', detail: 'NNN-overeenkomst (getekend)', createdAt: '2026-04-08T10:02:00Z' },
    { id: 'log-02', projectId: 'prj-diffuser', actor: 'system', assetKind: 'system',   assetId: null,     action: 'share',    detail: 'Productiebestanden gedeeld met Fabriek Chen onder NNN', createdAt: '2026-05-26T08:30:00Z' },
    { id: 'log-03', projectId: 'prj-diffuser', actor: 'system', assetKind: 'system',   assetId: null,     action: 'share',    detail: 'Malbestanden gedeeld met Toolmaker Wei onder NNN', createdAt: '2026-06-05T09:12:00Z' },
    { id: 'log-04', projectId: 'prj-diffuser', actor: 'client', assetKind: 'document', assetId: 'doc-05', action: 'download', detail: 'Factuur 25% — golden sample', createdAt: '2026-07-22T19:45:00Z' }
  ]
};
