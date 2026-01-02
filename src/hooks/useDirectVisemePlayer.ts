/**
 * React hook for direct viseme playback
 * Provides a simple API to play text as lip-sync animation
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { DirectVisemePlayer, VisemePlayerConfig, createDirectVisemePlayer } from '../utils/directVisemePlayer';
import { LoomLargeThree } from 'loom3';

export interface UseDirectVisemePlayerOptions extends Partial<VisemePlayerConfig> {
  /** Engine instance (required) */
  engine: LoomLargeThree | null | undefined;
}

export interface UseDirectVisemePlayerReturn {
  /** Play text as viseme animation */
  play: (text: string) => Promise<void>;
  /** Stop current playback */
  stop: () => void;
  /** Whether currently playing */
  isPlaying: boolean;
  /** Update player configuration */
  updateConfig: (config: Partial<VisemePlayerConfig>) => void;
}

/**
 * Hook to use the direct viseme player
 */
export function useDirectVisemePlayer(
  options: UseDirectVisemePlayerOptions
): UseDirectVisemePlayerReturn {
  const { engine, ...config } = options;
  const playerRef = useRef<DirectVisemePlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Create/update player when engine changes
  useEffect(() => {
    if (engine) {
      playerRef.current = createDirectVisemePlayer(engine, config);
    } else {
      playerRef.current = null;
    }
    return () => {
      playerRef.current?.stop();
    };
  }, [engine]);

  // Update config when it changes
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.updateConfig(config);
    }
  }, [config.intensity, config.speechRate, config.jawScale, config.blendOverlap, config.minTransitionMs]);

  const play = useCallback(async (text: string) => {
    if (!playerRef.current) {
      console.warn('DirectVisemePlayer: No engine available');
      return;
    }

    setIsPlaying(true);
    try {
      await playerRef.current.playText(text);
    } finally {
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stop();
    setIsPlaying(false);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<VisemePlayerConfig>) => {
    playerRef.current?.updateConfig(newConfig);
  }, []);

  return {
    play,
    stop,
    isPlaying,
    updateConfig,
  };
}
