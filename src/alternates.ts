// Recetas alternativas: las 109 que el juego esconde en discos duros.
//
// La partida sabe cuáles has abierto y la documentación del juego sabe qué
// receta trae cada una. Cruzarlas es lo único que ningún otro programa puede
// hacer por ti, porque hace falta tu partida CONCRETA: un catálogo de
// alternativas lo tiene cualquiera, saber cuáles tienes tú y cuáles te sirven
// para lo que de verdad fabricas, no.
//
// Tres reglas que salieron de mirar los datos y que conviene no deshacer:
//
// 1. La receta estándar la decide canonRecipe(), no este módulo. Esa función ya
//    sabe excluir el Convertidor, que fabrica mineral de hierro a partir de
//    caliza y por tanto se cuela como "la receta estándar del mineral" si se
//    le deja. Ya mordió dos veces en este proyecto; no se escribe otra vez.
//
// 2. NO toda alternativa tiene con qué compararse. El carbón se pica, no se
//    fabrica, así que el Biocarbón no ahorra nada: hace carbón de biomasa, que
//    es otra cosa. Para ésas se dice qué permite hacer, sin inventar un
//    porcentaje de ahorro que no existe.
//
// 3. Sólo se habla de piezas que la partida fabrica de verdad. Tener
//    desbloqueada una alternativa de algo que no produces no es un consejo,
//    es ruido.

export type Receta = {
  out: string;
  rate: number;
  building: string | null;
  inputs: { item: string; rate: number }[];
};

export type Cambio = {
  item: string;
  /// Unidades de esta entrada por UNIDAD producida, con la receta estándar.
  antes: number;
  /// Lo mismo con la alternativa. 0 significa que deja de hacer falta.
  ahora: number;
};

export type Consejo = {
  esquema: string;
  receta: string;
  /// Clase de la pieza que sale.
  pieza: string;
  /// Si hay receta estándar con la que comparar. Cuando es false, el consejo
  /// es "esto te permite fabricar X a partir de Y" y nada más.
  comparable: boolean;
  cambios: Cambio[];
  /// Salida por máquina y minuto, estándar frente a alternativa.
  porMaquina: { antes: number; ahora: number } | null;
  /// Entradas por unidad de la alternativa. Es lo que se enseña cuando no hay
  /// comparación posible.
  entradas: { item: string; rate: number }[];
  /// Mayor recorte relativo de una entrada que esté en LAS DOS recetas, de 0 a
  /// 1. Ordena la lista. Las entradas que desaparecen no cuentan aquí: eso es
  /// una sustitución, no un ahorro, y contarlas daba "mejora del 100%" a una
  /// receta que sólo cambia tornillos por alambre.
  mejora: number;
};

/// Entradas por unidad producida. Comparar recetas en crudo mentiría a favor
/// de la que más produce: la plancha soldada saca 5,625/min y la estándar 5, y
/// sin normalizar parecería que gasta casi lo mismo cuando gasta la mitad.
function porUnidad(r: Receta): { item: string; rate: number }[] {
  if (!(r.rate > 0)) return [];
  return r.inputs.map((i) => ({ item: i.item, rate: i.rate / r.rate }));
}

export function consejosAlternativas(
  desbloqueadas: string[],
  schematics: Record<string, { unlocks: string[] }>,
  recipes: Record<string, Receta>,
  /// Receta estándar de cada pieza, tal como la da canonRecipe().
  canon: Record<string, Receta>,
  /// ¿La partida fabrica esta pieza ahora mismo?
  produce: (pieza: string) => boolean
): Consejo[] {
  const out: Consejo[] = [];
  const vistas = new Set<string>();

  for (const esq of desbloqueadas) {
    const s = schematics[esq];
    if (!s) continue;
    for (const rc of s.unlocks) {
      if (vistas.has(rc)) continue;
      const r = recipes[rc];
      // Que una entrada no resuelva a receta no es un error: los esquemas
      // abren también cosas que no son recetas de máquina.
      if (!r || !r.out || !r.building) continue;
      if (!produce(r.out)) continue;
      vistas.add(rc);

      const mias = porUnidad(r);
      const est = canon[r.out];
      if (!est) {
        out.push({
          esquema: esq, receta: rc, pieza: r.out, comparable: false,
          cambios: [], porMaquina: null, entradas: mias, mejora: 0,
        });
        continue;
      }

      const suyas = porUnidad(est);
      const items = [...new Set([...suyas.map((x) => x.item), ...mias.map((x) => x.item)])];
      const cambios: Cambio[] = items.map((item) => ({
        item,
        antes: suyas.find((x) => x.item === item)?.rate ?? 0,
        ahora: mias.find((x) => x.item === item)?.rate ?? 0,
      }));
      // Sólo las entradas que siguen haciendo falta. Un material que
      // desaparece se cambia por otro, y presentar eso como un recorte del
      // 100% exagera a favor de la alternativa.
      let mejora = 0;
      for (const c of cambios) {
        if (c.antes > 0 && c.ahora > 0) {
          mejora = Math.max(mejora, (c.antes - c.ahora) / c.antes);
        }
      }
      out.push({
        esquema: esq, receta: rc, pieza: r.out, comparable: true,
        cambios, porMaquina: { antes: est.rate, ahora: r.rate }, entradas: mias, mejora,
      });
    }
  }

  out.sort((a, b) => b.mejora - a.mejora);
  return out;
}
