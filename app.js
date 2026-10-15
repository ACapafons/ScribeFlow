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

    status.textContent = 'Leyendo y decodificando el audio…';
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Este navegador no permite procesar audio. Prueba con Chrome o Edge actualizado.');
    const context = new AudioContextClass();
    const buffer = await selectedFile.arrayBuffer();
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
    for (let i = 0; i < outputLength; i++) {
      const position = i * ratio;
      const left = Math.floor(position);
      const fraction = position - left;
      const first = source[left] || 0;
      const second = source[Math.min(left + 1, source.length - 1)] || 0;
      audio[i] = first + (second - first) * fraction;
      if (i % 800000 === 0) {
        status.textContent = 'Preparando audio… ' + Math.min(99, Math.round(i / outputLength * 100)) + '%';
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    if (!audio.length) throw new Error('El archivo no contiene audio decodificable.');

    status.textContent = 'Transcribiendo en este dispositivo…';
    const result = await transcriber({ audio, sampling_rate: targetRate }, {
      language: languageSelect.value === 'es' ? 'spanish' : languageSelect.value,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
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



