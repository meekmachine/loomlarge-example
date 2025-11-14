/**
 * LipSync Service
 * Provides lip-sync animation based on TTS engine output
 * Supports both WebSpeech and SAPI engines
 */

import type {
  LipSyncConfig,
  LipSyncState,
  LipSyncCallbacks,
  VisemeEvent,
  VisemeSnippet,
  AnimationCurve,
  SAPIViseme,
  VisemeID,
} from './types';
import { visemeMapper } from './VisemeMapper';
import { phonemeExtractor } from './PhonemeExtractor';

export class LipSyncService {
  private config: Required<LipSyncConfig>;
  private state: LipSyncState;
  private callbacks: LipSyncCallbacks;
  private timelineTimeouts: number[] = [];
  private currentVisemeTimeout: number | null = null;

  constructor(config: LipSyncConfig = {}, callbacks: LipSyncCallbacks = {}) {
    this.config = {
      engine: config.engine || 'webSpeech',
      onsetIntensity: config.onsetIntensity ?? 90,
      holdMs: config.holdMs ?? 140,
      speechRate: config.speechRate ?? 1.0,
    };

    this.callbacks = callbacks;

    this.state = {
      status: 'idle',
    };
  }

  /**
   * Handle a single viseme event (WebSpeech mode)
   * Triggers viseme with hold duration
   */
  public handleViseme(visemeId: VisemeID, intensity?: number): void {
    const finalIntensity = intensity ?? this.config.onsetIntensity;

    // Clear any existing viseme
    if (this.currentVisemeTimeout) {
      clearTimeout(this.currentVisemeTimeout);
    }

    // Start viseme
    this.setState({ status: 'speaking', currentViseme: visemeId, intensity: finalIntensity });
    this.callbacks.onVisemeStart?.(visemeId, finalIntensity);

    // Schedule viseme end
    this.currentVisemeTimeout = window.setTimeout(() => {
      this.setState({ status: 'idle', currentViseme: undefined, intensity: 0 });
      this.callbacks.onVisemeEnd?.(visemeId);
    }, this.config.holdMs);
  }

  /**
   * Handle SAPI viseme timeline
   * Builds complete animation snippet with all visemes
   */
  public handleSapiVisemes(visemes: SAPIViseme[]): VisemeSnippet {
    const snippet = this.buildVisemeSnippet(visemes, this.config.onsetIntensity, this.config.speechRate);

    // Execute timeline
    this.executeVisemeTimeline(visemes);

    return snippet;
  }

  /**
   * Process text and extract viseme timeline (WebSpeech fallback)
   * Uses phoneme extraction + viseme mapping
   */
  public extractVisemeTimeline(text: string): VisemeEvent[] {
    const phonemes = phonemeExtractor.extractPhonemes(text);
    const visemeEvents: VisemeEvent[] = [];
    let offsetMs = 0;

    for (const phoneme of phonemes) {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      const durationMs = visemeMapper.adjustDuration(mapping.duration, this.config.speechRate);

      visemeEvents.push({
        visemeId: mapping.viseme,
        offsetMs,
        durationMs,
      });

      offsetMs += durationMs;
    }

    return visemeEvents;
  }

  /**
   * Execute a viseme timeline
   * Schedules all viseme events with precise timing
   */
  private executeVisemeTimeline(visemes: SAPIViseme[]): void {
    this.clearTimeline();
    this.callbacks.onSpeechStart?.();

    for (const viseme of visemes) {
      const offsetMs = viseme.offset ?? viseme.audioPosition ?? 0;
      const durationMs = viseme.duration;

      // Schedule viseme start
      const timeout = window.setTimeout(() => {
        this.setState({
          status: 'speaking',
          currentViseme: viseme.number,
          intensity: this.config.onsetIntensity,
        });
        this.callbacks.onVisemeStart?.(viseme.number, this.config.onsetIntensity);

        // Schedule viseme end
        const endTimeout = window.setTimeout(() => {
          this.callbacks.onVisemeEnd?.(viseme.number);
        }, durationMs);

        this.timelineTimeouts.push(endTimeout);
      }, offsetMs / this.config.speechRate);

      this.timelineTimeouts.push(timeout);
    }

    // Schedule speech end
    if (visemes.length > 0) {
      const lastViseme = visemes[visemes.length - 1];
      const totalDuration = (lastViseme.offset ?? lastViseme.audioPosition ?? 0) + lastViseme.duration;
      const endTimeout = window.setTimeout(() => {
        this.setState({ status: 'idle', currentViseme: undefined, intensity: 0 });
        this.callbacks.onSpeechEnd?.();
      }, totalDuration / this.config.speechRate);

      this.timelineTimeouts.push(endTimeout);
    }
  }

  /**
   * Build viseme animation snippet from SAPI viseme array
   * Creates curves for all 22 viseme IDs (0-21)
   */
  private buildVisemeSnippet(
    visemes: SAPIViseme[],
    onsetIntensity: number,
    speechRate: number
  ): VisemeSnippet {
    const curves: Record<VisemeID, AnimationCurve[]> = {};

    // Initialize all viseme curves to silence
    for (let i = 0; i <= 21; i++) {
      curves[i] = [];
    }

    // Build curves for each viseme
    let maxTime = 0;

    for (const viseme of visemes) {
      const visemeId = viseme.number;
      const offsetMs = viseme.offset ?? viseme.audioPosition ?? 0;
      const durationMs = viseme.duration;

      const startTime = offsetMs / 1000 / speechRate;
      const holdTime = startTime + (durationMs * 0.9) / 1000 / speechRate; // 90% hold
      const endTime = startTime + durationMs / 1000 / speechRate;

      if (!curves[visemeId]) {
        curves[visemeId] = [];
      }

      // Add keyframes: onset -> hold -> release
      curves[visemeId].push(
        { time: startTime, intensity: 0 },
        { time: startTime + 0.01, intensity: onsetIntensity },
        { time: holdTime, intensity: onsetIntensity },
        { time: endTime, intensity: 0 }
      );

      maxTime = Math.max(maxTime, endTime);
    }

    // Ensure all curves have at least start and end points
    for (let i = 0; i <= 21; i++) {
      if (curves[i].length === 0) {
        curves[i] = [
          { time: 0, intensity: 0 },
          { time: maxTime, intensity: 0 },
        ];
      }
    }

    const snippet: VisemeSnippet = {
      name: `lipsync_${Date.now()}`,
      curves,
      maxTime,
      loop: false,
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
    };

    return snippet;
  }

  /**
   * Stop current lip-sync and return to neutral
   */
  public stop(): void {
    this.clearTimeline();

    if (this.currentVisemeTimeout) {
      clearTimeout(this.currentVisemeTimeout);
      this.currentVisemeTimeout = null;
    }

    // Return to neutral
    if (this.state.currentViseme !== undefined) {
      this.callbacks.onVisemeEnd?.(this.state.currentViseme);
    }

    this.setState({ status: 'stopped', currentViseme: undefined, intensity: 0 });
    this.callbacks.onSpeechEnd?.();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LipSyncConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current state
   */
  public getState(): LipSyncState {
    return { ...this.state };
  }

  /**
   * Clear all scheduled timeouts
   */
  private clearTimeline(): void {
    for (const timeout of this.timelineTimeouts) {
      clearTimeout(timeout);
    }
    this.timelineTimeouts = [];
  }

  /**
   * Update state and notify listeners
   */
  private setState(updates: Partial<LipSyncState>): void {
    this.state = {
      ...this.state,
      ...updates,
    };
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
    this.clearTimeline();
  }
}

/**
 * Factory function to create a LipSync service
 */
export function createLipSyncService(
  config?: LipSyncConfig,
  callbacks?: LipSyncCallbacks
): LipSyncService {
  return new LipSyncService(config, callbacks);
}
