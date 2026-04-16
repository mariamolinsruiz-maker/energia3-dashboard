/**
 * ComunitatES · app.js
 *
 * L'index.html ja té COMMUNITIES i CLIENTS declarats com a `let`
 * amb dades hardcoded. Aquest script:
 *   1. Espera que el DOM estigui llest
 *   2. Fa fetch a /api/communities i /api/clients
 *   3. Buidar les arrays globals i les omple amb les dades de l'API
 *   4. Re-renderitza el dashboard i la taula de clients
 *
 * main.py injecta <script src="/static/app.js"> just before </body>
 * sense modificar l'index.html original.
 */

// ─────────────────────────────────────────────────────────────
//  Helpers per cridar l'API
// ─────────────────────────────────────────────────────────────

let _dataLoaded = false;

async function apiFetch(path, method = 'GET', body = undefined) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Error ${res.status}` }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────
//  Carrega les dades i re-renderitza
// ─────────────────────────────────────────────────────────────

async function loadFromAPI() {
  if (_dataLoaded) return;
  _dataLoaded = true;
  try {
    // Fetch en paral·lel
    const [communities, clients, agreements, incidents] = await Promise.all([
      apiFetch('/api/communities'),
      apiFetch('/api/clients'),
      apiFetch('/api/agreements'),
      apiFetch('/api/incidents'),
    ]);

    // Buidar les arrays globals declarades a l'HTML
    COMMUNITIES.splice(0, COMMUNITIES.length);
    CLIENTS.splice(0, CLIENTS.length);
    AGREEMENTS.splice(0, AGREEMENTS.length);
    INCIDENTS.splice(0, INCIDENTS.length);

    // Omplir amb les dades de l'API
    communities.forEach(c => COMMUNITIES.push(c));
    clients.forEach(c => CLIENTS.push(c));
    agreements.forEach(a => AGREEMENTS.push(a));
    incidents.forEach(i => INCIDENTS.push(i));

    // Re-renderitzar tot el frontend amb les noves dades
    reloadCurrentView && reloadCurrentView();
    
    console.log(
      `✅ Dades carregades: ${COMMUNITIES.length} comunitats, ${CLIENTS.length} clients`
    );
    const statsA = getAgreementsStats();
    const badgeA = document.getElementById('badge-acords');
    if (badgeA) badgeA.textContent = statsA.pendents;

    const statsI = getIncidentsStats();
    const badgeE = document.getElementById('badge-errors');
    if (badgeE) badgeE.textContent = statsI.ambErrors;

      // Comunitats
    const elComms = document.getElementById('kpi-dashboard-comms');
    if (elComms) elComms.textContent = COMMUNITIES.length;

    // Acords pendents
    const elAcords = document.getElementById('kpi-dashboard-acords');
    if (elAcords) elAcords.textContent = statsA.pendents;

    // Total clients
    const elClients = document.getElementById('kpi-dashboard-clients');
    if (elClients) elClients.textContent = CLIENTS.length;

    // Potència total
    const totalKW = CLIENTS.reduce((sum, c) => sum + (c.kw || 0), 0);
    const elKW = document.getElementById('kpi-dashboard-kw');
    if (elKW) elKW.textContent = totalKW.toFixed(1) + ' kW';
  
  } catch (err) {
    console.error('❌ Error carregant dades de l\'API:', err.message);
    // Fallback: continua amb les dades hardcoded que ja hi ha a l'HTML
  }
}

// ─────────────────────────────────────────────────────────────
//  Sobreescriu saveComm i deleteComm perquè persisteixin a l'API
// ─────────────────────────────────────────────────────────────

// ── COMUNITATS ──────────────────────────────────────────────

const _origSaveComm = window.saveComm;

window.saveComm = async function () {
  // 1. Validació i construcció de l'objecte (reutilitzem la lògica original)
  const nom      = document.getElementById('c-nom').value.trim();
  const promotor = document.getElementById('c-promotor').value.trim();
  const potencia = parseFloat(document.getElementById('c-potencia').value) || 0;
  const errEl    = document.getElementById('modal-comm-err');

  if (!nom || !promotor || !potencia) {
    errEl.textContent = '⚠ Omple els camps obligatoris: Nom, Promotor i Potència.';
    if (typeof goStep === 'function') goStep(1);
    return;
  }
  errEl.textContent = '';

  const id  = editingCommId || document.getElementById('c-id').value;
  const lat = parseFloat(document.getElementById('c-lat').value) || 41.50;
  const lng = parseFloat(document.getElementById('c-lng').value) || 2.00;
  const fiRaw = document.getElementById('c-fi').value;
  const fi    = fiRaw ? fiRaw.split('-').reverse().join('/') : '31/12/2026';

  const commObj = {
    id, nom, promotor,
    contacte:        document.getElementById('c-contacte').value.trim() || promotor,
    email:           document.getElementById('c-email').value.trim(),
    telefon:         document.getElementById('c-tel').value.trim(),
    adreca:          document.getElementById('c-adreca').value.trim(),
    potencia:        potencia,
    onboarding:      document.getElementById('c-onboarding').value,
    acord_reparto:   document.getElementById('c-acord').value,
    fi_inscripcions: fi,
    informe_auto:    document.getElementById('c-informe').value,
    marca_blanca:    document.getElementById('c-marca').value,
    lat, lng,
    color:           document.getElementById('c-color').value || '#1B4D31',
    clients_actius: 0, inscrits: 0,
    cups_auth_actius: 0, cups_auth_proposats: 0,
    sense_auth: 0, datadis_actius: 0,
    autoconsumos: '0/0', clients_app: 0,
    sense_dades: 0, sol_licituds: 0,
    total_estalvi: 0, total_kw: potencia, total_clients: 0,
  };

  // 2. Recollir files de clients del modal
  const rows = document.querySelectorAll('#client-rows-body .client-table-row');
  const newClients = [];
  rows.forEach((row, i) => {
    const r    = row.id.replace('crow-', '');
    const nomCl = document.getElementById(`cr-nom-${r}`)?.value.trim();
    if (!nomCl) return;
    const codi = row.dataset.codi || `${id.replace('C', '')}${String(i + 1).padStart(3, '0')}`;
    const kw   = parseFloat(document.getElementById(`cr-kw-${r}`)?.value) || 0;
    const cups = document.getElementById(`cr-cups-${r}`)?.value.trim();
    newClients.push({
      codi, nom: nomCl,
      nif:   document.getElementById(`cr-nif-${r}`)?.value.trim()   || '',
      cups:  cups || '—',
      tel:   document.getElementById(`cr-tel-${r}`)?.value.trim()   || '',
      email: document.getElementById(`cr-email-${r}`)?.value.trim() || '',
      inici_fact: '-', baixa: '-', app: 'No',
      estat: document.getElementById(`cr-estat-${r}`)?.value || 'Proposat',
      modalitat: 'Ahorra sempre', perfil: 'F', comercialitz: '0091', import_eur: 0,
      comunitat: id, kw, kwh: kw * 1500,
      preu_llum: 0, estalvi_brut: 0, cost_fix: kw * 12,
      preu_kwh: 0.088, pct_estalvi: null, periode: 0, distribuidora: '031',
      cups_auth: cups ? 'OK' : 'Falten', cups_auth_note: cups ? '' : 'Pendent',
      autoconsum: '-', datadis: 'Actiu', dades_recents: 'Sense dades', sense_auto: 'OK',
    });
  });

  commObj.total_clients = newClients.length;
  commObj.total_kw      = newClients.reduce((s, c) => s + c.kw, 0) || potencia;

  // 3. Persistir a l'API
  try {
    if (editingCommId) {
      await apiFetch(`/api/communities/${editingCommId}`, 'PUT', commObj);
      // Actualitzar clients existents + afegir nous
      const existingCodis = CLIENTS
        .filter(c => c.comunitat === editingCommId)
        .map(c => c.codi);
      for (const cl of newClients) {
        if (existingCodis.includes(cl.codi)) {
          await apiFetch(`/api/clients/${cl.codi}`, 'PUT', cl);
        } else {
          await apiFetch('/api/clients', 'POST', cl);
        }
      }
      showToast('✅ Comunitat actualitzada i guardada');
    } else {
      await apiFetch('/api/communities', 'POST', commObj);
      for (const cl of newClients) {
        await apiFetch('/api/clients', 'POST', cl);
      }
      showToast('✅ Comunitat creada i guardada');
    }
  } catch (err) {
    errEl.textContent = `⚠ Error de l'API: ${err.message}`;
    return;
  }

  // 4. Recarregar dades i tancar modal
  closeModal('modal-comm');
  await loadFromAPI();
  if (typeof reloadCurrentView === 'function') reloadCurrentView();
};

// ─────────────────────────────────────────────────────────────

const _origDeleteComm = window.deleteComm;

window.deleteComm = async function (id, event) {
  if (event) event.stopPropagation();
  const comm = COMMUNITIES.find(c => c.id === id);
  if (!comm) return;

  showConfirm(
    'Eliminar comunitat',
    `Segur que vols eliminar "${comm.nom}" i tots els seus clients (${comm.total_clients})? Aquesta acció no es pot desfer.`,
    async () => {
      try {
        await apiFetch(`/api/communities/${id}`, 'DELETE');
        showToast('🗑 Comunitat eliminada');
      } catch (err) {
        showToast(`⚠ Error: ${err.message}`, 'err');
        return;
      }
      // Netejar mapa si existeix
      if (typeof detailMaps !== 'undefined' && detailMaps[id]) {
        try { detailMaps[id].remove(); } catch (e) {}
        delete detailMaps[id];
      }
      await loadFromAPI();
    }
  );
};

// ── CLIENTS ─────────────────────────────────────────────────

const _origSaveClient = window.saveClient;

window.saveClient = async function () {
  const nom  = document.getElementById('cl-nom').value.trim();
  const nif  = document.getElementById('cl-nif').value.trim();
  const kw   = parseFloat(document.getElementById('cl-kw').value) || 0;
  const errEl = document.getElementById('modal-client-err');

  if (!nom || !nif || !kw) {
    errEl.textContent = '⚠ Omple els camps: Nom, NIF i kW assignats.';
    return;
  }
  errEl.textContent = '';

  const cups = document.getElementById('cl-cups').value.trim();
  const codi = editingClientCodi || (() => {
    const prefix = editingClientCommId ? editingClientCommId.replace('C', '') : '000';
    const existing = CLIENTS.filter(c => c.comunitat === editingClientCommId)
      .map(c => parseInt(c.codi.slice(-3))).filter(n => !isNaN(n));
    const max = existing.length ? Math.max(...existing) : 0;
    return prefix + String(max + 1).padStart(3, '0');
  })();

  const clientObj = {
    codi, nom, nif,
    cups:  cups || '—',
    tel:   document.getElementById('cl-tel').value.trim(),
    email: document.getElementById('cl-email').value.trim(),
    inici_fact: '-', baixa: '-', app: 'No',
    estat:     document.getElementById('cl-estat').value,
    modalitat: document.getElementById('cl-modalitat').value,
    perfil:    document.getElementById('cl-perfil').value,
    comercialitz: '0091', import_eur: 0,
    comunitat: editingClientCommId,
    kw, kwh: kw * 1500,
    preu_llum: parseFloat(document.getElementById('cl-preu').value) || 0,
    estalvi_brut: 0, cost_fix: kw * 12,
    preu_kwh: 0.088, pct_estalvi: null, periode: 0, distribuidora: '031',
    cups_auth: cups ? 'OK' : 'Falten', cups_auth_note: cups ? '' : 'Pendent',
    autoconsum: '-', datadis: 'Actiu', dades_recents: 'Sense dades', sense_auto: 'OK',
  };

  try {
    if (editingClientCodi) {
      await apiFetch(`/api/clients/${editingClientCodi}`, 'PUT', clientObj);
      showToast('✅ Participant actualitzat i guardat');
    } else {
      await apiFetch('/api/clients', 'POST', clientObj);
      showToast('✅ Participant afegit i guardat');
    }
  } catch (err) {
    errEl.textContent = `⚠ Error de l'API: ${err.message}`;
    return;
  }

  closeModal('modal-client');
  await loadFromAPI();
  // Re-renderitzar el detall si estem al detall de la comunitat
  if (
    typeof currentView !== 'undefined' &&
    currentView === 'comunitat-detail' &&
    typeof currentCommunity !== 'undefined' &&
    currentCommunity === editingClientCommId
  ) {
    renderCommunityDetail(editingClientCommId);
  }
};

// ─────────────────────────────────────────────────────────────

const _origDeleteClient = window.deleteClient;

window.deleteClient = async function (codi, event) {
  if (event) event.stopPropagation();
  const cl = CLIENTS.find(c => c.codi === codi);
  if (!cl) return;

  showConfirm(
    'Eliminar participant',
    `Segur que vols eliminar "${cl.nom}"?`,
    async () => {
      try {
        await apiFetch(`/api/clients/${codi}`, 'DELETE');
        showToast('🗑 Participant eliminat');
      } catch (err) {
        showToast(`⚠ Error: ${err.message}`, 'err');
        return;
      }
      const commId = cl.comunitat;
      await loadFromAPI();
      if (
        typeof currentView !== 'undefined' &&
        currentView === 'comunitat-detail' &&
        typeof currentCommunity !== 'undefined' &&
        currentCommunity === commId
      ) {
        renderCommunityDetail(commId);
      }
    }
  );
};

// ─────────────────────────────────────────────
// STATS GLOBALS (calculats des de Supabase)
// ─────────────────────────────────────────────

function getClientsByCommunity(commId) {
  return CLIENTS.filter(c => c.comunitat === commId);
}

function getAgreementsStats() {
  return {
    total: AGREEMENTS.length,
    pendents: AGREEMENTS.filter(a => a.estat !== 'Firmat').length,
    comunitats: new Set(AGREEMENTS.map(a => a.comunitat_id)).size,
    firmants: AGREEMENTS.length
  };
}

function getIncidentsStats() {
  const totalActives = COMMUNITIES.length;
  const ambErrors = new Set(INCIDENTS.map(i => i.comunitat_id)).size;
  const senseErrors = totalActives - ambErrors;

  return { totalActives, ambErrors, senseErrors };
}

function getIncidentsByType() {
  const map = {};
  INCIDENTS.forEach(i => {
    const tipus = i.tipus || 'Altres';
    map[tipus] = (map[tipus] || 0) + 1;
  });
  return map;
}

// ─────────────────────────────────────────────────────────────
//  Punt d'entrada: carregar dades quan el DOM estigui llest
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Web carregada — carregant dades del backend...");
  loadFromAPI();
});


// ─────────────────────────────────────────────
// EXPORT CSV (genèric)
// ─────────────────────────────────────────────
function downloadCSV(data, filename = "export.csv") {
  if (!data || !data.length) {
    alert("No hi ha dades per exportar");
    return;
  }

  const headers = Object.keys(data[0]);

  const csv = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}


// ── EXPORTAR CLIENTS SEGONS FILTRE ──
function exportClientsVisible() {
  const select = document.getElementById("filter-community"); // ⚠️ important

  let data = CLIENTS;

  if (select && select.value !== "all") {
    data = CLIENTS.filter(c => c.comunitat === select.value);
  }

  downloadCSV(data, "clients.csv");
}


// ── EXPORTAR COMUNITATS ──
function exportCommunitiesAll() {
  downloadCSV(COMMUNITIES, "communities.csv");
}
