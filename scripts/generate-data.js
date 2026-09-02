// Fetches currently-open SECOP II processes (nationwide, precio_base <= 1.500M COP,
// offer deadline still in the future) and writes them to data.json for the site to load.
// Run manually with `node scripts/generate-data.js`, or scheduled by
// .github/workflows/refresh.yml every hour.
const fs = require("fs");
const path = require("path");

const FIELDS = [
  "id_del_proceso", "entidad", "departamento_entidad", "ciudad_entidad",
  "nombre_del_procedimiento", "descripci_n_del_procedimiento",
  "modalidad_de_contratacion", "precio_base", "estado_del_procedimiento",
  "fecha_de_publicacion_del", "fecha_de_recepcion_de", "urlproceso", "tipo_de_contrato"
].join(",");

function todayUTC() {
  return new Date().toISOString().slice(0, 10) + "T00:00:00";
}

async function fetchRaw() {
  const where = encodeURIComponent(
    `precio_base<=1500000000 AND fecha_de_recepcion_de >= '${todayUTC()}'`
  );
  const url =
    `https://www.datos.gov.co/resource/p6dx-8zbt.json?$select=${FIELDS}` +
    `&$where=${where}&$order=fecha_de_recepcion_de ASC&$limit=5000`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`SECOP API returned ${res.status}`);
  return res.json();
}

function dedupeAndTransform(raw) {
  // The dataset carries one row per snapshot as a process moves through phases
  // (draft -> published -> evaluation, ...). Keep only the most recent snapshot per id.
  const byId = new Map();
  for (const r of raw) {
    const id = r.id_del_proceso;
    const fpub = r.fecha_de_publicacion_del || "0000";
    const existing = byId.get(id);
    if (!existing || fpub > existing._fpub) byId.set(id, { ...r, _fpub: fpub });
  }
  const out = [...byId.values()].map((r) => ({
    id: r.id_del_proceso,
    ent: r.entidad,
    dep: r.departamento_entidad || "No definido",
    ciu: r.ciudad_entidad || "No definido",
    nom: r.nombre_del_procedimiento,
    desc: (r.descripci_n_del_procedimiento || "").replace(/\s+/g, " ").trim().slice(0, 240),
    mod: r.modalidad_de_contratacion,
    precio: Number(r.precio_base) || 0,
    estado: r.estado_del_procedimiento,
    fpub: r.fecha_de_publicacion_del ? r.fecha_de_publicacion_del.slice(0, 10) : null,
    frec: r.fecha_de_recepcion_de ? r.fecha_de_recepcion_de.slice(0, 10) : null,
    url: (r.urlproceso && r.urlproceso.url) || "",
    tipo: r.tipo_de_contrato || ""
  }))
    // SECOP hasn't generated a public notice yet for processes still in draft/pending
    // internal approval (or cancelled before publishing one) — their urlproceso just
    // points at the generic login page instead of the actual process, so drop them
    // rather than list a link that goes nowhere useful.
    .filter((r) => !r.url.includes("STS/Users/Login"));
  out.sort(
    (a, b) =>
      (a.frec || "9999").localeCompare(b.frec || "9999") ||
      (b.fpub || "").localeCompare(a.fpub || "")
  );
  return out;
}

(async () => {
  const raw = await fetchRaw();
  const rows = dedupeAndTransform(raw);
  const payload = {
    generatedAt: new Date().toISOString(),
    rows
  };
  const outPath = path.join(__dirname, "..", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(payload));
  console.log(`Wrote ${rows.length} unique processes to ${outPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
