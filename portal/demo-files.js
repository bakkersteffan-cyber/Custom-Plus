/* CUSTOM+ demomodus — echte bestanden in de browser.
   localStorage (cp_portal_demo_v1) is te klein voor echte uploads; dit
   bestandje bewaart de blobs daarom in IndexedDB (database cp_portal_files,
   store 'files') terwijl de metadata gewoon in de bestaande demo-state
   blijft wonen. Zelfde origin = beheer.html én portal.html lezen dezelfde
   database, dus de bestaande cross-tab 'storage'-verversing blijft werken:
   de state draagt alleen een fileRef, de blob zelf staat hier.
   Promise-gebaseerd, zonder libraries. Laden ná portal/demo-data.js.

   API:
   - CP_FILES.putFile(id, blob, meta)  → Promise (QuotaExceeded → nette fout)
   - CP_FILES.getFile(id)              → Promise<{blob, meta}|null>
   - CP_FILES.deleteFile(id)           → Promise (stil bij ontbreken)
   - CP_FILES.fileUrl(id)              → Promise<objectURL|null>, gecachet per
                                         id en bij pagehide netjes gerevoket
   - CP_FILES.missingImage(tekst)      → data-URI met een nette terugvaltegel
                                         ("bestand niet beschikbaar") */
(function(){
  'use strict';
  var DB_NAME = 'cp_portal_files';
  var STORE = 'files';
  var dbPromise = null;

  function openDb(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!window.indexedDB){
        reject(new Error('Deze browser heeft geen IndexedDB — bestanden kunnen in demomodus niet worden bewaard.'));
        return;
      }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function(){
        var db = req.result;
        /* een toekomstige versie-upgrade in een andere tab niet blokkeren */
        db.onversionchange = function(){ try{ db.close(); }catch(e){} dbPromise = null; };
        resolve(db);
      };
      req.onerror = function(){
        dbPromise = null;
        reject(req.error || new Error('De bestandsopslag kon niet worden geopend.'));
      };
    });
    return dbPromise;
  }

  function run(mode, fn){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var t;
        try{ t = db.transaction(STORE, mode); }
        catch(e){ reject(e); return; }
        var out;
        t.oncomplete = function(){ resolve(out); };
        t.onabort = function(){ reject(t.error || new Error('De opslagbewerking is afgebroken.')); };
        t.onerror = function(){ reject(t.error || new Error('De opslagbewerking is mislukt.')); };
        var req = fn(t.objectStore(STORE));
        if(req) req.onsuccess = function(){ out = req.result; };
      });
    });
  }

  function isQuotaError(e){
    return !!(e && (e.name === 'QuotaExceededError' || e.code === 22));
  }

  /* objectURL-cache: één URL per fileRef, gedeeld door alle weergaven
     (galerij, sheet, wachtrij) zodat er nooit een URL wordt gerevoket die
     elders nog in beeld staat; bij het verlaten van de pagina gaat alles
     in één keer netjes weg */
  var urlCache = {};
  window.addEventListener('pagehide', function(){
    Object.keys(urlCache).forEach(function(k){
      try{ URL.revokeObjectURL(urlCache[k]); }catch(e){ /* stil */ }
    });
    urlCache = {};
  });

  window.CP_FILES = {
    putFile: function(id, blob, meta){
      return run('readwrite', function(store){
        return store.put({ blob: blob, meta: meta || {}, storedAt: new Date().toISOString() }, id);
      }).catch(function(e){
        if(isQuotaError(e)){
          throw new Error('De browseropslag is vol — het bestand is niet bewaard. Verwijder oude bestanden of kies een kleiner bestand.');
        }
        throw e;
      });
    },

    getFile: function(id){
      if(!id) return Promise.resolve(null);
      return run('readonly', function(store){ return store.get(id); })
        .then(function(rec){ return (rec && rec.blob) ? rec : null; })
        .catch(function(){ return null; });
    },

    deleteFile: function(id){
      if(!id) return Promise.resolve();
      if(urlCache[id]){
        try{ URL.revokeObjectURL(urlCache[id]); }catch(e){ /* stil */ }
        delete urlCache[id];
      }
      return run('readwrite', function(store){ return store.delete(id); })
        .catch(function(){ /* weg is weg — verwijderen mag nooit een flow breken */ });
    },

    fileUrl: function(id){
      if(!id) return Promise.resolve(null);
      if(urlCache[id]) return Promise.resolve(urlCache[id]);
      return window.CP_FILES.getFile(id).then(function(rec){
        if(!rec) return null;
        if(!urlCache[id]) urlCache[id] = URL.createObjectURL(rec.blob);
        return urlCache[id];
      });
    },

    /* nette terugvaltegel voor een beeld waarvan de blob in déze browser
       ontbreekt (andere browser, of opslag gewist) — huisstijl: crème
       grond, rustige grijze tekst, geen kapotte <img> */
    missingImage: function(text){
      var t = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">'
        + '<rect width="640" height="420" fill="#faf8f5"/>'
        + '<rect x="0.5" y="0.5" width="639" height="419" fill="none" stroke="#e8e4de"/>'
        + '<text x="320" y="216" fill="#8a857d" font-family="Hanken Grotesk, Arial, sans-serif" font-size="17" text-anchor="middle">' + t + '</text>'
        + '</svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    isQuotaError: isQuotaError
  };
})();
