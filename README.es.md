<h1 align="center">FICSIT Companion</h1>

<p align="center">
  <a href="README.md">🇬🇧 English</a> ·
  🇪🇸 <strong>Español</strong>
</p>

<p align="center">
  Una aplicación de escritorio, local y de código abierto para <strong>Satisfactory</strong>: lee
  tus partidas guardadas y te dice qué has construido, cómo ha crecido y qué te falta.
</p>

<p align="center">
  <a href="https://github.com/RoGiz7/ficsit-companion/releases">⬇️ Descargas</a> ·
  <a href="https://ko-fi.com/rogiz7">☕ Invítame a un café</a> ·
  <a href="https://github.com/RoGiz7/FICSIT-Factory-Manager">🌐 Proyecto hermano (web)</a>
</p>

<p align="center">
  <img alt="Plataforma" src="https://img.shields.io/badge/plataforma-Windows-0a7bbd">
  <img alt="Idiomas" src="https://img.shields.io/badge/interfaz-English%20%7C%20Espa%C3%B1ol-ff9e3d">
  <img alt="Licencia" src="https://img.shields.io/badge/licencia-MIT-green">
  <img alt="Precio" src="https://img.shields.io/badge/precio-gratis-brightgreen">
</p>

> Hecha para la comunidad: gratuita, sin ánimo de lucro y sin intención de competir con nadie.

FICSIT Companion funciona en Windows y toda la interfaz está disponible en **español e inglés** —
se cambia de idioma desde la barra superior, sin reiniciar.

## 🎯 Qué la hace distinta

Casi todas las herramientas de Satisfactory son calculadoras: escribes lo que quieres construir y
te dan las proporciones. Útil, pero no saben nada de *tu* fábrica.

Esta parte de tu archivo de partida. Lee lo que has construido de verdad — cada máquina, su receta,
su overclock — y guarda un histórico local entre guardados, así que puede responder a la pregunta
por la que existe esta aplicación:

> *«Vuelvo después de dos semanas. ¿Qué estaba haciendo y por dónde sigo?»*

Como guarda una instantánea cada vez que guardas partida, puede enseñarte tu fábrica creciendo a lo
largo de semanas, comparar lo que planificaste con lo que construiste y señalarte la pieza que de
verdad va corta.

## ✨ Qué incluye

- ↩️ **«Retoma aquí»** — abres un mundo y te cuenta qué ha cambiado desde tu último guardado, te
  enseña tu propia nota, avisa de los cuellos de botella y señala el siguiente hito. La razón de
  ser de esta aplicación.
- 🔍 **Encuentra tus partidas sola** — detecta la carpeta de guardados del juego, agrupa las
  partidas por mundo y vigila la carpeta: guardas dentro del juego y la app se actualiza sola.
- 🏭 **Inventario de la fábrica** — todas tus máquinas, agrupadas por tipo y contadas.
- ⚙️ **Producción real** — la receta exacta que corre en cada máquina, con su overclock, convertida
  en producción por minuto y consumo estimado. Leída de la partida, no deducida de un plan.
- 🧮 **Detector de cuellos de botella** — producción menos consumo, pieza por pieza. Cuando algo va
  corto te dice cuántas máquinas harían falta para cerrar el hueco, y las marca en rojo en el plano.
- ⚡ **Balance de energía y salud de la fábrica** — consumo estimado frente a generación, con el
  margen que te queda, resumido en una puntuación de salud de 0 a 100.
- 📈 **Evolución** — una gráfica de tu fábrica en el tiempo, construida con una instantánea por
  guardado.
- 🧭 **Progreso** — el tier actual y los hitos, leídos de la partida.
- 📝 **Bitácora** — notas por mundo, para que tu yo futuro sepa en qué andaba tu yo pasado.
- 🎯 **Plan de mejoras** — fija objetivos por tipo de máquina y mira cómo se llenan las barras.
- 🧮 **Calculadora de producción** — eliges un ritmo objetivo y te da las máquinas, la cadena y las
  materias primas. Es **consciente del nivel**: solo ofrece lo que ese mundo tiene desbloqueado.
- 📦 **Materiales almacenados** — lo que hay en tus contenedores y en el Depósito Dimensional.
- 🔭 **Exploración** — coleccionables y cápsulas que siguen ahí fuera, sin recoger.
- 🗺️ **Plano 2D** — una vista cenital de tu fábrica con las máquinas por categoría, las cintas
  trazadas desde la partida y **detección automática de plantas**, para que una construcción de
  varios niveles se lea como niveles separados.
- 🔒 **Solo lectura por diseño** — la app abre tus partidas para leerlas y nunca escribe en ellas.

## 🗺️ Hoja de ruta

- **Logros y medallas** — una serie mensual construida con tu propio histórico local: hitos
  alcanzados, máquinas levantadas, cuellos de botella resueltos. La historia de tu fábrica,
  contada de vuelta.
- **Comparar dos guardados** — las diferencias entre dos instantáneas cualesquiera.
- **Biblioteca de planos** — leer la carpeta `blueprints` y mostrar lo que cuesta construir cada uno.
- **Mapa del juego de fondo**, zoom y arrastre.
- **Primera versión empaquetada** — instalador y actualizaciones automáticas.

## ⬇️ Instalación

Todavía no hay instalador publicado: la primera versión está en preparación. Por ahora puedes
compilarla tú:

```bash
git clone https://github.com/RoGiz7/ficsit-companion.git
cd ficsit-companion
npm install
npm run tauri dev      # ejecutarla
npm run tauri build    # generar un instalador
```

Necesitas [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) y las herramientas de
compilación de C++ de Visual Studio. Ver los
[requisitos de Tauri](https://v2.tauri.app/start/prerequisites/).

Cuando haya versiones publicadas, Windows mostrará un aviso de **SmartScreen** («Windows protegió
su PC») porque la app aún no está firmada con un certificado. Pulsa **Más información → Ejecutar de
todas formas**. Es lo normal en aplicaciones independientes.

## 🔒 Privacidad

Todo es local. La app no tiene servidor, ni cuenta, ni telemetría: lee los archivos `.sav` que ya
están en tu disco y guarda sus notas, planes e histórico en tu propia carpeta de usuario. No se
sube nada a ningún sitio y tus partidas no se modifican nunca.

## 🖼️ Iconos de las piezas

La app puede mostrar los iconos del propio juego junto a cada pieza. **Nunca los distribuye.** El
arte es de Coffee Stain, así que no hay ni una sola imagen suya en este repositorio ni en el
instalador: los extraes de tu propia copia del juego, los dejas en una carpeta y la app los lee de
tu disco. Si dejas la carpeta vacía todo sigue funcionando — los iconos adornan, no sostienen nada.

Las herramientas de la comunidad los muestran habitualmente, y la wiki oficial publica un tutorial
para extraerlos advirtiendo en él de que el contenido exportado está sujeto a copyright y es de
Coffee Stain Studios. Esa práctica se apoya en la tolerancia, no en una licencia, y este proyecto
lo dice en vez de disimularlo. **Si Coffee Stain pide que no usemos sus iconos, la función se
retira.**

Cómo configurarlo y el razonamiento completo: [docs/ICONS.md](docs/ICONS.md) (en inglés).

## 🙏 Créditos

- **Coffee Stain Studios** por Satisfactory, por los datos del juego que publican en
  `CommunityResources` y por los iconos de las piezas que la app puede mostrar desde tu propia
  instalación. Ese arte es suyo; ver [docs/ICONS.md](docs/ICONS.md).
- [@etothepii/satisfactory-file-parser](https://github.com/etothepii4/satisfactory-file-parser) por
  la lectura del formato de guardado.
- Hecha con [Tauri](https://tauri.app/), Rust y TypeScript.
- Diseñada y escrita codo con codo con **Claude** (Anthropic). Este proyecto está hecho con ayuda
  de IA y se dice abiertamente: las ideas, las decisiones y las pruebas son mías, la programación
  es a cuatro manos, y los commits lo reflejan.

## ⚠️ Aviso

Satisfactory, FICSIT y sus logotipos son marcas de **Coffee Stain Studios**. Este es un proyecto de
fan no oficial, **sin afiliación ni respaldo de Coffee Stain Studios**.

## ☕ Donaciones

La app es gratis y lo seguirá siendo. Si te ahorra tiempo y te apetece invitarme a un café, tienes
la [página de Ko-fi](https://ko-fi.com/rogiz7) — pero todas las funciones son las mismas, dones o no.

## 📄 Licencia

[MIT](LICENSE) — úsala, cámbiala, compártela.
