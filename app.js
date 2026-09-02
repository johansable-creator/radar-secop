const STORAGE_KEY = "secop-seen-ids";
const MOD_STORAGE_KEY = "secop-mod-filter";

let DATA = [];
let GENERATED_AT = null;

let selectedMods = new Set();
try {
  const storedMods = localStorage.getItem(MOD_STORAGE_KEY);
  if (storedMods) selectedMods = new Set(JSON.parse(storedMods));
} catch (e) {}
function persistMods() {
  try { localStorage.setItem(MOD_STORAGE_KEY, JSON.stringify([...selectedMods])); } catch (e) {}
}

function fmtCOP(n) {
  if (!n) return "$0";
  return "$" + Math.round(n).toLocaleString("es-CO");
}
function fmtCOPCompact(n) {
  if (n >= 1000000000) return "$" + (n / 1000000000).toFixed(2).replace(/\.00$/, "") + "MM";
  if (n >= 1000000) return "$" + Math.round(n / 1000000) + "M";
  return fmtCOP(n);
}
function fmtDate(d) {
  if (!d) return "sin fecha";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}
function daysUntil(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

let seenIds = new Set();
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) seenIds = new Set(JSON.parse(stored));
} catch (e) {}
let isFirstVisit = true;

function priceRange() {
  let min = Number(document.getElementById("price-min").value);
  let max = Number(document.getElementById("price").value);
  if (min > max) { const t = min; min = max; max = t; }
  return [min, max];
}

function geoFilters() {
  return {
    dep: document.getElementById("dep").value,
    mun: document.getElementById("mun").value
  };
}

function baseFilter() {
  const [minPrice, maxPrice] = priceRange();
  const hideRfi = document.getElementById("hide-rfi").getAttribute("aria-pressed") === "true";
  const { dep, mun } = geoFilters();
  let rows = DATA.filter(r => r.precio >= minPrice && r.precio <= maxPrice);
  if (hideRfi) rows = rows.filter(r => r.precio > 0);
  if (dep) rows = rows.filter(r => r.dep === dep);
  if (mun) rows = rows.filter(r => r.ciu === mun);
  if (selectedMods.size > 0) rows = rows.filter(r => selectedMods.has(r.mod));
  return rows;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function render() {
  const q = document.getElementById("search").value.trim().toLowerCase();
  const sortMode = document.getElementById("sort").value;

  let rows = baseFilter();
  if (q) {
    rows = rows.filter(r =>
      (r.ent + " " + r.nom + " " + r.desc + " " + r.ciu + " " + r.dep + " " + r.mod).toLowerCase().includes(q)
    );
  }

  rows = rows.slice().sort((a, b) => {
    if (sortMode === "price-desc") return b.precio - a.precio;
    if (sortMode === "price-asc") return a.precio - b.precio;
    if (sortMode === "published") return (b.fpub || "").localeCompare(a.fpub || "");
    return (a.frec || "9999").localeCompare(b.frec || "9999");
  });

  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  document.getElementById("result-count").innerHTML =
    "<strong>" + rows.length + "</strong> de " + DATA.length + " procesos en rango";

  if (rows.length === 0) {
    list.innerHTML = "";
    empty.hidden = false;
  } else {
    empty.hidden = true;
    list.innerHTML = rows.map(r => {
      const days = daysUntil(r.frec);
      let chipClass = "fine", chipLabel = days + " días";
      if (days !== null) {
        if (days <= 1) { chipClass = "urgent"; chipLabel = days <= 0 ? "cierra hoy" : "cierra mañana"; }
        else if (days <= 7) { chipClass = "soon"; chipLabel = days + " días"; }
      }
      const isNew = !isFirstVisit && !seenIds.has(r.id);
      const priceClass = r.precio === 0 ? "card-price zero" : "card-price";
      const priceText = r.precio === 0 ? "sin cuantía" : fmtCOPCompact(r.precio);
      return '<a class="card" href="' + escapeAttr(r.url) + '" target="_blank" rel="noopener">' +
        '<div class="card-main">' +
          '<div class="card-entity">' + escapeHtml(r.ent) + (isNew ? ' <span class="new-badge">NUEVO</span>' : '') + '</div>' +
          '<div class="card-title">' + escapeHtml(r.nom) + '</div>' +
          '<div class="card-desc">' + escapeHtml(r.desc) + '</div>' +
          '<div class="card-tags">' +
            '<span class="tag">' + escapeHtml(r.mod) + '</span>' +
            '<span class="tag">' + escapeHtml(r.ciu) + ', ' + escapeHtml(r.dep) + '</span>' +
            (r.fpub ? '<span class="tag">publicó ' + fmtDate(r.fpub) + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="card-side">' +
          '<div class="' + priceClass + '">' + priceText + '</div>' +
          '<div class="deadline-chip ' + chipClass + '">' + chipLabel + '</div>' +
          '<div class="card-go">Ver proceso &rarr;</div>' +
        '</div>' +
      '</a>';
    }).join("");
  }

  try {
    const allIds = DATA.map(r => r.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
  } catch (e) {}
}

function updateStats() {
  const inRange = baseFilter();
  document.getElementById("stat-total").textContent = inRange.length;
  document.getElementById("stat-today").textContent = inRange.filter(r => { const d = daysUntil(r.frec); return d !== null && d <= 1; }).length;
  document.getElementById("stat-week").textContent = inRange.filter(r => { const d = daysUntil(r.frec); return d !== null && d <= 7; }).length;
  const total = inRange.reduce((s, r) => s + r.precio, 0);
  document.getElementById("stat-value").textContent = fmtCOPCompact(total);
}

function renderModChips() {
  const [minPrice, maxPrice] = priceRange();
  const hideRfi = document.getElementById("hide-rfi").getAttribute("aria-pressed") === "true";
  const { dep, mun } = geoFilters();
  let base = DATA.filter(r => r.precio >= minPrice && r.precio <= maxPrice);
  if (hideRfi) base = base.filter(r => r.precio > 0);
  if (dep) base = base.filter(r => r.dep === dep);
  if (mun) base = base.filter(r => r.ciu === mun);
  const counts = new Map();
  base.forEach(r => counts.set(r.mod, (counts.get(r.mod) || 0) + 1));
  const allMods = [...new Set(DATA.map(r => r.mod))];
  const mods = allMods.map(m => [m, counts.get(m) || 0]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const container = document.getElementById("mod-chips");
  container.innerHTML = mods.map(([m, c]) =>
    '<button class="toggle-btn mod-chip" data-mod="' + escapeAttr(m) + '" aria-pressed="' + (selectedMods.has(m) ? "true" : "false") + '">' +
      escapeHtml(m) + ' <span class="chip-count">' + c + '</span>' +
    '</button>'
  ).join("") + (selectedMods.size > 0 ? '<button class="mod-clear" id="mod-clear" type="button">Limpiar</button>' : '');

  container.querySelectorAll(".mod-chip").forEach(b => {
    b.addEventListener("click", () => {
      const m = b.dataset.mod;
      if (selectedMods.has(m)) selectedMods.delete(m); else selectedMods.add(m);
      persistMods();
      renderModChips();
      updateStats();
      render();
    });
  });
  const clearBtn = document.getElementById("mod-clear");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    selectedMods.clear();
    persistMods();
    renderModChips();
    updateStats();
    render();
  });
}

function updatePriceLabel() {
  const minEl = document.getElementById("price-min");
  const maxEl = document.getElementById("price");
  if (Number(minEl.value) > Number(maxEl.value)) minEl.value = maxEl.value;
  document.getElementById("price-min-value").textContent = fmtCOPCompact(Number(minEl.value));
  const v = Number(maxEl.value);
  document.getElementById("price-value").textContent = fmtCOPCompact(v);
  document.querySelectorAll(".preset-btn").forEach(b => {
    b.classList.toggle("active", Number(b.dataset.preset) === v);
  });
}

function populateDepartamentos() {
  const counts = new Map();
  DATA.forEach(r => counts.set(r.dep, (counts.get(r.dep) || 0) + 1));
  const deps = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sel = document.getElementById("dep");
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los departamentos</option>' +
    deps.map(([d, c]) => '<option value="' + escapeAttr(d) + '"' + (d === current ? " selected" : "") + '>' + escapeHtml(d) + ' (' + c + ')</option>').join("");
}

function populateMunicipios() {
  const dep = document.getElementById("dep").value;
  const pool = dep ? DATA.filter(r => r.dep === dep) : DATA;
  const counts = new Map();
  pool.forEach(r => counts.set(r.ciu, (counts.get(r.ciu) || 0) + 1));
  const muns = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sel = document.getElementById("mun");
  const current = sel.value;
  const stillValid = muns.some(([m]) => m === current);
  sel.innerHTML = '<option value="">Todos los municipios</option>' +
    muns.map(([m, c]) => '<option value="' + escapeAttr(m) + '"' + (m === current && stillValid ? " selected" : "") + '>' + escapeHtml(m) + ' (' + c + ')</option>').join("");
  if (!stillValid) sel.value = "";
}

document.getElementById("search").addEventListener("input", render);
document.getElementById("price").addEventListener("input", () => { updatePriceLabel(); updateStats(); renderModChips(); render(); });
document.getElementById("price-min").addEventListener("input", () => { updatePriceLabel(); updateStats(); renderModChips(); render(); });
document.getElementById("sort").addEventListener("change", render);
document.getElementById("hide-rfi").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  const pressed = btn.getAttribute("aria-pressed") === "true";
  btn.setAttribute("aria-pressed", String(!pressed));
  updateStats();
  renderModChips();
  render();
});
document.querySelectorAll(".preset-btn").forEach(b => {
  b.addEventListener("click", () => {
    document.getElementById("price").value = b.dataset.preset;
    updatePriceLabel();
    updateStats();
    renderModChips();
    render();
  });
});
document.getElementById("dep").addEventListener("change", () => {
  populateMunicipios();
  updateStats();
  renderModChips();
  render();
});
document.getElementById("mun").addEventListener("change", () => {
  updateStats();
  renderModChips();
  render();
});

async function init() {
  let payload;
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    payload = await res.json();
  } catch (e) {
    document.getElementById("result-count").textContent = "No se pudieron cargar los datos.";
    return;
  }
  DATA = payload.rows || [];
  GENERATED_AT = payload.generatedAt || null;
  isFirstVisit = seenIds.size === 0;

  document.getElementById("updated-at").textContent = GENERATED_AT
    ? new Date(GENERATED_AT).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
    : "desconocido";
  if (!isFirstVisit) {
    const newCount = DATA.filter(r => !seenIds.has(r.id)).length;
    if (newCount > 0) document.getElementById("new-since").textContent =
      newCount + " proceso" + (newCount === 1 ? "" : "s") + " nuevo" + (newCount === 1 ? "" : "s") + " desde tu última visita";
  }

  populateDepartamentos();
  populateMunicipios();
  updatePriceLabel();
  updateStats();
  renderModChips();
  render();
}

init();
