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
  "settings.close": { es: "Cerrar", en: "Close" },
  "settings.news": { es: "Ajustes · hay novedades", en: "Settings · something new" },
  "settings.folder": { es: "Carpeta de partidas", en: "Save folder" },
  "settings.gamedata": { es: "Datos del juego", en: "Game data" },
  "settings.watch": { es: "Vigilar", en: "Watch" },
  "settings.folderAria": { es: "Ruta de la carpeta de partidas", en: "Path to the save folder" },
  "world": { es: "Mundo", en: "World" },
  "loading": { es: "Cargando…", en: "Loading…" },

  // ---- Pestañas ----
  "tab.now": { es: "Ahora", en: "Now" },
  "tab.factory": { es: "Fábrica", en: "Factory" },
  "tab.planet": { es: "Planeta", en: "Planet" },
  "tab.history": { es: "Historia", en: "History" },
  "tab.log": { es: "Bitácora", en: "Log" },
  "tab.saves": { es: "Guardados", en: "Saves" },

  // ---- Secciones ----
  "sec.milestone": { es: "Siguiente hito", en: "Next milestone" },
  "sec.progress": { es: "Progreso de la partida", en: "World progress" },
  "sec.inventory": { es: "Inventario de construcciones", en: "Building inventory" },
  "sec.stored": { es: "Materiales almacenados", en: "Stored materials" },
  "sec.exploration": { es: "Exploración", en: "Exploration" },
  "sec.history": { es: "Evolución", en: "Evolution" },
  "sec.energy": { es: "Energía en el tiempo", en: "Power over time" },
  "energy.need2": {
    es: "Hacen falta al menos dos lecturas con datos de energía. Guarde la partida un par de veces más y FICSIT tendrá algo que graficar.",
    en: "At least two readings with power data are required. Save the game a couple more times and FICSIT will have something to plot.",
  },
  "energy.use": { es: "Consumo", en: "Demand" },
  "energy.gen": { es: "Generación", en: "Generation" },
  "energy.margin_ok": {
    es: "Margen de {n} MW. Suficiente para dormir tranquilo, insuficiente para presumir.",
    en: "A {n} MW margin. Enough to sleep soundly, not enough to brag.",
  },
  "energy.margin_bad": {
    es: "Consume {n} MW más de lo que genera. La red aguanta hasta que no aguanta.",
    en: "Drawing {n} MW more than you generate. The grid holds until it doesn't.",
  },
  "hist.pick_buildings": { es: "Construcciones", en: "Buildings" },
  "hist.pick_power": { es: "Consumo (MW)", en: "Demand (MW)" },
  "hist.pick_gen": { es: "Generación (MW)", en: "Generation (MW)" },
  "hist.pick_prod": { es: "Piezas/min", en: "Parts/min" },
  "hist.pick_hours": { es: "Horas jugadas", en: "Hours played" },
  "settings.icons": { es: "Iconos de las piezas (opcional)", en: "Part icons (optional)" },
  "ico.none": {
    es: "La app funciona perfectamente sin esto. Los iconos son adorno: las listas se leen igual con los nombres. Esto es para quien YA tenga los iconos del juego extraídos y quiera verlos aquí.",
    en: "The app works perfectly well without this. The icons are decoration: the lists read the same with names. This is for someone who ALREADY has the game's icons extracted and wants to see them here.",
  },
  "ico.some": {
    es: "{n} iconos localizados, {m} piezas emparejadas.",
    en: "{n} icons found, {m} parts matched.",
  },
  "ico.how": {
    es: "Sacarlos requiere un programa aparte (FModel o UE Viewer), abrir con él los archivos del juego y exportar las texturas de interfaz. Es un rato de trabajo por una mejora estética, así que no hay ninguna prisa — ni ninguna necesidad. Si ya los tiene, suéltelos en la carpeta y pulse Volver a buscar.",
    en: "Getting them out needs a separate program (FModel or UE Viewer), opening the game's files with it and exporting the interface textures. It is a chunk of work for a cosmetic gain, so there is no hurry — and no need. If you already have them, drop them in the folder and press Scan again.",
  },
  "ico.expects": { es: "Espera archivos con nombres de esta forma:", en: "It expects files named like this:" },
  "ico.mismatch": {
    es: "Hay archivos pero ninguno encaja. Encontré «{got}» y esperaba algo del estilo de «{want}». Exporte conservando el nombre original del asset, sin renombrar ni numerar.",
    en: "There are files but none match. I found “{got}” and expected something like “{want}”. Export keeping the asset's original name, without renaming or numbering.",
  },
  "ico.open": { es: "Abrir carpeta", en: "Open folder" },
  "ico.scan": { es: "Volver a buscar", en: "Scan again" },
  "ico.needdocs": {
    es: "Primero hacen falta los datos del juego: sin ellos no sabemos qué icono lleva cada pieza.",
    en: "Game data is required first: without it we do not know which icon belongs to which part.",
  },
  "ico.credit": {
    es: "Los iconos son obra de Coffee Stain Studios. OttO no está afiliado a Coffee Stain y retiraría esta función si lo pidieran.",
    en: "The icons are the work of Coffee Stain Studios. OttO is not affiliated with Coffee Stain and would remove this feature if asked.",
  },
  "alert.title": { es: "Avisos de planta · {n}", en: "Floor alerts · {n}" },
  "alert.note_bad": {
    es: "Esto no está produciendo. Pulse en cualquier aviso y le llevamos al sitio exacto del mapa.",
    en: "This is not producing. Click any alert and we take you to the exact spot on the map.",
  },
  "alert.only_slow": {
    es: "Nada parado. {n} grupo(s) van por debajo del 60%, que en esta industria suele ser una decisión y no una avería.",
    en: "Nothing stopped. {n} group(s) run below 60%, which in this industry is usually a decision rather than a fault.",
  },
  "alert.plus_slow": {
    es: "Otros {n} grupo(s) van a medio gas. No se listan: por debajo del 100% se vive perfectamente.",
    en: "Another {n} group(s) run at half steam. Not listed: below 100% is a perfectly livable life.",
  },
  "vitals.dry": {
    es: "No se cuentan {mw} MW de {n} generador(es) sin combustible. Están puestos, pero puestos no es lo mismo que encendidos, por mucho que el catálogo diga otra cosa.",
    en: "{mw} MW from {n} generator(s) out of fuel are not counted. They are installed, but installed is not the same as running, whatever the catalogue says.",
  },
  "alert.dry": { es: "sin combustible", en: "out of fuel" },
  "alert.note_dry": {
    es: "Hay generadores sin combustible. Lo que aparezca parado más abajo probablemente sea consecuencia de esto y no un problema aparte: sin energía, la planta entera se para. Pulse cualquier aviso y le llevamos al sitio.",
    en: "There are generators out of fuel. Anything listed as stopped below is probably a consequence of that rather than a separate problem: with no power, the whole plant halts. Click any alert and we take you there.",
  },
  "alert.away": { es: "a {n} m de usted", en: "{n} m from you" },
  "cmp.vs": { es: "Comparar con ", en: "Compare with " },
  "cmp.none": { es: "nada", en: "nothing" },
  "cmp.week": { es: "hace una semana", en: "a week ago" },
  "cmp.month": { es: "hace un mes", en: "a month ago" },
  "cmp.first": { es: "la primera lectura", en: "the first reading" },
  "cmp.new": { es: "nuevo", en: "new" },
  "cmp.was": { es: "antes tenía {n}", en: "previously {n}" },
  "cmp.gone": { es: "Aquí había un montaje de {n} máquinas. Ya no está.", en: "A block of {n} machines stood here. Not any more." },
  "cmp.summary": {
    es: "Frente a la lectura del {d}: {g} montaje(s) han crecido, {n} son nuevos y {x} han desaparecido. Los que no han cambiado no se marcan.",
    en: "Against the reading of {d}: {g} block(s) grew, {n} are new and {x} are gone. Unchanged ones are not marked.",
  },
  "sec.danger": { es: "Fauna", en: "Fauna" },
  "fauna.title": { es: "Bestiario · {n} especie(s)", en: "Bestiary · {n} species" },
  "fauna.note": {
    es: "Solo entra lo que se ha cruzado de verdad, por tres caminos: lo tenía cerca al guardar, sus restos pasaron por su inventario, o lo abatió — el juego lleva su propio recuento de bajas por especie, y ese sí distingue a un alfa de uno corriente. La ficha se llena jugando y no se vacía. Aviso de FICSIT: el archivo no dice qué bicho vive en cada nido, así que esto es lo que se ha encontrado, no lo que hay.",
    en: "Only what you have actually run into gets in, by three routes: it was near you when you saved, its remains passed through your inventory, or you killed it — the game keeps its own kill tally per species, and that one does tell an alpha from an ordinary one. The file fills as you play and never empties. FICSIT notice: the save does not say which creature lives in each nest, so this is what you have met, not what is out there.",
  },
  "fauna.wiki": { es: "Ficha en la wiki ↗", en: "Wiki page ↗" },
  "fauna.ev_seen": { es: "visto", en: "seen" },
  "fauna.ev_hunted": { es: "cazado", en: "hunted" },
  "fauna.ev_kills": { es: "{n} abatido(s)", en: "{n} killed" },
  "fauna.only_remains": {
    es: "No lo ha tenido delante al guardar, pero sus restos han pasado por su inventario. Eso ya cuenta como presentación.",
    en: "You have not had one in front of you when saving, but its remains have passed through your inventory. That counts as an introduction.",
  },
  "fauna.hostile": { es: "hostil", en: "hostile" },
  "fauna.passive": { es: "pacífica", en: "passive" },
  "fauna.unknown": { es: "sin clasificar", en: "unclassified" },
  "fauna.here": { es: "{n} en esta partida", en: "{n} in this save" },
  "fauna.destroyed": { es: "{n} destruido(s)", en: "{n} destroyed" },
  "fauna.not_now": { es: "ahora mismo no hay ninguno cerca", en: "none nearby right now" },
  "fauna.first": { es: "visto por primera vez el {d}", en: "first seen on {d}" },
  "layer.nest": { es: "Nidos", en: "Nests" },
  "nest.one": { es: "Nido de {n}", en: "Nest of {n}" },
  "nest.never": { es: "sin limpiar", en: "never cleared" },
  "nest.cleared": { es: "limpiado", en: "cleared" },
  "nest.cleared_ago": { es: "limpiado hace {d} día(s)", en: "cleared {d} day(s) ago" },
  "danger.seen": { es: "Nidos localizados", en: "Nests located" },
  "danger.cleared": { es: "Limpiados", en: "Cleared" },
  "danger.near": { es: "Junto a la fábrica", en: "Next to the factory" },
  "danger.at": { es: "a {n} m de lo construido", en: "{n} m from what you built" },
  "danger.open": {
    es: "{n} de ellos no los ha tocado nunca, y comparten vecindario con su planta:",
    en: "{n} of them you have never touched, and they share a neighbourhood with your plant:",
  },
  "danger.closest": { es: "El más cercano", en: "Nearest one" },
  "danger.last_hunt": { es: "Última cacería", en: "Last hunt" },
  "danger.days_ago": { es: "hace {n} día(s)", en: "{n} day(s) ago" },
  "danger.note": {
    es: "Solo los nidos que su partida conoce, que son los de las zonas por las que ha pasado. No es una lista de tareas: convivir con ellos es una opción perfectamente válida, y además lo limpiado vuelve — FICSIT considera la repoblación de fauna hostil un fenómeno natural y no una incidencia laboral.",
    en: "Only the nests your save knows about, which are those in the areas you have been through. This is not a to-do list: living alongside them is a perfectly valid choice, and what you cleared comes back anyway — FICSIT considers hostile fauna repopulation a natural phenomenon and not a workplace incident.",
  },
  "vitals.safe": { es: "Sin accidentes", en: "Accident-free" },
  "vitals.safe_n": { es: "{n} día(s)", en: "{n} day(s)" },
  "ms.needdocs": {
    es: "FICSIT no puede decirle qué toca ahora porque todavía no ha leído la documentación del juego. Abra Ajustes arriba: si tiene Satisfactory instalado, la encuentra sola y esto se llena de hitos.",
    en: "FICSIT cannot tell you what comes next because it has not read the game's documentation yet. Open Settings at the top: if Satisfactory is installed, it finds it on its own and this fills with milestones.",
  },
  "map.fog": { es: "Niebla ({n}% visto)", en: "Fog ({n}% seen)" },
  "map.scope_factory": { es: "Ver el planeta", en: "Show the planet" },
  "map.scope_world": { es: "Ver solo la fábrica", en: "Show the factory only" },
  "layer.collect": { es: "Por recoger", en: "Uncollected" },
  "expl.explored": { es: "{n}% del planeta explorado", en: "{n}% of the planet explored" },
  "expl.hidden": {
    es: "Hay {n} cosa(s) más ahí fuera, en terreno que no ha pisado. No le decimos dónde: esta tablet le ayuda con lo que ya conoce, no le hace el trabajo de explorar.",
    en: "There are {n} more thing(s) out there, in ground you have not walked. We are not telling you where: this tablet helps with what you already know, it does not do your exploring for you.",
  },
  "expl.nearest": { es: "el más cercano a {n} m", en: "nearest {n} m away" },
  "expl.note_map": {
    es: "Pulse un tipo y lo verá en el mapa, solo ese. Vuelva a pulsarlo para verlos todos. La distancia es en línea recta: los barrancos los pone el planeta, no nosotros.",
    en: "Click a kind to see it on the map, that one alone. Click again for all of them. The distance is as the crow flies: the cliffs are the planet's doing, not ours.",
  },
  "map.track": { es: "Rastro ({n})", en: "Track ({n})" },
  "map.you": { es: "Usted estaba aquí", en: "You were here" },
  "alert.at": { es: "al {n}% de productividad", en: "at {n}% productivity" },
  "alert.see": { es: "Ver en el mapa", en: "Show on map" },
  "alert.loose": { es: "fuera de todo montaje", en: "outside any block" },
  "alert.more": { es: "Y {n} grupo(s) más, de menos entidad.", en: "And {n} more group(s), of lesser note." },
  "alert.foot": {
    es: "La productividad la mide el juego, no nosotros: es cuánto tiempo del último tramo estuvo la máquina trabajando de verdad. Baja significa que algo no llega o que la salida está llena — FICSIT no distingue entre pasar hambre y atragantarse.",
    en: "Productivity is the game's own measure, not ours: how much of the last stretch the machine actually worked. Low means something is not arriving or the output is backed up — FICSIT does not distinguish between starving and choking.",
  },
  "map.fit": { es: "Encuadrar", en: "Fit view" },
  "map.locate": { es: "Ver en el mapa", en: "Show on map" },
  "bal.title": { es: "Balance de la cadena", en: "Chain balance" },
  "bal.note": {
    es: "Solo las piezas que su cadena consume: a la izquierda lo que falta, a la derecha el margen que sobra. Lo que fabrica y nadie consume no aparece aquí, porque no hay balance que medir.",
    en: "Only the parts your chain consumes: shortfall on the left, spare margin on the right. What you make and nobody consumes is absent here, because there is no balance to measure.",
  },
  "bal.ok": {
    es: "Ni un déficit. Alguien ha estado haciendo los cálculos, y sospechamos que no ha sido FICSIT.",
    en: "Not one shortfall. Someone has been doing the maths, and we suspect it was not FICSIT.",
  },
  "buf.title": { es: "Tus almacenes", en: "Your storage" },
  "buf.inline": { es: "Intercalados en línea", en: "Inline on a belt" },
  "buf.inlineSub": { es: "no suben el caudal", en: "do not raise throughput" },
  "buf.end": { es: "Al final de línea", en: "At the end of a line" },
  "buf.endSub": { es: "eso es almacenar", en: "that is storing" },
  "buf.loose": { es: "Sin cintas al lado", en: "No belts nearby" },
  "buf.looseSub": { es: "se llenan a mano", en: "filled by hand" },
  "buf.note": {
    es: "Con piezas, un contenedor NO sube el caudal: lo que entra por una cinta sale por la otra a la misma velocidad. Lo único que da es margen — si el suministro se corta, lo guardado mantiene trabajando un rato a lo que va detrás. Con fluidos sí es distinto, y de ahí viene la idea: un depósito estabiliza la presión de una red de tuberías y las bombas sirven para subir en altura. Una cinta no tiene presión que estabilizar ni altura que vencer.",
    en: "For solid parts, a container does NOT raise throughput: what comes in on one belt goes out on the other at the same speed. All it buys is time — if supply stops, what is stored keeps whatever is downstream running for a while. Fluids really are different, which is where the idea comes from: a tank steadies the pressure of a pipe network and pumps exist to climb. A belt has no pressure to steady and no height to beat.",
  },
  "alt.title": { es: "Alternativas que tienes", en: "Alternates you have" },
  "alt.perUnit": { es: "Por unidad producida", en: "Per unit produced" },
  "alt.perMachine": { es: "Por máquina: {a} → {b} /min", en: "Per machine: {a} → {b} /min" },
  "alt.gone": { es: "ya no hace falta", en: "no longer needed" },
  "alt.new": { es: "nuevo", en: "new" },
  "alt.less": { es: "−{n}% {item}", en: "−{n}% {item}" },
  "alt.nocomp": {
    es: "No hay receta estándar con la que comparar: esto no ahorra, permite fabricarlo de otra manera.",
    en: "There is no standard recipe to compare against: this does not save anything, it lets you make it another way.",
  },
  "alt.note": {
    es: "Sacadas de los discos duros de esta partida, y sólo de piezas que fabricas ahora mismo. El porcentaje es de materiales que siguen haciendo falta en las dos recetas: lo que desaparece se cambia por otra cosa, no se ahorra.",
    en: "Taken from this save's hard drives, and only for parts you are making right now. The percentage covers materials still needed by both recipes: what disappears is swapped for something else, not saved.",
  },
  "sec.calc": { es: "Calculadora de producción", en: "Production calculator" },
  "sec.vitals": { es: "Signos vitales", en: "Vital signs" },
  "sec.zones": { es: "Zonas", en: "Zones" },

  // ---- Tabla de guardados ----
  "saves.name": { es: "Partida", en: "Save" },
  "saves.played": { es: "Tiempo jugado", en: "Play time" },
  "saves.saved": { es: "Guardada", en: "Saved" },
  // ---- Chapas de la lista de guardados ----
  "tag.mods": { es: "{n} mods", en: "{n} mods" },
  "tag.modsTitle": {
    es: "Esta partida necesita estos mods para abrirse en el juego:",
    en: "This save needs these mods to open in the game:",
  },
  "tag.oldFormat": { es: "formato v{v}", en: "format v{v}" },
  "tag.oldFormatTitle": {
    es: "Guardada con un formato anterior (v{v}) al de tus partidas más nuevas (v{n}).",
    en: "Saved in an older format (v{v}) than your newest saves (v{n}).",
  },
  "tag.creative": { es: "creativa", en: "creative" },

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
  "map.aboveGround": { es: "{a} – {b} m sobre el suelo", en: "{a} – {b} m above ground" },
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
  "tab.plan": { es: "Plano", en: "Plan" },
  "pl.room": { es: "Sala", en: "Room" },
  "pl.metres": { es: "m", en: "m" },
  "pl.rotate": { es: "Girar", en: "Rotate" },
  "pl.remove": { es: "Quitar", en: "Remove" },
  "pl.clear": { es: "Vaciar", en: "Clear" },
  "pl.note": {
    es: "Mide si cabe y cuánto suelo sobra, con las medidas reales del juego. Las cintas las pones tú en el juego: de eso sabe él, que tiene física.",
    en: "Measures whether it fits and how much floor is left, using the game's own dimensions. You run the belts in the game: that is what it is good at, it has physics.",
  },
  "pl.need": { es: "Necesitas datos del juego para planificar.", en: "Planning needs the game data." },
  "pl.empty": { es: "Suelta máquinas de la lista.", en: "Drop machines from the list." },
  "pl.floor": { es: "Suelo", en: "Floor" },
  "pl.free": { es: "{n} m² libres", en: "{n} m² free" },
  "pl.fits": { es: "Cabe en {d}", en: "Fits a {d}" },
  "pl.nofit": {
    es: "No cabe en ningún diseñador: te pasas {w} m de ancho y {d} m de fondo.",
    en: "Too big for any designer: {w} m over wide and {d} m over deep.",
  },
  "pl.over": { es: "{n} fuera de la sala", en: "{n} outside the room" },
  "pl.clash": { es: "{n} solapadas", en: "{n} overlapping" },
  "pl.blocked": { es: "{n} con la boca tapada", en: "{n} with a blocked end" },
  "pl.want": { es: "Quiero", en: "I want" },
  "pl.align": { es: "Centrar", en: "Centre" },
  "pl.cost": { es: "Llevar encima:", en: "Take with you:" },
  "pl.costNote": {
    es: "incluye {n} cimientos · sin cintas ni tuberías",
    en: "includes {n} foundations · belts and pipes not counted",
  },
  "pl.fix": { es: "ponla de {w}×{d}", en: "make it {w}×{d}" },
  "pl.toobig": {
    es: "Ni agrandando la sala: baja el objetivo o los niveles.",
    en: "No room size fits it: lower the target or the levels.",
  },
  "pl.m_mix": { es: "Una sala", en: "One room" },
  "pl.m_vert": { es: "Por plantas", en: "By floors" },
  "pl.m_side": { es: "Salas al lado", en: "Rooms side by side" },
  "pl.m_up": { es: "avanzado arriba", en: "advanced on top" },
  "pl.level": { es: "Planta {n}", en: "Floor {n}" },
  "pl.height": { es: "{n} m de alto", en: "{n} m tall" },
  "pl.founds": { es: "{n} cimientos", en: "{n} foundations" },
  "pl.tall": {
    es: "La {m} mide {h} m: esta planta no cabe en un cimiento.",
    en: "The {m} is {h} m tall: this floor needs more than one foundation.",
  },
  // "Niveles" apuntaba al sitio equivocado: parecia plantas, sobre todo con
  // "Por plantas" en el desplegable de al lado. No lo es. Este numero va a
  // solveChain y dice cuanto se retrocede por la cadena de recetas.
  "pl.depth": { es: "Cadena", en: "Chain" },
  "pl.phItem": { es: "Plancha de hierro", en: "Iron Plate" },
  "pl.steps": { es: "pasos atrás", en: "steps back" },
  "pl.depthNote": {
    es: "«Cadena» es cuánto se planifica hacia atrás, no cuántas plantas tiene: con 2 pasos se colocan la máquina final y la que la alimenta. Lo que queda fuera no desaparece, sale en «Hay que traer» — eso es lo que tendrás que llevar con cintas desde otro sitio.",
    en: "\"Chain\" is how far back the plan reaches, not how many floors it has: with 2 steps you get the final machine and the one feeding it. What falls outside does not vanish, it shows up under \"Bring in\" — that is what you will have to belt in from somewhere else.",
  },
  "pl.build": { es: "Montar", en: "Lay out" },
  "pl.unknown": { es: "No conozco esa pieza.", en: "I don't know that part." },
  "pl.noRecipe": { es: "Esa pieza no se fabrica en ninguna máquina.", en: "Nothing manufactures that part." },
  "pl.feed": { es: "Hay que traer:", en: "Bring in:" },
  "pl.tight": {
    es: "{n} máquinas no caben en la sala. Agrándala o baja el objetivo.",
    en: "{n} machines don't fit. Make the room bigger or lower the target.",
  },
  "pl.ports": {
    es: "Los triángulos son cintas y los círculos tuberías. El punteado es el hueco que hace falta para engancharlas: si se pone rojo, ahí no entra una cinta.",
    en: "Triangles are belts, circles are pipes. The dotted margin is the room a belt needs: if it turns red, nothing can connect there.",
  },
  "pl.ok": { es: "Todo encaja", en: "Everything fits" },
  "pl.count": { es: "{n} máquinas", en: "{n} machines" },
  "sec.career": { es: "Hecho a mano", en: "Done by hand" },
  "car.none": {
    es: "El guardado no trae estos contadores todavía.",
    en: "The save doesn't carry these counters yet.",
  },
  "car.picked": { es: "Recogido del suelo", en: "Picked up" },
  "car.crafted": { es: "Fabricado a mano", en: "Hand-crafted" },
  "car.consumed": { es: "Consumido", en: "Consumed" },
  "car.killed": { es: "Bajas", en: "Kills" },
  "car.types": { es: "{n} tipos", en: "{n} kinds" },
  "car.types_one": { es: "1 tipo", en: "1 kind" },
  "car.note": {
    es: "Lo que has hecho tú, no tus máquinas. El juego lleva esta cuenta desde el primer día.",
    en: "What you did yourself, not your machines. The game has counted this since day one.",
  },
  "upd.found": {
    es: "Hay una versión nueva: {v}.",
    en: "A new version is available: {v}.",
  },
  "upd.install": { es: "Instalar y reiniciar", en: "Install and restart" },
  "upd.later": { es: "Luego", en: "Later" },
  "upd.working": { es: "Descargando…", en: "Downloading…" },
  "upd.failed": {
    es: "No se pudo instalar. Queda para la próxima vez.",
    en: "Couldn't install. It'll try again next time.",
  },
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
  "plan.phType": { es: "Tipo (ej: Constructor Mk1)", en: "Type (e.g. Constructor Mk1)" },
  "plan.phQty": { es: "Cantidad", en: "Amount" },

  // ---- Progreso del mundo ----
  "prog.tier": { es: "Tier actual", en: "Current tier" },
  "prog.milestones": { es: "Hitos completados", en: "Milestones completed" },
  "prog.research": { es: "Investigaciones (MAM)", en: "Research (MAM)" },

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
  "calc.perMin": { es: "/min de", en: "/min of" },
  "calc.go": { es: "Calcular", en: "Calculate" },
  "calc.locked": {
    es: "Mostrando solo lo desbloqueado en este mundo (Tier {t}). {n} receta(s) de tiers superiores ocultas.",
    en: "Showing only what is unlocked in this world (Tier {t}). {n} recipe(s) from higher tiers hidden.",
  },
  "calc.head": { es: "Para <b>{rate}/min</b> de <b>{item}</b>:", en: "For <b>{rate}/min</b> of <b>{item}</b>:" },
  "calc.miner1": { es: "≈1 minero Mk1", en: "≈1 Mk1 miner" },
  "calc.minerN": { es: "≈{n} mineros Mk1", en: "≈{n} Mk1 miners" },
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
  // Etiquetas de la partida abierta. El nombre del archivo
  // ("Lurra bi_autosave_2.sav") no dice nada util: repite el mundo, que ya
  // esta en el hexagono de arriba, y "autosave_2" no responde a lo unico que
  // se pregunta ahi, que es cual es y de cuando.
  "save.auto": { es: "Autoguardado {n}", en: "Autosave {n}" },
  "save.manual": { es: "Guardado manual", en: "Manual save" },
  "save.played": { es: "{t} jugadas", en: "{t} played" },
  // Plurales aparte en vez de "{n} minuto(s)": los dos idiomas los distinguen
  // y la funcion de traduccion solo sustituye, no conjuga.
  "when.now": { es: "ahora mismo", en: "just now" },
  "when.min1": { es: "hace 1 minuto", en: "1 minute ago" },
  "when.minN": { es: "hace {n} minutos", en: "{n} minutes ago" },
  "when.hour1": { es: "hace 1 hora", en: "1 hour ago" },
  "when.hourN": { es: "hace {n} horas", en: "{n} hours ago" },
  "when.day1": { es: "ayer", en: "yesterday" },
  "when.dayN": { es: "hace {n} días", en: "{n} days ago" },
  "when.month1": { es: "hace 1 mes", en: "1 month ago" },
  "when.monthN": { es: "hace {n} meses", en: "{n} months ago" },
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

  // ---- Logros ----
  "ach.review": { es: "Evaluación de Desempeño", en: "Performance Review" },
  "ach.thisMonth": { es: "Mes en curso", en: "Current month" },
  "ach.history": { es: "Meses anteriores", en: "Previous months" },
  "ach.certs": { es: "Certificaciones", en: "Certifications" },
  "ach.noData": {
    es: "Sin histórico de este mundo. Abre algún guardado o impórtalos desde la pestaña Guardados.",
    en: "No history for this world. Open a save or import them from the Saves tab.",
  },
  "ach.needTwo": {
    es: "Una sola lectura este mes. No se puede evaluar un mes del que solo hay una foto.",
    en: "A single reading this month. A month with one snapshot cannot be assessed.",
  },
  "ach.toNext": { es: "faltan {n} {unit} para {grade}", en: "{n} {unit} to {grade}" },
  "ach.before": { es: "no después del", en: "no later than" },
  "ach.noCerts": {
    es: "Ninguna certificación todavía. Se conceden solas según avance la partida.",
    en: "No certifications yet. They are granted on their own as the save progresses.",
  },
  "ach.retro": {
    es: "Las medallas no se guardan: se recalculan desde tu histórico cada vez. Por eso aparecen con la fecha en la que de verdad te las ganaste, aunque la medalla se haya inventado después.",
    en: "Medals are not stored: they are recomputed from your history every time. That is why they carry the date you actually earned them, even when the medal itself was invented later.",
  },
  // Las conclusiones del mes, en el tono de la casa.
  "ach.verdict.0": {
    es: "No consta actividad reseñable. FICSIT no juzga; FICSIT registra.",
    en: "No notable activity on record. FICSIT does not judge; FICSIT records.",
  },
  "ach.verdict.1": {
    es: "Rendimiento por debajo de lo esperado. Se le anima a corregirlo.",
    en: "Performance below expectations. You are encouraged to correct this.",
  },
  "ach.verdict.2": {
    es: "Rendimiento dentro de parámetros. Prosiga.",
    en: "Performance within parameters. Carry on.",
  },
  "ach.verdict.3": {
    es: "Rendimiento satisfactorio. No se acostumbre.",
    en: "Performance satisfactory. Do not get used to it.",
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
  // Botones que son solo un icono: sin texto dentro, el nombre accesible y el
  // globo de ayuda son lo unico que dice que hacen, y los dos hay que
  // traducirlos como cualquier otro texto.
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria!));
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-at]").forEach((el) => {
    const s = t(el.dataset.i18nAt!);
    el.setAttribute("aria-label", s);
    el.setAttribute("title", s);
  });
}
