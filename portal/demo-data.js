/* Demodata voor de CUSTOM+ portal en het beheer.
   Vorm spiegelt supabase/portal/0001_portal_schema.sql + 0002_shipments.sql (camelCase).
   Media verwijst naar bestaande sitebeelden zodat de demo zonder uploads werkt.
   Beide apps lezen window.CP_DEMO; mutaties in demomodus gaan via localStorage
   (sleutel cp_portal_demo_v1) zodat de seed hieronder onaangetast blijft. */
window.CP_DEMO = {
  staff: { id: 'staff-steffan', name: 'Steffan Bakker', email: 'steffan@customplus.nl' },

  factories: [
    { id: 'fac-chen', name: 'Fabriek Chen', region: 'Dongguan', city: 'Dongguan', nnnSignedAt: '2026-04-02' },
    { id: 'fac-wei',  name: 'Toolmaker Wei', region: 'Shenzhen', city: 'Shenzhen', nnnSignedAt: '2026-04-18' }
  ],

  clients: [
    {
      id: 'cli-noor',
      company: 'Atelier Noor',
      contactName: 'Noor van Dijk',
      email: 'noor@ateliernoor.nl',
      phone: '+31 6 21 44 87 90',
      notes: 'Woongeurmerk, DTC via Shopify. Wil Q4 lancering halen. Voorkeur voor korte videoupdates boven lange mails.',
      createdAt: '2025-09-12',
      projects: ['prj-geurflacon', 'prj-diffuser']
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
    /* Afgerond en gearchiveerd project van dezelfde klant: laat in de demo
       de Archiefplank van "Mijn Producten" zien, inclusief levenslang
       dossier, zendinggeschiedenis en de knop "Vraag een nieuwe batch aan". */
    {
      id: 'prj-geurflacon',
      clientId: 'cli-noor',
      name: 'Amberglazen geurflacon',
      code: 'REQ 0918',
      status: 'archived',
      createdAt: '2025-09-18',
      archivedAt: '2026-03-06',
      stages: [
        { stageKey: 'concept',    position: 1, status: 'done', paymentPct: 25, approvedAt: '2025-10-06' },
        { stageKey: 'dfm',        position: 2, status: 'done', paymentPct: 0,  approvedAt: '2025-10-24' },
        { stageKey: 'sourcing',   position: 3, status: 'done', paymentPct: 35, approvedAt: '2025-11-07' },
        { stageKey: 'tooling',    position: 4, status: 'done', paymentPct: 25, approvedAt: '2025-12-19' },
        { stageKey: 'production', position: 5, status: 'done', paymentPct: 0,  approvedAt: '2026-01-30' },
        { stageKey: 'logistics',  position: 6, status: 'done', paymentPct: 15, approvedAt: '2026-02-27' }
      ]
    },
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
    { id: 'med-g1', projectId: 'prj-geurflacon', stageKey: 'tooling',    kind: 'photo', src: 'images/occ-sinterklaas.jpg', caption: 'Golden sample van de amberglazen flacon, door jou goedgekeurd op 12 december.', factoryId: 'fac-chen', capturedAt: '2025-12-12' },
    { id: 'med-g2', projectId: 'prj-geurflacon', stageKey: 'production', kind: 'photo', src: 'images/occ-opening.jpg',     caption: 'Laatste pallets van batch 1 ingepakt voor verscheping.',                    factoryId: 'fac-chen', capturedAt: '2026-01-09' },
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
    { id: 'doc-g1', projectId: 'prj-geurflacon', stageKey: 'concept',    docType: 'nnn',        title: 'NNN-overeenkomst (getekend)', version: 1, createdAt: '2025-09-22' },
    { id: 'doc-g2', projectId: 'prj-geurflacon', stageKey: 'production', docType: 'inspection', title: 'FQC-rapport batch 1',         version: 1, createdAt: '2026-01-09' },
    { id: 'doc-g3', projectId: 'prj-geurflacon', stageKey: 'logistics',  docType: 'shipping',   title: 'Bill of Lading — batch 1',    version: 1, createdAt: '2026-01-16', shipmentId: 'shp-g1' },
    { id: 'doc-01', projectId: 'prj-diffuser', stageKey: 'concept',    docType: 'nnn',        title: 'NNN-overeenkomst (getekend)',        version: 1, createdAt: '2026-04-04' },
    { id: 'doc-02', projectId: 'prj-diffuser', stageKey: 'concept',    docType: 'quote',      title: 'Offerte fase 1-4',                   version: 2, createdAt: '2026-04-06' },
    { id: 'doc-03', projectId: 'prj-diffuser', stageKey: 'concept',    docType: 'invoice',    title: 'Factuur 25% — ontwerpaftekening',     version: 1, createdAt: '2026-04-24' },
    { id: 'doc-04', projectId: 'prj-diffuser', stageKey: 'sourcing',   docType: 'invoice',    title: 'Factuur 35% — start tooling',         version: 1, createdAt: '2026-06-03' },
    { id: 'doc-05', projectId: 'prj-diffuser', stageKey: 'tooling',    docType: 'invoice',    title: 'Factuur 25% — golden sample',         version: 1, createdAt: '2026-07-21' },
    { id: 'doc-06', projectId: 'prj-diffuser', stageKey: 'production', docType: 'inspection', title: 'IQC-rapport grondstoffen',            version: 1, createdAt: '2026-08-12' },
    { id: 'doc-07', projectId: 'prj-diffuser', stageKey: 'production', docType: 'inspection', title: 'IPQC-rapport batch A',                version: 1, createdAt: '2026-08-26' },
    { id: 'doc-09', projectId: 'prj-diffuser', stageKey: 'logistics',  docType: 'shipping',   title: 'Bill of Lading — batch A',            version: 1, createdAt: '2026-08-25', shipmentId: 'shp-02' },
    { id: 'doc-08', projectId: 'prj-cookset',  docType: 'nnn',        stageKey: 'concept',    title: 'NNN-overeenkomst (concept)',          version: 1, createdAt: '2026-08-16' }
  ],

  /* documentslots met status 'verwacht' (golf 6, functie 52): lege slots die
     beheer én portaal tonen als eerlijke lege staat ("wordt verwacht in fase
     X") tot een upload ze vult. documentId koppelt een gevuld slot aan het
     document; status 'verwacht' = nog leeg. */
  docSlots: [
    { id: 'slot-01', projectId: 'prj-diffuser', docType: 'compliance', stageKey: 'logistics', status: 'verwacht', documentId: null, createdAt: '2026-04-04T09:00:00Z' },
    { id: 'slot-02', projectId: 'prj-cookset',  docType: 'quote',      stageKey: 'concept',   status: 'verwacht', documentId: null, createdAt: '2026-08-16T09:00:00Z' }
  ],

  invoices: [
    { id: 'inv-g1', projectId: 'prj-geurflacon', stageKey: 'concept',   label: '25% — ontwerpaftekening', amountCents: 210000, currency: 'EUR', status: 'paid', paidAt: '2025-10-08', createdAt: '2025-10-06', documentId: null },
    { id: 'inv-g2', projectId: 'prj-geurflacon', stageKey: 'sourcing',  label: '35% — start tooling',     amountCents: 294000, currency: 'EUR', status: 'paid', paidAt: '2025-11-10', createdAt: '2025-11-07', documentId: null },
    { id: 'inv-g3', projectId: 'prj-geurflacon', stageKey: 'tooling',   label: '25% — golden sample',     amountCents: 210000, currency: 'EUR', status: 'paid', paidAt: '2025-12-22', createdAt: '2025-12-19', documentId: null },
    { id: 'inv-g4', projectId: 'prj-geurflacon', stageKey: 'logistics', label: '15% — pre-shipment QC',   amountCents: 126000, currency: 'EUR', status: 'paid', paidAt: '2026-02-10', createdAt: '2026-02-06', documentId: null },
    { id: 'inv-01', projectId: 'prj-diffuser', stageKey: 'concept',  label: '25% — ontwerpaftekening',      amountCents: 312500, currency: 'EUR', status: 'paid', paidAt: '2026-04-27', createdAt: '2026-04-24', documentId: 'doc-03' },
    { id: 'inv-02', projectId: 'prj-diffuser', stageKey: 'sourcing', label: '35% — start tooling',          amountCents: 437500, currency: 'EUR', status: 'paid', paidAt: '2026-06-05', createdAt: '2026-06-03', documentId: 'doc-04' },
    { id: 'inv-03', projectId: 'prj-diffuser', stageKey: 'tooling',  label: '25% — golden sample',          amountCents: 312500, currency: 'EUR', status: 'paid', paidAt: '2026-07-24', createdAt: '2026-07-21', documentId: 'doc-05' },
    { id: 'inv-04', projectId: 'prj-diffuser', stageKey: 'logistics', label: '15% — pre-shipment QC',       amountCents: 187500, currency: 'EUR', status: 'open', paidAt: null, createdAt: '2026-08-27', documentId: null }
  ],

  samples: [
    { id: 'smp-g-t0', projectId: 'prj-geurflacon', roundLabel: 'T0', mediaId: null,     status: 'superseded', note: 'Eerste schot: hals net te laag voor de pomp.',                 roundDate: '2025-11-28' },
    { id: 'smp-g-t1', projectId: 'prj-geurflacon', roundLabel: 'T1', mediaId: 'med-g1', status: 'approved',   note: 'Hals 1 mm hoger. Door jou goedgekeurd als golden sample.',     roundDate: '2025-12-12' },
    { id: 'smp-t0', projectId: 'prj-diffuser', roundLabel: 'T0', mediaId: 'med-05', status: 'superseded', note: 'Eerste schot uit de mal. Hals te wijd, dop klikt niet.', roundDate: '2026-06-12' },
    { id: 'smp-t1', projectId: 'prj-diffuser', roundLabel: 'T1', mediaId: 'med-05', status: 'superseded', note: 'Hals 0,3 mm nauwer. Klik goed; oppervlak schouder nog dof.', roundDate: '2026-06-25' },
    { id: 'smp-t2', projectId: 'prj-diffuser', roundLabel: 'T2', mediaId: 'med-06', status: 'approved',   note: 'Polijstronde op de mal. Door jou goedgekeurd als golden sample.', roundDate: '2026-07-18' }
  ],

  inspections: [
    { id: 'insp-g1', projectId: 'prj-geurflacon', stageKey: 'production', checkpoint: 'fqc', aqlNorm: 'ANSI/ASQ Z1.4 II', sampleSize: 200, defects: [ { severity: 'minor', count: 3, note: 'Kleine luchtbellen in de glaswand, binnen norm.' } ], contextLine: 'Eindcontrole vóór verscheping: batch 1 vrijgegeven.', reportDate: '2026-01-09', passed: true },
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

  /* Zendingen (De Reis): een geleverde zeevracht voor het archiefproject,
     een geleverde koerierzending voor het golden sample en een actieve
     zeevracht voor batch A. Mijlpaalsleutels en carriercodes komen uit
     portal/shipping.js; MSKU1234565 en MSCU5309426 zijn ISO 6346-geldig
     (gecontroleerd met CP_SHIPPING.isoCheck). */
  shipments: [
    {
      id: 'shp-g1', projectId: 'prj-geurflacon', type: 'zeevracht', carrierCode: 'msc',
      trackingNumber: '', containerNumber: 'MSCU5309426', blNumber: 'MEDU2600114',
      sampleRoundId: null,
      etaWindowStart: null, etaWindowEnd: null, etaNote: '', etaUpdatedAt: null,
      deliveredAt: '2026-02-20T11:20:00Z', createdAt: '2026-01-12'
    },
    {
      id: 'shp-01', projectId: 'prj-diffuser', type: 'koerier', carrierCode: 'dhl',
      trackingNumber: '2043871233', containerNumber: '', blNumber: '',
      sampleRoundId: 'smp-t2',
      etaWindowStart: null, etaWindowEnd: null, etaNote: '', etaUpdatedAt: null,
      deliveredAt: '2026-07-17T15:40:00Z', createdAt: '2026-07-14'
    },
    {
      id: 'shp-02', projectId: 'prj-diffuser', type: 'zeevracht', carrierCode: 'maersk',
      trackingNumber: '', containerNumber: 'MSKU1234565', blNumber: 'MAEU2514087',
      sampleRoundId: null,
      etaWindowStart: '2026-10-12', etaWindowEnd: '2026-10-18',
      etaNote: 'Onder voorbehoud van de douane.', etaUpdatedAt: '2026-08-28T09:00:00Z',
      deliveredAt: null, createdAt: '2026-08-20'
    }
  ],

  shipmentEvents: [
    { id: 'shev-g1', shipmentId: 'shp-g1', milestoneKey: 'vertrek_fabriek',           occurredAt: '2026-01-12', location: 'Dongguan',  note: 'Batch 1, 3.000 stuks.', createdAt: '2026-01-12T08:40:00Z' },
    { id: 'shev-g2', shipmentId: 'shp-g1', milestoneKey: 'aankomst_haven',            occurredAt: '2026-01-13', location: 'Yantian',   note: '', createdAt: '2026-01-13T10:05:00Z' },
    { id: 'shev-g3', shipmentId: 'shp-g1', milestoneKey: 'geladen_schip',             occurredAt: '2026-01-15', location: 'Yantian',   note: '', createdAt: '2026-01-15T09:30:00Z' },
    { id: 'shev-g4', shipmentId: 'shp-g1', milestoneKey: 'vertrek_zee',               occurredAt: '2026-01-16', location: 'Yantian',   note: '', createdAt: '2026-01-16T17:20:00Z' },
    { id: 'shev-g5', shipmentId: 'shp-g1', milestoneKey: 'aankomst_bestemmingshaven', occurredAt: '2026-02-12', location: 'Rotterdam', note: '', createdAt: '2026-02-12T07:10:00Z' },
    { id: 'shev-g6', shipmentId: 'shp-g1', milestoneKey: 'douane',                    occurredAt: '2026-02-13', location: 'Rotterdam', note: '', createdAt: '2026-02-13T11:45:00Z' },
    { id: 'shev-g7', shipmentId: 'shp-g1', milestoneKey: 'inklaring',                 occurredAt: '2026-02-16', location: 'Rotterdam', note: '', createdAt: '2026-02-16T09:15:00Z' },
    { id: 'shev-g8', shipmentId: 'shp-g1', milestoneKey: 'laatste_km',                occurredAt: '2026-02-19', location: 'Amsterdam', note: '', createdAt: '2026-02-19T08:05:00Z' },
    { id: 'shev-g9', shipmentId: 'shp-g1', milestoneKey: 'geleverd',                  occurredAt: '2026-02-20', location: 'Amsterdam', note: 'Batch 1 bij jou bezorgd.', createdAt: '2026-02-20T11:20:00Z' },

    { id: 'shev-01', shipmentId: 'shp-01', milestoneKey: 'opgehaald',  occurredAt: '2026-07-14', location: 'Dongguan',  note: '', createdAt: '2026-07-14T08:10:00Z' },
    { id: 'shev-02', shipmentId: 'shp-01', milestoneKey: 'vertrokken', occurredAt: '2026-07-15', location: 'Hongkong',  note: '', createdAt: '2026-07-15T11:05:00Z' },
    { id: 'shev-03', shipmentId: 'shp-01', milestoneKey: 'onderweg',   occurredAt: '2026-07-16', location: 'Leipzig',   note: '', createdAt: '2026-07-16T06:40:00Z' },
    { id: 'shev-04', shipmentId: 'shp-01', milestoneKey: 'laatste_km', occurredAt: '2026-07-17', location: 'Amsterdam', note: '', createdAt: '2026-07-17T07:55:00Z' },
    { id: 'shev-05', shipmentId: 'shp-01', milestoneKey: 'geleverd',   occurredAt: '2026-07-17', location: 'Amsterdam', note: 'Golden sample T2 bij jou bezorgd.', createdAt: '2026-07-17T15:40:00Z' },

    { id: 'shev-06', shipmentId: 'shp-02', milestoneKey: 'vertrek_fabriek', occurredAt: '2026-08-20', location: 'Dongguan', note: 'Batch A, 5.000 stuks.', createdAt: '2026-08-20T09:30:00Z' },
    { id: 'shev-07', shipmentId: 'shp-02', milestoneKey: 'aankomst_haven',  occurredAt: '2026-08-21', location: 'Yantian',  note: '', createdAt: '2026-08-21T14:20:00Z' },
    { id: 'shev-08', shipmentId: 'shp-02', milestoneKey: 'geladen_schip',   occurredAt: '2026-08-24', location: 'Yantian',  note: '', createdAt: '2026-08-24T10:15:00Z' },
    { id: 'shev-09', shipmentId: 'shp-02', milestoneKey: 'vertrek_zee',     occurredAt: '2026-08-25', location: 'Yantian',  note: '', createdAt: '2026-08-25T18:00:00Z' }
  ],

  /* Site-briefs (golf 5, functie 21): instroom vanaf de CUSTOM+-site die nog
     geen klant of project is. Alleen het beheer leest deze collectie; de
     portal raakt hem nooit aan. */
  aanvragen: [
    {
      id: 'req-01', name: 'Lotte Meijer', email: 'lotte@studiomeer.nl',
      company: 'Studio Meer', lang: 'nl',
      product: 'Keramische mok met houten deksel, eigen glazuur, eerste oplage 1.000 stuks',
      status: 'nieuw', clientId: null, projectId: null,
      createdAt: '2026-08-27T10:20:00Z'
    },
    {
      id: 'req-02', name: 'Jonas Weber', email: 'jonas@formbank.de',
      company: 'Formbank GmbH', lang: 'de',
      product: 'Aluminium desk organizer, geanodiseerd in 3 kleuren, doeloplage 2.500 stuks',
      status: 'nieuw', clientId: null, projectId: null,
      createdAt: '2026-08-29T15:41:00Z'
    }
  ],

  /* Contactpersonen (golf 5, functie 26): extra ontvangers per klant met
     aanvinkbare mailcategorieën. Beheer-only; de portal leest dit nooit. */
  contacts: [
    {
      id: 'ct-01', clientId: 'cli-noor', name: 'Rens de Boer', role: 'Boekhouding',
      email: 'administratie@ateliernoor.nl', lang: 'nl',
      cats: ['factuur'], active: true, createdAt: '2026-06-02T09:00:00Z'
    }
  ],

  accessLog: [
    { id: 'log-g1', projectId: 'prj-geurflacon', actor: 'system', assetKind: 'system',   assetId: null,     action: 'share',    detail: 'Productiebestanden flacon gedeeld met Fabriek Chen onder NNN', createdAt: '2025-10-20T09:00:00Z' },
    { id: 'log-g2', projectId: 'prj-geurflacon', actor: 'client', assetKind: 'document', assetId: 'doc-g3', action: 'download', detail: 'Bill of Lading — batch 1', createdAt: '2026-02-21T08:12:00Z' },
    { id: 'log-01', projectId: 'prj-diffuser', actor: 'client', assetKind: 'document', assetId: 'doc-01', action: 'download', detail: 'NNN-overeenkomst (getekend)', createdAt: '2026-04-08T10:02:00Z' },
    { id: 'log-02', projectId: 'prj-diffuser', actor: 'system', assetKind: 'system',   assetId: null,     action: 'share',    detail: 'Productiebestanden gedeeld met Fabriek Chen onder NNN', createdAt: '2026-05-26T08:30:00Z' },
    { id: 'log-03', projectId: 'prj-diffuser', actor: 'system', assetKind: 'system',   assetId: null,     action: 'share',    detail: 'Malbestanden gedeeld met Toolmaker Wei onder NNN', createdAt: '2026-06-05T09:12:00Z' },
    { id: 'log-04', projectId: 'prj-diffuser', actor: 'client', assetKind: 'document', assetId: 'doc-05', action: 'download', detail: 'Factuur 25% — golden sample', createdAt: '2026-07-22T19:45:00Z' }
  ]
};
