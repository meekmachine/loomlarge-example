/**
 * LipSync Agency - Public API
 * Lip-sync animation for facial animation engines
 */

// Main service
export { LipSyncService, createLipSyncService } from './lipSyncService';

// Utilities
export { VisemeMapper, visemeMapper } from './VisemeMapper';
export { PhonemeExtractor, phonemeExtractor } from './PhonemeExtractor';

// Types
export type {
  VisemeID,
  VisemeEvent,
  AnimationCurve,
  VisemeSnippet,
  LipSyncConfig,
  LipSyncState,
  LipSyncCallbacks,
  PhonemeMapping,
  SAPIViseme,
  SAPIResponse,
  PhonemeTiming,
} from './types';

export { VISEME_NAMES } from './types';
