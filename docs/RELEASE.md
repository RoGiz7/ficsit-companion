# Publicar una versión

Ahora mismo nadie puede instalar la app. Esto lo arregla. Todo lo que no
depende de la clave está hecho: el flujo de GitHub, el plugin, la barra de
aviso y la configuración. Falta un paso tuyo, y es el único que no puedo hacer
yo.

## Por qué no puedo hacerlo yo

El actualizador firma cada instalador con una clave privada, y la app verifica
esa firma con la pública antes de instalar nada. Sin esa verificación,
cualquiera capaz de ponerse entre tu equipo y GitHub podría servir otro
ejecutable y la app lo instalaría tan contenta.

Esa clave privada **no la debo ver ni yo ni nadie**. No va a un archivo del
repositorio, no se pega en un chat y no se escribe en un commit. Vive en tu
máquina y en el cuadro de secretos de GitHub, que los enmascara en los
registros. Si alguna vez se filtra, se genera otra y se vuelve a publicar.

## Los pasos, una sola vez

### 1. Generar la pareja de claves

En el escritorio, dentro de la carpeta del proyecto:

```
npm run tauri signer generate -- -w %USERPROFILE%\.tauri\ficsit-companion.key
```

Te pide una contraseña. Ponle una y **guárdala donde guardes las demás**, que
hace falta en el paso 3 y no se puede recuperar.

Escupe dos cosas: la ruta del archivo `.key` (la privada) y una cadena larga
en pantalla, que es la **pública**.

### 2. Pegar la clave pública

En `src-tauri/tauri.conf.json`, cambia el texto `PEGAR_AQUI_LA_CLAVE_PUBLICA`
por esa cadena larga. Esta sí va al repositorio: para eso es pública.

### 3. Poner los dos secretos en GitHub

En `Settings` → `Secrets and variables` → `Actions` → `New repository secret`:

| Nombre | Qué va dentro |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | el **contenido** del archivo `.key`, no la ruta |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | la contraseña del paso 1 |

Para ver el contenido del archivo: `type %USERPROFILE%\.tauri\ficsit-companion.key`

### 3.5. Comprobar antes de etiquetar

```
npm run check-release
```

No compila ni arranca nada: lee los archivos y dice lo que no cuadra. Comprueba
que las tres versiones coinciden (`package.json`, `tauri.conf.json` y
`Cargo.toml` — desincronizadas, el instalador diría una cosa y la app otra),
que la clave pública ya no es el marcador, que el endpoint apunta a este mismo
repositorio, que las dos mitades del plugin llevan el mismo número y que el
flujo firma y genera el `latest.json`.

Hasta que no pegues la clave pública dará un fallo, y es el correcto.

### 4. Publicar

Sube el número de versión en `src-tauri/tauri.conf.json` y en `package.json`
(los dos tienen que coincidir), y luego:

```
git tag v0.1.0
git push origin v0.1.0
```

El flujo compila en Windows y deja un **borrador** de release con el
instalador. Lo revisas en la pestaña Releases y le das a publicar cuando te
parezca. Es borrador a propósito: una etiqueta empujada por error no publica
nada.

## A partir de ahí

Cada vez que arranque, la app mira si hay versión nueva. Si la hay, sale una
barra arriba con el número y dos botones. Si no la hay, no sale nada — una
barra que está siempre diciendo "todo bien" es una barra que se aprende a
ignorar.

Para la siguiente versión solo repites el paso 4. Las claves ya están puestas.

## Un detalle de la configuración, por si se vuelve a tocar

Hay dos `installMode` distintos en Tauri y no significan lo mismo:

- `bundle.windows.nsis.installMode` decide **para quién** se instala la app:
  `currentUser`, `perMachine` o `both`. Nada que ver con el actualizador.
- `plugins.updater.windows.installMode` decide **cómo** se relanza el
  instalador al actualizar: `passive`, `basicUi` o `quiet`. Este es el nuestro,
  y está en `passive`.

Poner el segundo valor en el primer sitio rompe el arranque, porque `passive`
no está entre los valores que admite. Es el error que dio la primera versión de
esto.

El archivo se puede validar sin arrancar nada:

```
python -c "import json,jsonschema;jsonschema.Draft7Validator(json.load(open('node_modules/@tauri-apps/cli/config.schema.json'))).validate(json.load(open('src-tauri/tauri.conf.json')))"
```

## Las dos mitades del actualizador tienen que ir a la par

El actualizador son dos piezas con el mismo número de versión: el paquete de npm
`@tauri-apps/plugin-updater` y el crate de Rust `tauri-plugin-updater`. Si se
separan, Tauri avisa de un desajuste en cada arranque.

Y se separan solas, porque npm coge siempre la última y Cargo no puede si algo
se lo impide. Eso es justo lo que pasó: el crate 2.14 exige `tauri ^2.12`, el
proyecto iba con `tauri` 2.11.2, Cargo se quedaba en el 2.12.0 del plugin y npm
instalaba el 2.14.1 tan tranquilo.

Se podía arreglar de dos maneras y se eligió la de subir, no la de bajar. El
actualizador es la pieza que va a instalar software en el ordenador de otra
gente, y ese es el peor sitio donde ir atrasado. Así que `tauri` pasó a `2.12`
como mínimo, `tauri-build` a `2.7` (que es lo que pide el plugin por dentro) y
el paquete de npm quedó **clavado sin `^`** a `2.14.1`.

Clavado a propósito: sin el `^`, un `npm update` no puede adelantar la mitad de
JavaScript y dejar atrás la de Rust. Cuando haya que subir, se suben las dos a
la vez y se vuelve a clavar.

Para comprobar que siguen a la par:

```
npm ls @tauri-apps/plugin-updater
findstr /C:"tauri-plugin-updater" src-tauri\Cargo.lock
```

### Una trampa del TOML que ya nos mordió

En un `Cargo.toml`, una cabecera de tabla se lleva **todo lo que viene detrás**
hasta la siguiente cabecera. El bloque de dependencias solo-de-escritorio se
escribió una vez en medio del archivo y se tragó `serde`, `serde_json`, `notify`
y `flate2`, que pasaron a ser dependencias de escritorio sin que nadie lo
notara, porque en Windows la condición se cumple y compila exactamente igual.

Ese bloque va el último del archivo, y hay un comentario encima diciéndolo.

### Y por qué ya no está `@tauri-apps/plugin-process`

Se usó para relanzar la app tras instalar. En Windows el instalador NSIS la
cierra, instala y la vuelve a abrir él solo, así que era una segunda pareja de
versiones que mantener sincronizada a cambio de nada. Peor: estaba en
JavaScript y no tenía contraparte en Rust, así que el relanzado habría fallado
en el único momento en que importa.

## Lo que puede salir mal

**`tauri build` en local falla pidiendo una clave.** Es esperado:
`createUpdaterArtifacts` está activado y el empaquetado quiere firmar. En
local no hace falta empaquetar — `npm run tauri dev` no firma nada. Si algún
día quieres empaquetar en tu máquina, exporta las dos variables de entorno con
los mismos valores que los secretos.

**La barra de versión nueva no aparece nunca.** Hasta que no haya una release
publicada con un `latest.json`, no hay nada contra lo que comparar. La
comprobación falla en silencio a propósito: un visor de estadísticas que suelta
un error de red al abrirse es peor que uno que no se entera.

**Cambias de clave.** Hay que volver a publicar firmando con la nueva, y las
versiones instaladas con la vieja no se actualizarán solas: sus usuarios tienen
que reinstalar a mano. Por eso conviene no perderla.
