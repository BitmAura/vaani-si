/**
 * VANNI Voice Orb & Studio Playground
 * Renders an interactive WebGL/Canvas audio visualizer orb,
 * live transcript, latency metrics, and tenant preset selector.
 */

export class VanniVoiceOrb {
  constructor(containerElement, options = {}) {
    this.container = typeof containerElement === 'string' 
      ? document.querySelector(containerElement) 
      : containerElement;

    if (!this.container) {
      throw new Error('[VanniVoiceOrb] Invalid container element');
    }

    this.options = {
      defaultTenant: 'real_estate',
      ...options,
    };

    this.client = null;
    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.currentLevel = 0;
    this.targetLevel = 0;
    this.callStartTime = 0;
    this.timerInterval = null;
    this.transcripts = [];

    this._initDom();
    this._initCanvas();
  }

  _initDom() {
    this.container.innerHTML = `
<div class="vanni-orb-card" style="
  background: radial-gradient(120% 120% at 50% 10%, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 80px rgba(99, 102, 241, 0.15);
  max-width: 680px;
  margin: 0 auto;
  color: #F8FAFC;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
  overflow: hidden;
">
  <!-- Glowing ambient backdrop -->
  <div style="position: absolute; top: -100px; left: 50%; transform: translateX(-50%); width: 350px; height: 350px; background: radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%); filter: blur(40px); pointer-events: none;"></div>

  <!-- Header & Preset Selector -->
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; position: relative; z-index: 2;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, #6366F1, #8B5CF6); font-size: 16px;">🎙️</span>
      <div>
        <div style="font-weight: 700; font-size: 16px; letter-spacing: -0.01em;">Live Voice AI Playground</div>
        <div style="font-size: 12px; color: #94A3B8;">Sub-500ms Duplex Speech in Kannada, Hindi & English</div>
      </div>
    </div>
    
    <!-- Tenant Preset Selector -->
    <select id="vanni-tenant-select" style="
      background: rgba(15, 23, 42, 0.8);
      color: #F1F5F9;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      outline: none;
    ">
      <option value="real_estate">🏢 Ballari Plots & Layouts (Kannada)</option>
      <option value="dental">🦷 Dr. Prashant Dental Clinic (Kanglish)</option>
      <option value="hospital">🏥 City Multi-Specialty Hospital</option>
      <option value="inception">🤖 Sahana (Executive AI Recruiter)</option>
    </select>
  </div>

  <!-- Visual Orb Canvas -->
  <div style="position: relative; height: 220px; display: flex; align-items: center; justify-content: center; margin: 10px 0;">
    <canvas id="vanni-orb-canvas" width="400" height="400" style="width: 200px; height: 200px; cursor: pointer;"></canvas>
    
    <!-- Center Action Pill -->
    <div id="vanni-orb-overlay" style="
      position: absolute;
      bottom: 12px;
      padding: 6px 14px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: #E2E8F0;
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    ">
      <span id="vanni-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #6366F1;"></span>
      <span id="vanni-status-text">Click Orb to Talk</span>
    </div>
  </div>

  <!-- Live Latency & Call Timer HUD -->
  <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: rgba(15, 23, 42, 0.6); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.06); margin-bottom: 20px; font-size: 12px;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="color: #10B981; font-weight: 600;">⚡ Real-time Telemetry:</span>
      <span id="vanni-latency-hud" style="color: #94A3B8; font-family: monospace;">Ready to connect</span>
    </div>
    <div id="vanni-timer-hud" style="color: #94A3B8; font-family: monospace; font-weight: 600;">00:00</div>
  </div>

  <!-- Live Transcript Scroll View -->
  <div id="vanni-transcript-box" style="
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px;
    height: 140px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    line-height: 1.5;
  ">
    <div style="color: #64748B; text-align: center; margin-top: 45px; font-style: italic;">
      Click the glowing orb to start speaking into your microphone in Kannada or English...
    </div>
  </div>

  <!-- Control Buttons Footer -->
  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 20px;">
    <div style="font-size: 11px; color: #64748B;">
      Requires Chrome / Edge / Safari with Microphone Permission
    </div>
    <button id="vanni-call-btn" style="
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      color: #FFFFFF;
      border: none;
      border-radius: 10px;
      padding: 10px 24px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      transition: all 0.2s ease;
    ">
      <span>🎙️ Start Call</span>
    </button>
  </div>
</div>
    `.trim();

    this.canvas = this.container.querySelector('#vanni-orb-canvas');
    this.callBtn = this.container.querySelector('#vanni-call-btn');
    this.statusText = this.container.querySelector('#vanni-status-text');
    this.statusDot = this.container.querySelector('#vanni-status-dot');
    this.latencyHud = this.container.querySelector('#vanni-latency-hud');
    this.timerHud = this.container.querySelector('#vanni-timer-hud');
    this.transcriptBox = this.container.querySelector('#vanni-transcript-box');
    this.tenantSelect = this.container.querySelector('#vanni-tenant-select');

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('click', () => this.toggleCall());
    this.callBtn.addEventListener('click', () => this.toggleCall());
    this.tenantSelect.addEventListener('change', () => {
      if (this.client && this.client.state !== 'IDLE') {
        this.toggleCall(); // restart on tenant change
      }
    });
  }

  _initCanvas() {
    this.ctx = this.canvas.getContext('2d');
    let angle = 0;

    const render = () => {
      const width = this.canvas.width;
      const height = this.canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      this.ctx.clearRect(0, 0, width, height);

      // Smooth dampening towards target level
      this.currentLevel += (this.targetLevel - this.currentLevel) * 0.15;
      angle += 0.03 + this.currentLevel * 0.05;

      const state = this.client ? this.client.state : 'IDLE';

      // Base radius calculation
      const baseRadius = 70 + this.currentLevel * 45;

      // Color themes by state
      let color1 = 'rgba(99, 102, 241, 0.8)';  // Indigo
      let color2 = 'rgba(168, 85, 247, 0.6)';  // Purple
      let glowColor = 'rgba(99, 102, 241, 0.4)';

      if (state === 'LISTENING') {
        color1 = 'rgba(16, 185, 129, 0.9)';   // Emerald
        color2 = 'rgba(6, 182, 212, 0.7)';    // Cyan
        glowColor = 'rgba(16, 185, 129, 0.4)';
      } else if (state === 'THINKING') {
        color1 = 'rgba(245, 158, 11, 0.9)';   // Amber
        color2 = 'rgba(239, 68, 68, 0.7)';    // Red
        glowColor = 'rgba(245, 158, 11, 0.4)';
      } else if (state === 'SPEAKING') {
        color1 = 'rgba(14, 165, 233, 0.95)';  // Sky Blue
        color2 = 'rgba(99, 102, 241, 0.8)';   // Indigo
        glowColor = 'rgba(14, 165, 233, 0.5)';
      } else if (state === 'INTERRUPTED') {
        color1 = 'rgba(239, 68, 68, 1.0)';    // Red alert
        color2 = 'rgba(244, 63, 94, 0.8)';
        glowColor = 'rgba(239, 68, 68, 0.6)';
      }

      // Outer ambient glow
      const glowGrad = this.ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, baseRadius * 1.6);
      glowGrad.addColorStop(0, glowColor);
      glowGrad.addColorStop(1, 'transparent');
      this.ctx.fillStyle = glowGrad;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, baseRadius * 1.6, 0, Math.PI * 2);
      this.ctx.fill();

      // Fluid distorted organic orb mesh
      this.ctx.save();
      this.ctx.beginPath();
      const points = 36;
      for (let i = 0; i <= points; i++) {
        const theta = (i / points) * Math.PI * 2;
        const wave = Math.sin(theta * 4 + angle) * (6 + this.currentLevel * 20) +
                     Math.cos(theta * 6 - angle * 1.5) * (4 + this.currentLevel * 14);
        const r = baseRadius + wave;
        const x = centerX + Math.cos(theta) * r;
        const y = centerY + Math.sin(theta) * r;
        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.closePath();

      // Inner volumetric gradient
      const orbGrad = this.ctx.createRadialGradient(
        centerX - baseRadius * 0.3,
        centerY - baseRadius * 0.3,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius
      );
      orbGrad.addColorStop(0, '#FFFFFF');
      orbGrad.addColorStop(0.3, color1);
      orbGrad.addColorStop(1, color2);

      this.ctx.fillStyle = orbGrad;
      this.ctx.fill();
      this.ctx.restore();

      this.animId = requestAnimationFrame(render);
    };

    render();
  }

  async toggleCall() {
    if (!this.client || this.client.state === 'IDLE') {
      await this.startCall();
    } else {
      await this.endCall();
    }
  }

  async startCall() {
    const selectedTenant = this.tenantSelect.value;

    if (!window.VanniVoiceClient) {
      alert('VanniVoiceClient library not loaded. Check script imports.');
      return;
    }

    this.client = new window.VanniVoiceClient({
      tenant: selectedTenant,
      onStateChange: (state) => this._onStateChange(state),
      onTranscript: (t) => this._onTranscript(t),
      onLatency: (l) => this._onLatency(l),
      onAudioLevel: (lvl) => {
        this.targetLevel = lvl.level;
      },
      onError: (err) => {
        alert('Voice Client Error: ' + err.message);
        this.endCall();
      },
    });

    this.callBtn.innerHTML = '<span>⏳ Connecting...</span>';
    this.callBtn.style.background = '#475569';
    this.transcriptBox.innerHTML = '';
    this.transcripts = [];

    await this.client.start(selectedTenant);

    this.callStartTime = Date.now();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      this.timerHud.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  async endCall() {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.targetLevel = 0;
    this.callBtn.innerHTML = '<span>🎙️ Start Call</span>';
    this.callBtn.style.background = 'linear-gradient(135deg, #6366F1, #8B5CF6)';
    this.statusText.textContent = 'Click Orb to Talk';
    this.statusDot.style.background = '#6366F1';
    this.latencyHud.textContent = 'Call completed';
  }

  _onStateChange(state) {
    switch (state) {
      case 'CONNECTING':
        this.statusText.textContent = 'Connecting Audio Stream...';
        this.statusDot.style.background = '#F59E0B';
        break;
      case 'LISTENING':
        this.statusText.textContent = 'Listening (Speak freely)...';
        this.statusDot.style.background = '#10B981';
        this.callBtn.innerHTML = '<span>🔴 End Call</span>';
        this.callBtn.style.background = '#EF4444';
        break;
      case 'THINKING':
        this.statusText.textContent = 'Thinking (Sarvam + Groq)...';
        this.statusDot.style.background = '#F59E0B';
        break;
      case 'SPEAKING':
        this.statusText.textContent = 'Vaani Speaking...';
        this.statusDot.style.background = '#0EA5E9';
        break;
      case 'INTERRUPTED':
        this.statusText.textContent = 'Interrupted! Listening to you...';
        this.statusDot.style.background = '#EF4444';
        break;
      case 'IDLE':
        this.statusText.textContent = 'Click Orb to Talk';
        this.statusDot.style.background = '#6366F1';
        break;
    }
  }

  _onTranscript(turn) {
    const isUser = turn.speaker === 'USER';
    const bubble = document.createElement('div');
    bubble.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: ${isUser ? 'flex-end' : 'flex-start'};
      margin-bottom: 6px;
    `;

    const label = document.createElement('div');
    label.style.cssText = 'font-size: 11px; color: #94A3B8; margin-bottom: 2px; font-weight: 600;';
    label.textContent = isUser ? 'You (Caller)' : 'Vaani (AI Receptionist)';

    const content = document.createElement('div');
    content.style.cssText = `
      padding: 8px 12px;
      border-radius: 12px;
      background: ${isUser ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.8)'};
      border: 1px solid ${isUser ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
      color: #F8FAFC;
      max-width: 85%;
      word-break: break-word;
    `;
    content.textContent = turn.text;

    bubble.appendChild(label);
    bubble.appendChild(content);
    this.transcriptBox.appendChild(bubble);
    this.transcriptBox.scrollTop = this.transcriptBox.scrollHeight;
  }

  _onLatency(metrics) {
    this.latencyHud.textContent = `VAD: ${metrics.vadMs}ms | STT: ${metrics.sttMs}ms | LLM: ${metrics.llmMs}ms | TTS: ${metrics.ttsMs}ms | Total: ${metrics.totalMs}ms`;
  }
}

if (typeof window !== 'undefined') {
  window.VanniVoiceOrb = VanniVoiceOrb;
}
