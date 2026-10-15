/**
 * ScribeFlow AI - Client-side AI Transcription & Video/Audio Processing Suite
 * Diseñado para transcripción de clases, tutoriales y apuntes para ChatGPT
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    segments: [],
    activeSegmentIndex: -1,
    currentMedia: null, // pointer to active <video> or <audio> element
    currentMediaType: 'audio',
    filename: 'tutorial_universidad.mp4',
    duration: 0,
    isPlaying: false,
    audioBuffer: null,
    waveformPeaks: [],
    isRecording: false,
    recognition: null,
    audioContext: null,
    analyser: null,
    micStream: null,
    vuAnimId: null,
    searchQuery: '',
    fontSizePresentation: 2.2, // rem
    settings: {
      openAIKey: localStorage.getItem('scribeflow_openai_key') || '',
      localEndpoint: localStorage.getItem('scribeflow_local_endpoint') || 'http://localhost:8000/transcribe',
      autoscroll: localStorage.getItem('scribeflow_autoscroll') !== 'false'
    }
  };

  // --- DOM Elements ---
  const el = {
    // Media & Waveform
    videoWrap: document.getElementById('video-preview-wrap'),
    video: document.getElementById('video-element'),
    audio: document.getElementById('audio-element'),
    canvas: document.getElementById('waveform-canvas'),
    waveformWrap: document.getElementById('waveform-wrap'),
    playhead: document.getElementById('waveform-playhead'),
    hoverTime: document.getElementById('waveform-hover-time'),
    filenameBadge: document.getElementById('current-filename'),

    // Transport Controls
    btnPlayPause: document.getElementById('btn-play-pause'),
    playIcon: document.getElementById('play-icon'),
    pauseIcon: document.getElementById('pause-icon'),
    btnSkipBack: document.getElementById('btn-skip-back'),
    btnSkipForward: document.getElementById('btn-skip-forward'),
    currentTimeText: document.getElementById('current-time-text'),
    totalTimeText: document.getElementById('total-time-text'),
    speedBtns: document.querySelectorAll('.speed-btn'),
    volumeSlider: document.getElementById('volume-slider'),

    // File Input & Dock
    audioFileInput: document.getElementById('audio-file-input'),
    dropZone: document.getElementById('drop-zone'),
    btnToggleMic: document.getElementById('btn-toggle-mic'),
    micStatusDot: document.getElementById('mic-status-dot'),
    micStatusLabel: document.getElementById('mic-status-label'),
    micStatusText: document.getElementById('mic-status-text'),
    vuBar: document.getElementById('vu-bar'),
    micLanguage: document.getElementById('mic-language'),
    engineSelect: document.getElementById('engine-select'),
    btnLoadSample: document.getElementById('btn-load-sample'),

    // Export & ChatGPT Bar
    btnDownloadTxt: document.getElementById('btn-download-txt'),
    btnExportDropdown: document.getElementById('btn-export-dropdown'),
    exportMenu: document.getElementById('export-menu'),
    dropdownContainer: document.querySelector('.dropdown-container'),
    btnCopyChatGPT: document.getElementById('btn-copy-chatgpt'),
    chatgptPromptPreset: document.getElementById('chatgpt-prompt-preset'),

    // Transcript Area
    transcriptContainer: document.getElementById('transcript-container'),
    transcriptSearchInput: document.getElementById('transcript-search-input'),
    searchMatchesCount: document.getElementById('search-matches-count'),
    btnAddSegment: document.getElementById('btn-add-segment'),
    btnClearTranscript: document.getElementById('btn-clear-transcript'),
    segmentsCountBadge: document.getElementById('segments-count-badge'),
    liveInterimBox: document.getElementById('live-interim-box'),
    interimText: document.getElementById('interim-text'),

    // Stats
    statWords: document.getElementById('stat-words'),
    statChars: document.getElementById('stat-chars'),
    statReadTime: document.getElementById('stat-read-time'),
    statWpm: document.getElementById('stat-wpm'),

    // Presentation Mode Modal
    btnPresentationMode: document.getElementById('btn-presentation-mode'),
    presentationModal: document.getElementById('presentation-modal'),
    btnClosePresentation: document.getElementById('btn-close-presentation'),
    btnFontSmaller: document.getElementById('btn-font-smaller'),
    btnFontLarger: document.getElementById('btn-font-larger'),
    presentationSpeaker: document.getElementById('presentation-speaker'),
    presentationMainText: document.getElementById('presentation-main-text'),
    presentationSubText: document.getElementById('presentation-sub-text'),

    // Settings Modal
    btnOpenSettings: document.getElementById('btn-open-settings'),
    settingsModal: document.getElementById('settings-modal'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    inputOpenAIKey: document.getElementById('input-openai-key'),
    inputLocalEndpoint: document.getElementById('input-local-endpoint'),
    btnPingServer: document.getElementById('btn-ping-server'),
    serverPingResult: document.getElementById('server-ping-result'),
    prefAutoscroll: document.getElementById('pref-autoscroll'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // --- Initial Setup ---
  state.currentMedia = el.video; // default to video or audio

  // --- Helper Functions ---
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function formatTimeSRT(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  function formatTimeVTT(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      <span>${message}</span>
    `;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- Audio Synthesis Demo (Sample University Tutorial) ---
  function loadSampleUniversityTutorial() {
    state.filename = 'clase_universidad_algoritmos.mp4';
    el.filenameBadge.textContent = state.filename;

    // Realistic university lecture transcript in Spanish
    state.segments = [
      {
        id: 1,
        start: 0.0,
        end: 4.8,
        speaker: 'Profesor',
        text: 'Buenas tardes a todos. En la clase de hoy vamos a ver la resolución práctica de la tarea número tres.'
      },
      {
        id: 2,
        start: 5.0,
        end: 11.2,
        speaker: 'Profesor',
        text: 'En concreto, analizaremos cómo implementar el algoritmo de Dijkstra para encontrar el camino más corto en un grafo ponderado.'
      },
      {
        id: 3,
        start: 11.5,
        end: 16.8,
        speaker: 'Profesor',
        text: 'Recordad que la estructura de datos clave para optimizar la complejidad temporal es utilizar una cola de prioridad o un montículo binario.'
      },
      {
        id: 4,
        start: 17.0,
        end: 22.4,
        speaker: 'Alumno',
        text: 'Profesor, ¿podría aclarar cuál sería la complejidad si en lugar del montículo utilizamos una matriz de adyacencia simple?'
      },
      {
        id: 5,
        start: 22.8,
        end: 29.5,
        speaker: 'Profesor',
        text: 'Excelente pregunta. Con matriz simple la complejidad asciende a O de V al cuadrado, mientras que con min-heap logramos O de E más V por logaritmo de V.'
      },
      {
        id: 6,
        start: 30.0,
        end: 37.0,
        speaker: 'Profesor',
        text: 'Ahora abramos el archivo del proyecto. Para la entrega, debéis aseguraros de que el programa maneje correctamente los casos de grafos no conexos.'
      },
      {
        id: 7,
        start: 37.5,
        end: 43.8,
        speaker: 'Alumno',
        text: 'Entendido. ¿El formato del archivo de entrada debe ser necesariamente CSV o puede ser un fichero de texto plano?'
      },
      {
        id: 8,
        start: 44.2,
        end: 50.0,
        speaker: 'Profesor',
        text: 'El enunciado especifica formato de texto con los pares origen, destino y peso separados por espacios. Repasad los ejemplos del campus virtual.'
      }
    ];

    state.duration = 50.0;
    el.totalTimeText.textContent = formatTime(state.duration);
    el.currentTimeText.textContent = formatTime(0);

    // Create an artificial synthetic waveform buffer for visual delight
    generateSyntheticWaveform(50);
    renderTranscript();
    drawWaveform();
    showToast('Demo de tutorial universitario cargada correctamente');
  }

  // Generate synthetic waveform peaks for visual canvas
  function generateSyntheticWaveform(duration) {
    const barsCount = 200;
    state.waveformPeaks = [];
    for (let i = 0; i < barsCount; i++) {
      // Natural speech-like cadence with pauses between sentences
      const segmentProgress = (i / barsCount) * duration;
      const isSpeaking = state.segments.some(seg => segmentProgress >= seg.start && segmentProgress <= seg.end);
      if (isSpeaking) {
        state.waveformPeaks.push(0.25 + Math.random() * 0.7);
      } else {
        state.waveformPeaks.push(0.04 + Math.random() * 0.08); // background noise
      }
    }
  }

  // --- Real Media File Loading (Video & Audio) ---
  function handleFileSelected(file) {
    if (!file) return;

    state.filename = file.name;
    el.filenameBadge.textContent = file.name;

    const fileUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mkv|mov|avi)$/i.test(file.name);

    if (isVideo) {
      state.currentMediaType = 'video';
      state.currentMedia = el.video;
      el.video.src = fileUrl;
      el.videoWrap.classList.add('visible');
      el.audio.pause();
    } else {
      state.currentMediaType = 'audio';
      state.currentMedia = el.audio;
      el.audio.src = fileUrl;
      el.videoWrap.classList.remove('visible');
      el.video.pause();
    }

    // Attach metadata listener to update duration
    state.currentMedia.onloadedmetadata = function () {
      state.duration = state.currentMedia.duration || 60;
      el.totalTimeText.textContent = formatTime(state.duration);
      generateSyntheticWaveform(state.duration);
      drawWaveform();
    };

    // Decode audio data for real waveform if supported
    decodeAudioForWaveform(file);

    // Initial segment placeholder or trigger transcription
    state.segments = [
      {
        id: 1,
        start: 0.0,
        end: Math.min(state.duration || 10, 8.0),
        speaker: 'Hablante 1',
        text: `Archivo importado: "${file.name}". Listo para transcribir.`
      }
    ];

    renderTranscript();
    showToast(`Archivo "${file.name}" cargado`);
  }

  // Decode real audio using Web Audio API
  function decodeAudioForWaveform(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.decodeAudioData(e.target.result)
        .then(buffer => {
          state.audioBuffer = buffer;
          extractPeaksFromBuffer(buffer);
          drawWaveform();
        })
        .catch(err => {
          console.warn('Audio decoding fallback to synthetic waveform:', err);
        });
    };
    reader.readAsArrayBuffer(file);
  }

  function extractPeaksFromBuffer(buffer) {
    const rawData = buffer.getChannelData(0);
    const barsCount = 200;
    const blockSize = Math.floor(rawData.length / barsCount);
    state.waveformPeaks = [];

    for (let i = 0; i < barsCount; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j += 10) {
        sum += Math.abs(rawData[start + j] || 0);
      }
      const peak = (sum / (blockSize / 10)) * 2.2;
      state.waveformPeaks.push(Math.min(1.0, Math.max(0.05, peak)));
    }
  }

  // --- Waveform Canvas Rendering ---
  function drawWaveform() {
    const canvas = el.canvas;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const peaks = state.waveformPeaks.length > 0 ? state.waveformPeaks : Array(160).fill(0.15);
    const barWidth = width / peaks.length;
    const progress = state.duration > 0 ? (state.currentTime / state.duration) : 0;
    const playedIndex = Math.floor(progress * peaks.length);

    peaks.forEach((peak, i) => {
      const barHeight = peak * (height * 0.78);
      const x = i * barWidth;
      const y = (height - barHeight) / 2;

      // Color: Neon Cyan if played, Dark Slate/Indigo if pending
      if (i <= playedIndex) {
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(1, '#6366f1');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      }

      // Rounded bars
      const r = 2;
      ctx.beginPath();
      ctx.roundRect(x + 1, y, Math.max(1, barWidth - 2), barHeight, r);
      ctx.fill();
    });

    // Update playhead line position
    if (el.playhead) {
      el.playhead.style.left = `${progress * 100}%`;
    }
  }

  // --- Media Playback & Synchronization ---
  function togglePlayPause() {
    if (!state.currentMedia || !state.currentMedia.src) {
      // If no file loaded yet, load the university demo first!
      if (state.segments.length === 0) {
        loadSampleUniversityTutorial();
      }
      playSyntheticClock();
      return;
    }

    if (state.currentMedia.paused) {
      state.currentMedia.play().catch(e => console.log('Autoplay policy prevented audio play:', e));
    } else {
      state.currentMedia.pause();
    }
  }

  // When playing simulated sample audio
  let clockInterval = null;
  function playSyntheticClock() {
    state.isPlaying = !state.isPlaying;
    updatePlayIconState(state.isPlaying);

    if (state.isPlaying) {
      clockInterval = setInterval(() => {
        state.currentTime += 0.25;
        if (state.currentTime >= state.duration) {
          state.currentTime = 0;
          state.isPlaying = false;
          clearInterval(clockInterval);
          updatePlayIconState(false);
        }
        onTimeUpdate(state.currentTime);
      }, 250);
    } else {
      clearInterval(clockInterval);
    }
  }

  function updatePlayIconState(playing) {
    if (playing) {
      el.playIcon.classList.add('hidden');
      el.pauseIcon.classList.remove('hidden');
    } else {
      el.playIcon.classList.remove('hidden');
      el.pauseIcon.classList.add('hidden');
    }
  }

  function seekToTime(seconds) {
    state.currentTime = Math.max(0, Math.min(seconds, state.duration || 60));
    if (state.currentMedia && state.currentMedia.src) {
      state.currentMedia.currentTime = state.currentTime;
    }
    onTimeUpdate(state.currentTime);
  }

  function onTimeUpdate(currentTime) {
    el.currentTimeText.textContent = formatTime(currentTime);
    drawWaveform();

    // Find active segment
    const activeIdx = state.segments.findIndex(seg => currentTime >= seg.start && currentTime <= seg.end);
    if (activeIdx !== state.activeSegmentIndex) {
      state.activeSegmentIndex = activeIdx;
      highlightActiveSegment(activeIdx);
    }
  }

  function highlightActiveSegment(index) {
    const cards = el.transcriptContainer.querySelectorAll('.segment-card');
    cards.forEach((card, idx) => {
      if (idx === index) {
        card.classList.add('active-playing');
        if (state.settings.autoscroll) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        // Update presentation modal if open
        const seg = state.segments[idx];
        if (seg) {
          el.presentationSpeaker.textContent = seg.speaker;
          el.presentationMainText.textContent = seg.text;
          const prevSeg = state.segments[idx - 1];
          el.presentationSubText.textContent = prevSeg ? `"${prevSeg.text}"` : '';
        }
      } else {
        card.classList.remove('active-playing');
      }
    });
  }

  // --- Transcript Rendering & Editing ---
  function renderTranscript() {
    el.transcriptContainer.innerHTML = '';
    el.segmentsCountBadge.textContent = `${state.segments.length} segmentos`;

    if (state.segments.length === 0) {
      el.transcriptContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
          <div class="empty-title">Sin transcripción todavía</div>
          <div class="empty-desc">Sube un vídeo MP4, audio MP3 o pulsa "Dictar por Mic" para empezar a transcribir. También puedes hacer clic en "Cargar Demo Clase".</div>
        </div>
      `;
      updateStats();
      return;
    }

    state.segments.forEach((seg, index) => {
      const card = document.createElement('div');
      card.className = `segment-card ${index === state.activeSegmentIndex ? 'active-playing' : ''}`;
      card.dataset.index = index;

      const isSpeaker2 = seg.speaker.toLowerCase().includes('alumno') || seg.speaker.toLowerCase().includes('2');

      card.innerHTML = `
        <div class="segment-meta">
          <div class="meta-left">
            <button class="segment-time-btn" title="Saltar al audio de este segmento">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:10px;height:10px;">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>${formatTime(seg.start)}</span>
            </button>
            <span class="speaker-tag ${isSpeaker2 ? 'speaker-2' : ''}" title="Haz clic para alternar hablante">
              ${seg.speaker}
            </span>
          </div>
          <div class="segment-actions">
            <button class="btn-seg-action btn-seg-delete" title="Eliminar segmento">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="segment-text" contenteditable="true" spellcheck="true">${highlightSearchText(seg.text)}</div>
      `;

      // Click timestamp -> seek media
      card.querySelector('.segment-time-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        seekToTime(seg.start);
      });

      // Toggle speaker label
      card.querySelector('.speaker-tag').addEventListener('click', (e) => {
        e.stopPropagation();
        seg.speaker = seg.speaker === 'Profesor' ? 'Alumno' : (seg.speaker === 'Hablante 1' ? 'Hablante 2' : 'Profesor');
        renderTranscript();
      });

      // Delete segment
      card.querySelector('.btn-seg-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        state.segments.splice(index, 1);
        renderTranscript();
      });

      // Editable text sync
      const textDiv = card.querySelector('.segment-text');
      textDiv.addEventListener('input', () => {
        seg.text = textDiv.innerText;
        updateStats();
      });

      el.transcriptContainer.appendChild(card);
    });

    updateStats();
  }

  function highlightSearchText(text) {
    if (!state.searchQuery || state.searchQuery.trim() === '') return text;
    const query = state.searchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function updateStats() {
    const fullText = state.segments.map(s => s.text).join(' ');
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
    const chars = fullText.length;
    const minutes = Math.floor(words / 130);
    const seconds = Math.floor((words % 130) / (130 / 60));

    el.statWords.textContent = words.toLocaleString();
    el.statChars.textContent = chars.toLocaleString();
    el.statReadTime.textContent = `${minutes}m ${seconds}s`;
    el.statWpm.textContent = '145 PPM';
  }

  // --- Real-time Speech Recognition (Web Speech API) ---
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = el.micLanguage.value;

    recognition.onstart = function () {
      state.isRecording = true;
      el.btnToggleMic.classList.add('recording');
      el.micStatusDot.classList.add('active');
      el.micStatusLabel.textContent = 'Dictando en Vivo...';
      el.micStatusText.textContent = 'Detener Mic';
      el.liveInterimBox.classList.remove('hidden');
      startVUMeter();
      showToast('Micrófono activado: empieza a hablar');
    };

    recognition.onresult = function (event) {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const finalWord = event.results[i][0].transcript.trim();
          if (finalWord) {
            const lastSeg = state.segments[state.segments.length - 1];
            const startTime = lastSeg ? lastSeg.end : state.currentTime;
            const endTime = startTime + Math.max(3.0, (finalWord.split(' ').length * 0.4));
            state.segments.push({
              id: Date.now(),
              start: startTime,
              end: endTime,
              speaker: 'Dictado en Vivo',
              text: finalWord
            });
            state.duration = Math.max(state.duration, endTime);
            el.totalTimeText.textContent = formatTime(state.duration);
            renderTranscript();
            generateSyntheticWaveform(state.duration);
            drawWaveform();
          }
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      el.interimText.textContent = interim || 'Escuchando tu voz...';
    };

    recognition.onerror = function (event) {
      console.error('Speech recognition error:', event.error);
      stopRecording();
      showToast(`Error de micrófono: ${event.error}`, 'error');
    };

    recognition.onend = function () {
      if (state.isRecording) {
        stopRecording();
      }
    };

    return recognition;
  }

  function toggleRecording() {
    if (state.isRecording) {
      stopRecording();
    } else {
      state.recognition = setupSpeechRecognition();
      if (!state.recognition) {
        showToast('Tu navegador no soporta reconocimiento Web Speech directo.', 'error');
        return;
      }
      state.recognition.lang = el.micLanguage.value;
      try {
        state.recognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  }

  function stopRecording() {
    state.isRecording = false;
    el.btnToggleMic.classList.remove('recording');
    el.micStatusDot.classList.remove('active');
    el.micStatusLabel.textContent = 'Micrófono Inactivo';
    el.micStatusText.textContent = 'Dictar por Mic';
    el.liveInterimBox.classList.add('hidden');
    stopVUMeter();
    if (state.recognition) {
      try { state.recognition.stop(); } catch (e) {}
    }
  }

  // --- Live Microphone VU Meter Animation ---
  function startVUMeter() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        state.micStream = stream;
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = state.audioContext.createMediaStreamSource(stream);
        state.analyser = state.audioContext.createAnalyser();
        state.analyser.fftSize = 64;
        source.connect(state.analyser);

        const dataArray = new Uint8Array(state.analyser.frequencyBinCount);
        function updateVU() {
          if (!state.isRecording) return;
          state.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const pct = Math.min(100, Math.round((avg / 128) * 100));
          el.vuBar.style.width = `${pct}%`;
          state.vuAnimId = requestAnimationFrame(updateVU);
        }
        updateVU();
      })
      .catch(err => {
        console.warn('Microphone stream access denied for VU meter:', err);
      });
  }

  function stopVUMeter() {
    if (state.vuAnimId) cancelAnimationFrame(state.vuAnimId);
    el.vuBar.style.width = '0%';
    if (state.micStream) {
      state.micStream.getTracks().forEach(track => track.stop());
      state.micStream = null;
    }
  }

  // --- ChatGPT Prompt Presets & One-Click Copy (Tailored for User) ---
  function generateChatGPTPrompt() {
    const preset = el.chatgptPromptPreset.value;
    const fullTranscript = state.segments
      .map(s => `[${formatTime(s.start)}] ${s.speaker}: ${s.text}`)
      .join('\n');

    if (preset === 'raw') {
      return state.segments.map(s => s.text).join('\n\n');
    }

    if (preset === 'summary') {
      return `Eres un asistente de estudio experto. A continuación te adjunto la transcripción completa de un vídeo/clase.
Por favor, analiza el contenido y elabora:
1. Resumen ejecutivo detallado.
2. Puntos clave y conceptos explicados en orden cronológico.
3. Conclusiones y notas prácticas para estudiar.

--- TRANSCRIPCIÓN DEL VÍDEO ---
${fullTranscript}`;
    }

    if (preset === 'tutorial') {
      return `Hola ChatGPT, tengo este tutorial en vídeo de una tarea/práctica de mi universidad.
A continuación te paso la transcripción exacta con marcas de tiempo.
Por favor:
1. Explica paso a paso el procedimiento y código/algoritmo mostrado en el vídeo.
2. Identifica los requisitos clave y errores comunes que menciona el profesor/tutor.
3. Guíame para resolver la tarea con la mejor solución explicada con claridad.

--- TRANSCRIPCIÓN DEL VÍDEO ---
${fullTranscript}`;
    }

    if (preset === 'flashcards') {
      return `Por favor, actúa como un tutor universitario. Basándote en la siguiente transcripción de la clase:
1. Genera 10 preguntas tipo test y de desarrollo con sus respuestas detalladas.
2. Crea un glosario con las definiciones técnicas clave mencionadas.
3. Diseña 5 tarjetas de memoria (Flashcards) para repasar antes del examen.

--- TRANSCRIPCIÓN DE LA CLASE ---
${fullTranscript}`;
    }

    return fullTranscript;
  }

  function copyForChatGPT() {
    if (state.segments.length === 0) {
      showToast('No hay segmentos para copiar. Carga primero un vídeo o la demo.', 'error');
      return;
    }

    const promptText = generateChatGPTPrompt();
    navigator.clipboard.writeText(promptText).then(() => {
      showToast('⚡ ¡Copiado con formato para ChatGPT! Solo tienes que pegarlo (Ctrl+V)');
    }).catch(err => {
      console.error('Clipboard copy error:', err);
      showToast('No se pudo copiar automáticamente al portapapeles', 'error');
    });
  }

  // --- Download & Export Handlers ---
  function downloadTxtFile() {
    if (state.segments.length === 0) {
      showToast('No hay transcripción disponible para descargar', 'error');
      return;
    }

    const content = state.segments
      .map(s => `[${formatTime(s.start)} - ${formatTime(s.end)}] ${s.speaker}:\n${s.text}\n`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.filename.replace(/\.[^/.]+$/, '')}_transcripcion.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Archivo .TXT descargado');
  }

  function exportSubtitles(format) {
    if (state.segments.length === 0) {
      showToast('No hay segmentos para exportar', 'error');
      return;
    }

    let output = '';
    let mime = 'text/plain;charset=utf-8';
    let ext = format;

    if (format === 'srt') {
      output = state.segments.map((seg, i) => {
        return `${i + 1}\n${formatTimeSRT(seg.start)} --> ${formatTimeSRT(seg.end)}\n${seg.text}\n`;
      }).join('\n');
      ext = 'srt';
    } else if (format === 'vtt') {
      output = 'WEBVTT\n\n' + state.segments.map((seg, i) => {
        return `${i + 1}\n${formatTimeVTT(seg.start)} --> ${formatTimeVTT(seg.end)}\n${seg.text}\n`;
      }).join('\n');
      ext = 'vtt';
    } else if (format === 'json') {
      output = JSON.stringify({
        filename: state.filename,
        duration: state.duration,
        generatedAt: new Date().toISOString(),
        segments: state.segments
      }, null, 2);
      mime = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([output], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.filename.replace(/\.[^/.]+$/, '')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Archivo .${ext.toUpperCase()} exportado`);
  }

  // --- Presentation Overlay Mode ---
  function openPresentationMode() {
    el.presentationModal.classList.remove('hidden');
    const seg = state.segments[state.activeSegmentIndex] || state.segments[0];
    if (seg) {
      el.presentationSpeaker.textContent = seg.speaker;
      el.presentationMainText.textContent = seg.text;
    }
  }

  function closePresentationMode() {
    el.presentationModal.classList.add('hidden');
  }

  // --- Event Listeners Initialization ---
  function initListeners() {
    // Play / Pause
    el.btnPlayPause.addEventListener('click', togglePlayPause);
    el.btnSkipBack.addEventListener('click', () => seekToTime(state.currentTime - 5));
    el.btnSkipForward.addEventListener('click', () => seekToTime(state.currentTime + 5));

    // Media element native events
    [el.video, el.audio].forEach(media => {
      media.addEventListener('timeupdate', () => {
        state.currentTime = media.currentTime;
        onTimeUpdate(media.currentTime);
      });
      media.addEventListener('play', () => updatePlayIconState(true));
      media.addEventListener('pause', () => updatePlayIconState(false));
      media.addEventListener('ended', () => updatePlayIconState(false));
    });

    // Speed Controls
    el.speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        el.speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed);
        el.video.playbackRate = speed;
        el.audio.playbackRate = speed;
      });
    });

    // Volume Slider
    el.volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      el.video.volume = vol;
      el.audio.volume = vol;
    });

    // Waveform click to seek
    el.waveformWrap.addEventListener('click', (e) => {
      const rect = el.waveformWrap.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = clickX / rect.width;
      const targetTime = pct * (state.duration || 60);
      seekToTime(targetTime);
    });

    el.waveformWrap.addEventListener('mousemove', (e) => {
      const rect = el.waveformWrap.getBoundingClientRect();
      const hoverX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, hoverX / rect.width));
      const hoverSeconds = pct * (state.duration || 60);
      el.hoverTime.style.opacity = '1';
      el.hoverTime.style.left = `${hoverX + 10}px`;
      el.hoverTime.textContent = formatTime(hoverSeconds);
    });

    el.waveformWrap.addEventListener('mouseleave', () => {
      el.hoverTime.style.opacity = '0';
    });

    // File Selection
    el.audioFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0]);
      }
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(name => {
      el.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        el.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      el.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        el.dropZone.classList.remove('dragover');
      });
    });

    el.dropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    // Sample Loader
    el.btnLoadSample.addEventListener('click', loadSampleUniversityTutorial);

    // Live Mic Toggle
    el.btnToggleMic.addEventListener('click', toggleRecording);
    el.micLanguage.addEventListener('change', () => {
      if (state.isRecording) {
        stopRecording();
        toggleRecording();
      }
    });

    // ChatGPT Context Copy & Download TXT
    el.btnCopyChatGPT.addEventListener('click', copyForChatGPT);
    el.btnDownloadTxt.addEventListener('click', downloadTxtFile);

    // Export Dropdown
    el.btnExportDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      el.dropdownContainer.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!el.dropdownContainer.contains(e.target)) {
        el.dropdownContainer.classList.remove('open');
      }
    });

    document.querySelectorAll('[data-export]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        exportSubtitles(item.dataset.export);
        el.dropdownContainer.classList.remove('open');
      });
    });

    // Search in Transcript
    el.transcriptSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      const count = state.segments.filter(s => s.text.toLowerCase().includes(state.searchQuery.toLowerCase().trim())).length;
      if (state.searchQuery.trim()) {
        el.searchMatchesCount.textContent = count;
        el.searchMatchesCount.classList.remove('hidden');
      } else {
        el.searchMatchesCount.classList.add('hidden');
      }
      renderTranscript();
    });

    // Add manual segment
    el.btnAddSegment.addEventListener('click', () => {
      const startTime = state.currentTime;
      const endTime = startTime + 5.0;
      state.segments.push({
        id: Date.now(),
        start: startTime,
        end: endTime,
        speaker: 'Hablante 1',
        text: 'Nuevo segmento de audio...'
      });
      state.segments.sort((a, b) => a.start - b.start);
      renderTranscript();
    });

    // Clear transcript
    el.btnClearTranscript.addEventListener('click', () => {
      if (confirm('¿Seguro que deseas vaciar toda la transcripción actual?')) {
        state.segments = [];
        renderTranscript();
        showToast('Transcripción vaciada');
      }
    });

    // Presentation Modal
    el.btnPresentationMode.addEventListener('click', openPresentationMode);
    el.btnClosePresentation.addEventListener('click', closePresentationMode);
    el.btnFontSmaller.addEventListener('click', () => {
      state.fontSizePresentation = Math.max(1.2, state.fontSizePresentation - 0.2);
      el.presentationMainText.style.fontSize = `${state.fontSizePresentation}rem`;
    });
    el.btnFontLarger.addEventListener('click', () => {
      state.fontSizePresentation = Math.min(4.0, state.fontSizePresentation + 0.2);
      el.presentationMainText.style.fontSize = `${state.fontSizePresentation}rem`;
    });

    // Settings Modal
    el.btnOpenSettings.addEventListener('click', () => {
      el.inputOpenAIKey.value = state.settings.openAIKey;
      el.inputLocalEndpoint.value = state.settings.localEndpoint;
      el.prefAutoscroll.checked = state.settings.autoscroll;
      el.settingsModal.classList.remove('hidden');
    });

    el.btnCloseSettings.addEventListener('click', () => {
      el.settingsModal.classList.add('hidden');
    });

    el.btnSaveSettings.addEventListener('click', () => {
      state.settings.openAIKey = el.inputOpenAIKey.value.trim();
      state.settings.localEndpoint = el.inputLocalEndpoint.value.trim();
      state.settings.autoscroll = el.prefAutoscroll.checked;

      localStorage.setItem('scribeflow_openai_key', state.settings.openAIKey);
      localStorage.setItem('scribeflow_local_endpoint', state.settings.localEndpoint);
      localStorage.setItem('scribeflow_autoscroll', state.settings.autoscroll);

      el.settingsModal.classList.add('hidden');
      showToast('Ajustes guardados correctamente');
    });

    el.btnPingServer.addEventListener('click', () => {
      el.serverPingResult.textContent = 'Comprobando...';
      el.serverPingResult.className = 'ping-result';
      fetch(el.inputLocalEndpoint.value, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          el.serverPingResult.textContent = 'Conexión detectada';
          el.serverPingResult.className = 'ping-result online';
        })
        .catch(() => {
          el.serverPingResult.textContent = 'Servidor local no detectado';
          el.serverPingResult.className = 'ping-result offline';
        });
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.contentEditable === 'true') {
        return; // Don't trigger shortcuts when typing
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        seekToTime(state.currentTime - 5);
      } else if (e.code === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        seekToTime(state.currentTime + 5);
      } else if (e.code === 'Escape') {
        closePresentationMode();
        el.settingsModal.classList.add('hidden');
      }
    });

    // Window resize -> redraw waveform
    window.addEventListener('resize', () => {
      el.canvas.width = el.canvas.parentElement.clientWidth;
      drawWaveform();
    });
  }

  // --- Boot Application ---
  function init() {
    el.canvas.width = el.canvas.parentElement.clientWidth;
    initListeners();
    loadSampleUniversityTutorial();
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
