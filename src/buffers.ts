// ¿Los almacenes mejoran el flujo?
//
// Pregunta de Zigor, y la respuesta honesta va contra la intuición: con piezas
// NO. Un contenedor intercalado en una línea de cintas no sube el caudal, nunca.
// Lo que entra por la cinta de arriba sale por la de abajo a la misma
// velocidad; el contenedor no multiplica nada. Lo único que da es MARGEN: si
// el suministro se corta, lo que tenga guardado mantiene a lo de abajo
// trabajando un rato.
//
// Con fluidos es distinto de verdad, y por eso la intuición viene de ahí: un
// depósito sí estabiliza la presión de una red de tuberías, y las bombas hacen
// falta para subir en altura. Eso no se traslada a las cintas, que no tienen
// ni presión ni altura que vencer.
//
// Así que el consejo útil no es "pon más" ni "quita todos", sino DÓNDE está
// cada uno de los tuyos. Y eso se puede saber sin más datos que los que la app
// ya tiene: las posiciones y el trazado de las cintas.

export type Punto = { x: number; y: number; cat: string; cls: string; name: string };
export type Linea = { pts: [number, number][]; kind: string };

export type Almacen = {
  x: number;
  y: number;
  name: string;
  /// Extremos de cinta que llegan o salen de aquí.
  extremos: number;
};

export type Reparto = {
  /// Dos o más extremos: la línea entra y sale. Ahí no mejora el caudal.
  intercalados: Almacen[];
  /// Un extremo: final de línea. Eso es almacenar, que es para lo que sirve.
  finales: Almacen[];
  /// Ningún extremo cerca: se llena a mano.
  sueltos: Almacen[];
  total: number;
};

/// Las coordenadas del juego son centímetros, así que 800 son 8 metros. Un
/// contenedor mide 5×11 m, y las cintas se enganchan en sus bordes: con menos
/// radio se escapan enganches legítimos y con mucho más empiezan a contarse
/// cintas que sólo pasan cerca.
const RADIO_CM = 800;

/// Clases que son almacén DE PIEZAS. Los depósitos de fluido quedan fuera a
/// propósito: ahí la respuesta es la contraria y mezclarlos sería mentir.
/// El Depósito Dimensional tampoco: no es un búfer de línea, es un envío.
const SOLIDOS = /StorageContainer|StorageIntegrated/;

export function repartoDeAlmacenes(puntos: Punto[], lineas: Linea[]): Reparto {
  // Por CLASE, no por nombre: el nombre va traducido y preguntarle a un texto
  // traducido si es un contenedor funciona hasta que alguien cambia de idioma.
  const almacenes = puntos.filter((p) => p.cat === "store" && SOLIDOS.test(p.cls));

  // Sólo los extremos, no el trazado entero: lo que dice si una cinta termina
  // aquí es su punta, no que pase por encima.
  const puntas: [number, number][] = [];
  for (const l of lineas) {
    if (l.kind !== "belt") continue;
    if (l.pts.length < 2) continue;
    puntas.push(l.pts[0], l.pts[l.pts.length - 1]);
  }

  const r2 = RADIO_CM * RADIO_CM;
  const out: Reparto = { intercalados: [], finales: [], sueltos: [], total: almacenes.length };
  for (const a of almacenes) {
    let n = 0;
    for (const [px, py] of puntas) {
      const dx = px - a.x;
      const dy = py - a.y;
      if (dx * dx + dy * dy <= r2) n++;
    }
    const reg: Almacen = { x: a.x, y: a.y, name: a.name, extremos: n };
    if (n === 0) out.sueltos.push(reg);
    else if (n === 1) out.finales.push(reg);
    else out.intercalados.push(reg);
  }
  return out;
}
