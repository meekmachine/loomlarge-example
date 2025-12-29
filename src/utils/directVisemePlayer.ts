/**
 * Direct Viseme Player
 * Plays viseme animations directly through the engine, one transition at a time.
 * Waits for each transition promise to resolve before scheduling the next.
 * This gives precise control over blending and timing.
 */

import { LoomLargeThree } from 'loomlarge';
import { phonemeExtractor } from '../latticework/lipsync/PhonemeExtractor';
import { visemeMapper } from '../latticework/lipsync/VisemeMapper';

export interface VisemePlayerConfig {
  /** Overall intensity (0-1), default 0.8 */
  intensity: number;
  /** Speech rate multiplier, default 1.0 */
  speechRate: number;
  /** Jaw activation scale (0-1), default 1.0 */
  jawScale: number;
  /** Blend overlap ratio - how much the previous viseme lingers (0-1), default 0.5 */
  blendOverlap: number;
  /** Minimum transition duration in ms, default 40 */
  minTransitionMs: number;
}

const DEFAULT_CONFIG: VisemePlayerConfig = {
  intensity: 0.8,
  speechRate: 1.0,
  jawScale: 1.0,
  blendOverlap: 0.5,
  minTransitionMs: 40,
};

interface VisemeEvent {
  arkitIndex: number;
  durationMs: number;
  isSilence: boolean;
}

/**
 * Direct Viseme Player class
 * Plays text as viseme animations with smooth blending
 */
export class DirectVisemePlayer {
  private engine: LoomLargeThree;
  private config: VisemePlayerConfig;
  private isPlaying = false;
  private shouldStop = false;
  private currentVisemeIndex = -1;

  constructor(engine: LoomLargeThree, config: Partial<VisemePlayerConfig> = {}) {
    this.engine = engine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VisemePlayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Play text as viseme animation
   * Returns a promise that resolves when playback completes
   */
  async playText(text: string): Promise<void> {
    if (this.isPlaying) {
      this.stop();
      // Wait a tick for cleanup
      await new Promise(r => setTimeout(r, 10));
    }

    this.isPlaying = true;
    this.shouldStop = false;

    try {
      // Extract phonemes from text
      const phonemes = phonemeExtractor.extractPhonemes(text);

      // Convert to viseme events
      const visemeEvents = this.phonemesToVisemeEvents(phonemes);

      // Play each viseme sequentially with blending
      await this.playVisemeSequence(visemeEvents);

      // Return to neutral
      await this.returnToNeutral();
    } finally {
      this.isPlaying = false;
      this.currentVisemeIndex = -1;
    }
  }

  /**
   * Stop current playback
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if currently playing
   */
  get playing(): boolean {
    return this.isPlaying;
  }

  /**
   * Convert phonemes to viseme events with timing
   */
  private phonemesToVisemeEvents(phonemes: string[]): VisemeEvent[] {
    const events: VisemeEvent[] = [];

    for (const phoneme of phonemes) {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      const durationMs = visemeMapper.adjustDuration(mapping.duration, this.config.speechRate);
      // mapping.viseme is now already the ARKit index (0-14)
      const isSilence = mapping.viseme === 11; // B_M_P (closed mouth)

      events.push({
        arkitIndex: mapping.viseme,
        durationMs,
        isSilence,
      });
    }

    return events;
  }

  /**
   * Play a sequence of viseme events with smooth blending
   */
  private async playVisemeSequence(events: VisemeEvent[]): Promise<void> {
    const { intensity, jawScale, blendOverlap, minTransitionMs } = this.config;

    for (let i = 0; i < events.length; i++) {
      if (this.shouldStop) break;

      const event = events[i];
      const nextEvent = events[i + 1];

      // Skip silence visemes but still wait for the pause duration
      if (event.isSilence) {
        // During silence, fade out the current viseme
        if (this.currentVisemeIndex >= 0) {
          const fadeOutMs = Math.max(minTransitionMs, event.durationMs * 0.5);
          const handle = this.engine.transitionViseme(this.currentVisemeIndex, 0, fadeOutMs, jawScale);
          await handle.promise;
          this.currentVisemeIndex = -1;
        }
        // Wait for remaining pause duration
        const remainingPause = event.durationMs * 0.5;
        if (remainingPause > 0) {
          await this.delay(remainingPause);
        }
        continue;
      }

      // Calculate transition timing
      // The transition to peak should take a portion of the phoneme duration
      const transitionInMs = Math.max(minTransitionMs, event.durationMs * 0.3);

      // If same viseme as before, just hold (don't re-transition)
      if (event.arkitIndex === this.currentVisemeIndex) {
        // Just wait for the hold duration
        const holdMs = event.durationMs - transitionInMs;
        if (holdMs > 0) {
          await this.delay(holdMs);
        }
        continue;
      }

      // Blend out previous viseme while blending in new one
      // Start the new viseme transition
      const transitionHandle = this.engine.transitionViseme(
        event.arkitIndex,
        intensity,
        transitionInMs,
        jawScale
      );

      // If there was a previous viseme, blend it out with overlap
      if (this.currentVisemeIndex >= 0 && this.currentVisemeIndex !== event.arkitIndex) {
        const fadeOutMs = transitionInMs * (1 + blendOverlap);
        // Don't await - let it run in parallel for smooth blending
        this.engine.transitionViseme(this.currentVisemeIndex, 0, fadeOutMs, jawScale);
      }

      // Update current viseme
      this.currentVisemeIndex = event.arkitIndex;

      // Wait for the transition to complete
      await transitionHandle.promise;

      // Calculate hold time (time spent at peak intensity)
      // If next phoneme exists, we might cut the hold short for anticipation
      let holdMs = event.durationMs - transitionInMs;

      if (nextEvent && !nextEvent.isSilence) {
        // Anticipate the next viseme - reduce hold time
        const anticipation = Math.min(holdMs * 0.3, transitionInMs * blendOverlap);
        holdMs -= anticipation;
      }

      if (holdMs > 0) {
        await this.delay(holdMs);
      }
    }
  }

  /**
   * Return all visemes to neutral (0)
   */
  private async returnToNeutral(): Promise<void> {
    if (this.currentVisemeIndex >= 0) {
      const fadeOutMs = Math.max(this.config.minTransitionMs, 60);
      const handle = this.engine.transitionViseme(this.currentVisemeIndex, 0, fadeOutMs, this.config.jawScale);
      await handle.promise;
      this.currentVisemeIndex = -1;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a direct viseme player instance
 */
export function createDirectVisemePlayer(
  engine: LoomLargeThree,
  config?: Partial<VisemePlayerConfig>
): DirectVisemePlayer {
  return new DirectVisemePlayer(engine, config);
}
