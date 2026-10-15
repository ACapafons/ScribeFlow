# Transcribir vídeo o audio

Una página sencilla para pasar clases y vídeos a texto:

1. Selecciona el archivo.
2. Pulsa **Transcribir**.
3. Revisa o corrige el texto y pulsa **Descargar TXT**.

Whisper se ejecuta en el navegador. La primera vez se descarga un modelo de varios cientos de MB desde Internet; después el navegador puede conservarlo en caché. El audio se procesa en este dispositivo y no se envía a una API. El tiempo depende del equipo, y los archivos largos consumen memoria.

Formatos recomendados: MP4, WebM, MP3 y WAV. La compatibilidad de otros formatos depende del navegador.

GitHub Pages se publica automáticamente desde `main` mediante GitHub Actions.
