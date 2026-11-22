// Backend (motor en Rust) — Fases 0 y 1
// Fase 0: listar y vigilar los .sav de una carpeta.
// Fase 1: leer la CABECERA de cada .sav (nombre de sesión, build, tiempo jugado, fecha).
//
// REGLA DE ORO: aquí solo LEEMOS bytes. Nunca escribimos en los .sav.

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::thread;
use std::time::{Duration, Instant, UNIX_EPOCH};

use flate2::read::ZlibDecoder;
use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

// Ticks de .NET (intervalos de 100 ns desde el año 1) que equivalen al 1/1/1970.
// Sirve para convertir la fecha del save a algo que JavaScript entienda (ms desde 1970).
const DOTNET_TICKS_AT_UNIX_EPOCH: i64 = 621_355_968_000_000_000;

// Datos extraídos de la cabecera del .sav.
#[derive(Serialize, Clone)]
struct SaveHeader {
    session_name: String,
    map_name: String,
    save_version: i32,
    build_version: i32,
    play_duration_seconds: i32,
    save_date_ms: i64, // fecha de la partida en ms desde 1970
}

// Una partida = metadatos del archivo + (si se pudo leer) la cabecera.
#[derive(Serialize, Clone)]
struct SaveEntry {
    name: String,
    size_bytes: u64,
    modified_ms: u64,
    header: Option<SaveHeader>,
}

// ---- Lectores binarios sencillos sobre un buffer de bytes ----

fn read_i32(buf: &[u8], pos: usize) -> Option<i32> {
    let b = buf.get(pos..pos + 4)?;
    Some(i32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn read_i64(buf: &[u8], pos: usize) -> Option<i64> {
    let b = buf.get(pos..pos + 8)?;
    Some(i64::from_le_bytes([
        b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
    ]))
}

// Lee una cadena al estilo Unreal/Satisfactory:
//   int32 longitud, luego los bytes. Longitud positiva = texto normal (incluye el \0 final);
//   negativa = texto UTF-16. Devuelve (texto, nueva_posicion).
fn read_string(buf: &[u8], pos: usize) -> Option<(String, usize)> {
    let len = read_i32(buf, pos)?;
    let mut p = pos + 4;
    if len == 0 {
        return Some((String::new(), p));
    }
    if len > 0 {
        let n = len as usize;
        // Salvaguarda: longitudes absurdas = formato no esperado.
        if n > 100_000 {
            return None;
        }
        let bytes = buf.get(p..p + n)?;
        // El último byte es el \0 final; lo quitamos.
        let s = String::from_utf8_lossy(&bytes[..n.saturating_sub(1)]).to_string();
        p += n;
        Some((s, p))
    } else {
        let chars = (-len) as usize;
        if chars > 100_000 {
            return None;
        }
        let byte_len = chars * 2;
        let bytes = buf.get(p..p + byte_len)?;
        // UTF-16 LE, quitando el carácter \0 final.
        let units: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .take(chars.saturating_sub(1))
            .collect();
        p += byte_len;
        Some((String::from_utf16_lossy(&units), p))
    }
}

// Parsea la cabecera a partir de los primeros bytes del archivo.
// Orden de la cabecera (build ~493321 / versión 14):
//   i32 headerVersion, i32 saveVersion, i32 buildVersion,
//   str saveName, str mapName, str mapOptions, str sessionName,
//   i32 playDurationSeconds, i64 saveDateTime(ticks .NET)
// Rangos plausibles de la cabecera. En la carpeta de guardados hay .sav que NO
// son partidas (ServerManager.sav, TelemetrySettings.sav, que es un GVAS de
// Unreal), y hasta ahora los intentabamos leer como mundos.
const MAX_HEADER_VERSION: i32 = 40;
const MAX_SAVE_VERSION: i32 = 300;

fn parse_header(buf: &[u8]) -> Option<SaveHeader> {
    let header_version = read_i32(buf, 0)?;
    let save_version = read_i32(buf, 4)?;
    let build_version = read_i32(buf, 8)?;

    // Si estos numeros no son plausibles, el archivo no es una partida.
    if header_version <= 0
        || header_version > MAX_HEADER_VERSION
        || save_version <= 0
        || save_version > MAX_SAVE_VERSION
        || build_version <= 0
    {
        return None;
    }

    let (_save_name, p) = read_string(buf, 12)?;
    let (map_name, p) = read_string(buf, p)?;
    let (_map_options, p) = read_string(buf, p)?;
    let (session_name, p) = read_string(buf, p)?;

    let play_duration_seconds = read_i32(buf, p)?;
    let save_date_ticks = read_i64(buf, p + 4)?;
    let save_date_ms = (save_date_ticks - DOTNET_TICKS_AT_UNIX_EPOCH) / 10_000;

    // Sanity check: descarta lecturas claramente inválidas.
    if play_duration_seconds < 0 || save_date_ms < 0 {
        return None;
    }

    Some(SaveHeader {
        session_name,
        map_name,
        save_version,
        build_version,
        play_duration_seconds,
        save_date_ms,
    })
}

// Lee solo los primeros bytes del archivo (la cabecera vive al principio).
fn read_header_from_path(path: &Path) -> Option<SaveHeader> {
    let mut f = File::open(path).ok()?;
    let mut buf = vec![0u8; 65_536];
    let n = f.read(&mut buf).ok()?;
    buf.truncate(n);
    parse_header(&buf)
}

// Comando: lista los .sav con metadatos + cabecera, ordenados por fecha (más reciente primero).
#[tauri::command]
fn list_saves(folder: String) -> Result<Vec<SaveEntry>, String> {
    let dir = Path::new(&folder);
    if !dir.is_dir() {
        return Err(format!("La carpeta no existe o no es accesible:\n{}", folder));
    }

    let mut saves: Vec<SaveEntry> = Vec::new();
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let is_sav = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("sav"))
            .unwrap_or(false);
        if !is_sav {
            continue;
        }

        // Solo partidas de verdad: la carpeta tambien guarda .sav de ajustes
        // (ServerManager, TelemetrySettings) que no tienen nada que ver.
        let header = match read_header_from_path(&path) {
            Some(h) => h,
            None => continue,
        };

        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        saves.push(SaveEntry {
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("?")
                .to_string(),
            size_bytes: meta.len(),
            modified_ms,
            header: Some(header),
        });
    }

    saves.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(saves)
}

// Comando: devuelve los bytes crudos del .sav a la interfaz, que los parsea
// con la librería completa (etothepii). Solo lee; nunca escribe.
#[tauri::command]
fn read_save_bytes(folder: String, name: String) -> Result<tauri::ipc::Response, String> {
    let path = Path::new(&folder).join(&name);
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(data))
}

// ---- Autodeteccion de la carpeta de guardados ----
// Hasta ahora la ruta estaba escrita a fuego en el frontend, con el usuario de
// Windows y el id de Steam de su dueno dentro, asi que la app solo funcionaba
// en un ordenador del mundo.

#[derive(Serialize, Clone)]
struct DetectedFolder {
    path: String,
    save_count: u32,
    newest_ms: u64,
}

// Sitios donde el juego guarda las partidas, segun el sistema.
fn save_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        roots.push(
            PathBuf::from(local)
                .join("FactoryGame")
                .join("Saved")
                .join("SaveGames"),
        );
    }
    if let Ok(home) = std::env::var("HOME") {
        let h = PathBuf::from(home);
        // Steam Play / Proton y Epic en Linux.
        roots.push(h.join(".local/share/Steam/steamapps/compatdata/526870/pfx/drive_c/users/steamuser/AppData/Local/FactoryGame/Saved/SaveGames"));
        roots.push(h.join(".steam/root/steamapps/compatdata/526870/pfx/drive_c/users/steamuser/AppData/Local/FactoryGame/Saved/SaveGames"));
        roots.push(h.join(".config/Epic/FactoryGame/Saved/SaveGames"));
    }
    roots
}

// Cuantas partidas hay en una carpeta y cuando se guardo la mas reciente.
fn survey_folder(dir: &Path) -> (u32, u64) {
    let mut count = 0u32;
    let mut newest = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            let is_sav = p
                .extension()
                .and_then(|x| x.to_str())
                .map(|x| x.eq_ignore_ascii_case("sav"))
                .unwrap_or(false);
            if !is_sav || read_header_from_path(&p).is_none() {
                continue;
            }
            count += 1;
            if let Ok(m) = e.metadata() {
                if let Some(ms) = m
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                {
                    if ms > newest {
                        newest = ms;
                    }
                }
            }
        }
    }
    (count, newest)
}

// Comando: busca carpetas de guardados. Las partidas viven en subcarpetas con
// el id de la cuenta (Steam o Epic), asi que miramos esas; puede haber varias
// si se ha jugado con mas de una cuenta. La mas usada va primero.
#[tauri::command]
fn detect_save_folders() -> Vec<DetectedFolder> {
    let mut out: Vec<DetectedFolder> = Vec::new();
    for root in save_roots() {
        if !root.is_dir() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(&root) {
            for e in entries.flatten() {
                let p = e.path();
                if !p.is_dir() {
                    continue;
                }
                // "blueprints" guarda planos, no partidas.
                if p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.eq_ignore_ascii_case("blueprints"))
                    .unwrap_or(false)
                {
                    continue;
                }
                let (count, newest) = survey_folder(&p);
                if count > 0 {
                    out.push(DetectedFolder {
                        path: p.to_string_lossy().to_string(),
                        save_count: count,
                        newest_ms: newest,
                    });
                }
            }
        }
        // Algunas instalaciones dejan las partidas sueltas en la raiz.
        let (count, newest) = survey_folder(&root);
        if count > 0 {
            out.push(DetectedFolder {
                path: root.to_string_lossy().to_string(),
                save_count: count,
                newest_ms: newest,
            });
        }
    }
    out.sort_by(|a, b| b.newest_ms.cmp(&a.newest_ms));
    out
}

// ---- Documentacion oficial del juego (CommunityResources/Docs) ----
// El juego publica todas sus recetas, edificios y nombres, traducidos, en un
// JSON por idioma. Es la fuente de verdad: mientras mantengamos las tablas a
// mano, siempre iremos por detras de los parches.
//
// No metemos esos archivos en el repo: son de Coffee Stain. Se leen de la
// instalacion del propio usuario, que es su copia legitima.

#[derive(Serialize, Clone)]
struct DocsFolder {
    path: String,
    languages: Vec<String>,
    newest_ms: u64, // para saber si el juego se ha actualizado desde la ultima lectura
}

// Bibliotecas de Steam declaradas en libraryfolders.vdf.
fn steam_libraries() -> Vec<PathBuf> {
    let mut libs: Vec<PathBuf> = Vec::new();
    let mut roots: Vec<PathBuf> = Vec::new();
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Ok(v) = std::env::var(var) {
            roots.push(PathBuf::from(v).join("Steam"));
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        roots.push(PathBuf::from(&home).join(".steam/steam"));
        roots.push(PathBuf::from(&home).join(".local/share/Steam"));
    }
    for root in roots {
        let vdf = root.join("steamapps").join("libraryfolders.vdf");
        let Ok(text) = std::fs::read_to_string(&vdf) else {
            continue;
        };
        libs.push(root.clone());
        // Lineas del tipo:   "path"    "D:\SteamLibrary"
        for line in text.lines() {
            let t = line.trim();
            if !t.starts_with("\"path\"") {
                continue;
            }
            if let Some(p) = t.split('"').nth(3) {
                libs.push(PathBuf::from(p.replace("\\\\", "\\")));
            }
        }
    }
    libs
}

// Comando: busca las carpetas Docs del juego y que idiomas traen.
#[tauri::command]
fn detect_docs_folders() -> Vec<DocsFolder> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    for lib in steam_libraries() {
        candidates.push(
            lib.join("steamapps")
                .join("common")
                .join("Satisfactory")
                .join("CommunityResources")
                .join("Docs"),
        );
    }
    // Epic instala por defecto aqui.
    for var in ["ProgramFiles", "ProgramFiles(x86)"] {
        if let Ok(v) = std::env::var(var) {
            for name in ["Satisfactory", "SatisfactoryEarlyAccess", "SatisfactoryExperimental"] {
                candidates.push(
                    PathBuf::from(&v)
                        .join("Epic Games")
                        .join(name)
                        .join("CommunityResources")
                        .join("Docs"),
                );
            }
        }
    }

    let mut out: Vec<DocsFolder> = Vec::new();
    let mut seen: Vec<String> = Vec::new();
    for dir in candidates {
        if !dir.is_dir() {
            continue;
        }
        let key = dir.to_string_lossy().to_string();
        if seen.contains(&key) {
            continue;
        }
        let mut languages: Vec<String> = Vec::new();
        let mut newest_ms: u64 = 0;
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for e in entries.flatten() {
                let p = e.path();
                let is_json = p
                    .extension()
                    .and_then(|x| x.to_str())
                    .map(|x| x.eq_ignore_ascii_case("json"))
                    .unwrap_or(false);
                if !is_json {
                    continue;
                }
                if let Some(stem) = p.file_stem().and_then(|x| x.to_str()) {
                    languages.push(stem.to_string());
                }
                if let Ok(m) = e.metadata() {
                    if let Some(ms) = m
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as u64)
                    {
                        if ms > newest_ms {
                            newest_ms = ms;
                        }
                    }
                }
            }
        }
        if !languages.is_empty() {
            languages.sort();
            seen.push(key.clone());
            out.push(DocsFolder {
                path: key,
                languages,
                newest_ms,
            });
        }
    }
    out
}

// Comando: los bytes crudos de un idioma concreto. Van en UTF-16, asi que la
// decodificacion la hace la interfaz.
#[tauri::command]
fn read_docs_lang(folder: String, lang: String) -> Result<tauri::ipc::Response, String> {
    // Nada de rutas con trampa: el idioma es solo un nombre de archivo.
    if lang.contains('/') || lang.contains('\\') || lang.contains("..") {
        return Err("Idioma no valido.".into());
    }
    let path = Path::new(&folder).join(format!("{lang}.json"));
    let data = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(data))
}

// ---- Cache de los datos del juego ya destilados ----
// Los JSON del juego son 10 MB por idioma. Se leen una vez, se extrae lo que
// usamos y se guarda compacto aqui.

// ---- Mudanza desde el identificador viejo ----
//
// La app se llamaba FICSIT Companion y su identificador era
// com.rogiz7.ficsitcompanion. Al pasar a OttO cambia el identificador, y con
// el cambia la carpeta donde Tauri guarda los datos. Sin esto, al abrir la
// version nueva el usuario se encuentra la casa vacia: historico, notas,
// planes y copias, todo "perdido" aunque siga en el disco.
//
// Se COPIA, no se mueve, y la carpeta vieja se deja intacta. Este proyecto ya
// perdio un historico una vez por una escritura a medias; si la mudanza sale
// mal, el original tiene que seguir ahi.
//
// Solo corre una vez: si la carpeta nueva ya tiene historico, no se toca nada.
const OLD_IDENTIFIER: &str = "com.rogiz7.ficsitcompanion";

fn copy_dir(from: &std::path::Path, to: &std::path::Path) -> std::io::Result<u32> {
    std::fs::create_dir_all(to)?;
    let mut n = 0;
    for entry in std::fs::read_dir(from)? {
        let entry = entry?;
        let destino = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            n += copy_dir(&entry.path(), &destino)?;
        } else if !destino.exists() {
            // Nunca se pisa un archivo que ya este en la carpeta nueva.
            std::fs::copy(entry.path(), &destino)?;
            n += 1;
        }
    }
    Ok(n)
}

fn migrate_old_data(app: &AppHandle) -> Result<Option<u32>, String> {
    let nueva = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?;
    if nueva.join("history.json").exists() {
        return Ok(None); // ya hay datos aqui: nada que mudar
    }
    let Some(padre) = nueva.parent() else {
        return Ok(None);
    };
    let vieja = padre.join(OLD_IDENTIFIER);
    if !vieja.is_dir() || !vieja.join("history.json").exists() {
        return Ok(None);
    }
    let n = copy_dir(&vieja, &nueva).map_err(|e| format!("No se pudo copiar: {e}"))?;
    Ok(Some(n))
}

#[tauri::command]
fn migrated_files(app: AppHandle) -> Result<Option<u32>, String> {
    migrate_old_data(&app)
}

fn game_data_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("gamedata.json"))
}

// ---- Iconos de las piezas ----
//
// El arte es de Coffee Stain y NO viaja con la app: ni en el repositorio ni en
// el instalador. El usuario extrae los iconos de su propia copia del juego una
// vez, elige la carpeta, y aquí solo se indexa lo que ya está en su disco. Es
// el mismo trato que damos a Docs.json y por la misma razón.
//
// No decodificamos los .pak: eso sería desempaquetar los assets del juego, que
// es otra cosa distinta de leer lo que el juego publica para la comunidad.

#[derive(Serialize)]
struct IconIndex {
    count: usize,
    /// nombre del archivo sin extensión, en minúsculas -> ruta absoluta
    map: HashMap<String, String>,
}

const ICON_EXT: [&str; 4] = ["png", "webp", "jpg", "jpeg"];
const ICON_MAX: usize = 20_000;

fn walk_icons(dir: &Path, depth: usize, out: &mut HashMap<String, String>) {
    if depth > 8 || out.len() >= ICON_MAX {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return; // una carpeta ilegible no es motivo para abortar el resto
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            walk_icons(&path, depth + 1, out);
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .unwrap_or_default();
        if !ICON_EXT.contains(&ext.as_str()) {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            // El primero gana: si el usuario tiene el mismo icono en dos
            // resoluciones, nos quedamos con el que aparezca antes en vez de
            // ir pisando y acabar con una mezcla impredecible.
            out.entry(stem.to_ascii_lowercase())
                .or_insert_with(|| path.to_string_lossy().to_string());
        }
        if out.len() >= ICON_MAX {
            return;
        }
    }
}

/// La carpeta que la app propone: suya, vacía al principio, y el usuario
/// suelta ahí los iconos que extraiga. Así nadie tiene que pegar rutas.
fn icons_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?
        .join("icons");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Abre una ficha de la wiki oficial en el navegador del usuario.
///
/// Recibe SOLO el fragmento de título, nunca una URL completa: así la app no
/// puede acabar abriendo cualquier cosa si algún día ese texto viniera de un
/// archivo. Y la página la abre el navegador del usuario, no nosotros: la app
/// sigue sin pedir nada a ninguna red, que es lo que prometen los README.
#[tauri::command]
fn open_wiki(page: String) -> Result<String, String> {
    if page.is_empty() || page.len() > 120 {
        return Err("Pagina no valida.".into());
    }
    // Solo letras, numeros y los pocos signos que usan los titulos de la wiki.
    if !page
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '(' | ')' | '%' | '.'))
    {
        return Err("Pagina no valida.".into());
    }
    let url = format!("https://satisfactory.wiki.gg/wiki/{page}");
    tauri_plugin_opener::open_url(&url, None::<&str>).map_err(|e| e.to_string())?;
    Ok(url)
}

#[tauri::command]
fn default_icon_folder(app: AppHandle) -> Result<String, String> {
    Ok(icons_dir(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn open_icons_folder(app: AppHandle, folder: Option<String>) -> Result<String, String> {
    let path = match folder.filter(|f| !f.trim().is_empty()) {
        Some(f) => PathBuf::from(f),
        None => icons_dir(&app)?,
    };
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    let p = path.to_string_lossy().to_string();
    tauri_plugin_opener::open_path(&p, None::<&str>).map_err(|e| e.to_string())?;
    Ok(p)
}

#[tauri::command]
fn index_icons(app: AppHandle, folder: Option<String>) -> Result<IconIndex, String> {
    let root = match folder.filter(|f| !f.trim().is_empty()) {
        Some(f) => PathBuf::from(f),
        None => icons_dir(&app)?,
    };
    if !root.is_dir() {
        return Err("Esa carpeta no existe.".into());
    }
    let mut map = HashMap::new();
    walk_icons(&root, 0, &mut map);
    // Sin esto el webview no puede pintar las imágenes: hay que abrirle la
    // puerta a esa carpeta concreta, no a todo el disco.
    app.asset_protocol_scope()
        .allow_directory(&root, true)
        .map_err(|e| e.to_string())?;
    Ok(IconIndex {
        count: map.len(),
        map,
    })
}

#[tauri::command]
fn get_game_data(app: AppHandle) -> Result<Option<serde_json::Value>, String> {
    let path = game_data_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_slice(&bytes).ok())
}

#[tauri::command]
fn set_game_data(app: AppHandle, data: serde_json::Value) -> Result<(), String> {
    let path = game_data_file(&app)?;
    // Esto se regenera leyendo el juego, así que perderlo no es grave. Pero
    // dejarlo a medias obliga a releer 10 MB sin decir por qué, y el
    // renombrado cuesta lo mismo que no hacerlo.
    write_json_atomic(&path, &data)
}

// Comando: devuelve solo el principio del archivo. La interfaz parsea ahi la
// cabecera con la libreria completa (version del juego, mods, modo creativo).
// Leer 2 MB enteros solo para saber si una partida lleva mods seria un
// desperdicio: la cabecera cabe de sobra en 64 KB.
#[tauri::command]
fn read_save_head(folder: String, name: String) -> Result<tauri::ipc::Response, String> {
    let path = Path::new(&folder).join(&name);
    let mut f = File::open(&path).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 65_536];
    let n = f.read(&mut buf).map_err(|e| e.to_string())?;
    buf.truncate(n);
    Ok(tauri::ipc::Response::new(buf))
}

// Comando: vigila la carpeta y emite "saves-changed" cuando un .sav cambia.
#[tauri::command]
fn start_watching(app: AppHandle, folder: String) -> Result<(), String> {
    let dir = Path::new(&folder).to_path_buf();
    if !dir.is_dir() {
        return Err(format!("La carpeta no existe o no es accesible:\n{}", folder));
    }

    thread::spawn(move || {
        let (tx, rx) = channel();
        let mut watcher = match notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        }) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("No se pudo crear el vigilante: {e}");
                return;
            }
        };

        if let Err(e) = watcher.watch(&dir, RecursiveMode::NonRecursive) {
            eprintln!("No se pudo vigilar la carpeta: {e}");
            return;
        }

        // Anti-rebote: el juego dispara muchos eventos por guardado; avisamos como mucho cada 500 ms.
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        for res in rx {
            if let Ok(event) = res {
                let touches_sav = event.paths.iter().any(|p| {
                    p.extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.eq_ignore_ascii_case("sav"))
                        .unwrap_or(false)
                });
                if touches_sav && last_emit.elapsed() >= Duration::from_millis(500) {
                    last_emit = Instant::now();
                    let _ = app.emit("saves-changed", ());
                }
            }
        }
    });

    Ok(())
}

// ---- Fase 2: descompresión del cuerpo ----

// Firma que marca el inicio de cada bloque comprimido: magic 0x9E2A83C1 + 0x22222222.
const CHUNK_SIG: [u8; 8] = [0xC1, 0x83, 0x2A, 0x9E, 0x22, 0x22, 0x22, 0x22];

// Una construcción del inventario: nombre legible y cuántas hay.
// REGLA: toda estructura que acabe guardada en disco lleva Default y
// #[serde(default)]. Sin eso, añadir un campo nuevo hace que TODO lo guardado
// antes deje de parsear, y entonces el archivo entero se vuelve ilegible por
// un campo que no estaba el mes pasado.
//
// No es teoría. El 21/11/2026 se añadió `cls` aquí sin default, y la
// restauración de una copia con 45 lecturas falló con "missing field `cls`".
// Cuarenta y cinco lecturas de cinco meses, bloqueadas por tres palabras que
// faltaban en una línea.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct InvItem {
    name: String,
    count: u32,
    // La clase tal cual la nombra el juego (Build_ConstructorMk1_C). Con ella
    // el frontend saca el nombre de la documentación oficial, que es la misma
    // fuente que usa el mapa; `name` queda solo de respaldo para quien no
    // tenga el juego instalado.
    cls: String,
}

// Cuántas máquinas activas están fabricando cada receta.
#[derive(Serialize, Clone)]
struct RecipeCount {
    recipe: String, // nombre de receta, p. ej. "Recipe_IngotIron"
    count: u32,
}

// Progreso de la partida leído del save.
#[derive(Serialize, Clone)]
struct ProgressInfo {
    current_tier: i32,
    milestones: Vec<String>, // "1-1", "2-3", ...
    research_count: u32,
    schematic_total: u32,
}

// Resumen de lo que hay dentro del cuerpo (descomprimido) de una partida.
#[derive(Serialize, Clone)]
struct BodyInfo {
    game_version: String,
    uncompressed_bytes: u64,
    chunk_count: u32,
    total_buildings: u32,
    type_count: u32,
    inventory: Vec<InvItem>,
    progression: ProgressInfo,
    production: Vec<RecipeCount>,
}

// Busca la posición de la firma de bloque dentro del archivo.
fn find_chunk_start(data: &[u8]) -> Option<usize> {
    data.windows(8).position(|w| w == CHUNK_SIG)
}

// Descomprime todos los bloques del cuerpo. Devuelve (bytes, nº de bloques).
fn decompress_body(path: &Path) -> Result<(Vec<u8>, u32), String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;

    let mut pos = find_chunk_start(&data)
        .ok_or_else(|| "No se encontró el cuerpo comprimido en el archivo.".to_string())?;

    let mut out: Vec<u8> = Vec::new();
    let mut chunk_count: u32 = 0;

    while pos + 8 <= data.len() && data[pos..pos + 8] == CHUNK_SIG {
        let mut p = pos + 8;
        p += 8; // maxChunkSize (no lo necesitamos)
        p += 1; // algoritmo de compresión (3 = zlib)
        let compressed_size =
            read_i64(&data, p).ok_or("Archivo truncado (tamaño de bloque).")? as usize;
        p += 8;
        p += 8; // uncompressedSize (resumen)
        p += 8; // compressedSize (bloque)
        p += 8; // uncompressedSize (bloque)

        let chunk = data
            .get(p..p + compressed_size)
            .ok_or("Bloque comprimido incompleto.")?;

        let mut decoder = ZlibDecoder::new(chunk);
        let mut decompressed = Vec::new();
        decoder
            .read_to_end(&mut decompressed)
            .map_err(|e| format!("Error al descomprimir el bloque {}: {}", chunk_count, e))?;
        out.extend_from_slice(&decompressed);

        chunk_count += 1;
        p += compressed_size;
        pos = p;
    }

    if chunk_count == 0 {
        return Err("No se pudo descomprimir ningún bloque.".to_string());
    }
    Ok((out, chunk_count))
}

// De un nombre de instancia (…Build_ConstructorMk1_C_2147482911) saca el tipo "Build_ConstructorMk1".
// Solo lo reconoce si termina en _C_<dígitos>, que es como se nombran los objetos colocados.
fn instance_type(s: &str) -> Option<String> {
    let c_idx = s.rfind("_C_")?;
    let after = &s[c_idx + 3..];
    if after.is_empty() || !after.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let build_idx = s[..c_idx].rfind("Build_")?;
    Some(s[build_idx..c_idx].to_string())
}

// Convierte "Build_ConstructorMk1" en algo legible: "Constructor Mk1".
fn prettify(raw: &str) -> String {
    let s = raw.strip_prefix("Build_").unwrap_or(raw);
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if i > 0 {
            let prev = chars[i - 1];
            // Espacio al pasar de minúscula a mayúscula, o al final de un grupo de mayúsculas.
            let boundary = (c.is_uppercase() && !prev.is_uppercase())
                || (c.is_uppercase()
                    && prev.is_uppercase()
                    && i + 1 < chars.len()
                    && chars[i + 1].is_lowercase());
            if boundary {
                out.push(' ');
            }
        }
        out.push(c);
    }
    out
}

// Recorre el cuerpo descomprimido, encuentra las instancias de construcción únicas
// y las cuenta por tipo. Robusto: usa un conjunto para no contar referencias repetidas.
fn count_buildings(body: &[u8]) -> Vec<InvItem> {
    let mut instances: std::collections::HashSet<String> = std::collections::HashSet::new();
    let n = body.len();
    let mut i = 0usize;

    while i + 4 <= n {
        let ln = i32::from_le_bytes([body[i], body[i + 1], body[i + 2], body[i + 3]]);
        if (2..=300).contains(&ln) && i + 4 + ln as usize <= n {
            let chunk = &body[i + 4..i + 4 + ln as usize];
            let last_is_null = *chunk.last().unwrap() == 0;
            let printable = chunk[..chunk.len() - 1].iter().all(|&c| (32..127).contains(&c));
            if last_is_null && printable {
                if let Ok(s) = std::str::from_utf8(&chunk[..chunk.len() - 1]) {
                    if instance_type(s).is_some() {
                        instances.insert(s.to_string());
                    }
                }
                i += 4 + ln as usize;
                continue;
            }
        }
        i += 1;
    }

    let mut counts: HashMap<String, u32> = HashMap::new();
    for s in &instances {
        if let Some(t) = instance_type(s) {
            *counts.entry(t).or_insert(0) += 1;
        }
    }

    let mut items: Vec<InvItem> = counts
        .into_iter()
        .map(|(raw, count)| InvItem {
            name: prettify(&raw),
            count,
            cls: format!("{raw}_C"),
        })
        .collect();
    // Más numerosas primero; a igualdad, por nombre.
    items.sort_by(|a, b| b.count.cmp(&a.count).then(a.name.cmp(&b.name)));
    items
}

// Lee la cadena de versión del juego (p. ej. "++FactoryGame+rel-main-1.2.0") del cuerpo.
fn extract_game_version(body: &[u8]) -> String {
    let marker = b"++FactoryGame";
    if let Some(i) = body.windows(marker.len()).position(|w| w == marker) {
        let end = body[i..]
            .iter()
            .position(|&b| b == 0)
            .map(|e| i + e)
            .unwrap_or(body.len());
        return String::from_utf8_lossy(&body[i..end]).to_string();
    }
    "desconocida".to_string()
}

// Extrae las rutas de schematics (hitos, investigación, etc.) presentes en el cuerpo.
fn extract_schematics(body: &[u8]) -> Vec<String> {
    let marker = b"/Game/FactoryGame/Schematics/";
    let mut set: std::collections::HashSet<String> = std::collections::HashSet::new();
    let n = body.len();
    let mut i = 0usize;
    while i + marker.len() <= n {
        if &body[i..i + marker.len()] == marker {
            // Leemos hacia delante hasta encontrar "_C" (fin de la ruta de clase).
            let endmax = (i + 200).min(n);
            let mut j = i;
            let mut end = None;
            while j + 2 <= endmax {
                if &body[j..j + 2] == b"_C" {
                    end = Some(j + 2);
                    break;
                }
                if !(32..127).contains(&body[j]) {
                    break;
                }
                j += 1;
            }
            if let Some(e) = end {
                if let Ok(s) = std::str::from_utf8(&body[i..e]) {
                    set.insert(s.to_string());
                }
                i = e;
                continue;
            }
        }
        i += 1;
    }
    set.into_iter().collect()
}

// A partir de los schematics, deduce tier actual, hitos completados e investigaciones.
fn parse_progression(body: &[u8]) -> ProgressInfo {
    let schematics = extract_schematics(body);
    let mut milestones: Vec<String> = Vec::new();
    let mut research_count: u32 = 0;
    let mut current_tier: i32 = 0;

    let prog_marker = "/Progression/Schematic_";
    for s in &schematics {
        if let Some(idx) = s.find(prog_marker) {
            // p. ej. "1-1.Schematic_1-1_C" -> token "1-1"
            let rest = &s[idx + prog_marker.len()..];
            let token = rest.split('.').next().unwrap_or("");
            if let Some(dash) = token.find('-') {
                if let Ok(t) = token[..dash].parse::<i32>() {
                    current_tier = current_tier.max(t);
                    milestones.push(token.to_string());
                }
            }
        } else if s.contains("/Research/") {
            research_count += 1;
        }
    }
    milestones.sort();
    milestones.dedup();

    ProgressInfo {
        current_tier,
        milestones,
        research_count,
        schematic_total: schematics.len() as u32,
    }
}

// Lee qué receta tiene puesta cada máquina activa: nos anclamos en cada propiedad
// "mCurrentRecipe" (una por máquina) y tomamos la ruta de receta más cercana.
fn parse_production(body: &[u8]) -> Vec<RecipeCount> {
    let prop = b"mCurrentRecipe";
    let rmarker = b"/Game/FactoryGame/Recipes/";
    let n = body.len();
    let mut counts: HashMap<String, u32> = HashMap::new();
    let mut i = 0usize;

    while i + prop.len() <= n {
        if &body[i..i + prop.len()] == prop {
            let wend = (i + 400).min(n);
            let mut j = i;
            let mut leaf: Option<String> = None;
            while j + rmarker.len() <= wend {
                if &body[j..j + rmarker.len()] == rmarker {
                    let emax = (j + 200).min(n);
                    let mut k = j;
                    let mut end = None;
                    while k + 2 <= emax {
                        if &body[k..k + 2] == b"_C" {
                            end = Some(k + 2);
                            break;
                        }
                        if !(32..127).contains(&body[k]) {
                            break;
                        }
                        k += 1;
                    }
                    if let Some(e) = end {
                        if let Ok(s) = std::str::from_utf8(&body[j..e]) {
                            // ".../Smelter/Recipe_IngotIron.Recipe_IngotIron_C" -> "Recipe_IngotIron"
                            let last = s.rsplit('/').next().unwrap_or(s);
                            let name = last.split('.').next().unwrap_or(last);
                            leaf = Some(name.to_string());
                        }
                    }
                    break;
                }
                j += 1;
            }
            if let Some(l) = leaf {
                *counts.entry(l).or_insert(0) += 1;
            }
            i += prop.len();
            continue;
        }
        i += 1;
    }

    let mut v: Vec<RecipeCount> = counts
        .into_iter()
        .map(|(recipe, count)| RecipeCount { recipe, count })
        .collect();
    v.sort_by(|a, b| b.count.cmp(&a.count).then(a.recipe.cmp(&b.recipe)));
    v
}

// Comando: descomprime el cuerpo del .sav, cuenta las construcciones y devuelve el resumen.
// Solo lee el archivo; nunca lo modifica.
#[tauri::command]
fn inspect_body(folder: String, name: String) -> Result<BodyInfo, String> {
    let path = Path::new(&folder).join(&name);
    let (body, chunk_count) = decompress_body(&path)?;

    let inventory = count_buildings(&body);
    let total_buildings = inventory.iter().map(|it| it.count).sum();
    let type_count = inventory.len() as u32;

    Ok(BodyInfo {
        game_version: extract_game_version(&body),
        uncompressed_bytes: body.len() as u64,
        chunk_count,
        total_buildings,
        type_count,
        inventory,
        progression: parse_progression(&body),
        production: parse_production(&body),
    })
}

// ---- Bitácora: notas guardadas en disco ----
// Las notas se guardan en un notes.json en la carpeta de datos de la app,
// indexadas por nombre de mundo (sesión). Esto SÍ escribe en disco, pero
// en NUESTRO archivo, nunca en los .sav del juego.

fn notes_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("notes.json"))
}

// Comando: devuelve todas las notas como mapa { mundo: texto }.
#[tauri::command]
fn get_notes(app: AppHandle) -> Result<HashMap<String, String>, String> {
    // Una sola puerta de entrada: antes este comando leía el archivo por su
    // cuenta con su propio unwrap_or_default, así que blindar load_notes no
    // habría servido de nada.
    load_notes(&app)
}

// Comando: guarda (o borra, si el texto está vacío) la nota de un mundo.
#[tauri::command]
fn set_note(app: AppHandle, key: String, text: String) -> Result<(), String> {
    let mut map = load_notes(&app)?;
    if text.trim().is_empty() {
        map.remove(&key);
    } else {
        map.insert(key, text);
    }
    save_notes(&app, &map)
}

// ---- Histórico: una "foto" del inventario por cada guardado ----

// Una pieza y su ritmo por minuto.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct ItemRate {
    item: String,
    rate: f64,
}

// Una pieza y cuántas unidades hay.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct ItemCount {
    item: String,
    count: f64,
}

// Métricas ricas de una foto: todo lo que el parser completo sabe sacar del
// save. Van aparte y son opcionales por dos motivos: el histórico antiguo no
// las tiene, y si el parser falla seguimos guardando la foto básica.
//
// IMPORTANTE: esto es historia que no se puede reconstruir. Si un día quieres
// medir algo nuevo, añádelo aquí cuanto antes: solo se puede contar desde el
// día en que se empieza a guardar.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct SnapshotMetrics {
    schema: u32, // versión del formato de métricas (1 = primera)
    tier: Option<i32>,
    milestones: Option<u32>,
    research_count: Option<u32>,
    machines_with_recipe: Option<u32>,
    overclocked: Option<u32>,
    power_consumption_mw: Option<f64>,
    power_generation_mw: Option<f64>,
    production: Option<Vec<ItemRate>>,   // pieza → unidades/min producidas
    consumption: Option<Vec<ItemRate>>,  // pieza → unidades/min consumidas
    deficits: Option<Vec<ItemRate>>,     // pieza → déficit/min (cuellos de botella)
    stored: Option<Vec<ItemCount>>,      // almacenes, máquinas, depósito, jugador
    collectables: Option<Vec<ItemCount>>, // lo que sigue sin recoger en el mundo
    modded: Option<bool>,                // la partida llevaba mods
    mod_count: Option<u32>,
    save_version: Option<i32>,
    build_version: Option<i32>,
    recipe_coverage: Option<f64>,        // 0..1 de maquinas cuya receta entendemos
    levels: Option<u32>,                 // plantas detectadas
    extent_m: Option<f64>,               // diagonal de la fábrica en metros
    game_version: Option<String>,
    save_name: Option<String>,
    // Dónde estaba el pionero al guardar. Tres números por lectura: con el
    // tiempo dibujan por dónde anda uno. No es un podómetro y no pretende
    // serlo — ver docs/IDEAS.md.
    player_x: Option<f64>,
    player_y: Option<f64>,
    // Los montajes de esta lectura: centro y cuántas máquinas. Sin nombre ni
    // índice a propósito — los índices se recalculan en cada lectura y los
    // nombres dependen del idioma, así que dos lecturas se emparejan por
    // posición y por nada más.
    zones: Option<Vec<ZoneSnap>>,
    // Especies que estaban cargadas al guardar. Solo los nombres de clase: el
    // bestiario se arma uniendo lo de todas las lecturas, así que una especie
    // que uno vio una vez no se pierde aunque hoy no ande cerca.
    fauna: Option<Vec<String>>,
    // Familias de las que se vieron restos. Se guarda en cuanto se ven,
    // porque los restos se gastan al fabricar proteína alienígena y entonces
    // ya no dicen de quién eran.
    hunted: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
struct ZoneSnap {
    x: f64,
    y: f64,
    n: u32,
}

// Una foto del estado de un mundo en un momento dado.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct Snapshot {
    ts_ms: i64,          // fecha de la partida (de la cabecera)
    play_seconds: i32,   // tiempo jugado en ese momento
    total_buildings: u32,
    types: Vec<InvItem>, // conteo por tipo, para evolución detallada futura
    #[serde(skip_serializing_if = "Option::is_none")]
    metrics: Option<SnapshotMetrics>,
}

fn history_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("history.json"))
}

// ---- Lectura y escritura de los datos del usuario ----
//
// Estas dos funciones existen por un fallo real, no por precaución teórica.
//
// Antes, cargar un archivo hacía `from_slice(..).unwrap_or_default()`: si el
// JSON no parseaba por lo que fuera, se devolvía un mapa VACÍO en silencio, y
// la siguiente escritura lo guardaba encima. Y guardar era un fs::write
// directo, que deja el archivo truncado si el proceso muere a mitad.
//
// Las dos cosas juntas forman una cadena que destruye datos: una escritura
// interrumpida deja el archivo roto, la carga siguiente lo lee como vacío, y
// la escritura siguiente borra meses de histórico. Pasó de verdad: un
// histórico de 45 lecturas en tres mundos, de junio a noviembre, se quedó en
// 4. Se recuperó de la copia automática, que para eso está, pero el agujero
// había que taparlo.
//
// Ahora: escribir es atómico (archivo temporal y renombrado, que en el mismo
// volumen es una operación indivisible), y una carga que falla NO devuelve
// vacío sin más — aparta el archivo roto con fecha, para que se pueda
// recuperar a mano o comparar, y lo deja dicho en el log.
fn read_json_or_preserve<T: serde::de::DeserializeOwned + Default>(
    path: &Path,
    what: &str,
) -> T {
    if !path.exists() {
        return T::default();
    }
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) => {
            eprintln!("[{what}] no se pudo leer: {e}");
            return T::default();
        }
    };
    match serde_json::from_slice::<T>(&bytes) {
        Ok(v) => v,
        Err(e) => {
            // Nunca se pierde: se aparta con nombre propio antes de seguir.
            let stamp = now_ms();
            let side = path.with_extension(format!("roto-{stamp}.json"));
            let _ = std::fs::rename(path, &side);
            eprintln!(
                "[{what}] el archivo no se pudo interpretar ({e}). Se ha apartado en {}. \
                 Se sigue con datos vacios; use Ajustes > Copias de seguridad para restaurar.",
                side.display()
            );
            T::default()
        }
    }
}

/// Escribe de forma atómica: primero a un temporal, luego renombrado. Si el
/// proceso muere a mitad, el archivo bueno sigue intacto.
fn write_json_atomic<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn load_history(app: &AppHandle) -> Result<HashMap<String, Vec<Snapshot>>, String> {
    let path = history_file(app)?;
    Ok(read_json_or_preserve(&path, "historico"))
}

fn save_history(app: &AppHandle, map: &HashMap<String, Vec<Snapshot>>) -> Result<(), String> {
    let path = history_file(app)?;
    write_json_atomic(&path, map)
}

// Comando: registra una foto de una partida en el histórico de su mundo.
// Deduplicado por fecha: si ya teníamos esa foto, no hace nada (ni descomprime).
#[tauri::command]
fn record_snapshot(
    app: AppHandle,
    folder: String,
    name: String,
    metrics: Option<SnapshotMetrics>,
) -> Result<u32, String> {
    let path = Path::new(&folder).join(&name);
    let header = read_header_from_path(&path)
        .ok_or("No se pudo leer la cabecera para fechar la foto.")?;
    let session = if header.session_name.is_empty() {
        name.clone()
    } else {
        header.session_name.clone()
    };

    let mut map = load_history(&app)?;
    let list = map.entry(session).or_default();

    // ¿Ya tenemos una foto con esta fecha? Entonces no repetimos... salvo que
    // la que teníamos fuese "pobre" (sin métricas) y ahora lleguen: en ese caso
    // la enriquecemos en el sitio. Así, al abrir partidas viejas, el histórico
    // que ya existía se va completando solo.
    if let Some(i) = list.iter().position(|s| s.ts_ms == header.save_date_ms) {
        if metrics.is_some() && list[i].metrics.is_none() {
            list[i].metrics = metrics;
            let n = list.len() as u32;
            save_history(&app, &map)?;
            return Ok(n);
        }
        return Ok(list.len() as u32);
    }

    // Es nueva: ahora sí descomprimimos y contamos.
    let (body, _) = decompress_body(&path)?;
    let inventory = count_buildings(&body);
    let total_buildings = inventory.iter().map(|it| it.count).sum();

    list.push(Snapshot {
        ts_ms: header.save_date_ms,
        play_seconds: header.play_duration_seconds,
        total_buildings,
        types: inventory,
        metrics,
    });
    list.sort_by(|a, b| a.ts_ms.cmp(&b.ts_ms));
    let n = list.len() as u32;
    save_history(&app, &map)?;
    Ok(n)
}

// Comando: devuelve el histórico (fotos ordenadas) de un mundo.
#[tauri::command]
fn get_history(app: AppHandle, session: String) -> Result<Vec<Snapshot>, String> {
    let map = load_history(&app)?;
    Ok(map.get(&session).cloned().unwrap_or_default())
}

// ---- Copias de seguridad ----
// Lo que guarda la app no vale todo lo mismo. El historico NO SE PUEDE
// RECONSTRUIR: el juego rota y sobrescribe los autoguardados, asi que una foto
// que no se tomo en su dia no existe en ningun sitio. Las notas las escribio
// una persona. Los planes se rehacen en un minuto. Y gamedata.json se
// regenera solo leyendo el juego, asi que no entra: ocuparia de mas sin
// aportar nada.
//
// REGLA para el futuro: cada vez que se añada algo que se guarde en disco hay
// que decidir si entra en la copia y con que prioridad, y anotarlo en
// docs/BACKUP.md. Lo que no se decide explicitamente acaba fuera por olvido,
// y de eso uno se entera el dia que lo necesita.

const BACKUP_SCHEMA: u32 = 1;
const KEEP_AUTO_BACKUPS: usize = 10;

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default)]
struct BackupFile {
    schema: u32,
    app_version: String,
    created_ms: u64,
    #[serde(default)]
    history: HashMap<String, Vec<Snapshot>>,
    #[serde(default)]
    notes: HashMap<String, String>,
    #[serde(default)]
    plans: HashMap<String, HashMap<String, u32>>,
}

#[derive(Serialize, Clone)]
struct BackupInfo {
    name: String,
    bytes: u64,
    created_ms: u64,
    worlds: u32,
    snapshots: u32,
    notes: u32,
}

#[derive(Serialize, Clone)]
struct ImportReport {
    snapshots_added: u32,
    snapshots_enriched: u32,
    notes_added: u32,
    plans_added: u32,
    skipped: u32,
}

// Lectores y escritores de notas y planes. Los comandos ya hacian esto en
// linea; la copia de seguridad necesita lo mismo desde fuera.
fn load_notes(app: &AppHandle) -> Result<HashMap<String, String>, String> {
    let path = notes_file(app)?;
    // Las notas las escribió una persona a mano: aún menos recuperables que
    // el histórico.
    Ok(read_json_or_preserve(&path, "notas"))
}

fn save_notes(app: &AppHandle, map: &HashMap<String, String>) -> Result<(), String> {
    let path = notes_file(app)?;
    write_json_atomic(&path, map)
}

fn load_plans(app: &AppHandle) -> Result<HashMap<String, HashMap<String, u32>>, String> {
    let path = plans_file(app)?;
    Ok(read_json_or_preserve(&path, "planes"))
}

fn save_plans(
    app: &AppHandle,
    map: &HashMap<String, HashMap<String, u32>>,
) -> Result<(), String> {
    let path = plans_file(app)?;
    write_json_atomic(&path, map)
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?
        .join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn collect_backup(app: &AppHandle) -> Result<BackupFile, String> {
    Ok(BackupFile {
        schema: BACKUP_SCHEMA,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        created_ms: now_ms(),
        history: load_history(app)?,
        notes: load_notes(app)?,
        plans: load_plans(app)?,
    })
}

fn write_backup(app: &AppHandle, name: &str) -> Result<String, String> {
    let data = collect_backup(app)?;
    let path = backups_dir(app)?.join(name);
    // La copia, atómica por encima de todo: una copia truncada es peor que no
    // tener copia, porque uno se cree cubierto. Hoy ha hecho falta de verdad.
    write_json_atomic(&path, &data)?;
    Ok(path.to_string_lossy().to_string())
}

// Comando: copia manual, con la fecha en el nombre.
#[tauri::command]
fn export_backup(app: AppHandle) -> Result<String, String> {
    let stamp = now_ms() / 1000;
    write_backup(&app, &format!("manual-{stamp}.json"))
}

// Copia automatica: como mucho una al dia, y se conservan las ultimas diez.
// Protege de un fallo de la app, no de que muera el disco: para eso hay que
// sacar el archivo de la maquina.
#[tauri::command]
fn auto_backup(app: AppHandle) -> Result<Option<String>, String> {
    let dir = backups_dir(&app)?;
    let day = now_ms() / 86_400_000;
    let name = format!("auto-{day}.json");
    if dir.join(&name).exists() {
        return Ok(None);
    }
    // Si no hay nada que guardar, no se crea una copia vacia.
    let data = collect_backup(&app)?;
    if data.history.is_empty() && data.notes.is_empty() && data.plans.is_empty() {
        return Ok(None);
    }
    let path = write_backup(&app, &name)?;

    // Rotacion: fuera las automaticas mas viejas.
    let mut autos: Vec<PathBuf> = std::fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("auto-"))
                .unwrap_or(false)
        })
        .collect();
    autos.sort();
    while autos.len() > KEEP_AUTO_BACKUPS {
        let old = autos.remove(0);
        let _ = std::fs::remove_file(old);
    }
    Ok(Some(path))
}

// Comando: que copias hay, con un resumen de lo que llevan dentro para poder
// elegir con conocimiento en vez de por la fecha del archivo.
#[tauri::command]
fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    let dir = backups_dir(&app)?;
    let mut out: Vec<BackupInfo> = Vec::new();
    for e in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = e.path();
        if path.extension().and_then(|x| x.to_str()) != Some("json") {
            continue;
        }
        let bytes = e.metadata().map(|m| m.len()).unwrap_or(0);
        let parsed: Option<BackupFile> = std::fs::read(&path)
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok());
        let (worlds, snapshots, notes, created) = match &parsed {
            Some(b) => (
                b.history.len() as u32,
                b.history.values().map(|v| v.len() as u32).sum(),
                b.notes.len() as u32,
                b.created_ms,
            ),
            None => (0, 0, 0, 0),
        };
        out.push(BackupInfo {
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("?")
                .to_string(),
            bytes,
            created_ms: created,
            worlds,
            snapshots,
            notes,
        });
    }
    out.sort_by(|a, b| b.created_ms.cmp(&a.created_ms));
    Ok(out)
}

// Comando: restaurar FUSIONANDO, nunca reemplazando.
//
// El historico es acumulativo por naturaleza, asi que juntar dos copias por
// mundo y fecha siempre da mas que cualquiera de las dos. Un boton que pueda
// borrar meses de un clic no deberia existir. Las notas y los planes solo
// rellenan huecos: lo que ya existe en la maquina gana, porque es lo ultimo
// que escribio su dueño.
#[tauri::command]
fn import_backup(app: AppHandle, name: String) -> Result<ImportReport, String> {
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("Nombre de copia no válido.".into());
    }
    let path = backups_dir(&app)?.join(&name);
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let backup: BackupFile = serde_json::from_slice(&bytes)
        .map_err(|e| format!("La copia no se puede leer: {e}"))?;

    let mut rep = ImportReport {
        snapshots_added: 0,
        snapshots_enriched: 0,
        notes_added: 0,
        plans_added: 0,
        skipped: 0,
    };

    let mut history = load_history(&app)?;
    for (world, snaps) in backup.history {
        let list = history.entry(world).or_default();
        for snap in snaps {
            match list.iter().position(|s| s.ts_ms == snap.ts_ms) {
                Some(i) => {
                    // Ya la teniamos. Si la de la copia trae metricas y la
                    // nuestra no, nos quedamos con la rica.
                    if list[i].metrics.is_none() && snap.metrics.is_some() {
                        list[i].metrics = snap.metrics;
                        rep.snapshots_enriched += 1;
                    } else {
                        rep.skipped += 1;
                    }
                }
                None => {
                    list.push(snap);
                    rep.snapshots_added += 1;
                }
            }
        }
        list.sort_by(|a, b| a.ts_ms.cmp(&b.ts_ms));
    }
    save_history(&app, &history)?;

    let mut notes = load_notes(&app)?;
    for (k, v) in backup.notes {
        if !notes.contains_key(&k) {
            notes.insert(k, v);
            rep.notes_added += 1;
        } else {
            rep.skipped += 1;
        }
    }
    save_notes(&app, &notes)?;

    let mut plans = load_plans(&app)?;
    for (k, v) in backup.plans {
        if !plans.contains_key(&k) {
            plans.insert(k, v);
            rep.plans_added += 1;
        } else {
            rep.skipped += 1;
        }
    }
    save_plans(&app, &plans)?;

    Ok(rep)
}

// Comando: abrir la carpeta de copias en el explorador, para poder llevarselas
// a otro sitio o traer una de fuera.
#[tauri::command]
fn open_backups_folder(app: AppHandle) -> Result<String, String> {
    let dir = backups_dir(&app)?;
    let path = dir.to_string_lossy().to_string();
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| e.to_string())?;
    Ok(path)
}

// ---- Planificador: objetivos de construcción por mundo ----
// plans.json: { mundo: { "Constructor Mk1": 30, ... } }

fn plans_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se encontró la carpeta de datos: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("plans.json"))
}

#[tauri::command]
fn get_plans(app: AppHandle) -> Result<HashMap<String, HashMap<String, u32>>, String> {
    load_plans(&app)
}

#[tauri::command]
fn set_plan(app: AppHandle, world: String, goals: HashMap<String, u32>) -> Result<(), String> {
    let mut map = load_plans(&app)?;
    if goals.is_empty() {
        map.remove(&world);
    } else {
        map.insert(world, goals);
    }
    save_plans(&app, &map)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // El actualizador. Habla con las releases de GitHub del repositorio y
        // con nada más: no hay servidor nuestro de por medio porque no tenemos
        // ninguno, así que no hay nada que pueda recoger datos de nadie.
        //
        // Solo en escritorio: en móvil no existe el plugin y el build fallaría.
        // `Manager` ya está importado arriba, de ahí que aquí no se repita.
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            // La mudanza, antes de que nada lea la carpeta de datos.
            match migrate_old_data(&app.handle().clone()) {
                Ok(Some(n)) => eprintln!("Mudanza desde {OLD_IDENTIFIER}: {n} archivo(s)."),
                Ok(None) => {}
                Err(e) => eprintln!("Mudanza no realizada: {e}"),
            }
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_saves,
            start_watching,
            inspect_body,
            get_notes,
            set_note,
            record_snapshot,
            get_history,
            get_plans,
            set_plan,
            read_save_bytes,
            read_save_head,
            detect_save_folders,
            detect_docs_folders,
            read_docs_lang,
            index_icons,
            open_wiki,
            default_icon_folder,
            open_icons_folder,
            get_game_data,
            migrated_files,
            set_game_data,
            export_backup,
            auto_backup,
            list_backups,
            import_backup,
            open_backups_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
