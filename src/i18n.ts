// Idiomas de la interfaz.
//
// Los nombres del juego (piezas, edificios, recetas, hitos) NO están aquí:
// vienen de la documentación oficial en el idioma que se pida, indexados por
// clase. Esto es solo el texto propio de la app.
//
// SOBRE EL TONO: Satisfactory habla como una circular de empresa con mala
// baba, y la app es un asistente de FICSIT, así que escribe igual. Pero con
// una regla: las ETIQUETAS son planas y los TEXTOS tienen voz. Un botón que
// hace un chiste es un botón que se lee dos veces, y eso cansa; una nota al
// pie con guasa se lee una vez y deja buen sabor. El juego hace exactamente
// eso: los menús son sobrios y el humor está en las descripciones.

export type Lang = "es" | "en";

const LANG_KEY = "uiLang";

type Entry = { es: string; en: string };

export const STRINGS: Record<string, Entry> = {
  // ---- Cabecera y ajustes (etiquetas: planas) ----
  "brand.sub": { es: "Asistente de Pionero", en: "Pioneer Assistant" },
  "settings": { es: "Ajustes", en: "Settings" },
  "settings.folder": { es: "Carpeta de partidas", en: "Save folder" },
  "settings.gamedata": { es: "Datos del juego", en: "Game data" },
  "settings.watch": { es: "Vigilar", en: "Watch" },
  "world": { es: "Mundo", en: "World" },
  "loading": { es: "Cargando…", en: "Loading…" },

  // ---- Pestañas ----
  "tab.summary": { es: "Resumen", en: "Summary" },
  "tab.production": { es: "Producción", en: "Production" },
  "tab.map": { es: "Mapa", en: "Map" },
  "tab.plan": { es: "Plan y notas", en: "Plan and notes" },
  "tab.saves": { es: "Guardados", en: "Saves" },

  // ---- Secciones ----
  "sec.milestone": { es: "Siguiente hito", en: "Next milestone" },
  "sec.progress": { es: "Progreso de la partida", en: "World progress" },
  "sec.inventory": { es: "Inventario de construcciones", en: "Building inventory" },
  "sec.stored": { es: "Materiales almacenados", en: "Stored materials" },
  "sec.exploration": { es: "Exploración", en: "Exploration" },
  "sec.history": { es: "Evolución", en: "Evolution" },
  "sec.calc": { es: "Calculadora de producción", en: "Production calculator" },
  "sec.vitals": { es: "Signos vitales", en: "Vital signs" },
  "sec.zones": { es: "Zonas", en: "Zones" },

  // ---- Tabla de guardados ----
  "saves.name": { es: "Partida", en: "Save" },
  "saves.played": { es: "Tiempo jugado", en: "Play time" },
  "saves.saved": { es: "Guardada", en: "Saved" },
  "saves.size": { es: "Tamaño", en: "Size" },
  "saves.state": { es: "Estado", en: "Status" },
  "saves.newest": { es: "más reciente", en: "newest" },
  "saves.import": { es: "Importar mis partidas al histórico", en: "Import my saves into the history" },

  // ---- Notas ----
  "notes.label": { es: "Notas de esta partida", en: "Notes for this save" },
  "notes.save": { es: "Guardar nota", en: "Save note" },
  "notes.saved": { es: "Guardado ✓", en: "Saved ✓" },
  "notes.unsaved": { es: "Sin guardar…", en: "Unsaved…" },
  "notes.placeholder": {
    es: "¿Dónde lo dejaste? ¿Qué ibas a montar? Ej: 'Falta conectar la línea de placas de circuito al norte; pendiente subir energía.'",
    en: "Where did you leave off? What were you about to build? E.g. 'Circuit board line up north still needs connecting; power to sort out.'",
  },

  // ---- Textos con voz: aquí sí ----
  "vitals.note.docs": {
    es: "Energía según la documentación oficial del juego, edificio a edificio (máquinas a 100%).",
    en: "Power taken from the game's own documentation, building by building (machines at 100%).",
  },
  "vitals.note.guess": {
    es: "Energía estimada con tablas propias: sin los datos del juego, es una aproximación.",
    en: "Power estimated from the app's own tables: without the game's data, it is an approximation.",
  },
  "vitals.note.health": {
    es: "La salud combina cuellos de botella y margen eléctrico.",
    en: "Health combines bottlenecks and power headroom.",
  },
  "map.empty": {
    es: "No hay coordenadas que dibujar. Difícil inspeccionar una fábrica que todavía no existe.",
    en: "No coordinates to draw. Hard to inspect a factory that does not exist yet.",
  },
  "history.need2": {
    es: "Hace falta al menos 2 guardados de este mundo para ver la evolución. Importa tus partidas o sigue jugando: la app irá apuntando una foto en cada guardado.",
    en: "At least 2 saves of this world are needed to show any evolution. Import your saves or keep playing: the app files a snapshot every time you save.",
  },
  "balance.ok": {
    es: "Producción equilibrada: ninguna pieza fabricada se consume más rápido de lo que se produce. 🎉",
    en: "Production is balanced: nothing is being consumed faster than it is made. 🎉",
  },
  "plan.empty": {
    es: "Aún no hay objetivos. Añade uno abajo para empezar a planificar.",
    en: "No goals yet. Add one below to start planning.",
  },
  "production.none": {
    es: "No se detectaron máquinas con receta asignada.",
    en: "No machines with an assigned recipe were found.",
  },

  // ---- Avisos ----
  "compat.save": { es: "⚠ Ojo con los datos de esta partida", en: "⚠ Mind the data of this save" },
  "compat.app": { es: "ℹ Cobertura de recetas", en: "ℹ Recipe coverage" },

  // ---- Zonas y mapa ----
  "zones.all": { es: "Toda la fábrica", en: "The whole factory" },
  "zones.mixed": { es: "Área mixta", en: "Mixed area" },
  "zones.storage": { es: "Almacén", en: "Storage" },
  "zones.extraction": { es: "Extracción", en: "Extraction" },
  "zones.generation": { es: "Generación", en: "Generation" },
  "zones.zone": { es: "Zona", en: "Zone" },
  "map.floors": { es: "Plantas", en: "Floors" },
  "map.allFloors": { es: "Todas", en: "All" },
  "map.ground": { es: "Terreno", en: "Terrain" },
  "map.height": { es: "Altura (ajuste fino):", en: "Height (fine tuning):" },
  "map.hint": { es: "rueda = zoom · arrastra = mover", en: "wheel = zoom · drag = pan" },
  "layer.prod": { es: "Producción", en: "Production" },
  "layer.extr": { es: "Extracción", en: "Extraction" },
  "layer.power": { es: "Generadores", en: "Generators" },
  "layer.store": { es: "Almacén", en: "Storage" },
  "layer.floor": { es: "Suelos", en: "Floors" },
  "layer.belt": { es: "Cintas", en: "Belts" },
  "layer.other": { es: "Resto", en: "The rest" },

  // ---- Datos del juego ----
  "gd.reload": { es: "Releer datos del juego", en: "Re-read game data" },
  "gd.upToDate": { es: "Datos del juego al día.", en: "Game data up to date." },
  "gd.updated": { es: "Datos del juego actualizados.", en: "Game data updated." },
  "gd.changed": {
    es: "El juego ha cambiado desde la última lectura.",
    en: "The game has changed since the last read.",
  },
  "gd.reading": { es: "Leyendo la documentación del juego…", en: "Reading the game's documentation…" },
  "gd.notFound": {
    es: "No encuentro la instalación del juego.",
    en: "I cannot find the game's installation.",
  },
  "gd.noGameNote": {
    es: "Sin los datos oficiales uso mis propias tablas, que van por detrás de los parches.",
    en: "Without the official data I fall back on my own tables, which lag behind the patches.",
  },
  "gd.cached": { es: "Usando datos guardados del juego.", en: "Using cached game data." },
  "gd.failed": {
    es: "No se pudieron leer los datos del juego.",
    en: "The game's data could not be read.",
  },

  // ---- Textos largos (aquí vive la voz) ----
  "ms.note": {
    es: "Coste oficial del juego frente a lo que tienes en almacenes, máquinas y depósito. Los minutos son a tu ritmo de producción actual. Los hitos ya hechos se deducen de la partida, así que alguno podría colarse.",
    en: "The game's own cost against what you have in containers, machines and the depot. The minutes are at your current rate of production. Completed milestones are inferred from the save, so one may slip through.",
  },
  "ms.none": {
    es: "No quedan hitos pendientes en tu tier actual ni en el siguiente.",
    en: "No milestones left pending in your current tier or the next one.",
  },
  "ms.missing": { es: "faltan {n} de {total}", en: "{n} of {total} missing" },
  "ms.ready": { es: "✓ lo tienes todo", en: "✓ you have everything" },
  "ms.title": { es: "Siguiente hito · {n} pendiente(s)", en: "Next milestone · {n} pending" },

  "resume.title": { es: "↩ Retoma aquí — {world}", en: "↩ Resume here — {world}" },
  "resume.since": { es: "Desde tu guardado anterior", en: "Since your previous save" },
  "resume.days": { es: " (hace {n} día(s))", en: " ({n} day(s) ago)" },
  "resume.builds": { es: "construcciones", en: "buildings" },
  "resume.noHistory": {
    es: "Aún no hay histórico para comparar. Importa tus partidas (pestaña Guardados) o sigue jugando.",
    en: "No history to compare against yet. Import your saves (Saves tab) or keep playing.",
  },
  "resume.bottlenecks": {
    es: "⚠️ {n} cuello(s) de botella detectado(s) — revisa la pestaña Producción.",
    en: "⚠️ {n} bottleneck(s) found — have a look at the Production tab.",
  },
  "resume.balanced": { es: "✅ Producción equilibrada.", en: "✅ Production is balanced." },
  "resume.tier": { es: "Vas por Tier {t}", en: "You are on Tier {t}" },
  "resume.next": { es: " · siguiente objetivo: Tier {t}", en: " · next goal: Tier {t}" },
  "resume.note": { es: "Tu nota", en: "Your note" },

  "hist.title": {
    es: "Evolución · {n} guardados · {sign}{growth} construcciones",
    en: "Evolution · {n} saves · {sign}{growth} buildings",
  },
  "plan.add": { es: "Añadir objetivo", en: "Add goal" },
  "plan.title": { es: "Plan de mejoras", en: "Build plan" },
  "plan.done": { es: "✓ completado", en: "✓ done" },
  "plan.left": { es: "faltan {n}", en: "{n} to go" },
  "plan.removeGoal": { es: "Quitar objetivo", en: "Remove goal" },

  "prod.title": { es: "Producción actual (máquinas activas)", en: "Current production (active machines)" },
  "prod.machines": { es: "Máquinas con receta", en: "Machines with a recipe" },
  "prod.power": { es: "Consumo estimado", en: "Estimated draw" },
  "stored.note": {
    es: "Suma de todos los inventarios del mundo (almacenes, máquinas, depósito, jugador).",
    en: "Everything in the world's inventories (containers, machines, depot, player).",
  },
  "bn.title": { es: "Cuellos de botella", en: "Bottlenecks" },
  "bn.note": {
    es: "Piezas que se consumen más rápido de lo que se fabrican (según las recetas activas). Sugerencia de máquinas a añadir:",
    en: "Parts being consumed faster than they are made (going by the recipes currently running). Suggested machines to add:",
  },
  "bn.makes": { es: "produce", en: "makes" },
  "bn.uses": { es: "consume", en: "uses" },
  "expl.title": { es: "Exploración · por recoger", en: "Exploration · still out there" },
  "expl.note": {
    es: "Coleccionables y cápsulas que aún siguen en el mundo (sin recoger).",
    en: "Collectables and drop pods still sitting in the world, uncollected.",
  },

  "zones.more": { es: " y {n} más", en: " and {n} more" },
  "zones.loose": { es: "Y {n} máquina(s) suelta(s) sin zona.", en: "And {n} machine(s) on their own, in no zone." },
  "zones.note": {
    es: "Una zona es un grupo de máquinas juntas en la misma planta: el espacio que montaste para una receta. Pulsa una para quedarte solo con ella.",
    en: "A zone is a group of machines together on the same floor: the space you set up for one recipe. Click one to keep only that.",
  },
  "zones.dedicated": { es: "{n}% dedicada", en: "{n}% dedicated" },
  "zones.machines": { es: "máquinas", en: "machines" },
  "map.banner": {
    es: "📍 Cuello de botella: <b>{item}</b> · {n} máquina(s) marcada(s) en rojo",
    en: "📍 Bottleneck: <b>{item}</b> · {n} machine(s) marked in red",
  },
  "map.clear": { es: "limpiar", en: "clear" },
  "map.noSlabs": {
    es: "sin cimientos: todo está sobre el terreno",
    en: "no foundations: it is all on the terrain",
  },
  "map.title": {
    es: "Plano 2D · {b} construcciones · {c} cintas",
    en: "2D plan · {b} buildings · {c} belts",
  },
  "map.slabs": { es: " · {n} piezas de suelo", en: " · {n} floor pieces" },
  "map.note": {
    es: "Vista cenital, norte arriba. Pasa el ratón por una pieza para ver qué es y qué fabrica. Las plantas salen del suelo que has construido, no de adivinar alturas: una planta es una altura con una concentración de cimientos, y lo que no pisa ninguno está sobre terreno. Al elegir una planta el resto no desaparece, se queda en sombra, y las cintas siguen visibles porque son lo que explica cómo se conecta todo.",
    en: "Top-down, north up. Hover a piece to see what it is and what it makes. Floors come from the ground you actually built, not from guessing at heights: a floor is an altitude with a concentration of foundations, and anything standing on none of them is on the terrain. Picking a floor does not hide the rest, it dims it, and belts stay visible because they are what explains how it all connects.",
  },
  "calc.machines": { es: "Máquinas necesarias", en: "Machines needed" },
  "calc.chain": { es: "Cadena de producción", en: "Production chain" },
  "calc.raw": { es: "Materias primas", en: "Raw materials" },
  "calc.note": {
    es: "Ritmos base (máquinas al 100%, recetas estándar). Los mineros se estiman sobre nodo de pureza normal.",
    en: "Base rates (machines at 100%, standard recipes). Miners are estimated on a normal-purity node.",
  },
  "calc.want": { es: "Quiero producir", en: "I want to make" },
  "gd.detail": {
    es: "{r} recetas · {s} hitos · {langs}",
    en: "{r} recipes · {s} milestones · {langs}",
  },
  "gd.cachedDetail": {
    es: "{r} recetas · leídos el {date}",
    en: "{r} recipes · read on {date}",
  },
  "import.working": { es: "Analizando {i}/{n}…", en: "Analysing {i}/{n}…" },
  "import.done": {
    es: "Importadas {n} partidas ({r} con datos completos) ✓",
    en: "{n} saves imported ({r} with full data) ✓",
  },
  "detail.reading": { es: "Leyendo el interior de la partida…", en: "Reading inside the save…" },
  "detail.builds": { es: "Construcciones", en: "Buildings" },
  "detail.types": { es: "Tipos distintos", en: "Distinct types" },
  "detail.gameVersion": { es: "Versión del juego", en: "Game version" },
  "detail.uncompressed": { es: "Datos descomprimidos", en: "Uncompressed data" },
  "vitals.health": { es: "Salud de la fábrica", en: "Factory health" },
  "vitals.draw": { es: "Consumo", en: "Draw" },
  "vitals.gen": { es: "Generación", en: "Generation" },
  "vitals.margin": { es: "Margen de energía", en: "Power headroom" },
  "vitals.size": { es: "Tamaño de la fábrica", en: "Factory size" },
  "vitals.stored": { es: "Piezas almacenadas", en: "Parts in storage" },
  "notes.worldLabel": { es: 'Notas del mundo "{world}"', en: 'Notes for the world "{world}"' },
  "worlds.status": {
    es: "{w} mundo(s) · {s} guardado(s) · actualizado a las {time}",
    en: "{w} world(s) · {s} save(s) · updated at {time}",
  },
  "worlds.option": { es: "{w} ({n} guardados)", en: "{w} ({n} saves)" },

  "compat.mods": {
    es: "<b>Partida con {n} mods.</b> El juego no la abrirá sin ellos instalados. <span class=\"muted\">{list}</span>",
    en: "<b>Save with {n} mods.</b> The game will not open it without them installed. <span class=\"muted\">{list}</span>",
  },
  "compat.oldFormat": {
    es: "Guardada en formato <b>v{v}</b>, por detrás de tus partidas más nuevas (v{newest}).",
    en: "Written in format <b>v{v}</b>, behind your newest saves (v{newest}).",
  },
  "compat.creative": {
    es: "Modo creativo activado: los datos no son comparables con una partida normal.",
    en: "Creative mode is on: these numbers are not comparable with a normal save.",
  },
  "compat.modRecipes": {
    es: "<b>{n} de {total} máquinas</b> fabrican recetas de mods. Lo que producen solo lo sabe el propio mod, así que no entran en los cálculos: {src}.",
    en: "<b>{n} of {total} machines</b> run modded recipes. Only the mod knows what they make, so they stay out of the figures: {src}.",
  },
  "compat.baseRecipes": {
    es: "<b>{n} de {total} máquinas ({pct}%)</b> usan recetas del juego base que todavía no tengo en mis tablas, así que su producción y su consumo no entran en los cálculos. Esto es una limitación mía, no un problema de tu partida.",
    en: "<b>{n} of {total} machines ({pct}%)</b> run base-game recipes I do not have in my tables yet, so what they make and use stays out of the figures. That is a gap on my side, not a problem with your save.",
  },
  "prod.fromParser": {
    es: "Datos exactos del parser completo (incluye overclock real).",
    en: "Exact figures from the full parser, real overclock included.",
  },
  "prod.fallback": {
    es: "Estimación de respaldo (el parser completo no está disponible).",
    en: "Fallback estimate: the full parser is not available.",
  },

  // ---- Copias de seguridad ----
  "bk.title": { es: "Copias de seguridad", en: "Backups" },
  "bk.create": { es: "Crear copia ahora", en: "Back up now" },
  "bk.open": { es: "Abrir carpeta", en: "Open folder" },
  "bk.restore": { es: "Restaurar", en: "Restore" },
  "bk.none": {
    es: "Todavía no hay copias. Se crea una sola al día, en cuanto haya algo que guardar.",
    en: "No backups yet. One a day is made, as soon as there is anything worth keeping.",
  },
  "bk.item": {
    es: "{worlds} mundo(s) · {snaps} fotos · {notes} nota(s) · {kb} KB",
    en: "{worlds} world(s) · {snaps} snapshots · {notes} note(s) · {kb} KB",
  },
  "bk.auto": { es: "automática", en: "automatic" },
  "bk.manual": { es: "manual", en: "manual" },
  "bk.done": { es: "Copia creada.", en: "Backup created." },
  "bk.restored": {
    es: "Restaurado: {added} fotos nuevas, {enriched} completadas, {notes} notas, {plans} planes. {skipped} ya los tenías.",
    en: "Restored: {added} new snapshots, {enriched} filled in, {notes} notes, {plans} plans. {skipped} were already here.",
  },
  "bk.note": {
    es: "Se guardan el histórico, las notas y los planes. Los datos del juego no: se regeneran solos. Restaurar FUSIONA, nunca reemplaza, así que no puede borrarte meses de histórico de un clic. Ojo: una copia en esta misma máquina te protege de un fallo de la app, no de que muera el disco — para eso, saca el archivo de aquí.",
    en: "History, notes and plans are kept. Game data is not: it rebuilds itself. Restoring MERGES, never replaces, so it cannot wipe months of history in one click. Mind this though: a copy on this same machine protects you from the app misbehaving, not from the disk dying — for that, take the file somewhere else.",
  },
  "bk.failed": { es: "No se pudo completar.", en: "That did not work." },

  // ---- Carpeta ----
  "folder.notFound": {
    es: "No encuentro la carpeta de partidas de Satisfactory. Indícala arriba y pulsa Vigilar.",
    en: "I cannot find the Satisfactory save folder. Point me at it above and press Watch.",
  },
};

let current: Lang = "es";

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "es" || saved === "en") return saved;
  } catch {
    /* sin almacenamiento: se decide por el navegador */
  }
  const nav = (navigator.language || "es").toLowerCase();
  return nav.startsWith("es") ? "es" : "en";
}

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* que no poder recordarlo no rompa el cambio de idioma */
  }
  document.documentElement.lang = l;
}

// Texto traducido. Si falta la clave devuelve la propia clave, que es feo a
// propósito: así un olvido se ve en pantalla en vez de pasar desapercibido.
export function t(key: string, vars?: Record<string, string | number>): string {
  const e = STRINGS[key];
  let s = e ? e[current] : key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

// Aplica las traducciones al HTML estático (data-i18n en el marcado).
export function applyStaticI18n() {
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-ph]").forEach((el) => {
    (el as HTMLTextAreaElement | HTMLInputElement).placeholder = t(el.dataset.i18nPh!);
  });
}
