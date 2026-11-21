# Security Policy

## Reporting a vulnerability

If you find a security problem, please **do not open a public issue**. Instead, use GitHub's
[private vulnerability reporting](https://github.com/RoGiz7/ficsit-companion/security/advisories/new)
so it can be fixed before it is public. I will reply as soon as I can — this is a hobby project
maintained by one person, so please be patient.

## What this app does and does not do

FICSIT Companion is deliberately boring from a security point of view:

- It **reads** `.sav` files from your Satisfactory save folder. It never writes to them.
- It stores its own notes, plans and history as JSON inside your user application-data folder.
- It makes **no network requests**: no server, no account, no telemetry, no update check.
- It does not run code from your save files; they are parsed as data.

## Supported versions

Only the latest release receives fixes.

---

# Política de seguridad

## Cómo informar de una vulnerabilidad

Si encuentras un problema de seguridad, **no abras una incidencia pública**. Usa el
[informe privado de vulnerabilidades](https://github.com/RoGiz7/ficsit-companion/security/advisories/new)
de GitHub para que pueda arreglarse antes de hacerse público. Responderé en cuanto pueda: esto es un
proyecto personal mantenido por una sola persona, así que te pido paciencia.

## Qué hace y qué no hace la app

FICSIT Companion es deliberadamente aburrida en cuanto a seguridad:

- **Lee** los archivos `.sav` de tu carpeta de guardados de Satisfactory. Nunca escribe en ellos.
- Guarda sus propias notas, planes e histórico como JSON en tu carpeta de datos de usuario.
- **No hace ninguna petición de red**: sin servidor, sin cuenta, sin telemetría, sin comprobación
  de actualizaciones.
- No ejecuta código de tus partidas; se interpretan como datos.

## Versiones con soporte

Solo la última versión publicada recibe correcciones.
