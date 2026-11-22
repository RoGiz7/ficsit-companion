// Teselas hexagonales de mundos.
//
// Cada mundo se elige por su propia huella: los edificios que tiene, dibujados
// dentro de un hexagono. La alternativa era una ilustracion del bioma de
// inicio, y se descarto por una razon concreta: hay cuatro biomas, y dos
// partidas empezadas en el mismo quedarian IDENTICAS. La huella es unica por
// construccion, es dato real en vez de ilustracion, y ademas crece: un mundo
// nuevo son cuatro puntos y uno de 160 horas llena el hexagono.
//
// El hexagono no es casual: es la forma de OttO (la tuerca, el icono) y la del
// juego. Un circulo seria la unica forma que no pertenece a ninguno de los dos.

export type Huella = {
  v: 1;
  /// Puntos ya normalizados a la caja 0..100 del hexagono.
  pts: [number, number][];
  /// El HUB, para orientar el dibujo. null si no se encontro.
  hub: [number, number] | null;
  /// Edificios reales, que no es lo mismo que pts.length tras el muestreo.
  edif: number;
  ts: number;
};

const CLAVE = "otto:huellas";
const MAX_PTS = 420;
const REJILLA = 0.6; // unidades del hexagono: junta edificios pegados en uno

/// Nombres del HUB en los dos idiomas y en crudo. Si ninguno aparece no se
/// pinta el punto: mejor sin marca que con una marca en el sitio equivocado.
const HUB = ["trading post", "puesto del hub", "hub terminal", "terminal del hub"];

function percentil(v: number[], p: number): number {
  const i = Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)));
  return v[i];
}

export function huellaDe(
  points: { x: number; y: number; name: string }[],
  edif: number
): Huella | null {
  if (!points.length) return null;

  // Los extremos se recortan por percentil, no por minimo y maximo: una sola
  // baliza plantada a 40 km del resto aplastaria toda la fabrica contra una
  // esquina y el dibujo no diria nada.
  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const ys = points.map((p) => p.y).sort((a, b) => a - b);
  const x0 = percentil(xs, 0.02), x1 = percentil(xs, 0.98);
  const y0 = percentil(ys, 0.02), y1 = percentil(ys, 0.98);

  // Una sola escala para los dos ejes: con una por eje, una fabrica larga y
  // estrecha saldria cuadrada y dejaria de parecerse a si misma.
  const lado = Math.max(x1 - x0, y1 - y0, 1);
  const escala = 62 / lado;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const sitio = (p: { x: number; y: number }): [number, number] => [
    50 + (p.x - cx) * escala,
    50 - (p.y - cy) * escala, // la Y del juego crece hacia el norte; la del SVG, hacia abajo
  ];

  const dentro = ([x, y]: [number, number]) => (x - 50) ** 2 + (y - 50) ** 2 < 1850;

  // Rejilla para no guardar 5894 puntos cuando 420 cuentan lo mismo: lo que
  // importa es la forma, y los edificios pegados se leen como una mancha.
  const vistos = new Set<string>();
  const pts: [number, number][] = [];
  for (const p of points) {
    const q = sitio(p);
    if (!dentro(q)) continue;
    const k = `${Math.round(q[0] / REJILLA)},${Math.round(q[1] / REJILLA)}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    pts.push([Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]);
  }

  // Si aun sobran, se quita de forma regular, nunca al azar: la huella tiene
  // que salir igual cada vez que se mire el mismo mundo.
  let final = pts;
  if (pts.length > MAX_PTS) {
    const paso = pts.length / MAX_PTS;
    final = [];
    for (let i = 0; i < MAX_PTS; i++) final.push(pts[Math.floor(i * paso)]);
  }

  const h = points.find((p) => HUB.includes((p.name || "").trim().toLowerCase()));
  const hub = h ? sitio(h) : null;

  return {
    v: 1,
    pts: final,
    hub: hub && dentro(hub) ? [Math.round(hub[0] * 10) / 10, Math.round(hub[1] * 10) / 10] : null,
    edif,
    ts: Date.now(),
  };
}

export function huellasLeer(): Record<string, Huella> {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return {};
    const d = JSON.parse(raw);
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

export function huellaGuardar(mundo: string, h: Huella): void {
  try {
    const todas = huellasLeer();
    todas[mundo] = h;
    localStorage.setItem(CLAVE, JSON.stringify(todas));
  } catch {
    // Sin almacenamiento la tesela sale lisa hasta que se abra el mundo. No es
    // motivo para romper nada.
  }
}

const HEX = "M50 4 L89.8 27 L89.8 73 L50 96 L10.2 73 L10.2 27 Z";

function esc(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}

/// Dibuja una tesela. Sin huella sale el hexagono vacio, que es lo honesto:
/// significa "este mundo todavia no se ha abierto", no "este mundo esta vacio".
export function teselaSVG(mundo: string, h: Huella | null, sel: boolean): string {
  const id = esc(mundo) + (sel ? "_s" : "");
  const op = sel ? 0.92 : 0.38;
  const anillo = sel
    ? `<path d="${HEX}" fill="none" stroke="var(--accent)" stroke-width="3.2"/>`
    : `<path d="${HEX}" fill="none" stroke="var(--line)" stroke-width="1.6"/>`;
  const puntos = h
    ? `<g fill="#c9ced8" opacity="${op}">` +
      h.pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.25"/>`).join("") +
      `</g>`
    : "";
  const hub =
    h && h.hub
      ? `<circle cx="${h.hub[0]}" cy="${h.hub[1]}" r="2.6" fill="var(--accent)" opacity="${sel ? 1 : 0.5}"/>`
      : "";
  return (
    `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">` +
    `<defs><clipPath id="wt_${id}"><path d="${HEX}"/></clipPath></defs>` +
    `<g clip-path="url(#wt_${id})">` +
    `<path d="${HEX}" fill="#1d222b" opacity="${sel ? 1 : 0.6}"/>` +
    puntos +
    hub +
    `</g>${anillo}</svg>`
  );
}
