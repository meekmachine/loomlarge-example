import { useThreeState, type ThreeContextValue } from './threeContext';

export type EngineContextValue = ThreeContextValue;

// Simplified: only EngineThree for now
export function useEngineState(): EngineContextValue {
  return useThreeState();
}
