/**
 * LipSync Scheduler
 * Handles viseme timeline processing, curve building, and animation scheduling
 * Follows the Animation Agency pattern
 *
 * Uses a simple, sequential viseme pattern matching the working snippet files:
 * - Each viseme has a simple 4-keyframe envelope (ramp up → hold → hold → ramp down)
 * - No overlapping/coarticulation - cleaner, more predictable results
 * - Viseme morphs include mouth opening - no separate jaw AU needed
 */

import type { LipSyncSnippet } from './lipSyncMachine';
import type { VisemeEvent } from './types';
import { phonemeExtractor } from './PhonemeExtractor';
import { visemeMapper } from './VisemeMapper';
import { getARKitVisemeIndex } from './visemeToARKit';

export interface LipSyncHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
}

export interface LipSyncSchedulerConfig {
  lipsyncIntensity: number;
  speechRate: number;
  jawScale: number;
}

export class LipSyncScheduler {
  private machine: any;
  private host: LipSyncHostCaps;
  private config: LipSyncSchedulerConfig;

  constructor(
    machine: any,
    host: LipSyncHostCaps,
    config: Partial<LipSyncSchedulerConfig> & Pick<LipSyncSchedulerConfig, 'lipsyncIntensity' | 'speechRate'>
  ) {
    this.machine = machine;
    this.host = host;
    this.config = {
      lipsyncIntensity: config.lipsyncIntensity,
      speechRate: config.speechRate,
      jawScale: config.jawScale ?? 1.0,
    };
  }

  /**
   * Process a word and schedule its animation
   */
  public processWord(word: string, wordIndex: number): void {
    // Extract viseme timeline
    const visemeTimeline = this.extractVisemeTimeline(word);

    // Build animation curves with jaw coordination
    const curves = this.buildCurves(visemeTimeline);

    // Calculate max time
    const maxTime = this.calculateMaxTime(visemeTimeline);

    // Create snippet
    const snippetName = `lipsync_${word.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const snippet = {
      name: snippetName,
      curves,
      maxTime,
      loop: false,
      snippetCategory: 'visemeSnippet', // Viseme morphs only - no AUs
      snippetPriority: 50, // High priority (overrides emotions)
      snippetPlaybackRate: this.config.speechRate,
      snippetIntensityScale: 1.0,
      snippetJawScale: this.config.jawScale, // Jaw bone activation multiplier
    };

    // Schedule to animation service
    const scheduledName = this.host.scheduleSnippet(snippet);

    if (scheduledName) {
      // Notify machine
      this.machine.send({
        type: 'SNIPPET_SCHEDULED',
        snippetName,
        scheduledName,
      });

      // Auto-remove after completion
      setTimeout(() => {
        this.host.removeSnippet(scheduledName);
        this.machine.send({
          type: 'SNIPPET_COMPLETED',
          snippetName,
        });
      }, maxTime * 1000 + 100); // Add 100ms buffer
    }
  }

  /**
   * Extract viseme timeline from word
   */
  private extractVisemeTimeline(word: string): VisemeEvent[] {
    const phonemes = phonemeExtractor.extractPhonemes(word);
    const visemeEvents: VisemeEvent[] = [];
    let offsetMs = 0;

    for (const phoneme of phonemes) {
      const mapping = visemeMapper.getVisemeAndDuration(phoneme);
      // Adjust for speech rate
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
   * Build animation curves with simple sequential viseme pattern
   * Matches the working snippet file format (no coarticulation)
   */
  private buildCurves(
    visemeTimeline: VisemeEvent[]
  ): Record<string, Array<{ time: number; intensity: number }>> {
    const curves: Record<string, Array<{ time: number; intensity: number }>> = {};

    // Intensity scaled by config (100 = full intensity like in snippet files)
    const peakIntensity = 100 * this.config.lipsyncIntensity;

    // Build simple sequential viseme curves
    // Pattern from working snippets: ramp up (20ms) → hold → hold → ramp down (20ms)
    visemeTimeline.forEach((visemeEvent) => {
      const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
      const curveKey = arkitIndex.toString();
      const startTime = visemeEvent.offsetMs / 1000;
      const duration = visemeEvent.durationMs / 1000;

      // Skip silence visemes (SAPI 0 maps to ARKit 3, but we don't animate pauses)
      if (visemeEvent.visemeId === 0) return;

      // Simple 4-keyframe envelope matching working snippets
      const rampTime = 0.02; // 20ms ramp (fixed, like in snippets)
      const holdStart = startTime + rampTime;
      const holdEnd = startTime + duration - rampTime;
      const endTime = startTime + duration;

      // Initialize curve if needed
      if (!curves[curveKey]) {
        curves[curveKey] = [];
      }

      // Add the 4-keyframe envelope
      curves[curveKey].push(
        { time: startTime, intensity: 0 },        // Start at 0
        { time: holdStart, intensity: peakIntensity },  // Ramp up to peak
        { time: holdEnd, intensity: peakIntensity },    // Hold at peak
        { time: endTime, intensity: 0 }           // Ramp down to 0
      );
    });

    return curves;
  }

  /**
   * Calculate maximum time from viseme timeline
   */
  private calculateMaxTime(visemeTimeline: VisemeEvent[]): number {
    if (visemeTimeline.length === 0) return 0;

    const lastViseme = visemeTimeline[visemeTimeline.length - 1];
    const lastEndTime = (lastViseme.offsetMs + lastViseme.durationMs) / 1000;

    // Add small neutral hold
    return lastEndTime + 0.05;
  }

  /**
   * Schedule neutral return snippet
   * Smoothly transitions all active visemes back to closed/neutral
   */
  public scheduleNeutralReturn(): void {
    const neutralSnippet = {
      name: `neutral_${Date.now()}`,
      curves: this.buildNeutralCurves(),
      maxTime: 0.15, // Faster return to neutral
      loop: false,
      snippetCategory: 'visemeSnippet', // Viseme morphs only
      snippetPriority: 60, // Higher priority than lipsync (50) to ensure closure
      snippetPlaybackRate: 1.0,
      snippetIntensityScale: 1.0,
      snippetJawScale: this.config.jawScale, // Jaw bone activation multiplier
    };

    const scheduledName = this.host.scheduleSnippet(neutralSnippet);

    if (scheduledName) {
      // Auto-remove after completion
      setTimeout(() => {
        this.host.removeSnippet(scheduledName);
      }, 200);
    }
  }

  /**
   * Build neutral curves (all visemes to 0)
   * Uses 'inherit' flag so the animation system starts from current values
   */
  private buildNeutralCurves(): Record<string, Array<{ time: number; intensity: number; inherit?: boolean }>> {
    const neutralCurves: Record<string, Array<{ time: number; intensity: number; inherit?: boolean }>> = {};
    const closeDuration = 0.15; // 150ms to close mouth

    // Add neutral curves for all 15 ARKit viseme indices (0-14)
    // Start from current value (inherit) and transition to 0
    for (let i = 0; i < 15; i++) {
      neutralCurves[i.toString()] = [
        { time: 0.0, intensity: 0, inherit: true }, // Start from current value
        { time: closeDuration, intensity: 0 },      // End at 0
      ];
    }

    return neutralCurves;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LipSyncSchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    // Remove any scheduled snippets
    const snapshot = this.machine.getSnapshot();
    const context = snapshot?.context;

    if (context?.snippets) {
      context.snippets.forEach((snippet: any) => {
        if (snippet.scheduledName) {
          this.host.removeSnippet(snippet.scheduledName);
        }
      });
    }
  }
}
