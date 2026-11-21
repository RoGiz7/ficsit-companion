// Lenguaje visual común de las gráficas.
//
// Regla de la casa: adorno en el marco, sobriedad en el dato. La tablet de
// FICSIT ya pone el espectáculo con su bisel y su glow; dentro de la gráfica
// van líneas finas, rejilla discreta y números tabulares.
//
// La paleta NO se eligió a ojo: se pasó por el validador de contraste y
// daltonismo contra la superficie oscura de la app (#1b1f27). Dos resultados
// que cambiaron decisiones:
//   · El naranja de marca (#ff9e3d) es demasiado claro para marcar datos sobre
//     oscuro, así que las series usan un escalón más bajo del mismo tono.
//   · Rojo contra verde, que es lo que usaba la app para déficit y margen,
//     FALLA: para una persona con deuteranopía son el mismo color (ΔE 4,3).
//     El divergente es rojo contra azul, que separa limpio (ΔE 22,2).
// Y el color nunca va solo: todo lleva etiqueta o signo.

export const VIZ = {
  series1: "#cf7a2a", // naranja: lo que gastas
  series2: "#3f93e0", // azul: lo que tienes
  neg: "#d9534f", // déficit
  pos: "#3f93e0", // excedente
  mid: "#4a5160", // cero
  grid: "rgba(255,255,255,0.07)",
  ink: "#8b93a3",
};

export interface Point {
  x: number; // tiempo en ms
  y: number;
}

export interface Series {
  name: string;
  color: string;
  points: Point[];
}

const PAD = { t: 14, r: 14, b: 26, l: 46 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 100) / 10}k`;
  return `${Math.round(v * 10) / 10}`;
}

function fmtDate(ms: number, lang: string): string {
  return new Date(ms).toLocaleDateString(lang, { day: "numeric", month: "short" });
}

// Gráfica de líneas en el tiempo. Un solo eje: dos medidas de escalas
// distintas no comparten gráfica, se separan.
export function lineChart(opts: {
  series: Series[];
  width?: number;
  height?: number;
  unit: string;
  lang: string;
  // Relleno entre dos series, con color según cuál va por encima. Sirve para
  // que el margen de energía se lea sin tener que restar mentalmente.
  band?: { over: string; under: string };
  zeroBased?: boolean;
  // Qué decir al pasar el puntero por el punto i. Una gráfica en pantalla es
  // interactiva por definición; que no lo sea es una decisión, y es la mala.
  tip?: (i: number) => string;
}): string {
  const W = opts.width ?? 720;
  const H = opts.height ?? 230;
  const all = opts.series.flatMap((s) => s.points);
  if (all.length < 2) return "";

  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = opts.zeroBased ? Math.min(0, ...ys) : Math.min(...ys);
  let y1 = Math.max(...ys);
  if (y0 === y1) {
    y0 -= 1;
    y1 += 1;
  }
  const pad = (y1 - y0) * 0.08;
  y0 -= pad;
  y1 += pad;

  const px = (x: number) =>
    PAD.l + ((x - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const py = (y: number) => H - PAD.b - ((y - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);

  // Rejilla y eje: recesivos, nunca compitiendo con el dato.
  let grid = "";
  for (const tv of niceTicks(y0 + pad, y1 - pad)) {
    const y = py(tv).toFixed(1);
    grid +=
      `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="${VIZ.grid}" stroke-width="1"/>` +
      `<text x="${PAD.l - 8}" y="${y}" class="viz-tick" text-anchor="end" dominant-baseline="middle">${fmtNum(tv)}</text>`;
  }
  if (opts.unit) {
    grid += `<text x="${PAD.l - 8}" y="${PAD.t - 2}" class="viz-tick" text-anchor="end">${opts.unit}</text>`;
  }
  const xTicks = [x0, (x0 + x1) / 2, x1];
  for (const tv of xTicks) {
    grid += `<text x="${px(tv).toFixed(1)}" y="${H - 8}" class="viz-tick" text-anchor="middle">${fmtDate(tv, opts.lang)}</text>`;
  }

  // Banda entre dos series: el hueco se colorea según quién manda.
  let bandSvg = "";
  if (opts.band && opts.series.length >= 2) {
    const a = opts.series[0].points;
    const b = opts.series[1].points;
    const n = Math.min(a.length, b.length);
    for (let i = 1; i < n; i++) {
      const up = b[i].y >= a[i].y;
      const quad =
        `${px(a[i - 1].x).toFixed(1)},${py(a[i - 1].y).toFixed(1)} ` +
        `${px(a[i].x).toFixed(1)},${py(a[i].y).toFixed(1)} ` +
        `${px(b[i].x).toFixed(1)},${py(b[i].y).toFixed(1)} ` +
        `${px(b[i - 1].x).toFixed(1)},${py(b[i - 1].y).toFixed(1)}`;
      bandSvg += `<polygon points="${quad}" fill="${up ? opts.band.over : opts.band.under}" fill-opacity="0.22"/>`;
    }
  }

  let lines = "";
  for (const s of opts.series) {
    const d = s.points
      .map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`)
      .join(" ");
    lines += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    // Marcadores de 8 px solo si hay pocos puntos: con un histórico flaco, que
    // se vea que son lecturas y no una línea inventada.
    if (s.points.length <= 24) {
      for (const p of s.points) {
        lines += `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="4" fill="${s.color}" stroke="#1b1f27" stroke-width="2"/>`;
      }
    }
  }

  // Capa de puntero: una línea vertical y los valores de ese instante.
  const hit = opts.series[0].points
    .map(
      (p, i) =>
        `<rect class="viz-hit" x="${(px(p.x) - 10).toFixed(1)}" y="${PAD.t}" width="20" height="${H - PAD.t - PAD.b}" ` +
        `fill="transparent" data-x="${px(p.x).toFixed(1)}" data-tip="${
          opts.tip ? opts.tip(i).replace(/"/g, "&quot;") : ""
        }"/>`
    )
    .join("");

  return (
    `<svg viewBox="0 0 ${W} ${H}" class="viz" preserveAspectRatio="none">` +
    grid +
    bandSvg +
    `<line class="viz-cross" x1="0" y1="${PAD.t}" x2="0" y2="${H - PAD.b}" stroke="${VIZ.ink}" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>` +
    lines +
    hit +
    `</svg>`
  );
}

export function legend(series: { name: string; color: string }[]): string {
  if (series.length < 2) return ""; // con una sola serie, el título ya la nombra
  return (
    `<div class="viz-legend">` +
    series
      .map(
        (s) =>
          `<span class="viz-leg"><span class="viz-dot" style="background:${s.color}"></span>${s.name}</span>`
      )
      .join("") +
    `</div>`
  );
}

// Barras divergentes: déficit a un lado, excedente al otro, con el cero
// marcado. El signo va en la etiqueta, así que el color no carga solo con el
// significado.
export function divergingBars(
  rows: { label: string; value: number; detail?: string }[],
  unit: string
): string {
  if (!rows.length) return "";
  const max = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;
  return (
    `<div class="dv-list">` +
    rows
      .map((r) => {
        const neg = r.value < 0;
        const w = (Math.abs(r.value) / max) * 50; // % de la mitad
        const bar = neg
          ? `<span class="dv-bar dv-neg" style="width:${w}%;right:50%"></span>`
          : `<span class="dv-bar dv-pos" style="width:${w}%;left:50%"></span>`;
        const sep = unit.startsWith("/") ? "" : " ";
        const v = `${neg ? "−" : "+"}${fmtNum(Math.abs(r.value))}${sep}${unit}`;
        return (
          `<div class="dv-row"><span class="dv-label">${r.label}</span>` +
          `<span class="dv-track"><span class="dv-zero"></span>${bar}</span>` +
          `<span class="dv-value ${neg ? "dv-tneg" : "dv-tpos"}">${v}</span>` +
          (r.detail ? `<span class="dv-detail">${r.detail}</span>` : `<span></span>`) +
          `</div>`
        );
      })
      .join("") +
    `</div>`
  );
}

// Engancha la capa de puntero de una gráfica ya pintada: cruz vertical y
// globo con los valores de ese instante.
export function attachChartHover(root: HTMLElement) {
  root.querySelectorAll<SVGSVGElement>("svg.viz").forEach((svg) => {
    const cross = svg.querySelector<SVGLineElement>(".viz-cross");
    let tipEl = svg.parentElement?.querySelector<HTMLElement>(".viz-tip") || null;
    if (!tipEl && svg.parentElement) {
      tipEl = document.createElement("div");
      tipEl.className = "viz-tip";
      svg.parentElement.appendChild(tipEl);
    }
    svg.querySelectorAll<SVGRectElement>(".viz-hit").forEach((hit) => {
      hit.addEventListener("pointerenter", () => {
        const x = hit.getAttribute("data-x") || "0";
        if (cross) {
          cross.setAttribute("x1", x);
          cross.setAttribute("x2", x);
          cross.setAttribute("opacity", "1");
        }
        if (tipEl) {
          tipEl.innerHTML = hit.getAttribute("data-tip") || "";
          tipEl.style.opacity = "1";
          // En porcentaje, que el SVG se estira con el ancho disponible.
          const pct = (parseFloat(x) / svg.viewBox.baseVal.width) * 100;
          tipEl.style.left = `${Math.min(88, Math.max(2, pct))}%`;
        }
      });
    });
    svg.addEventListener("pointerleave", () => {
      if (cross) cross.setAttribute("opacity", "0");
      if (tipEl) tipEl.style.opacity = "0";
    });
  });
}
