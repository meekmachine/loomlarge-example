/**
 * Animation Event Types for RxJS Observable Streams
 *
 * These events are emitted by the animation system at meaningful moments
 * (keyframe completion, state changes) rather than on every tick.
 */

// ============ Core Event Types ============

interface AnimationEventBase {
  timestamp: number;
}

/** Emitted when a snippet is added to the animation system */
export interface SnippetAddedEvent extends AnimationEventBase {
  type: 'SNIPPET_ADDED';
  snippetName: string;
}

/** Emitted when a snippet is removed from the animation system */
export interface SnippetRemovedEvent extends AnimationEventBase {
  type: 'SNIPPET_REMOVED';
  snippetName: string;
}

/** Emitted when a snippet's playback state changes (play/pause) */
export interface SnippetPlayStateChangedEvent extends AnimationEventBase {
  type: 'SNIPPET_PLAY_STATE_CHANGED';
  snippetName: string;
  isPlaying: boolean;
}

/** Emitted when a snippet completes a loop iteration */
export interface SnippetLoopedEvent extends AnimationEventBase {
  type: 'SNIPPET_LOOPED';
  snippetName: string;
  iteration: number;
  localTime: number;
}

/** Emitted when a non-looping snippet completes playback */
export interface SnippetCompletedEvent extends AnimationEventBase {
  type: 'SNIPPET_COMPLETED';
  snippetName: string;
}

/**
 * Emitted when a keyframe transition completes within a snippet.
 * This is the primary event for UI updates during playback.
 */
export interface KeyframeCompletedEvent extends AnimationEventBase {
  type: 'KEYFRAME_COMPLETED';
  snippetName: string;
  keyframeIndex: number;
  totalKeyframes: number;
  currentTime: number;
  duration: number;
}

/** Emitted when a snippet's parameters change (rate, intensity, loop) */
export interface SnippetParamsChangedEvent extends AnimationEventBase {
  type: 'SNIPPET_PARAMS_CHANGED';
  snippetName: string;
  params: {
    playbackRate?: number;
    intensityScale?: number;
    loop?: boolean;
  };
}

/** Emitted when the global playback state changes (play all / pause all / stop all) */
export interface GlobalPlaybackChangedEvent extends AnimationEventBase {
  type: 'GLOBAL_PLAYBACK_CHANGED';
  state: 'playing' | 'paused' | 'stopped';
}

/** Emitted when a snippet is seeked to a new time position */
export interface SnippetSeekedEvent extends AnimationEventBase {
  type: 'SNIPPET_SEEKED';
  snippetName: string;
  time: number;
}

// ============ Baked Animation Event Types ============

/** State of a baked animation (from GLB/GLTF file) */
export interface BakedAnimationUIState {
  name: string;
  time: number;
  duration: number;
  speed: number;
  weight: number;
  isPlaying: boolean;
  isPaused: boolean;
  loop: boolean;
}

/** Info about an available baked animation clip */
export interface BakedClipInfo {
  name: string;
  duration: number;
}

/** Emitted when baked animation clips are loaded from a model */
export interface BakedClipsLoadedEvent extends AnimationEventBase {
  type: 'BAKED_CLIPS_LOADED';
  clips: BakedClipInfo[];
}

/** Emitted when a baked animation starts playing */
export interface BakedAnimationStartedEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_STARTED';
  clipName: string;
  state: BakedAnimationUIState;
}

/** Emitted when a baked animation is stopped */
export interface BakedAnimationStoppedEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_STOPPED';
  clipName: string;
}

/** Emitted when a baked animation is paused */
export interface BakedAnimationPausedEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_PAUSED';
  clipName: string;
}

/** Emitted when a baked animation is resumed */
export interface BakedAnimationResumedEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_RESUMED';
  clipName: string;
}

/** Emitted when a baked animation completes (non-looping) */
export interface BakedAnimationCompletedEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_COMPLETED';
  clipName: string;
}

/** Emitted periodically with baked animation progress (throttled) */
export interface BakedAnimationProgressEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_PROGRESS';
  clipName: string;
  time: number;
  duration: number;
}

/** Emitted when baked animation parameters change (speed, weight) */
export interface BakedAnimationParamsChangedEvent extends AnimationEventBase {
  type: 'BAKED_ANIMATION_PARAMS_CHANGED';
  clipName: string;
  params: {
    speed?: number;
    weight?: number;
    loop?: boolean;
  };
}

/** Union type of all animation events */
export type AnimationEvent =
  | SnippetAddedEvent
  | SnippetRemovedEvent
  | SnippetPlayStateChangedEvent
  | SnippetLoopedEvent
  | SnippetCompletedEvent
  | KeyframeCompletedEvent
  | SnippetParamsChangedEvent
  | GlobalPlaybackChangedEvent
  | SnippetSeekedEvent
  | BakedClipsLoadedEvent
  | BakedAnimationStartedEvent
  | BakedAnimationStoppedEvent
  | BakedAnimationPausedEvent
  | BakedAnimationResumedEvent
  | BakedAnimationCompletedEvent
  | BakedAnimationProgressEvent
  | BakedAnimationParamsChangedEvent;

// ============ State Snapshot Types ============

/**
 * Minimal snippet state for UI components.
 * Contains only the fields needed for display.
 */
export interface SnippetUIState {
  name: string;
  isPlaying: boolean;
  loop: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  intensityScale: number;
  category: string;
}

/**
 * Full snapshot of animation state.
 * Emitted as initial state and for batch updates.
 */
export interface AnimationStateSnapshot {
  globalState: 'playing' | 'paused' | 'stopped';
  snippets: SnippetUIState[];
}
