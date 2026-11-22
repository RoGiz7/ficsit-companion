// Comprobaciones antes de etiquetar una version. No arranca nada ni compila:
// solo lee archivos y dice lo que no cuadra.
//
// Existe porque las tres versiones desincronizadas es el fallo clasico y no
// avisa: el instalador diria una cosa, la app otra, y el actualizador
// compararia contra la equivocada.
//
//   node scripts/check-release.mjs
import fs from "fs";

const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));

let fallos = 0;
const ok = (m) => console.log("  ok   " + m);
const mal = (m) => {
  console.log("  FALLA " + m);
  fallos++;
};

const pkg = json("package.json");
const cfg = json("src-tauri/tauri.conf.json");
const cargo = read("src-tauri/Cargo.toml");
const cargoV = (cargo.match(/^version = "([^"]+)"/m) || [])[1];

console.log("\nVersiones");
if (pkg.version === cfg.version && cfg.version === cargoV) ok(`las tres son ${pkg.version}`);
else mal(`package.json=${pkg.version} tauri.conf.json=${cfg.version} Cargo.toml=${cargoV}`);

console.log("\nActualizador");
const upd = (cfg.plugins || {}).updater;
if (!upd) mal("no hay bloque plugins.updater");
else {
  if (upd.pubkey && !/PEGAR/.test(upd.pubkey)) ok("hay clave publica");
  else mal("la clave publica sigue siendo el marcador: ver docs/RELEASE.md");
  const ep = (upd.endpoints || [])[0] || "";
  const repo = (cargo.match(/repository = "https:\/\/github\.com\/([^"]+?)(?:\.git)?"/) || [])[1];
  if (repo && ep.includes(repo)) ok(`el endpoint apunta a ${repo}`);
  else mal(`el endpoint (${ep}) no apunta al repositorio del Cargo.toml (${repo})`);
}

console.log("\nLas dos mitades del plugin");
const js = (pkg.dependencies || {})["@tauri-apps/plugin-updater"] || "";
const lock = read("src-tauri/Cargo.lock");
const rs = (lock.match(/name = "tauri-plugin-updater"\nversion = "([^"]+)"/) || [])[1];
if (/^[\^~]/.test(js)) mal(`el paquete de npm no esta clavado (${js}): un npm update lo separaria de Rust`);
else if (js && rs && js === rs) ok(`npm ${js} y Rust ${rs} van a la par`);
else mal(`npm ${js} contra Rust ${rs}: Tauri avisara del desajuste`);

console.log("\nFlujo de publicacion");
try {
  const wf = read(".github/workflows/release.yml");
  wf.includes("includeUpdaterJson: true") ? ok("genera latest.json") : mal("falta includeUpdaterJson");
  wf.includes("TAURI_SIGNING_PRIVATE_KEY") ? ok("usa los secretos de firma") : mal("no firma");
} catch {
  mal("no existe .github/workflows/release.yml");
}

console.log(
  fallos
    ? `\n${fallos} cosa(s) que arreglar antes de etiquetar.\n`
    : "\nTodo en orden. Recuerda que el borrador hay que publicarlo a mano: el endpoint\napunta a la ultima release PUBLICADA, y un borrador no cuenta.\n"
);
process.exit(fallos ? 1 : 0);
