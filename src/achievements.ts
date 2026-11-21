// Logros: la evaluación de desempeño de FICSIT.
//
// Dos reglas de diseño, las dos importantes:
//
// 1. NO SE GUARDAN. Se recalculan desde el histórico cada vez. Así una medalla
//    nueva aparece retroactiva, con su fecha, en vez de estrenar el muro
//    vacío. Lo único que se persistiría sería cuáles ya se han visto.
//
// 2. LAS DIFERENCIAS SE CALCULAN CON MÁXIMO MENOS MÍNIMO, no con la última
//    foto menos la primera. Las fotos de un mismo mundo vienen de archivos
//    distintos (el guardado manual y sus tres autoguardados), cada uno con su
//    propio tiempo jugado; ordenadas por fecha se mezclan y restar la primera
//    de la última compara peras con manzanas. Con máximo menos mínimo da
//    igual el orden y nunca sale negativo.

export interface Snap {
  ts_ms: number;
  play_seconds: number;
  total_buildings: number;
  metrics?: {
    tier?: number | null;
    levels?: number | null;
    overclocked?: number | null;
    power_generation_mw?: number | null;
    production?: { item: string; rate: number }[] | null;
    deficits?: { item: string; rate: number }[] | null;
    collectables?: { item: string; count: number }[] | null;
  } | null;
}

export type Lang = "es" | "en";

// La escala no es bronce/plata/oro: es la del propio juego para las fases del
// Ascensor Espacial. FICSIT no te felicita, te evalúa.
export const GRADES: { es: string; en: string }[] = [
  { es: "Sin evaluar", en: "Unassessed" },
  { es: "Mediocre", en: "Mediocre" },
  { es: "Aceptable", en: "Adequate" },
  { es: "Eficiente", en: "Efficient" },
];

export interface Medal {
  id: string;
  name: { es: string; en: string };
  desc: { es: string; en: string };
  unit: { es: string; en: string };
  thresholds: [number, number, number];
  // Qué mide, a partir de las fotos de un mes.
  measure: (snaps: Snap[]) => number | null;
}

// --- utilidades de medida ---
//
// El reloj del mundo es play_seconds, no la fecha. Las fotos de un mes pueden
// venir del guardado manual y de sus tres autoguardados, que son archivos
// distintos del mismo mundo: ordenarlas por fecha mezcla estados, y medir cada
// métrica por su cuenta puede acabar restando las construcciones de un archivo
// a las horas de otro.
//
// Por eso se eligen DOS FOTOS, la del reloj más bajo y la del más alto, y
// todas las métricas se miden entre esas dos. Es el avance real del mundo
// entre los dos estados que vimos ese mes.
const clockPair = (snaps: Snap[]): [Snap, Snap] | null => {
  const v = snaps.filter((s) => typeof s.play_seconds === "number");
  if (v.length < 2) return null;
  let lo = v[0];
  let hi = v[0];
  for (const s of v) {
    if (s.play_seconds < lo.play_seconds) lo = s;
    if (s.play_seconds > hi.play_seconds) hi = s;
  }
  return lo.play_seconds === hi.play_seconds ? null : [lo, hi];
};

const delta = (
  snaps: Snap[],
  f: (s: Snap) => number | null | undefined,
  down = false // para lo que solo puede bajar, como los coleccionables
): number | null => {
  const pair = clockPair(snaps);
  if (!pair) return null;
  const a = f(pair[0]);
  const b = f(pair[1]);
  if (typeof a !== "number" || typeof b !== "number") return null;
  return Math.max(0, down ? a - b : b - a);
};

const sumRates = (list?: { rate: number }[] | null): number =>
  (list || []).reduce((n, x) => n + x.rate, 0);

const sumCounts = (list?: { count: number }[] | null): number =>
  (list || []).reduce((n, x) => n + x.count, 0);

// --- catálogo de series mensuales ---
// Umbrales calibrados contra histórico real en noviembre de 2026. Son datos:
// si se quedan cortos o largos, se cambian aquí y ya está.

export const MEDALS: Medal[] = [
  {
    id: "structural",
    name: { es: "Expansión Estructural", en: "Structural Expansion" },
    desc: {
      es: "Construcciones levantadas este mes.",
      en: "Buildings raised this month.",
    },
    unit: { es: "construcciones", en: "buildings" },
    thresholds: [50, 250, 600],
    measure: (s) => delta(s, (x) => x.total_buildings),
  },
  {
    id: "billable",
    name: { es: "Horas Facturables", en: "Billable Hours" },
    desc: {
      es: "FICSIT no remunera las horas extra, pero las registra.",
      en: "FICSIT does not pay overtime, but it does record it.",
    },
    unit: { es: "h", en: "h" },
    thresholds: [2, 8, 20],
    measure: (s) => {
      const d = delta(s, (x) => x.play_seconds);
      return d === null ? null : d / 3600;
    },
  },
  {
    id: "supply",
    name: { es: "Contrato de Suministro", en: "Power Supply Contract" },
    desc: {
      es: "Generación añadida a la red.",
      en: "Generation added to the grid.",
    },
    unit: { es: "MW", en: "MW" },
    thresholds: [50, 250, 1000],
    measure: (s) => delta(s, (x) => x.metrics?.power_generation_mw),
  },
  {
    id: "throughput",
    name: { es: "Rendimiento Agregado", en: "Aggregate Throughput" },
    desc: {
      es: "Producción total ganada, sumando todas las piezas.",
      en: "Total production gained, across every part.",
    },
    unit: { es: "piezas/min", en: "parts/min" },
    thresholds: [100, 500, 2000],
    measure: (s) => delta(s, (x) => (x.metrics ? sumRates(x.metrics.production) : null)),
  },
  {
    id: "vertical",
    name: { es: "Desarrollo Vertical", en: "Vertical Development" },
    desc: {
      es: "El suelo es un recurso finito. Su uso creativo ha sido anotado en su expediente.",
      en: "Ground is a finite resource. Your creative use of it has been noted in your file.",
    },
    unit: { es: "plantas", en: "floors" },
    thresholds: [1, 2, 4],
    measure: (s) => delta(s, (x) => x.metrics?.levels),
  },
  {
    id: "acquisition",
    name: { es: "Adquisición de Activos", en: "Asset Acquisition" },
    desc: {
      es: "Material recogido del planeta. El planeta no ha presentado objeciones.",
      en: "Material collected from the planet. The planet has raised no objection.",
    },
    unit: { es: "piezas", en: "items" },
    thresholds: [5, 20, 50],
    // Los coleccionables solo bajan: lo recogido es la diferencia.
    measure: (s) => delta(s, (x) => (x.metrics ? sumCounts(x.metrics.collectables) : null), true),
  },
  {
    id: "incident",
    name: { es: "Resolución de Incidencias", en: "Incident Resolution" },
    desc: {
      es: "Un cuello de botella resuelto es un cuello de botella que nunca debió existir.",
      en: "A bottleneck resolved is a bottleneck that should never have existed.",
    },
    unit: { es: "resueltos", en: "resolved" },
    thresholds: [1, 5, 15],
    // Esta no es una diferencia: hay que mirar foto contra foto para ver qué
    // pieza estaba en déficit y dejó de estarlo. Ninguna otra herramienta
    // puede medirlo, porque hace falta haber estado mirando.
    measure: (snaps) => {
      const withM = snaps.filter((s) => s.metrics?.deficits);
      if (withM.length < 2) return null;
      let fixed = 0;
      for (let i = 1; i < withM.length; i++) {
        const before = new Set((withM[i - 1].metrics!.deficits || []).map((d) => d.item));
        const after = new Set((withM[i].metrics!.deficits || []).map((d) => d.item));
        for (const item of before) if (!after.has(item)) fixed++;
      }
      return fixed;
    },
  },
];

export function gradeOf(value: number | null, th: [number, number, number]): number {
  if (value === null) return 0;
  if (value >= th[2]) return 3;
  if (value >= th[1]) return 2;
  if (value >= th[0]) return 1;
  return 0;
}

// --- evaluación mensual ---

export interface MedalScore {
  id: string;
  value: number | null;
  grade: number;
  next: number | null; // cuánto falta para el siguiente nivel
  nextGrade: number;
}

export interface MonthScore {
  key: string; // "2026-06"
  snaps: number;
  enough: boolean; // con una sola foto no hay diferencia que medir
  medals: MedalScore[];
  overall: number;
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthlyScores(snaps: Snap[]): MonthScore[] {
  const byMonth = new Map<string, Snap[]>();
  for (const s of snaps) {
    const k = monthKey(s.ts_ms);
    const g = byMonth.get(k);
    if (g) g.push(s);
    else byMonth.set(k, [s]);
  }
  const out: MonthScore[] = [];
  for (const [key, group] of byMonth) {
    group.sort((a, b) => a.ts_ms - b.ts_ms);
    const medals: MedalScore[] = MEDALS.map((m) => {
      const value = m.measure(group);
      const grade = gradeOf(value, m.thresholds);
      const nextGrade = Math.min(3, grade + 1);
      const next =
        grade >= 3 || value === null ? null : Math.max(0, m.thresholds[grade] - value);
      return { id: m.id, value, grade, next, nextGrade };
    });
    const earned = medals.filter((m) => m.grade > 0);
    // La nota del mes es la media de lo conseguido, redondeada hacia abajo:
    // FICSIT no regala.
    const overall = earned.length
      ? Math.max(1, Math.floor(earned.reduce((n, m) => n + m.grade, 0) / earned.length))
      : 0;
    out.push({ key, snaps: group.length, enough: group.length >= 2, medals, overall });
  }
  return out.sort((a, b) => (a.key < b.key ? 1 : -1));
}

// --- certificaciones: una vez, con fecha ---
// Solo cosas numéricas. Las basadas en el nombre de una pieza se dejan fuera a
// propósito: en el esquema 1 esos nombres se guardaron en el idioma de la
// sesión, así que compararlos entre fotos no es fiable todavía.

export interface Cert {
  id: string;
  name: { es: string; en: string };
  ts: number;
  // false = ya estaba cumplido la primera vez que pudimos mirar, así que la
  // fecha es "no después de", no "el día que lo lograste". Decirlo importa:
  // una app que afirma una fecha que no sabe miente con mucha seguridad.
  exact: boolean;
}

export function certifications(snaps: Snap[]): Cert[] {
  // Por el reloj del mundo, no por la fecha del archivo: así un autoguardado
  // viejo importado hoy no parece lo último que pasó.
  const sorted = [...snaps].sort((a, b) => a.play_seconds - b.play_seconds);
  const withMetrics = sorted.filter((s) => !!s.metrics);
  const out: Cert[] = [];

  const firstWhen = (
    test: (s: Snap) => boolean,
    needsMetrics: boolean
  ): { ts: number; exact: boolean } | null => {
    const pool = needsMetrics ? withMetrics : sorted;
    const i = pool.findIndex(test);
    if (i < 0) return null;
    // Si ya se cumplía en la PRIMERA foto que pudo verlo, no sabemos cuándo
    // ocurrió: solo que no fue después.
    return { ts: pool[i].ts_ms, exact: i > 0 };
  };
  const add = (
    id: string,
    es: string,
    en: string,
    hit: { ts: number; exact: boolean } | null
  ) => {
    if (hit) out.push({ id, name: { es, en }, ts: hit.ts, exact: hit.exact });
  };

  for (const n of [100, 500, 1000, 2000, 5000]) {
    add(
      `builds-${n}`,
      `Certificación: ${n} construcciones`,
      `Certification: ${n} buildings`,
      firstWhen((s) => s.total_buildings >= n, false)
    );
  }
  for (let tier = 1; tier <= 9; tier++) {
    add(
      `tier-${tier}`,
      `Certificación: Tier ${tier}`,
      `Certification: Tier ${tier}`,
      firstWhen((s) => (s.metrics?.tier ?? 0) >= tier, true)
    );
  }
  add(
    "overclock",
    "Primera máquina con overclock",
    "First overclocked machine",
    firstWhen((s) => (s.metrics?.overclocked ?? 0) > 0, true)
  );
  add(
    "second-floor",
    "Primera segunda planta",
    "First second floor",
    firstWhen((s) => (s.metrics?.levels ?? 0) >= 2, true)
  );
  add(
    "balanced",
    "Primera fábrica sin cuellos de botella",
    "First factory with no bottlenecks",
    firstWhen((s) => (s.metrics!.deficits || []).length === 0, true)
  );
  add(
    "hours-100",
    "100 horas en este mundo",
    "100 hours in this world",
    firstWhen((s) => s.play_seconds >= 360000, false)
  );

  return out.sort((a, b) => b.ts - a.ts);
}
