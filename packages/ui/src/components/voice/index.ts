/**
 * VANNI Design System — Voice & Conversational Components
 * Serious enterprise call UX: authentic call transcripts, real voice states, zero fake equalizers.
 */

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'transferred' | 'ended';

export interface VoiceActivityIndicatorProps {
  state: VoiceState;
  label?: string;
}

export function renderVoiceActivityIndicator(props: VoiceActivityIndicatorProps): string {
  let dotColor = 'var(--vanni-text-disabled)';
  let stateLabel = props.label || props.state.toUpperCase();
  let showPulse = false;

  switch (props.state) {
    case 'listening':
      dotColor = 'var(--vanni-accent)';
      showPulse = true;
      break;
    case 'thinking':
      dotColor = 'var(--vanni-warning)';
      showPulse = true;
      break;
    case 'speaking':
      dotColor = 'var(--vanni-success)';
      showPulse = true;
      break;
    case 'interrupted':
      dotColor = 'var(--vanni-danger)';
      break;
    case 'transferred':
      dotColor = 'var(--vanni-info)';
      break;
    case 'ended':
      dotColor = 'var(--vanni-text-muted)';
      break;
  }

  return `
<div class="vanni-voice-indicator" role="status" aria-live="polite">
  <span style="position: relative; display: flex; align-items: center; justify-content: center; width: 10px; height: 10px;">
    ${showPulse ? `<span class="vanni-voice-pulse" style="background-color: ${dotColor};"></span>` : ''}
    <span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${dotColor};"></span>
  </span>
  <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--vanni-text-secondary);">${stateLabel}</span>
</div>
  `.trim();
}

export interface TranscriptLineProps {
  speaker: 'AI' | 'CUSTOMER' | 'HUMAN_AGENT';
  speakerName?: string;
  timeOffset: string; // e.g. "00:04"
  text: string;
  isKannada?: boolean;
}

export function renderTranscriptLine(props: TranscriptLineProps): string {
  const isAi = props.speaker === 'AI';
  const speakerClass = isAi ? 'vanni-transcript-speaker-ai' : 'vanni-transcript-speaker-user';
  const kannadaClass = props.isKannada ? 'vanni-kannada' : '';

  return `
<div class="vanni-transcript-line">
  <div class="vanni-transcript-meta">
    <span class="vanni-transcript-speaker ${speakerClass}">${props.speakerName || props.speaker}</span>
    <span class="vanni-transcript-time">${props.timeOffset}</span>
  </div>
  <div class="vanni-transcript-content ${kannadaClass}">
    ${props.text}
  </div>
</div>
  `.trim();
}

export interface AudioWaveformProps {
  isActive: boolean;
  bars?: number;
}

export function renderAudioWaveform(props: AudioWaveformProps): string {
  const barCount = props.bars || 16;
  const barsHtml = Array.from({ length: barCount }).map((_, i) => {
    const height = props.isActive ? `${Math.max(4, (i % 5 + 1) * 4)}px` : '4px';
    return `<div style="width: 3px; height: ${height}; background: var(--vanni-accent); border-radius: 1px; transition: height 150ms ease;"></div>`;
  }).join('');

  return `
<div class="vanni-audio-waveform" style="display: inline-flex; align-items: center; gap: 3px; height: 24px; padding: 0 8px; background: var(--vanni-surface-subdued); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-sm);" aria-hidden="true">
  ${barsHtml}
</div>
  `.trim();
}

export interface ToolExecutionStatusProps {
  toolName: string;
  status: 'invoking' | 'completed' | 'failed';
  executionTimeMs?: number;
  outputSummary?: string;
}

export function renderToolExecutionStatus(props: ToolExecutionStatusProps): string {
  const statusColor = props.status === 'completed' ? 'var(--vanni-success)' : props.status === 'failed' ? 'var(--vanni-danger)' : 'var(--vanni-warning)';
  return `
<div style="background: var(--vanni-surface-subdued); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-md); padding: 8px 12px; margin: 6px 0; font-size: 12px;">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 6px;">
      <span style="font-family: var(--vanni-font-mono); font-weight: 600; color: var(--vanni-text-primary);">${props.toolName}</span>
      <span style="font-size: 10px; color: ${statusColor}; font-weight: 600; text-transform: uppercase;">[${props.status}]</span>
    </div>
    ${props.executionTimeMs !== undefined ? `<span style="font-family: var(--vanni-font-mono); font-size: 11px; color: var(--vanni-text-muted);">${props.executionTimeMs}ms</span>` : ''}
  </div>
  ${props.outputSummary ? `<div style="margin-top: 4px; color: var(--vanni-text-secondary); font-family: var(--vanni-font-mono); font-size: 11px;">${props.outputSummary}</div>` : ''}
</div>
  `.trim();
}
