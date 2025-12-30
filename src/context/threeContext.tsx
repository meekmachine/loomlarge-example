import React, { createContext, useContext, useState, useCallback } from 'react';
import type { LoomLargeThree } from 'loomlarge';
import type { AnimationService } from '../latticework/animation/animationService';

export type ThreeContextValue = {
  engine: LoomLargeThree | null;
  anim: AnimationService | null;
  setEngine: (engine: LoomLargeThree, anim: AnimationService) => void;
};

const ThreeCtx = createContext<ThreeContextValue | null>(null);

/**
 * ThreeProvider - Simple context holder for LoomLarge engine and animation service.
 *
 * The engine is created in CharacterGLBScene and passed up via onReady callback.
 * This provider just holds the references and makes them available to the rest of the app.
 */
export const ThreeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [engine, setEngineState] = useState<LoomLargeThree | null>(null);
  const [anim, setAnimState] = useState<AnimationService | null>(null);

  const setEngine = useCallback((newEngine: LoomLargeThree, newAnim: AnimationService) => {
    setEngineState(newEngine);
    setAnimState(newAnim);
  }, []);

  return (
    <ThreeCtx.Provider value={{ engine, anim, setEngine }}>
      {children}
    </ThreeCtx.Provider>
  );
};

/**
 * Hook to access engine and animation service.
 * Throws if engine is not yet available.
 */
export function useThreeState() {
  const ctx = useContext(ThreeCtx);
  if (!ctx) throw new Error('useThreeState must be used within a ThreeProvider');
  if (!ctx.engine || !ctx.anim) {
    throw new Error('Engine not yet initialized. Wait for CharacterGLBScene onReady.');
  }
  return { engine: ctx.engine, anim: ctx.anim };
}

/**
 * Hook to access engine and animation service, or null if not yet ready.
 * Use this when you need to handle the loading state.
 */
export function useThreeOptional() {
  const ctx = useContext(ThreeCtx);
  return ctx ? { engine: ctx.engine, anim: ctx.anim, setEngine: ctx.setEngine } : null;
}

/**
 * Hook to get the setEngine callback for wiring up the scene.
 */
export function useSetEngine() {
  const ctx = useContext(ThreeCtx);
  if (!ctx) throw new Error('useSetEngine must be used within a ThreeProvider');
  return ctx.setEngine;
}
