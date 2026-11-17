/**
 * VANNI Voice Client — High-Performance Browser Web Audio & WebSocket Duplex Streaming Client
 * Connects directly to Fastify /ws/audio-stream.
 * 
 * Capabilities:
 * - 16kHz 16-bit Mono Int16 PCM mic streaming
 * - Downsampling from arbitrary browser hardware sample rates (44.1kHz, 48kHz -> 16kHz)
 * - Seamless gapless audio buffer queuing for agent speech playback
 * - Sub-50ms instant barge-in client cutoff on interruption
 * - Real-time acoustic energy metering (RMS) for visual voice orbs
 */

export class VanniVoiceClient {
  constructor(options = {}) {
    this.options = {
      serverUrl: options.serverUrl || this._getDefaultWsUrl(),
      tenant: options.tenant || 'real_estate',
      sampleRate: 16000,
      bufferSize: 2048,
      ...options,
    };

    this.ws = null;
    this.audioCtx = null;
    this.mediaStream = null;
    this.processorNode = null;
    this.sourceNode = null;
    this.analyserNode = null;

    this.isPlaying = false;
    this.activeSources = [];
    this.nextPlayTime = 0;
    this.state = 'IDLE'; // IDLE | CONNECTING | LISTENING | THINKING | SPEAKING | INTERRUPTED
    
    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onLatency = options.onLatency || (() => {});
    this.onAudioLevel = options.onAudioLevel || (() => {});
    this.onError = options.onError || (() => {});
    this.onToolExecuted = options.onToolExecuted || (() => {});
  }

  _getDefaultWsUrl() {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const host = typeof window !== 'undefined' && window.location.host ? window.location.host : 'localhost:4000';
    return `${isHttps ? 'wss' : 'ws'}://${host}/ws/audio-stream`;
  }

  setState(newState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange(this.state);
    }
  }

  async start(tenantOverride) {
    if (this.state !== 'IDLE') {
      await this.stop();
    }

    const tenant = tenantOverride || this.options.tenant;
    this.setState('CONNECTING');

    try {
      // 1. Initialize AudioContext
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // 2. Request Microphone Access with Echo Cancellation
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 3. Connect WebSocket
      const wsUrl = new URL(this.options.serverUrl);
      wsUrl.searchParams.set('tenant', tenant);
      wsUrl.searchParams.set('source', 'web');

      this.ws = new WebSocket(wsUrl.toString());
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.setState('LISTENING');
        // Trigger initial greeting turn
        this.ws.send(JSON.stringify({ event: 'start_call' }));
        this._setupAudioCapture();
      };

      this.ws.onmessage = async (event) => {
        await this._handleServerMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.error('[VanniVoiceClient WS Error]', err);
        this.onError(new Error('WebSocket connection error'));
        this.stop();
      };

      this.ws.onclose = () => {
        if (this.state !== 'IDLE') {
          this.setState('IDLE');
        }
      };

    } catch (err) {
      console.error('[VanniVoiceClient Start Error]', err);
      this.onError(err);
      await this.stop();
    }
  }

  _setupAudioCapture() {
    if (!this.audioCtx || !this.mediaStream) return;

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Use ScriptProcessorNode for cross-browser downsampling to 16kHz Int16 PCM
    const inputSampleRate = this.audioCtx.sampleRate;
    const targetSampleRate = this.options.sampleRate; // 16000
    const bufferSize = this.options.bufferSize; // 2048

    this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);

    this.processorNode.onaudioprocess = (e) => {
      if (this.state === 'IDLE' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Measure RMS Volume for UI orb reactivity
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      this.onAudioLevel({ speaker: 'USER', level: Math.min(1.0, rms * 5) });

      // Downsample and convert Float32 [-1.0, 1.0] -> Int16 PCM
      const downsampledInt16 = this._downsampleAndConvertToInt16(
        inputData,
        inputSampleRate,
        targetSampleRate
      );

      if (downsampledInt16 && downsampledInt16.length > 0) {
        this.ws.send(downsampledInt16.buffer);
      }
    };

    this.sourceNode.connect(this.analyserNode);
    this.sourceNode.connect(this.processorNode);
    // Connect to destination via zero-gain to keep audio clock running without local feedback
    const silentGain = this.audioCtx.createGain();
    silentGain.gain.value = 0;
    this.processorNode.connect(silentGain);
    silentGain.connect(this.audioCtx.destination);
  }

  _downsampleAndConvertToInt16(inputBuffer, inputSampleRate, outputSampleRate) {
    if (inputSampleRate === outputSampleRate) {
      const output = new Int16Array(inputBuffer.length);
      for (let i = 0; i < inputBuffer.length; i++) {
        const s = Math.max(-1, Math.min(1, inputBuffer[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return output;
    }

    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(inputBuffer.length / sampleRateRatio);
    const result = new Int16Array(newLength);

    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputBuffer.length; i++) {
        accum += inputBuffer[i];
        count++;
      }
      const avg = count > 0 ? accum / count : 0;
      const s = Math.max(-1, Math.min(1, avg));
      result[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }

  async _handleServerMessage(rawData) {
    if (typeof rawData !== 'string') return;

    try {
      const msg = JSON.parse(rawData);

      switch (msg.type) {
        case 'CALL_STARTED':
          this.setState('LISTENING');
          if (msg.greeting) {
            this.onTranscript({ speaker: 'AGENT', text: msg.greeting });
          }
          break;

        case 'TRANSCRIPT':
          if (msg.speaker === 'USER') {
            this.setState('THINKING');
          }
          this.onTranscript({ speaker: msg.speaker, text: msg.text });
          break;

        case 'LATENCY':
          this.onLatency(msg);
          break;

        case 'AUDIO_CHUNK':
        case 'FILLER_CHUNK':
          if (msg.audio) {
            this.setState('SPEAKING');
            await this._queueAudioChunk(msg.audio);
          }
          break;

        case 'BARGE_IN_INTERRUPT':
          this._interruptPlayback();
          this.setState('INTERRUPTED');
          setTimeout(() => {
            if (this.state === 'INTERRUPTED') {
              this.setState('LISTENING');
            }
          }, 150);
          break;

        case 'TOOL_EXECUTED':
          this.onToolExecuted(msg);
          break;

        case 'ESCALATION_TRIGGERED':
          console.warn('[Vanni Escalation Triggered]', msg.escalation);
          break;
      }
    } catch (err) {
      console.warn('[VanniVoiceClient parse msg error]', err);
    }
  }

  async _queueAudioChunk(base64Audio) {
    if (!this.audioCtx) return;

    try {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data asynchronously
      const audioBuffer = await this.audioCtx.decodeAudioData(bytes.buffer.slice(0));

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Schedule gapless playback
      const currentTime = this.audioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      source.connect(this.audioCtx.destination);
      source.start(startTime);

      this.activeSources.push(source);
      this.isPlaying = true;

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0 && this.audioCtx && this.audioCtx.currentTime >= this.nextPlayTime - 0.05) {
          this.isPlaying = false;
          this.setState('LISTENING');
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ event: 'playback_finished' }));
          }
        }
      };

    } catch (err) {
      // Decode audio failed or invalid chunk
      console.warn('[Audio Decode Warning]', err);
    }
  }

  _interruptPlayback() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (_) {}
    }
    this.activeSources = [];
    this.isPlaying = false;
    if (this.audioCtx) {
      this.nextPlayTime = this.audioCtx.currentTime;
    }
  }

  async stop() {
    this._interruptPlayback();

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        await this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }

    this.setState('IDLE');
  }

  sendTextUtterance(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && text.trim()) {
      this.setState('THINKING');
      this.ws.send(JSON.stringify({ event: 'user_text_turn', text: text.trim() }));
    }
  }
}

if (typeof window !== 'undefined') {
  window.VanniVoiceClient = VanniVoiceClient;
}
