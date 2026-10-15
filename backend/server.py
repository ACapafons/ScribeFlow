"""YouTube backend. Deploy as a single-process container, never on GitHub Pages."""
import json
import re
import tempfile
import threading
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["https://acapafons.github.io"],
                   allow_methods=["POST", "GET"], allow_headers=["Content-Type"])
busy = threading.Lock()
LANGUAGES = {"es", "en", "fr", "de", "it", "pt"}
MAX_SECONDS = 1800
MAX_BYTES = 100 * 1024 * 1024


def video_id(value):
    u = urlsplit(value.strip())
    if u.scheme not in ("https", "http") or u.username or u.password or u.port:
        raise ValueError("Introduce un enlace válido de YouTube.")
    host = (u.hostname or "").lower()
    if host == "youtu.be":
        candidate = u.path.strip("/")
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}:
        parts = u.path.strip("/").split("/")
        candidate = parse_qs(u.query).get("v", [""])[0] if u.path == "/watch" else (
            parts[1] if len(parts) == 2 and parts[0] in {"shorts", "embed", "live"} else "")
    else:
        raise ValueError("Solo se admiten enlaces de YouTube.")
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate):
        raise ValueError("El enlace no identifica un vídeo de YouTube.")
    return candidate


class Input(BaseModel):
    url: str = Field(max_length=2048)
    language: str = "es"


def event(kind, **values):
    return json.dumps({"type": kind, **values}, ensure_ascii=False) + "\n"


@lru_cache(maxsize=1)
def model():
    from faster_whisper import WhisperModel
    return WhisperModel("base", device="cpu", compute_type="int8")


def process(identifier, language):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
        yield event("status", message="Buscando subtítulos en YouTube…")
        try:
            transcript = YouTubeTranscriptApi().fetch(identifier, languages=[language])
            text = " ".join(s.text for s in transcript).strip()
            if text:
                yield event("result", text=text, filename=identifier + ".txt", source="captions")
                return
        except (NoTranscriptFound, TranscriptsDisabled):
            pass
        # Network/IP restrictions are terminal: downloading audio is unlikely to bypass them.
        import yt_dlp
        yield event("status", message="Sin subtítulos en el idioma elegido. Preparando audio…")
        with tempfile.TemporaryDirectory(prefix="scribeflow-") as folder:
            url = "https://www.youtube.com/watch?v=" + identifier
            def check(info, *, incomplete=False):
                if not incomplete and (info.get("is_live") or
                    not info.get("duration") or info["duration"] > MAX_SECONDS):
                    return "Solo se admiten grabaciones de hasta 30 minutos."
                return None
            def download_limit(data):
                if data.get("downloaded_bytes", 0) > MAX_BYTES:
                    raise ValueError("El audio supera 100 MiB.")
            options = {
                "noplaylist": True, "quiet": True, "no_warnings": True,
                "format": "bestaudio[filesize<100M]/bestaudio",
                "max_filesize": MAX_BYTES, "socket_timeout": 20,
                "retries": 1, "fragment_retries": 1,
                "match_filter": check, "progress_hooks": [download_limit],
                "outtmpl": str(Path(folder) / "audio.%(ext)s"),
                "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
            }
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(url, download=True)
            audio = Path(folder) / "audio.wav"
            if not info or not audio.is_file():
                raise ValueError("No se pudo obtener el audio. Comprueba la duración y el acceso al vídeo.")
            yield event("status", message="Transcribiendo el audio con Whisper…")
            segments, _ = model().transcribe(str(audio), language=language, vad_filter=True)
            text = []
            for segment in segments:
                text.append(segment.text.strip())
                yield event("status", message=f"Transcribiendo: {int(segment.end)} segundos procesados…")
            result = " ".join(text).strip()
            if not result:
                raise ValueError("No se ha detectado voz.")
            yield event("result", text=result, filename=identifier + ".txt", source="whisper")
    except Exception:
        # Keep remote library internals, filesystem paths and network details off the public API.
        yield event("error", message="YouTube no ha permitido obtener la transcripción. Puede deberse a restricciones del vídeo, bloqueo del servidor o un formato no compatible. Puedes subir el archivo directamente.")
    finally:
        busy.release()


@app.get("/health")
def health():
    return {"status": "ok", "youtube": True}


@app.post("/youtube")
def youtube(data: Input):
    try:
        identifier = video_id(data.url)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if data.language not in LANGUAGES:
        raise HTTPException(400, "Idioma no compatible.")
    if not busy.acquire(blocking=False):
        raise HTTPException(429, "El servidor está ocupado. Inténtalo cuando termine el proceso actual.")
    return StreamingResponse(process(identifier, data.language), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
