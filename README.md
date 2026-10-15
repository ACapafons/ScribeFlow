# ScribeFlow AI 🎙️⚡
### Asistente Inteligente de Transcripción de Vídeos, Clases y Apuntes para ChatGPT y LLMs

> **ScribeFlow AI** es una aplicación web moderna diseñada específicamente para estudiantes y creadores de contenido. Permite importar vídeos de clases, tutoriales de universidad (MP4, WebM, MKV) o audios (MP3, WAV), transcribirlos de forma instantánea, descargarlos en `.TXT` y formatear el contexto con un solo clic para pasárselo a ChatGPT o cualquier modelo de lenguaje.

---

## 🏗️ ¿Cómo funciona? (Arquitectura y Funcionamiento)

ScribeFlow AI combina procesamiento multimedia en el navegador del cliente con modelos de Inteligencia Artificial para ofrecer una experiencia fluida, privada e interactiva:

```
[ Vídeo MP4 / Audio MP3 ]
          │
          ├──> HTML5 Video/Audio Player ───> Sincronización Interactiva (Click-to-Seek)
          │
          ├──> Web Audio API (AudioContext) ──> Extracción de Ondas y Render en Canvas 2D
          │
          ├──> Motor de Transcripción:
          │     ├── Opción 1: Web Speech API (Reconocimiento en vivo sin instalación)
          │     ├── Opción 2: OpenAI Whisper Cloud API (Transcripción en la nube)
          │     └── Opción 3: Servidor Local faster-whisper (100% Offline con GPU/CPU)
          │
          └──> Pipeline de Procesamiento de Texto:
                ├── Segmentación con Marcas de Tiempo [MM:SS]
                ├── Separación Heurística de Hablantes (Profesor / Alumno)
                ├── Editor Interactivo y Búsqueda en Tiempo Real
                ├── ⚡ Generador de Prompts Estructurados para ChatGPT
                └── Exportadores Multi-Formato (.TXT, .SRT, .VTT, .JSON)
```

### 1. Ingesta y Decodificación Multimedia
Cuando arrastras un archivo `.mp4`, el reproductor HTML5 monta el contenedor de vídeo mientras que la **Web Audio API** (`AudioContext.decodeAudioData()`) decodifica el flujo de audio en memoria. Esto permite renderizar una **forma de onda de alta resolución en un Canvas 2D** sin necesidad de herramientas externas pesadas.

### 2. Motores de Transcripción Soportados
- **Motor Web Speech (Navegador):** Emplea el motor de reconocimiento de voz nativo del sistema operativo a través de la Web Speech API. Ideal para dictado de apuntes en vivo y sin consumir recursos ni requerir instalación de servidores.
- **Motor Local Whisper (`faster-whisper`):** Basado en el backend CTranslate2 en C++, permite ejecutar modelos Whisper (`tiny`, `base`, `small`, `medium`, `large-v3`) con cuantización de 8 bits (INT8) en CPU o 16 bits (FP16) en GPU NVIDIA CUDA, logrando una velocidad hasta 4 veces superior al Whisper estándar de PyTorch.
- **OpenAI Whisper Cloud API:** Conexión directa opcional mediante API key para transcribir grabaciones extensas con precisión máxima en la nube.

### 3. Sincronización Bidireccional Texto-Audio
Cada segmento de transcripción almacena sus marcas temporales exactas (`start` y `end`). Mientras el vídeo se reproduce, un observador de tiempo detecta el segundo actual, activa el estilo brillante del bloque correspondiente y hace **scroll automático**. Además, al hacer clic en cualquier párrafo, el reproductor de vídeo salta inmediatamente a ese segundo exacto.

### 4. Transformador de Contexto para ChatGPT
Uno de los mayores problemas al estudiar con vídeos es que transcribir el texto no basta: hay que darle instrucciones al LLM. ScribeFlow incluye un pipeline de prompts que envuelve automáticamente la transcripción con instrucciones optimizadas para:
- **Resumen Ejecutivo y Conceptos Clave.**
- **Resolución Paso a Paso de Tutoriales o Prácticas.**
- **Generación de Preguntas de Examen y Tarjetas de Memoria (Flashcards).**

---

## 🛠️ Tecnologías Utilizadas

| Capa / Módulo | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Estructura** | **HTML5 Semántico** | Marcado accesible, modular y optimizado para SEO con etiquetas semánticas (`<video>`, `<canvas>`, `<main>`, `<section>`). |
| **Estilos y Diseño** | **Vanilla CSS3** | Sistema de diseño oscuro moderno con variables CSS, *Glassmorphism* (`backdrop-filter: blur`), gradientes reactivos y diseño 100% responsivo sin dependencias de frameworks externos. |
| **Lógica Frontend** | **JavaScript (ES6+)** | Arquitectura reactiva sin framework, gestión de eventos asíncronos y sincronización de estado en tiempo real. |
| **Audio y Ondas** | **Web Audio API & Canvas 2D** | `AudioContext`, `AnalyserNode` para medidor VU de decibelios en vivo y cálculo de picos de amplitud para el waveform. |
| **Voz en Tiempo Real**| **Web Speech API** | `SpeechRecognition` / `webkitSpeechRecognition` para dictado continuo con buffers intermedios y finales. |
| **Motor AI Offline** | **Python & faster-whisper** | Backend CTranslate2 con inferencia cuantizada INT8/FP16 para Whisper de OpenAI (`scribeflow_cli.py`). |
| **Despliegue Web** | **GitHub Pages & Actions** | Flujo de integración continua (`.github/workflows/deploy.yml`) que publica la web automáticamente al hacer push a la rama `main`. |

---

## 🚀 Guía de Inicio Rápido

### Usar en el Navegador (Local o Web)
1. Abre [`index.html`](file:///C:/Users/titoc/.gemini/antigravity-ide/scratch/buzz-web-studio/index.html) en tu navegador (Google Chrome, Edge, Firefox, Brave).
2. Haz clic en **"Cargar Demo Clase"** para explorar la interfaz con una clase universitaria precargada.
3. Arrastra tu propio vídeo `.mp4` o audio `.mp3`.
4. Elige tu prompt deseado y pulsa **"⚡ Copiar para ChatGPT"** o haz clic en **"Descargar .TXT"**.

### (Opcional) Transcripción Offline con Python
Si prefieres procesar un vídeo largo directamente en tu terminal:

```bash
# 1. Instalar la librería rápida de Whisper
pip install faster-whisper

# 2. Transcribir cualquier vídeo o audio:
python scribeflow_cli.py --file "mi_clase.mp4" --model base --language es
```
Esto creará automáticamente el archivo `mi_clase_para_chatgpt.txt` listo para usar.

---

## ⌨️ Atajos de Teclado

- **Espacio**: Reproducir / Pausar el vídeo o audio
- **Alt + ←**: Retroceder 5 segundos
- **Alt + →**: Avanzar 5 segundos
- **Ctrl + F**: Buscar términos en la transcripción
- **Escape**: Salir del modo presentación
