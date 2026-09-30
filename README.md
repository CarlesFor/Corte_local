# Corte Local

Editor de vídeo de escritorio para Windows, en español y sin cuentas ni suscripciones. Los originales, la edición, el reconocimiento de voz y la exportación permanecen en tu ordenador.

**[DESCARGAR PARA WINDOWS — abrir directamente](https://github.com/CarlesFor/Corte_local/releases/latest/download/Corte-Local-Windows.exe)**

[Instalador con acceso directo](https://github.com/CarlesFor/Corte_local/releases/latest/download/Corte-Local-Instalador-Windows.exe) · [Versión ZIP](https://github.com/CarlesFor/Corte_local/releases/latest/download/Corte-Local-Windows.zip) · [Todas las versiones](https://github.com/CarlesFor/Corte_local/releases)

Para Windows de 64 bits. No necesitas instalar Node, Python, FFmpeg ni usar una terminal.

## Abrir la aplicación

1. Descarga **Corte-Local-Windows.exe** desde el enlace de arriba.
2. Haz doble clic. La primera apertura puede tardar unos segundos mientras se prepara la aplicación.
3. Importa tu vídeo y empieza a editar. No hay registro ni inicio de sesión.

Si prefieres tener un acceso directo, descarga **Corte-Local-Instalador-Windows.exe** e instálalo. Si descargas el ZIP, **extrae toda la carpeta** y abre **Corte Local.exe**: conserva las carpetas que lo acompañan. No uses «Code → Download ZIP» para instalar la aplicación; esa descarga contiene el código fuente.

Dentro de la carpeta de desarrollo también puedes usar `Abrir Corte Local.cmd`.

## Primeros pasos

1. Pulsa **Importar archivos** o arrastra archivos desde Windows. El primer archivo se añade a la línea de tiempo.
2. Arrastra más archivos desde la biblioteca a una pista o haz doble clic para añadirlos al final.
3. Selecciona un clip para ajustar imagen, velocidad y audio. Arrastra los extremos para recortar; pulsa **B** para cortar en el cursor.
4. En **Subtítulos**, genera la transcripción, corrige el texto y elige un estilo. El panel derecho permite personalizar fuentes, bordes, sombras y fondos.
5. Guarda el proyecto con **Ctrl + S** y pulsa **Exportar** para generar un MP4.

Cada vídeo con audio muestra automáticamente su forma de onda debajo de la miniatura en la línea de tiempo. Los tramos planos permiten localizar los silencios. Amplía el zoom, selecciona el clip, coloca el cursor al principio del silencio y pulsa **B**. Selecciona el clip de la derecha y repite el corte al final del silencio. Selecciona ese tramo y usa **Mayús + Supr** para eliminarlo y cerrar el hueco. La onda sigue el audio original al recortar, dividir o cambiar la velocidad. Los vídeos sin audio no muestran onda.

Para poner fotos o vídeos encima de tu grabación mientras hablas:

1. Coloca el cursor donde quieres que aparezca la imagen o el vídeo y pulsa **Superponer**, encima de las pistas. Elige el archivo: se creará una pista nueva encima de las demás. También puedes usar **Superponer** en una tarjeta de la biblioteca, o arrastrarla a la zona «Arrastra un vídeo o imagen aquí para crear una capa encima».
2. Ajusta su duración arrastrando los extremos. Para ver ambos vídeos a la vez, usa **Colocar en una esquina** en Propiedades; también puedes cambiar la escala y arrastrar la imagen sobre el visor. **Pantalla completa** centra la capa y restablece su tamaño.
3. Repite para añadir tantas capas como necesites. Las pistas superiores se muestran encima de las inferiores. Las flechas de cada pista cambian el orden; el selector **Pista** del clip permite moverlo a otra pista compatible. El botón **+** junto a Superponer crea una pista vacía.

La grabación y su audio continúan al añadir capas. Cada pista y cada clip conservan sus controles de silencio y volumen. Los PNG transparentes dejan ver las capas inferiores. También puedes arrastrar archivos desde Windows directamente a una pista: se colocan en el momento donde los sueltas. Añadir un archivo normalmente desde la biblioteca continúa la pista de vídeo principal.

## Preparar los subtítulos automáticos

El motor Whisper ya viene incluido en las descargas de Windows. La primera vez que quieras generar subtítulos, abre **Ajustes**, busca **small / Equilibrado** y pulsa **Descargar**. Espera a que termine y vuelve a **Subtítulos → Generar**. Después funciona sin conexión. El modelo se conserva entre aperturas; no tienes que descargarlo cada vez. No se sube ningún vídeo ni audio.

| Modelo | Descarga aproximada | Uso |
| --- | --- | --- |
| base | 142 MB | Equipos con pocos recursos |
| small | 466 MB | Opción equilibrada recomendada |
| medium | 1,5 GB | Mayor capacidad; requiere más tiempo y memoria |

Las descargas verifican SHA256. Whisper utiliza CPU y no exige GPU. La precisión depende de la voz, el ruido y el modelo; revisa los subtítulos antes de exportar. La selección de pistas permite excluir la música. Puedes regenerar un intervalo: la aplicación pide confirmar la sustitución de las correcciones existentes.

## Funciones

- Vídeo, imágenes, música y textos en varias pistas, con bloqueos, silenciamiento y orden de capas.
- Superposición desde archivos o biblioteca, creación de capas por arrastre, colocación rápida en una esquina y cambio de pista desde Propiedades.
- Recorte, división, duplicación, borrado con o sin cierre de hueco, ajuste magnético y deshacer/rehacer.
- Forma de onda detallada en clips de vídeo y audio para localizar silencios, sincronizada con los recortes y la velocidad.
- Posición, escala, rotación, ajuste/relleno, opacidad, brillo, contraste y saturación.
- Velocidad de 0,25× a 4×; audio separado y vinculado; volumen y fundidos.
- Fundido al fondo y disolución con el clip anterior mediante solapamiento.
- Lienzos 16:9, 9:16, 1:1 y 4:5; 24, 25, 30 o 60 fps.
- Textos y subtítulos con fuentes de Windows, Inter incluido y carga de TTF/OTF.
- Seis estilos de subtítulos, estilos guardados y ajustes por subtítulo o globales.
- Subtítulos por frases en español; corrección de texto y tiempos, división, unión e importación SRT.
- Exportación MP4/H.264/AAC hasta 1080p, completa o por intervalo; subtítulos incrustados o SRT separado; exportación ASS con estilos.
- Copias ligeras, miniaturas, forma de onda y vista renderizada de hasta diez segundos para comprobar el resultado exacto de FFmpeg.
- Proyectos `.corte`, autoguardado de recuperación, recientes, localización de medios ausentes y recopilación de medios y fuentes.

La resolución del preset corresponde al lado corto: 1080p vertical produce 1080 × 1920. La vista ligera usa Chromium y puede mostrar diferencias de color respecto a FFmpeg; **Vista renderizada** utiliza el motor de exportación. Los subtítulos usan libass tanto en el visor como en la exportación.

## Archivos y privacidad

Los proyectos contienen instrucciones de edición y referencias a los originales; no alteran los medios. **Archivo → Recopilar proyecto** crea una carpeta nueva con una copia del proyecto, sus medios y las fuentes utilizadas. Guarda esa carpeta completa para transportarlo.

Los modelos, las fuentes importadas, los recientes y la recuperación se guardan en los datos locales de la aplicación. En desarrollo se utiliza `.local-data` dentro del proyecto; la aplicación instalada utiliza la carpeta de datos de Windows. No hay analítica, cuentas ni actualización automática por red. Las conexiones de la aplicación se limitan a las descargas solicitadas de modelos y motores.

El autoguardado se realiza después de una pausa de aproximadamente un segundo al editar. El proyecto conserva una marca de revisión cuando los cambios de edición pueden afectar a los subtítulos. Guarda explícitamente las versiones que quieras conservar.

## Desarrollo

Tecnología: Electron, React, TypeScript, Vite, FFmpeg/FFprobe, whisper.cpp y libass mediante WebAssembly. Electron sustituye a Tauri para utilizar el entorno Node disponible; no cambia el funcionamiento local del editor.

Recomendado: Node 22.12 o posterior. El proyecto incluye Node 22 como dependencia de desarrollo para ejecutar sus scripts sin modificar la instalación global.

Para compilar las descargas de Windows se necesitan los redistribuibles C++ de Visual Studio; la preparación los incorpora junto a Whisper para que el usuario final no tenga que instalarlos. Puedes indicar su carpeta con `CORTE_VC_REDIST_DIR`. Los runners de Windows de GitHub incluyen estos componentes. Esto solo afecta a quien compila, no a quien descarga el editor.

```powershell
npm install
npm run setup:electron
npm run prepare:engines
npm run dev
```

Para compilar y abrir la versión de producción:

```powershell
npm run build
npm start
```

Para preparar la distribución de Windows:

```powershell
npm run package  # aplicación en release/win-unpacked
npm run dist     # EXE portátil, instalador y ZIP en release
```

FFmpeg, FFprobe, Whisper y las fuentes se incluyen en las tres descargas. La preparación descarga Whisper desde su versión oficial y verifica SHA256 si aún no está preparado. Los modelos se descargan desde Ajustes y permanecen instalados entre sesiones. Los ejecutables no llevan firma digital.

GitHub Actions compila y prueba los cambios en Windows. Para publicar una nueva versión, actualiza `version` en `package.json` y `package-lock.json`, revisa `docs/release-notes.md` y ejecuta **Actions → Publicar una versión de Windows → Run workflow** desde `main`. El flujo publica los tres formatos y sus huellas SHA256 después de las pruebas.

## Verificación

```powershell
npm test          # operaciones y exportación con FFmpeg real
npm run test:ui   # integración de escritorio, requiere las muestras de npm test
npm run test:packaged # el mismo recorrido con el ejecutable distribuible
npm run test:portable # apertura e importación desde el EXE portátil con un perfil nuevo
npm run test:long # importación, copia ligera y exportación de un intervalo de un vídeo real de 30 minutos
```

`npm run test:speech` verifica transcripción real con el modelo small y red bloqueada durante el reconocimiento. Requiere `.test-output/speech/español.wav`; al faltar el motor o modelo, realiza primero su descarga verificada. Los resultados y capturas de las pruebas se guardan en `.test-output`.

Pruebas de escritorio: importación por diálogo nativo, reproducción, texto, SRT, estilo, guardado real, previsualización renderizada, exportación y configuración. Incluyen arrastrar un vídeo con sonido y silencios a la pista, comprobar su onda, recortarlo, cambiar la velocidad, cortar y eliminar un silencio y recuperar la onda al reabrir el proyecto. Las pruebas sustituyen únicamente los diálogos de selección para elegir archivos de ensayo, y ejecutan los motores reales.

## Alcance de esta versión

Edición básica y subtítulos por frases, orientada a proyectos hasta unos 30 minutos. No incluye karaoke, animaciones por palabras, fotogramas clave, chroma, eliminación de fondos con IA, colaboración, plantillas de CapCut ni exportación 4K. No importa proyectos de CapCut. El rendimiento depende del equipo y de la cantidad de capas; la CPU siempre está disponible como base.

Los avisos y licencias de las fuentes y motores se incluyen en los recursos. FFmpeg utiliza una distribución GPL; su fuente y configuración están enlazadas en `resources/NOTICE.txt`. Inter utiliza SIL OFL y whisper.cpp utiliza MIT.
