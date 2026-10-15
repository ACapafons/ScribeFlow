# ScribeFlow

Transcriptor de clases y vídeos con Whisper en el navegador. La interfaz se publica como sitio estático en GitHub Pages; no necesita servidor ni clave de API.

## Uso

1. Abre la página publicada desde la pestaña **Settings → Pages** de este repositorio.
2. Selecciona un archivo de audio o vídeo reproducible por el navegador.
3. Pulsa **Transcribir archivo** y espera a que se descargue el modelo Whisper la primera vez.
4. Revisa y edita los segmentos. Puedes exportarlos a TXT, SRT, VTT o JSON.

Whisper base se ejecuta en tu dispositivo. El archivo de audio no se envía a OpenAI ni a un backend. El modelo y la librería se descargan desde CDN, por lo que el primer uso requiere Internet y ocupa cientos de MB en caché. El rendimiento depende del navegador, memoria y CPU. Para vídeos largos, considera usar el CLI de abajo.

La demo de clase es texto de ejemplo y no contiene un vídeo real.

## CLI local

Para procesar archivos largos con faster-whisper:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install faster-whisper
python scribeflow_cli.py --file "mi_clase.mp4" --model base --language es
```

## GitHub Pages

El workflow `.github/workflows/deploy.yml` publica el contenido de la raíz al hacer push a `main`. En GitHub, configura **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Compatibilidad

Usa un navegador actualizado con Web Audio API. MP4 y WebM suelen funcionar para vídeo; MP3 y WAV para audio. El soporte de MKV y AVI depende del navegador y del códec. No subas contenido que no tengas autorización para procesar.
