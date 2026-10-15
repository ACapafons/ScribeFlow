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
    const result = await transcriber({ audio, sampling_rate: targetRate }, {
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
    status.textContent = error.message || 'No se pudo transcribir el archivo.';
  } finally {
    transcribeButton.disabled = false;
  }
}



