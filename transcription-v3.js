'use strict';

let selectedFile = null;
let transcriber = null;
let resultFilename = 'transcripcion.txt';
const fileInput = document.getElementById('audio-file-input');
const fileName = document.getElementById('file-name');
const languageSelect = document.getElementById('language-select');
const transcribeButton = document.getElementById('btn-transcribe');
const downloadButton = document.getElementById('btn-download-txt');
const status = document.getElementById('transcribe-status');
const transcriptText = document.getElementById('transcript-text');

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0] || null;
  document.getElementById('youtube-url').value = '';
  fileName.textContent = selectedFile ? selectedFile.name : 'No has seleccionado ningún archivo.';
  transcribeButton.disabled = !selectedFile;
  downloadButton.disabled = true;
  transcriptText.value = '';
  status.textContent = selectedFile ? 'Archivo listo. Pulsa «Transcribir».' : 'La primera vez se descargará Whisper (unos cientos de MB).';
});

transcribeButton.addEventListener('click', () => youtubeUrl.value.trim() ? transcribeYouTube() : transcribeFile());

downloadButton.addEventListener('click', () => {
  const text = transcriptText.value.trim();
  if (!text) return;
  const blob = new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resultFilename;
  link.click();
  URL.revokeObjectURL(url);
});

async function transcribeFile() {
  resultFilename = (selectedFile?.name || 'transcripcion').replace(/\.[^.]+$/, '') + '.txt';
  if (!selectedFile) { status.textContent = 'Selecciona un archivo primero.'; return; }
  transcribeButton.disabled = true;
  downloadButton.disabled = true;
  transcriptText.value = '';
  try {
    if (!transcriber) {
      status.textContent = 'Descargando Whisper. Solo hace falta la primera vez.';
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
      env.allowLocalModels = false;
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
        progress_callback: progress => {
          if (progress.status === 'progress') status.textContent = 'Descargando Whisper: ' + Math.round(progress.progress || 0) + '%';
        }
      });
    }

    status.textContent = 'Leyendo el archivo…';
    if (selectedFile.size > 500 * 1024 * 1024) throw new Error('El archivo supera 500 MB. Usa un vídeo más corto o comprímelo antes de subirlo.');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Este navegador no permite procesar audio. Prueba con Chrome o Edge actualizado.');
    const context = new AudioContextClass();
    status.textContent = 'Cargando archivo en memoria…';
    const buffer = await selectedFile.arrayBuffer();
    status.textContent = 'Decodificando audio. En archivos largos puede tardar un poco…';
    await new Promise(resolve => setTimeout(resolve, 50));
    let decoded;
    try {
      decoded = await context.decodeAudioData(buffer);
    } catch {
      throw new Error('No se pudo decodificar el audio de este archivo. Prueba con MP4, WebM, MP3 o WAV.');
    }
    await context.close();

    status.textContent = 'Preparando audio para Whisper…';
    const targetRate = 16000;
    const sourceRate = decoded.sampleRate;
    const source = decoded.getChannelData(0);
    const outputLength = Math.ceil(source.length * targetRate / sourceRate);
    const audio = new Float32Array(outputLength);
    const ratio = sourceRate / targetRate;
    const blockSize = 250000;
    for (let blockStart = 0; blockStart < outputLength; blockStart += blockSize) {
      const blockEnd = Math.min(outputLength, blockStart + blockSize);
      for (let i = blockStart; i < blockEnd; i++) {
      const position = i * ratio;
      const left = Math.floor(position);
      const fraction = position - left;
      const first = source[left] || 0;
      const second = source[Math.min(left + 1, source.length - 1)] || 0;
      audio[i] = first + (second - first) * fraction;
      }
      status.textContent = 'Preparando audio… ' + Math.min(99, Math.round(blockEnd / outputLength * 100)) + '%';
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!audio.length) throw new Error('El archivo no contiene audio decodificable.');

    status.textContent = 'Transcribiendo con Whisper. En equipos modestos puede tardar varios minutos…';
    if (!(audio instanceof Float32Array)) throw new Error('La entrada de Whisper no es Float32Array.');
    const result = await transcriber(audio, {
      language: languageSelect.value === 'es' ? 'spanish' : languageSelect.value,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
      callback_function: (tokens) => {
        if (tokens && tokens.length) status.textContent = 'Whisper está procesando el audio… ' + tokens.length + ' tokens';
      }
    });
    transcriptText.value = (result.chunks || []).map(chunk => chunk.text.trim()).filter(Boolean).join(' ').trim() || (result.text || '').trim();
    if (!transcriptText.value) throw new Error('Whisper no ha detectado voz en el archivo.');
    downloadButton.disabled = false;
    status.textContent = 'Transcripción completada.';
  } catch (error) {
    console.error(error);
    status.textContent = '[v3] ' + (error.message || 'No se pudo transcribir el archivo.') + ' — ' + (error.stack || '').split('\n').slice(1, 3).join(' ');
  } finally {
    transcribeButton.disabled = false;
  }
}




const versionNote = document.createElement('small');
versionNote.textContent = 'Versión de transcripción: 3';
versionNote.style.display = 'block';
status.after(versionNote);

const youtubeUrl = document.getElementById('youtube-url');
const endpoint = window.SCRIBEFLOW_YOUTUBE_ENDPOINT || '';
if (!endpoint) document.getElementById('youtube-note').textContent = 'La opción YouTube está pendiente de conectar con el servidor.';
youtubeUrl.addEventListener('input', () => {
  selectedFile = null;
  fileInput.value = '';
  fileName.textContent = 'No has seleccionado ningún archivo.';
  transcriptText.value = '';
  downloadButton.disabled = true;
  transcribeButton.disabled = !youtubeUrl.value.trim() || !endpoint;
  status.textContent = endpoint ? 'Enlace listo. Pulsa «Transcribir».' : 'El servidor de YouTube aún no está configurado.';
});

async function transcribeYouTube() {
  transcribeButton.disabled = true;
  fileInput.disabled = true;
  youtubeUrl.disabled = true;
  languageSelect.disabled = true;
  downloadButton.disabled = true;
  transcriptText.value = '';
  const controller = new AbortController();
  let timer;
  const resetTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  };
  try {
    if (!endpoint) throw new Error('El servidor de YouTube aún no está configurado.');
    status.textContent = 'Conectando con YouTube…';
    resetTimeout();
    const response = await fetch(endpoint.replace(/\/$/, '') + '/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: youtubeUrl.value.trim(), language: languageSelect.value }),
      signal: controller.signal
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(typeof error.detail === 'string' ? error.detail : 'No se pudo conectar con el servidor.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let complete = false;
    function consume(line) {
      if (!line.trim()) return;
      const event = JSON.parse(line);
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'status') status.textContent = event.message;
      if (event.type === 'result') {
        if (typeof event.text !== 'string' || !event.text.trim()) throw new Error('El servidor devolvió una transcripción vacía.');
        transcriptText.value = event.text;
        resultFilename = event.filename || 'youtube.txt';
        downloadButton.disabled = false;
        status.textContent = event.source === 'captions' ? 'Transcripción obtenida de los subtítulos de YouTube.' : 'Transcripción completada con Whisper.';
        complete = true;
      }
    }
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      resetTimeout();
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop();
      lines.forEach(consume);
    }
    pending += decoder.decode();
    consume(pending);
    if (!complete) throw new Error('La conexión terminó sin devolver una transcripción.');
  } catch (error) {
    controller.abort();
    status.textContent = error.name === 'AbortError' ? 'Se agotó el tiempo de espera del servidor. Puedes subir el archivo directamente.' : error.message;
  } finally {
    clearTimeout(timer);
    fileInput.disabled = false;
    youtubeUrl.disabled = false;
    languageSelect.disabled = false;
    transcribeButton.disabled = false;
  }
}
