/**
 * Prosodic Expression Agency - Public API
 * Prosodic gesture animations for speech (brow raises, head nods)
 */

// Main service
export { ProsodicService, createProsodicService } from './prosodicService';

// Types
export type {
  AnimationSnippet,
  AnimationCurve,
  ProsodicChannel,
  ProsodicConfig,
  ProsodicState,
  ProsodicCallbacks,
  FadeStep,
} from './types';

export { DEFAULT_ANIMATION_KEYS, DEFAULT_PROSODIC_CONFIG } from './types';
