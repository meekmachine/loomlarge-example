/**
 * LipSync Scheduler
 * Handles viseme timeline processing, curve building, and animation scheduling
 * Follows the Animation Agency pattern
 *
 * Uses coarticulation for natural speech animation:
 * - Visemes overlap to create smooth blending between mouth shapes
 * - Each viseme extends into neighbors for anticipatory/carryover coarticulation
 * - Jaw bone movement is coordinated through the viseme system (not AU 26)
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
   * Build animation curves with coarticulation for natural speech
   * Visemes overlap and blend into each other for smooth transitions
   */
  private buildCurves(
    visemeTimeline: VisemeEvent[]
  ): Record<string, Array<{ time: number; intensity: number }>> {
    const curves: Record<string, Array<{ time: number; intensity: number }>> = {};

    // Intensity scaled by config (100 = full intensity like in snippet files)
    const peakIntensity = 100 * this.config.lipsyncIntensity;

    // Coarticulation parameters - tuned for smooth, snappy transitions
    const anticipationRatio = 0.10; // Start ramping up 10% before phoneme starts
    const carryoverRatio = 0.10;    // Continue 10% into next phoneme (reduced from 20%)
    const rampUpRatio = 0.35;       // Slower ramp up (35%) for smoother onset
    const rampDownRatio = 0.40;     // Slower ramp down (40%) for smoother release

    visemeTimeline.forEach((visemeEvent, index) => {
      const arkitIndex = getARKitVisemeIndex(visemeEvent.visemeId);
      const curveKey = arkitIndex.toString();
      const nominalStart = visemeEvent.offsetMs / 1000;
      const duration = visemeEvent.durationMs / 1000;

      // Skip silence visemes (SAPI 0 maps to ARKit 3, but we don't animate pauses)
      if (visemeEvent.visemeId === 0) return;

      // Calculate coarticulated timing
      const anticipation = duration * anticipationRatio;
      const carryover = duration * carryoverRatio;
      const rampUp = Math.max(0.025, duration * rampUpRatio);   // Min 25ms for smooth ramp
      const rampDown = Math.max(0.030, duration * rampDownRatio); // Min 30ms for smooth release

      // Actual start/end with coarticulation overlap
      const actualStart = Math.max(0, nominalStart - anticipation);
      const peakStart = actualStart + rampUp;
      const peakEnd = nominalStart + duration - rampDown + carryover * 0.5;
      const actualEnd = nominalStart + duration + carryover;

      // Initialize curve if needed
      if (!curves[curveKey]) {
        curves[curveKey] = [];
      }

      // Check if we need to merge with existing keyframes for this viseme
      // (same viseme appearing multiple times in sequence)
      const existingKeyframes = curves[curveKey];
      const lastKeyframe = existingKeyframes[existingKeyframes.length - 1];

      if (lastKeyframe && lastKeyframe.time > actualStart - 0.01) {
        // Overlapping with previous occurrence of same viseme - extend peak instead
        // Remove the ramp-down keyframes and extend the hold
        while (existingKeyframes.length > 0 &&
               existingKeyframes[existingKeyframes.length - 1].intensity < peakIntensity * 0.9 &&
               existingKeyframes[existingKeyframes.length - 1].time > actualStart - 0.05) {
          existingKeyframes.pop();
        }
        // Add extended peak and new ramp down
        curves[curveKey].push(
          { time: peakEnd, intensity: peakIntensity },
          { time: actualEnd, intensity: 0 }
        );
      } else {
        // Normal case: add full envelope with coarticulation
        curves[curveKey].push(
          { time: actualStart, intensity: 0 },
          { time: peakStart, intensity: peakIntensity },
          { time: peakEnd, intensity: peakIntensity },
          { time: actualEnd, intensity: 0 }
        );
      }
    });

    // Sort keyframes by time for each curve (coarticulation can cause out-of-order)
    for (const curveKey of Object.keys(curves)) {
      curves[curveKey].sort((a, b) => a.time - b.time);
    }

    return curves;
  }

  /**
   * Calculate maximum time from viseme timeline
   * Accounts for coarticulation carryover extending past nominal end
   */
  private calculateMaxTime(visemeTimeline: VisemeEvent[]): number {
    if (visemeTimeline.length === 0) return 0;

    const lastViseme = visemeTimeline[visemeTimeline.length - 1];
    const lastEndTime = (lastViseme.offsetMs + lastViseme.durationMs) / 1000;
    const carryover = (lastViseme.durationMs / 1000) * 0.10; // Match carryoverRatio

    // Add carryover time plus minimal buffer
    return lastEndTime + carryover + 0.02;
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
