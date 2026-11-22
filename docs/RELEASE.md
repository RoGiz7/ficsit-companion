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
