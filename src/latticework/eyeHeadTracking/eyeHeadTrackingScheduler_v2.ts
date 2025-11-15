/**
 * Eye and Head Tracking Scheduler V2
 * Uses virtual continuum AUs to schedule composite movements through animation service
 *
 * Virtual AU IDs (for animation scheduling):
 * - 100: Eye Yaw Continuum (-1 left to +1 right)
 * - 101: Eye Pitch Continuum (-1 down to +1 up)
 * - 102: Head Yaw Continuum (-1 left to +1 right)
 * - 103: Head Pitch Continuum (-1 down to +1 up)
 * - 104: Head Roll Continuum (-1 left tilt to +1 right tilt)
 */

import type { GazeTarget } from './types';

export interface EyeHeadHostCaps {
  scheduleSnippet: (snippet: any) => string | null;
  removeSnippet: (name: string) => void;
  onSnippetEnd?: (name: string) => void;
}

export interface GazeTransitionConfig {
  duration: number; // ms - how long the transition takes
  easing: 'linear' | 'easeInOut' | 'easeOut';
  eyeIntensity: number; // 0-1 scale factor for eye movement
  headIntensity: number; // 0-1 scale factor for head movement
  eyePriority: number; // Animation priority
  headPriority: number; // Animation priority
}

const DEFAULT_TRANSITION_CONFIG: GazeTransitionConfig = {
  duration: 200, // 200ms for natural eye movement
  easing: 'easeOut',
  eyeIntensity: 1.0,
  headIntensity: 0.5,
  eyePriority: 20,
  headPriority: 15,
};

// Virtual AU IDs for continuum values
export const VIRTUAL_AUS = {
  EYE_YAW: '100',      // -1 to +1
  EYE_PITCH: '101',    // -1 to +1
  HEAD_YAW: '102',     // -1 to +1
  HEAD_PITCH: '103',   // -1 to +1
  HEAD_ROLL: '104',    // -1 to +1
} as const;

export class EyeHeadTrackingScheduler {
  private host: EyeHeadHostCaps;
  private transitionConfig: GazeTransitionConfig;

  // Current gaze state
  private currentGaze: GazeTarget = { x: 0, y: 0, z: 0 };

  // Track scheduled snippet names for removal
  private scheduledNames = {
    eyes: 'eyeHeadTracking/eyes',
    head: 'eyeHeadTracking/head',
  };

  constructor(host: EyeHeadHostCaps, transitionConfig?: Partial<GazeTransitionConfig>) {
    this.host = host;
    this.transitionConfig = {
      ...DEFAULT_TRANSITION_CONFIG,
      ...transitionConfig,
    };

    console.log('[Scheduler V2] ✓ Eye/head tracking scheduler initialized with virtual continuum AUs');
  }

  /**
   * Update transition configuration
   */
  public updateConfig(config: Partial<GazeTransitionConfig>): void {
    this.transitionConfig = {
      ...this.transitionConfig,
      ...config,
    };
  }

  /**
   * Schedule gaze transition using virtual continuum AUs
   */
  public scheduleGazeTransition(
    target: GazeTarget,
    options?: {
      eyeEnabled?: boolean;
      headEnabled?: boolean;
      headFollowEyes?: boolean;
      duration?: number;
    }
  ): void {
    const {
      eyeEnabled = true,
      headEnabled = true,
      headFollowEyes = true,
      duration = this.transitionConfig.duration,
    } = options || {};

    const { x: targetX, y: targetY } = target;
    const { eyeIntensity, headIntensity, eyePriority, headPriority } = this.transitionConfig;

    // Schedule eye movement using virtual continuum AUs
    if (eyeEnabled) {
      const eyeYaw = targetX * eyeIntensity;
      const eyePitch = targetY * eyeIntensity;

      this.host.removeSnippet(this.scheduledNames.eyes);
      this.host.scheduleSnippet({
        name: this.scheduledNames.eyes,
        curves: {
          [VIRTUAL_AUS.EYE_YAW]: [{ time: 0, intensity: eyeYaw }],
          [VIRTUAL_AUS.EYE_PITCH]: [{ time: 0, intensity: eyePitch }],
        },
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: eyePriority,
        snippetIntensityScale: 1.0,
      });

      console.log(`[Scheduler V2] ✓ Scheduled eye gaze: yaw=${eyeYaw.toFixed(2)}, pitch=${eyePitch.toFixed(2)}`);
    }

    // Schedule head movement using virtual continuum AUs
    if (headEnabled && headFollowEyes) {
      const headYaw = targetX * headIntensity;
      const headPitch = targetY * headIntensity;

      this.host.removeSnippet(this.scheduledNames.head);
      this.host.scheduleSnippet({
        name: this.scheduledNames.head,
        curves: {
          [VIRTUAL_AUS.HEAD_YAW]: [{ time: 0, intensity: headYaw }],
          [VIRTUAL_AUS.HEAD_PITCH]: [{ time: 0, intensity: headPitch }],
          [VIRTUAL_AUS.HEAD_ROLL]: [{ time: 0, intensity: 0 }],
        },
        loop: false,
        snippetCategory: 'eyeHeadTracking',
        snippetPriority: headPriority,
        snippetIntensityScale: 1.0,
      });

      console.log(`[Scheduler V2] ✓ Scheduled head gaze: yaw=${headYaw.toFixed(2)}, pitch=${headPitch.toFixed(2)}`);
    }

    // Update current gaze state
    this.currentGaze = { x: targetX, y: targetY, z: target.z || 0 };
  }

  /**
   * Stop and remove all tracking snippets
   */
  public stop(): void {
    this.host.removeSnippet(this.scheduledNames.eyes);
    this.host.removeSnippet(this.scheduledNames.head);

    console.log('[Scheduler V2] Removed all gaze tracking snippets');
  }

  /**
   * Reset gaze to center (neutral position)
   */
  public resetToNeutral(duration: number = 300): void {
    this.scheduleGazeTransition({ x: 0, y: 0, z: 0 }, { duration });
  }

  /**
   * Get current gaze position
   */
  public getCurrentGaze(): GazeTarget {
    return { ...this.currentGaze };
  }

  /**
   * Cleanup and release resources
   */
  public dispose(): void {
    this.stop();
  }
}
