// Migración del histórico a clases (métricas, esquema 3).
//
// Hasta el esquema 2 las fotos guardaban el NOMBRE de cada pieza, y en un mismo
// history.json conviven cuatro vocabularios: el español actual, el inglés, el
// español viejo de la propia app y nombres sacados a mano de la clase
// ("Ore Iron"). Aquí se resuelven a clases; Rust hace la copia y la escritura
// (ver migrate_history en lib.rs). Lo que no se resuelve no se toca: se queda
// con la cadena que tenía, nunca se tira.

import type { GameData } from "./gamedata";

// MIGRACIÓN, NO TRADUCCIÓN. El español viejo de la propia app, de antes de que
// sus tablas se corrigieran para coincidir con el juego: con la misma versión
// del juego, seis fotos dicen "Placa de hierro" y las siguientes "Plancha de
// hierro". Ningún catálogo conoce estos nombres porque nunca fueron del juego.
// Se usa una vez por foto vieja y después sobra; no lo uses para pintar nada.
// Cada uno verificado contra el catálogo.
const OLD_APP_SPANISH: Record<string, string> = {
  "Hilo de cobre": "Desc_Wire_C",
  "Marco modular": "Desc_ModularFrame_C",
  Micelio: "Desc_Mycelia_C",
  "Placa de hierro": "Desc_IronPlate_C",
  "Placa de hierro reforzada": "Desc_IronPlateReinforced_C",
  "Placa inteligente": "Desc_SpaceElevatorPart_1_C",
  Tornillo: "Desc_IronScrew_C",
  "Viga industrial revestida": "Desc_SteelPlateReinforced_C",
};

/// La clase de un nombre viejo, o null si no hay forma honesta de saberla.
/// En este orden:
///   1. El índice de nombres del catálogo, que conoce todos los idiomas.
///   2. El inverso mecánico de prettyItem: quitar los espacios y probar
///      Desc_X_C, BP_X_C y X_C. Así vuelven "Ore Iron", "Cement", "WAT 2" y
///      los "BP_Equipment Descriptor ...", que nunca fueron nombres de nada.
///   3. El español viejo de la app, arriba.
/// Solo se acepta una clase que el catálogo conoce.
export function resolveOldName(
  name: string,
  gd: GameData,
  index: Map<string, string>
): string | null {
  const known = (c: string) => !!(gd.items[c] || gd.buildings[c]);
  const byName = index.get(name.toLowerCase());
  if (byName) return byName;
  const k = name.replace(/ /g, "");
  for (const c of [`Desc_${k}_C`, `BP_${k}_C`, `${k}_C`]) if (known(c)) return c;
  const old = OLD_APP_SPANISH[name];
  if (old && known(old)) return old;
  return null;
}

/// El mapa que se manda a Rust: solo los nombres que se resuelven.
export function buildNameMap(
  names: string[],
  gd: GameData,
  index: Map<string, string>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const n of names) {
    const c = resolveOldName(n, gd, index);
    if (c) map[n] = c;
  }
  return map;
}
