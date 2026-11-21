// Iconografía propia.
//
// Plan B, y por ahora el plan A: dibujos nuestros, originales, que no son de
// nadie más. No imitan los del juego ni lo pretenden — son un sistema de
// reconocimiento, no retratos. Mientras no haya un permiso por escrito de
// Coffee Stain, esto es lo que ve todo el mundo sin instalar nada.
//
// Y el día que haya iconos extraídos (o permiso), estos se apartan solos: el
// icono real gana, porque la app los busca primero y solo cae aquí cuando no
// encuentra ninguno.
//
// No son 750 dibujos: son una FORMA por estado de la materia y un COLOR por
// familia de material. Esa combinación distingue lo suficiente a 16 píxeles,
// que es el tamaño al que se ven, y el nombre está siempre al lado — el color
// nunca carga solo con el significado.
//
// Los colores están comprobados contra el fondo del panel: los dieciséis
// pasan de 3:1. Nadie es dueño de "gris para el hierro".

interface Family {
  key: string;
  re: RegExp;
  color: string;
}

// El orden importa: gana la primera que encaje, así que lo específico va
// antes que lo general (acero antes que hierro, porque Steel no es Iron pero
// IronIngot sí debe caer en hierro).
const FAMILIES: Family[] = [
  // Las electrobabosas y las esquirlas caían en el gris por defecto, que es
  // lo que se lleva lo que no reconocemos. Son biología alienígena en la
  // ficción del juego y la babosa morada es literalmente morada, así que van
  // aquí en vez de estrenar un color decimoséptimo.
  //
  // Los anclajes son a propósito: Desc_Crystal_C es la babosa azul, pero
  // Desc_CrystalOscillator_C es cuarzo y no debe caer aquí. Un /Crystal/ suelto
  // se comería el oscilador, que es el error que ya cometimos una vez.
  { key: "alien", re: /Alien|Somersloop|Mercer|SAM|DNA|CrystalShard|^Desc_Crystal(_mk\d)?_C$/i, color: "#b06fc0" },
  { key: "uranio", re: /Uranium|Plutonium|Nuclear|Ficsonium/i, color: "#5fb87a" },
  // "Crystal" estaba aquí y se comía el cuarzo, que iba después. Los
  // osciladores de cristal son de cuarzo de todas formas.
  { key: "circuito", re: /Wire|Cable|Circuit|Computer|Quickwire|HighSpeed/i, color: "#d4894a" },
  { key: "acero", re: /Steel/i, color: "#7f8a99" },
  { key: "aluminio", re: /Alumin|Bauxite|Scrap/i, color: "#8fb6c9" },
  { key: "caterio", re: /Caterium|Gold/i, color: "#d8b24a" },
  { key: "cobre", re: /Copper/i, color: "#c87f4a" },
  { key: "hierro", re: /Iron|Ore(?!.*Copper)/i, color: "#9aa3b0" },
  // Cement, no Concrete: el juego llama Desc_Cement_C al hormigón, y sin
  // esto caía en el color por defecto y se confundía con el hierro.
  { key: "hormigon", re: /Concrete|Cement|Limestone|Stone/i, color: "#a8a090" },
  { key: "cuarzo", re: /Quartz|Silica|Crystal_?Oscillator/i, color: "#d98fb0" },
  { key: "azufre", re: /Sulfur|Sulphur|BlackPowder|Nobelisk|Rebar/i, color: "#cfc14a" },
  // Más oscuro que el hierro a propósito: con el gris anterior eran el
  // mismo glifo a 18 píxeles.
  { key: "carbon", re: /Coal|Coke|Carbon|Petroleum/i, color: "#5f6670" },
  // El "Fuel" de Biofuel no es petróleo: el biocombustible es biomasa quemada
  // y caía aquí por la palabra, antes de llegar a orgánico. La mirada atrás
  // excluye Biofuel sin tocar Packaged Fuel, Rocket Fuel ni Ionized Fuel.
  { key: "petroleo", re: /Oil|Plastic|Rubber|(?<!Bio)Fuel|Polymer|Resin|Diluted/i, color: "#8f7fc0" },
  { key: "nitrogeno", re: /Nitrogen|Nitric/i, color: "#6fa8d0" },
  { key: "agua", re: /Water|Ice/i, color: "#4f9fd8" },
  // "Parts" son los restos de bicho y solo hay cuatro clases con esa palabra:
  // incubador, jabalí, escupidor y picador. Comprobado antes de meterlo.
  { key: "organico", re: /Biomass|Leaves|Wood|Mycelia|Shroom|Protein|Berry|Nut|Flower|Fabric|Medicinal|Parts/i, color: "#7fb060" },
];

const DEFAULT_COLOR = "#8b93a3";

/** Familia por el nombre de la clase, sin mirar recetas. null si no encaja. */
export function familyKey(cls: string): string | null {
  const f = FAMILIES.find((x) => x.re.test(cls));
  return f ? f.key : null;
}

const BY_KEY: Record<string, string> = Object.fromEntries(FAMILIES.map((f) => [f.key, f.color]));

export function familyColor(cls: string, family?: string | null): string {
  const k = familyKey(cls) ?? family;
  return (k && BY_KEY[k]) || DEFAULT_COLOR;
}

// Las piezas ensambladas no son de ningún material: un rotor no es hierro, es
// hierro montado. Por eso ninguna regex las cogía y caían las 58 en el gris de
// lo desconocido, que es justo lo que no son.
//
// En vez de estrenar un color decimoséptimo para "componente", heredan el de su
// ingrediente principal, que es lo que de verdad quieres saber mirando la lista:
// el rotor sale color hierro porque es hierro montado. Sale de las recetas del
// propio juego, no de una tabla escrita a mano.
//
// Las alternativas quedan fuera: una receta alternativa cambia los materiales de
// una pieza, y la identidad de un rotor no depende de qué desbloqueos lleves.
//
// 47 de las 58 se resuelven así. Las once que quedan son de FICSIVIDAD —
// bastones de caramelo, fuegos artificiales, bolas de nieve — y esas no son de
// ningún material: se quedan en gris, que ahí sí es la respuesta correcta.
type RecipeLike = { out: string; building: string | null; inputs: { item: string; rate: number }[] };

export function deriveFamilies(recipes: Record<string, RecipeLike>): Record<string, string> {
  const canon: Record<string, RecipeLike> = {};
  for (const [rc, r] of Object.entries(recipes)) {
    // Se admiten también las recetas sin edificio: son las de mano y el banco
    // de trabajo, y la motosierra se fabrica así. Antes se quedaba sin color
    // por un filtro mío, no por falta de datos.
    if (!r.out || /Alternate/i.test(rc)) continue;
    if (!canon[r.out]) canon[r.out] = r;
  }
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  const walk = (cls: string, depth: number): string | null => {
    const direct = familyKey(cls);
    if (direct) return direct;
    if (depth > 4) return null;
    if (out[cls]) return out[cls];
    if (seen.has(cls)) return null; // receta circular: no colgarse
    seen.add(cls);
    const r = canon[cls];
    if (!r || !r.inputs || !r.inputs.length) return null;
    const main = [...r.inputs].sort((a, b) => (b.rate || 0) - (a.rate || 0));
    for (const i of main) {
      const f = walk(i.item, depth + 1);
      if (f) {
        out[cls] = f;
        return f;
      }
    }
    return null;
  };
  for (const cls of Object.keys(canon)) walk(cls, 0);
  return out;
}

/// Un glifo en SVG, listo para meter en el HTML. `fluid` decide la forma:
/// sólido hexágono, líquido gota, gas círculo hueco. Edificios, cuadrado.
// Forma por banda de tier. Nueve tiers son nueve poligonos y a 18 px, que es
// el tamano al que se dibujan, un heptagono y un octogono son el mismo borron
// — comprobado renderizando las tres familias de formas candidatas. Lo que si
// se lee a ese tamano son cuatro siluetas francamente distintas, asi que los
// nueve tiers se agrupan en cuatro bandas.
//
// El circulo pequeno es "no consta": no se inventa un nivel que el juego no
// permite deducir. En una partida real no aparecia ni una vez, pero existe.
export function tierBand(tier: number | undefined): 0 | 1 | 2 | 3 | -1 {
  if (tier === undefined || tier === null || !Number.isFinite(tier)) return -1;
  if (tier <= 1) return 0;
  if (tier <= 4) return 1;
  if (tier <= 7) return 2;
  return 3;
}

/** Nombre de la banda, para leyendas y títulos. */
export const BAND_NAME: Record<string, { es: string; en: string }> = {
  "0": { es: "inicio", en: "early" },
  "1": { es: "media", en: "mid" },
  "2": { es: "tardía", en: "late" },
  "3": { es: "final", en: "endgame" },
  "-1": { es: "sin dato", en: "unknown" },
};

function bandShape(band: number, c: string): string {
  const paint = `fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"`;
  switch (band) {
    case 0:
      return `<circle cx="12" cy="12" r="8.2" ${paint}/>`;
    case 1:
      return `<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.2" ${paint}/>`;
    case 2:
      // El hexágono de siempre: lo que era la forma única ahora es una banda.
      return `<path d="M12 3.2l7.1 4.1v8.2L12 19.6l-7.1-4.1V7.3z" ${paint}/>`;
    case 3:
      return `<path d="M12.00 3.00L14.53 8.52L20.56 9.22L16.09 13.33L17.29 19.28L12.00 16.30L6.71 19.28L7.91 13.33L3.44 9.22L9.47 8.52Z" ${paint}/>`;
    default:
      // Punto pequeño: menos forma porque hay menos información.
      return `<circle cx="12" cy="12" r="3.6" ${paint}/>`;
  }
}

export function glyphSVG(
  cls: string,
  opts: {
    fluid?: boolean;
    building?: boolean;
    size?: number;
    tier?: number;
    family?: string | null;
  } = {}
): string {
  const s = opts.size ?? 18;
  const c = familyColor(cls, opts.family);
  const body = opts.building
    ? `<rect x="4" y="4" width="16" height="16" rx="3" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6"/>`
    : opts.fluid
      ? // Gota: lo líquido y lo gaseoso comparten forma; el color los separa.
        `<path d="M12 3.5c3.4 4.2 5.5 7 5.5 9.6a5.5 5.5 0 0 1-11 0C6.5 10.5 8.6 7.7 12 3.5z" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`
      : // Sólido: la forma dice en qué punto de la partida aparece la pieza.
        // Lo líquido se queda con la gota aunque tenga tier: saber que algo va
        // por tubería y no por cinta es más accionable que saber su nivel, y
        // la gota no se confunde con ninguna de las cuatro bandas.
        bandShape(tierBand(opts.tier), c);
  return (
    `<svg class="glyph" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
    body +
    `</svg>`
  );
}
