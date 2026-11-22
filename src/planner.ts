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
  kind: "fuera" | "solapa";
  with?: number;
}

/**
 * Qué está mal en la sala. Devuelve una entrada por pieza problemática; una
 * pieza puede salir dos veces si además de solapar se sale de la sala.
 */
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
      return { id: it.id, x: it.x, y: it.y, w: f.w, d: f.d };
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
      if (overlaps(boxes[i], boxes[j])) {
        out.push({ id: boxes[i].id, kind: "solapa", with: boxes[j].id });
        out.push({ id: boxes[j].id, kind: "solapa", with: boxes[i].id });
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
