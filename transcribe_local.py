"""
Buzz Local Transcriber & Backend Server
Inspirado en Buzz (https://github.com/chidiwilliams/buzz)

Permite transcribir vídeos (MP4, MKV, etc.) y audios (MP3, WAV) 100% offline
utilizando faster-whisper o whisper de OpenAI, y exportar directamente
en formato .TXT optimizado para ChatGPT, .SRT y .VTT.
"""

import argparse
import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{mins:02d}:{secs:02d}.{millis:03d}"

def format_srt_time(seconds: float) -> str:
    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def transcribe_file(file_path: str, model_size: str = "base", language: str = "es", device: str = "auto"):
    """
    Transcribe un archivo de vídeo o audio usando faster-whisper (o fallback a whisper).
    """
    if not os.path.exists(file_path):
        print(f"Error: El archivo '{file_path}' no existe.")
        return []

    print(f"[*] Cargando modelo Whisper '{model_size}' en dispositivo '{device}'...")
    
    segments_data = []
    
    try:
        from faster_whisper import WhisperModel
        # Determinar computación óptima (float16 si hay GPU CUDA, int8 si es CPU)
        compute_type = "float16" if device == "cuda" else "int8"
        model = WhisperModel(model_size, device=device if device != "auto" else "cpu", compute_type=compute_type)
        
        print(f"[*] Transcribiendo '{file_path}'...")
        segments, info = model.transcribe(file_path, language=language, beam_size=5)
        print(f"[*] Idioma detectado: {info.language} con probabilidad {info.language_probability:.2f}")

        for seg in segments:
            segments_data.append({
                "start": seg.start,
                "end": seg.end,
                "text": seg.text.strip()
            })
            print(f"[{format_timestamp(seg.start)} --> {format_timestamp(seg.end)}] {seg.text.strip()}")

    except ImportError:
        print("[!] faster-whisper no está instalado. Probando con 'whisper' oficial...")
        try:
            import whisper
            model = whisper.load_model(model_size)
            result = model.transcribe(file_path, language=language)
            for seg in result.get("segments", []):
                segments_data.append({
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"].strip()
                })
                print(f"[{format_timestamp(seg['start'])} --> {format_timestamp(seg['end'])}] {seg['text'].strip()}")
        except ImportError:
            print("[X] Error: Por favor instala faster-whisper ejecutando:")
            print("    pip install faster-whisper")
            sys.exit(1)

    return segments_data

def export_outputs(segments, base_filename, output_dir="."):
    if not segments:
        print("[!] No se generaron segmentos.")
        return

    txt_path = os.path.join(output_dir, f"{base_filename}_para_chatgpt.txt")
    srt_path = os.path.join(output_dir, f"{base_filename}.srt")

    # 1. Exportar TXT con formato optimizado para ChatGPT
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("A continuación tienes la transcripción completa de un vídeo tutorial/clase.\n")
        f.write("Por favor, elabora un resumen detallado con los conceptos y pasos explicados:\n\n")
        f.write("--- TRANSCRIPCIÓN ---\n")
        for s in segments:
            f.write(f"[{format_timestamp(s['start'])}] {s['text']}\n")
    print(f"[✓] Archivo para ChatGPT guardado en: {txt_path}")

    # 2. Exportar SRT
    with open(srt_path, "w", encoding="utf-8") as f:
        for idx, s in enumerate(segments, start=1):
            f.write(f"{idx}\n")
            f.write(f"{format_srt_time(s['start'])} --> {format_srt_time(s['end'])}\n")
            f.write(f"{s['text']}\n\n")
    print(f"[✓] Subtítulos SRT guardados en: {srt_path}")

class SimpleWhisperServer(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_HEAD(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

    def do_POST(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {"status": "ok", "message": "Buzz local server ready"}
        self.wfile.write(json.dumps(response).encode('utf-8'))

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, SimpleWhisperServer)
    print(f"[*] Servidor local Buzz escuchando en http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Servidor detenido.")

def main():
    parser = argparse.ArgumentParser(description="Buzz CLI - Transcriptor de vídeos y audios para ChatGPT")
    parser.add_argument("--file", "-f", help="Ruta al archivo de vídeo (MP4, MKV) o audio (MP3, WAV)")
    parser.add_argument("--model", "-m", default="base", choices=["tiny", "base", "small", "medium", "large-v3"], help="Tamaño del modelo Whisper")
    parser.add_argument("--language", "-l", default="es", help="Código de idioma (ej: es, en)")
    parser.add_argument("--device", "-d", default="auto", choices=["auto", "cpu", "cuda"], help="Dispositivo de aceleración")
    parser.add_argument("--serve", action="store_true", help="Iniciar servidor local para la interfaz web")
    parser.add_argument("--port", type=int, default=8000, help="Puerto para el servidor local")

    args = parser.parse_args()

    if args.serve:
        run_server(args.port)
        return

    if not args.file:
        print("Uso: python transcribe_local.py --file mi_video.mp4")
        print("Para ver opciones completas: python transcribe_local.py --help")
        return

    base_name = os.path.splitext(os.path.basename(args.file))[0]
    segments = transcribe_file(args.file, model_size=args.model, language=args.language, device=args.device)
    export_outputs(segments, base_name)

if __name__ == "__main__":
    main()
