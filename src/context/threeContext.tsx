import React, { createContext, useContext, useRef, useEffect } from 'react';
import { EngineThree } from '../engine/EngineThree';
import { createAnimationService, type AnimationService } from '../latticework/animation/animationService';
import type { Engine } from '../engine/EngineThree.types';

export type ThreeContextValue = {
  engine: EngineThree;
  /** Animation service for scheduling and playing animation snippets */
  anim: AnimationService;
};

const ThreeCtx = createContext<ThreeContextValue | null>(null);

/**
 * Create an Engine adapter that wraps EngineThree for the animation service.
 * This adapts EngineThree's methods to the Engine interface expected by AnimationService.
 */
function createEngineAdapter(engine: EngineThree): Engine {
  return {
    applyAU: (id, v) => engine.setAU(id as number, v),
    setMorph: (key, v) => engine.setMorph(key, v),
    transitionAU: (id, v, dur, balance) => engine.transitionAU(id as number, v, dur, balance),
    transitionMorph: (key, v, dur) => engine.transitionMorph(key, v, dur),
    setViseme: (idx, v, jawScale) => engine.setViseme(idx, v, jawScale),
    transitionViseme: (idx, v, dur, jawScale) => engine.transitionViseme(idx, v, dur, jawScale),
    onSnippetEnd: (name) => {
      try {
        window.dispatchEvent(new CustomEvent('visos:snippetEnd', { detail: { name } }));
      } catch {}
      try {
        (window as any).__lastSnippetEnded = name;
      } catch {}
    }
  };
}

/**
 * ThreeProvider - Provides EngineThree and animation service via React context.
 *
 * EngineThree handles low-level rendering (morphs, bones, transitions).
 * AnimationService handles high-level animation scheduling and playback.
 * This provider creates both and wires them together.
 */
export const ThreeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const engineRef = useRef<EngineThree | null>(null);
  const animRef = useRef<AnimationService | null>(null);

  // Create engine singleton (once, outside of render cycle)
  if (!engineRef.current) {
    engineRef.current = new EngineThree();
    if (typeof window !== 'undefined') {
      (window as any).engine = engineRef.current;
    }
  }

  // Create animation service (once, after engine exists)
  if (!animRef.current && engineRef.current) {
    const host = createEngineAdapter(engineRef.current);
    animRef.current = createAnimationService(host);
  }

  const engine = engineRef.current;
  const anim = animRef.current!;

  // Start engine on mount, dispose both on unmount
  useEffect(() => {
    engine.start();
    return () => {
      anim.dispose();
      engine.dispose();
    };
  }, [engine, anim]);

  // Stable context value - references never change
  const valueRef = useRef<ThreeContextValue | null>(null);
  if (!valueRef.current) {
    valueRef.current = { engine, anim };
  }

  return <ThreeCtx.Provider value={valueRef.current}>{children}</ThreeCtx.Provider>;
};

export function useThreeState() {
  const ctx = useContext(ThreeCtx);
  if (!ctx) throw new Error('useThreeState must be used within a ThreeProvider');
  return ctx;
}

export function useThreeOptional() {
  return useContext(ThreeCtx);
}
