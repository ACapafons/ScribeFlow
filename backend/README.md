# Backend YouTube (pendiente de despliegue)

Construir desde esta carpeta: `docker build -t scribeflow-youtube .`.
El contenedor expone el puerto 8000. Necesita FFmpeg, salida a YouTube y Hugging Face, espacio temporal y memoria para Whisper base. Usar una sola réplica/worker para que el bloqueo de concurrencia sea efectivo. El proxy debe permitir respuestas NDJSON largas y no almacenarlas en búfer. No desplegar este contenedor en una función con tiempo de ejecución corto.

`GET /health` comprueba el servicio. `POST /youtube` recibe `{ "url": "https://www.youtube.com/watch?v=VIDEO_ID", "language": "es" }` y emite líneas JSON de tipo status, result o error. Primero busca subtítulos en el idioma seleccionado; si no existen, descarga el audio y usa Whisper base. Solo admite enlaces canónicos de YouTube, una petición simultánea y hasta 30 minutos de audio para Whisper. El texto procedente de subtítulos no necesita descargar audio. Los temporales se eliminan al terminar. No usa cookies de usuario ni accede a vídeos privados.

YouTube puede bloquear las IP de alojamiento; esta integración requiere una prueba real desde el servidor de destino antes de activarse. No configurar proxies ni servicios de pago sin aprobación. Dependencias con rangos: fijar versiones tras validar la imagen en el destino.

En la web, poner la URL HTTPS del backend en `youtube-config.js`. GitHub Pages solo aloja la interfaz. El navegador envía al backend el enlace y el idioma; la descarga de audio y el fallback Whisper ocurren en el servidor. El servicio público consume recursos: aplicar límites de peticiones en el proxy antes de producción. Vercel devolvió 403 al consultar el proyecto durante la preparación; el campo aún no está publicado.
