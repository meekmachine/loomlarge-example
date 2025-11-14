/**
 * Prosodic Expression Service
 * Manages prosodic gestures during speech (brow raises, head nods)
 * Provides parallel control of brow and head animations with graceful fade-outs
 */

import type {
  ProsodicConfig,
  ProsodicState,
  ProsodicCallbacks,
  ProsodicChannel,
  AnimationSnippet,
  FadeStep,
} from './types';
import { DEFAULT_PROSODIC_CONFIG } from './types';

export class ProsodicService {
  private config: Required<ProsodicConfig>;
  private state: ProsodicState;
  private callbacks: ProsodicCallbacks;

  // Animation state
  private browSnippet: AnimationSnippet | null = null;
  private headSnippet: AnimationSnippet | null = null;

  // Pulse debouncing
  private lastPulseTime = 0;
  private pulseDebounceMs = 120;

  // Fade-out timers
  private fadeTimers: number[] = [];

  constructor(config: ProsodicConfig = {}, callbacks: ProsodicCallbacks = {}) {
    this.config = {
      ...DEFAULT_PROSODIC_CONFIG,
      ...config,
    };

    this.callbacks = callbacks;

    this.state = {
      browStatus: 'idle',
      headStatus: 'idle',
      browIntensity: 0,
      headIntensity: 0,
      isLooping: false,
    };
  }

  /**
   * Start talking - activate brow and head loops
   */
  public startTalking(): void {
    this.startBrow();
    this.startHead();
    this.state.isLooping = true;
  }

  /**
   * Stop talking - gracefully fade out animations
   */
  public stopTalking(fadeChannel: ProsodicChannel = 'both'): void {
    this.state.isLooping = false;

    switch (fadeChannel) {
      case 'brow':
        this.fadeOutBrow();
        break;
      case 'head':
        this.fadeOutHead();
        break;
      case 'both':
        this.fadeOutBrow();
        // Delay head fade slightly
        setTimeout(() => this.fadeOutHead(), 100);
        break;
    }
  }

  /**
   * Start brow raise loop
   */
  private startBrow(): void {
    if (this.state.browStatus === 'active') return;

    // Load snippet if needed (from external animation manager or storage)
    this.browSnippet = this.loadSnippet(
      this.config.browLoopKey,
      'brow',
      this.config.browPriority
    );

    if (this.browSnippet) {
      this.browSnippet.isPlaying = true;
      this.browSnippet.loop = true;
      this.browSnippet.currentTime = 0;
      this.browSnippet.snippetIntensityScale = this.config.defaultIntensity;

      this.state.browStatus = 'active';
      this.state.browIntensity = this.config.defaultIntensity;

      this.callbacks.onBrowStart?.();
    }
  }

  /**
   * Start head nod loop
   */
  private startHead(): void {
    if (this.state.headStatus === 'active') return;

    // Load snippet if needed
    this.headSnippet = this.loadSnippet(
      this.config.headLoopKey,
      'head',
      this.config.headPriority
    );

    if (this.headSnippet) {
      this.headSnippet.isPlaying = true;
      this.headSnippet.loop = true;
      this.headSnippet.currentTime = 0;
      this.headSnippet.snippetIntensityScale = this.config.defaultIntensity;

      this.state.headStatus = 'active';
      this.state.headIntensity = this.config.defaultIntensity;

      this.callbacks.onHeadStart?.();
    }
  }

  /**
   * Trigger a prosodic pulse on word boundary
   * Brow pulse on every word, head nod on every second word
   */
  public pulse(wordIndex: number): void {
    // Debounce rapid pulses
    const now = performance.now();
    if (now - this.lastPulseTime < this.pulseDebounceMs) {
      return;
    }
    this.lastPulseTime = now;

    // Brow pulse on every word
    this.pulseBrow();

    // Head nod on every second word
    if (wordIndex % 2 === 1) {
      this.pulseHead();
    }

    this.callbacks.onPulse?.('both', wordIndex);
  }

  /**
   * Trigger a brow raise pulse
   */
  private pulseBrow(): void {
    if (!this.browSnippet) return;

    // Reset animation to start for pulse effect
    this.browSnippet.currentTime = 0;
    this.browSnippet.snippetIntensityScale = this.config.defaultIntensity;
  }

  /**
   * Trigger a head nod pulse
   */
  private pulseHead(): void {
    if (!this.headSnippet) return;

    // Reset animation to start for pulse effect
    this.headSnippet.currentTime = 0;
    this.headSnippet.snippetIntensityScale = this.config.defaultIntensity;
  }

  /**
   * Fade out brow animation over multiple steps
   */
  private fadeOutBrow(): void {
    if (this.state.browStatus !== 'active') return;

    this.state.browStatus = 'stopping';

    const steps = this.computeFadeSteps(this.config.fadeSteps);

    this.executeFade(steps, (intensity) => {
      if (this.browSnippet) {
        this.browSnippet.snippetIntensityScale = intensity;
        this.state.browIntensity = intensity;
      }
    }).then(() => {
      if (this.browSnippet) {
        this.browSnippet.isPlaying = false;
        this.browSnippet.currentTime = 0;
      }
      this.state.browStatus = 'idle';
      this.state.browIntensity = 0;
      this.callbacks.onBrowStop?.();
    });
  }

  /**
   * Fade out head animation over multiple steps
   */
  private fadeOutHead(): void {
    if (this.state.headStatus !== 'active') return;

    this.state.headStatus = 'stopping';

    const steps = this.computeFadeSteps(this.config.fadeSteps);

    this.executeFade(steps, (intensity) => {
      if (this.headSnippet) {
        this.headSnippet.snippetIntensityScale = intensity;
        this.state.headIntensity = intensity;
      }
    }).then(() => {
      if (this.headSnippet) {
        this.headSnippet.isPlaying = false;
        this.headSnippet.currentTime = 0;
      }
      this.state.headStatus = 'idle';
      this.state.headIntensity = 0;
      this.callbacks.onHeadStop?.();
    });
  }

  /**
   * Compute fade steps (intensity scaling factors)
   */
  private computeFadeSteps(numSteps: number): FadeStep[] {
    const steps: FadeStep[] = [];

    for (let i = 0; i < numSteps; i++) {
      const intensity = 1.0 - (i + 1) / numSteps;
      const delay = i * this.config.fadeStepInterval;

      steps.push({ intensity, delay });
    }

    return steps;
  }

  /**
   * Execute a fade sequence with multiple steps
   */
  private executeFade(
    steps: FadeStep[],
    onStep: (intensity: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      this.clearFadeTimers();

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isLast = i === steps.length - 1;

        const timer = window.setTimeout(() => {
          onStep(step.intensity);

          if (isLast) {
            resolve();
          }
        }, step.delay);

        this.fadeTimers.push(timer);
      }
    });
  }

  /**
   * Load animation snippet (placeholder - integrates with external animation manager)
   * In production, this would load from localStorage or an animation service
   */
  private loadSnippet(
    key: string,
    category: string,
    priority: number
  ): AnimationSnippet | null {
    // Placeholder: In real implementation, load from localStorage or animation manager
    // For now, return a mock snippet structure

    const mockSnippet: AnimationSnippet = {
      name: key.split('/')[1] || key,
      curves: {}, // Would contain actual animation curves
      snippetCategory: category,
      snippetPriority: priority,
      currentTime: 0,
      isPlaying: false,
      loop: false,
      snippetIntensityScale: 1.0,
      maxTime: 1.0,
      snippetPlaybackRate: 1.0,
    };

    // Try to load from localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...mockSnippet,
            ...parsed,
            snippetCategory: category,
            snippetPriority: priority,
          };
        }
      } catch (err) {
        console.warn(`Failed to load animation snippet: ${key}`, err);
      }
    }

    return mockSnippet;
  }

  /**
   * Stop immediately (no fade)
   */
  public stop(): void {
    this.clearFadeTimers();

    if (this.browSnippet) {
      this.browSnippet.isPlaying = false;
      this.browSnippet.currentTime = 0;
    }

    if (this.headSnippet) {
      this.headSnippet.isPlaying = false;
      this.headSnippet.currentTime = 0;
    }

    this.state = {
      browStatus: 'idle',
      headStatus: 'idle',
      browIntensity: 0,
      headIntensity: 0,
      isLooping: false,
    };

    this.callbacks.onBrowStop?.();
    this.callbacks.onHeadStop?.();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ProsodicConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current state
   */
  public getState(): ProsodicState {
    return { ...this.state };
  }

  /**
   * Get current snippets (for external animation manager integration)
   */
  public getSnippets(): {
    brow: AnimationSnippet | null;
    head: AnimationSnippet | null;
  } {
    return {
      brow: this.browSnippet,
      head: this.headSnippet,
    };
  }

  /**
   * Clear all fade timers
   */
  private clearFadeTimers(): void {
    for (const timer of this.fadeTimers) {
      clearTimeout(timer);
    }
    this.fadeTimers = [];
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
    this.clearFadeTimers();
    this.browSnippet = null;
    this.headSnippet = null;
  }
}

/**
 * Factory function to create a Prosodic Expression service
 */
export function createProsodicService(
  config?: ProsodicConfig,
  callbacks?: ProsodicCallbacks
): ProsodicService {
  return new ProsodicService(config, callbacks);
}
