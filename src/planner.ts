// El planificador: colocar la fábrica antes de construirla.
//
// La idea es de Zigor y nombra un dolor que nadie resuelve. Calcular ritmos lo
// hace cualquiera; lo que no hace nadie es dejarte MIRAR la disposición antes
// de levantarla. Desmontar algo que no te gustó cuesta tanto tiempo como
// construirlo, y ese tiempo no lo recupera nadie.
//
// Lo que esta primera versión promete, y nada más:
//
//   - caben o no caben, con las medidas de verdad del juego
//   - cuánto suelo te sobra
//   - en qué diseñador de planos entra, o por cuánto te pasas
//
// Lo que NO promete, a propósito: que las cintas vayan a enrutarse por ahí. Las
// cintas son el problema duro y el reparto acordado es que de eso se encarga el
// juego, que tiene física de verdad. Fíjate en que la cinta transportadora es
// justo el único elemento sin caja de medidas en toda la documentación: son
// curvas, no cajas. Los datos ya avisan de dónde está lo difícil.

export interface Placed {
  id: number;
  cls: string;
  /// Esquina superior izquierda, en metros desde la esquina de la sala.
  x: number;
  y: number;
  /// 0 o 90 grados. Girar intercambia ancho y fondo, que es lo único que
  /// importa para saber si cabe.
  rot: 0 | 90;
  /// Planta. 0 es la de abajo. Dos máquinas en plantas distintas nunca chocan,
  /// por evidente que parezca: hubo que decirlo en el código.
  level?: number;
}

export interface Size {
  w: number;
  d: number;
  h: number;
}

/** Huella efectiva de una pieza ya girada. */
export function footprint(size: Size, rot: 0 | 90): { w: number; d: number } {
  return rot === 90 ? { w: size.d, d: size.w } : { w: size.w, d: size.d };
}

export interface Room {
  w: number;
  d: number;
}

/** Un cimiento de Satisfactory mide ocho metros. Todo el juego cuenta así. */
export const FOUNDATION = 8;

/**
 * El diseñador de planos más pequeño donde cabe la sala, de los que se le
 * pasen. Devuelve null si no cabe en ninguno, que también es una respuesta
 * util: significa partir el diseño.
 */
export function designerFor(
  room: Room,
  designers: { cls: string; name: string; side: number }[]
): { cls: string; name: string; side: number; metres: number } | null {
  const fits = designers
    .map((d) => ({ ...d, metres: d.side * FOUNDATION }))
    .filter((d) => room.w <= d.metres && room.d <= d.metres)
    .sort((a, b) => a.side - b.side);
  return fits[0] || null;
}

/** Por cuántos metros se pasa del diseñador más grande que haya. */
export function overBy(
  room: Room,
  designers: { side: number }[]
): { w: number; d: number } | null {
  if (!designers.length) return null;
  const max = Math.max(...designers.map((d) => d.side)) * FOUNDATION;
  const w = Math.max(0, room.w - max);
  const d = Math.max(0, room.d - max);
  return w > 0 || d > 0 ? { w, d } : null;
}

function overlaps(
  a: { x: number; y: number; w: number; d: number },
  b: { x: number; y: number; w: number; d: number }
): boolean {
  // Tocarse no es solaparse: dos máquinas pegadas lado con lado son legales en
  // el juego, y en una fábrica apretada es justo lo que quieres. Por eso los
  // límites son estrictos y no incluyen la igualdad.
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
}

export interface Problem {
  id: number;
  kind: "fuera" | "solapa" | "boca";
  with?: number;
}

/**
 * Hueco que hay que dejar delante y detrás de una máquina para engancharle las
 * cintas.
 *
 * ESTE NÚMERO ES UN CRITERIO NUESTRO, NO UN DATO DEL JUEGO. Conviene que quede
 * dicho, porque el resto del planificador sí sale de la documentación y sería
 * fácil darlo por derivado.
 *
 * Lo que la documentación sí dice: la cinta se construye en trozos de malla de
 * 200 cm (`mMeshLength`), o sea dos metros, y la tubería tiene 65 cm de radio
 * (`mRadius`), o sea 1,3 m de ancho. Lo que NO dice: ni longitud mínima ni
 * máxima de una tirada. Ese tope vive en el código del juego, no en el JSON, y
 * no nos lo vamos a inventar.
 *
 * Un metro, no dos. Con dos, cualquier sala apretada salía roja entera y la
 * alarma dejaba de significar nada, que es la peor forma de romper una alarma.
 * Y además era falso: en el juego dos máquinas enfrentadas se unen con una
 * cinta cortísima. Lo que de verdad impide conectar es que la boca quede
 * PEGADA al cuerpo de otra, y eso es lo que mide un metro.
 */
export const PORT_CLEAR = 1;

/**
 * Las dos bocas de una máquina, como rectángulos del suelo que deben quedar
 * libres.
 *
 * Dónde están exactamente las bocas NO está en la documentación del juego:
 * los campos mFactoryInputConnections y mFactoryOutputConnections vienen
 * vacíos porque las conexiones viven en la malla del edificio, no en el JSON.
 *
 * Lo que sí es cierto en todas las máquinas de producción es que las cintas
 * entran y salen por las caras perpendiculares al lado LARGO: el flujo corre a
 * lo largo. Por eso la regla que se comprueba no es "esta boca concreta está
 * tapada" --que seria inventarse un dato-- sino "los extremos estan libres",
 * que es verdad para todas y es el error que de verdad cuesta tiempo: colocas
 * bien las maquinas y luego la salida de una mira al costado de la vecina.
 *
 * Las tuberías son otra cosa y no se comprueban: suben y van por encima, así
 * que no dependen de que el suelo de al lado esté libre.
 */
export function portZones(
  it: Placed,
  size: Size
): { x: number; y: number; w: number; d: number }[] {
  const f = footprint(size, it.rot);
  // El flujo va por el lado largo. En empate, por el fondo.
  const alongY = f.d >= f.w;
  if (alongY) {
    return [
      { x: it.x, y: it.y - PORT_CLEAR, w: f.w, d: PORT_CLEAR },
      { x: it.x, y: it.y + f.d, w: f.w, d: PORT_CLEAR },
    ];
  }
  return [
    { x: it.x - PORT_CLEAR, y: it.y, w: PORT_CLEAR, d: f.d },
    { x: it.x + f.w, y: it.y, w: PORT_CLEAR, d: f.d },
  ];
}

/**
 * Qué está mal en la sala. Devuelve una entrada por pieza problemática; una
 * pieza puede salir dos veces si además de solapar se sale de la sala.
 */
export function levelOf(it: Placed): number {
  return it.level || 0;
}

/** Las plantas que tienen algo, de abajo arriba. */
export function levels(items: Placed[]): number[] {
  return [...new Set(items.map(levelOf))].sort((a, b) => a - b);
}

/**
 * Altura que necesita una planta: su máquina más alta.
 *
 * Importa más de lo que parece. Un cimiento son ocho metros, y hay tres
 * máquinas de producción que no caben en uno: la refinería mide 15, la
 * envasadora 12 y el productor 11. Plantar una refinería en una nave de un
 * cimiento de alto no se descubre planificando, se descubre construyendo.
 */
export function levelHeight(
  items: Placed[],
  level: number,
  sizeOf: (cls: string) => Size | null
): number {
  let h = 0;
  for (const it of items) {
    if (levelOf(it) !== level) continue;
    const s = sizeOf(it.cls);
    if (s) h = Math.max(h, s.h);
  }
  return Math.round(h * 10) / 10;
}

/** Cimientos de 8 m que hacen falta para cubrir esa altura. */
export function levelFoundations(height: number): number {
  return Math.max(1, Math.ceil(height / FOUNDATION));
}

export function problems(
  items: Placed[],
  room: Room,
  sizeOf: (cls: string) => Size | null
): Problem[] {
  const boxes = items
    .map((it) => {
      const s = sizeOf(it.cls);
      if (!s) return null;
      const f = footprint(s, it.rot);
      return { id: it.id, lv: levelOf(it), x: it.x, y: it.y, w: f.w, d: f.d };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  const out: Problem[] = [];
  for (const b of boxes) {
    if (b.x < 0 || b.y < 0 || b.x + b.w > room.w + 0.001 || b.y + b.d > room.d + 0.001) {
      out.push({ id: b.id, kind: "fuera" });
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].lv === boxes[j].lv && overlaps(boxes[i], boxes[j])) {
        out.push({ id: boxes[i].id, kind: "solapa", with: boxes[j].id });
        out.push({ id: boxes[j].id, kind: "solapa", with: boxes[i].id });
      }
    }
  }

  // Bocas tapadas: un extremo contra otra máquina. Salirse de la sala por un
  // extremo NO cuenta — una cinta puede entrar desde fuera por la pared, y
  // avisar de eso convertiría el plano en un campo de rojos inútil.
  for (const it of items) {
    const s = sizeOf(it.cls);
    if (!s) continue;
    for (const z of portZones(it, s)) {
      const choca = boxes.some(
        (b) => b.id !== it.id && b.lv === levelOf(it) && overlaps(z, b)
      );
      if (choca) {
        out.push({ id: it.id, kind: "boca" });
        break;
      }
    }
  }
  return out;
}

/**
 * Suelo ocupado y libre, en metros cuadrados. Se suman las huellas sin
 * descontar solapes: si dos piezas se pisan el total mentiría a la baja, y
 * mientras haya un solape el número no debería tranquilizar a nadie.
 */
export function floorUse(
  items: Placed[],
  room: Room,
  sizeOf: (cls: string) => Size | null
): { used: number; total: number; free: number; pct: number } {
  let used = 0;
  for (const it of items) {
    const s = sizeOf(it.cls);
    if (!s) continue;
    const f = footprint(s, it.rot);
    used += f.w * f.d;
  }
  const total = room.w * room.d;
  used = Math.round(used * 10) / 10;
  return {
    used,
    total,
    free: Math.round((total - used) * 10) / 10,
    pct: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0,
  };
}

/** Ajusta a la rejilla. Un metro: más fino es ruido y más gordo no deja apretar. */
export function snap(v: number, grid = 1): number {
  return Math.round(v / grid) * grid;
}

// ---------------------------------------------------------------------------
// Del objetivo a las máquinas
//
// "Quiero 60 planchas de hierro por minuto" -> cuántos constructores, cuántos
// hornos, y colocados en la sala. Es la otra mitad de la idea: sin esto el
// plano es una herramienta de dibujo; con esto es una de decisión.
//
// Se resuelve contra las recetas del juego, no contra la tabla a mano de la
// calculadora. Esa tabla tiene veinticinco piezas; el juego tiene setecientas.
// ---------------------------------------------------------------------------

export interface ChainRecipe {
  out: string;
  rate: number;
  building: string | null;
  inputs: { item: string; rate: number }[];
}

export interface ChainStep {
  cls: string;
  building: string;
  /// Máquinas exactas, sin redondear. La vista redondea hacia arriba; el
  /// número crudo hace falta para saber si vas sobrado o justísimo.
  machines: number;
  depth: number;
}

export interface Chain {
  steps: ChainStep[];
  /// Lo que hay que meter desde fuera: materia prima, o piezas cuya cadena se
  /// cortó por el límite de profundidad.
  feed: { cls: string; rate: number }[];
}

/**
 * Despliega la cadena de producción hacia atrás desde una pieza y un ritmo.
 *
 * `maxDepth` existe porque sin él pedir un ordenador te devuelve la fábrica
 * entera hasta el mineral: cientos de máquinas que no caben en ninguna sala y
 * que nadie quiere ver de golpe. Lo que la gente construye es una nave de
 * planchas o una de rotores, no la cadena completa.
 *
 * Lo que se corta por profundidad no desaparece: sale en `feed`, que es lo que
 * tendrás que traer con cintas desde otro sitio. Esconderlo sería mentir sobre
 * lo que hace falta.
 */
export function solveChain(
  cls: string,
  perMinute: number,
  recipeFor: (cls: string) => ChainRecipe | null,
  maxDepth = 2
): Chain {
  const steps: ChainStep[] = [];
  const feed = new Map<string, number>();
  const visto = new Set<string>();

  const walk = (item: string, rate: number, depth: number) => {
    if (rate <= 0) return;
    const r = depth >= maxDepth ? null : recipeFor(item);
    if (!r || !r.building || r.rate <= 0) {
      feed.set(item, (feed.get(item) || 0) + rate);
      return;
    }
    // Una receta circular (chatarra de aluminio y similares) colgaría esto.
    const clave = `${item}@${depth}`;
    if (visto.has(clave)) {
      feed.set(item, (feed.get(item) || 0) + rate);
      return;
    }
    visto.add(clave);

    const machines = rate / r.rate;
    steps.push({ cls: item, building: r.building, machines, depth });
    for (const i of r.inputs) walk(i.item, i.rate * machines, depth + 1);
  };

  walk(cls, perMinute, 0);
  return {
    steps,
    feed: [...feed.entries()]
      .map(([c, rate]) => ({ cls: c, rate: Math.round(rate * 100) / 100 }))
      .sort((a, b) => b.rate - a.rate),
  };
}

/**
 * Coloca una lista de máquinas en la sala, en filas, de la más honda a la más
 * baja para que las filas queden parejas.
 *
 * No intenta ser un buen diseño de fábrica: intenta meterlas todas donde se
 * vean para que TÚ las muevas. Un colocador automático que pretenda acertar
 * con el gusto de cada uno acierta con el de nadie, y el gusto es justo lo que
 * Zigor dijo que es personal de cada pionero.
 */
export type Arrange = "mixta" | "vertical" | "lado";

/**
 * Reparte los pasos de una cadena en salas, según cómo quieras planificar.
 *
 *   mixta     todo en una sala. Lo más apretado, y lo que vale para una nave
 *             pequeña de una sola cosa.
 *   vertical  una planta por nivel de la cadena. Por defecto lo más avanzado
 *             arriba, que es como se piensa un árbol de producción, pero se
 *             puede dar la vuelta: hay quien alimenta por gravedad desde
 *             arriba y hay quien sube con elevadores. Las dos formas existen y
 *             ninguna es la correcta.
 *   lado      una sala por nivel, todas en la planta baja, una detrás de otra.
 *
 * Lo que NO hace: decidir por ti. Reparte y coloca para que tengas algo que
 * mover, que es lo único honesto cuando el gusto es personal de cada pionero.
 */
export function arrangeLevels(
  steps: { cls: string; building: string; depth: number }[],
  modo: Arrange,
  avanzadoArriba = true
): Map<number, number> {
  const prof = [...new Set(steps.map((s) => s.depth))].sort((a, b) => a - b);
  const out = new Map<number, number>();
  prof.forEach((d, i) => {
    if (modo === "mixta") out.set(d, 0);
    else if (modo === "vertical") out.set(d, avanzadoArriba ? prof.length - 1 - i : i);
    else out.set(d, 0);
  });
  return out;
}

export function layout(
  machines: { cls: string; size: Size; level?: number; band?: number }[],
  room: Room,
  gap = PORT_CLEAR
): Placed[] {
  const out: Placed[] = [];
  let id = 1;
  // Cada planta se llena por separado, y dentro de una planta cada banda
  // (que es un nivel de la cadena cuando se planifica "al lado") empieza en
  // su propia fila: así no se mezclan hornos y constructores en la misma
  // tira, que es justo lo que hace ilegible un plano.
  const porPlanta = new Map<string, typeof machines>();
  for (const m of machines) {
    const k = `${m.level || 0}|${m.band || 0}`;
    (porPlanta.get(k) || porPlanta.set(k, []).get(k)!).push(m);
  }
  const yPorPlanta = new Map<number, number>();
  for (const k of [...porPlanta.keys()].sort()) {
    const lote = porPlanta.get(k)!;
    const level = lote[0].level || 0;
    const orden = [...lote].sort((a, b) => b.size.d - a.size.d || b.size.w - a.size.w);
    let x = 0;
    let y = yPorPlanta.get(level) || 0;
    let filaAlta = 0;
    for (const m of orden) {
      const f = footprint(m.size, 0);
      if (x + f.w > room.w) {
        x = 0;
        y += filaAlta + gap;
        filaAlta = 0;
      }
      out.push({ id: id++, cls: m.cls, x, y, rot: 0, level });
      x += f.w + gap;
      filaAlta = Math.max(filaAlta, f.d);
    }
    yPorPlanta.set(level, y + filaAlta + gap * 2);
  }
  return out;
}

/**
 * Centra lo que hay en una planta dentro de la sala.
 *
 * Porque es lo que hace todo el mundo al construir: ajustar y alinear hasta
 * que queda ordenado. Un plano pegado a la esquina superior izquierda es
 * correcto y parece un borrador.
 *
 * Se centra en múltiplos de la rejilla, no al milímetro: medio metro de
 * descuadre con la rejilla de cimientos molesta más que dos metros de margen
 * desigual.
 */
export function centreLevel(
  items: Placed[],
  room: Room,
  level: number,
  sizeOf: (cls: string) => Size | null,
  grid = 1
): Placed[] {
  const aqui = items.filter((it) => levelOf(it) === level);
  if (!aqui.length) return items;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const it of aqui) {
    const s = sizeOf(it.cls);
    if (!s) continue;
    const f = footprint(s, it.rot);
    x0 = Math.min(x0, it.x);
    y0 = Math.min(y0, it.y);
    x1 = Math.max(x1, it.x + f.w);
    y1 = Math.max(y1, it.y + f.d);
  }
  if (!Number.isFinite(x0)) return items;
  const dx = snap((room.w - (x1 - x0)) / 2 - x0, grid);
  const dy = snap((room.d - (y1 - y0)) / 2 - y0, grid);
  return items.map((it) =>
    levelOf(it) === level ? { ...it, x: it.x + dx, y: it.y + dy } : it
  );
}

/**
 * La sala más pequeña donde cabría todo, probando tamaños crecientes con el
 * MISMO colocador que se usa de verdad.
 *
 * No es la sala mínima teórica — empaquetar rectángulos óptimamente es un
 * problema duro y la respuesta exacta no le sirve a nadie. Es la respuesta
 * honesta a la pregunta que de verdad se hace: "¿de qué tamaño la pongo para
 * que esto entre?". Prometer el mínimo absoluto y que luego no entre sería
 * peor que no proponer nada.
 */
export function suggestRoom(
  machines: { cls: string; size: Size; level?: number; band?: number }[],
  room: Room,
  sizeOf: (cls: string) => Size | null,
  max = 200
): Room | null {
  if (!machines.length) return null;
  const paso = FOUNDATION;
  // Crece manteniendo la proporción de la sala actual, que es la que el
  // usuario ha elegido: si la quiere alargada, se le devuelve alargada.
  const prop = room.d / room.w || 1;
  for (let w = Math.ceil(room.w / paso) * paso; w <= max; w += paso) {
    const d = Math.min(max, Math.ceil((w * prop) / paso) * paso);
    const probe: Room = { w, d };
    const puesto = layout(machines, probe);
    const mal = problems(puesto, probe, sizeOf).some((p) => p.kind === "fuera");
    if (!mal) return probe;
  }
  return null;
}
