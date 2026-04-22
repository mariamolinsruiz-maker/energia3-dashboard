/**
 * ComunitatES · app.js
 *
 * Carrega les dades des de l'API (/api/communities, /api/clients, etc.)
 * i sobreescriu les funcions de CRUD perquè persisteixin a Supabase
 * via el backend FastAPI.
 *
 * main.py injecta <script src="/static/app.js"> just before </body>.
 */

// ─────────────────────────────────────────────────────────────
//  Helper genèric per cridar l'API
// ─────────────────────────────────────────────────────────────

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
//  Carrega dades de l'API i re-renderitza
// ─────────────────────────────────────────────────────────────

async function loadFromAPI() {
  try {
    let communities = [];
    let clients     = [];
    let agreements  = [];
    let incidents   = [];

    try { communities = await apiFetch('/api/communities'); } catch(e) { console.error('communities:', e); }
    try { clients     = await apiFetch('/api/clients');     } catch(e) { console.error('clients:', e); }
    try { agreements  = await apiFetch('/api/agreements');  } catch(e) { console.error('agreements:', e); }
    try { incidents   = await apiFetch('/api/incidents');   } catch(e) { console.error('incidents:', e); }

    // Buidar i omplir les arrays globals
    COMMUNITIES.splice(0, COMMUNITIES.length);
    CLIENTS.splice(0, CLIENTS.length);
    if (typeof AGREEMENTS !== 'undefined') AGREEMENTS.splice(0, AGREEMENTS.length);
    if (typeof INCIDENTS  !== 'undefined') INCIDENTS.splice(0, INCIDENTS.length);

    communities.forEach(c => COMMUNITIES.push(c));
    clients.forEach(c     => CLIENTS.push(c));
    if (typeof AGREEMENTS !== 'undefined') agreements.forEach(a => AGREEMENTS.push(a));
    if (typeof INCIDENTS  !== 'undefined') incidents.forEach(i  => INCIDENTS.push(i));

    console.log(`✅ Dades carregades: ${COMMUNITIES.length} comunitats, ${CLIENTS.length} clients`);

    // Re-renderitzar la vista actual
    reloadCurrentView && reloadCurrentView();

    // Dropdown filtre clients
    const dropdown = document.getElementById('filter-comm-clients');
    if (dropdown) {
      dropdown.innerHTML =
        '<option value="">Totes les comunitats</option>' +
        COMMUNITIES.map(c => `<option value="${c.id}">${c.nom} (${c.id})</option>`).join('');
    }

    // ── KPIs Dashboard ──
    const elComms   = document.getElementById('kpi-dashboard-comms');
    const elClients = document.getElementById('kpi-dashboard-clients');
    const elKW      = document.getElementById('kpi-dashboard-kw');
    if (elComms)   elComms.textContent   = COMMUNITIES.length;
    if (elClients) elClients.textContent = CLIENTS.length;
    if (elKW)      elKW.textContent      = CLIENTS.reduce((s, c) => s + (c.kw || 0), 0).toFixed(1) + ' kW';

    // ── KPIs Acords ──
    let statsA = { total: 0, pendents: 0, comunitats: 0, firmants: 0 };
    if (typeof getAgreementsStats === 'function') statsA = getAgreementsStats();
    const elATotal = document.getElementById('kpi-acords-total');
    const elAPend  = document.getElementById('kpi-acords-pendents');
    const elAComm  = document.getElementById('kpi-acords-comunitats');
    const elAFirm  = document.getElementById('kpi-acords-firmants');
    if (elATotal) elATotal.textContent = statsA.total;
    if (elAPend)  elAPend.textContent  = statsA.pendents;
    if (elAComm)  elAComm.textContent  = statsA.comunitats;
    if (elAFirm)  elAFirm.textContent  = statsA.firmants;
    const badgeA = document.getElementById('badge-acords');
    if (badgeA) badgeA.textContent = statsA.pendents;
    const elAcordsDash = document.getElementById('kpi-dashboard-acords');
    if (elAcordsDash) elAcordsDash.textContent = statsA.pendents;

    // ── KPIs Errors ──
    let statsI = { totalActives: 0, ambErrors: 0, senseErrors: 0 };
    if (typeof getIncidentsStats === 'function') statsI = getIncidentsStats();
    const elETotal   = document.getElementById('kpi-errors-total');
    const elEAmb     = document.getElementById('kpi-errors-amb');
    const elESense   = document.getElementById('kpi-errors-sense');
    const elEPercent = document.getElementById('kpi-errors-percent');
    if (elETotal)   elETotal.textContent   = statsI.totalActives;
    if (elEAmb)     elEAmb.textContent     = statsI.ambErrors;
    if (elESense)   elESense.textContent   = statsI.senseErrors;
    if (elEPercent) {
      const pct = statsI.totalActives > 0
        ? (statsI.ambErrors / statsI.totalActives) * 100 : 0;
      elEPercent.textContent = pct.toFixed(1).replace('.', ',') + '%';
    }
    const badgeE = document.getElementById('badge-errors');
    if (badgeE) badgeE.textContent = statsI.ambErrors;
    if (typeof updateIncidentTypeCounters === 'function') updateIncidentTypeCounters();

    // ── KPIs Clients ──
    const elClientsComms = document.getElementById('kpi-clients-comms');
    if (elClientsComms) {
      elClientsComms.textContent = new Set((CLIENTS || []).map(c => c.comunitat)).size;
    }

  } catch (err) {
    console.error('❌ ERROR loadFromAPI:', err);
  }
}

// ─────────────────────────────────────────────────────────────
//  COMUNITATS — saveComm
// ─────────────────────────────────────────────────────────────

window.saveComm = async function () {
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

  const id     = editingCommId || document.getElementById('c-id').value;
  const lat    = parseFloat(document.getElementById('c-lat').value) || 41.50;
  const lng    = parseFloat(document.getElementById('c-lng').value) || 2.00;
  const fiRaw  = document.getElementById('c-fi').value;
  const fi     = fiRaw ? fiRaw.split('-').reverse().join('/') : '31/12/2026';

  // Camps de la instal·lació FV (opcionals per compatibilitat)
  const produccio    = parseFloat(document.getElementById('c-produccio')?.value) || 0;
  const cupsGen      = document.getElementById('c-cups-gen')?.value.trim()      || '';
  const invMarca     = document.getElementById('c-inversor-marca')?.value.trim() || '';
  const invModel     = document.getElementById('c-inversor-model')?.value.trim() || '';

  const commObj = {
    id, nom, promotor,
    contacte:              document.getElementById('c-contacte').value.trim() || promotor,
    email:                 document.getElementById('c-email').value.trim(),
    telefon:               document.getElementById('c-tel').value.trim(),
    adreca:                document.getElementById('c-adreca').value.trim(),
    potencia,
    producció_anual_kwh:   produccio,
    cups_generacio:        cupsGen,
    inversor_marca:        invMarca,
    inversor_model:        invModel,
    onboarding:            document.getElementById('c-onboarding').value,
    acord_reparto:         document.getElementById('c-acord').value,
    fi_inscripcions:       fi,
    informe_auto:          document.getElementById('c-informe').value,
    marca_blanca:          document.getElementById('c-marca').value,
    lat, lng,
    color:                 document.getElementById('c-color').value || '#1B4D31',
    clients_actius: 0, inscrits: 0,
    cups_auth_actius: 0, cups_auth_proposats: 0,
    sense_auth: 0, datadis_actius: 0,
    autoconsumos: '0/0', clients_app: 0,
    sense_dades: 0, sol_licituds: 0,
    total_estalvi: 0, total_kw: potencia, total_clients: 0,
  };

  // ── Llegir files de clients del pas 2 ──
  const rows = document.querySelectorAll('#client-rows-body .client-table-row');
  const newClients = [];
  rows.forEach((row, i) => {
    const r      = row.id.replace('crow-', '');
    const nomCl  = document.getElementById(`cr-nom-${r}`)?.value.trim();
    if (!nomCl) return; // fila buida → ignorar
    const codi   = row.dataset.codi || `${id.replace('C', '')}${String(i + 1).padStart(3, '0')}`;
    const kw     = parseFloat(document.getElementById(`cr-kw-${r}`)?.value) || 0;
    const cups   = document.getElementById(`cr-cups-${r}`)?.value.trim() || null;
    const preu   = parseFloat(document.getElementById(`cr-preu-${r}`)?.value) || 0;
    const costFix = parseFloat(document.getElementById(`cr-cost-${r}`)?.value) || 0;
    const pctAuto = parseFloat(document.getElementById(`cr-auto-${r}`)?.value) || 0;
    const kwh    = kw * 1500;
    const estalvi_brut = preu * kwh;
    const cost_anual   = costFix * kw * 12;
    const preu_kwh     = kwh > 0 ? cost_anual / kwh : 0;
    const pct_estalvi  = estalvi_brut > 0 ? cost_anual / estalvi_brut : 0;

    newClients.push({
      codi,
      nom:          nomCl,
      nif:          document.getElementById(`cr-nif-${r}`)?.value.trim()            || '',
      cups_consum:  cups,
      comercialitzadora: document.getElementById(`cr-comercialitzadora-${r}`)?.value.trim() || '',
      tel:          document.getElementById(`cr-tel-${r}`)?.value.trim()            || '',
      email:        document.getElementById(`cr-email-${r}`)?.value.trim()          || '',
      inici_fact:   null,
      baixa:        null,
      app:          'No',
      estat:        document.getElementById(`cr-estat-${r}`)?.value || 'Proposat',
      modalitat:    'Ahorra sempre',
      perfil:       'F',
      import_eur:   0,
      comunitat:    id,
      kw, kwh,
      preu_llum:    preu,
      cost_fix:     costFix,
      estalvi_brut,
      preu_kwh,
      pct_estalvi:  pct_estalvi * 100,
      periode:      0,
      cups_auth:    cups ? 'OK' : 'Falten',
      cups_auth_note: cups ? '' : 'Pendent',
      autoconsum:   pctAuto,
      datadis:      'Desconegut',
      dades_recents: 'Sense dades',
      sense_auto:   'OK',
    });
  });

  commObj.total_clients = newClients.length;
  commObj.total_kw      = newClients.reduce((s, c) => s + c.kw, 0) || potencia;

  // ── Cridar l'API ──
  try {
    if (editingCommId) {
      await apiFetch(`/api/communities/${editingCommId}`, 'PUT', commObj);
      // Actualitzar clients existents o afegir nous
      const existingCodis = CLIENTS.filter(c => c.comunitat === editingCommId).map(c => c.codi);
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
        try {
          await apiFetch('/api/clients', 'POST', cl);
        } catch (clientErr) {
          console.warn('Client no guardat:', cl.codi, clientErr.message);
        }
      }
      showToast('✅ Comunitat creada i guardada');
    }
  } catch (err) {
    errEl.textContent = `⚠ Error de l'API: ${err.message}`;
    return;
  }

  closeModal('modal-comm');
  await loadFromAPI();
  if (typeof reloadCurrentView === 'function') reloadCurrentView();
};

// ─────────────────────────────────────────────────────────────
//  COMUNITATS — deleteComm
// ─────────────────────────────────────────────────────────────

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
      if (typeof detailMaps !== 'undefined' && detailMaps[id]) {
        try { detailMaps[id].remove(); } catch (e) {}
        delete detailMaps[id];
      }
      await loadFromAPI();
    }
  );
};

// ─────────────────────────────────────────────────────────────
//  CLIENTS — saveClient
// ─────────────────────────────────────────────────────────────

window.saveClient = async function (e) {
  if (e) e.preventDefault();
  const nom   = document.getElementById('cl-nom').value.trim();
  const nif   = document.getElementById('cl-nif').value.trim();
  const kw    = parseFloat(document.getElementById('cl-kw').value) || 0;
  const errEl = document.getElementById('modal-client-err');

  if (!nom || !nif || !kw) {
    errEl.textContent = '⚠ Omple els camps: Nom, NIF i kW assignats.';
    return;
  }
  errEl.textContent = '';

  const cups     = document.getElementById('cl-cups').value.trim() || null;
  const preu     = parseFloat(document.getElementById('cl-preu')?.value) || 0;
  const costFix  = parseFloat(document.getElementById('cl-cost')?.value) || 0;
  const pctAuto  = parseFloat(document.getElementById('cl-auto')?.value) || 0;
  const kwh      = kw * 1500;
  const estalvi_brut = preu * kwh;
  const cost_anual   = costFix * kw * 12;
  const preu_kwh     = kwh > 0 ? cost_anual / kwh : 0;

  const codi = editingClientCodi || (() => {
    const prefix   = editingClientCommId ? editingClientCommId.replace('C', '') : '000';
    const existing = CLIENTS.filter(c => c.comunitat === editingClientCommId)
      .map(c => parseInt(c.codi.slice(-3))).filter(n => !isNaN(n));
    const max = existing.length ? Math.max(...existing) : 0;
    return prefix + String(max + 1).padStart(3, '0');
  })();

  const clientObj = {
    codi, nom, nif,
    cups_consum:   cups,
    tel:           document.getElementById('cl-tel').value.trim() || null,
    email:         document.getElementById('cl-email').value.trim(),
    inici_fact:    document.getElementById('cl-inici')?.value || null,
    baixa:         document.getElementById('cl-baixa')?.value  || null,
    app:           document.getElementById('cl-app')?.value    || 'No',
    estat:         document.getElementById('cl-estat').value,
    modalitat:     document.getElementById('cl-modalitat').value,
    perfil:        document.getElementById('cl-perfil').value,
    comercialitzadora: document.getElementById('cl-comercialitzadora')?.value || null,
    import_eur:    parseFloat(document.getElementById('cl-import')?.value) || 0,
    comunitat:     editingClientCommId,
    kw, kwh,
    preu_llum:     preu,
    cost_fix:      costFix,
    estalvi_brut,
    preu_kwh,
    pct_estalvi:   estalvi_brut > 0 ? cost_anual / estalvi_brut : null,
    periode:       0,
    autoconsum:    pctAuto,
    cups_auth:     cups ? 'OK' : 'Falten',
    cups_auth_note: cups ? '' : 'Pendent',
    datadis:       'Desconegut',
    dades_recents: 'Sense dades',
    sense_auto:    'OK',
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
  reloadCurrentView();
};

// ─────────────────────────────────────────────────────────────
//  CLIENTS — deleteClient
// ─────────────────────────────────────────────────────────────

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
        typeof currentView     !== 'undefined' && currentView === 'comunitat-detail' &&
        typeof currentCommunity !== 'undefined' && currentCommunity === commId
      ) {
        renderCommunityDetail(commId);
      }
    }
  );
};

// ─────────────────────────────────────────────────────────────
//  STATS (calculats des de les dades de Supabase)
// ─────────────────────────────────────────────────────────────

function getClientsByCommunity(commId) {
  return CLIENTS.filter(c => c.comunitat === commId);
}

function getAgreementsStats() {
  const total     = AGREEMENTS.length;
  const pendents  = AGREEMENTS.filter(a => (a.estat || '').toLowerCase() === 'pendent').length;
  const comunitats = new Set(AGREEMENTS.map(a => a.comunitat).filter(Boolean)).size;
  const firmants   = AGREEMENTS.length;
  return { total, pendents, comunitats, firmants };
}

function getIncidentsStats() {
  const totalActives  = COMMUNITIES.length;
  const incidentsActius = INCIDENTS.filter(i => (i.estat || '').toLowerCase() === 'pendent');
  const ambErrors     = new Set(incidentsActius.map(i => i.comunitat).filter(Boolean)).size;
  const senseErrors   = totalActives - ambErrors;
  return { totalActives, ambErrors, senseErrors };
}

function normalizeTipus(t) {
  return (t || '').toLowerCase().trim().replace(/\s+/g, '_');
}

function updateIncidentTypeCounters() {
  const pendents = INCIDENTS.filter(i => (i.estat || '').toLowerCase() === 'pendent');
  const counts = {
    falta_dades: pendents.filter(i => normalizeTipus(i.tipus) === 'falta_dades').length,
    sense_gen:   pendents.filter(i => normalizeTipus(i.tipus) === 'sense_gen').length,
    baixada:     pendents.filter(i => normalizeTipus(i.tipus) === 'baixada').length,
    multiple:    pendents.filter(i => normalizeTipus(i.tipus) === 'multiple').length,
  };
  const el1 = document.getElementById('count-falta-dades');
  const el2 = document.getElementById('count-sense-gen');
  const el3 = document.getElementById('count-baixada');
  const el4 = document.getElementById('count-multiple');
  if (el1) el1.textContent = counts.falta_dades;
  if (el2) el2.textContent = counts.sense_gen;
  if (el3) el3.textContent = counts.baixada;
  if (el4) el4.textContent = counts.multiple;
}

// ─────────────────────────────────────────────────────────────
//  ENERGIA — gràfics i estadístiques
// ─────────────────────────────────────────────────────────────

// Noms de mesos en català per l'eix X
const _MESOS = ['Gen','Feb','Mar','Abr','Mai','Jun','Jul','Ago','Set','Oct','Nov','Des'];

// Converteix "2025-01" → "Gen '25"
function formatMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${_MESOS[m - 1]} '${String(y).slice(2)}`;
}

// Debounce per evitar crides simultànies
const _energyTimers = {};

// forceAll=true → ignora els inputs de data i carrega TOT (ús intern al render inicial)
async function updateCommunityEnergy(commId, forceAll = false) {
  clearTimeout(_energyTimers[commId]);
  await new Promise(resolve => { _energyTimers[commId] = setTimeout(resolve, 100); });

  const startEl = document.getElementById(`estalvi-start-${commId}`);
  const endEl   = document.getElementById(`estalvi-end-${commId}`);
  const start   = forceAll ? '' : (startEl?.value || '');
  const end     = forceAll ? '' : (endEl?.value   || '');

  try {
    let url = `/api/energy/${commId}`;
    const params = [];
    if (start) params.push(`start=${start}`);
    if (end)   params.push(`end=${end}`);
    if (params.length) url += '?' + params.join('&');

    const data = await apiFetch(url);
    console.log('ENERGY API:', commId, '| registres:', data.labels?.length, '| estalvi:', data.estalvi_total);

    const rawLabels = data.labels   || [];
    const autoData  = data.autoconsum || [];
    const excData   = data.excedent   || [];
    const estalvi   = data.estalvi_total || 0;

    // Etiquetes formatades (Gen '25, Feb '25…)
    const labels = rawLabels.map(formatMonthLabel);

    // Totals acumulats
    const totalAuto = autoData.reduce((s, v) => s + v, 0);
    const totalExc  = excData.reduce((s, v) => s + v, 0);

    // Opcions comunes dels gràfics — escala automàtica, eix X amb tots els mesos
    const mkChartOpts = (yLabel) => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} ${yLabel}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#E3E8E3' },
          ticks: {
            font: { size: 10 },
            callback: v => v.toLocaleString('ca-ES') + (yLabel === 'kWh' ? ' kWh' : ' €'),
          },
        },
      },
    });

    const mkDatasets = (aData, eData) => ([
      {
        label: 'Autoconsum', data: aData,
        backgroundColor: 'rgba(62,171,107,0.78)',
        borderRadius: 4, borderSkipped: false,
      },
      {
        label: 'Excedent', data: eData,
        backgroundColor: 'rgba(43,108,176,0.68)',
        borderRadius: 4, borderSkipped: false,
      },
    ]);

    // ── Gràfic estalvi (€) ──
    const cEstalvi = document.getElementById(`chart-estalvi-${commId}`);
    if (cEstalvi) {
      if (charts[`estalvi-${commId}`]) {
        try { charts[`estalvi-${commId}`].destroy(); } catch(e) {}
      }
      charts[`estalvi-${commId}`] = new Chart(cEstalvi, {
        type: 'bar',
        data: { labels, datasets: mkDatasets(autoData, excData) },
        options: mkChartOpts('€'),
      });
    }

    // ── Gràfic eficiència (kWh) ──
    const cEfic = document.getElementById(`chart-efic-${commId}`);
    if (cEfic) {
      if (charts[`efic-${commId}`]) {
        try { charts[`efic-${commId}`].destroy(); } catch(e) {}
      }
      charts[`efic-${commId}`] = new Chart(cEfic, {
        type: 'bar',
        data: { labels, datasets: mkDatasets(autoData, excData) },
        options: mkChartOpts('kWh'),
      });
    }

    // ── Actualitzar valors dels panells ──

    // Rendiment tab header
    const elRT = document.getElementById(`estalvi-total-${commId}`);
    if (elRT) elRT.textContent = estalvi.toFixed(2).replace('.', ',') + ' €';

    // Panell Estalvi (IDs afegits al template)
    const elSTotal = document.getElementById(`estalvi-stat-total-${commId}`);
    const elSAuto  = document.getElementById(`estalvi-stat-auto-${commId}`);
    const elSExc   = document.getElementById(`estalvi-stat-exc-${commId}`);
    if (elSTotal) elSTotal.textContent = estalvi.toFixed(2).replace('.', ',') + ' €';
    if (elSAuto)  elSAuto.textContent  = totalAuto.toFixed(2).replace('.', ',') + ' €';
    if (elSExc)   elSExc.textContent   = totalExc.toFixed(2).replace('.', ',') + ' €';

    // Panell Eficiència (IDs afegits al template)
    const elEAuto  = document.getElementById(`efic-stat-auto-${commId}`);
    const elEExc   = document.getElementById(`efic-stat-exc-${commId}`);
    const elEPct   = document.getElementById(`efic-stat-pct-${commId}`);
    if (elEAuto) elEAuto.textContent = totalAuto.toFixed(0) + ' kWh';
    if (elEExc)  elEExc.textContent  = totalExc.toFixed(0) + ' kWh';
    if (elEPct) {
      const total = totalAuto + totalExc;
      const pct = total > 0 ? (totalAuto / total * 100).toFixed(1) : '0,0';
      elEPct.textContent = pct.replace('.', ',') + '%';
    }

  } catch (err) {
    console.error('❌ Error carregant energia:', err);
  }
}

// ─────────────────────────────────────────────────────────────
//  EXPORT CSV
// ─────────────────────────────────────────────────────────────

function downloadCSV(data, filename = 'export.csv') {
  if (!data || !data.length) {
    alert('No hi ha dades per exportar');
    return;
  }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportClientsVisible() {
  const select = document.getElementById('filter-comm-clients');
  const data   = (select && select.value)
    ? CLIENTS.filter(c => c.comunitat === select.value)
    : CLIENTS;
  downloadCSV(data, 'clients.csv');
}

function exportCommunitiesAll() {
  downloadCSV(COMMUNITIES, 'communities.csv');
}

// ─────────────────────────────────────────────────────────────
//  Punt d'entrada: carregar dades quan el DOM estigui llest
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Web carregada — carregant dades del backend...');
  loadFromAPI();
});
