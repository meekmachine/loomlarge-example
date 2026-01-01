/**
 * React Hooks for RxJS Animation Stream
 *
 * These hooks subscribe to discrete animation events and read state
 * from the XState actor on demand - no snapshot copying.
 *
 * Benefits:
 * - No tick-based updates
 * - Throttled time updates to prevent UI jitter
 * - Per-snippet subscriptions for granular control
 * - `distinctUntilChanged` prevents redundant re-renders
 * - Events are just notifications; state is read from XState actor
 */

import { useState, useEffect, useRef } from 'react';
import { filter } from 'rxjs/operators';
import {
  animationEventEmitter,
  snippetState$,
  snippetTime$,
  snippetList$,
  globalPlaybackState$,
  bakedClipList$,
  playingBakedAnimations$,
  bakedAnimationState$,
  bakedAnimationProgress$,
} from '../latticework/animation/animationService';
import type {
  AnimationEvent,
  SnippetUIState,
  BakedClipInfo,
  BakedAnimationUIState,
} from '../latticework/animation/animationEvents';

// ============ Hook: Snippet list only ============

/**
 * Subscribe to snippet list changes only (add/remove).
 * More efficient than full state when only list structure matters.
 *
 * Returns array of snippet names.
 */
export function useSnippetList(): string[] {
  const [names, setNames] = useState<string[]>(() =>
    animationEventEmitter.getSnippets().map(s => s.name)
  );

  useEffect(() => {
    const sub = snippetList$.subscribe(setNames);
    return () => sub.unsubscribe();
  }, []);

  return names;
}

// ============ Hook: Single snippet state ============

/**
 * Subscribe to a single snippet's UI state.
 * Optimal for SnippetCard components.
 *
 * @param snippetName - Name of the snippet to subscribe to
 * @returns SnippetUIState or null if snippet doesn't exist
 */
export function useSnippetState(snippetName: string): SnippetUIState | null {
  const [state, setState] = useState<SnippetUIState | null>(() =>
    animationEventEmitter.getSnippet(snippetName)
  );

  useEffect(() => {
    const sub = snippetState$(snippetName).subscribe(setState);
    return () => sub.unsubscribe();
  }, [snippetName]);

  return state;
}

// ============ Hook: Throttled time updates ============

/**
 * Subscribe to a snippet's currentTime with throttling.
 * Prevents UI jitter during playback by limiting update frequency.
 *
 * @param snippetName - Name of the snippet
 * @param throttleMs - Minimum interval between updates (default: 100ms)
 * @returns Current time in seconds
 */
export function useSnippetTime(snippetName: string, throttleMs = 100): number {
  const [time, setTime] = useState<number>(() => {
    const snippet = animationEventEmitter.getSnippet(snippetName);
    return snippet?.currentTime ?? 0;
  });

  useEffect(() => {
    const sub = snippetTime$(snippetName, throttleMs).subscribe(setTime);
    return () => sub.unsubscribe();
  }, [snippetName, throttleMs]);

  return time;
}

// ============ Hook: Global playback state ============

/**
 * Subscribe to global playback state changes.
 */
export function useGlobalPlaybackState(): 'playing' | 'paused' | 'stopped' {
  const [state, setState] = useState<'playing' | 'paused' | 'stopped'>(() =>
    animationEventEmitter.getGlobalState()
  );

  useEffect(() => {
    const sub = globalPlaybackState$.subscribe(setState);
    return () => sub.unsubscribe();
  }, []);

  return state;
}

// ============ Hook: Animation events ============

/**
 * Subscribe to specific animation events.
 * Useful for responding to discrete events like loop completion.
 *
 * @param eventTypes - Array of event types to subscribe to
 * @param callback - Callback invoked when matching event occurs
 */
export function useAnimationEvent(
  eventTypes: AnimationEvent['type'][],
  callback: (event: AnimationEvent) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const typesKey = eventTypes.join(',');

  useEffect(() => {
    const sub = animationEventEmitter.events
      .pipe(filter(e => eventTypes.includes(e.type)))
      .subscribe(e => callbackRef.current(e));

    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey]);
}

// ============ Hook: Snippet list with full state ============

/**
 * Subscribe to the full snippet array (with UI state for each).
 * Used by PlaybackControls for the grouped snippet list.
 *
 * Only updates on add/remove events - not on every parameter change.
 */
export function useSnippets(): SnippetUIState[] {
  const [snippets, setSnippets] = useState<SnippetUIState[]>(() =>
    animationEventEmitter.getSnippets()
  );

  useEffect(() => {
    // Only subscribe to structural changes (add/remove)
    const sub = animationEventEmitter.events
      .pipe(filter(e => e.type === 'SNIPPET_ADDED' || e.type === 'SNIPPET_REMOVED'))
      .subscribe(() => {
        setSnippets(animationEventEmitter.getSnippets());
      });

    return () => sub.unsubscribe();
  }, []);

  return snippets;
}

// ============ Baked Animation Hooks ============

/**
 * Subscribe to the list of available baked animation clips.
 * Updates when clips are loaded from a model.
 */
export function useBakedClips(): BakedClipInfo[] {
  const [clips, setClips] = useState<BakedClipInfo[]>(() =>
    animationEventEmitter.getBakedClips()
  );

  useEffect(() => {
    const sub = bakedClipList$.subscribe(setClips);
    return () => sub.unsubscribe();
  }, []);

  return clips;
}

/**
 * Subscribe to the list of currently playing baked animations.
 * Updates on play/pause/stop/progress events.
 */
export function usePlayingBakedAnimations(): BakedAnimationUIState[] {
  const [animations, setAnimations] = useState<BakedAnimationUIState[]>(() =>
    animationEventEmitter.getPlayingBakedAnimations()
  );

  useEffect(() => {
    const sub = playingBakedAnimations$.subscribe(setAnimations);
    return () => sub.unsubscribe();
  }, []);

  return animations;
}

/**
 * Subscribe to a single baked animation's state.
 * Optimal for individual animation controls.
 */
export function useBakedAnimationState(clipName: string): BakedAnimationUIState | null {
  const [state, setState] = useState<BakedAnimationUIState | null>(() =>
    animationEventEmitter.getBakedAnimationState(clipName)
  );

  useEffect(() => {
    const sub = bakedAnimationState$(clipName).subscribe(setState);
    return () => sub.unsubscribe();
  }, [clipName]);

  return state;
}

/**
 * Subscribe to a baked animation's progress with throttling.
 * Prevents UI jitter during playback.
 */
export function useBakedAnimationProgress(
  clipName: string,
  throttleMs = 100
): { time: number; duration: number } {
  const [progress, setProgress] = useState<{ time: number; duration: number }>(() => {
    const state = animationEventEmitter.getBakedAnimationState(clipName);
    return { time: state?.time ?? 0, duration: state?.duration ?? 0 };
  });

  useEffect(() => {
    const sub = bakedAnimationProgress$(clipName, throttleMs).subscribe(setProgress);
    return () => sub.unsubscribe();
  }, [clipName, throttleMs]);

  return progress;
}
