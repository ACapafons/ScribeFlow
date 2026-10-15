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
    transcriber: null,
    recognition: null,
    audioContext: null,
    analyser: null,
    micStream: null,
    vuAnimId: null,
    searchQuery: '',
    fontSizePresentation: 2.2, // rem
    settings: {
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
    btnTranscribe: document.getElementById('btn-transcribe'),
    transcribeStatus: document.getElementById('transcribe-status'),
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
    el.btnOpenSettings.addEventListener('click', () => {
      el.prefAutoscroll.checked = state.settings.autoscroll;
      el.settingsModal.classList.remove('hidden');
    });
    el.btnCloseSettings.addEventListener('click', () => el.settingsModal.classList.add('hidden'));
    el.btnSaveSettings.addEventListener('click', () => {
      state.settings.autoscroll = el.prefAutoscroll.checked;
      localStorage.setItem('scribeflow_autoscroll', state.settings.autoscroll);
      el.settingsModal.classList.add('hidden');
      showToast('Ajustes guardados correctamente');
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
