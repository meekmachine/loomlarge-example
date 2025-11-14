/**
 * SAPI Viseme to ARKit Blendshape Mapping
 * Maps Microsoft SAPI viseme IDs (0-21) to ARKit-compatible viseme keys
 *
 * ARKit Viseme Keys (15 total):
 * 'EE', 'Er', 'IH', 'Ah', 'Oh', 'W_OO', 'S_Z', 'Ch_J', 'F_V', 'TH', 'T_L_D_N', 'B_M_P', 'K_G_H_NG', 'AE', 'R'
 *
 * This creates visually distinct mouth shapes for realistic lip-sync
 */

/**
 * Map SAPI viseme ID to ARKit viseme index (0-14)
 * These indices correspond to VISEME_KEYS array in shapeDict.ts
 */
export const SAPI_TO_ARKIT_INDEX: Record<number, number> = {
  0: 3,   // Silence → 'Ah' (neutral)
  1: 13,  // AE-AX-AH → 'AE' (cat, bat)
  2: 3,   // AA → 'Ah' (father)
  3: 4,   // AO → 'Oh' (law, caught)
  4: 0,   // EY-EH-UH → 'EE' (bait, bet)
  5: 1,   // ER → 'Er' (bird, her)
  6: 2,   // Y-IY-IH-IX → 'IH' (bit, happy)
  7: 5,   // W-UW → 'W_OO' (boot, would)
  8: 4,   // OW → 'Oh' (go, boat)
  9: 3,   // AW → 'Ah' (cow)
  10: 4,  // OY → 'Oh' (boy)
  11: 3,  // AY → 'Ah' (eye, my)
  12: 3,  // H → 'Ah' (hat)
  13: 14, // R → 'R' (red)
  14: 10, // L → 'T_L_D_N' (like)
  15: 6,  // S-Z → 'S_Z' (see, zoo)
  16: 7,  // SH-CH-JH-ZH → 'Ch_J' (shoe, church)
  17: 9,  // TH-DH → 'TH' (think, this)
  18: 8,  // F-V → 'F_V' (fish, very)
  19: 10, // D-T-N → 'T_L_D_N' (dog, top, now)
  20: 12, // K-G-NG → 'K_G_H_NG' (cat, go, sing)
  21: 11, // P-B-M → 'B_M_P' (put, boy, mom)
};

/**
 * ARKit viseme keys (must match VISEME_KEYS array in shapeDict.ts)
 */
export const ARKIT_VISEME_KEYS = [
  'EE', 'Er', 'IH', 'Ah', 'Oh', 'W_OO', 'S_Z', 'Ch_J', 'F_V', 'TH', 'T_L_D_N', 'B_M_P', 'K_G_H_NG', 'AE', 'R'
];

/**
 * Get ARKit viseme key for SAPI viseme ID
 */
export function getARKitVisemeKey(sapiId: number): string {
  const index = SAPI_TO_ARKIT_INDEX[sapiId] ?? 3; // Default to 'Ah'
  return ARKIT_VISEME_KEYS[index];
}

/**
 * Get ARKit viseme index for SAPI viseme ID (for animation curves)
 */
export function getARKitVisemeIndex(sapiId: number): number {
  return SAPI_TO_ARKIT_INDEX[sapiId] ?? 3; // Default to 'Ah' index
}

/**
 * Map SAPI viseme ID directly to jaw opening amount (0-1 scale)
 * This provides natural jaw movement based on phonetic properties
 */
export const SAPI_VISEME_JAW_MAP: Record<number, number> = {
  0: 0.0,   // Silence - closed
  1: 0.6,   // AE-AX-AH (neutral vowels, medium open)
  2: 1.0,   // AA (wide open - "father")
  3: 0.7,   // AO (rounded back, medium-wide)
  4: 0.6,   // EY-EH-UH (front vowels, medium)
  5: 0.4,   // ER (r-colored, medium)
  6: 0.2,   // Y-IY-IH-IX (high front, slight open - "bee")
  7: 0.4,   // W-UW (rounded, moderate - "boot")
  8: 0.7,   // OW (rounded back, medium-wide - "go")
  9: 0.8,   // AW (wide, diphthong - "cow")
  10: 0.6,  // OY (diphthong - "boy")
  11: 0.7,  // AY (wide diphthong - "eye")
  12: 0.3,  // H (glottal, small)
  13: 0.3,  // R (retroflex, small)
  14: 0.3,  // L (lateral, small)
  15: 0.1,  // S-Z (sibilants, nearly closed)
  16: 0.2,  // SH-CH-JH-ZH (postalveolar, slight)
  17: 0.2,  // TH-DH (dental, slight - tongue between teeth)
  18: 0.15, // F-V (labiodental, nearly closed - teeth on lip)
  19: 0.15, // D-T-N (alveolar stops, slight)
  20: 0.3,  // K-G-NG (velar, medium)
  21: 0.0,  // P-B-M (bilabial, fully closed)
};

/**
 * Get jaw activation amount for SAPI viseme ID
 */
export function getJawAmountForViseme(sapiId: number): number {
  return SAPI_VISEME_JAW_MAP[sapiId] ?? 0.3; // Default to moderate opening
}
