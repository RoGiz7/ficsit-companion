// Frontend (interfaz en TypeScript)
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Parser, SatisfactorySaveHeader, SaveReader } from "@etothepii/satisfactory-file-parser";
import {
  describeDiff,
  diffGameData,
  extractGameData,
  GAMEDATA_SCHEMA,
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
  "Iron Plate": "Placa de hierro",
  "Iron Rod": "Varilla de hierro",
  "Iron Screw": "Tornillo",
  Screw: "Tornillo",
  "Copper Ingot": "Lingote de cobre",
  Wire: "Hilo de cobre",
  Cable: "Cable",
  Cement: "Hormigón",
  Concrete: "Hormigón",
  "Iron Plate Reinforced": "Placa de hierro reforzada",
  Rotor: "Rotor",
  "Modular Frame": "Marco modular",
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
  "Caterium Ingot": "Lingote de caterium",
  Quickwire: "Quickwire",
  "Crude Oil": "Petróleo crudo",
  "Liquid Oil": "Petróleo crudo",
  Plastic: "Plástico",
  Rubber: "Caucho",
  "Polymer Resin": "Resina de polímero",
  "Heavy Oil Residue": "Residuo de aceite pesado",
  "Liquid Fuel": "Combustible líquido",
  Fuel: "Combustible",
  "Petroleum Coke": "Coque de petróleo",
  "Circuit Board": "Placa de circuito",
  Computer: "Ordenador",
  Motor: "Motor",
  Stator: "Estátor",
  "Ai Limiter": "Limitador de IA",
  "AI Limiter": "Limitador de IA",
  "Encased Industrial Beam": "Viga industrial revestida",
  "Modular Frame Heavy": "Marco modular pesado",
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
const trBuilding = (n: string) => BUILDING_ES[n] || n;
const trItem = (n: string) => ITEM_ES[n] || n;

// Coleccionables sin recoger (siguen en el mundo) → nombre legible.
const COLLECT_ES: Record<string, string> = {
  BP_Crystal_C: "Babas de energía (azul)",
  BP_Crystal_mk2_C: "Babas de energía (amarilla)",
  BP_Crystal_mk3_C: "Babas de energía (púrpura)",
  BP_WAT1_C: "Somersloops",
  BP_WAT2_C: "Esferas Mercer",
  BP_DropPod_C: "Cápsulas (discos duros)",
};

// El mundo (sesión) al que pertenece un guardado.
// ---- Datos oficiales del juego ----
// Se leen de la instalacion del usuario (su copia), nunca se distribuyen con
// la app. Solo se releen cuando el juego se actualiza, porque son 10 MB por
// idioma; el resto del tiempo vale el destilado cacheado.

function renderGameData(status: string, detail: string, busy = false) {
  if (!gameDataEl) return;
  gameDataEl.innerHTML =
    `<p class="gd-status">${escapeXml(status)}</p>` +
    (detail ? `<p class="muted gd-detail">${escapeXml(detail)}</p>` : "") +
    `<button id="gd-reload" type="button"${busy ? " disabled" : ""}>Releer datos del juego</button>`;
  document.querySelector("#gd-reload")?.addEventListener("click", () => initGameData(true));
}

async function initGameData(force = false) {
  if (!gameDataEl) return;
  try {
    const cached = await invoke<GameData | null>("get_game_data");
    const folders = await invoke<DocsFolder[]>("detect_docs_folders");

    if (!folders.length) {
      gameData = cached && cached.schema === GAMEDATA_SCHEMA ? cached : null;
      renderGameData(
        gameData ? "Usando datos guardados del juego." : "No encuentro la instalación del juego.",
        gameData
          ? `${Object.keys(gameData.recipes).length} recetas · leídos el ${new Date(gameData.extractedAt).toLocaleDateString()}`
          : "Sin los datos oficiales uso mis propias tablas, que van por detrás de los parches."
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
        "Datos del juego al día.",
        `${Object.keys(cached!.recipes).length} recetas · ${Object.keys(cached!.schematics).length} hitos · ${cached!.langs.join(", ")}`
      );
      return;
    }

    renderGameData("Leyendo la documentación del juego…", `${docs.path}`, true);
    const fresh = await extractGameData(docs.path, docs.languages);
    fresh.docsNewestMs = docs.newest_ms;

    const diff = diffGameData(cached && cached.schema === GAMEDATA_SCHEMA ? cached : null, fresh);
    await invoke("set_game_data", { data: fresh });
    gameData = fresh;

    const changed =
      diff && (diff.addedRecipes.length || diff.changedRates.length || diff.removedRecipes.length);
    renderGameData(
      changed ? "El juego ha cambiado desde la última lectura." : "Datos del juego actualizados.",
      describeDiff(diff, fresh, "es")
    );
    // Si algo cambió, que no pase desapercibido aunque la sección esté plegada.
    if (changed) {
      const acc = document.querySelector<HTMLDetailsElement>("#acc-gamedata");
      if (acc) acc.open = true;
    }
  } catch (e) {
    console.error("Datos del juego:", e);
    renderGameData("No se pudieron leer los datos del juego.", String(e));
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
      `<b>Partida con ${meta.mods.length} mods.</b> El juego no la abrirá sin ellos instalados. ` +
        `<span class="muted">${escapeXml(list)}</span>`
    );
  }
  if (meta && newestSaveVersion && meta.saveVersion < newestSaveVersion) {
    saveLines.push(
      `Guardada en formato <b>v${meta.saveVersion}</b>, por detrás de tus partidas más nuevas (v${newestSaveVersion}).`
    );
  }
  if (meta && meta.creative) {
    saveLines.push(`Modo creativo activado: los datos no son comparables con una partida normal.`);
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
        `<b>${modTotal} de ${machineCount} máquinas</b> fabrican recetas de mods. Lo que producen ` +
          `solo lo sabe el propio mod, así que no entran en los cálculos: ${src}.`
      );
    }
    if (base > 0) {
      const pct = Math.round((base / machineCount) * 100);
      appLines.push(
        `<b>${base} de ${machineCount} máquinas (${pct}%)</b> usan recetas del juego base que todavía ` +
          `no tengo en mis tablas, así que su producción y su consumo no entran en los cálculos. ` +
          `Esto es una limitación mía, no un problema de tu partida.`
      );
    }
  }

  const card = (cls: string, title: string, lines: string[]) =>
    `<div class="compat-card ${cls}"><h3 class="compat-title">${title}</h3>` +
    lines.map((l) => `<p>${l}</p>`).join("") +
    `</div>`;

  let html = "";
  if (saveLines.length) html += card("", "⚠ Ojo con los datos de esta partida", saveLines);
  if (appLines.length) html += card("info", "ℹ Cobertura de recetas", appLines);
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
      return `<option value="${w}"${sel}>${w} (${n} guardado${n === 1 ? "" : "s"})</option>`;
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

    const tag = i === 0 ? ' <span class="badge">más reciente</span>' : "";
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

  detailTitle.textContent = name;

  // Notas: se cargan al instante desde la caché, sin esperar a la descompresión.
  noteText.value = notesCache[key] || "";
  noteLabel.textContent = `Notas del mundo "${key}"`;
  noteStatus.textContent = "";

  compatEl.innerHTML = "";
  detailStatus.textContent = "Leyendo el interior de la partida…";
  detailStatus.className = "detail-status";
  detailGrid.innerHTML = "";
  inventoryEl.innerHTML = "";

  try {
    const info = await invoke<BodyInfo>("inspect_body", { folder, name });
    detailStatus.textContent = "";
    const mb = (info.uncompressed_bytes / 1024 / 1024).toFixed(2);
    detailGrid.innerHTML =
      cell("Construcciones", String(info.total_buildings)) +
      cell("Tipos distintos", String(info.type_count)) +
      cell("Versión del juego", gameVersionOf(name, info.game_version)) +
      cell("Datos descomprimidos", `${mb} MB`);
    renderInventory(info.inventory);

    // Inventario del mundo (nombre ES → cantidad) para el planificador; consumo con nombres originales.
    currentInventory = {};
    currentPowerMW = 0;
    currentGenMW = 0;
    for (const it of info.inventory) {
      currentInventory[trBuilding(it.name)] = it.count;
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
      renderProductionView(
        a.perItem,
        a.machineCount,
        a.overclocked,
        "Datos exactos del parser completo (incluye overclock real)."
      );
      renderBottlenecks(a.perItem, a.consumed);
      renderStored(a.stored);
      renderExploration(a.collect);
      lastPoints = a.points;
      lastBelts = a.belts;
      mapLevels = a.levels;
      renderMap(a.points, a.belts);

      // Centro de mando: signos vitales + "Retoma aquí".
      const deficits = computeDeficits(a.perItem, a.consumed);
      renderVitals(currentPowerMW, currentGenMW, deficits.length, a.points, a.stored);
      renderCompat(savesMeta[name], a.machineCount, a.unknownRecipes, a.unknownBySource);
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
        "Estimación de respaldo (el parser completo no está disponible)."
      );
      renderBottlenecks({}, {});
      renderStored(null);
      renderExploration({});
      lastPoints = [];
      lastBelts = [];
      mapLevels = [];
      renderMap([], []);
      renderVitals(currentPowerMW, currentGenMW, 0, [], {});
      renderCompat(savesMeta[name], 0, 0, {});
      renderResume(currentNoteKey, [], notesCache[currentNoteKey] || "", 0, info.progression);
    }

    // Histórico: registramos esta foto (si es nueva) y dibujamos la evolución del mundo.
    try {
      await invoke("record_snapshot", { folder, name, metrics: snapMetrics });
      const hist = await invoke<Snapshot[]>("get_history", { session: key });
      renderHistory(hist);
    } catch (e) {
      console.error("Histórico:", e);
    }
  } catch (e) {
    detailStatus.textContent = String(e);
    detailStatus.className = "detail-status err";
  }
}

// Dibuja una gráfica SVG simple de construcciones totales a lo largo del tiempo.
function renderHistory(snaps: Snapshot[]) {
  if (snaps.length < 2) {
    historyEl.innerHTML =
      `<h3 class="inv-title">Evolución</h3>` +
      `<p class="muted">Hace falta al menos 2 guardados de este mundo para ver la evolución. ` +
      `Importa tus partidas o sigue jugando: la app irá apuntando una foto en cada guardado.</p>`;
    return;
  }

  const W = 600,
    H = 200,
    padL = 44,
    padR = 14,
    padT = 14,
    padB = 28;
  const xs = snaps.map((s) => s.ts_ms);
  const ys = snaps.map((s) => s.total_buildings);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  // Eje Y ajustado al rango de los datos (no desde 0), para que se vean
  // bien los cambios aunque sean pequeños respecto al total.
  const dataMin = Math.min(...ys);
  const dataMax = Math.max(...ys);
  let minY: number;
  let maxY: number;
  if (dataMin === dataMax) {
    minY = Math.max(0, dataMin - 1);
    maxY = dataMax + 1;
  } else {
    const pad = (dataMax - dataMin) * 0.15;
    minY = Math.max(0, dataMin - pad);
    maxY = dataMax + pad;
  }
  const px = (x: number) =>
    padL + ((x - minX) / (maxX - minX || 1)) * (W - padL - padR);
  const py = (y: number) =>
    H - padB - ((y - minY) / (maxY - minY || 1)) * (H - padT - padB);

  const ptArr = snaps.map((s) => [px(s.ts_ms), py(s.total_buildings)] as [number, number]);
  const pts = ptArr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Relleno degradado bajo la línea (área).
  const baseY = H - padB;
  const area =
    `M ${ptArr[0][0].toFixed(1)} ${baseY} ` +
    ptArr.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") +
    ` L ${ptArr[ptArr.length - 1][0].toFixed(1)} ${baseY} Z`;

  // Rejilla horizontal (3 líneas) + etiquetas Y.
  let grid = "";
  const gN = 3;
  for (let i = 0; i <= gN; i++) {
    const val = minY + ((maxY - minY) * i) / gN;
    const gy = py(val).toFixed(1);
    grid +=
      `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#2a2f3a" stroke-width="1"/>` +
      `<text x="${padL - 6}" y="${(+gy + 3).toFixed(1)}" fill="#6f7585" font-size="10" text-anchor="end">${Math.round(val)}</text>`;
  }

  const first = new Date(minX).toLocaleDateString();
  const last = new Date(maxX).toLocaleDateString();
  const dots = ptArr
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="#ffd9a6" stroke="#ff9e3d" stroke-width="1"/>`)
    .join("");

  const growth = ys[ys.length - 1] - ys[0];
  const sign = growth >= 0 ? "+" : "";
  historyEl.innerHTML =
    `<h3 class="inv-title">Evolución · ${snaps.length} guardados · ${sign}${growth} construcciones</h3>` +
    `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="xMidYMid meet">` +
    `<defs><linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#ff9e3d" stop-opacity="0.35"/>` +
    `<stop offset="100%" stop-color="#ff9e3d" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    grid +
    `<path d="${area}" fill="url(#histGrad)"/>` +
    `<polyline fill="none" stroke="#ff9e3d" stroke-width="4" stroke-opacity="0.18" points="${pts}"/>` +
    `<polyline fill="none" stroke="#ff9e3d" stroke-width="2" points="${pts}"/>` +
    dots +
    `<text x="${W - padR}" y="${H - 8}" fill="#6f7585" font-size="10" text-anchor="end">${last}</text>` +
    `<text x="${padL}" y="${H - 8}" fill="#6f7585" font-size="10">${first}</text>` +
    `</svg>`;
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
        `<span class="inv-name">${trBuilding(it.name)}</span>` +
        `<span class="inv-bar"><span class="inv-fill" style="width:${pct}%"></span></span>` +
        `<span class="inv-count">${it.count}</span>` +
        `</div>`
      );
    })
    .join("");
  inventoryEl.innerHTML = `<h3 class="inv-title">Inventario de construcciones</h3>${rows}`;
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
  stored: Record<string, number>
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
    `<h3 class="inv-title">Signos vitales</h3>` +
    `<div class="detail-grid">` +
    cellColor("Salud de la fábrica", `${score}/100`, sColor) +
    cell("Consumo", `≈ ${fmt(consumption)} MW`) +
    cell("Generación", generation > 0 ? `≈ ${fmt(generation)} MW` : "—") +
    cellColor("Margen de energía", generation > 0 ? `${margin >= 0 ? "+" : ""}${fmt(margin)} MW` : "—", generation > 0 ? mColor : "#8b93a3") +
    cell("Tamaño de la fábrica", size) +
    cell("Piezas almacenadas", storedTotal.toLocaleString()) +
    `</div>` +
    `<p class="muted">Energía estimada por máquinas a 100% (consumo) y generadores (generación). La salud combina cuellos de botella y margen eléctrico.</p>`;
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
      `Desde tu guardado anterior${days > 0 ? ` (hace ${days} día${days === 1 ? "" : "s"})` : ""}: ` +
        `<b>${dTotal >= 0 ? "+" : ""}${dTotal}</b> construcciones${top ? ` · ${top}` : ""}.`
    );
  } else {
    lines.push(`Aún no hay histórico para comparar. Importa tus partidas (pestaña Guardados) o sigue jugando.`);
  }

  if (note && note.trim()) {
    const n = note.trim();
    lines.push(`📝 Tu nota: "${n.slice(0, 160)}${n.length > 160 ? "…" : ""}"`);
  }
  lines.push(
    deficitCount > 0
      ? `⚠️ ${deficitCount} cuello(s) de botella detectado(s) — revisa la pestaña Producción.`
      : `✅ Producción equilibrada.`
  );
  lines.push(
    `Vas por <b>Tier ${prog.current_tier}</b>` +
      (prog.current_tier > 0 ? ` · siguiente objetivo: Tier ${prog.current_tier + 1}` : "") +
      ` · ${prog.milestones.length} hitos · ${prog.research_count} investigaciones.`
  );

  resumeEl.innerHTML =
    `<div class="resume-card"><h3 class="resume-title">↩ Retoma aquí — ${world}</h3>` +
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
    `<h3 class="inv-title">Progreso de la partida</h3>` +
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
      const status = done ? "✓ completado" : `faltan ${missing}`;
      const safe = escapeAttr(name);
      return (
        `<div class="goal-row">` +
        `<span class="goal-name">${name}</span>` +
        `<span class="goal-bar"><span class="goal-fill ${done ? "done" : ""}" style="width:${pct}%"></span></span>` +
        `<span class="goal-count">${built}/${target}</span>` +
        `<span class="goal-status ${done ? "ok" : ""}">${status}</span>` +
        `<button class="goal-del" data-name="${safe}" title="Quitar objetivo">✕</button>` +
        `</div>`
      );
    })
    .join("");

  const datalist = Object.keys(currentInventory)
    .map((n) => `<option value="${escapeAttr(n)}"></option>`)
    .join("");

  planEl.innerHTML =
    `<h3 class="inv-title">Plan de mejoras</h3>` +
    (goalRows || `<p class="muted">Aún no hay objetivos. Añade uno abajo para empezar a planificar.</p>`) +
    `<div class="goal-add">` +
    `<input id="goal-name" list="goal-names" placeholder="Tipo (ej: Constructor Mk1)" />` +
    `<datalist id="goal-names">${datalist}</datalist>` +
    `<input id="goal-target" type="number" min="1" placeholder="Cantidad" />` +
    `<button id="goal-add-btn" type="button">Añadir objetivo</button>` +
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
  Recipe_IngotCaterium: { item: "Lingote de caterium", rate: 15 },
  Recipe_IronRod: { item: "Varilla de hierro", rate: 15 },
  Recipe_IronPlate: { item: "Placa de hierro", rate: 20 },
  Recipe_Screw: { item: "Tornillo", rate: 40 },
  Recipe_Wire: { item: "Hilo de cobre", rate: 30 },
  Recipe_Cable: { item: "Cable", rate: 30 },
  Recipe_Concrete: { item: "Hormigón", rate: 15 },
  Recipe_CopperSheet: { item: "Lámina de cobre", rate: 10 },
  Recipe_IronPlateReinforced: { item: "Placa de hierro reforzada", rate: 5 },
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
    item: "Placa inteligente",
    rate: 2,
    inputs: [
      { item: "Placa de hierro reforzada", rate: 2 },
      { item: "Rotor", rate: 2 },
    ],
  },
  Recipe_ModularFrame: { item: "Marco modular", rate: 2 },
  Recipe_SteelBeam: { item: "Viga de acero", rate: 15 },
  Recipe_SteelPipe: { item: "Tubería de acero", rate: 20 },
  Recipe_QuartzCrystal: { item: "Cristal de cuarzo", rate: 22.5 },
  Recipe_Silica: { item: "Sílice", rate: 37.5 },
  Recipe_Quickwire: { item: "Quickwire", rate: 60 },
  Recipe_Plastic: { item: "Plástico", rate: 20 },
  Recipe_Rubber: { item: "Caucho", rate: 20 },
  Recipe_LiquidFuel: { item: "Combustible", rate: 40 },
  Recipe_PetroleumCoke: { item: "Coque de petróleo", rate: 120 },
  Recipe_CircuitBoard: { item: "Placa de circuito", rate: 7.5 },
  Recipe_Stator: { item: "Estátor", rate: 5 },
  Recipe_Motor: { item: "Motor", rate: 5 },
  Recipe_Computer: { item: "Ordenador", rate: 2.5 },
  Recipe_AILimiter: { item: "Limitador de IA", rate: 5 },
  Recipe_EncasedIndustrialBeam: { item: "Viga industrial revestida", rate: 6 },
  Recipe_ModularFrameHeavy: { item: "Marco modular pesado", rate: 2 },
  Recipe_Alclad: { item: "Lámina de alclad", rate: 30 },
  Recipe_AluminumIngot: { item: "Lingote de aluminio", rate: 30 },
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
        `<div class="inv-row"><span class="inv-name">${item}</span>` +
        `<span class="inv-bar"><span class="inv-fill" style="width:${pct}%"></span></span>` +
        `<span class="inv-count">${fmt(rate)}/min</span></div>`
      );
    })
    .join("");

  const ocTxt = overclocked > 0 ? cell("Con overclock", String(overclocked)) : "";

  productionEl.innerHTML =
    `<h3 class="inv-title">Producción actual (máquinas activas)</h3>` +
    `<div class="detail-grid" style="margin-bottom:12px">` +
    cell("Máquinas con receta", String(machineCount)) +
    cell("Consumo estimado", `≈ ${fmt(currentPowerMW)} MW`) +
    ocTxt +
    `</div>` +
    (itemRows || `<p class="muted">No se detectaron máquinas con receta asignada.</p>`) +
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
        `<div class="inv-row"><span class="inv-name">${trItem(item)}</span>` +
        `<span class="inv-bar"><span class="inv-fill" style="width:${pct}%"></span></span>` +
        `<span class="inv-count">${n}</span></div>`
      );
    })
    .join("");
  storedEl.innerHTML =
    `<h3 class="inv-title">Materiales almacenados</h3>${rows}` +
    `<p class="muted">Suma de todos los inventarios del mundo (almacenes, máquinas, depósito, jugador).</p>`;
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
async function analyzeWithParser(folder: string, name: string) {
  const bytes = await invoke<ArrayBuffer>("read_save_bytes", { folder, name });
  const save: any = Parser.ParseSave(name, bytes);
  const levels = save.levels || {};
  const lvlArr = Array.isArray(levels) ? levels : Object.values(levels);

  const perItem: Record<string, number> = {};
  const consumed: Record<string, number> = {};
  const stored: Record<string, number> = {};
  const points: { x: number; y: number; z: number; cat: string; name: string; detail: string; item: string }[] = [];
  const belts: { pts: [number, number][]; z: number }[] = []; // cinta = polilínea [x,y] + altura media
  const collect: Record<string, number> = {};
  // Lo que no sabemos interpretar. El save se lee entero, pero nuestras tablas
  // de recetas solo conocen el juego base: una maquina de un mod fabrica algo
  // que no esta en RECIPE_OUTPUT. En vez de ignorarlo en silencio, lo contamos
  // y decimos de donde viene.
  const unknownBySource: Record<string, number> = {};
  let unknownRecipes = 0;
  let machineCount = 0;
  let overclocked = 0;

  for (const lvl of lvlArr as any[]) {
    const objs = (lvl && lvl.objects) || [];
    for (const o of objs) {
      // Coleccionables sin recoger (siguen presentes en el mundo).
      const cleaf = ((o.typePath || "").split("/").pop() || "").split(".").pop() || "";
      if (COLLECT_ES[cleaf]) collect[cleaf] = (collect[cleaf] || 0) + 1;

      // Plano 2D: cintas/tuberías como líneas (su trazado), resto como puntos.
      if (o.transform && o.transform.translation && o.typePath && o.typePath.includes("/Buildable/")) {
        const t = o.transform.translation;
        const r = o.transform.rotation || { x: 0, y: 0, z: 0, w: 1 };
        const spline = o.properties && o.properties.mSplineData && o.properties.mSplineData.values;
        if (spline && spline.length) {
          const poly: [number, number][] = [];
          let zsum = 0;
          for (const sp of spline) {
            const loc = sp.properties && sp.properties.Location && sp.properties.Location.value;
            if (!loc) continue;
            const w = qrot(r, loc);
            poly.push([t.x + w.x, t.y + w.y]);
            zsum += t.z + w.z;
          }
          if (poly.length >= 2) belts.push({ pts: poly, z: zsum / poly.length });
        } else {
          const leaf = (o.typePath.split("/").pop() || "").split(".")[0];
          // ¿Qué fabrica? (solo máquinas con receta) para el tooltip y el resaltado.
          let detail = "";
          let prodItem = "";
          const rec2 = o.properties && o.properties.mCurrentRecipe;
          if (rec2 && rec2.value && rec2.value.pathName) {
            const rl = (rec2.value.pathName.split("/").pop() || "").split(".")[0];
            const out = RECIPE_OUTPUT[rl];
            if (out) {
              detail = ` · fabrica ${out.item}`;
              prodItem = out.item;
            }
          }
          points.push({
            x: t.x,
            y: t.y,
            z: t.z,
            cat: categoryOf(o.typePath),
            name: trBuilding(prettyBuild(leaf)),
            detail,
            item: prodItem,
          });
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
        const out = RECIPE_OUTPUT[leaf];
        if (out) {
          perItem[out.item] = (perItem[out.item] || 0) + out.rate * oc;
          // Consumo: ingredientes de esa receta (si la conocemos en la calculadora).
          // Ingredientes de ESA receta si los conocemos; si no, la receta
          // única que la calculadora guarda para esa pieza.
          const crec = RECIPES[out.item];
          const inputs = out.inputs || (crec ? crec.inputs : null);
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
          }
        }
      }
    }
  }
  // Niveles de suelo: alturas donde se CONCENTRAN las máquinas (producción,
  // extracción, generadores, almacenes). Ellas apoyan en el suelo real, tanto
  // sobre cimientos como sobre terreno, y son lo que pintamos en el mapa.
  // Método: histograma de Z en bins de 1 m → un nivel = pico con ≥2 máquinas;
  // picos contiguos (≤2 m) se funden en uno (media ponderada). Así las rampas,
  // postes o máquinas sueltas en una ladera no generan pisos falsos.
  const anchors = points.filter((p) => p.cat !== "other").map((p) => p.z);
  const zSrc = anchors.length >= 3 ? anchors : points.map((p) => p.z);
  const zBins = new Map<number, number>();
  for (const z of zSrc) {
    const k = Math.round(z / 100) * 100;
    zBins.set(k, (zBins.get(k) || 0) + 1);
  }
  const zPeaks = [...zBins.entries()].filter(([, c]) => c >= 2).sort((a, b) => a[0] - b[0]);
  const floorLevels: number[] = [];
  let accZ = 0, accN = 0, lastPeak = NaN;
  const flushLevel = () => {
    if (accN) floorLevels.push(accZ / accN);
    accZ = 0;
    accN = 0;
  };
  for (const [z, c] of zPeaks) {
    if (!isNaN(lastPeak) && z - lastPeak > 200) flushLevel();
    accZ += z * c;
    accN += c;
    lastPeak = z;
  }
  flushLevel();

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
  };
}

// Calcula los déficits (piezas fabricables que se consumen más de lo que se producen).
function computeDeficits(produced: Record<string, number>, consumed: Record<string, number>) {
  const deficits: { item: string; prod: number; cons: number; deficit: number }[] = [];
  for (const item of Object.keys(consumed)) {
    if (!RECIPES[item]) continue; // solo piezas fabricables (evita ruido de materias primas)
    const net = (produced[item] || 0) - consumed[item];
    if (net < -0.01) deficits.push({ item, prod: produced[item] || 0, cons: consumed[item], deficit: -net });
  }
  deficits.sort((a, b) => b.deficit - a.deficit);
  return deficits;
}

// Detector de cuellos de botella: piezas que se consumen más rápido de lo que se producen.
function renderBottlenecks(produced: Record<string, number>, consumed: Record<string, number>) {
  const deficits = computeDeficits(produced, consumed);

  if (!deficits.length) {
    balanceEl.innerHTML =
      `<h3 class="inv-title">Cuellos de botella</h3>` +
      `<p class="muted">Producción equilibrada: ninguna pieza fabricada se consume más rápido de lo que se produce. 🎉</p>`;
    return;
  }

  const rows = deficits
    .map((d) => {
      const rec = RECIPES[d.item];
      const n = Math.ceil(d.deficit / rec.out);
      return (
        `<div class="bn-row">` +
        `<span class="bn-item">${d.item}</span>` +
        `<span class="bn-bal">produce ${fmt(d.prod)} · consume ${fmt(d.cons)}/min</span>` +
        `<span class="bn-def">−${fmt(d.deficit)}/min</span>` +
        `<span class="bn-fix">+${n} ${rec.building}</span>` +
        `<button class="bn-map" data-item="${escapeAttr(d.item)}" type="button">📍 mapa</button>` +
        `</div>`
      );
    })
    .join("");

  balanceEl.innerHTML =
    `<h3 class="inv-title">Cuellos de botella · ${deficits.length}</h3>` +
    `<p class="muted">Piezas que se consumen más rápido de lo que se fabrican (según las recetas activas). Sugerencia de máquinas a añadir:</p>` +
    rows;

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
  const cells = order
    .filter((k) => collect[k])
    .map((k) => cell(COLLECT_ES[k], String(collect[k])))
    .join("");
  explorationEl.innerHTML =
    `<h3 class="inv-title">Exploración · por recoger</h3>` +
    `<div class="detail-grid">${cells}</div>` +
    `<p class="muted">Coleccionables y cápsulas que aún siguen en el mundo (sin recoger).</p>`;
}

// Rota un vector local por un cuaternión (para llevar el trazado de la cinta al mundo).
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
const CATS: Record<string, { color: string; label: string }> = {
  prod: { color: "#e8772e", label: "Producción" },
  extr: { color: "#3aa0ff", label: "Extracción" },
  power: { color: "#f4c531", label: "Generadores" },
  store: { color: "#4fc97a", label: "Almacenamiento" },
};

// Dibuja una forma distinta por categoría, centrada en (cx,cy).
function mapShape(cat: string, cx: number, cy: number, r: number, title: string): string {
  const color = (CATS[cat] || {}).color || "#aab0bd";
  const t = `<title>${title}</title>`;
  const a = `fill="${color}" stroke="#222" stroke-width="0.4"`;
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
function renderMap(
  points: { x: number; y: number; z: number; cat: string; name: string; detail: string; item: string }[],
  belts: { pts: [number, number][]; z: number }[]
) {
  if (!points.length && !belts.length) {
    mapEl.innerHTML = `<p class="muted">No hay posiciones para dibujar (¿parser no disponible?).</p>`;
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

  const W = 720, H = 620, pad = 14;
  const s = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1));
  const px = (x: number) => pad + (x - minX) * s;
  const py = (y: number) => pad + (maxY - y) * s; // Y invertida (norte arriba)

  const hi = highlightItem; // pieza a resaltar (cuello de botella)
  const beltOp = hi ? 0.12 : 0.7;
  const otherOp = hi ? 0.18 : 1;

  // Cintas (líneas). Cada una en su grupo con categoría y altura para los filtros.
  let lines = "";
  for (const b of belts) {
    const pts = b.pts.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(" ");
    lines += `<g data-cat="belt" data-z="${Math.round(b.z)}"><polyline points="${pts}" fill="none" stroke="#8a93a3" stroke-width="1" stroke-opacity="${beltOp}"/></g>`;
  }
  // Edificios: puntito gris para "otros", forma+color por categoría para el resto.
  let others = "";
  let shapes = "";
  let hiCount = 0;
  const counts: Record<string, number> = {};
  for (const p of points) {
    const cx = px(p.x).toFixed(1), cy = py(p.y).toFixed(1);
    const zAttr = `data-z="${Math.round(p.z)}"`;
    if (p.cat === "other") {
      others += `<g data-cat="other" ${zAttr}><circle cx="${cx}" cy="${cy}" r="1.1" fill="#aab0bd" fill-opacity="${otherOp}"/></g>`;
    } else {
      counts[p.cat] = (counts[p.cat] || 0) + 1;
      const match = hi !== null && p.item === hi;
      if (match) hiCount++;
      const op = hi ? (match ? 1 : 0.18) : 1;
      let s = mapShape(p.cat, +cx, +cy, 3.4, escapeXml(p.name + p.detail));
      if (match) {
        s = `<circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="#ff3b3b" stroke-width="1.8" class="map-hi"/>` + s;
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
    ["prod", "Producción"],
    ["extr", "Extracción"],
    ["power", "Generadores"],
    ["store", "Almacén"],
    ["belt", "Cintas"],
    ["other", "Resto"],
  ];
  const filters = filterDefs
    .map(
      ([k, lbl]) =>
        `<label class="map-filter"><input type="checkbox" data-layer="${k}" checked /> ${lbl}</label>`
    )
    .join("");

  const banner = hi
    ? `<div class="map-banner">📍 Cuello de botella: <b>${escapeXml(hi)}</b> · ${hiCount} máquina(s) marcada(s) en rojo` +
      `<button id="clear-hi" type="button">limpiar</button></div>`
    : "";

  // Filtro de altura (pisos): dos deslizadores para aislar una banda vertical.
  const zStep = Math.max(1, Math.round((maxZ - minZ) / 100));
  const heightFilter =
    `<div class="map-height">` +
    `<span class="muted">Altura (pisos):</span>` +
    `<input type="range" id="z-min" min="${Math.floor(minZ)}" max="${Math.ceil(maxZ)}" step="${zStep}" value="${Math.floor(minZ)}" />` +
    `<input type="range" id="z-max" min="${Math.floor(minZ)}" max="${Math.ceil(maxZ)}" step="${zStep}" value="${Math.ceil(maxZ)}" />` +
    `<span id="z-label" class="muted"></span>` +
    `</div>`;

  // Chips de niveles construidos (suelos): saltan a la banda de ese piso.
  let levelChips = "";
  if (mapLevels.length >= 1) {
    const base = mapLevels[0];
    const chips = mapLevels
      .map((lz, i) => {
        // Banda del piso: del punto medio con el nivel inferior al punto medio
        // con el superior (los extremos absorben todo lo que quede por debajo/encima).
        const prev = mapLevels[i - 1];
        const next = mapLevels[i + 1];
        const lo = prev === undefined ? Math.floor(minZ) - 1 : (prev + lz) / 2;
        const hi = next === undefined ? Math.ceil(maxZ) + 1 : (lz + next) / 2;
        const relM = Math.round((lz - base) / 100);
        const lbl = i === 0 ? "Suelo" : `+${relM} m`;
        return `<button class="lvl-chip" data-lo="${Math.round(lo)}" data-hi="${Math.round(hi)}">${lbl}</button>`;
      })
      .join("");
    levelChips =
      `<div class="map-levels"><span class="muted">Niveles construidos (${mapLevels.length}):</span> ` +
      `<button class="lvl-chip" data-lo="all">Todos</button>${chips}</div>`;
  }

  mapEl.innerHTML =
    `<h3 class="inv-title">Plano 2D · ${points.length} construcciones · ${belts.length} cintas</h3>` +
    banner +
    `<div class="map-filters">${filters}<span class="muted map-hint">rueda = zoom · arrastra = mover</span></div>` +
    levelChips +
    heightFilter +
    `<svg viewBox="0 0 ${W} ${H}" class="map2d" id="map-svg">` +
    `<g id="map-vp">${lines}${others}${shapes}</g></svg>` +
    `<div class="map-legend">${legend}<span class="leg-item"><span style="color:#8a93a3">─</span> cintas</span>` +
    `<span class="leg-item"><span style="color:#aab0bd">·</span> resto</span></div>` +
    `<p class="muted">Vista cenital, norte arriba. Pasa el ratón por una pieza para ver qué es y qué fabrica. Usa "Altura" para aislar pisos.</p>`;

  setupMapInteraction();
}

// Estado del mapa para resaltar cuellos de botella.
let lastPoints: { x: number; y: number; z: number; cat: string; name: string; detail: string; item: string }[] = [];
let lastBelts: { pts: [number, number][]; z: number }[] = [];
let mapLevels: number[] = []; // alturas de los niveles construidos del mundo abierto
let highlightItem: string | null = null;

// Salta al mapa y resalta las máquinas que fabrican `item`.
function highlightOnMap(item: string) {
  highlightItem = item;
  showTab("mapa");
  renderMap(lastPoints, lastBelts);
}

// Zoom (rueda), arrastre (ratón) y filtros del mapa.
let mapView = { scale: 1, tx: 0, ty: 0 };
function setupMapInteraction() {
  const clearBtn = document.querySelector("#clear-hi");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      highlightItem = null;
      renderMap(lastPoints, lastBelts);
    });
  }

  const svg = document.querySelector("#map-svg") as SVGSVGElement | null;
  const vp = document.querySelector("#map-vp") as SVGGElement | null;
  if (!svg || !vp) return;
  mapView = { scale: 1, tx: 0, ty: 0 };
  const apply = () => vp.setAttribute("transform", `translate(${mapView.tx} ${mapView.ty}) scale(${mapView.scale})`);

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
  // Chips de niveles: ajustan la banda de altura al piso elegido.
  mapEl.querySelectorAll<HTMLButtonElement>(".lvl-chip").forEach((b) => {
    b.addEventListener("click", () => {
      const zMinEl = document.querySelector("#z-min") as HTMLInputElement | null;
      const zMaxEl = document.querySelector("#z-max") as HTMLInputElement | null;
      if (!zMinEl || !zMaxEl) return;
      if (b.dataset.lo === "all") {
        zMinEl.value = zMinEl.min;
        zMaxEl.value = zMaxEl.max;
      } else {
        zMinEl.value = b.dataset.lo!;
        zMaxEl.value = b.dataset.hi!;
      }
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
    if (lbl) lbl.textContent = `${Math.round(lo)} – ${Math.round(hi)}`;
  }
  const catOn: Record<string, boolean> = {};
  document.querySelectorAll<HTMLInputElement>(".map-filter input").forEach((cb) => {
    catOn[cb.dataset.layer!] = cb.checked;
  });
  vp.querySelectorAll<SVGElement>("g[data-cat]").forEach((g) => {
    const cat = g.getAttribute("data-cat") || "";
    const z = parseFloat(g.getAttribute("data-z") || "0");
    const visible = catOn[cat] !== false && z >= lo - 0.5 && z <= hi + 0.5;
    g.style.display = visible ? "" : "none";
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
  "Placa de hierro": { building: "Constructora", out: 20, tier: 0, inputs: [{ item: "Lingote de hierro", rate: 30 }] },
  "Varilla de hierro": { building: "Constructora", out: 15, tier: 0, inputs: [{ item: "Lingote de hierro", rate: 15 }] },
  Tornillo: { building: "Constructora", out: 40, tier: 0, inputs: [{ item: "Varilla de hierro", rate: 10 }] },
  "Hilo de cobre": { building: "Constructora", out: 30, tier: 0, inputs: [{ item: "Lingote de cobre", rate: 15 }] },
  Cable: { building: "Constructora", out: 30, tier: 0, inputs: [{ item: "Hilo de cobre", rate: 60 }] },
  Hormigón: { building: "Constructora", out: 15, tier: 0, inputs: [{ item: "Caliza", rate: 45 }] },
  "Lámina de cobre": { building: "Constructora", out: 10, tier: 2, inputs: [{ item: "Lingote de cobre", rate: 20 }] },
  "Placa de hierro reforzada": { building: "Ensambladora", out: 5, tier: 2, inputs: [{ item: "Placa de hierro", rate: 30 }, { item: "Tornillo", rate: 60 }] },
  Rotor: { building: "Ensambladora", out: 4, tier: 2, inputs: [{ item: "Varilla de hierro", rate: 20 }, { item: "Tornillo", rate: 100 }] },
  "Marco modular": { building: "Ensambladora", out: 2, tier: 2, inputs: [{ item: "Placa de hierro reforzada", rate: 3 }, { item: "Varilla de hierro", rate: 12 }] },
  "Lingote de acero": { building: "Fundición (Foundry)", out: 45, tier: 3, inputs: [{ item: "Mineral de hierro", rate: 45 }, { item: "Carbón", rate: 45 }] },
  "Viga de acero": { building: "Constructora", out: 15, tier: 3, inputs: [{ item: "Lingote de acero", rate: 60 }] },
  "Tubería de acero": { building: "Constructora", out: 20, tier: 3, inputs: [{ item: "Lingote de acero", rate: 30 }] },
  "Viga industrial revestida": { building: "Ensambladora", out: 6, tier: 4, inputs: [{ item: "Viga de acero", rate: 24 }, { item: "Hormigón", rate: 30 }] },
  "Marco modular pesado": { building: "Fabricante", out: 2, tier: 4, inputs: [{ item: "Marco modular", rate: 10 }, { item: "Tubería de acero", rate: 30 }, { item: "Viga industrial revestida", rate: 10 }, { item: "Tornillo", rate: 200 }] },
  "Lingote de caterium": { building: "Fundición", out: 15, tier: 5, inputs: [{ item: "Mineral de caterium", rate: 45 }] },
  Quickwire: { building: "Constructora", out: 60, tier: 5, inputs: [{ item: "Lingote de caterium", rate: 12 }] },
  Plástico: { building: "Refinería", out: 20, tier: 5, inputs: [{ item: "Petróleo crudo", rate: 30 }] },
  Caucho: { building: "Refinería", out: 20, tier: 5, inputs: [{ item: "Petróleo crudo", rate: 30 }] },
  "Placa de circuito": { building: "Ensambladora", out: 7.5, tier: 5, inputs: [{ item: "Lámina de cobre", rate: 15 }, { item: "Plástico", rate: 30 }] },
  Estátor: { building: "Ensambladora", out: 5, tier: 5, inputs: [{ item: "Tubería de acero", rate: 15 }, { item: "Hilo de cobre", rate: 40 }] },
  Motor: { building: "Ensambladora", out: 5, tier: 5, inputs: [{ item: "Rotor", rate: 10 }, { item: "Estátor", rate: 10 }] },
  Ordenador: { building: "Fabricante", out: 2.5, tier: 6, inputs: [{ item: "Placa de circuito", rate: 25 }, { item: "Cable", rate: 22.5 }, { item: "Plástico", rate: 45 }] },
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
    `<h3 class="inv-title">Calculadora de producción</h3>` +
    hint +
    `<div class="calc-controls">` +
    `<span>Quiero producir</span>` +
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
        `<div class="calc-line"><span>${b}</span><span class="calc-num"><b>${Math.ceil(m)}</b> <span class="muted">(${fmt(m)})</span></span></div>`
    )
    .join("");

  const stepRows = steps
    .map(
      (s) =>
        `<div class="calc-line"><span>${s.item} · ${fmt(s.rate)}/min</span>` +
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
    `<h4 class="calc-sub">Máquinas necesarias</h4>${buildingRows}` +
    `<h4 class="calc-sub">Cadena de producción</h4>${stepRows}` +
    `<h4 class="calc-sub">Materias primas</h4>${rawRows}` +
    `<p class="muted calc-note">Ritmos base (máquinas al 100%, recetas estándar). Los mineros se estiman sobre nodo de pureza normal.</p>`;
}

// Guarda la nota del mundo actualmente seleccionado.
async function saveNote() {
  if (!currentNoteKey) return;
  const text = noteText.value;
  try {
    await invoke("set_note", { key: currentNoteKey, text });
    notesCache[currentNoteKey] = text;
    noteStatus.textContent = "Guardado ✓";
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
      `${numWorlds} mundo(s) · ${saves.length} guardado(s) · actualizado a las ${new Date().toLocaleTimeString()}`;
  } catch (e) {
    tableBody.innerHTML = "";
    statusEl.className = "status err";
    statusEl.textContent = String(e);
    // Si la carpeta no vale, de poco sirve tenerla plegada: la abrimos para
    // que se pueda corregir sin ir a buscarla.
    const folderAcc = document.querySelector<HTMLDetailsElement>("#acc-folder");
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
    importStatus.textContent = `Analizando ${++done}/${saves.length}…`;
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
  importStatus.textContent = `Importadas ${saves.length} partidas (${rich} con datos completos) ✓`;
  // Si hay una partida abierta, refrescamos su gráfica.
  if (currentNoteKey) {
    try {
      const hist = await invoke<Snapshot[]>("get_history", { session: currentNoteKey });
      renderHistory(hist);
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
  planEl = document.querySelector("#plan") as HTMLElement;
  calcEl = document.querySelector("#calc") as HTMLElement;
  progressEl = document.querySelector("#progress") as HTMLElement;
  compatEl = document.querySelector("#compat") as HTMLElement;
  gameDataEl = document.querySelector("#gamedata") as HTMLElement;
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
    noteStatus.textContent = "Sin guardar…";
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
      "No encuentro la carpeta de partidas de Satisfactory. Indícala arriba y pulsa Vigilar.";
    const folderAcc = document.querySelector<HTMLDetailsElement>("#acc-folder");
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
  initGameData();
});
