// Frontend (interfaz en TypeScript)
import { getVersion } from "@tauri-apps/api/app";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Parser, SatisfactorySaveHeader, SaveReader } from "@etothepii/satisfactory-file-parser";
import {
  certifications,
  GRADES,
  MEDALS,
  monthlyScores,
  type MonthScore,
} from "./achievements";
import {
  attachChartHover,
  divergingBars,
  legend,
  lineChart,
  VIZ,
  type Series,
} from "./charts";
import { applyStaticI18n, detectLang, getLang, setLang, t, type Lang } from "./i18n";
import {
  describeDiff,
  diffGameData,
  extractGameData,
  GAMEDATA_SCHEMA,
  iconAssetFor,
  type DocsFolder,
  type GameData,
} from "./gamedata";

// Dónde se recuerda la carpeta elegida entre arranques.
const FOLDER_KEY = "saveFolder";

// Tienen que coincidir con los structs del backend.
interface SaveHeader {
  session_name: string;
  map_name: string;
  save_version: number;
  build_version: number;
  play_duration_seconds: number;
  save_date_ms: number;
}
interface SaveEntry {
  name: string;
  size_bytes: number;
  modified_ms: number;
  header: SaveHeader | null;
}
interface InvItem {
  name: string;
  count: number;
  // Clase del juego. Opcional porque un histórico viejo no la trae.
  cls?: string;
}

// El nombre de un edificio del inventario, por el mismo camino que el resto de
// la app: documentación oficial primero, tabla de respaldo después. Antes el
// inventario iba por su cuenta y podía llamar a la misma máquina de dos formas
// según se mirara aquí o en el mapa.
function invName(it: InvItem): string {
  return (it.cls && gdBuildingName(it.cls)) || trBuilding(it.name);
}
interface ProgressInfo {
  current_tier: number;
  milestones: string[];
  research_count: number;
  schematic_total: number;
}
interface BodyInfo {
  game_version: string;
  uncompressed_bytes: number;
  chunk_count: number;
  total_buildings: number;
  type_count: number;
  inventory: InvItem[];
  progression: ProgressInfo;
  production: RecipeCount[];
}
interface RecipeCount {
  recipe: string;
  count: number;
}
interface ItemRate {
  item: string;
  rate: number;
}
interface ItemCount {
  item: string;
  count: number;
}
// Métricas ricas de una foto del histórico. OJO con los nombres de pieza:
// en schema 1 van en español, porque RECIPE_OUTPUT/RECIPES están indexados así.
// Si algún día canonizamos a inglés, el campo schema permite migrar el
// histórico viejo sin perderlo.
interface SnapshotMetrics {
  schema: number;
  tier: number | null;
  milestones: number | null;
  research_count: number | null;
  machines_with_recipe: number | null;
  overclocked: number | null;
  power_consumption_mw: number | null;
  power_generation_mw: number | null;
  production: ItemRate[] | null;
  consumption: ItemRate[] | null;
  deficits: ItemRate[] | null;
  stored: ItemCount[] | null;
  collectables: ItemCount[] | null;
  modded: boolean | null;
  mod_count: number | null;
  save_version: number | null;
  build_version: number | null;
  recipe_coverage: number | null;
  levels: number | null;
  extent_m: number | null;
  game_version: string | null;
  save_name: string | null;
  player_x?: number | null;
  player_y?: number | null;
  zones?: { x: number; y: number; n: number }[] | null;
}
interface Snapshot {
  ts_ms: number;
  play_seconds: number;
  total_buildings: number;
  types: InvItem[];
  metrics?: SnapshotMetrics | null;
}

let folderInput: HTMLInputElement;
let statusEl: HTMLElement;
let tableBody: HTMLElement;
let detailTitle: HTMLElement;
let detailStatus: HTMLElement;
let detailGrid: HTMLElement;
let resumeEl: HTMLElement;
let vitalsEl: HTMLElement;
let inventoryEl: HTMLElement;
let historyEl: HTMLElement;
let energyEl: HTMLElement;
let planEl: HTMLElement;
let calcEl: HTMLElement;
let progressEl: HTMLElement;
let productionEl: HTMLElement;
let balanceEl: HTMLElement;
let storedEl: HTMLElement;
let explorationEl: HTMLElement;
let mapEl: HTMLElement;
let compatEl: HTMLElement;
let gameDataEl: HTMLElement;
let iconsEl: HTMLElement;
let backupsEl: HTMLElement;
let achievementsEl: HTMLElement;
let alertsEl: HTMLElement;
let milestoneEl: HTMLElement;
let gameData: GameData | null = null;
let noteText: HTMLTextAreaElement;
let noteSave: HTMLButtonElement;
let noteStatus: HTMLElement;
let noteLabel: HTMLElement;

let worldSelect: HTMLSelectElement;

// ---- Secciones plegables ----
// Cada render escribe su propio <h3 class="inv-title"> dentro del bloque. En
// vez de repetir ese texto en el summary (y tener que tocar todos los renders),
// lo copiamos al abrir/actualizar y ocultamos el h3 por CSS. Así el título
// conserva sus contadores y los renders siguen sin enterarse.
// Y si un bloque se queda vacío, su sección entera desaparece en lugar de
// dejar una cabecera que no lleva a ninguna parte.
function syncAccordion(acc: HTMLDetailsElement) {
  const body = acc.querySelector<HTMLElement>(":scope > div");
  if (!body) return;
  const empty = body.innerHTML.trim() === "";
  acc.hidden = empty;
  if (empty) return;
  const title = body.querySelector<HTMLElement>(".inv-title");
  const label = acc.querySelector<HTMLElement>(".acc-title");
  if (title && label && title.textContent) label.textContent = title.textContent;
}

function setupAccordions() {
  // Los que se rellenan por render: vigilamos su contenido para mantener el
  // título y la visibilidad al día sin tener que llamar a nada desde fuera.
  document.querySelectorAll<HTMLDetailsElement>("details.acc[data-sync]").forEach((acc) => {
    const body = acc.querySelector<HTMLElement>(":scope > div");
    if (body) {
      new MutationObserver(() => syncAccordion(acc)).observe(body, {
        childList: true,
        subtree: true,
      });
    }
    syncAccordion(acc);
  });

  // Recordamos qué dejó abierto el usuario, para no obligarle a desplegar lo
  // mismo cada vez que arranca.
  document.querySelectorAll<HTMLDetailsElement>("details.acc").forEach((acc) => {
    if (!acc.id) return;
    try {
      const saved = localStorage.getItem(`acc:${acc.id}`);
      if (saved !== null) acc.open = saved === "1";
    } catch {
      /* sin almacenamiento local, se queda con el valor por defecto */
    }
    acc.addEventListener("toggle", () => {
      try {
        localStorage.setItem(`acc:${acc.id}`, acc.open ? "1" : "0");
      } catch {
        /* igual: que no poder recordarlo no rompa nada */
      }
    });
  });
}

// Cambia la pestaña visible.
function showTab(name: string) {
  document.querySelectorAll<HTMLElement>(".tab-panel").forEach((p) => {
    p.classList.toggle("hidden", p.id !== `tab-${name}`);
  });
  document.querySelectorAll<HTMLElement>(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
}

// Estado en memoria.
let currentSaves: SaveEntry[] = [];
let currentWorlds: Record<string, SaveEntry[]> = {};
let selectedWorld = "";
let notesCache: Record<string, string> = {};
let plansCache: Record<string, Record<string, number>> = {};
let currentInventory: Record<string, number> = {}; // del mundo abierto: nombre (ES) → cantidad
let currentPowerMW = 0; // consumo estimado del mundo abierto
let currentGenMW = 0; // generación estimada del mundo abierto
let currentTier = 99; // tier del mundo abierto (99 = mostrar todo hasta saberlo)
let currentNoteKey = "";
let openSaveName = ""; // guardado abierto, para poder repasarlo al cambiar de idioma

// ---- Traducción de términos del juego (inglés → español) ----
// Si un nombre no está en la tabla, se muestra tal cual (respaldo en inglés).
const BUILDING_ES: Record<string, string> = {
  "Constructor Mk1": "Constructora Mk1",
  "Smelter Mk1": "Fundición Mk1",
  "Assembler Mk1": "Ensambladora Mk1",
  "Foundry Mk1": "Fundición avanzada Mk1",
  Manufacturer: "Fabricante",
  Refinery: "Refinería",
  "Miner Mk1": "Minero Mk1",
  "Miner Mk2": "Minero Mk2",
  "Miner Mk3": "Minero Mk3",
  "Power Line": "Tendido eléctrico",
  "Power Pole Mk1": "Poste eléctrico Mk1",
  "Power Pole Mk2": "Poste eléctrico Mk2",
  "Power Pole Mk3": "Poste eléctrico Mk3",
  "Conveyor Belt Mk1": "Cinta transportadora Mk1",
  "Conveyor Belt Mk2": "Cinta transportadora Mk2",
  "Conveyor Belt Mk3": "Cinta transportadora Mk3",
  "Conveyor Belt Mk4": "Cinta transportadora Mk4",
  "Conveyor Belt Mk5": "Cinta transportadora Mk5",
  "Conveyor Belt Mk6": "Cinta transportadora Mk6",
  "Conveyor Pole": "Poste de cinta",
  "Conveyor Lift Mk1": "Elevador de cinta Mk1",
  "Conveyor Lift Mk2": "Elevador de cinta Mk2",
  "Conveyor Attachment Splitter": "Divisor",
  "Conveyor Attachment Merger": "Fusionador",
  "Storage Container Mk1": "Contenedor de almacenamiento",
  "Storage Integrated": "Almacenamiento integrado",
  "Generator Integrated Biomass": "Generador de biomasa",
  "Generator Biomass": "Generador de biomasa",
  Workshop: "Banco de equipamiento",
  "Work Bench Integrated": "Banco de trabajo",
  "Hub Terminal": "Terminal del HUB",
  "Trading Post": "Puesto del HUB",
  "Space Elevator": "Ascensor espacial",
  Mam: "MAM",
  "Resource Sink Shop": "Tienda AWESOME",
  "Resource Sink": "Sumidero AWESOME",
  "Packager": "Empaquetadora",
  "Blender": "Mezcladora",
  "Particle Accelerator": "Acelerador de partículas",
  "Oil Pump": "Extractor de petróleo",
  "Oil Refinery": "Refinería",
  "Water Pump": "Extractor de agua",
  "Fracking Extractor": "Extractor de fracking",
  "Fracking Smasher": "Perforadora de fracking",
  "Generator Coal": "Generador de carbón",
  "Generator Fuel": "Generador de combustible",
  "Generator Nuclear": "Central nuclear",
  "Pipeline Mk1": "Tubería Mk1",
  "Pipeline Mk2": "Tubería Mk2",
  "Pipeline Pump Mk1": "Bomba de tubería Mk1",
  "Pipeline Junction Cross": "Cruce de tubería",
  "Power Storage": "Batería de energía",
  "Power Switch": "Interruptor",
};
const ITEM_ES: Record<string, string> = {
  "Iron Ingot": "Lingote de hierro",
  "Iron Plate": "Plancha de hierro",
  "Iron Rod": "Barra de hierro",
  "Iron Screw": "Tornillos",
  Screw: "Tornillos",
  "Copper Ingot": "Lingote de cobre",
  Wire: "Alambre",
  Cable: "Cable",
  Cement: "Hormigón",
  Concrete: "Hormigón",
  "Iron Plate Reinforced": "Plancha de hierro reforzada",
  Rotor: "Rotor",
  "Modular Frame": "Armazón modular",
  "Copper Sheet": "Lámina de cobre",
  "Steel Ingot": "Lingote de acero",
  "Steel Beam": "Viga de acero",
  "Steel Pipe": "Tubería de acero",
  Biofuel: "Biocombustible sólido",
  "Generic Biomass": "Biomasa",
  Leaves: "Hojas",
  Wood: "Madera",
  Mycelia: "Micelio",
  Shroom: "Seta",
  Coal: "Carbón",
  Limestone: "Caliza",
  "Iron Ore": "Mineral de hierro",
  "Copper Ore": "Mineral de cobre",
  "Caterium Ore": "Mineral de caterium",
  "Caterium Ingot": "Lingote de caterio",
  Quickwire: "Turboalambre",
  "Crude Oil": "Petróleo crudo",
  "Liquid Oil": "Petróleo crudo",
  Plastic: "Plástico",
  Rubber: "Caucho",
  "Polymer Resin": "Resina de polímero",
  "Heavy Oil Residue": "Residuo de aceite pesado",
  "Liquid Fuel": "Combustible líquido",
  Fuel: "Combustible",
  "Petroleum Coke": "Coque de petróleo",
  "Circuit Board": "Circuito impreso",
  Computer: "Ordenador",
  Motor: "Motor",
  Stator: "Estátor",
  "Ai Limiter": "Limitador de IA",
  "AI Limiter": "Limitador de IA",
  "Encased Industrial Beam": "Viga industrial reforzada",
  "Modular Frame Heavy": "Armazón modular pesado",
  "Quartz Crystal": "Cristal de cuarzo",
  Silica: "Sílice",
  "Raw Quartz": "Cuarzo en bruto",
  Sulfur: "Azufre",
  Bauxite: "Bauxita",
  "Aluminum Ingot": "Lingote de aluminio",
  "Aluminum Scrap": "Chatarra de aluminio",
  "Alumina Solution": "Solución de alúmina",
  "Hard Drive": "Disco duro",
  "Mercer Sphere": "Esfera Mercer",
  Somersloop: "Somersloop",
  "Power Shard": "Fragmento de energía",
  "Color Cartridge": "Cartucho de color",
  "Packaged Water": "Agua envasada",
  Water: "Agua",
};
// Las tablas de respaldo traducen del inglés al español, así que solo se
// aplican cuando la app está en español. Antes se aplicaban siempre: alguien
// con la app en inglés y sin el juego instalado veía "Fundición Mk1", y el
// README promete una app bilingüe. El nombre original ya viene en inglés.
const trBuilding = (n: string) => (getLang() === "es" ? BUILDING_ES[n] || n : n);
const trItem = (n: string) => (getLang() === "es" ? ITEM_ES[n] || n : n);

// Coleccionables sin recoger (siguen en el mundo) → nombre legible.
const COLLECTABLES: Record<string, { es: string; en: string }> = {
  BP_Crystal_C: { es: "Babas de energía (azul)", en: "Power Slugs (blue)" },
  BP_Crystal_mk2_C: { es: "Babas de energía (amarilla)", en: "Power Slugs (yellow)" },
  BP_Crystal_mk3_C: { es: "Babas de energía (púrpura)", en: "Power Slugs (purple)" },
  BP_WAT1_C: { es: "Somersloops", en: "Somersloops" },
  BP_WAT2_C: { es: "Esferas Mercer", en: "Mercer Spheres" },
  BP_DropPod_C: { es: "Cápsulas (discos duros)", en: "Drop pods (hard drives)" },
};

const trCollect = (k: string) => {
  const c = COLLECTABLES[k];
  return c ? c[getLang() === "es" ? "es" : "en"] : k;
};

// El mundo (sesión) al que pertenece un guardado.
// ---- Logros ----
// Se recalculan desde el histórico cada vez que se abre un mundo. No se
// guardan: así una medalla que añadamos mañana aparece con la fecha en la que
// de verdad se ganó, en vez de estrenar el muro vacío.
function monthName(key: string): string {
  const [y, m] = key.split("-").map((x) => parseInt(x, 10));
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString(getLang(), { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function medalRow(ms: MonthScore["medals"][number], showNext: boolean): string {
  const def = MEDALS.find((m) => m.id === ms.id)!;
  const lang = getLang();
  if (ms.value === null) return "";
  const val = ms.value >= 100 ? Math.round(ms.value) : Math.round(ms.value * 10) / 10;
  const grade = GRADES[ms.grade][lang];
  const next =
    showNext && ms.next !== null
      ? `<span class="md-next">${t("ach.toNext", {
          n: ms.next >= 10 ? Math.round(ms.next) : Math.round(ms.next * 10) / 10,
          unit: def.unit[lang],
          grade: GRADES[ms.nextGrade][lang],
        })}</span>`
      : "";
  return (
    `<div class="md-row md-g${ms.grade}" title="${escapeAttr(def.desc[lang])}">` +
    `<span class="md-name">${escapeXml(def.name[lang])}</span>` +
    `<span class="md-val">${val.toLocaleString()} <span class="muted">${escapeXml(def.unit[lang])}</span></span>` +
    `<span class="md-grade">${escapeXml(grade)}</span>${next}</div>`
  );
}

function renderAchievements(snaps: Snapshot[]) {
  if (!achievementsEl) return;
  const lang = getLang();
  if (!snaps.length) {
    achievementsEl.innerHTML = `<p class="muted">${t("ach.noData")}</p>`;
    return;
  }

  const months = monthlyScores(snaps);
  const nowKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const current = months.find((m) => m.key === nowKey);
  const past = months.filter((m) => m.key !== nowKey);

  // La tarjeta del mes en curso va primero: lo que aún puedes conseguir es lo
  // que hace volver a abrir la app. El muro histórico es pasado.
  let html = "";
  if (current) {
    const rows = current.medals.map((m) => medalRow(m, true)).join("");
    html +=
      `<div class="rev-card rev-now"><h3 class="rev-title">${t("ach.review")} — ${escapeXml(monthName(current.key))}` +
      `<span class="rev-grade rev-g${current.overall}">${escapeXml(GRADES[current.overall][lang])}</span></h3>` +
      `<p class="rev-verdict">${t(current.enough ? `ach.verdict.${current.overall}` : "ach.needTwo")}</p>` +
      (current.enough ? rows : "") +
      `</div>`;
  }

  if (past.length) {
    html += `<h3 class="inv-title">${t("ach.history")}</h3>`;
    html += past
      .map((m) => {
        const rows = m.medals
          .filter((x) => x.grade > 0)
          .map((x) => medalRow(x, false))
          .join("");
        return (
          `<div class="rev-card"><h4 class="rev-sub">${escapeXml(monthName(m.key))}` +
          `<span class="rev-grade rev-g${m.overall}">${escapeXml(GRADES[m.overall][lang])}</span></h4>` +
          `<p class="rev-verdict">${t(m.enough ? `ach.verdict.${m.overall}` : "ach.needTwo")}</p>` +
          rows +
          `</div>`
        );
      })
      .join("");
  }

  const certs = certifications(snaps);
  html += `<h3 class="inv-title">${t("ach.certs")} · ${certs.length}</h3>`;
  html += certs.length
    ? `<div class="cert-wall">` +
      certs
        .map(
          (c) =>
            `<div class="cert"><span class="cert-name">${escapeXml(c.name[lang])}</span>` +
            `<span class="cert-date">${c.exact ? "" : t("ach.before")} ${new Date(c.ts).toLocaleDateString(lang)}</span></div>`
        )
        .join("") +
      `</div>`
    : `<p class="muted">${t("ach.noCerts")}</p>`;

  html += `<p class="muted">${t("ach.retro")}</p>`;
  achievementsEl.innerHTML = html;
}

// ---- Copias de seguridad ----
// Lo único irreemplazable que guarda la app es el histórico: el juego rota y
// sobrescribe los autoguardados, así que una foto que no se tomó no existe en
// ningún sitio. Por eso restaurar FUSIONA en vez de reemplazar.
interface BackupInfo {
  name: string;
  bytes: number;
  created_ms: number;
  worlds: number;
  snapshots: number;
  notes: number;
}
interface ImportReport {
  snapshots_added: number;
  snapshots_enriched: number;
  notes_added: number;
  plans_added: number;
  skipped: number;
}

async function renderBackups(msg = "") {
  if (!backupsEl) return;
  let list: BackupInfo[] = [];
  try {
    list = await invoke<BackupInfo[]>("list_backups");
  } catch (e) {
    console.error("Copias:", e);
  }
  const rows = list.length
    ? list
        .map((b) => {
          const kind = b.name.startsWith("auto-") ? t("bk.auto") : t("bk.manual");
          const when = b.created_ms ? new Date(b.created_ms).toLocaleString() : b.name;
          return (
            `<div class="bk-row"><span class="bk-main"><b>${when}</b> <span class="muted">${kind}</span>` +
            `<span class="bk-meta">${t("bk.item", {
              worlds: b.worlds,
              snaps: b.snapshots,
              notes: b.notes,
              kb: Math.round(b.bytes / 1024),
            })}</span></span>` +
            `<button class="bk-restore" data-name="${escapeAttr(b.name)}" type="button">${t("bk.restore")}</button></div>`
          );
        })
        .join("")
    : `<p class="muted">${t("bk.none")}</p>`;

  backupsEl.innerHTML =
    (msg ? `<p class="gd-status">${escapeXml(msg)}</p>` : "") +
    `<div class="bk-list">${rows}</div>` +
    `<div class="bk-actions">` +
    `<button id="bk-create" type="button">${t("bk.create")}</button>` +
    `<button id="bk-open" type="button">${t("bk.open")}</button>` +
    `</div>` +
    `<p class="muted">${t("bk.note")}</p>`;

  document.querySelector("#bk-create")?.addEventListener("click", async () => {
    try {
      await invoke("export_backup");
      await renderBackups(t("bk.done"));
    } catch (e) {
      await renderBackups(`${t("bk.failed")} ${e}`);
    }
  });
  document.querySelector("#bk-open")?.addEventListener("click", () => {
    invoke("open_backups_folder").catch((e) => console.error(e));
  });
  backupsEl.querySelectorAll<HTMLButtonElement>(".bk-restore").forEach((b) => {
    b.addEventListener("click", async () => {
      try {
        const r = await invoke<ImportReport>("import_backup", { name: b.dataset.name });
        notesCache = await invoke<Record<string, string>>("get_notes");
        plansCache = await invoke<Record<string, Record<string, number>>>("get_plans");
        await renderBackups(
          t("bk.restored", {
            added: r.snapshots_added,
            enriched: r.snapshots_enriched,
            notes: r.notes_added,
            plans: r.plans_added,
            skipped: r.skipped,
          })
        );
        if (openSaveName) await inspect(openSaveName);
      } catch (e) {
        await renderBackups(`${t("bk.failed")} ${e}`);
      }
    });
  });
}

// ---- Acceso a los datos del juego, con respaldo ----
// Todo lo que sigue prefiere la documentación oficial y, si no está (porque el
// juego no se encuentra instalado), cae en las tablas escritas a mano. Las
// tablas pasan así de ser la fuente de verdad a ser el plan B.

function gdItemName(cls: string): string | null {
  const it = gameData && gameData.items[cls];
  return (it && (it.name[getLang()] || it.name.en)) || null;
}

function gdBuildingName(cls: string): string | null {
  const b = gameData && gameData.buildings[cls];
  return (b && (b.name[getLang()] || b.name.en)) || null;
}

// Una receta lista para usar: nombres ya traducidos y ritmos por minuto.
function gdRecipe(
  leaf: string
): { item: string; rate: number; inputs: { item: string; rate: number }[] } | null {
  const r = gameData && gameData.recipes[`${leaf}_C`];
  if (!r) return null;
  const outName = gdItemName(r.out);
  if (!outName) return null;
  const inputs: { item: string; rate: number }[] = [];
  for (const i of r.inputs) {
    const n = gdItemName(i.item);
    if (n) inputs.push({ item: n, rate: i.rate });
  }
  return { item: outName, rate: r.rate, inputs };
}

// Piezas que se pueden fabricar, por nombre visible. Sirve para no confundir
// una materia prima con un déficit: el mineral de hierro no se "produce".
let craftableCache: { data: GameData | null; set: Set<string> } = { data: null, set: new Set() };
function craftableItems(): Set<string> {
  if (craftableCache.data === gameData) return craftableCache.set;
  const set = new Set<string>();
  if (gameData) {
    for (const r of Object.values(gameData.recipes)) {
      const n = gdItemName(r.out);
      if (n) set.add(n);
    }
  }
  craftableCache = { data: gameData, set };
  return set;
}

function isCraftable(item: string): boolean {
  const set = craftableItems();
  return set.size ? set.has(item) : !!RECIPES[item];
}

// ---- Datos oficiales del juego ----
// Se leen de la instalacion del usuario (su copia), nunca se distribuyen con
// la app. Solo se releen cuando el juego se actualiza, porque son 10 MB por
// idioma; el resto del tiempo vale el destilado cacheado.

function renderGameData(status: string, detail: string, busy = false) {
  if (!gameDataEl) return;
  gameDataEl.innerHTML =
    `<p class="gd-status">${escapeXml(status)}</p>` +
    (detail ? `<p class="muted gd-detail">${escapeXml(detail)}</p>` : "") +
    `<button id="gd-reload" type="button"${busy ? " disabled" : ""}>${t("gd.reload")}</button>`;
  document.querySelector("#gd-reload")?.addEventListener("click", () => initGameData(true));
}


// ---- Iconos de las piezas ----
//
// El arte es de Coffee Stain Studios. NO viaja con la app ni con el
// repositorio: el usuario extrae los iconos de su propia copia del juego, los
// deja en una carpeta, y aquí solo los mostramos desde su disco. Es el mismo
// trato que damos a Docs.json. Si Coffee Stain pidiera que no se usaran, esto
// se quita y la app sigue funcionando: los iconos adornan, no sostienen.

const ICON_FOLDER_KEY = "iconFolder";

// nombre del asset en minúsculas -> ruta en el disco del usuario
let iconMap: Record<string, string> = {};
let iconFolder = "";
let nameIdxCache: { data: GameData | null; map: Map<string, string> } = {
  data: null,
  map: new Map(),
};

// Índice inverso nombre visible -> clase. La app trabaja con nombres
// traducidos y los iconos están indexados por clase, así que hace falta el
// puente. Se guardan todos los idiomas: así funciona aunque se cambie de
// idioma sin recargar.
function nameIndex(): Map<string, string> {
  if (nameIdxCache.data === gameData) return nameIdxCache.map;
  const map = new Map<string, string>();
  if (gameData) {
    for (const [cls, it] of Object.entries(gameData.items)) {
      for (const n of Object.values(it.name)) if (n) map.set(n.toLowerCase(), cls);
    }
    for (const [cls, b] of Object.entries(gameData.buildings)) {
      for (const n of Object.values(b.name)) if (n) map.set(n.toLowerCase(), cls);
    }
  }
  nameIdxCache = { data: gameData, map };
  return map;
}

function iconSrcFor(display: string): string | null {
  if (!display) return null;
  const cls = nameIndex().get(display.toLowerCase());
  if (!cls) return null;
  const asset = iconAssetFor(gameData, cls);
  if (!asset) return null;
  const path = iconMap[asset.toLowerCase()];
  return path ? convertFileSrc(path) : null;
}

// Devuelve la etiqueta <img> o cadena vacía. Vacía es una respuesta válida:
// sin iconos la app se ve igual de bien, solo menos vistosa.
function iconImg(display: string, size = 18): string {
  const src = iconSrcFor(display);
  if (!src) return "";
  return `<img class="ico" src="${escapeAttr(src)}" alt="" width="${size}" height="${size}" loading="lazy">`;
}

function matchedIconCount(): number {
  if (!gameData || !gameData.icons) return 0;
  let n = 0;
  for (const asset of Object.values(gameData.icons)) {
    if (iconMap[asset.toLowerCase()]) n++;
  }
  return n;
}

async function initIcons(rescan = false) {
  if (!iconsEl) return;
  try {
    if (!iconFolder) {
      iconFolder =
        (() => {
          try {
            return localStorage.getItem(ICON_FOLDER_KEY) || "";
          } catch {
            return "";
          }
        })() || (await invoke<string>("default_icon_folder"));
    }
    const res = await invoke<{ count: number; map: Record<string, string> }>("index_icons", {
      folder: iconFolder,
    });
    iconMap = res.map;
    try {
      localStorage.setItem(ICON_FOLDER_KEY, iconFolder);
    } catch {
      /* sin almacenamiento local seguimos, solo se vuelve a detectar al abrir */
    }
  } catch (e) {
    console.warn("Iconos:", e);
    iconMap = {};
  }
  renderIcons();
  if (rescan && openSaveName) await inspect(openSaveName);
}

function renderIcons() {
  if (!iconsEl) return;
  const found = Object.keys(iconMap).length;
  const matched = matchedIconCount();
  const status = !gameData
    ? t("ico.needdocs")
    : found
      ? t("ico.some", { n: found, m: matched })
      : t("ico.none");

  iconsEl.innerHTML =
    `<p class="gd-status">${escapeXml(status)}</p>` +
    `<p class="muted gd-detail">${escapeXml(t("ico.how"))}</p>` +
    `<button id="ico-open" type="button">${t("ico.open")}</button> ` +
    `<button id="ico-scan" type="button">${t("ico.scan")}</button>` +
    `<p class="muted ico-credit">${escapeXml(t("ico.credit"))}</p>`;

  document.querySelector("#ico-open")?.addEventListener("click", async () => {
    try {
      await invoke("open_icons_folder", { folder: iconFolder });
    } catch (e) {
      console.warn("Iconos:", e);
    }
  });
  document.querySelector("#ico-scan")?.addEventListener("click", () => initIcons(true));
}

async function initGameData(force = false) {
  if (!gameDataEl) return;
  try {
    const cached = await invoke<GameData | null>("get_game_data");
    const folders = await invoke<DocsFolder[]>("detect_docs_folders");

    if (!folders.length) {
      gameData = cached && cached.schema === GAMEDATA_SCHEMA ? cached : null;
      renderGameData(
        gameData ? t("gd.cached") : t("gd.notFound"),
        gameData
          ? t("gd.cachedDetail", { r: Object.keys(gameData.recipes).length, date: new Date(gameData.extractedAt).toLocaleDateString() })
          : t("gd.noGameNote")
      );
      return;
    }

    const docs = folders[0];
    const upToDate =
      cached &&
      cached.schema === GAMEDATA_SCHEMA &&
      cached.docsNewestMs === docs.newest_ms &&
      cached.docsPath === docs.path;

    if (upToDate && !force) {
      gameData = cached;
      renderGameData(
        t("gd.upToDate"),
        t("gd.detail", { r: Object.keys(cached!.recipes).length, s: Object.keys(cached!.schematics).length, langs: cached!.langs.join(", ") })
      );
      return;
    }

    renderGameData(t("gd.reading"), `${docs.path}`, true);
    const fresh = await extractGameData(docs.path, docs.languages);
    fresh.docsNewestMs = docs.newest_ms;

    const diff = diffGameData(cached && cached.schema === GAMEDATA_SCHEMA ? cached : null, fresh);
    await invoke("set_game_data", { data: fresh });
    gameData = fresh;

    const changed =
      diff && (diff.addedRecipes.length || diff.changedRates.length || diff.removedRecipes.length);
    renderGameData(
      changed ? t("gd.changed") : t("gd.updated"),
      describeDiff(diff, fresh, "es")
    );
    // Si algo cambió, que no pase desapercibido aunque la sección esté plegada.
    if (changed) {
      const acc = document.querySelector<HTMLDetailsElement>("#acc-settings");
      if (acc) acc.open = true;
    }
  } catch (e) {
    console.error("Datos del juego:", e);
    renderGameData(t("gd.failed"), String(e));
  }
}

interface DetectedFolder {
  path: string;
  save_count: number;
  newest_ms: number;
}

// Elige la carpeta de partidas: la que se usó la última vez, y si no hay, la
// que encuentre el backend mirando donde el juego guarda de serie. Antes esto
// era una ruta escrita a fuego con un usuario de Windows y un id de Steam
// dentro, así que la app solo servía en un ordenador del mundo.
async function pickFolder(): Promise<string> {
  try {
    const saved = localStorage.getItem(FOLDER_KEY);
    if (saved) return saved;
  } catch {
    /* sin almacenamiento local, tiramos de detección */
  }
  try {
    const found = await invoke<DetectedFolder[]>("detect_save_folders");
    if (found.length) {
      if (found.length > 1) {
        console.info(
          `Encontradas ${found.length} carpetas de partidas; uso la de la partida más reciente.`
        );
      }
      return found[0].path;
    }
  } catch (e) {
    console.warn("No se pudieron detectar carpetas de partidas:", e);
  }
  return "";
}

function rememberFolder(folder: string) {
  try {
    localStorage.setItem(FOLDER_KEY, folder);
  } catch {
    /* da igual: al arrancar se vuelve a detectar */
  }
}

// ---- Compatibilidad de la partida ----
// La cabecera del .sav lleva la version del juego, si la partida usa mods y
// cuales, y si es creativa. Antes lo leiamos a mano en Rust buscando el texto
// "++FactoryGame" dentro del cuerpo descomprimido, que no esta en los saves
// antiguos (de ahi el "version desconocida"). Ahora lo lee la libreria, que
// conoce el formato de verdad, y solo necesita los primeros 64 KB: medio
// milisegundo por partida.
interface ModInfo {
  name: string;
  version: string;
}
interface SaveMeta {
  saveVersion: number;
  buildVersion: number;
  isModded: boolean;
  mods: ModInfo[];
  creative: boolean;
}

const metaCache: Record<string, SaveMeta> = {};
let savesMeta: Record<string, SaveMeta> = {}; // por nombre de archivo
let newestSaveVersion = 0; // la mas moderna que tiene el usuario

async function readSaveMeta(folder: string, s: SaveEntry): Promise<SaveMeta | null> {
  const key = `${s.name}|${s.modified_ms}`; // si el archivo cambia, se relee
  if (metaCache[key]) return metaCache[key];
  try {
    const bytes = await invoke<ArrayBuffer>("read_save_head", { folder, name: s.name });
    const h = SatisfactorySaveHeader.Parse(new SaveReader(bytes)) as any;
    const raw = (h.modMetadata && h.modMetadata.Mods) || [];
    const mods: ModInfo[] = raw.map((m: any) => ({
      name: m.Name || m.Reference || "?",
      version: m.Version || "",
    }));
    const meta: SaveMeta = {
      saveVersion: h.saveVersion || 0,
      buildVersion: h.buildVersion || 0,
      isModded: !!h.isModdedSave || mods.length > 0,
      mods,
      creative: !!h.creativeModeEnabled,
    };
    metaCache[key] = meta;
    return meta;
  } catch (e) {
    console.warn("No se pudo leer la cabecera de", s.name, e);
    return null;
  }
}

// Etiquetas de estado de una partida. Vacio = nada que advertir.
function compatBadges(meta: SaveMeta | undefined): string {
  if (!meta) return "";
  const out: string[] = [];
  if (meta.isModded) {
    const list = meta.mods.map((m) => `${m.name} ${m.version}`).join(", ");
    out.push(
      `<span class="tagw" title="Esta partida necesita estos mods para abrirse en el juego:\n${escapeAttr(list)}">⚙ ${meta.mods.length} mods</span>`
    );
  }
  if (newestSaveVersion && meta.saveVersion < newestSaveVersion) {
    out.push(
      `<span class="tagw" title="Guardada con un formato anterior (v${meta.saveVersion}) al de tus partidas mas nuevas (v${newestSaveVersion}).">formato v${meta.saveVersion}</span>`
    );
  }
  if (meta.creative) out.push(`<span class="tagw">creativa</span>`);
  return out.join(" ");
}

// Avisos sobre el mundo abierto. Van en dos bloques a propósito, porque son
// dos cosas distintas y mezclarlas confunde: lo que le pasa a TU PARTIDA (usa
// mods, formato viejo, creativa) y lo que me pasa a MÍ (recetas del juego base
// que aún no tengo en mis tablas). Lo segundo es un fallo mío, no un problema
// de tu partida, y el mensaje debe decirlo así.
function renderCompat(
  meta: SaveMeta | undefined,
  machineCount: number,
  unknown: number,
  bySource: Record<string, number>
) {
  if (!compatEl) return;
  const saveLines: string[] = [];
  const appLines: string[] = [];

  if (meta && meta.isModded) {
    const list = meta.mods.map((m) => `${m.name} ${m.version}`).join(" · ");
    saveLines.push(
      t("compat.mods", { n: meta.mods.length, list: escapeXml(list) })
    );
  }
  if (meta && newestSaveVersion && meta.saveVersion < newestSaveVersion) {
    saveLines.push(
      t("compat.oldFormat", { v: meta.saveVersion, newest: newestSaveVersion })
    );
  }
  if (meta && meta.creative) {
    saveLines.push(t("compat.creative"));
  }

  if (unknown > 0 && machineCount > 0) {
    const base = bySource["juego base"] || 0;
    const mods = Object.entries(bySource).filter(([k]) => k !== "juego base");
    const modTotal = mods.reduce((n, [, v]) => n + v, 0);

    if (modTotal > 0) {
      const src = mods
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${v} de ${escapeXml(k)}`)
        .join(", ");
      saveLines.push(
        t("compat.modRecipes", { n: modTotal, total: machineCount, src })
      );
    }
    if (base > 0) {
      const pct = Math.round((base / machineCount) * 100);
      appLines.push(
        t("compat.baseRecipes", { n: base, total: machineCount, pct })
      );
    }
  }

  const card = (cls: string, title: string, lines: string[]) =>
    `<div class="compat-card ${cls}"><h3 class="compat-title">${title}</h3>` +
    lines.map((l) => `<p>${l}</p>`).join("") +
    `</div>`;

  let html = "";
  if (saveLines.length) html += card("", t("compat.save"), saveLines);
  if (appLines.length) html += card("info", t("compat.app"), appLines);
  compatEl.innerHTML = html;
}

function worldKey(s: SaveEntry): string {
  return s.header?.session_name || s.name;
}

// Agrupa los guardados por mundo; dentro de cada mundo, más reciente primero.
function buildWorlds(saves: SaveEntry[]): Record<string, SaveEntry[]> {
  const map: Record<string, SaveEntry[]> = {};
  for (const s of saves) {
    (map[worldKey(s)] ||= []).push(s);
  }
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => b.modified_ms - a.modified_ms);
  }
  return map;
}

// Llena el desplegable de mundos (ordenados por actividad más reciente).
function populateWorldSelect() {
  const worlds = Object.keys(currentWorlds).sort(
    (a, b) => currentWorlds[b][0].modified_ms - currentWorlds[a][0].modified_ms
  );
  if (!worlds.includes(selectedWorld)) {
    selectedWorld = worlds[0] || "";
  }
  worldSelect.innerHTML = worlds
    .map((w) => {
      const n = currentWorlds[w].length;
      const sel = w === selectedWorld ? " selected" : "";
      return `<option value="${w}"${sel}>${t("worlds.option", { w, n })}</option>`;
    })
    .join("");
}

// El marcador del cuerpo ("++FactoryGame+rel-main-1.2.6") no existe en los
// saves antiguos, que por eso salian como "version desconocida". La cabecera
// si trae siempre el numero de build, asi que ese manda y el texto es el
// respaldo.
function gameVersionOf(saveName: string, raw: string): string {
  const meta = savesMeta[saveName];
  const m = raw.match(/(\d+\.\d+(?:\.\d+)?)/);
  const pretty = m ? m[1] : "";
  if (meta && meta.buildVersion) {
    return pretty ? `${pretty} (build ${meta.buildVersion})` : `build ${meta.buildVersion}`;
  }
  return pretty || raw;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
  return bytes + " B";
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

// Segundos -> "14h 41m" (o "41m 04s" si es menos de una hora).
function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function render(saves: SaveEntry[]) {
  tableBody.innerHTML = "";
  for (let i = 0; i < saves.length; i++) {
    const s = saves[i];
    const h = s.header;
    const tr = document.createElement("tr");
    if (i === 0) tr.classList.add("newest");

    const tag = i === 0 ? ` <span class="badge">${t("saves.newest")}</span>` : "";
    const playTime = h ? formatDuration(h.play_duration_seconds) : "—";
    // Fecha de la partida (de la cabecera); si no se pudo leer, usamos la del archivo.
    const dateMs = h && h.save_date_ms ? h.save_date_ms : s.modified_ms;
    const meta = savesMeta[s.name];
    const build = meta
      ? `<span class="build">build ${meta.buildVersion}</span>`
      : h
        ? `<span class="build">build ${h.build_version}</span>`
        : "";

    tr.innerHTML =
      `<td>${s.name}${tag}<br>${build}</td>` +
      `<td>${playTime}</td>` +
      `<td>${formatDate(dateMs)}</td>` +
      `<td class="num">${formatSize(s.size_bytes)}</td>` +
      `<td>${compatBadges(meta)}</td>`;
    tr.addEventListener("click", () => inspect(s.name));
    tableBody.appendChild(tr);
  }
}

// Al hacer clic en una partida: mostramos sus notas y descomprimimos su cuerpo.
async function inspect(name: string) {
  const folder = folderInput.value.trim();
  const entry = currentSaves.find((s) => s.name === name);
  // Las notas se guardan por mundo (sesión), no por archivo.
  const key = entry?.header?.session_name || name;
  currentNoteKey = key;
  highlightItem = null; // al cambiar de partida, quitamos el resaltado del mapa

  openSaveName = name;
  detailTitle.textContent = name;

  // Notas: se cargan al instante desde la caché, sin esperar a la descompresión.
  noteText.value = notesCache[key] || "";
  noteLabel.textContent = t("notes.worldLabel", { world: key });
  noteStatus.textContent = "";

  compatEl.innerHTML = "";
  detailStatus.textContent = t("detail.reading");
  detailStatus.className = "detail-status";
  detailGrid.innerHTML = "";
  inventoryEl.innerHTML = "";

  try {
    const info = await invoke<BodyInfo>("inspect_body", { folder, name });
    detailStatus.textContent = "";
    const mb = (info.uncompressed_bytes / 1024 / 1024).toFixed(2);
    detailGrid.innerHTML =
      cell(t("detail.builds"), String(info.total_buildings)) +
      cell(t("detail.types"), String(info.type_count)) +
      cell(t("detail.gameVersion"), gameVersionOf(name, info.game_version)) +
      cell(t("detail.uncompressed"), `${mb} MB`);
    renderInventory(info.inventory);

    // Inventario del mundo (nombre ES → cantidad) para el planificador; consumo con nombres originales.
    currentInventory = {};
    currentPowerMW = 0;
    currentGenMW = 0;
    for (const it of info.inventory) {
      currentInventory[invName(it)] = it.count;
      currentPowerMW += (POWER_MW[it.name] || 0) * it.count;
      currentGenMW += (GEN_MW[it.name] || 0) * it.count;
    }
    renderPlan(key);

    // Progreso del mundo + calculadora filtrada por el tier de esta partida.
    currentTier = info.progression.current_tier;
    renderProgress(info.progression);
    renderCalc();

    // Métricas para el histórico; se rellenan si el parser completo funciona.
    let snapMetrics: SnapshotMetrics | null = null;

    // Producción y almacenado con el PARSER COMPLETO; si falla, heurística de respaldo.
    try {
      const a = await analyzeWithParser(folder, name);
      if (a.powerFromDocs) {
        // Energía exacta, edificio a edificio, de la documentación oficial.
        // La estimación por tabla a mano se queda como respaldo.
        currentPowerMW = a.powerMW;
        currentGenMW = a.genMW;
      }
      renderProductionView(
        a.perItem,
        a.machineCount,
        a.overclocked,
        t("prod.fromParser")
      );
      renderBottlenecks(a.perItem, a.consumed);
      renderStored(a.stored);
      renderExploration(a.collect);
      lastPoints = a.points;
      lastBelts = a.belts;
      lastSlabs = a.slabs;
      lastZones = a.zones;
      lastPlayers = a.players;
      lastCollect = a.collectPts;
      mapLevels = a.levels;
      mapFloor = null; // al cambiar de partida, se mira todo otra vez
      mapZone = null;
      renderMap(a.points, a.belts, a.slabs, a.zones);
      renderAlerts(computeAlerts(a.points, a.zones));

      // Centro de mando: signos vitales + "Retoma aquí".
      const deficits = computeDeficits(a.perItem, a.consumed);
      renderVitals(currentPowerMW, currentGenMW, deficits.length, a.points, a.stored, a.dryGen, a.dryCount);
      renderCompat(savesMeta[name], a.machineCount, a.unknownRecipes, a.unknownBySource);
      renderNextMilestone(info.progression, a.storedByClass, a.perItem);
      snapMetrics = buildMetrics(a, info, deficits, currentPowerMW, currentGenMW, name);
      try {
        const snaps = await invoke<Snapshot[]>("get_history", { session: key });
        renderResume(key, snaps, notesCache[key] || "", deficits.length, info.progression);
      } catch (e) {
        console.error("Retoma aquí:", e);
      }
    } catch (e) {
      console.error("Parser completo no disponible:", e);
      renderProductionView(
        perItemFromRecipeCounts(info.production),
        info.production.reduce((s, r) => s + r.count, 0),
        0,
        t("prod.fallback")
      );
      renderBottlenecks({}, {});
      renderStored(null);
      renderExploration({});
      lastPoints = [];
      lastBelts = [];
      lastSlabs = [];
      lastZones = [];
      mapLevels = [];
      renderMap([], [], [], []);
      renderVitals(currentPowerMW, currentGenMW, 0, [], {});
      renderCompat(savesMeta[name], 0, 0, {});
      // Sin parser no sabemos qué hay en los almacenes, y decir "te faltan
      // 4 de 4" cuando en realidad no hemos mirado sería mentir.
      if (milestoneEl) milestoneEl.innerHTML = "";
      renderResume(currentNoteKey, [], notesCache[currentNoteKey] || "", 0, info.progression);
    }

    // Histórico: registramos esta foto (si es nueva) y dibujamos la evolución del mundo.
    try {
      await invoke("record_snapshot", { folder, name, metrics: snapMetrics });
      const hist = await invoke<Snapshot[]>("get_history", { session: key });
      renderHistory(hist);
      renderEnergyHistory(hist);
      renderAchievements(hist);
      // El rastro sale del histórico, así que solo se puede dibujar una vez
      // leído. Si el mapa ya está pintado, se repinta con él.
      lastSnaps = hist;
      const track = hist
        .filter((h) => h.metrics && h.metrics.player_x != null && h.metrics.player_y != null)
        .map((h) => ({ x: h.metrics!.player_x!, y: h.metrics!.player_y!, ts: h.ts_ms }));
      if (track.length !== lastTrack.length) {
        lastTrack = track;
        if (lastPoints.length) renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
      } else {
        lastTrack = track;
      }
    } catch (e) {
      console.error("Histórico:", e);
    }
  } catch (e) {
    detailStatus.textContent = String(e);
    detailStatus.className = "detail-status err";
  }
}

// ---- Siguiente hito: qué cuesta y qué te falta ----
// Esta es la pregunta por la que existe la app. El juego publica el coste
// exacto de cada hito y la partida dice lo que hay en los almacenes y el
// depósito, así que lo único que hacía falta era restar.
//
// Un aviso honesto sobre la precisión: los hitos completados se deducen de las
// rutas de esquema que aparecen en el guardado, y ahí puede aparecer alguna
// que solo esté referenciada. Por eso la pantalla dice "detectados".
function renderNextMilestone(
  prog: ProgressInfo,
  storedByClass: Record<string, number>,
  perItem: Record<string, number>
) {
  if (!milestoneEl) return;
  if (!gameData) {
    milestoneEl.innerHTML = "";
    return;
  }

  // Hitos del HUB, ordenados por tier y número ("3-2" va después de "3-1").
  const order = (token: string) => {
    const [a, b] = token.split("-").map((x) => parseInt(x, 10) || 0);
    return a * 100 + b;
  };
  const done = new Set(prog.milestones);
  const pending = Object.entries(gameData.schematics)
    .filter(([, sc]) => sc.type === "EST_Milestone" && sc.cost.length)
    .map(([cls, sc]) => ({ cls, sc, token: cls.replace(/^Schematic_/, "").replace(/_C$/, "") }))
    .filter((m) => /^\d+-\d+$/.test(m.token) && !done.has(m.token))
    .filter((m) => m.sc.tier <= prog.current_tier + 1)
    .sort((a, b) => order(a.token) - order(b.token));

  if (!pending.length) {
    milestoneEl.innerHTML =
      `<h3 class="inv-title">${t("sec.milestone")}</h3>` +
      `<p class="muted">${t("ms.none")}</p>`;
    return;
  }

  const cards = pending
    .slice(0, 3)
    .map((m) => {
      let missingTotal = 0;
      const rows = m.sc.cost
        .map((c) => {
          const name = gdItemName(c.item) || c.item;
          const have = Math.min(storedByClass[c.item] || 0, c.amount);
          const missing = Math.max(0, c.amount - have);
          if (missing > 0) missingTotal++;
          const pct = Math.round((have / c.amount) * 100);
          // Si eso se está fabricando, cuánto queda a ritmo actual.
          const rate = perItem[name] || 0;
          const eta =
            missing > 0 && rate > 0
              ? ` <span class="ms-eta">· ${fmt(missing / rate)} min</span>`
              : "";
          return (
            `<div class="ms-row${missing ? "" : " ms-done"}">` +
            `<span class="ms-name">${escapeXml(name)}</span>` +
            `<span class="inv-bar"><span class="goal-fill" style="width:${pct}%"></span></span>` +
            `<span class="ms-count">${have.toLocaleString()} / ${c.amount.toLocaleString()}${eta}</span>` +
            `</div>`
          );
        })
        .join("");
      const title = m.sc.name[getLang()] || m.sc.name.en || m.token;
      const state = missingTotal
        ? `<span class="ms-missing">${t("ms.missing", { n: missingTotal, total: m.sc.cost.length })}</span>`
        : `<span class="ms-ready">${t("ms.ready")}</span>`;
      return (
        `<div class="ms-card"><h4 class="ms-title">Tier ${m.sc.tier} · ${escapeXml(title)} ${state}</h4>` +
        rows +
        `</div>`
      );
    })
    .join("");

  milestoneEl.innerHTML =
    `<h3 class="inv-title">${t("ms.title", { n: pending.length })}</h3>` +
    cards +
    `<p class="muted">${t("ms.note")}</p>`;
}

// Dibuja una gráfica SVG simple de construcciones totales a lo largo del tiempo.
// Serie elegible del histórico. Un eje, una pregunta: mezclar MW con número
// de edificios en la misma gráfica es mentir con dos escalas.
type HistSeriesKey = "buildings" | "power" | "gen" | "prod" | "hours";

const HIST_SERIES: {
  key: HistSeriesKey;
  label: string;
  unit: string;
  get: (s: Snapshot) => number | null;
}[] = [
  { key: "buildings", label: "hist.pick_buildings", unit: "", get: (s) => s.total_buildings },
  {
    key: "power",
    label: "hist.pick_power",
    unit: "MW",
    get: (s) => s.metrics?.power_consumption_mw ?? null,
  },
  {
    key: "gen",
    label: "hist.pick_gen",
    unit: "MW",
    get: (s) => s.metrics?.power_generation_mw ?? null,
  },
  {
    key: "prod",
    label: "hist.pick_prod",
    unit: "/min",
    get: (s) =>
      s.metrics?.production
        ? Math.round(s.metrics.production.reduce((t, r) => t + r.rate, 0) * 10) / 10
        : null,
  },
  { key: "hours", label: "hist.pick_hours", unit: "h", get: (s) => Math.round(s.play_seconds / 360) / 10 },
];

let histPick: HistSeriesKey = "buildings";
let histSnaps: Snapshot[] = [];

function renderHistory(snaps: Snapshot[]) {
  histSnaps = snaps;
  if (snaps.length < 2) {
    historyEl.innerHTML =
      `<h3 class="inv-title">${t("sec.history")}</h3>` +
      `<p class="muted">${t("history.need2")}</p>`;
    return;
  }

  // Solo ofrecemos las series que de verdad tienen dos lecturas. Un botón que
  // lleva a una gráfica vacía es peor que no tener el botón.
  const avail = HIST_SERIES.filter(
    (d) => snaps.filter((s) => d.get(s) !== null).length >= 2
  );
  if (!avail.some((d) => d.key === histPick)) histPick = avail[0].key;
  const def = avail.find((d) => d.key === histPick)!;

  const pts = snaps
    .map((s) => ({ x: s.ts_ms, y: def.get(s) }))
    .filter((p): p is { x: number; y: number } => p.y !== null);

  const series: Series[] = [{ name: t(def.label), color: VIZ.series1, points: pts }];
  const growth = pts[pts.length - 1].y - pts[0].y;
  const sign = growth >= 0 ? "+" : "";
  const unit = def.unit ? ` ${def.unit}` : "";

  const picker =
    avail.length > 1
      ? `<div class="viz-pick">` +
        avail
          .map(
            (d) =>
              `<button type="button" data-k="${d.key}"${d.key === histPick ? ' class="active"' : ""}>${t(d.label)}</button>`
          )
          .join("") +
        `</div>`
      : "";

  historyEl.innerHTML =
    `<h3 class="inv-title">${t("hist.title", {
      n: snaps.length,
      sign,
      growth: Math.round(growth * 10) / 10,
    })}</h3>` +
    picker +
    `<div class="viz-wrap">` +
    lineChart({
      series,
      unit: def.unit,
      lang: getLang(),
      tip: (i) =>
        `${new Date(pts[i].x).toLocaleDateString(getLang())} · <b>${pts[i].y}${unit}</b>`,
    }) +
    `</div>`;

  attachChartHover(historyEl);
  historyEl.querySelectorAll<HTMLButtonElement>(".viz-pick button").forEach((b) => {
    b.addEventListener("click", () => {
      histPick = b.dataset.k as HistSeriesKey;
      renderHistory(histSnaps);
    });
  });
}

// Energía en el tiempo: generación y consumo juntos, con el hueco entre las
// dos coloreado según quién manda. Azul arriba es margen, rojo es que la red
// va cuesta arriba.
function renderEnergyHistory(snaps: Snapshot[]) {
  const withPower = snaps.filter(
    (s) => s.metrics && s.metrics.power_generation_mw != null && s.metrics.power_consumption_mw != null
  );
  if (withPower.length < 2) {
    energyEl.innerHTML =
      `<h3 class="inv-title">${t("sec.energy")}</h3>` +
      `<p class="muted">${t("energy.need2")}</p>`;
    return;
  }

  const use = withPower.map((s) => ({ x: s.ts_ms, y: s.metrics!.power_consumption_mw! }));
  const gen = withPower.map((s) => ({ x: s.ts_ms, y: s.metrics!.power_generation_mw! }));
  const series: Series[] = [
    { name: t("energy.use"), color: VIZ.series1, points: use },
    { name: t("energy.gen"), color: VIZ.series2, points: gen },
  ];

  const last = withPower.length - 1;
  const margin = Math.round((gen[last].y - use[last].y) * 10) / 10;
  const note =
    margin >= 0
      ? t("energy.margin_ok", { n: margin })
      : t("energy.margin_bad", { n: Math.abs(margin) });

  energyEl.innerHTML =
    `<h3 class="inv-title">${t("sec.energy")}</h3>` +
    `<p class="muted">${note}</p>` +
    legend(series) +
    `<div class="viz-wrap">` +
    lineChart({
      series,
      unit: "MW",
      lang: getLang(),
      zeroBased: true,
      band: { over: VIZ.pos, under: VIZ.neg },
      tip: (i) =>
        `${new Date(use[i].x).toLocaleDateString(getLang())}<br>` +
        `${t("energy.use")}: <b>${Math.round(use[i].y)} MW</b><br>` +
        `${t("energy.gen")}: <b>${Math.round(gen[i].y)} MW</b>`,
    }) +
    `</div>`;

  attachChartHover(energyEl);
}

// Dibuja la tabla de inventario (tipo de construcción → cantidad).
function renderInventory(items: InvItem[]) {
  if (!items.length) {
    inventoryEl.innerHTML = "";
    return;
  }
  const max = items[0].count;
  const rows = items
    .map((it) => {
      const pct = Math.max(4, Math.round((it.count / max) * 100));
      return (
        `<div class="inv-row">` +
        `<span class="inv-name">${iconImg(invName(it))}${invName(it)}</span>` +
        `<span class="inv-bar"><span class="inv-fill" style="width:${pct}%"></span></span>` +
        `<span class="inv-count">${it.count}</span>` +
        `</div>`
      );
    })
    .join("");
  inventoryEl.innerHTML = `<h3 class="inv-title">${t("sec.inventory")}</h3>${rows}`;
}

function cell(label: string, value: string): string {
  return `<div class="cell"><span class="cell-label">${label}</span><span class="cell-value">${value}</span></div>`;
}
function cellColor(label: string, value: string, color: string): string {
  return `<div class="cell"><span class="cell-label">${label}</span><span class="cell-value" style="color:${color}">${value}</span></div>`;
}

// Signos vitales: salud de la fábrica, energía y estadísticas.
function renderVitals(
  consumption: number,
  generation: number,
  deficitCount: number,
  points: { x: number; y: number }[],
  stored: Record<string, number>,
  // MW instalados que no se están generando por falta de combustible, y
  // cuántos generadores son. Sin esto el panel diría que todo va bien en una
  // partida que está parada precisamente por eso.
  dryGen = 0,
  dryCount = 0
) {
  const margin = generation - consumption;

  // Salud 0-100 (heurística): penaliza déficits y falta de margen de energía.
  let score = 100;
  score -= Math.min(60, deficitCount * 8);
  if (generation > 0) {
    if (margin < 0) score -= 30;
    else if (margin < consumption * 0.1) score -= 10;
  } else if (consumption > 0) {
    score -= 15; // no detectamos generadores
  }
  // Una central seca no es un detalle: es la planta parada.
  if (dryCount > 0) score -= 25;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const sColor = score >= 75 ? "#5fd38d" : score >= 40 ? "#f4c531" : "#ff6b6b";

  // Tamaño de la fábrica (caja que la contiene), en metros.
  let size = "—";
  if (points.length) {
    let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
    for (const p of points) {
      if (p.x < mnx) mnx = p.x;
      if (p.x > mxx) mxx = p.x;
      if (p.y < mny) mny = p.y;
      if (p.y > mxy) mxy = p.y;
    }
    size = `${Math.round((mxx - mnx) / 100)} × ${Math.round((mxy - mny) / 100)} m`;
  }
  const storedTotal = Object.values(stored).reduce((a, b) => a + b, 0);
  const mColor = margin < 0 ? "#ff6b6b" : margin < consumption * 0.1 ? "#f4c531" : "#5fd38d";

  vitalsEl.innerHTML =
    `<h3 class="inv-title">${t("sec.vitals")}</h3>` +
    `<div class="detail-grid">` +
    cellColor(t("vitals.health"), `${score}/100`, sColor) +
    cell(t("vitals.draw"), `≈ ${fmt(consumption)} MW`) +
    cellColor(
      t("vitals.gen"),
      generation > 0 ? `≈ ${fmt(generation)} MW` : dryCount > 0 ? "0 MW" : "—",
      dryCount > 0 ? "#e8807c" : "#e9eaec"
    ) +
    cellColor(t("vitals.margin"), generation > 0 ? `${margin >= 0 ? "+" : ""}${fmt(margin)} MW` : "—", generation > 0 ? mColor : "#8b93a3") +
    cell(t("vitals.size"), size) +
    cell(t("vitals.stored"), storedTotal.toLocaleString()) +
    `</div>` +
    (dryCount > 0
      ? `<p class="muted vit-dry">${t("vitals.dry", { n: dryCount, mw: fmt(dryGen) })}</p>`
      : "") +
    `<p class="muted">${
      gameData
        ? t("vitals.note.docs")
        : t("vitals.note.guess")
    } ${t("vitals.note.health")}</p>`;
}

// "Retoma aquí": qué cambió desde la última vez, tu nota y qué hacer ahora.
function renderResume(
  world: string,
  snaps: Snapshot[],
  note: string,
  deficitCount: number,
  prog: ProgressInfo
) {
  const lines: string[] = [];

  if (snaps && snaps.length >= 2) {
    const last = snaps[snaps.length - 1];
    const prev = snaps[snaps.length - 2];
    const dTotal = last.total_buildings - prev.total_buildings;
    const days = Math.round((last.ts_ms - prev.ts_ms) / 86400000);
    const pm: Record<string, number> = {};
    for (const t of prev.types) pm[t.name] = t.count;
    const changes: [string, number][] = [];
    for (const t of last.types) {
      const d = t.count - (pm[t.name] || 0);
      if (d > 0) changes.push([trBuilding(t.name), d]);
    }
    changes.sort((a, b) => b[1] - a[1]);
    const top = changes.slice(0, 3).map(([n, d]) => `+${d} ${n}`).join(", ");
    lines.push(
      `${t("resume.since")}${days > 0 ? t("resume.days", { n: days }) : ""}: ` +
        `<b>${dTotal >= 0 ? "+" : ""}${dTotal}</b> ${t("resume.builds")}${top ? ` · ${top}` : ""}.`
    );
  } else {
    lines.push(t("resume.noHistory"));
  }

  if (note && note.trim()) {
    const n = note.trim();
    lines.push(`📝 ${t("resume.note")}: "${n.slice(0, 160)}${n.length > 160 ? "…" : ""}"`);
  }
  lines.push(
    deficitCount > 0
      ? t("resume.bottlenecks", { n: deficitCount })
      : t("resume.balanced")
  );
  lines.push(
    `<b>${t("resume.tier", { t: prog.current_tier })}</b>` +
      (prog.current_tier > 0 ? t("resume.next", { t: prog.current_tier + 1 }) : "") +
      ` · ${prog.milestones.length} ${t("sec.milestone").toLowerCase()} · ${prog.research_count}.`
  );

  resumeEl.innerHTML =
    `<div class="resume-card"><h3 class="resume-title">${t("resume.title", { world })}</h3>` +
    lines.map((p) => `<p class="resume-line">${p}</p>`).join("") +
    `</div>`;
}

// Panel de progreso: tier actual, hitos por tier e investigaciones.
function renderProgress(p: ProgressInfo) {
  // Agrupamos los hitos por tier: { "1": ["1-1","1-2"], ... }
  const byTier: Record<string, string[]> = {};
  for (const m of p.milestones) {
    const t = m.split("-")[0];
    (byTier[t] ||= []).push(m);
  }
  const tiers = Object.keys(byTier).sort((a, b) => Number(a) - Number(b));
  const tierRows = tiers
    .map((t) => {
      const hitos = byTier[t].map((m) => `<span class="mstone">${m}</span>`).join("");
      return `<div class="tier-row"><span class="tier-label">Tier ${t}</span><span class="mstones">${hitos}</span></div>`;
    })
    .join("");

  progressEl.innerHTML =
    `<h3 class="inv-title">${t("sec.progress")}</h3>` +
    `<div class="detail-grid">` +
    cell("Tier actual", p.current_tier > 0 ? `Tier ${p.current_tier}` : "—") +
    cell("Hitos completados", String(p.milestones.length)) +
    cell("Investigaciones (MAM)", String(p.research_count)) +
    `</div>` +
    (tierRows ? `<div class="tier-list">${tierRows}</div>` : "");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Planificador: objetivos del mundo vs. lo construido (currentInventory).
function renderPlan(world: string) {
  plansCache[world] = plansCache[world] || {};
  const goals = plansCache[world];
  const names = Object.keys(goals).sort();

  const goalRows = names
    .map((name) => {
      const built = currentInventory[name] || 0;
      const target = goals[name];
      const pct = target > 0 ? Math.min(100, Math.round((built / target) * 100)) : 100;
      const done = built >= target;
      const missing = Math.max(0, target - built);
      const status = done ? t("plan.done") : t("plan.left", { n: missing });
      const safe = escapeAttr(name);
      return (
        `<div class="goal-row">` +
        `<span class="goal-name">${name}</span>` +
        `<span class="goal-bar"><span class="goal-fill ${done ? "done" : ""}" style="width:${pct}%"></span></span>` +
        `<span class="goal-count">${built}/${target}</span>` +
        `<span class="goal-status ${done ? "ok" : ""}">${status}</span>` +
        `<button class="goal-del" data-name="${safe}" title="${t("plan.removeGoal")}">✕</button>` +
        `</div>`
      );
    })
    .join("");

  const datalist = Object.keys(currentInventory)
    .map((n) => `<option value="${escapeAttr(n)}"></option>`)
    .join("");

  planEl.innerHTML =
    `<h3 class="inv-title">${t("plan.title")}</h3>` +
    (goalRows || `<p class="muted">${t("plan.empty")}</p>`) +
    `<div class="goal-add">` +
    `<input id="goal-name" list="goal-names" placeholder="Tipo (ej: Constructor Mk1)" />` +
    `<datalist id="goal-names">${datalist}</datalist>` +
    `<input id="goal-target" type="number" min="1" placeholder="Cantidad" />` +
    `<button id="goal-add-btn" type="button">${t("plan.add")}</button>` +
    `</div>`;

  // Quitar objetivo
  planEl.querySelectorAll<HTMLButtonElement>(".goal-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      delete goals[btn.dataset.name as string];
      persistPlan(world);
    });
  });

  // Añadir objetivo
  document.querySelector("#goal-add-btn")?.addEventListener("click", () => {
    const nameInput = document.querySelector("#goal-name") as HTMLInputElement;
    const targetInput = document.querySelector("#goal-target") as HTMLInputElement;
    const nm = nameInput.value.trim();
    const tg = parseInt(targetInput.value, 10);
    if (nm && tg > 0) {
      goals[nm] = tg;
      persistPlan(world);
    }
  });
}

async function persistPlan(world: string) {
  try {
    await invoke("set_plan", { world, goals: plansCache[world] || {} });
  } catch (e) {
    console.error("Guardar plan:", e);
  }
  renderPlan(world);
}

// ---- Producción real (leída de las máquinas activas) ----
// Mapa receta del juego → pieza producida y ritmo/min por máquina (al 100%).
// Qué fabrica cada receta y a qué ritmo. "inputs" solo hace falta cuando una
// pieza se puede fabricar de varias formas (la biomasa sale de hojas, madera o
// micelio): ahí no vale mirar RECIPES, que guarda una receta por pieza, porque
// el consumo dependería de cuál esté puesta en la máquina.
const RECIPE_OUTPUT: Record<
  string,
  { item: string; rate: number; inputs?: { item: string; rate: number }[] }
> = {
  Recipe_IngotIron: { item: "Lingote de hierro", rate: 30 },
  Recipe_IngotCopper: { item: "Lingote de cobre", rate: 30 },
  Recipe_IngotSteel: { item: "Lingote de acero", rate: 45 },
  Recipe_IngotCaterium: { item: "Lingote de caterio", rate: 15 },
  Recipe_IronRod: { item: "Barra de hierro", rate: 15 },
  Recipe_IronPlate: { item: "Plancha de hierro", rate: 20 },
  Recipe_Screw: { item: "Tornillos", rate: 40 },
  Recipe_Wire: { item: "Alambre", rate: 30 },
  Recipe_Cable: { item: "Cable", rate: 30 },
  Recipe_Concrete: { item: "Hormigón", rate: 15 },
  Recipe_CopperSheet: { item: "Lámina de cobre", rate: 10 },
  Recipe_IronPlateReinforced: { item: "Plancha de hierro reforzada", rate: 5 },
  Recipe_Rotor: { item: "Rotor", rate: 4 },
  // Biomasa y derivados: faltaban enteros. Son de las primeras máquinas que
  // pone cualquiera, así que su ausencia se nota desde el minuto uno.
  Recipe_Biomass_Leaves: { item: "Biomasa", rate: 60, inputs: [{ item: "Hojas", rate: 120 }] },
  Recipe_Biomass_Wood: { item: "Biomasa", rate: 300, inputs: [{ item: "Madera", rate: 60 }] },
  Recipe_Biomass_Mycelia: { item: "Biomasa", rate: 150, inputs: [{ item: "Micelio", rate: 15 }] },
  Recipe_Biofuel: {
    item: "Biocombustible sólido",
    rate: 60,
    inputs: [{ item: "Biomasa", rate: 120 }],
  },
  Recipe_SpaceElevatorPart_1: {
    item: "Placas inteligentes",
    rate: 2,
    inputs: [
      { item: "Plancha de hierro reforzada", rate: 2 },
      { item: "Rotor", rate: 2 },
    ],
  },
  Recipe_ModularFrame: { item: "Armazón modular", rate: 2 },
  Recipe_SteelBeam: { item: "Viga de acero", rate: 15 },
  Recipe_SteelPipe: { item: "Tubería de acero", rate: 20 },
  Recipe_QuartzCrystal: { item: "Cristal de cuarzo", rate: 22.5 },
  Recipe_Silica: { item: "Sílice", rate: 37.5 },
  Recipe_Quickwire: { item: "Turboalambre", rate: 60 },
  Recipe_Plastic: { item: "Plástico", rate: 20 },
  Recipe_Rubber: { item: "Caucho", rate: 20 },
  Recipe_LiquidFuel: { item: "Combustible", rate: 40 },
  Recipe_PetroleumCoke: { item: "Coque de petróleo", rate: 120 },
  Recipe_CircuitBoard: { item: "Circuito impreso", rate: 7.5 },
  Recipe_Stator: { item: "Estátor", rate: 5 },
  Recipe_Motor: { item: "Motor", rate: 5 },
  Recipe_Computer: { item: "Ordenador", rate: 2.5 },
  Recipe_AILimiter: { item: "Limitador de IA", rate: 5 },
  Recipe_EncasedIndustrialBeam: { item: "Viga industrial reforzada", rate: 6 },
  Recipe_ModularFrameHeavy: { item: "Armazón modular pesado", rate: 2 },
  Recipe_AluminumSheet: { item: "Lámina de aluminio revestido", rate: 30 },
  Recipe_IngotAluminum: { item: "Lingote de aluminio", rate: 60 },
};

// Generación (MW) de cada generador a 100%, por su nombre de inventario.
const GEN_MW: Record<string, number> = {
  "Generator Biomass": 30,
  "Generator Integrated Biomass": 30,
  "Generator Coal": 75,
  "Generator Fuel": 150,
  "Generator Nuclear": 2500,
};

// Consumo nominal (MW) de cada máquina a 100%, por su nombre de inventario.
const POWER_MW: Record<string, number> = {
  "Constructor Mk1": 4,
  "Smelter Mk1": 4,
  "Assembler Mk1": 15,
  "Foundry Mk1": 16,
  "Miner Mk1": 5,
  "Miner Mk2": 12,
  "Miner Mk3": 30,
  Manufacturer: 55,
  Refinery: 30,
  Packager: 10,
  Blender: 75,
};

// Convierte el conteo heurístico (fallback) en producción por pieza.
function perItemFromRecipeCounts(prod: RecipeCount[]): Record<string, number> {
  const perItem: Record<string, number> = {};
  for (const rc of prod) {
    const o = RECIPE_OUTPUT[rc.recipe];
    if (o) perItem[o.item] = (perItem[o.item] || 0) + rc.count * o.rate;
  }
  return perItem;
}

// Dibuja la producción por pieza (origen: parser completo o heurística de respaldo).
function renderProductionView(
  perItem: Record<string, number>,
  machineCount: number,
  overclocked: number,
  note: string
) {
  const items = Object.entries(perItem).sort((a, b) => b[1] - a[1]);
  const max = items.length ? items[0][1] : 1;
  const itemRows = items
    .map(([item, rate]) => {
      const pct = Math.max(4, Math.round((rate / max) * 100));
      return (
        `<div class="inv-row"><span class="inv-name">${iconImg(item)}${item}</span>` +
        `<span class="inv-bar"><span class="inv-fill" style="width:${pct}%"></span></span>` +
        `<span class="inv-count">${fmt(rate)}/min</span></div>`
      );
    })
    .join("");

  const ocTxt = overclocked > 0 ? cell("Con overclock", String(overclocked)) : "";

  productionEl.innerHTML =
    `<h3 class="inv-title">${t("prod.title")}</h3>` +
    `<div class="detail-grid" style="margin-bottom:12px">` +
    cell(t("prod.machines"), String(machineCount)) +
    cell(t("prod.power"), `≈ ${fmt(currentPowerMW)} MW`) +
    ocTxt +
    `</div>` +
    (itemRows || `<p class="muted">${t("production.none")}</p>`) +
    `<p class="muted">${note}</p>`;
}

// Dibuja los materiales almacenados (sumados de todos los inventarios del mundo).
function renderStored(stored: Record<string, number> | null) {
  if (!stored) {
    storedEl.innerHTML = "";
    return;
  }
  const items = Object.entries(stored)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  if (!items.length) {
    storedEl.innerHTML = "";
    return;
  }
  const max = items[0][1];
  const rows = items
    .map(([item, n]) => {
      const pct = Math.max(4, Math.round((n / max) * 100));
      return (
        `<div class="inv-row"><span class="inv-name">${iconImg(trItem(item))}${trItem(item)}</span>` +
        `<span class="inv-bar"><span class="inv-fill" style="width:${pct}%"></span></span>` +
        `<span class="inv-count">${n}</span></div>`
      );
    })
    .join("");
  storedEl.innerHTML =
    `<h3 class="inv-title">${t("sec.stored")}</h3>${rows}` +
    `<p class="muted">${t("stored.note")}</p>`;
}

// De "Build_ConstructorMk1" saca "Constructor Mk1" (igual que el inventario).
function prettyBuild(leaf: string): string {
  const s = leaf.replace(/^Build_/, "");
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

// De un pathName de item (.../Desc_IronPlate.Desc_IronPlate_C) saca un nombre legible.
function prettyItem(pathName: string): string {
  const leaf = (pathName.split("/").pop() || pathName).split(".")[0];
  const s = leaf.replace(/^Desc_/, "");
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])(\d)/g, "$1 $2");
}

// Parser COMPLETO (etothepii): producción exacta con overclock + materiales almacenados.
// ---- Avisos: qué se ha parado y dónde ----
//
// El save trae dos señales de funcionamiento y solo una sirve.
//
// mIsProducing es el estado en el instante exacto en que se guardó. En las
// partidas de prueba daba 0 de 49 y 1 de 195 máquinas produciendo: como se
// guarda al dejar de jugar, una máquina esperando dos segundos a que llegue
// una placa se lee igual que una muerta de hambre desde hace una semana. Si
// la app avisara con eso, gritaría que la fábrica entera está parada. No se
// usa.
//
// La otra es la medida de productividad del propio juego: cuánto tiempo del
// último tramo estuvo la máquina produciendo de verdad. Esa sí distingue —
// en las mismas partidas repartía de 0% a 100% en vez de aplastarlo todo.
// Es la que se usa.
function productivityOf(props: any): number | null {
  if (!props) return null;
  const d = props.mLastProductivityMeasurementDuration;
  const pd = props.mLastProductivityMeasurementProduceDuration;
  const dv = d && (d.value !== undefined ? d.value : d);
  const pv = pd && (pd.value !== undefined ? pd.value : pd);
  if (typeof dv !== "number" || typeof pv !== "number" || dv <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((pv / dv) * 100)));
}

// ¿Tiene este generador con qué quemar? true / false / null si no lo dice.
//
// Confirmado contra un mundo con la respuesta conocida: en una partida cuyos
// quemadores de biomasa se habían agotado, los diez generadores traían
// mHasFuelCached a false; en las otras dos partidas, todos a true. Ojo con
// mCurrentFuelAmount: sigue trayendo números grandes en los secos, así que la
// cantidad NO es la señal. Y los generadores de manivela del principio no
// traen la propiedad: eso es "no se sabe", no "está seco".
function fuelStateOf(props: any): boolean | null {
  if (!props) return null;
  const f = props.mHasFuelCached;
  if (f === undefined) return null;
  const val = f.value !== undefined ? f.value : f;
  return typeof val === "boolean" ? val : null;
}

export interface Alert {
  level: "dry" | "stopped" | "slow";
  name: string; // tipo de máquina
  count: number;
  worst: number; // la peor productividad del grupo
  zone: number; // -1 si está suelta
  zoneName: string;
  x: number; // dónde llevar el mapa
  y: number;
  floor: number;
}

// Solo se avisa de lo que está realmente parado. Probado contra tres partidas
// reales: con el listón en el 60% salían 29 avisos de 40 máquinas en una de
// ellas, y eso es gritar que tres cuartas partes de la fábrica van mal. En
// Satisfactory ir por debajo del 100% es lo normal y muchas veces es a
// propósito — una fundidora alimentada por un extractor Mk1, una máquina con
// la salida haciendo de almacén. Por debajo del 15% ya no es un ritmo, es que
// no está trabajando.
const STOPPED_PCT = 15;
// Las que van a medio gas se cuentan, pero no ocupan una fila cada una.
const SLOW_PCT = 60;

// Agrupa por zona y tipo: nadie quiere una lista de 183 filas, quiere saber
// qué montaje se le ha caído.
function computeAlerts(
  points: { x: number; y: number; cls: string; name: string; prod: number | null; dry: boolean; zone: number; floor: number }[],
  zones: Zone[]
): Alert[] {
  const groups = new Map<string, { pts: typeof points; worst: number; dry: boolean }>();
  for (const p of points) {
    // Un generador seco se avisa aunque no tenga medida de productividad: es
    // la causa, no el síntoma.
    if (!p.dry && (p.prod === null || p.prod >= SLOW_PCT)) continue;
    const key = `${p.dry ? "dry" : "p"}|${p.zone}|${p.name}`;
    const g = groups.get(key) || { pts: [], worst: 100, dry: p.dry };
    g.pts.push(p);
    if (p.prod !== null) g.worst = Math.min(g.worst, p.prod);
    groups.set(key, g);
  }

  const out: Alert[] = [];
  for (const [key, g] of groups) {
    const zi = parseInt(key.split("|")[1], 10);
    const z = zi >= 0 ? zones[zi] : undefined;
    // El centro del grupo, no el de la zona: lo que se busca es dónde están
    // estas máquinas, no dónde cae el montaje entero.
    const cx = g.pts.reduce((t, p) => t + p.x, 0) / g.pts.length;
    const cy = g.pts.reduce((t, p) => t + p.y, 0) / g.pts.length;
    out.push({
      level: g.dry ? "dry" : g.worst < STOPPED_PCT ? "stopped" : "slow",
      name: g.pts[0].name,
      count: g.pts.length,
      worst: g.worst,
      zone: zi,
      zoneName: z ? z.name : "",
      x: cx,
      y: cy,
      floor: g.pts[0].floor,
    });
  }
  // Los generadores secos primero: suelen ser la causa de todo lo demás.
  // Luego lo parado, y dentro de cada grupo lo más numeroso.
  const rank = { dry: 0, stopped: 1, slow: 2 };
  out.sort(
    (a, b) => rank[a.level] - rank[b.level] || b.count - a.count || a.worst - b.worst
  );
  return out;
}

function renderAlerts(alerts: Alert[]) {
  if (!alertsEl) return;
  if (!alerts.length) {
    alertsEl.innerHTML = "";
    return;
  }
  // Filas solo para lo parado. Lo lento va en una línea al pie, porque es
  // contexto y no una llamada a la acción.
  const dry = alerts.filter((a) => a.level === "dry");
  const stopped = alerts.filter((a) => a.level !== "dry" && a.level !== "slow");
  const slow = alerts.filter((a) => a.level === "slow").length;
  const urgent = [...dry, ...stopped];
  if (!urgent.length) {
    alertsEl.innerHTML = slow
      ? `<p class="muted al-only-slow">${t("alert.only_slow", { n: slow })}</p>`
      : "";
    return;
  }
  const shown = urgent.slice(0, 10);
  const rows = shown
    .map((a, i) => {
      const where = a.zoneName ? escapeXml(a.zoneName) : t("alert.loose");
      const what = a.level === "dry" ? t("alert.dry") : t("alert.at", { n: a.worst });
      const m = metresFromPlayer(a.x, a.y);
      const far = m === null ? "" : ` · ${t("alert.away", { n: m.toLocaleString() })}`;
      return (
        `<button class="al-row al-${a.level}" data-i="${i}" type="button">` +
        `<span class="al-dot"></span>` +
        `<span class="al-main">${iconImg(a.name, 16)}<b>${a.count}× ${escapeXml(a.name)}</b>` +
        `<span class="al-meta">${where} · ${what}${far}</span></span>` +
        `<span class="al-go">${t("alert.see")}</span>` +
        `</button>`
      );
    })
    .join("");

  alertsEl.innerHTML =
    `<h3 class="inv-title">${t("alert.title", { n: urgent.length })}</h3>` +
    // Si hay generadores secos, decirlo: lo demás que aparece parado
    // probablemente sea consecuencia y no un problema aparte.
    `<p class="muted">${dry.length ? t("alert.note_dry") : t("alert.note_bad")}</p>` +
    rows +
    (urgent.length > shown.length
      ? `<p class="muted">${t("alert.more", { n: urgent.length - shown.length })}</p>`
      : "") +
    (slow ? `<p class="muted">${t("alert.plus_slow", { n: slow })}</p>` : "") +
    `<p class="muted al-foot">${t("alert.foot")}</p>`;

  alertsEl.querySelectorAll<HTMLButtonElement>(".al-row").forEach((b) => {
    b.addEventListener("click", () => {
      const a = shown[parseInt(b.dataset.i || "0", 10)];
      if (!a) return;
      // Llevar al mapa y dejarlo mirando justo ahí.
      highlightItem = null;
      mapZone = a.zone >= 0 ? a.zone : null;
      mapFloor = null;
      highlightSpot = { x: a.x, y: a.y, label: `${a.count}× ${a.name}` };
      showTab("planeta");
      renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
      mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function analyzeWithParser(folder: string, name: string) {
  const bytes = await invoke<ArrayBuffer>("read_save_bytes", { folder, name });
  const save: any = Parser.ParseSave(name, bytes);
  const levels = save.levels || {};
  const lvlArr = Array.isArray(levels) ? levels : Object.values(levels);

  const perItem: Record<string, number> = {};
  const consumed: Record<string, number> = {};
  const stored: Record<string, number> = {};
  // El mismo almacén indexado por clase (Desc_IronPlate_C). Hace falta para
  // cruzarlo con el coste de los hitos, que viene en clases, no en nombres.
  const storedByClass: Record<string, number> = {};
  const points: {
    x: number;
    y: number;
    z: number;
    cat: string;
    name: string;
    detail: string;
    item: string;
    cls: string;
    prod: number | null; // productividad 0..100 medida por el juego, null si no la mide
    dry: boolean; // generador sin combustible
    floor: number; // índice de planta, -1 = sobre terreno
    zone: number; // índice de zona, -1 = sin zona
  }[] = [];
  // Energía leída de la documentación oficial, edificio a edificio. Hasta ahora
  // salía de una tabla a mano indexada por nombre traducido.
  let powerMW = 0;
  let genMW = 0;
  let powerFromDocs = false;
  // Una cinta es una polilínea [x,y] más su rango de altura. El rango importa:
  // una cinta que sube de la planta baja a la primera no pertenece a ninguna de
  // las dos, pertenece a las dos, y al aislar un piso tiene que seguir viéndose
  // porque es justo lo que explica cómo se conectan.
  const belts: { pts: [number, number][]; z: number; z0: number; z1: number }[] = [];
  let dryGen = 0; // MW de catálogo que NO se están generando por falta de combustible
  let dryCount = 0;
  // Dónde está el pionero. En partidas en compañía hay varios, así que es
  // una lista y no un punto.
  const players: { name: string; x: number; y: number; z: number }[] = [];
  const collectPts: { kind: string; x: number; y: number; z: number }[] = [];
  const collect: Record<string, number> = {};
  // Lo que no sabemos interpretar. El save se lee entero, pero nuestras tablas
  // de recetas solo conocen el juego base: una maquina de un mod fabrica algo
  // que no esta en RECIPE_OUTPUT. En vez de ignorarlo en silencio, lo contamos
  // y decimos de donde viene.
  const unknownBySource: Record<string, number> = {};
  // Suelos construidos. Desde la 1.0 el juego guarda cimientos, muros y rampas
  // aparte, como "construcciones ligeras", y por eso buscarlos entre los
  // objetos normales no encontraba ninguno.
  const slabs: { x: number; y: number; z: number; r: any }[] = [];
  let unknownRecipes = 0;
  let machineCount = 0;
  let overclocked = 0;

  for (const lvl of lvlArr as any[]) {
    const objs = (lvl && lvl.objects) || [];
    for (const o of objs) {
      // Coleccionables sin recoger (siguen presentes en el mundo).
      const cleaf = ((o.typePath || "").split("/").pop() || "").split(".").pop() || "";
      if (COLLECTABLES[cleaf]) {
        collect[cleaf] = (collect[cleaf] || 0) + 1;
        // Y DÓNDE. Antes se contaban y se tiraba la posición, que es justo lo
        // que un pionero quiere saber en sus primeras veinte horas.
        const ct = o.transform && o.transform.translation;
        if (ct) collectPts.push({ kind: cleaf, x: ct.x, y: ct.y, z: ct.z });
      }

      // Plano 2D: cintas/tuberías como líneas (su trazado), resto como puntos.
      if (o.transform && o.transform.translation && o.typePath && o.typePath.includes("/Buildable/")) {
        const t = o.transform.translation;
        const r = o.transform.rotation || { x: 0, y: 0, z: 0, w: 1 };
        const spline = o.properties && o.properties.mSplineData && o.properties.mSplineData.values;
        if (spline && spline.length) {
          const poly: [number, number][] = [];
          let zsum = 0;
          let zmin = Infinity;
          let zmax = -Infinity;
          for (const sp of spline) {
            const loc = sp.properties && sp.properties.Location && sp.properties.Location.value;
            if (!loc) continue;
            const w = qrot(r, loc);
            poly.push([t.x + w.x, t.y + w.y]);
            const z = t.z + w.z;
            zsum += z;
            if (z < zmin) zmin = z;
            if (z > zmax) zmax = z;
          }
          if (poly.length >= 2) {
            belts.push({ pts: poly, z: zsum / poly.length, z0: zmin, z1: zmax });
          }
        } else {
          const leaf = (o.typePath.split("/").pop() || "").split(".")[0];
          // El ensamblaje del Ascensor Espacial lo coloca el juego en órbita, a
          // 23 km de altura. Es un solo objeto y arrasaba con la escala del
          // plano y con la detección de alturas. No forma parte de la fábrica.
          if (NOT_FACTORY.test(leaf)) continue;
          // ¿Qué fabrica? (solo máquinas con receta) para el tooltip y el resaltado.
          let detail = "";
          let prodItem = "";
          const rec2 = o.properties && o.properties.mCurrentRecipe;
          if (rec2 && rec2.value && rec2.value.pathName) {
            const rl = (rec2.value.pathName.split("/").pop() || "").split(".")[0];
            const out = gdRecipe(rl) || RECIPE_OUTPUT[rl];
            if (out) {
              detail = ` · fabrica ${out.item}`;
              prodItem = out.item;
            }
          }
          const cls = `${leaf}_C`;
          const gb = gameData && gameData.buildings[cls];
          const fuel = fuelStateOf(o.properties);
          if (gb) {
            powerMW += gb.power;
            // Un generador sin combustible no genera nada. Sumar su potencia
            // de catálogo sería contar una central apagada como si estuviera
            // dando energía, que es justo el dato que alguien necesitaría que
            // fuera cierto.
            if (gb.generation > 0 && fuel === false) {
              dryGen += gb.generation;
              dryCount++;
            } else {
              genMW += gb.generation;
            }
            powerFromDocs = true;
          }
          points.push({
            x: t.x,
            y: t.y,
            z: t.z,
            cat: categoryOf(o.typePath),
            name: gdBuildingName(cls) || trBuilding(prettyBuild(leaf)),
            detail,
            item: prodItem,
            cls,
            prod: productivityOf(o.properties),
            dry: fuel === false,
            floor: -1, // se asignan abajo, al conocerse plantas y zonas
            zone: -1,
          });
        }
      }

      // Cimientos y pasarelas: la superficie sobre la que se construye.
      const lw = o.specialProperties;
      if (lw && Array.isArray((lw as any).buildables)) {
        for (const grp of (lw as any).buildables) {
          const path = (grp.typeReference && grp.typeReference.pathName) || "";
          const name = (path.split("/").pop() || "").split(".")[0];
          if (!FLOOR_PIECE.test(name) || NOT_FLOOR.test(name)) continue;
          for (const inst of grp.instances || []) {
            const t = inst.transform && inst.transform.translation;
            if (t) slabs.push({ x: t.x, y: t.y, z: t.z, r: inst.transform.rotation });
          }
        }
      }

      if (/Char_Player\.Char_Player_C/.test(o.typePath || "")) {
        const t = o.transform && o.transform.translation;
        if (t) {
          const nm = o.properties && (o.properties as any).mCachedPlayerName;
          const who = nm && (nm.value !== undefined ? nm.value : nm);
          players.push({ name: typeof who === "string" && who ? who : "", x: t.x, y: t.y, z: t.z });
        }
      }

      const props = o.properties;
      if (!props) continue;

      const rec = props.mCurrentRecipe;
      if (rec && rec.value && rec.value.pathName) {
        const leaf = (rec.value.pathName.split("/").pop() || "").split(".")[0];
        const oc = (props.mCurrentPotential && props.mCurrentPotential.value) || 1;
        if (oc !== 1) overclocked++;
        machineCount++;
        // Documentación oficial primero; si no está, la tabla a mano.
        const official = gdRecipe(leaf);
        const fallback = RECIPE_OUTPUT[leaf];
        const out = official || fallback;
        if (out) {
          perItem[out.item] = (perItem[out.item] || 0) + out.rate * oc;
          // Ingredientes de ESA receta. Con los datos oficiales siempre los
          // hay; con las tablas a mano, los de la receta si los lleva y, si no,
          // la receta única que la calculadora guarda para esa pieza.
          const crec = RECIPES[out.item];
          const inputs = official
            ? official.inputs
            : fallback!.inputs || (crec ? crec.inputs : null);
          if (inputs) {
            for (const inp of inputs) {
              consumed[inp.item] = (consumed[inp.item] || 0) + inp.rate * oc;
            }
          }
        } else {
          unknownRecipes++;
          // La ruta dice el origen: /Game/FactoryGame/... es del juego base,
          // /RefinedPower/... es de ese mod.
          const p = rec.value.pathName as string;
          const src = p.startsWith("/Game/FactoryGame/")
            ? "juego base"
            : p.split("/")[1] || "desconocido";
          unknownBySource[src] = (unknownBySource[src] || 0) + 1;
        }
      }

      const inv = props.mInventoryStacks;
      if (inv && inv.values) {
        for (const st of inv.values) {
          const sp = st.properties || {};
          const path =
            sp.Item && sp.Item.value && sp.Item.value.itemReference
              ? sp.Item.value.itemReference.pathName
              : null;
          const num = sp.NumItems && sp.NumItems.value;
          if (path && num) {
            const it = prettyItem(path);
            stored[it] = (stored[it] || 0) + num;
            const cls = (path.split("/").pop() || "").split(".").pop() || "";
            if (cls) storedByClass[cls] = (storedByClass[cls] || 0) + num;
          }
        }
      }
    }
  }
  // ---- Plantas, deducidas del suelo construido ----
  // Antes esto salía de un histograma de las alturas de las máquinas, y era
  // adivinar: Satisfactory no tiene plantas, tiene cosas a distintas alturas.
  // Los cimientos sí las tienen, porque una planta ES una superficie.
  //
  // La clave está en distinguir una planta de una escalera. Una escalera deja
  // una o dos piezas de suelo por escalón, cada dos metros; una planta deja
  // decenas a la misma altura. Así que una planta es una altura con una
  // CONCENTRACIÓN de suelo, no cualquier altura con suelo.
  const slabBins = new Map<number, number>();
  for (const sl of slabs) {
    const k = Math.round(sl.z / 100) * 100;
    slabBins.set(k, (slabBins.get(k) || 0) + 1);
  }
  const maxSlab = slabBins.size ? Math.max(...slabBins.values()) : 0;
  const slabMin = Math.max(8, maxSlab * 0.15);
  const floorLevels = [...slabBins.entries()]
    .filter(([, c]) => c >= slabMin)
    .map(([z]) => z)
    .sort((a, b) => a - b);

  // Cada máquina va a la planta que pisa: la superficie inmediatamente por
  // debajo, si está a menos de 6 m. Lo que no pise ninguna está sobre terreno,
  // que es un sitio perfectamente legítimo donde construir y no un error.
  const FLOOR_REACH = 600;
  const floorOf = (z: number): number => {
    let best = -1;
    for (let i = 0; i < floorLevels.length; i++) {
      const fz = floorLevels[i];
      if (z >= fz - 100 && z - fz <= FLOOR_REACH && (best < 0 || fz > floorLevels[best])) best = i;
    }
    return best; // -1 = sobre terreno
  };
  for (const p of points) p.floor = floorOf(p.z);

  // Zonas: se agrupan las máquinas de cada planta por cercanía. Los "otros"
  // (postes, escaleras, señales) no forman zona: no fabrican nada.
  const zones: Zone[] = [];
  const machines = points.filter((p) => p.cat !== "other");
  const byFloor = new Map<number, typeof machines>();
  for (const m of machines) {
    const g = byFloor.get(m.floor);
    if (g) g.push(m);
    else byFloor.set(m.floor, [m]);
  }
  const raw: { fl: number; group: typeof machines }[] = [];
  for (const [fl, group] of byFloor) {
    for (const cl of clusterByProximity(group, ZONE_RADIUS)) raw.push({ fl, group: cl });
  }
  raw.sort((a, b) => b.group.length - a.group.length);

  raw.forEach(({ fl, group }, idx) => {
    const makesCount: Record<string, number> = {};
    const kinds: Record<string, number> = {};
    let zPower = 0;
    let sx = 0;
    let sy = 0;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const m of group) {
      m.zone = idx;
      sx += m.x;
      sy += m.y;
      if (m.z < z0) z0 = m.z;
      if (m.z > z1) z1 = m.z;
      if (m.item) makesCount[m.item] = (makesCount[m.item] || 0) + 1;
      kinds[m.name] = (kinds[m.name] || 0) + 1;
      const gb = gameData && gameData.buildings[m.cls];
      if (gb) zPower += gb.power;
    }
    const makes = Object.entries(makesCount)
      .sort((a, b) => b[1] - a[1])
      .map(([item, n]) => ({ item, machines: n }));
    // El nombre de la zona es lo que fabrica entre todas. Si no fabrica nada,
    // es por lo que está hecha: almacén, extracción o generación.
    const domCat = (c: string) => group.filter((m) => m.cat === c).length;
    const withRecipe = makes.reduce((n, m) => n + m.machines, 0);
    const purity = withRecipe ? makes[0].machines / withRecipe : 0;
    // Solo se le pone el nombre de un producto si de verdad está dedicada a
    // él. Con menos de dos tercios es un área mixta, y conviene decirlo.
    const name =
      makes.length && purity >= 0.66
        ? makes[0].item
        : makes.length
          ? t("zones.mixed")
          : domCat("store") >= group.length / 2
            ? t("zones.storage")
            : domCat("extr") >= group.length / 2
              ? t("zones.extraction")
              : domCat("power") >= group.length / 2
                ? t("zones.generation")
                : t("zones.zone");
    zones.push({
      floor: fl,
      count: group.length,
      x: sx / group.length,
      y: sy / group.length,
      z0,
      z1,
      name,
      purity: Math.round(purity * 100) / 100,
      makes,
      kinds,
      powerMW: Math.round(zPower * 10) / 10,
    });
  });

  return {
    perItem,
    consumed,
    machineCount,
    overclocked,
    stored,
    points,
    belts,
    collect,
    levels: floorLevels,
    unknownRecipes,
    unknownBySource,
    powerMW,
    genMW,
    dryGen,
    dryCount,
    players,
    collectPts,
    powerFromDocs,
    storedByClass,
    slabs,
    zones,
  };
}

// ---- Histórico rico: qué nos llevamos de cada guardado ----
// Esto es historia irrepetible: lo que no se guarde hoy no se podrá
// reconstruir mañana, porque el juego sobrescribe los autoguardados. Si
// quieres medir algo nuevo, añádelo aquí cuanto antes y sube SNAPSHOT_SCHEMA.
const SNAPSHOT_SCHEMA = 1;

function toRates(m: Record<string, number>, max = 80): ItemRate[] {
  return Object.entries(m)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([item, rate]) => ({ item, rate: Math.round(rate * 100) / 100 }));
}

function toCounts(m: Record<string, number>, max = 80): ItemCount[] {
  return Object.entries(m)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([item, count]) => ({ item, count }));
}

// Diagonal de la caja que envuelve la fábrica, en metros (el save va en cm).
function extentMeters(pts: { x: number; y: number }[]): number | null {
  if (pts.length < 2) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.round(Math.hypot((maxX - minX) / 100, (maxY - minY) / 100));
}

function buildMetrics(
  a: Awaited<ReturnType<typeof analyzeWithParser>>,
  info: BodyInfo,
  deficits: { item: string; deficit: number }[],
  powerIn: number,
  powerGen: number,
  saveName: string
): SnapshotMetrics {
  const meta = savesMeta[saveName];
  return {
    schema: SNAPSHOT_SCHEMA,
    tier: info.progression.current_tier,
    milestones: info.progression.milestones.length,
    research_count: info.progression.research_count,
    machines_with_recipe: a.machineCount,
    overclocked: a.overclocked,
    power_consumption_mw: Math.round(powerIn * 10) / 10,
    power_generation_mw: Math.round(powerGen * 10) / 10,
    production: toRates(a.perItem),
    consumption: toRates(a.consumed),
    deficits: deficits.map((d) => ({ item: d.item, rate: Math.round(d.deficit * 100) / 100 })),
    stored: toCounts(a.stored),
    collectables: toCounts(a.collect),
    modded: meta ? meta.isModded : null,
    mod_count: meta ? meta.mods.length : null,
    save_version: meta ? meta.saveVersion : null,
    build_version: meta ? meta.buildVersion : null,
    recipe_coverage:
      a.machineCount > 0
        ? Math.round(((a.machineCount - a.unknownRecipes) / a.machineCount) * 1000) / 1000
        : null,
    levels: a.levels.length,
    extent_m: extentMeters(a.points),
    game_version: info.game_version,
    save_name: saveName,
    player_x: a.players.length ? Math.round(a.players[0].x) : null,
    player_y: a.players.length ? Math.round(a.players[0].y) : null,
    // Solo los montajes de verdad, y como mucho cuarenta: esto se guarda en
    // cada lectura y un histórico de un año no debe pesar por un detalle que
    // nadie va a mirar.
    zones: a.zones
      .filter((z) => z.count >= 2)
      .slice(0, 40)
      .map((z) => ({ x: Math.round(z.x), y: Math.round(z.y), n: z.count })),
  };
}

// ---- Zonas: grupos que fabrican una cosa entre todos ----
// La gente no construye "una fábrica al lado de otra": monta un espacio para
// cada receta y luego los conecta. Así que una zona es un grupo de máquinas
// juntas EN LA MISMA PLANTA, y su identidad es lo que fabrican entre todas.
//
// Agrupar dentro de cada planta y no en 3D es lo que hace que dos plantas
// apiladas que hacen cosas distintas no se fundan en una sola zona.
export interface Zone {
  floor: number; // -1 = sobre terreno
  count: number;
  x: number; // centro, para colocar la etiqueta
  y: number;
  z0: number;
  z1: number;
  name: string;
  // Qué proporción de las máquinas hace lo mismo. Un espacio montado para una
  // receta tiene pureza alta; un bus central o una fábrica espagueti, baja. Es
  // la diferencia entre poder ponerle nombre y tener que admitir que es un
  // revoltijo, y la comunidad construye de las dos maneras.
  purity: number;
  makes: { item: string; machines: number }[];
  kinds: Record<string, number>;
  powerMW: number;
}

const ZONE_RADIUS = 3000; // 30 m: lo que separa dos montajes distintos

// Agrupado por cercanía con rejilla: comparar todas las máquinas contra todas
// se vuelve lento en fábricas grandes, así que solo se miran las celdas
// vecinas.
function clusterByProximity<T extends { x: number; y: number }>(items: T[], radius: number): T[][] {
  const parent = items.map((_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const cell = new Map<string, number[]>();
  const key = (x: number, y: number) => `${Math.floor(x / radius)},${Math.floor(y / radius)}`;
  items.forEach((it, i) => {
    const k = key(it.x, it.y);
    const arr = cell.get(k);
    if (arr) arr.push(i);
    else cell.set(k, [i]);
  });

  const r2 = radius * radius;
  items.forEach((it, i) => {
    const cx = Math.floor(it.x / radius);
    const cy = Math.floor(it.y / radius);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of cell.get(`${cx + dx},${cy + dy}`) || []) {
          if (j <= i) continue;
          const ddx = it.x - items[j].x;
          const ddy = it.y - items[j].y;
          if (ddx * ddx + ddy * ddy <= r2) union(i, j);
        }
      }
    }
  });

  const groups = new Map<number, T[]>();
  items.forEach((it, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(it);
    else groups.set(r, [it]);
  });
  return [...groups.values()];
}

// Calcula los déficits (piezas fabricables que se consumen más de lo que se producen).
function computeDeficits(produced: Record<string, number>, consumed: Record<string, number>) {
  const deficits: { item: string; prod: number; cons: number; deficit: number }[] = [];
  for (const item of Object.keys(consumed)) {
    // Solo piezas fabricables: una materia prima que se consume no es un
    // déficit, es una mina. Con los datos oficiales esto cubre las 872 recetas.
    if (!isCraftable(item)) continue;
    const net = (produced[item] || 0) - consumed[item];
    if (net < -0.01) deficits.push({ item, prod: produced[item] || 0, cons: consumed[item], deficit: -net });
  }
  deficits.sort((a, b) => b.deficit - a.deficit);
  return deficits;
}

// Balance de la cadena: no solo lo que falta, también el margen que sobra.
// Mirar únicamente los déficits deja fuera la mitad del problema — en
// Satisfactory sobreproducir también cuesta máquinas y megavatios.
function computeBalance(produced: Record<string, number>, consumed: Record<string, number>) {
  const rows: { item: string; prod: number; cons: number; net: number }[] = [];
  for (const item of Object.keys(consumed)) {
    // Una materia prima que se consume no es un desequilibrio, es una mina.
    if (!isCraftable(item)) continue;
    const prod = produced[item] || 0;
    rows.push({ item, prod, cons: consumed[item], net: prod - consumed[item] });
  }
  rows.sort((a, b) => a.net - b.net); // lo más roto primero
  return rows;
}

function renderBottlenecks(produced: Record<string, number>, consumed: Record<string, number>) {
  const rows = computeBalance(produced, consumed);
  const bad = rows.filter((r) => r.net < -0.01);

  if (!rows.length) {
    balanceEl.innerHTML =
      `<h3 class="inv-title">${t("bal.title")}</h3>` +
      `<p class="muted">${t("balance.ok")}</p>`;
    return;
  }

  // Si no hay ni un déficit, lo decimos antes de la gráfica: la buena noticia
  // va primero, no escondida entre barras azules.
  const head =
    `<h3 class="inv-title">${t("bal.title")}${bad.length ? ` · ${bad.length}` : ""}</h3>` +
    `<p class="muted">${bad.length ? t("bal.note") : t("bal.ok")}</p>`;

  // Los déficits enteros, y del excedente solo los mayores: la lista existe
  // para decidir, no para inventariar.
  const show = [...bad, ...rows.filter((r) => r.net >= -0.01).slice(-6).reverse()];

  const chart = divergingBars(
    show.map((r) => {
      let detail = "";
      if (r.net < -0.01) {
        // La sugerencia de máquinas solo si de verdad conocemos la receta.
        // Antes esto daba por hecho que la pieza estaba en la tabla interna y
        // con los datos oficiales cargados eso ya no es cierto.
        const rec = RECIPES[r.item];
        if (rec) {
          const n = Math.ceil(-r.net / rec.out);
          detail = `+${n} ${trBuilding(rec.building)}`;
        }
      } else if (r.cons > 0) {
        detail = `${Math.round((r.net / r.cons) * 100)}%`;
      }
      return {
        label: `${iconImg(r.item)}${r.item}`,
        value: Math.round(r.net * 100) / 100,
        detail:
          `<span class="dv-fix">${detail}</span>` +
          `<button class="bn-map" data-item="${escapeAttr(r.item)}" type="button" title="${t("map.locate")}" aria-label="${t("map.locate")}">` +
          `<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M8 1.6c-2.4 0-4.3 1.9-4.3 4.3 0 3.2 4.3 8.5 4.3 8.5s4.3-5.3 4.3-8.5c0-2.4-1.9-4.3-4.3-4.3zm0 6a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4z" fill="currentColor"/></svg>` +
          `</button>`,
      };
    }),
    "/min"
  );

  balanceEl.innerHTML = head + chart;

  balanceEl.querySelectorAll<HTMLButtonElement>(".bn-map").forEach((b) => {
    b.addEventListener("click", () => highlightOnMap(b.dataset.item || ""));
  });
}

// Panel de exploración: coleccionables que quedan por recoger en el mundo.
function renderExploration(collect: Record<string, number>) {
  const entries = Object.entries(collect).filter(([, n]) => n > 0);
  if (!entries.length) {
    explorationEl.innerHTML = "";
    return;
  }
  // Orden fijo y legible.
  const order = ["BP_Crystal_C", "BP_Crystal_mk2_C", "BP_Crystal_mk3_C", "BP_WAT1_C", "BP_WAT2_C", "BP_DropPod_C"];
  // Cada tipo es un botón: lleva al mapa con ese tipo aislado. Un recuento
  // sin sitio no sirve de nada cuando lo que quieres es ir a por ellos.
  const cells = order
    .filter((k) => collect[k])
    .map((k) => {
      const near = nearestCollect(k);
      const sub = near === null ? "" : `<span class="cell-sub">${t("expl.nearest", { n: near.toLocaleString() })}</span>`;
      const on = collectKind === k ? " active" : "";
      return (
        `<button class="cell cell-btn${on}" data-kind="${k}" type="button">` +
        `<span class="cell-label">${escapeXml(trCollect(k))}</span>` +
        `<span class="cell-value">${collect[k]}</span>${sub}</button>`
      );
    })
    .join("");
  explorationEl.innerHTML =
    `<h3 class="inv-title">${t("expl.title")}</h3>` +
    `<div class="detail-grid">${cells}</div>` +
    `<p class="muted">${lastCollect.length ? t("expl.note_map") : t("expl.note")}</p>`;

  explorationEl.querySelectorAll<HTMLButtonElement>(".cell-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const k = b.dataset.kind || "";
      // Pulsar el mismo tipo otra vez lo quita: no hay que buscar un botón de
      // "quitar filtro" que no existe.
      collectKind = collectKind === k ? null : k;
      // Están repartidos por el planeta, así que el encuadre de fábrica no
      // sirve para ir a por ellos.
      mapScope = collectKind ? "mundo" : "fabrica";
      showTab("planeta");
      renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
      renderExploration(collect);
      mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// Distancia al más cercano de ese tipo, en metros. Es la pregunta de verdad:
// no cuántos quedan, sino si merece la pena ir ahora.
function nearestCollect(kind: string): number | null {
  if (!lastPlayers.length) return null;
  let best = Infinity;
  for (const c of lastCollect) {
    if (c.kind !== kind) continue;
    const d = metresFromPlayer(c.x, c.y);
    if (d !== null && d < best) best = d;
  }
  return isFinite(best) ? best : null;
}

// Rota un vector local por un cuaternión (para llevar el trazado de la cinta al mundo).
// Cosas que aparecen con coordenadas pero no son parte de la fábrica que el
// pionero ha construido sobre el terreno.
const NOT_FACTORY = /ProjectAssembly|Orbital/i;

// Piezas que forman suelo pisable, y las que no lo son aunque lo parezcan.
const FLOOR_PIECE = /Foundation|Walkway|Platform/i;
const NOT_FLOOR = /Ramp|Wall|Pillar|Corner/i;
// Un cimiento mide 8 m de lado.
const SLAB_SIZE = 800;

function qrot(q: any, v: any) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Clasifica una construcción para el mapa (forma + color).
function categoryOf(tp: string): string {
  if (/Constructor|Smelter|Assembler|Foundry|Manufacturer|Refinery|Packager|Blender|ParticleAccelerator/.test(tp))
    return "prod";
  if (/MinerMk|OilPump|WaterPump|FrackingExtractor|FrackingSmasher/.test(tp)) return "extr";
  if (/Generator/.test(tp)) return "power";
  if (/StorageContainer|StorageIntegrated|StorageTank|DimensionalDepot/.test(tp)) return "store";
  return "other";
}

// Estilo (color + etiqueta) de cada categoría del mapa.
// Paleta del mapa, validada contra el fondo oscuro igual que la de las
// gráficas. Naranja y azul son los mismos de las series, así que el mapa y
// los gráficos hablan el mismo idioma.
//
// Cuatro tonos categóricos dentro de la banda de luminosidad y además
// separados para daltonismo es difícil: el mejor par encontrado deja 7,6 de
// separación entre magenta y azul para deuteranopía, por debajo del 8 ideal.
// Eso es aceptable SOLO con una segunda codificación, y la tenemos: cada
// categoría tiene su forma (círculo, triángulo, cuadrado, rombo) y la leyenda
// las nombra. Por eso las formas no son decoración y no se tocan.
const CATS: Record<string, { color: string; label: string }> = {
  prod: { color: "#cf7a2a", label: "Producción" },
  extr: { color: "#3f93e0", label: "Extracción" },
  power: { color: "#b45fb0", label: "Generadores" },
  store: { color: "#3f9e6a", label: "Almacenamiento" },
};

// Dibuja una forma distinta por categoría, centrada en (cx,cy).
function mapShape(cat: string, cx: number, cy: number, r: number, title: string): string {
  const color = (CATS[cat] || {}).color || "#aab0bd";
  const t = `<title>${title}</title>`;
  // class="mk": el marcador mantiene su tamaño en pantalla al hacer zoom. Sin
  // eso, acercarse agranda marcador y distancia por igual y la densidad queda
  // exactamente la misma, que es como no tener zoom.
  const a = `class="mk" fill="${color}" stroke="#131922" stroke-width="0.6" vector-effect="non-scaling-stroke"`;
  switch (cat) {
    case "prod": // círculo
      return `<circle cx="${cx}" cy="${cy}" r="${r}" ${a}>${t}</circle>`;
    case "extr": // triángulo
      return `<polygon points="${cx},${cy - r} ${cx - r},${cy + r} ${cx + r},${cy + r}" ${a}>${t}</polygon>`;
    case "power": // cuadrado
      return `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" ${a}>${t}</rect>`;
    case "store": // rombo
      return `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" ${a}>${t}</polygon>`;
    default:
      return "";
  }
}

// Dibuja un plano cenital: cintas como líneas, máquinas como puntos con nombre (al pasar el ratón).
// Lista de zonas: qué montajes tienes, dónde y qué fabrica cada uno.
function zoneList(zones: Zone[]): string {
  if (!zones.length) return "";
  const floorName = (f: number) =>
    f < 0
      ? t("map.ground").toLowerCase()
      : `${t("map.floors").toLowerCase().replace(/s$/, "")} ${Math.round((mapLevels[f] - mapGround) / 100)} m`;
  const real = zones.filter((z) => z.count >= 2);
  const loose = zones.length - real.length;
  const rows = real
    .map((z, i) => {
      const idx = zones.indexOf(z);
      // En una zona dedicada basta con decir qué hace. En una mixta interesa
      // el desglose, que es justo lo que no se ve jugando.
      const top = z.purity >= 0.66 ? 2 : 4;
      const makes =
        z.makes
          .slice(0, top)
          .map((m) => `${m.machines}× ${iconImg(m.item, 15)}${escapeXml(m.item)}`)
          .join(", ") + (z.makes.length > top ? t("zones.more", { n: z.makes.length - top }) : "");
      const kinds = Object.entries(z.kinds)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, n]) => `${n} ${escapeXml(k)}`)
        .join(", ");
      return (
        `<button class="zone-row${mapZone === idx ? " active" : ""}" data-zone="${idx}" type="button">` +
        `<span class="zone-n">${i + 1}</span>` +
        `<span class="zone-main"><b>${escapeXml(z.name)}</b>` +
        `<span class="zone-meta">${floorName(z.floor)} · ${z.count} ${t("zones.machines")} · ${kinds}` +
        `${z.makes.length > 1 ? ` · ${t("zones.dedicated", { n: Math.round(z.purity * 100) })}` : ""}` +
        `${z.powerMW ? ` · ${fmt(z.powerMW)} MW` : ""}</span></span>` +
        `<span class="zone-makes">${makes || "—"}</span></button>`
      );
    })
    .join("");
  return (
    `<h3 class="inv-title">${t("sec.zones")} · ${real.length}</h3>` +
    `<div class="zone-list">` +
    `<button class="zone-row zone-all${mapZone === null ? " active" : ""}" data-zone="all" type="button">` +
    `<span class="zone-n">·</span><span class="zone-main"><b>${t("zones.all")}</b></span></button>` +
    rows +
    `</div>` +
    (loose ? `<p class="muted">${t("zones.loose", { n: loose })}</p>` : "") +
    `<p class="muted">${t("zones.note")}</p>`
  );
}

// ---- El mapa en el tiempo ----
//
// Dos lecturas no se pueden emparejar por índice de zona (se recalculan cada
// vez) ni por nombre (depende del idioma). Solo por posición. El centro de un
// montaje se mueve un poco al crecer, así que se admite holgura, y se asigna
// de más cercano a más lejano para que dos bloques vecinos no se crucen.
const ZONE_MATCH = 6000; // unidades del juego, 60 m

interface ZoneDelta {
  zone: Zone;
  before: number | null; // máquinas que tenía, null si no existía
  delta: number;
}

function compareZones(
  now: Zone[],
  then: { x: number; y: number; n: number }[]
): { deltas: ZoneDelta[]; gone: { x: number; y: number; n: number }[] } {
  const pairs: { i: number; j: number; d: number }[] = [];
  now.forEach((z, i) => {
    then.forEach((o, j) => {
      const d = Math.hypot(z.x - o.x, z.y - o.y);
      if (d <= ZONE_MATCH) pairs.push({ i, j, d });
    });
  });
  pairs.sort((a, b) => a.d - b.d);

  const takenNow = new Set<number>();
  const takenThen = new Set<number>();
  const match = new Map<number, number>();
  for (const p of pairs) {
    if (takenNow.has(p.i) || takenThen.has(p.j)) continue;
    takenNow.add(p.i);
    takenThen.add(p.j);
    match.set(p.i, p.j);
  }

  // Segunda pasada, solo con lo que ha sobrado. Un montaje que crece mucho
  // arrastra su centro, y con la holgura normal se leería como uno nuevo más
  // uno desaparecido: dos respuestas equivocadas en vez de una correcta. Aquí
  // la holgura es mayor porque los emparejamientos seguros ya están hechos y
  // lo que queda no tiene con qué confundirse.
  const LOOSE = 15000; // 150 m
  const leftoverPairs: { i: number; j: number; d: number }[] = [];
  now.forEach((z, i) => {
    if (takenNow.has(i)) return;
    then.forEach((o, j) => {
      if (takenThen.has(j)) return;
      const d = Math.hypot(z.x - o.x, z.y - o.y);
      if (d <= LOOSE) leftoverPairs.push({ i, j, d });
    });
  });
  leftoverPairs.sort((a, b) => a.d - b.d);
  for (const p of leftoverPairs) {
    if (takenNow.has(p.i) || takenThen.has(p.j)) continue;
    takenNow.add(p.i);
    takenThen.add(p.j);
    match.set(p.i, p.j);
  }

  const deltas: ZoneDelta[] = now.map((z, i) => {
    const j = match.get(i);
    const before = j === undefined ? null : then[j].n;
    return { zone: z, before, delta: before === null ? z.count : z.count - before };
  });
  const gone = then.filter((_, j) => !takenThen.has(j));
  return { deltas, gone };
}

// Selector de comparación. Solo aparece si hay con qué comparar: ofrecerlo
// vacío sería prometer algo que el histórico todavía no puede dar.
function comparePicker(): string {
  const snaps = comparableSnaps();
  if (snaps.length < 2) return "";
  const now = snaps[snaps.length - 1].ts_ms;
  const opts: { ts: number; label: string }[] = [];
  const pick = (days: number, key: string) => {
    const target = now - days * 86400000;
    const c = snaps.filter((s) => s.ts_ms <= target).pop();
    if (c && !opts.some((o) => o.ts === c.ts_ms)) opts.push({ ts: c.ts_ms, label: t(key) });
  };
  pick(7, "cmp.week");
  pick(30, "cmp.month");
  const first = snaps[0];
  if (first.ts_ms !== now && !opts.some((o) => o.ts === first.ts_ms)) {
    opts.push({ ts: first.ts_ms, label: t("cmp.first") });
  }
  if (!opts.length) return "";
  return (
    `<span class="cmp-pick">${t("cmp.vs")}` +
    `<button class="map-fit${compareTs === null ? " on" : ""}" data-cmp="" type="button">${t("cmp.none")}</button>` +
    opts
      .map(
        (o) =>
          `<button class="map-fit${compareTs === o.ts ? " on" : ""}" data-cmp="${o.ts}" type="button">${o.label}</button>`
      )
      .join("") +
    `</span>`
  );
}

// Las lecturas que sirven para comparar: las que guardaron zonas.
function comparableSnaps(): Snapshot[] {
  return lastSnaps.filter((s) => s.metrics && s.metrics.zones && s.metrics.zones.length);
}

function renderMap(
  points: { x: number; y: number; z: number; cat: string; name: string; detail: string; item: string; floor: number; zone: number }[],
  belts: { pts: [number, number][]; z: number; z0: number; z1: number }[],
  slabs: { x: number; y: number; z: number; r: any }[] = [],
  zones: Zone[] = []
) {
  if (!points.length && !belts.length) {
    mapEl.innerHTML = `<p class="muted">${t("map.empty")}</p>`;
    return;
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  const acc = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const p of points) {
    acc(p.x, p.y);
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  for (const b of belts) {
    for (const [x, y] of b.pts) acc(x, y);
    if (b.z < minZ) minZ = b.z;
    if (b.z > maxZ) maxZ = b.z;
  }
  if (!isFinite(minZ)) { minZ = 0; maxZ = 1; }
  if (maxZ - minZ < 1) maxZ = minZ + 1;

  // La caja de la vista se calcula por percentiles, no por mínimo y máximo: un
  // único objeto despistado no debe encoger la fábrica entera hasta dejarla en
  // cuatro píxeles. Lo que quede fuera se sigue dibujando, solo que al borde.
  const pct = (arr: number[], f: number) => {
    const a = [...arr].sort((x, y) => x - y);
    return a.length ? a[Math.floor((a.length - 1) * f)] : 0;
  };
  const allX = points.map((p) => p.x);
  const allY = points.map((p) => p.y);
  if (allX.length >= 20 && mapScope === "fabrica") {
    const mx = (pct(allX, 0.99) - pct(allX, 0.01)) * 0.08 + 500;
    const my = (pct(allY, 0.99) - pct(allY, 0.01)) * 0.08 + 500;
    minX = Math.max(minX, pct(allX, 0.01) - mx);
    maxX = Math.min(maxX, pct(allX, 0.99) + mx);
    minY = Math.max(minY, pct(allY, 0.01) - my);
    maxY = Math.min(maxY, pct(allY, 0.99) + my);
  }

  // En vista de mundo la caja se abre hasta abarcar lo que queda ahí fuera.
  // Sin esto, pulsar una cápsula te lleva a un mapa donde la cápsula no sale.
  if (mapScope === "mundo") {
    for (const c of lastCollect) {
      if (collectKind && c.kind !== collectKind) continue;
      acc(c.x, c.y);
    }
    for (const pl of lastPlayers) acc(pl.x, pl.y);
  }

  const W = 720, H = 620, pad = 14;
  const s = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
  const px = (x: number) => pad + (x - minX) * s;
  const py = (y: number) => pad + (maxY - y) * s; // Y invertida (norte arriba)

  const hi = highlightItem; // pieza a resaltar (cuello de botella)
  const beltOp = hi ? 0.12 : 0.7;
  const otherOp = hi ? 0.18 : 1;

  // Suelo construido, debajo de todo. Es lo que hace que la fábrica deje de
  // flotar en el vacío: se ve sobre qué está puesta cada cosa.
  const floorOfZ = (z: number): number => {
    let best = -1;
    for (let i = 0; i < mapLevels.length; i++) {
      const fz = mapLevels[i];
      if (z >= fz - 100 && z - fz <= 600 && (best < 0 || fz > mapLevels[best])) best = i;
    }
    return best;
  };
  let slabSvg = "";
  const half = SLAB_SIZE / 2;
  for (const sl of slabs) {
    // El cimiento es un cuadrado de 8 m; se gira con su propio cuaternión para
    // que los bloques en diagonal no salgan torcidos.
    const corners = [
      { x: -half, y: -half, z: 0 },
      { x: half, y: -half, z: 0 },
      { x: half, y: half, z: 0 },
      { x: -half, y: half, z: 0 },
    ]
      .map((c) => {
        const w = sl.r ? qrot(sl.r, c) : c;
        return `${px(sl.x + w.x).toFixed(1)},${py(sl.y + w.y).toFixed(1)}`;
      })
      .join(" ");
    slabSvg +=
      `<g data-cat="floor" data-z="${Math.round(sl.z)}" data-floor="${floorOfZ(sl.z)}">` +
      `<polygon points="${corners}" fill="#2b313c" fill-opacity="0.75" stroke="#39404d" stroke-width="0.3" vector-effect="non-scaling-stroke"/></g>`;
  }

  // Cintas (líneas). Cada una en su grupo con categoría y altura para los filtros.
  let lines = "";
  for (const b of belts) {
    const pts = b.pts.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
    lines +=
      `<g data-cat="belt" data-z="${Math.round(b.z)}" data-z0="${Math.round(b.z0)}" data-z1="${Math.round(b.z1)}">` +
      `<polyline points="${pts}" fill="none" stroke="#8a93a3" stroke-width="1" stroke-opacity="${beltOp}" vector-effect="non-scaling-stroke"/></g>`;
  }
  // Edificios: puntito gris para "otros", forma+color por categoría para el resto.
  let others = "";
  let shapes = "";
  let hiCount = 0;
  const counts: Record<string, number> = {};
  for (const p of points) {
    const cx = px(p.x).toFixed(1), cy = py(p.y).toFixed(1);
    const zAttr = `data-z="${Math.round(p.z)}" data-floor="${p.floor}" data-zone="${p.zone}"`;
    if (p.cat === "other") {
      others += `<g data-cat="other" ${zAttr}><circle class="mk" cx="${cx}" cy="${cy}" r="1.1" fill="#aab0bd" fill-opacity="${otherOp}"/></g>`;
    } else {
      counts[p.cat] = (counts[p.cat] || 0) + 1;
      const match = hi !== null && p.item === hi;
      if (match) hiCount++;
      const op = hi ? (match ? 1 : 0.18) : 1;
      let s = mapShape(p.cat, +cx, +cy, 3.4, escapeXml(p.name + p.detail));
      if (match) {
        s = `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="#ff3b3b" stroke-width="1.8" vector-effect="non-scaling-stroke" class="map-hi mk"/>` + s;
      }
      shapes += `<g data-cat="${p.cat}" ${zAttr} opacity="${op}">${s}</g>`;
    }
  }

  // Leyenda: solo categorías presentes.
  const legend = Object.keys(CATS)
    .filter((c) => counts[c])
    .map((c) => {
      const { color, label } = CATS[c];
      const glyph =
        c === "prod"
          ? `<svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="${color}"/></svg>`
          : c === "extr"
          ? `<svg width="12" height="12"><polygon points="6,1 1,11 11,11" fill="${color}"/></svg>`
          : c === "power"
          ? `<svg width="12" height="12"><rect x="1" y="1" width="10" height="10" fill="${color}"/></svg>`
          : `<svg width="12" height="12"><polygon points="6,1 11,6 6,11 1,6" fill="${color}"/></svg>`;
      return `<span class="leg-item">${glyph} ${label} (${counts[c]})</span>`;
    })
    .join("");

  // Casillas para mostrar/ocultar cada capa.
  const filterDefs = [
    ["prod", t("layer.prod")],
    ["extr", t("layer.extr")],
    ["power", t("layer.power")],
    ["store", t("layer.store")],
    ["floor", t("layer.floor")],
    ["belt", t("layer.belt")],
    ["other", t("layer.other")],
  ];
  if (lastCollect.length) filterDefs.push(["collect", t("layer.collect")]);
  const filters = filterDefs
    .map(
      ([k, lbl]) =>
        `<label class="map-filter"><input type="checkbox" data-layer="${k}" checked /> ${lbl}</label>`
    )
    .join("");

  const banner = hi
    ? `<div class="map-banner">${t("map.banner", { item: escapeXml(hi), n: hiCount })}` +
      `<button id="clear-hi" type="button">${t("map.clear")}</button></div>`
    : "";

  // Filtro de altura (pisos): dos deslizadores para aislar una banda vertical.
  const zStep = Math.max(1, Math.round((maxZ - minZ) / 100));
  const heightFilter =
    `<div class="map-height">` +
    `<span class="muted">${t("map.height")}</span>` +
    `<input type="range" id="z-min" min="${Math.floor(minZ)}" max="${Math.ceil(maxZ)}" step="${zStep}" value="${Math.floor(minZ)}" />` +
    `<input type="range" id="z-max" min="${Math.floor(minZ)}" max="${Math.ceil(maxZ)}" step="${zStep}" value="${Math.ceil(maxZ)}" />` +
    `<span id="z-label" class="muted"></span>` +
    `</div>`;

  // Plantas, deducidas del suelo construido. "Terreno" no es un fallo de
  // detección: es dónde está construida de verdad media fábrica.
  mapGround = mapLevels.length ? mapLevels[0] : minZ;
  const perFloor = new Map<number, number>();
  for (const p of points) {
    if (p.cat === "other") continue;
    perFloor.set(p.floor, (perFloor.get(p.floor) || 0) + 1);
  }
  const chip = (f: number | null, label: string, n?: number) =>
    `<button class="lvl-chip${mapFloor === f ? " active" : ""}" data-floor="${f === null ? "all" : f}">` +
    `${label}${n !== undefined ? ` <span class="lvl-n">${n}</span>` : ""}</button>`;

  let levelChips = "";
  if (mapLevels.length || perFloor.has(-1)) {
    const floors = mapLevels
      .map((lz, i) => chip(i, `${Math.round((lz - mapGround) / 100)} m`, perFloor.get(i) || 0))
      .join("");
    levelChips =
      `<div class="map-levels"><span class="muted">${t("map.floors")} (${mapLevels.length}):</span> ` +
      chip(null, t("map.allFloors")) +
      (perFloor.has(-1) ? chip(-1, t("map.ground"), perFloor.get(-1) || 0) : "") +
      floors +
      (mapLevels.length
        ? ""
        : ` <span class="muted map-hint">${t("map.noSlabs")}</span>`) +
      `</div>`;
  }

  // Crecimiento: cuánto ha cambiado cada montaje desde la lectura elegida.
  // Se dibuja encima de las formas, nunca sustituyéndolas — el mapa sigue
  // diciendo qué hay; esto añade qué ha cambiado.
  let growthSvg = "";
  let growthNote = "";
  const cmpSnap = compareTs === null ? null : lastSnaps.find((s) => s.ts_ms === compareTs);
  if (cmpSnap && cmpSnap.metrics && cmpSnap.metrics.zones && zones.length) {
    const { deltas, gone } = compareZones(zones, cmpSnap.metrics.zones);
    let grew = 0;
    let fresh = 0;
    for (const d of deltas) {
      if (d.before === null) fresh++;
      else if (d.delta > 0) grew++;
      if (d.before !== null && d.delta === 0) continue;
      const cx = px(d.zone.x).toFixed(1);
      const cy = py(d.zone.y).toFixed(1);
      const isNew = d.before === null;
      const col = isNew ? "#3f9e6a" : d.delta > 0 ? "#3f93e0" : "#c45d94";
      const label = isNew ? t("cmp.new") : `${d.delta > 0 ? "+" : ""}${d.delta}`;
      growthSvg +=
        `<g class="map-growth">` +
        `<circle class="mk" cx="${cx}" cy="${cy}" r="11" fill="none" stroke="${col}" stroke-width="1.6" stroke-opacity="0.9" vector-effect="non-scaling-stroke"/>` +
        `<text class="gr-label" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="${col}">${label}</text>` +
        `<title>${escapeXml(d.zone.name)}: ${isNew ? t("cmp.new") : t("cmp.was", { n: d.before ?? 0 })}</title>` +
        `</g>`;
    }
    // Lo que ya no está: se marca en su sitio, porque desmontar también es
    // información y de otro modo desaparece sin dejar rastro.
    for (const g of gone) {
      growthSvg +=
        `<g class="map-growth">` +
        `<circle class="mk" cx="${px(g.x).toFixed(1)}" cy="${py(g.y).toFixed(1)}" r="9" fill="none" ` +
        `stroke="#8b93a3" stroke-width="1.2" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` +
        `<title>${t("cmp.gone", { n: g.n })}</title></g>`;
    }
    growthNote = t("cmp.summary", {
      d: new Date(cmpSnap.ts_ms).toLocaleDateString(getLang()),
      g: grew,
      n: fresh,
      x: gone.length,
    });
  }

  // Lo que queda por recoger. Capa aparte, no una quinta categoría: el
  // espacio de colores ya está lleno y un quinto tono no pasaba la validación
  // contra los cuatro de la fábrica. Así que el mundo va en tinta y hueco —
  // misma familia que el pionero y su rastro — y el color se queda para lo
  // que has construido. La forma distingue el tipo.
  let collectSvg = "";
  for (const c of lastCollect) {
    if (collectKind && c.kind !== collectKind) continue;
    const cx = px(c.x).toFixed(1);
    const cy = py(c.y).toFixed(1);
    const col = c.kind === "BP_DropPod_C" ? "#ffd9a6" : "#cfd6e4";
    let glyph: string;
    if (c.kind === "BP_DropPod_C") {
      // Cápsula: cuadrado. Es el premio gordo, así que destaca en cálido.
      glyph = `<rect class="mk" x="${(+cx - 2.6).toFixed(1)}" y="${(+cy - 2.6).toFixed(1)}" width="5.2" height="5.2" fill="none" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
    } else if (c.kind === "BP_WAT1_C" || c.kind === "BP_WAT2_C") {
      // Lo alienígena: rombo.
      glyph = `<polygon class="mk" points="${cx},${(+cy - 3).toFixed(1)} ${(+cx + 3).toFixed(1)},${cy} ${cx},${(+cy + 3).toFixed(1)} ${(+cx - 3).toFixed(1)},${cy}" fill="none" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
    } else {
      // Babas: círculo.
      glyph = `<circle class="mk" cx="${cx}" cy="${cy}" r="2.4" fill="none" stroke="${col}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
    }
    const m = metresFromPlayer(c.x, c.y);
    collectSvg +=
      `<g data-cat="collect" data-z="${Math.round(c.z)}" data-floor="-1">` +
      glyph +
      `<title>${escapeXml(trCollect(c.kind))}${m === null ? "" : ` · ${t("alert.away", { n: m.toLocaleString() })}`}</title></g>`;
  }

  // Rastro: por dónde andaba uno en lecturas anteriores. Puntos sueltos y no
  // una línea, porque entre dos lecturas puede haber pasado media hora y unir
  // los puntos insinuaría un camino que nadie ha recorrido así.
  let trackSvg = "";
  if (lastTrack.length > 1 && mapTrack) {
    const n = lastTrack.length;
    trackSvg =
      `<g class="map-track">` +
      lastTrack
        .map((p, i) => {
          const op = (0.25 + 0.55 * (i / (n - 1))).toFixed(2); // lo reciente, más vivo
          // Anillo hueco, no punto relleno: los puntos grises rellenos ya son
          // "resto de edificios" y en pantalla no se distinguían. Así hace
          // familia con el pionero — relleno es ahora, hueco es antes.
          return (
            `<circle class="mk" cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="2.6" ` +
            `fill="none" stroke="#e9eaec" stroke-opacity="${op}" stroke-width="1.1" vector-effect="non-scaling-stroke"/>`
          );
        })
        .join("") +
      `</g>`;
  }

  // El pionero, donde estaba al guardar. Glifo propio y no una categoría más:
  // no es parte de la fábrica, es quien la mira.
  let playerSvg = "";
  for (const pl of lastPlayers) {
    const ax = px(pl.x).toFixed(1);
    const ay = py(pl.y).toFixed(1);
    playerSvg +=
      `<g class="map-player">` +
      `<circle class="mk" cx="${ax}" cy="${ay}" r="7" fill="none" stroke="#e9eaec" stroke-width="1.2" stroke-opacity="0.55" vector-effect="non-scaling-stroke"/>` +
      `<circle class="mk" cx="${ax}" cy="${ay}" r="3" fill="#e9eaec" stroke="#0c0e12" stroke-width="1" vector-effect="non-scaling-stroke"/>` +
      `<title>${escapeXml(pl.name || t("map.you"))}</title></g>`;
  }

  // Chincheta del aviso: un anillo en el sitio exacto al que se ha pedido ir.
  let spotSvg = "";
  if (highlightSpot) {
    const sx = px(highlightSpot.x).toFixed(1);
    const sy = py(highlightSpot.y).toFixed(1);
    spotSvg =
      `<g class="map-spot">` +
      `<circle class="mk" cx="${sx}" cy="${sy}" r="13" fill="none" stroke="#ff3b3b" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
      `<circle class="mk" cx="${sx}" cy="${sy}" r="2.2" fill="#ff3b3b"/>` +
      `<title>${escapeXml(highlightSpot.label)}</title></g>`;
  }

  mapEl.innerHTML =
    `<h3 class="inv-title">${t("map.title", { b: points.length, c: belts.length })}` +
    `${slabs.length ? t("map.slabs", { n: slabs.length }) : ""}</h3>` +
    banner +
    `<div class="map-filters">${filters}` +
    `<button id="map-fit" class="map-fit" type="button">${t("map.fit")}</button>` +
    (lastCollect.length
      ? `<button id="map-scope" class="map-fit${mapScope === "mundo" ? " on" : ""}" type="button">${t(mapScope === "mundo" ? "map.scope_world" : "map.scope_factory")}</button>`
      : "") +
    (lastTrack.length > 1
      ? `<button id="map-track" class="map-fit${mapTrack ? " on" : ""}" type="button">${t("map.track", { n: lastTrack.length })}</button>`
      : "") +
    comparePicker() +
    `<span class="muted map-hint">${t("map.hint")}</span></div>` +
    levelChips +
    heightFilter +
    (growthNote ? `<p class="muted cmp-note">${growthNote}</p>` : "") +
    `<svg viewBox="0 0 ${W} ${H}" class="map2d" id="map-svg">` +
    `<g id="map-vp">${slabSvg}${lines}${others}${shapes}${collectSvg}${trackSvg}${growthSvg}${playerSvg}${spotSvg}</g></svg>` +
    `<div class="map-legend">${legend}<span class="leg-item"><span style="color:#8a93a3">─</span> cintas</span>` +
    `<span class="leg-item"><span style="color:#aab0bd">·</span> resto</span></div>` +
    zoneList(zones) +
    `<p class="muted">${t("map.note")}</p>`;

  setupMapInteraction();
}

// Estado del mapa para resaltar cuellos de botella.
let lastPoints: { x: number; y: number; z: number; cat: string; name: string; detail: string; item: string; floor: number; zone: number }[] = [];
let lastBelts: { pts: [number, number][]; z: number; z0: number; z1: number }[] = [];
let mapGround = 0; // altura del nivel más bajo, para mostrar metros relativos
let lastSlabs: { x: number; y: number; z: number; r: any }[] = [];
let mapFloor: number | null = null; // planta elegida; null = todas
let lastZones: Zone[] = [];
let mapZone: number | null = null; // zona elegida; null = todas
let mapLevels: number[] = []; // alturas de los niveles construidos del mundo abierto
let highlightItem: string | null = null;
// Punto concreto al que ir desde un aviso: no es "resalta esta pieza" sino
// "llévame a este sitio".
let highlightSpot: { x: number; y: number; label: string } | null = null;
let mapTrack = true;
// Qué queda ahí fuera, con su sitio. null = todos los tipos.
let lastCollect: { kind: string; x: number; y: number; z: number }[] = [];
let collectKind: string | null = null;
// Dos encuadres. "fabrica" ajusta a lo construido, que es lo normal. "mundo"
// abre hasta abarcar lo que queda por recoger, que está repartido por todo el
// planeta y a escala de fábrica cae fuera del lienzo.
let mapScope: "fabrica" | "mundo" = "fabrica";
// Lectura con la que comparar el mapa. null = no comparar.
let compareTs: number | null = null;
let lastSnaps: Snapshot[] = [];
// Dónde está el pionero en la lectura abierta. Sirve para pintarlo en el mapa
// y para decir a qué distancia queda lo que se ha parado.
let lastPlayers: { name: string; x: number; y: number; z: number }[] = [];
// Posiciones guardadas en lecturas anteriores, para el rastro del mapa.
let lastTrack: { x: number; y: number; ts: number }[] = [];

// Distancia en metros desde el pionero más cercano. En línea recta: lo que
// cuesta llegar depende del terreno, y eso no está en el archivo.
function metresFromPlayer(x: number, y: number): number | null {
  if (!lastPlayers.length) return null;
  let best = Infinity;
  for (const p of lastPlayers) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best) best = d;
  }
  return Math.round(best / 100);
}

// Salta al mapa y resalta las máquinas que fabrican `item`.
function highlightOnMap(item: string) {
  highlightItem = item;
  highlightSpot = null;
  showTab("planeta");
  renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
}

// Zoom (rueda), arrastre (ratón) y filtros del mapa.
let mapView = { scale: 1, tx: 0, ty: 0 };
function setupMapInteraction() {
  const clearBtn = document.querySelector("#clear-hi");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      highlightItem = null;
      highlightSpot = null;
      renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
    });
  }

  const svg = document.querySelector("#map-svg") as SVGSVGElement | null;
  const vp = document.querySelector("#map-vp") as SVGGElement | null;
  if (!svg || !vp) return;
  mapView = { scale: 1, tx: 0, ty: 0 };
  const apply = () => {
    vp.setAttribute("transform", `translate(${mapView.tx} ${mapView.ty}) scale(${mapView.scale})`);
    // Una sola propiedad reescala los dos mil marcadores de golpe, sin tocar
    // el DOM elemento por elemento. Al alejar no se agrandan: por debajo de
    // 1x se quedan como están.
    svg.style.setProperty("--mk", String(1 / Math.max(1, mapView.scale)));
  };
  apply();

  // Volver al encuadre inicial. Sin esto, la única manera de recuperar la
  // vista completa es rodar la rueda hacia atrás a ojo.
  const reset = () => {
    mapView = { scale: 1, tx: 0, ty: 0 };
    apply();
  };
  svg.addEventListener("dblclick", reset);
  document.querySelector("#map-fit")?.addEventListener("click", reset);
  mapEl.querySelectorAll<HTMLButtonElement>("[data-cmp]").forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.dataset.cmp;
      compareTs = v ? parseInt(v, 10) : null;
      renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
    });
  });
  document.querySelector("#map-scope")?.addEventListener("click", () => {
    mapScope = mapScope === "mundo" ? "fabrica" : "mundo";
    renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
  });
  document.querySelector("#map-track")?.addEventListener("click", () => {
    mapTrack = !mapTrack;
    renderMap(lastPoints, lastBelts, lastSlabs, lastZones);
  });

  svg.addEventListener(
    "wheel",
    (e) => {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    const W = 720, H = 620;
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const ns = Math.min(20, Math.max(0.5, mapView.scale * factor));
    // Zoom centrado en el cursor.
    mapView.tx = mx - ((mx - mapView.tx) * ns) / mapView.scale;
    mapView.ty = my - ((my - mapView.ty) * ns) / mapView.scale;
    mapView.scale = ns;
    apply();
    },
    { passive: false }
  );

  let dragging = false, lastX = 0, lastY = 0;
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    svg.setPointerCapture(e.pointerId);
    svg.style.cursor = "grabbing";
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = svg.getBoundingClientRect();
    const W = 720, H = 620;
    mapView.tx += ((e.clientX - lastX) / rect.width) * W;
    mapView.ty += ((e.clientY - lastY) / rect.height) * H;
    lastX = e.clientX;
    lastY = e.clientY;
    apply();
  });
  const endDrag = () => {
    dragging = false;
    svg.style.cursor = "grab";
  };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointerleave", endDrag);
  svg.style.cursor = "grab";

  // Filtros: categoría (casillas) + altura (deslizadores), unificados.
  mapEl.querySelectorAll<HTMLInputElement>(".map-filter input").forEach((cb) => {
    cb.addEventListener("change", applyMapFilters);
  });
  mapEl.querySelectorAll<HTMLInputElement>("#z-min, #z-max").forEach((sl) => {
    sl.addEventListener("input", applyMapFilters);
  });
  // Zonas: quedarse con un montaje concreto.
  mapEl.querySelectorAll<HTMLButtonElement>(".zone-row").forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.dataset.zone;
      mapZone = v === "all" || v === undefined ? null : parseInt(v, 10);
      mapEl.querySelectorAll(".zone-row").forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
      applyMapFilters();
    });
  });

  // Chips de planta: eligen sobre qué suelo mirar.
  mapEl.querySelectorAll<HTMLButtonElement>(".lvl-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.dataset.floor;
      mapFloor = v === "all" || v === undefined ? null : parseInt(v, 10);
      mapEl.querySelectorAll(".lvl-chip").forEach((c) => c.classList.remove("active"));
      b.classList.add("active");
      applyMapFilters();
    });
  });
  applyMapFilters();
}

// Aplica los filtros de categoría y altura mostrando/ocultando cada elemento del mapa.
function applyMapFilters() {
  const vp = document.querySelector("#map-vp");
  if (!vp) return;
  const zMinEl = document.querySelector("#z-min") as HTMLInputElement | null;
  const zMaxEl = document.querySelector("#z-max") as HTMLInputElement | null;
  let lo = -Infinity, hi = Infinity;
  if (zMinEl && zMaxEl) {
    const a = parseFloat(zMinEl.value), b = parseFloat(zMaxEl.value);
    lo = Math.min(a, b);
    hi = Math.max(a, b);
    const lbl = document.querySelector("#z-label");
    // En metros sobre el nivel más bajo construido: las coordenadas crudas del
    // juego (-3811) no le dicen nada a nadie.
    if (lbl) {
      const a0 = Math.round((lo - mapGround) / 100);
      const a1 = Math.round((hi - mapGround) / 100);
      lbl.textContent = `${a0} – ${a1} m sobre el suelo`;
    }
  }
  const catOn: Record<string, boolean> = {};
  document.querySelectorAll<HTMLInputElement>(".map-filter input").forEach((cb) => {
    catOn[cb.dataset.layer!] = cb.checked;
  });
  vp.querySelectorAll<SVGElement>("g[data-cat]").forEach((g) => {
    const cat = g.getAttribute("data-cat") || "";
    // Una capa apagada se oculta de verdad; eso lo ha pedido el usuario.
    const catVisible = catOn[cat] !== false;
    g.style.display = catVisible ? "" : "none";
    if (!catVisible) return;
    // Fuera de la banda de altura NO se oculta, se deja en sombra: aislar un
    // piso y quedarte con la pantalla medio vacía hace perder la referencia de
    // dónde está ese piso dentro de la fábrica.
    // Un punto tiene una altura; una cinta tiene un rango y basta con que lo
    // toque para seguir contando, porque es la que une las plantas.
    // Planta elegida. Las cintas no llevan planta (pueden cruzar varias), así
    // que a ellas solo les aplica la banda de altura.
    const df = g.getAttribute("data-floor");
    if (mapFloor !== null && df !== null && parseInt(df, 10) !== mapFloor) {
      g.classList.add("offband");
      return;
    }
    const dzone = g.getAttribute("data-zone");
    if (mapZone !== null && dzone !== null && parseInt(dzone, 10) !== mapZone) {
      g.classList.add("offband");
      return;
    }
    const za = g.getAttribute("data-z0");
    const zb = g.getAttribute("data-z1");
    const zc = g.getAttribute("data-z") || "0";
    const z0 = parseFloat(za ?? zc);
    const z1 = parseFloat(zb ?? zc);
    g.classList.toggle("offband", !(z1 >= lo - 0.5 && z0 <= hi + 0.5));
  });
}

// ---- Calculadora de producción ----
// Recetas del principio del juego (Satisfactory 1.x). out = unidades/min por máquina.
// Los ingredientes son rate/min por máquina. Lo que no tiene receta es materia prima.
interface Recipe {
  building: string;
  out: number;
  tier: number; // tier en el que se desbloquea (aprox.)
  inputs: { item: string; rate: number }[];
}
const MINER_MK1_NORMAL = 60; // /min en un nodo de pureza normal
const RECIPES: Record<string, Recipe> = {
  "Lingote de hierro": { building: "Fundición", out: 30, tier: 0, inputs: [{ item: "Mineral de hierro", rate: 30 }] },
  "Lingote de cobre": { building: "Fundición", out: 30, tier: 0, inputs: [{ item: "Mineral de cobre", rate: 30 }] },
  "Plancha de hierro": { building: "Constructora", out: 20, tier: 0, inputs: [{ item: "Lingote de hierro", rate: 30 }] },
  "Barra de hierro": { building: "Constructora", out: 15, tier: 0, inputs: [{ item: "Lingote de hierro", rate: 15 }] },
  Tornillos: { building: "Constructora", out: 40, tier: 0, inputs: [{ item: "Barra de hierro", rate: 10 }] },
  "Alambre": { building: "Constructora", out: 30, tier: 0, inputs: [{ item: "Lingote de cobre", rate: 15 }] },
  Cable: { building: "Constructora", out: 30, tier: 0, inputs: [{ item: "Alambre", rate: 60 }] },
  Hormigón: { building: "Constructora", out: 15, tier: 0, inputs: [{ item: "Caliza", rate: 45 }] },
  "Lámina de cobre": { building: "Constructora", out: 10, tier: 2, inputs: [{ item: "Lingote de cobre", rate: 20 }] },
  "Plancha de hierro reforzada": { building: "Ensambladora", out: 5, tier: 2, inputs: [{ item: "Plancha de hierro", rate: 30 }, { item: "Tornillos", rate: 60 }] },
  Rotor: { building: "Ensambladora", out: 4, tier: 2, inputs: [{ item: "Barra de hierro", rate: 20 }, { item: "Tornillos", rate: 100 }] },
  "Armazón modular": { building: "Ensambladora", out: 2, tier: 2, inputs: [{ item: "Plancha de hierro reforzada", rate: 3 }, { item: "Barra de hierro", rate: 12 }] },
  "Lingote de acero": { building: "Fundición (Foundry)", out: 45, tier: 3, inputs: [{ item: "Mineral de hierro", rate: 45 }, { item: "Carbón", rate: 45 }] },
  "Viga de acero": { building: "Constructora", out: 15, tier: 3, inputs: [{ item: "Lingote de acero", rate: 60 }] },
  "Tubería de acero": { building: "Constructora", out: 20, tier: 3, inputs: [{ item: "Lingote de acero", rate: 30 }] },
  "Viga industrial reforzada": { building: "Ensambladora", out: 6, tier: 4, inputs: [{ item: "Viga de acero", rate: 24 }, { item: "Hormigón", rate: 30 }] },
  "Armazón modular pesado": { building: "Fabricante", out: 2, tier: 4, inputs: [{ item: "Armazón modular", rate: 10 }, { item: "Tubería de acero", rate: 30 }, { item: "Viga industrial reforzada", rate: 10 }, { item: "Tornillos", rate: 200 }] },
  "Lingote de caterio": { building: "Fundición", out: 15, tier: 5, inputs: [{ item: "Mineral de caterium", rate: 45 }] },
  Turboalambre: { building: "Constructora", out: 60, tier: 5, inputs: [{ item: "Lingote de caterio", rate: 12 }] },
  Plástico: { building: "Refinería", out: 20, tier: 5, inputs: [{ item: "Petróleo crudo", rate: 30 }] },
  Caucho: { building: "Refinería", out: 20, tier: 5, inputs: [{ item: "Petróleo crudo", rate: 30 }] },
  "Circuito impreso": { building: "Ensambladora", out: 7.5, tier: 5, inputs: [{ item: "Lámina de cobre", rate: 15 }, { item: "Plástico", rate: 30 }] },
  Estátor: { building: "Ensambladora", out: 5, tier: 5, inputs: [{ item: "Tubería de acero", rate: 15 }, { item: "Alambre", rate: 40 }] },
  Motor: { building: "Ensambladora", out: 5, tier: 5, inputs: [{ item: "Rotor", rate: 10 }, { item: "Estátor", rate: 10 }] },
  Ordenador: { building: "Fabricante", out: 2.5, tier: 6, inputs: [{ item: "Circuito impreso", rate: 25 }, { item: "Cable", rate: 22.5 }, { item: "Plástico", rate: 45 }] },
};

// Calcula la demanda total por item (sumando todas las ramas de la cadena).
function computeProduction(item: string, rate: number) {
  const itemRate: Record<string, number> = {};
  const order: string[] = [];
  function accumulate(it: string, r: number) {
    if (!(it in itemRate)) order.push(it);
    itemRate[it] = (itemRate[it] || 0) + r;
    const rec = RECIPES[it];
    if (!rec) return;
    const machines = r / rec.out;
    for (const inp of rec.inputs) accumulate(inp.item, machines * inp.rate);
  }
  accumulate(item, rate);

  const steps: { item: string; rate: number; building: string; machines: number }[] = [];
  const buildings: Record<string, number> = {};
  const raw: Record<string, number> = {};
  for (const it of order) {
    const rec = RECIPES[it];
    const r = itemRate[it];
    if (!rec) {
      raw[it] = r;
      continue;
    }
    const machines = r / rec.out;
    steps.push({ item: it, rate: r, building: rec.building, machines });
    buildings[rec.building] = (buildings[rec.building] || 0) + machines;
  }
  return { steps, buildings, raw };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function renderCalc() {
  // Solo ofrecemos lo desbloqueado según el tier del mundo abierto.
  const all = Object.keys(RECIPES).sort();
  const available = all.filter((k) => RECIPES[k].tier <= currentTier);
  const hidden = all.length - available.length;
  const opts = available.map((k) => `<option value="${escapeAttr(k)}">${k}</option>`).join("");

  const hint =
    hidden > 0
      ? `<p class="muted">Mostrando solo lo desbloqueado en este mundo (Tier ${currentTier}). ${hidden} receta(s) de tiers superiores ocultas.</p>`
      : "";

  calcEl.innerHTML =
    `<h3 class="inv-title">${t("sec.calc")}</h3>` +
    hint +
    `<div class="calc-controls">` +
    `<span>${t("calc.want")}</span>` +
    `<input id="calc-rate" type="number" min="1" value="100" />` +
    `<span>/min de</span>` +
    `<select id="calc-item">${opts}</select>` +
    `<button id="calc-btn" type="button">Calcular</button>` +
    `</div>` +
    `<div id="calc-result" class="calc-result"></div>`;

  document.querySelector("#calc-btn")?.addEventListener("click", () => {
    const item = (document.querySelector("#calc-item") as HTMLSelectElement).value;
    const rate = parseFloat((document.querySelector("#calc-rate") as HTMLInputElement).value);
    if (item && rate > 0) renderCalcResult(item, rate);
  });
}

function renderCalcResult(item: string, rate: number) {
  const { steps, buildings, raw } = computeProduction(item, rate);
  const resultEl = document.querySelector("#calc-result") as HTMLElement;

  const buildingRows = Object.entries(buildings)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([b, m]) =>
        `<div class="calc-line"><span>${iconImg(b, 16)}${b}</span><span class="calc-num"><b>${Math.ceil(m)}</b> <span class="muted">(${fmt(m)})</span></span></div>`
    )
    .join("");

  const stepRows = steps
    .map(
      (s) =>
        `<div class="calc-line"><span>${iconImg(s.item, 16)}${s.item} · ${fmt(s.rate)}/min</span>` +
        `<span class="calc-num">${fmt(s.machines)} × ${s.building}</span></div>`
    )
    .join("");

  const rawRows = Object.entries(raw)
    .sort((a, b) => b[1] - a[1])
    .map(([r, rt]) => {
      const miners = Math.ceil(rt / MINER_MK1_NORMAL);
      return `<div class="calc-line"><span>${r}</span><span class="calc-num">${fmt(rt)}/min <span class="muted">(≈${miners} minero${miners === 1 ? "" : "s"} Mk1)</span></span></div>`;
    })
    .join("");

  resultEl.innerHTML =
    `<p class="calc-head">Para <b>${fmt(rate)}/min</b> de <b>${item}</b>:</p>` +
    `<h4 class="calc-sub">${t("calc.machines")}</h4>${buildingRows}` +
    `<h4 class="calc-sub">${t("calc.chain")}</h4>${stepRows}` +
    `<h4 class="calc-sub">${t("calc.raw")}</h4>${rawRows}` +
    `<p class="muted calc-note">${t("calc.note")}</p>`;
}

// Guarda la nota del mundo actualmente seleccionado.
async function saveNote() {
  if (!currentNoteKey) return;
  const text = noteText.value;
  try {
    await invoke("set_note", { key: currentNoteKey, text });
    notesCache[currentNoteKey] = text;
    noteStatus.textContent = t("notes.saved");
    noteStatus.className = "note-status ok";
  } catch (e) {
    noteStatus.textContent = String(e);
    noteStatus.className = "note-status err";
  }
}

async function refresh() {
  const folder = folderInput.value.trim();
  try {
    const saves = await invoke<SaveEntry[]>("list_saves", { folder });
    currentSaves = saves;

    // Cabeceras de todas las partidas: medio milisegundo cada una, asi que se
    // leen todas de golpe y tenemos compatibilidad y version real en la lista.
    savesMeta = {};
    const metas = await Promise.all(saves.map((s) => readSaveMeta(folder, s)));
    saves.forEach((s, i) => {
      const m = metas[i];
      if (m) savesMeta[s.name] = m;
    });
    newestSaveVersion = Math.max(0, ...Object.values(savesMeta).map((m) => m.saveVersion));

    currentWorlds = buildWorlds(saves);
    populateWorldSelect();
    render(currentWorlds[selectedWorld] || []);
    const numWorlds = Object.keys(currentWorlds).length;
    rememberFolder(folder);
    statusEl.className = "status ok";
    statusEl.textContent =
      t("worlds.status", { w: numWorlds, s: saves.length, time: new Date().toLocaleTimeString() });
  } catch (e) {
    tableBody.innerHTML = "";
    statusEl.className = "status err";
    statusEl.textContent = String(e);
    // Si la carpeta no vale, de poco sirve tenerla plegada: la abrimos para
    // que se pueda corregir sin ir a buscarla.
    const folderAcc = document.querySelector<HTMLDetailsElement>("#acc-settings");
    if (folderAcc) folderAcc.open = true;
  }
}

// Al elegir un mundo en el desplegable: mostramos sus guardados y abrimos el más reciente.
async function onWorldChange() {
  selectedWorld = worldSelect.value;
  const list = currentWorlds[selectedWorld] || [];
  render(list);
  if (list.length) {
    await inspect(list[0].name);
  }
}

// Importa todas las partidas actuales al histórico (siembra inicial con los autosaves).
async function importHistory() {
  const folder = folderInput.value.trim();
  const importStatus = document.querySelector("#import-status") as HTMLElement;
  const saves = currentSaves;
  let done = 0;
  let rich = 0;
  for (const s of saves) {
    importStatus.textContent = t("import.working", { i: ++done, n: saves.length });
    // Analizamos de verdad cada guardado, no solo lo fechamos: es la única
    // ocasión de rescatar las métricas de los autoguardados que el juego
    // acabará sobrescribiendo.
    let metrics: SnapshotMetrics | null = null;
    try {
      const inf = await invoke<BodyInfo>("inspect_body", { folder, name: s.name });
      const a = await analyzeWithParser(folder, s.name);
      let pIn = 0;
      let pGen = 0;
      for (const it of inf.inventory) {
        pIn += (POWER_MW[it.name] || 0) * it.count;
        pGen += (GEN_MW[it.name] || 0) * it.count;
      }
      metrics = buildMetrics(a, inf, computeDeficits(a.perItem, a.consumed), pIn, pGen, s.name);
      rich++;
    } catch (e) {
      // Partida vieja o parser no disponible: guardamos la foto básica igual.
      console.warn("Sin métricas para", s.name, e);
    }
    try {
      await invoke("record_snapshot", { folder, name: s.name, metrics });
    } catch (e) {
      console.error("Importar", s.name, e);
    }
  }
  importStatus.textContent = t("import.done", { n: saves.length, r: rich });
  // Si hay una partida abierta, refrescamos su gráfica.
  if (currentNoteKey) {
    try {
      const hist = await invoke<Snapshot[]>("get_history", { session: currentNoteKey });
      renderHistory(hist);
      renderEnergyHistory(hist);
    } catch (e) {
      console.error(e);
    }
  }
}

async function startWatching() {
  const folder = folderInput.value.trim();
  try {
    await invoke("start_watching", { folder });
  } catch (e) {
    statusEl.className = "status err";
    statusEl.textContent = String(e);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  folderInput = document.querySelector("#folder") as HTMLInputElement;
  statusEl = document.querySelector("#status") as HTMLElement;
  tableBody = document.querySelector("#saves-body") as HTMLElement;
  worldSelect = document.querySelector("#world-select") as HTMLSelectElement;
  detailTitle = document.querySelector("#detail-title") as HTMLElement;
  detailStatus = document.querySelector("#detail-status") as HTMLElement;
  detailGrid = document.querySelector("#detail-grid") as HTMLElement;
  resumeEl = document.querySelector("#resume") as HTMLElement;
  vitalsEl = document.querySelector("#vitals") as HTMLElement;
  inventoryEl = document.querySelector("#inventory") as HTMLElement;
  historyEl = document.querySelector("#history") as HTMLElement;
  energyEl = document.querySelector("#energy") as HTMLElement;
  planEl = document.querySelector("#plan") as HTMLElement;
  calcEl = document.querySelector("#calc") as HTMLElement;
  progressEl = document.querySelector("#progress") as HTMLElement;
  compatEl = document.querySelector("#compat") as HTMLElement;
  gameDataEl = document.querySelector("#gamedata") as HTMLElement;
  iconsEl = document.querySelector("#icons") as HTMLElement;
  backupsEl = document.querySelector("#backups") as HTMLElement;
  achievementsEl = document.querySelector("#achievements") as HTMLElement;
  alertsEl = document.querySelector("#alerts") as HTMLElement;
  milestoneEl = document.querySelector("#milestone") as HTMLElement;
  productionEl = document.querySelector("#production") as HTMLElement;
  balanceEl = document.querySelector("#balance") as HTMLElement;
  storedEl = document.querySelector("#stored") as HTMLElement;
  explorationEl = document.querySelector("#exploration") as HTMLElement;
  mapEl = document.querySelector("#map") as HTMLElement;
  noteText = document.querySelector("#note-text") as HTMLTextAreaElement;
  noteSave = document.querySelector("#note-save") as HTMLButtonElement;
  noteStatus = document.querySelector("#note-status") as HTMLElement;
  noteLabel = document.querySelector("#note-label") as HTMLElement;
  folderInput.value = await pickFolder();

  // Idioma: del recuerdo o del navegador. Los nombres del juego ya vienen en
  // el idioma pedido desde la documentación oficial, así que cambiar de idioma
  // es releer la partida, no traducir nada a mano.
  setLang(detectLang());
  applyStaticI18n();
  const markLang = () =>
    document.querySelectorAll<HTMLElement>(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === getLang());
    });
  markLang();
  document.querySelectorAll<HTMLButtonElement>(".lang-btn").forEach((b) => {
    b.addEventListener("click", async () => {
      const l = b.dataset.lang as Lang;
      if (l === getLang()) return;
      setLang(l);
      applyStaticI18n();
      markLang();
      renderCalc();
      // Repasamos la partida abierta: los nombres de piezas y edificios salen
      // del análisis, así que hay que rehacerlo para que cambien de idioma.
      const open = currentSaves.find((x) => x.name === openSaveName);
      if (open) await inspect(open.name);
    });
  });

  setupAccordions();

  // Version de la app en la chapa de la cabecera. Antes ponia la fase de
  // desarrollo, que no le dice nada a quien no haya programado esto.
  getVersion()
    .then((v) => {
      const el = document.querySelector("#app-version");
      if (el) el.textContent = `v${v}`;
    })
    .catch(() => {
      /* fuera de Tauri no hay version que mostrar */
    });

  document.querySelector("#refresh")?.addEventListener("click", () => {
    refresh();
    startWatching();
  });

  worldSelect.addEventListener("change", onWorldChange);
  document.querySelectorAll<HTMLElement>(".tab").forEach((t) => {
    t.addEventListener("click", () => showTab(t.dataset.tab as string));
  });
  renderCalc(); // la calculadora es independiente del mundo; se monta una vez
  document.querySelector("#import-history")?.addEventListener("click", importHistory);
  noteSave.addEventListener("click", saveNote);
  // Al escribir, marcamos que hay cambios sin guardar.
  noteText.addEventListener("input", () => {
    noteStatus.textContent = t("notes.unsaved");
    noteStatus.className = "note-status";
  });

  // Cargamos notas y planes guardados una vez al arrancar.
  try {
    notesCache = await invoke<Record<string, string>>("get_notes");
  } catch (e) {
    console.error("No se pudieron cargar las notas:", e);
  }
  try {
    plansCache = await invoke<Record<string, Record<string, number>>>("get_plans");
  } catch (e) {
    console.error("No se pudieron cargar los planes:", e);
  }

  // Cuando el juego guarda: re-escaneamos y apuntamos una foto de la partida más reciente.
  await listen("saves-changed", async () => {
    await refresh();
    const newest = currentSaves[0];
    if (!newest) return;
    const key = worldKey(newest);
    try {
      if (key === selectedWorld) {
        // El mundo abierto se acaba de guardar: re-inspeccionamos (refresca inventario y gráfica).
        await inspect(newest.name);
      } else {
        // Otro mundo: registramos la foto en silencio.
        await invoke("record_snapshot", {
          folder: folderInput.value.trim(),
          name: newest.name,
        });
      }
    } catch (e) {
      console.error("Auto-snapshot:", e);
    }
  });

  // Arranque automático: escaneamos, abrimos el mundo más reciente y empezamos a vigilar.
  if (!folderInput.value) {
    // Sin carpeta no hay nada que hacer, así que la pedimos con la caja ya
    // abierta en vez de dejar la app en blanco sin explicación.
    statusEl.className = "status err";
    statusEl.textContent =
      t("folder.notFound");
    const folderAcc = document.querySelector<HTMLDetailsElement>("#acc-settings");
    if (folderAcc) folderAcc.open = true;
    return;
  }

  await refresh();
  if (selectedWorld && currentWorlds[selectedWorld]?.length) {
    await inspect(currentWorlds[selectedWorld][0].name);
  }
  await startWatching();

  // Al final y sin bloquear: son 10 MB por idioma y solo se releen cuando el
  // juego se ha actualizado.
  initGameData().finally(() => initIcons());

  // Copia del día, si no la hay todavía. Va después de cargarlo todo para que
  // retrate el estado bueno, no uno a medio arrancar.
  invoke("auto_backup").catch((e) => console.error("Copia automática:", e));
  renderBackups();
});
