// Destilado de la documentación oficial del juego.
//
// El juego publica en CommunityResources/Docs un JSON por idioma con TODAS sus
// recetas, objetos y edificios, ya traducidos. Son unos 10 MB cada uno, en
// UTF-16. Aquí se leen una vez, se extrae lo que la app usa y se guarda
// compacto; a partir de ahí las tablas escritas a mano solo sirven de respaldo
// para quien no tenga el juego instalado.
//
// Todo se indexa por el nombre de clase (Desc_Wood_C, Build_ConstructorMk1_C),
// que es independiente del idioma. Los nombres visibles son un dato más, no la
// clave: así una pieza es la misma en español y en inglés.

import { invoke } from "@tauri-apps/api/core";

export interface DocsFolder {
  path: string;
  languages: string[];
  newest_ms: number;
}

export interface GameRecipe {
  out: string; // clase del producto
  rate: number; // unidades por minuto
  inputs: { item: string; rate: number }[];
  building: string | null;
  name: Record<string, string>;
}

export interface GameItem {
  name: Record<string, string>;
  fluid: boolean;
}

// La caja de despeje, tal cual viene en la documentación:
//
//   ((ClearanceBox=(Min=(X=-400,Y=-500,Z=0),Max=(X=400,Y=500,Z=600),...)),(Type=CT_Soft,...))
//
// Nos quedamos con la PRIMERA, que es la dura — la que el juego usa para
// impedir que dos cosas se solapen. Las que llevan Type=CT_Soft son holguras
// blandas y no sirven para saber si algo cabe.
//
// Viene en centímetros. Dividimos entre cien para hablar en metros, que es
// como se piensa una fábrica.
const CLEARANCE =
  /ClearanceBox=\(Min=\(X=(-?[\d.]+),Y=(-?[\d.]+),Z=(-?[\d.]+)\),Max=\(X=(-?[\d.]+),Y=(-?[\d.]+),Z=(-?[\d.]+)\)/;

function parseClearance(raw: unknown): { w: number; d: number; h: number } | null {
  if (typeof raw !== "string" || !raw) return null;
  const m = CLEARANCE.exec(raw);
  if (!m) return null;
  const n = m.slice(1).map(Number);
  if (n.some((v) => !Number.isFinite(v))) return null;
  const r = (v: number) => Math.round((v / 100) * 10) / 10;
  const w = r(n[3] - n[0]);
  const d = r(n[4] - n[1]);
  const h = r(n[5] - n[2]);
  return w > 0 && d > 0 ? { w, d, h } : null;
}

export interface GameBuilding {
  name: Record<string, string>;
  power: number; // MW que consume
  generation: number; // MW que genera
  /// Huella real en metros, de la caja de despeje del propio juego. Es lo que
  /// el juego usa para no dejarte solapar dos máquinas, así que es la medida
  /// honesta para planificar. Ausente en lo que no tiene caja: las cintas son
  /// curvas, no cajas.
  size?: { w: number; d: number; h: number };
  /// Objetos por minuto que mueve, para cintas y elevadores. En la
  /// documentación viene como cm/min, que es el doble.
  speed?: number;
  /// Lado del diseñador de planos, en cimientos de 8 m. Solo los diseñadores.
  designer?: number;
}

// Un hito del HUB o una investigación del MAM: lo que cuesta, cuánto tarda y
// qué abre. Es la respuesta a "¿y ahora qué?", que es la razón de ser de esta
// app, así que se extrae aunque todavía no se use en ninguna pantalla.
export interface GameSchematic {
  name: Record<string, string>;
  type: string; // EST_Milestone, EST_MAM, EST_Alternate...
  tier: number;
  cost: { item: string; amount: number }[];
  seconds: number;
  unlocks: string[]; // clases de receta
}

export interface GameData {
  schema: number;
  extractedAt: number;
  docsPath: string;
  docsNewestMs: number;
  langs: string[];
  recipes: Record<string, GameRecipe>;
  items: Record<string, GameItem>;
  buildings: Record<string, GameBuilding>;
  schematics: Record<string, GameSchematic>;
  /// Clase -> nombre del asset de su icono, sin ruta ni extensión
  /// (Desc_IronPlate_C -> IconDesc_IronPlates_256). Es solo el NOMBRE: la
  /// imagen es de Coffee Stain y no viaja con la app, se lee del disco del
  /// usuario si él la ha extraído de su propia copia del juego.
  icons: Record<string, string>;
}

// 3: los edificios llevan medidas (size), velocidad de cinta (speed) y lado
// del diseñador de planos (designer). Subir el número obliga a releer la
// documentación, que es lo que queremos: sin medidas no hay planificador.
export const GAMEDATA_SCHEMA = 3;

// Los idiomas que nos interesan, en orden de preferencia. El primero que
// exista de cada pareja es el que se usa.
const WANTED: Record<string, string[]> = {
  es: ["es-ES", "es-419"],
  en: ["en-US", "en-GB"],
};

export function pickLanguages(available: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [code, candidates] of Object.entries(WANTED)) {
    const found = candidates.find((c) => available.includes(c));
    if (found) out[code] = found;
  }
  return out;
}

// "...Desc_Wood.Desc_Wood_C'",Amount=4  ->  [Desc_Wood_C, 4]
const STACK_RE = /([A-Za-z0-9_]+_C)'",Amount=([\d.]+)/g;

function parseStacks(raw: string | undefined): { item: string; amount: number }[] {
  if (!raw) return [];
  const out: { item: string; amount: number }[] = [];
  let m: RegExpExecArray | null;
  STACK_RE.lastIndex = 0;
  while ((m = STACK_RE.exec(raw)) !== null) {
    out.push({ item: m[1], amount: parseFloat(m[2]) });
  }
  return out;
}

// De mProducedIn nos quedamos con el edificio de fábrica; el banco de trabajo
// y el equipo manual no cuentan como producción automatizada.
function parseBuilding(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/(Build_[A-Za-z0-9_]+_C)/g);
  return m && m.length ? m[0] : null;
}

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

function decode(bytes: ArrayBuffer): any {
  // Los archivos del juego vienen en UTF-16; TextDecoder se come la marca BOM.
  return JSON.parse(new TextDecoder("utf-16le").decode(bytes));
}

// Lee un idioma y vuelca lo que haya en los mapas que se le pasan. El primer
// idioma aporta la estructura (recetas, consumos); los demás solo nombres.
function absorb(
  blocks: any[],
  lang: string,
  primary: boolean,
  items: Record<string, GameItem>,
  buildings: Record<string, GameBuilding>,
  recipes: Record<string, GameRecipe>,
  schematics: Record<string, GameSchematic>,
  icons: Record<string, string>
) {
  for (const block of blocks) {
    for (const c of block.Classes || []) {
      const cls: string = c.ClassName || "";
      const display: string = c.mDisplayName || "";

      if (primary && cls && typeof c.mSmallIcon === "string") {
        // "Texture2D /Game/.../IconDesc_IronPlates_256.IconDesc_IronPlates_256"
        // Nos quedamos solo con el nombre del asset, que es lo que acaba
        // siendo el nombre del archivo al extraerlo.
        const m = /\/([^/.]+)\.[^/.]+$/.exec(c.mSmallIcon.trim());
        if (m) icons[cls] = m[1];
      }

      if (cls.startsWith("Desc_") || cls.startsWith("BP_EquipmentDescriptor")) {
        if (!items[cls]) items[cls] = { name: {}, fluid: false };
        if (display) items[cls].name[lang] = display;
        if (primary && typeof c.mForm === "string") {
          items[cls].fluid = c.mForm === "RF_LIQUID" || c.mForm === "RF_GAS";
        }
      } else if (cls.startsWith("Build_")) {
        if (!buildings[cls]) buildings[cls] = { name: {}, power: 0, generation: 0 };
        if (display) buildings[cls].name[lang] = display;
        if (primary) {
          if (c.mPowerConsumption !== undefined) buildings[cls].power = num(c.mPowerConsumption);
          if (c.mPowerProduction !== undefined) buildings[cls].generation = num(c.mPowerProduction);
          const size = parseClearance(c.mClearanceData);
          if (size) buildings[cls].size = size;
          // mSpeed de una cinta son centímetros por minuto y cada objeto ocupa
          // dos, así que la mitad son objetos por minuto. Coincide con el
          // juego: 60, 120, 270, 480, 780 y 1200 de Mk1 a Mk6.
          if (typeof c.mSpeed === "string" || typeof c.mSpeed === "number") {
            const sp = num(c.mSpeed) / 2;
            if (sp > 0) buildings[cls].speed = sp;
          }
          // Lado del diseñador de planos, en cimientos: (X=4,Y=4,Z=4).
          const dim = /X=(\d+)/.exec(String(c.mDimensions || ""));
          if (dim) buildings[cls].designer = Number(dim[1]);
        }
      } else if (cls.startsWith("Recipe_")) {
        if (primary) {
          const product = parseStacks(c.mProduct)[0];
          const seconds = num(c.mManufactoringDuration);
          if (!product || seconds <= 0) continue;
          const perMinute = 60 / seconds;
          recipes[cls] = {
            out: product.item,
            rate: product.amount * perMinute,
            inputs: parseStacks(c.mIngredients).map((i) => ({
              item: i.item,
              rate: i.amount * perMinute,
            })),
            building: parseBuilding(c.mProducedIn),
            name: {},
          };
        }
        if (recipes[cls] && display) recipes[cls].name[lang] = display;
      } else if (cls.startsWith("Schematic_") || c.mTechTier !== undefined) {
        if (primary) {
          const unlocks: string[] = [];
          for (const u of c.mUnlocks || []) {
            const m = String(u.mRecipes || "").match(/(Recipe_[A-Za-z0-9_]+_C)/g);
            if (m) unlocks.push(...m);
          }
          schematics[cls] = {
            name: {},
            type: c.mType || "",
            tier: num(c.mTechTier),
            // Aquí Amount son unidades que se entregan, no ritmo por minuto.
            cost: parseStacks(c.mCost).map((x) => ({ item: x.item, amount: x.amount })),
            seconds: num(c.mTimeToComplete),
            unlocks,
          };
        }
        if (schematics[cls] && display) schematics[cls].name[lang] = display;
      }
    }
  }
}

// Los fluidos vienen en milésimas (1000 = 1 m³). Hay que saber qué objeto es
// fluido antes de corregir, así que esto va después de leerlo todo.
function fixFluidAmounts(recipes: Record<string, GameRecipe>, items: Record<string, GameItem>) {
  const isFluid = (c: string) => !!(items[c] && items[c].fluid);
  for (const r of Object.values(recipes)) {
    if (isFluid(r.out)) r.rate /= 1000;
    for (const i of r.inputs) if (isFluid(i.item)) i.rate /= 1000;
  }
}

export async function extractGameData(folder: string, available: string[]): Promise<GameData> {
  const langs = pickLanguages(available);
  const codes = Object.keys(langs);
  if (!codes.length) throw new Error("La carpeta Docs no trae ni español ni inglés.");

  const items: Record<string, GameItem> = {};
  const buildings: Record<string, GameBuilding> = {};
  const recipes: Record<string, GameRecipe> = {};
  const schematics: Record<string, GameSchematic> = {};
  const icons: Record<string, string> = {};

  let primary = true;
  for (const code of codes) {
    const bytes = await invoke<ArrayBuffer>("read_docs_lang", { folder, lang: langs[code] });
    absorb(decode(bytes), code, primary, items, buildings, recipes, schematics, icons);
    primary = false;
  }
  fixFluidAmounts(recipes, items);

  return {
    schema: GAMEDATA_SCHEMA,
    extractedAt: Date.now(),
    docsPath: folder,
    docsNewestMs: 0, // lo rellena quien llama, que es quien conoce la carpeta
    langs: codes.map((c) => langs[c]),
    recipes,
    items,
    buildings,
    schematics,
    icons,
  };
}

// El juego guarda el icono en la clase descriptora (Desc_ConstructorMk1_C),
// no en la construible (Build_ConstructorMk1_C). Probamos las dos, porque la
// app pregunta por las dos.
export function iconAssetFor(gd: GameData | null, cls: string): string | null {
  if (!gd || !gd.icons) return null;
  if (gd.icons[cls]) return gd.icons[cls];
  if (cls.startsWith("Build_")) {
    const desc = `Desc_${cls.slice("Build_".length)}`;
    if (gd.icons[desc]) return gd.icons[desc];
  }
  return null;
}

// ---- Qué ha cambiado desde la última vez ----

export interface GameDataDiff {
  addedRecipes: string[];
  removedRecipes: string[];
  changedRates: { recipe: string; from: number; to: number }[];
  addedItems: number;
  addedBuildings: number;
}

export function diffGameData(prev: GameData | null, next: GameData): GameDataDiff | null {
  if (!prev) return null;
  const added: string[] = [];
  const changed: { recipe: string; from: number; to: number }[] = [];
  for (const [k, r] of Object.entries(next.recipes)) {
    const old = prev.recipes[k];
    if (!old) {
      added.push(k);
    } else if (Math.abs(old.rate - r.rate) > 0.001 || old.out !== r.out) {
      changed.push({ recipe: k, from: old.rate, to: r.rate });
    }
  }
  const removed = Object.keys(prev.recipes).filter((k) => !next.recipes[k]);
  const newKeys = (a: object, b: object) =>
    Object.keys(b).filter((k) => !(k in a)).length;
  return {
    addedRecipes: added,
    removedRecipes: removed,
    changedRates: changed,
    addedItems: newKeys(prev.items, next.items),
    addedBuildings: newKeys(prev.buildings, next.buildings),
  };
}

export function describeDiff(d: GameDataDiff | null, data: GameData, lang: string): string {
  const nameOf = (k: string) => (data.recipes[k] && data.recipes[k].name[lang]) || k;
  // El parametro lang traducia los nombres de receta pero no esta prosa, asi
  // que el resumen de cambios salia en espanol aunque la app estuviera en
  // ingles. Ahora decide las dos cosas.
  const en = lang.startsWith("en");
  if (!d) {
    const n = [
      Object.keys(data.recipes).length,
      Object.keys(data.items).length,
      Object.keys(data.buildings).length,
      Object.keys(data.schematics).length,
    ];
    return en
      ? `First read: ${n[0]} recipes, ${n[1]} items, ${n[2]} buildings and ${n[3]} milestones.`
      : `Primera lectura: ${n[0]} recetas, ${n[1]} objetos, ${n[2]} edificios y ${n[3]} hitos.`;
  }
  const parts: string[] = [];
  if (d.addedRecipes.length) {
    const sample = d.addedRecipes.slice(0, 4).map(nameOf).join(", ");
    parts.push(
      `${d.addedRecipes.length} ${en ? "new recipe(s)" : "receta(s) nueva(s)"}: ${sample}${d.addedRecipes.length > 4 ? "…" : ""}`
    );
  }
  if (d.changedRates.length) {
    const sample = d.changedRates
      .slice(0, 3)
      .map((c) => `${nameOf(c.recipe)} ${c.from.toFixed(1)} → ${c.to.toFixed(1)}/min`)
      .join(", ");
    parts.push(`${d.changedRates.length} ${en ? "changed rate(s)" : "ritmo(s) cambiado(s)"}: ${sample}`);
  }
  if (d.removedRecipes.length)
    parts.push(`${d.removedRecipes.length} ${en ? "recipe(s) withdrawn" : "receta(s) retirada(s)"}`);
  if (d.addedBuildings)
    parts.push(`${d.addedBuildings} ${en ? "new building(s)" : "edificio(s) nuevo(s)"}`);
  if (parts.length) return parts.join(" · ");
  return en ? "No changes since the last read." : "Sin cambios respecto a la última lectura.";
}

// Tier de progresion de cada pieza: en que punto de la partida aparece en tu
// mundo. El juego NO lo guarda en ninguna parte, hay que deducirlo, y deducirlo
// mal es peor que no tenerlo. Tres cosas aprendidas midiendolo:
//
// 1. Solo cuentan hitos, MAM, tutorial y recetas iniciales. Incluir las
//    alternativas de los discos duros hundia la mitad del juego en el tier 0,
//    porque son esquemas de tier bajo que desbloquean piezas tardias: el
//    circuito impreso salia tier 0.
// 2. El convertidor no produce mineral. Fabrica mineral a partir de otra cosa
//    en el tier 9, y es la UNICA receta que "produce" mineral de hierro, asi
//    que sin excluirlo lo primero que picas en el juego salia de endgame.
// 3. Lo que no se fabrica, se hereda de quien lo consume. El mineral de hierro
//    no tiene receta propia, pero el lingote de hierro es tier 0 y lo come:
//    luego el mineral existe desde el tier 0. Esto cubre tambien lo que se
//    recoge del suelo (hojas, palibayas, babosas).
//
// La produccion manda y el consumo solo rellena lo que no se fabrica. Al reves
// no funciona: algun esquema temprano consume ordenadores y los hundia al 0.
//
// Comprobado contra diez piezas de tier conocido: nueve exactas, y la decima
// ni existe en esta version del juego. Sobre una partida real cubre el 100% de
// lo que hay en los almacenes.
const TIER_SCHEMATICS = ["EST_Milestone", "EST_MAM", "EST_Tutorial", "EST_Custom"];

export function deriveItemTiers(gd: GameData | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!gd) return out;
  const prod: Record<string, number> = {};
  const cons: Record<string, number> = {};
  for (const s of Object.values(gd.schematics)) {
    if (!TIER_SCHEMATICS.includes(s.type)) continue;
    for (const rc of s.unlocks || []) {
      const r = gd.recipes[rc];
      if (!r) continue;
      if (r.out && r.building !== "Build_Converter_C") {
        if (prod[r.out] === undefined || s.tier < prod[r.out]) prod[r.out] = s.tier;
      }
      for (const i of r.inputs || []) {
        if (i.item && (cons[i.item] === undefined || s.tier < cons[i.item])) cons[i.item] = s.tier;
      }
    }
  }
  for (const cls of Object.keys(gd.items)) {
    const t = prod[cls] !== undefined ? prod[cls] : cons[cls];
    if (t !== undefined) out[cls] = t;
  }
  return out;
}
