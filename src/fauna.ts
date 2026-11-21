// Bestiario.
//
// Regla de la casa: solo entra lo que el pionero se ha encontrado de verdad.
// Una especie aparece en la ficha cuando estaba cargada en una partida que la
// app ha leído, es decir, cuando uno la tenía cerca al guardar. Eso hace que
// la ficha se llene jugando y no de golpe, que es la gracia.
//
// Límite honesto: el save NO dice qué especie hay en cada nido. De 437
// ranuras de criatura en una partida real, solo 1 tenía bicho instanciado; el
// resto se resuelven al aparecer. Lo que sí persiste son los criaderos, que
// son objetos fijos del mundo, y lo que estuviera cargado al guardar.
//
// Los nombres de clase vienen del juego. Los nuestros son los de la wiki
// oficial donde los conocemos, y donde no, se embellece la clase y se dice.

export interface FaunaEntry {
  cls: string;
  count: number;
  destroyed: number; // criaderos con día de muerte
}

interface Species {
  es: string;
  en: string;
  hostile: boolean;
  note?: { es: string; en: string };
}

const KNOWN: Record<string, Species> = {
  Char_SpaceRabbit_C: {
    es: "Lizard Doggo",
    en: "Lizard Doggo",
    hostile: false,
    note: {
      es: "Pacífico y domesticable. Internamente el juego lo llamó «Space Rabbit» durante años, y de ahí el nombre de clase.",
      en: "Peaceful and tameable. The game called it “Space Rabbit” internally for years, hence the class name.",
    },
  },
  Char_SpaceGiraffe_C: {
    es: "Jirafa-garrapata-pingüino-ballena espacial",
    en: "Space Giraffe-Tick-Penguin-Whale Thing",
    hostile: false,
    note: {
      es: "Enorme, pacífica y con el nombre más largo del planeta. FICSIT no ha encontrado uso industrial para ella, lo cual no ha impedido que lo intente.",
      en: "Enormous, peaceful, and with the longest name on the planet. FICSIT has found no industrial use for it, which has not stopped FICSIT from trying.",
    },
  },
  Char_NonFlyingBird_C: {
    es: "Ave no voladora",
    en: "Non-flying bird",
    hostile: false,
  },
  Char_CrabHatcher_C: {
    es: "Criadero de arácnidos",
    en: "Arachnid hatcher",
    hostile: true,
    note: {
      es: "Objeto fijo: no se mueve y no desaparece, así que la partida lo recuerda siempre. Si lo revienta, queda anotado el día.",
      en: "A fixed object: it does not move and does not despawn, so the save always remembers it. Destroy one and the day is recorded.",
    },
  },
  Char_BigCrabHatcher_C: {
    es: "Criadero grande de arácnidos",
    en: "Large arachnid hatcher",
    hostile: true,
    note: {
      es: "La versión con más aguante. Suele venir acompañada.",
      en: "The tougher version. It usually comes with company.",
    },
  },
};

// Para lo que no está en la tabla: deducir por el nombre de clase antes que
// callarse. Decir «un cerdo de algún tipo» es más útil que no decir nada, y
// más honesto que inventarse la especie exacta.
const HINTS: { re: RegExp; es: string; en: string; hostile: boolean }[] = [
  { re: /Hog/i, es: "Cerdo (alguna variedad)", en: "Hog (some variety)", hostile: true },
  { re: /Stinger|Crab|Spider/i, es: "Arácnido (alguna variedad)", en: "Arachnid (some variety)", hostile: true },
  { re: /Spitter/i, es: "Escupidor", en: "Spitter", hostile: true },
  { re: /Bird/i, es: "Ave", en: "Bird", hostile: false },
];

export function speciesName(cls: string, lang: string): string {
  const k = KNOWN[cls];
  if (k) return lang === "es" ? k.es : k.en;
  const h = HINTS.find((x) => x.re.test(cls));
  if (h) return lang === "es" ? h.es : h.en;
  // Sin nada mejor, el nombre de clase limpio. Que se vea que es eso.
  return cls.replace(/^Char_/, "").replace(/_C$/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function speciesHostile(cls: string): boolean | null {
  const k = KNOWN[cls];
  if (k) return k.hostile;
  const h = HINTS.find((x) => x.re.test(cls));
  return h ? h.hostile : null;
}

export function speciesNote(cls: string, lang: string): string {
  const k = KNOWN[cls];
  if (!k || !k.note) return "";
  return lang === "es" ? k.note.es : k.note.en;
}

export function isKnownSpecies(cls: string): boolean {
  return !!KNOWN[cls];
}
