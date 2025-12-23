/**
 * EngineThree - Type definitions for the 3D rendering engine
 *
 * This file contains the interface definitions for the EngineThree class,
 * which handles applying AU values to morph targets and bones.
 *
 * Separated from implementation to prevent circular dependencies with
 * the animation system.
 */

/**
 * TransitionHandle - returned from transitionAU/transitionMorph/transitionContinuum
 * Provides promise-based completion notification plus fine-grained control.
 *
 * The animation agency uses these handles to await keyframe transitions,
 * then schedule the next keyframe when the promise resolves.
 */
export type TransitionHandle = {
  /** Resolves when the transition completes (or is cancelled) */
  promise: Promise<void>;
  /** Pause this transition (holds at current value) */
  pause: () => void;
  /** Resume this transition after pause */
  resume: () => void;
  /** Cancel this transition immediately (resolves promise) */
  cancel: () => void;
};

/**
 * Engine - The 3D rendering engine interface (EngineThree)
 *
 * The Animation Agency delegates rendering to the Engine, which handles:
 * - Applying AU values to morph targets and bones
 * - Smooth transitions using requestAnimationFrame
 * - Multi-axis composite motions (e.g., eyes looking up-left)
 * - Mix weight blending between morphs and bones
 *
 * The Animation Agency decides WHAT values to apply and WHEN,
 * while the Engine decides HOW to render them.
 */
export interface Engine {
  /**
   * Apply AU value immediately (no transition)
   * Used for instant updates or when transition timing is handled elsewhere
   *
   * @param id - AU number or string (e.g., 12 or '12')
   * @param value - Target value in [0, 1]
   * @param balance - Optional L/R balance: -1 = left only, 0 = both, +1 = right only
   */
  applyAU: (id: number | string, value: number, balance?: number) => void;

  /**
   * Apply morph value immediately (no transition)
   * Used for viseme or morph targets
   */
  setMorph: (name: string, value: number) => void;

  /**
   * Set AU value with optional transition
   * Primary method for setting AU values
   *
   * @param id - AU number (e.g., 12 for lip corner puller)
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 120ms)
   */
  setAU?: (id: number | string, value: number, durationMs?: number) => void;

  /**
   * Transition AU value smoothly over duration
   * Returns a TransitionHandle with promise for completion + pause/resume/cancel
   *
   * @param id - AU number (e.g., 12 for lip corner puller)
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 120ms)
   * @param balance - Optional L/R balance: -1 = left only, 0 = both, +1 = right only
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  transitionAU?: (id: number | string, value: number, durationMs?: number, balance?: number) => TransitionHandle;

  /**
   * Transition morph value smoothly over duration
   * Used for custom morph targets (NOT visemes - use transitionViseme for those)
   *
   * @param name - Morph target name (e.g., 'Brow_Raise_Inner_L')
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 80ms)
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  transitionMorph?: (name: string, value: number, durationMs?: number) => TransitionHandle;

  /**
   * Set viseme value immediately (no transition)
   * Applies both viseme morph target AND jaw bone rotation
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param value - Target value in [0, 1]
   * @param jawScale - Optional jaw activation multiplier (default: 1.0)
   */
  setViseme?: (visemeIndex: number, value: number, jawScale?: number) => void;

  /**
   * Transition viseme smoothly over duration
   * Applies both viseme morph target AND jaw bone rotation with smooth interpolation
   *
   * Visemes are separate from AUs - they have their own morph targets (EE, Ah, Oh, etc.)
   * plus coordinated jaw bone movement based on phonetic properties.
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param value - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 80ms)
   * @param jawScale - Optional jaw activation multiplier (default: 1.0)
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  transitionViseme?: (visemeIndex: number, value: number, durationMs?: number, jawScale?: number) => TransitionHandle;

  /**
   * Transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * Takes a single value from -1 to +1 and internally manages both AU values.
   * This ensures smooth interpolation through the full range without separate transitions.
   *
   * @param negAU - AU ID for negative direction (e.g., 61 for eyes left, 31 for head left)
   * @param posAU - AU ID for positive direction (e.g., 62 for eyes right, 32 for head right)
   * @param value - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds (default: 200ms)
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  transitionContinuum?: (negAU: number, posAU: number, value: number, durationMs?: number) => TransitionHandle;

  /**
   * Callback invoked when a non-looping snippet naturally completes
   * NOT called when user manually stops a snippet
   *
   * @param name - Snippet name that completed
   */
  onSnippetEnd?: (name: string) => void;

  /**
   * Pause all transitions (used for debugging/inspection)
   */
  pause?: () => void;

  /**
   * Resume all transitions
   */
  resume?: () => void;

  /**
   * Clear all running transitions
   */
  clearTransitions?: () => void;

  /**
   * Get count of active transitions (for debugging)
   */
  getActiveTransitionCount?: () => number;

  // Composite helper methods for continuum pairs (instant)
  setEyesHorizontal?: (value: number) => void;
  setEyesVertical?: (value: number) => void;
  setHeadHorizontal?: (value: number) => void;
  setHeadVertical?: (value: number) => void;
  setHeadTilt?: (value: number) => void;
  setHeadRoll?: (value: number) => void;
  setJawHorizontal?: (value: number) => void;
  setTongueHorizontal?: (value: number) => void;
  setTongueVertical?: (value: number) => void;

  // Composite transition methods for continuum pairs (animated)
  transitionEyesHorizontal?: (value: number, durationMs?: number) => void;
  transitionEyesVertical?: (value: number, durationMs?: number) => void;
  transitionHeadHorizontal?: (value: number, durationMs?: number) => void;
  transitionHeadVertical?: (value: number, durationMs?: number) => void;
  transitionHeadRoll?: (value: number, durationMs?: number) => void;
  transitionJawHorizontal?: (value: number, durationMs?: number) => void;
  transitionTongueHorizontal?: (value: number, durationMs?: number) => void;
  transitionTongueVertical?: (value: number, durationMs?: number) => void;
}

/**
 * @deprecated Use `Engine` instead
 * Maintained for backwards compatibility only
 */
export type HostCaps = Engine;
