import { useThreeState, useThreeOptional, type ThreeContextValue } from './threeContext';

// Re-export for backwards compatibility
export type EngineContextValue = {
  engine: NonNullable<ThreeContextValue['engine']>;
  anim: NonNullable<ThreeContextValue['anim']>;
};

export function useEngineState(): EngineContextValue {
  return useThreeState();
}

export function useEngineOptional() {
  const ctx = useThreeOptional();
  if (!ctx || !ctx.engine || !ctx.anim) return null;
  return { engine: ctx.engine, anim: ctx.anim };
}
