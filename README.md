# ScribeFlow

Transcribe vídeos y audios en el navegador con Whisper y descarga el resultado como texto.

**[Abrir ScribeFlow](https://acapafons.github.io/ScribeFlow/)**

## Uso

1. Selecciona un archivo de vídeo o audio.
2. Elige el idioma de la grabación y pulsa **Transcribir**.
3. Espera a que termine el proceso. El estado indica la descarga del modelo, la preparación del audio y la transcripción.
4. Revisa o corrige el texto y pulsa **Descargar TXT**.

El TXT contiene el texto que aparece en el editor, incluidas tus correcciones, en UTF-8. Conserva el nombre del archivo original con la extensión `.txt`. Al seleccionar otro archivo se borra el resultado anterior.

## Funcionamiento

La página usa **Transformers.js 3.7.2** y el modelo multilingüe **Xenova/whisper-base**. Web Audio API decodifica el archivo completo en memoria; el código toma el primer canal y lo remuestrea a 16 kHz. Whisper recibe un `Float32Array` y procesa el audio con ventanas de 30 segundos y solapamiento de 5 segundos.

La primera carga requiere Internet para descargar la librería y el modelo. El navegador puede conservar los recursos en caché, pero no se garantiza el funcionamiento sin conexión. El modelo se reutiliza mientras la página permanece abierta.

El archivo y la transcripción se procesan en el dispositivo: el código no los envía a un servidor de transcripción. La página realiza peticiones externas para cargar recursos desde jsDelivr, Hugging Face y Google Fonts. No requiere cuenta ni clave de API.

## Compatibilidad y límites

- Idiomas disponibles en la interfaz: español, inglés, francés, alemán, italiano y portugués.
- Límite implementado: **500 MiB** por archivo (524 288 000 bytes; el mensaje de la interfaz lo denomina 500 MB).
- MP4, WebM, MP3 y WAV son formatos de partida; la decodificación depende del contenedor, del códec y del navegador. Elegir un archivo no garantiza que pueda decodificarse.
- Los archivos completos se cargan en memoria. Una grabación larga puede consumir mucha RAM y la transcripción puede tardar varios minutos.
- El avance de preparación corresponde al remuestreo; no representa el porcentaje total de transcripción. No hay cancelación ni tiempo máximo implementados.
- La salida es texto editable sin marcas de tiempo ni identificación de hablantes. Conviene revisar nombres propios, términos técnicos y posibles errores de reconocimiento.

## Archivos del proyecto

| Archivo | Función |
| --- | --- |
| `index.html` | Interfaz y metadatos de la página. |
| `styles.css` | Estilos de la interfaz. |
| `transcription-v3.js` | Script activo cargado por la página: lectura, Whisper, edición y descarga TXT. |
| `app.js` | Versión anterior conservada; la página actual no la carga. |
| `.github/workflows/deploy.yml` | Publicación en GitHub Pages desde `main`. |
| `scribeflow_cli.py`, `transcribe_local.py` | Scripts Python heredados e independientes de la web. Sus servidores de ejemplo no implementan transcripción HTTP y no son necesarios para usar la página. |

## Publicación y diagnóstico

Los cambios en `main` activan GitHub Pages. Un despliegue correcto confirma la publicación del sitio, no la precisión de la transcripción.

La página muestra **Versión de transcripción: 3**. Si aparece un error, conserva su mensaje completo para identificar el punto del fallo. Si ves una versión anterior, recarga la página. La confirmación de uso en un navegador no garantiza compatibilidad con todos los archivos o dispositivos.
