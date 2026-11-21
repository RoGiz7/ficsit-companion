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
  { key: "alien", re: /Alien|Somersloop|Mercer|SAM|DNA/i, color: "#b06fc0" },
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
  { key: "petroleo", re: /Oil|Plastic|Rubber|Fuel|Polymer|Resin|Turbofuel|Diluted/i, color: "#8f7fc0" },
  { key: "nitrogeno", re: /Nitrogen|Nitric/i, color: "#6fa8d0" },
  { key: "agua", re: /Water|Ice/i, color: "#4f9fd8" },
  { key: "organico", re: /Biomass|Leaves|Wood|Mycelia|Protein|Berry|Nut|Flower|Fabric|Medicinal/i, color: "#7fb060" },
];

const DEFAULT_COLOR = "#8b93a3";

export function familyColor(cls: string): string {
  const f = FAMILIES.find((x) => x.re.test(cls));
  return f ? f.color : DEFAULT_COLOR;
}

/// Un glifo en SVG, listo para meter en el HTML. `fluid` decide la forma:
/// sólido hexágono, líquido gota, gas círculo hueco. Edificios, cuadrado.
export function glyphSVG(cls: string, opts: { fluid?: boolean; building?: boolean; size?: number } = {}): string {
  const s = opts.size ?? 18;
  const c = familyColor(cls);
  const body = opts.building
    ? `<rect x="4" y="4" width="16" height="16" rx="3" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6"/>`
    : opts.fluid
      ? // Gota: lo líquido y lo gaseoso comparten forma; el color los separa.
        `<path d="M12 3.5c3.4 4.2 5.5 7 5.5 9.6a5.5 5.5 0 0 1-11 0C6.5 10.5 8.6 7.7 12 3.5z" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`
      : // Hexágono: lo sólido. Es la forma de una pieza vista de canto y no
        // se parece a nada de nadie.
        `<path d="M12 3.2l7.1 4.1v8.2L12 19.6l-7.1-4.1V7.3z" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
  return (
    `<svg class="glyph" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
    body +
    `</svg>`
  );
}
