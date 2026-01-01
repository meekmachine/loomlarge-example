import { createActor, type Actor } from 'xstate';
import { Subject, Observable } from 'rxjs';
import { filter, map, distinctUntilChanged, throttleTime, shareReplay } from 'rxjs/operators';
import { animationMachine } from './animationMachine';
import type { HostCaps, ScheduleOpts, NormalizedSnippet, BakedAnimationEngine } from './types';
import { AnimationScheduler as Scheduler } from './animationScheduler';
import type {
  AnimationEvent,
  SnippetUIState,
  KeyframeCompletedEvent,
  GlobalPlaybackChangedEvent,
  BakedClipInfo,
  BakedAnimationUIState,
  BakedClipsLoadedEvent,
  BakedAnimationStartedEvent,
  BakedAnimationStoppedEvent,
  BakedAnimationProgressEvent,
} from './animationEvents';

/**
 * Animation Service
 *
 * This service wraps the XState animation machine and scheduler.
 * It exposes the XState actor directly so React components can use
 * `useSelector` from `@xstate/react` for efficient subscriptions.
 *
 * Usage in React:
 * ```tsx
 * import { useSelector } from '@xstate/react';
 * import { useThreeState } from '../context/threeContext';
 *
 * function MyComponent() {
 *   const { anim } = useThreeState();
 *   const animations = useSelector(anim.actor, state => state.context.animations);
 *   // ...
 * }
 * ```
 */
export function createAnimationService(host: HostCaps) {
  // Create and start the XState actor
  const actor = createActor(animationMachine).start();

  // Create the scheduler that drives playback
  const scheduler = new Scheduler(actor, host);

  // Wire up RxJS event emitter with snippet accessor
  animationEventEmitter.setSnippetAccessor(() => {
    const state = actor.getSnapshot();
    return (state?.context?.animations ?? []) as NormalizedSnippet[];
  });

  let disposed = false;

  // Baked animation engine state (closure variables)
  let bakedEngine: BakedAnimationEngine | null = null;
  let bakedProgressInterval: ReturnType<typeof setInterval> | null = null;

  const api = {
    // --- XState Actor (for useSelector in React components) ---
    /**
     * The XState actor. Use with `useSelector` from `@xstate/react`:
     *
     * ```tsx
     * const animations = useSelector(anim.actor, state => state.context.animations);
     * const currentAUs = useSelector(anim.actor, state => state.context.currentAUs);
     * ```
     */
    actor: actor as Actor<typeof animationMachine>,

    // --- Core API (delegated to Scheduler) ---
    loadFromJSON(data: any) {
      return scheduler.loadFromJSON(data);
    },

    schedule(data: any, opts?: ScheduleOpts) {
      const name = scheduler.schedule(data, opts);
      if (name) animationEventEmitter.emitSnippetAdded(name);
      return name;
    },

    remove(name: string) {
      scheduler.remove(name);
      animationEventEmitter.emitSnippetRemoved(name);
    },

    play() {
      scheduler.play();
      animationEventEmitter.emitGlobalPlaybackChanged('playing');
    },

    pause() {
      scheduler.pause();
      animationEventEmitter.emitGlobalPlaybackChanged('paused');
    },

    stop() {
      scheduler.stop();
      animationEventEmitter.emitGlobalPlaybackChanged('stopped');
    },

    enable(name: string, on = true) {
      return scheduler.enable(name, on);
    },

    seek(name: string, offsetSec: number) {
      return scheduler.seek(name, offsetSec);
    },

    // --- State access ---
    getState() {
      return actor.getSnapshot();
    },

    getScheduleSnapshot() {
      return scheduler.getScheduleSnapshot();
    },

    getCurrentValue(auId: string): number {
      return scheduler.getCurrentValue(auId);
    },

    get playing() {
      return scheduler.isPlaying();
    },

    isPlaying() {
      return scheduler.isPlaying();
    },

    // --- LocalStorage loading ---
    loadFromLocal(key: string, cat = 'default', prio = 0) {
      const str = localStorage.getItem(key);
      if (!str) return null;
      try {
        const obj = JSON.parse(str);
        if (!obj.name) {
          const parts = key.split('/');
          obj.name = parts[parts.length - 1];
        }
        return api.schedule(obj, { priority: prio });
      } catch (e) {
        console.error('[animationService] bad JSON from localStorage', e);
        return null;
      }
    },

    // --- Per-snippet controls ---
    setSnippetPlaybackRate(name: string, rate: number) {
      const sn = getSnippet(name);
      if (!sn) return;

      const newRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
      const oldRate = sn.snippetPlaybackRate ?? 1;

      if (Math.abs(newRate - oldRate) > 0.001) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const currentLocal = ((now - (sn.startWallTime || now)) / 1000) * oldRate;
        sn.startWallTime = now - (currentLocal / newRate) * 1000;
      }
      sn.snippetPlaybackRate = newRate;
      animationEventEmitter.emitParamsChanged(name, { playbackRate: newRate });
    },

    setSnippetIntensityScale(name: string, scale: number) {
      const sn = getSnippet(name);
      if (sn) {
        const newScale = Math.max(0, Number.isFinite(scale) ? scale : 1);
        sn.snippetIntensityScale = newScale;
        animationEventEmitter.emitParamsChanged(name, { intensityScale: newScale });
      }
    },

    setSnippetPriority(name: string, priority: number) {
      const sn = getSnippet(name);
      if (sn) {
        sn.snippetPriority = Number.isFinite(priority) ? priority : 0;
      }
    },

    setSnippetLoop(name: string, loop: boolean) {
      const sn = getSnippet(name);
      if (sn) {
        sn.loop = !!loop;
        animationEventEmitter.emitParamsChanged(name, { loop: !!loop });
      }
    },

    setSnippetPlaying(name: string, playing: boolean) {
      const sn = getSnippet(name);
      if (!sn) return;
      sn.isPlaying = !!playing;

      if (playing) {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const currentLocal = sn.currentTime || 0;
        const rate = sn.snippetPlaybackRate ?? 1;
        sn.startWallTime = now - (currentLocal / rate) * 1000;
        scheduler.resumeSnippet(name);
      } else {
        scheduler.pauseSnippet(name);
      }
      animationEventEmitter.emitPlayStateChanged(name, !!playing);
    },

    setSnippetTime(name: string, tSec: number) {
      const time = Math.max(0, tSec || 0);
      scheduler.seek(name, time);
      animationEventEmitter.emitSnippetSeeked(name, time);
    },

    setSnippetLoopState(name: string, iteration: number, localTime?: number) {
      actor.send({ type: 'SET_LOOP_STATE', name, iteration, localTime });
    },

    // --- Playback runner controls ---
    pauseSnippet(name: string) {
      return scheduler.pauseSnippet(name);
    },

    resumeSnippet(name: string) {
      return scheduler.resumeSnippet(name);
    },

    stopSnippet(name: string) {
      return scheduler.stopSnippet(name);
    },

    // --- Legacy subscription (for backwards compatibility) ---
    onTransition(cb: (snapshot: any) => void) {
      const sub = actor.subscribe((snapshot) => {
        cb(snapshot);
      });
      return () => sub.unsubscribe();
    },

    // --- Lifecycle ---
    dispose() {
      if (disposed) return;
      disposed = true;
      if (bakedProgressInterval) {
        clearInterval(bakedProgressInterval);
        bakedProgressInterval = null;
      }
      bakedEngine = null;
      try { scheduler.dispose(); } catch {}
      try { actor.stop(); } catch {}
    },

    // --- Debug ---
    debug() {
      const state = actor.getSnapshot();
      const anims = state?.context?.animations || [];
      console.log('[AnimationService] Debug Info:');
      console.log('  - playing:', api.playing);
      console.log('  - machine state:', state?.value);
      console.log('  - animations loaded:', anims.length);
      anims.forEach((a: any, i: number) => {
        console.log(`    [${i}] ${a.name}: isPlaying=${a.isPlaying}, duration=${a.duration}, curves=${Object.keys(a.curves || {}).length}`);
      });
    },

    // --- Baked Animation Controls ---
    setBakedAnimationEngine(engine: BakedAnimationEngine) {
      console.log('[AnimService:Baked] setBakedAnimationEngine called - wiring up to engine');
      bakedEngine = engine;
      // Load clips and emit event
      const clips = engine.getAnimationClips?.() || [];
      console.log(`[AnimService:Baked] Found ${clips.length} clips:`, clips.map(c => c.name));
      animationEventEmitter.emitBakedClipsLoaded(clips.map(c => ({ name: c.name, duration: c.duration })));

      // Start progress polling for baked animations (every 100ms when playing)
      if (bakedProgressInterval) {
        clearInterval(bakedProgressInterval);
      }
      bakedProgressInterval = setInterval(() => {
        if (!bakedEngine) return;
        const playing = bakedEngine.getPlayingAnimations?.() || [];
        for (const anim of playing) {
          // Update internal state and emit progress
          animationEventEmitter.updateBakedAnimationState(anim.name, {
            name: anim.name,
            time: anim.time,
            duration: anim.duration,
            speed: anim.speed,
            weight: anim.weight,
            isPlaying: anim.isPlaying,
            isPaused: anim.isPaused,
            loop: anim.loop,
          });
          animationEventEmitter.emitBakedAnimationProgress(anim.name, anim.time, anim.duration);
        }
      }, 100);
    },

    playBakedAnimation(clipName: string, options?: { loop?: boolean; speed?: number; weight?: number }) {
      console.log(`[AnimService:Baked] playBakedAnimation("${clipName}")`, options);
      if (!bakedEngine) {
        console.warn('[AnimService:Baked] No engine set - cannot play');
        return null;
      }
      const handle = bakedEngine.playAnimation?.(clipName, options);
      if (handle) {
        const state = handle.getState();
        console.log(`[AnimService:Baked] Animation started - mixer will handle playback`);
        animationEventEmitter.emitBakedAnimationStarted(clipName, {
          name: state.name,
          time: state.time,
          duration: state.duration,
          speed: state.speed,
          weight: state.weight,
          isPlaying: state.isPlaying,
          isPaused: state.isPaused,
          loop: state.loop,
        });
        // Track completion
        handle.finished.then(() => {
          console.log(`[AnimService:Baked] Animation "${clipName}" completed`);
          animationEventEmitter.emitBakedAnimationCompleted(clipName);
        }).catch(() => {
          // Animation might be stopped before completion
        });
      }
      return handle;
    },

    stopBakedAnimation(clipName: string) {
      console.log(`[AnimService:Baked] stopBakedAnimation("${clipName}")`);
      bakedEngine?.stopAnimation?.(clipName);
      animationEventEmitter.emitBakedAnimationStopped(clipName);
    },

    pauseBakedAnimation(clipName: string) {
      bakedEngine?.pauseAnimation?.(clipName);
      animationEventEmitter.emitBakedAnimationPaused(clipName);
    },

    resumeBakedAnimation(clipName: string) {
      bakedEngine?.resumeAnimation?.(clipName);
      animationEventEmitter.emitBakedAnimationResumed(clipName);
    },

    setBakedAnimationSpeed(clipName: string, speed: number) {
      bakedEngine?.setAnimationSpeed?.(clipName, speed);
      animationEventEmitter.emitBakedAnimationParamsChanged(clipName, { speed });
    },

    setBakedAnimationWeight(clipName: string, weight: number) {
      bakedEngine?.setAnimationIntensity?.(clipName, weight);
      animationEventEmitter.emitBakedAnimationParamsChanged(clipName, { weight });
    },

    stopAllBakedAnimations() {
      if (!bakedEngine) return;
      const playing = animationEventEmitter.getPlayingBakedAnimations();
      bakedEngine.stopAllAnimations?.();
      // Emit stopped for each
      for (const anim of playing) {
        animationEventEmitter.emitBakedAnimationStopped(anim.name);
      }
    },

    getBakedClips() {
      return animationEventEmitter.getBakedClips();
    },

    getPlayingBakedAnimations() {
      return animationEventEmitter.getPlayingBakedAnimations();
    },
  } as const;

  // Helper to get snippet from machine context
  function getSnippet(name: string) {
    const list = actor.getSnapshot()?.context?.animations as any[] || [];
    return list.find(s => s?.name === name);
  }

  // Expose on window for debugging
  (window as any).anim = api;

  return api;
}

// Export the type for the animation service
export type AnimationService = ReturnType<typeof createAnimationService>;

// ============================================================================
// RxJS Event Emitter - Singleton for Animation Events
// ============================================================================

/**
 * Converts a NormalizedSnippet to minimal SnippetUIState for React components.
 */
function toUIState(sn: NormalizedSnippet): SnippetUIState {
  return {
    name: sn.name,
    isPlaying: sn.isPlaying,
    loop: sn.loop,
    currentTime: sn.currentTime,
    duration: sn.duration,
    playbackRate: sn.snippetPlaybackRate,
    intensityScale: sn.snippetIntensityScale,
    category: sn.snippetCategory,
  };
}

/**
 * AnimationEventEmitter - Central event stream for animation state changes.
 *
 * Emits discrete events (not snapshots) when:
 * - Keyframe transitions complete
 * - Snippet play/pause/stop state changes
 * - Loop iterations complete
 * - Snippets are added/removed
 * - Parameters change (rate, intensity, loop)
 *
 * React hooks subscribe to events and read state from XState actor on demand.
 * No intermediate state copying - events are just notifications.
 */
class AnimationEventEmitter {
  private event$ = new Subject<AnimationEvent>();
  private _getSnippets: (() => NormalizedSnippet[]) | null = null;
  private _globalState: 'playing' | 'paused' | 'stopped' = 'stopped';

  // Baked animation state storage
  private _bakedClips: BakedClipInfo[] = [];
  private _playingBakedAnimations = new Map<string, BakedAnimationUIState>();

  /** Observable stream of discrete animation events */
  get events(): Observable<AnimationEvent> {
    return this.event$.asObservable();
  }

  /**
   * Set the function to retrieve snippets from XState actor.
   * Called during service creation.
   */
  setSnippetAccessor(getSnippets: () => NormalizedSnippet[]) {
    this._getSnippets = getSnippets;
  }

  /** Read current snippets from XState actor (for initial hook values) */
  getSnippets(): SnippetUIState[] {
    if (!this._getSnippets) return [];
    return this._getSnippets().map(toUIState);
  }

  /** Get a single snippet by name */
  getSnippet(name: string): SnippetUIState | null {
    if (!this._getSnippets) return null;
    const sn = this._getSnippets().find(s => s.name === name);
    return sn ? toUIState(sn) : null;
  }

  /** Get current global playback state */
  getGlobalState(): 'playing' | 'paused' | 'stopped' {
    return this._globalState;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  // ============ Event Emitters (just emit, no state copying) ============

  emitSnippetAdded(snippetName: string) {
    this.event$.next({
      type: 'SNIPPET_ADDED',
      snippetName,
      timestamp: this.now(),
    });
  }

  emitSnippetRemoved(snippetName: string) {
    this.event$.next({
      type: 'SNIPPET_REMOVED',
      snippetName,
      timestamp: this.now(),
    });
  }

  emitPlayStateChanged(snippetName: string, isPlaying: boolean) {
    this.event$.next({
      type: 'SNIPPET_PLAY_STATE_CHANGED',
      snippetName,
      isPlaying,
      timestamp: this.now(),
    });
  }

  emitSnippetLooped(data: { snippetName: string; iteration: number; localTime: number }) {
    this.event$.next({
      type: 'SNIPPET_LOOPED',
      ...data,
      timestamp: this.now(),
    });
  }

  emitSnippetCompleted(snippetName: string) {
    this.event$.next({
      type: 'SNIPPET_COMPLETED',
      snippetName,
      timestamp: this.now(),
    });
  }

  emitKeyframeCompleted(data: {
    snippetName: string;
    keyframeIndex: number;
    totalKeyframes: number;
    currentTime: number;
    duration: number;
  }) {
    this.event$.next({
      type: 'KEYFRAME_COMPLETED',
      ...data,
      timestamp: this.now(),
    });
  }

  emitGlobalPlaybackChanged(state: 'playing' | 'paused' | 'stopped') {
    this._globalState = state;
    this.event$.next({
      type: 'GLOBAL_PLAYBACK_CHANGED',
      state,
      timestamp: this.now(),
    });
  }

  emitSnippetSeeked(snippetName: string, time: number) {
    this.event$.next({
      type: 'SNIPPET_SEEKED',
      snippetName,
      time,
      timestamp: this.now(),
    });
  }

  emitParamsChanged(snippetName: string, params: {
    playbackRate?: number;
    intensityScale?: number;
    loop?: boolean;
  }) {
    this.event$.next({
      type: 'SNIPPET_PARAMS_CHANGED',
      snippetName,
      params,
      timestamp: this.now(),
    });
  }

  // ============ Baked Animation Event Emitters ============

  emitBakedClipsLoaded(clips: BakedClipInfo[]) {
    this._bakedClips = clips;
    this.event$.next({
      type: 'BAKED_CLIPS_LOADED',
      clips,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationStarted(clipName: string, state: BakedAnimationUIState) {
    this._playingBakedAnimations.set(clipName, state);
    this.event$.next({
      type: 'BAKED_ANIMATION_STARTED',
      clipName,
      state,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationStopped(clipName: string) {
    this._playingBakedAnimations.delete(clipName);
    this.event$.next({
      type: 'BAKED_ANIMATION_STOPPED',
      clipName,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationPaused(clipName: string) {
    const state = this._playingBakedAnimations.get(clipName);
    if (state) {
      state.isPaused = true;
      state.isPlaying = false;
    }
    this.event$.next({
      type: 'BAKED_ANIMATION_PAUSED',
      clipName,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationResumed(clipName: string) {
    const state = this._playingBakedAnimations.get(clipName);
    if (state) {
      state.isPaused = false;
      state.isPlaying = true;
    }
    this.event$.next({
      type: 'BAKED_ANIMATION_RESUMED',
      clipName,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationCompleted(clipName: string) {
    this._playingBakedAnimations.delete(clipName);
    this.event$.next({
      type: 'BAKED_ANIMATION_COMPLETED',
      clipName,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationProgress(clipName: string, time: number, duration: number) {
    const state = this._playingBakedAnimations.get(clipName);
    if (state) {
      state.time = time;
      state.duration = duration;
    }
    this.event$.next({
      type: 'BAKED_ANIMATION_PROGRESS',
      clipName,
      time,
      duration,
      timestamp: this.now(),
    });
  }

  emitBakedAnimationParamsChanged(clipName: string, params: {
    speed?: number;
    weight?: number;
    loop?: boolean;
  }) {
    const state = this._playingBakedAnimations.get(clipName);
    if (state) {
      if (params.speed !== undefined) state.speed = params.speed;
      if (params.weight !== undefined) state.weight = params.weight;
      if (params.loop !== undefined) state.loop = params.loop;
    }
    this.event$.next({
      type: 'BAKED_ANIMATION_PARAMS_CHANGED',
      clipName,
      params,
      timestamp: this.now(),
    });
  }

  // ============ Baked Animation State Getters ============

  getBakedClips(): BakedClipInfo[] {
    return this._bakedClips;
  }

  getPlayingBakedAnimations(): BakedAnimationUIState[] {
    return Array.from(this._playingBakedAnimations.values());
  }

  getBakedAnimationState(clipName: string): BakedAnimationUIState | null {
    return this._playingBakedAnimations.get(clipName) ?? null;
  }

  updateBakedAnimationState(clipName: string, state: BakedAnimationUIState) {
    this._playingBakedAnimations.set(clipName, state);
  }
}

// Singleton instance - shared by scheduler and service
export const animationEventEmitter = new AnimationEventEmitter();

// ============================================================================
// Derived Observables - Event-based subscriptions (no snapshots)
// ============================================================================

/**
 * Observable of snippet list changes (add/remove only).
 * Reads from XState actor on each event - no intermediate state copying.
 */
export const snippetList$: Observable<string[]> = animationEventEmitter.events.pipe(
  filter(e => e.type === 'SNIPPET_ADDED' || e.type === 'SNIPPET_REMOVED'),
  map(() => animationEventEmitter.getSnippets().map((s: SnippetUIState) => s.name)),
  distinctUntilChanged((a, b) => a.length === b.length && a.every((v: string, i: number) => v === b[i])),
  shareReplay(1)
);

/**
 * Factory for per-snippet state observables.
 * Listens to events that affect a specific snippet and reads current state on demand.
 */
export function snippetState$(snippetName: string): Observable<SnippetUIState | null> {
  return animationEventEmitter.events.pipe(
    // Only react to events for this snippet (or structural events)
    filter(e => {
      if (e.type === 'SNIPPET_ADDED' || e.type === 'SNIPPET_REMOVED') return true;
      if ('snippetName' in e && e.snippetName === snippetName) return true;
      return false;
    }),
    // Read current state from XState actor
    map(() => animationEventEmitter.getSnippet(snippetName)),
    distinctUntilChanged((a, b) => {
      if (!a || !b) return a === b;
      return (
        a.isPlaying === b.isPlaying &&
        a.loop === b.loop &&
        Math.abs(a.currentTime - b.currentTime) < 0.05 &&
        a.playbackRate === b.playbackRate &&
        a.intensityScale === b.intensityScale
      );
    }),
    shareReplay(1)
  );
}

/**
 * Throttled currentTime updates for a specific snippet.
 * Uses event data directly - no state reading needed.
 */
export function snippetTime$(snippetName: string, throttleMs = 100): Observable<number> {
  return animationEventEmitter.events.pipe(
    filter((e): e is KeyframeCompletedEvent =>
      e.type === 'KEYFRAME_COMPLETED' && e.snippetName === snippetName
    ),
    map(e => e.currentTime),
    throttleTime(throttleMs, undefined, { leading: true, trailing: true }),
    distinctUntilChanged((a, b) => Math.abs(a - b) < 0.05),
    shareReplay(1)
  );
}

/**
 * Global playback state observable.
 * Uses event data directly.
 */
export const globalPlaybackState$: Observable<'playing' | 'paused' | 'stopped'> =
  animationEventEmitter.events.pipe(
    filter((e): e is GlobalPlaybackChangedEvent => e.type === 'GLOBAL_PLAYBACK_CHANGED'),
    map(e => e.state),
    distinctUntilChanged(),
    shareReplay(1)
  );

// ============================================================================
// Baked Animation Observables
// ============================================================================

/**
 * Observable of baked clip list changes.
 * Emits when clips are loaded from a model.
 */
export const bakedClipList$: Observable<BakedClipInfo[]> = animationEventEmitter.events.pipe(
  filter((e): e is BakedClipsLoadedEvent => e.type === 'BAKED_CLIPS_LOADED'),
  map(e => e.clips),
  shareReplay(1)
);

/**
 * Observable of playing baked animations list.
 * Updates on start/stop/pause/resume/complete events.
 */
export const playingBakedAnimations$: Observable<BakedAnimationUIState[]> =
  animationEventEmitter.events.pipe(
    filter(e =>
      e.type === 'BAKED_ANIMATION_STARTED' ||
      e.type === 'BAKED_ANIMATION_STOPPED' ||
      e.type === 'BAKED_ANIMATION_PAUSED' ||
      e.type === 'BAKED_ANIMATION_RESUMED' ||
      e.type === 'BAKED_ANIMATION_COMPLETED' ||
      e.type === 'BAKED_ANIMATION_PROGRESS' ||
      e.type === 'BAKED_ANIMATION_PARAMS_CHANGED'
    ),
    map(() => animationEventEmitter.getPlayingBakedAnimations()),
    distinctUntilChanged((a, b) => {
      if (a.length !== b.length) return false;
      // Shallow comparison of animation states
      for (let i = 0; i < a.length; i++) {
        if (a[i].name !== b[i].name) return false;
        if (Math.abs(a[i].time - b[i].time) > 0.05) return false;
        if (a[i].isPlaying !== b[i].isPlaying) return false;
        if (a[i].isPaused !== b[i].isPaused) return false;
      }
      return true;
    }),
    shareReplay(1)
  );

/**
 * Factory for per-baked-animation state observables.
 * Listens to events that affect a specific baked animation.
 */
export function bakedAnimationState$(clipName: string): Observable<BakedAnimationUIState | null> {
  return animationEventEmitter.events.pipe(
    filter(e => {
      if (e.type === 'BAKED_ANIMATION_STARTED' && e.clipName === clipName) return true;
      if (e.type === 'BAKED_ANIMATION_STOPPED' && e.clipName === clipName) return true;
      if (e.type === 'BAKED_ANIMATION_PAUSED' && e.clipName === clipName) return true;
      if (e.type === 'BAKED_ANIMATION_RESUMED' && e.clipName === clipName) return true;
      if (e.type === 'BAKED_ANIMATION_COMPLETED' && e.clipName === clipName) return true;
      if (e.type === 'BAKED_ANIMATION_PROGRESS' && e.clipName === clipName) return true;
      if (e.type === 'BAKED_ANIMATION_PARAMS_CHANGED' && e.clipName === clipName) return true;
      return false;
    }),
    map(() => animationEventEmitter.getBakedAnimationState(clipName)),
    distinctUntilChanged((a, b) => {
      if (!a || !b) return a === b;
      return (
        a.isPlaying === b.isPlaying &&
        a.isPaused === b.isPaused &&
        Math.abs(a.time - b.time) < 0.05 &&
        a.speed === b.speed &&
        a.weight === b.weight
      );
    }),
    shareReplay(1)
  );
}

/**
 * Throttled progress updates for a specific baked animation.
 */
export function bakedAnimationProgress$(clipName: string, throttleMs = 100): Observable<{ time: number; duration: number }> {
  return animationEventEmitter.events.pipe(
    filter((e): e is BakedAnimationProgressEvent =>
      e.type === 'BAKED_ANIMATION_PROGRESS' && e.clipName === clipName
    ),
    map(e => ({ time: e.time, duration: e.duration })),
    throttleTime(throttleMs, undefined, { leading: true, trailing: true }),
    distinctUntilChanged((a, b) => Math.abs(a.time - b.time) < 0.05),
    shareReplay(1)
  );
}
