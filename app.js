'use strict';

let selectedFile = null;
let transcriber = null;
const fileInput = document.getElementById('audio-file-input');
const fileName = document.getElementById('file-name');
const languageSelect = document.getElementById('language-select');
const transcribeButton = document.getElementById('btn-transcribe');
const downloadButton = document.getElementById('btn-download-txt');
const status = document.getElementById('transcribe-status');
const transcriptText = document.getElementById('transcript-text');

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0] || null;
  fileName.textContent = selectedFile ? selectedFile.name : 'No has seleccionado ningún archivo.';
  transcribeButton.disabled = !selectedFile;
  downloadButton.disabled = true;
  transcriptText.value = '';
  status.textContent = selectedFile ? 'Archivo listo. Pulsa «Transcribir».' : 'La primera vez se descargará Whisper (unos cientos de MB).';
});

transcribeButton.addEventListener('click', transcribeFile);

downloadButton.addEventListener('click', () => {
  const text = transcriptText.value.trim();
  if (!text) return;
  const blob = new Blob([text + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (selectedFile?.name || 'transcripcion').replace(/\.[^.]+$/, '') + '.txt';
  link.click();
  URL.revokeObjectURL(url);
});

async function transcribeFile() {
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
    status.textContent = 'Preparando el audio…';
    const mediaUrl = URL.createObjectURL(selectedFile);
    const media = document.createElement(selectedFile.type.startsWith('video/') ? 'video' : 'audio');
    media.preload = 'auto';
    media.src = mediaUrl;
    await new Promise((resolve, reject) => {
      media.addEventListener('loadedmetadata', resolve, { once: true });
      media.addEventListener('error', () => reject(new Error('No se puede leer este formato. Prueba con MP4, WebM, MP3 o WAV.')), { once: true });
    });
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createMediaElementSource(media);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silent = context.createGain();
    const chunks = [];
    silent.gain.value = 0;
    source.connect(processor); processor.connect(silent); silent.connect(context.destination);
    processor.onaudioprocess = event => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    const ended = new Promise(resolve => media.addEventListener('ended', resolve, { once: true }));
    await media.play();
    await Promise.race([ended, new Promise((_, reject) => setTimeout(() => reject(new Error('Se agotó el tiempo al leer el archivo.')), Math.ceil(media.duration * 1000) + 10000))]);
    processor.disconnect(); source.disconnect(); silent.disconnect();
    const sampleRate = context.sampleRate;
    await context.close();
    URL.revokeObjectURL(mediaUrl);
    const audio = new Float32Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
    status.textContent = 'Transcribiendo en este dispositivo…';
    const result = await transcriber({ audio, sampling_rate: sampleRate }, {
      language: languageSelect.value === 'es' ? 'spanish' : languageSelect.value,
      task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true
    });
    transcriptText.value = (result.chunks || []).map(chunk => chunk.text.trim()).filter(Boolean).join(' ').trim() || (result.text || '').trim();
    if (!transcriptText.value) throw new Error('Whisper no ha detectado voz en el archivo.');
    downloadButton.disabled = false;
    status.textContent = 'Transcripción completada.';
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'No se pudo transcribir el archivo.';
  } finally {
    transcribeButton.disabled = false;
  }
}


