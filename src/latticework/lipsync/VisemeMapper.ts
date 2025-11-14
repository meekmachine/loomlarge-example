/**
 * VisemeMapper
 * Maps phonemes to Microsoft SAPI viseme IDs (0-21)
 * Based on CMU phoneme set and SAPI viseme specification
 */

import type { VisemeID, PhonemeMapping } from './types';

/**
 * Phoneme to Viseme mapping table
 * Based on Microsoft SAPI viseme specification
 */
const PHONEME_TO_VISEME_MAP: Record<string, VisemeID> = {
  // Silence
  'sil': 0,
  'pau': 0,
  'PAUSE': 0,

  // Viseme 1: AE, AX, AH
  'AE': 1,
  'AX': 1,
  'AH': 1,

  // Viseme 2: AA
  'AA': 2,

  // Viseme 3: AO
  'AO': 3,

  // Viseme 4: EY, EH, UH
  'EY': 4,
  'EH': 4,
  'UH': 4,

  // Viseme 5: ER
  'ER': 5,

  // Viseme 6: Y, IY, IH, IX
  'Y': 6,
  'IY': 6,
  'IH': 6,
  'IX': 6,

  // Viseme 7: W, UW
  'W': 7,
  'UW': 7,

  // Viseme 8: OW
  'OW': 8,

  // Viseme 9: AW
  'AW': 9,

  // Viseme 10: OY
  'OY': 10,

  // Viseme 11: AY
  'AY': 11,

  // Viseme 12: H
  'H': 12,
  'HH': 12,

  // Viseme 13: R
  'R': 13,

  // Viseme 14: L
  'L': 14,

  // Viseme 15: S, Z
  'S': 15,
  'Z': 15,

  // Viseme 16: SH, CH, JH, ZH
  'SH': 16,
  'CH': 16,
  'JH': 16,
  'ZH': 16,

  // Viseme 17: TH, DH
  'TH': 17,
  'DH': 17,

  // Viseme 18: F, V
  'F': 18,
  'V': 18,

  // Viseme 19: D, T, N
  'D': 19,
  'T': 19,
  'N': 19,

  // Viseme 20: K, G, NG
  'K': 20,
  'G': 20,
  'NG': 20,

  // Viseme 21: P, B, M
  'P': 21,
  'B': 21,
  'M': 21,
};

/**
 * Default duration for each viseme in milliseconds
 * Can be adjusted based on speech rate
 */
const DEFAULT_VISEME_DURATION = 100;

/**
 * Special pause durations based on punctuation
 */
const PAUSE_DURATIONS: Record<string, number> = {
  'PAUSE_SPACE': 500,
  'PAUSE_COMMA': 300,
  'PAUSE_PERIOD': 700,
  'PAUSE_QUESTION': 700,
  'PAUSE_EXCLAMATION': 700,
  'PAUSE_SEMICOLON': 400,
  'PAUSE_COLON': 400,
};

export class VisemeMapper {
  /**
   * Map a single phoneme to its viseme ID and duration
   */
  public getVisemeAndDuration(phoneme: string): PhonemeMapping {
    // Handle pause tokens
    if (phoneme.startsWith('PAUSE_')) {
      const duration = PAUSE_DURATIONS[phoneme] || 300;
      return {
        phoneme,
        viseme: 0, // Silence viseme
        duration,
      };
    }

    // Normalize phoneme (uppercase, remove stress markers)
    const normalizedPhoneme = phoneme.toUpperCase().replace(/[0-9]/g, '');

    const visemeId = PHONEME_TO_VISEME_MAP[normalizedPhoneme] ?? 0;

    return {
      phoneme: normalizedPhoneme,
      viseme: visemeId,
      duration: DEFAULT_VISEME_DURATION,
    };
  }

  /**
   * Map an array of phonemes to viseme sequence
   */
  public mapPhonemesToVisemes(phonemes: string[]): PhonemeMapping[] {
    return phonemes.map(phoneme => this.getVisemeAndDuration(phoneme));
  }

  /**
   * Get viseme ID from phoneme (convenience method)
   */
  public getViseme(phoneme: string): VisemeID {
    return this.getVisemeAndDuration(phoneme).viseme;
  }

  /**
   * Check if a phoneme is a vowel (typically longer duration)
   */
  public isVowel(phoneme: string): boolean {
    const normalizedPhoneme = phoneme.toUpperCase().replace(/[0-9]/g, '');
    const visemeId = PHONEME_TO_VISEME_MAP[normalizedPhoneme];

    // Visemes 1-11 are vowels/diphthongs
    return visemeId !== undefined && visemeId >= 1 && visemeId <= 11;
  }

  /**
   * Adjust duration based on speech rate
   */
  public adjustDuration(baseDuration: number, speechRate: number): number {
    return Math.round(baseDuration / speechRate);
  }

  /**
   * Get all supported phonemes
   */
  public getSupportedPhonemes(): string[] {
    return Object.keys(PHONEME_TO_VISEME_MAP);
  }

  /**
   * Get phoneme to viseme mapping table (for debugging)
   */
  public getMappingTable(): Record<string, VisemeID> {
    return { ...PHONEME_TO_VISEME_MAP };
  }
}

// Export singleton instance
export const visemeMapper = new VisemeMapper();
