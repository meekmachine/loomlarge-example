/**
 * VisemeMapper
 * Maps phonemes directly to ARKit viseme indices (0-14)
 *
 * ARKit VISEME_KEYS (indices 0-14):
 * 0: EE, 1: Er, 2: IH, 3: Ah, 4: Oh, 5: W_OO, 6: S_Z, 7: Ch_J,
 * 8: F_V, 9: TH, 10: T_L_D_N, 11: B_M_P, 12: K_G_H_NG, 13: AE, 14: R
 */

import type { VisemeID, PhonemeMapping } from './types';

/**
 * Phoneme to ARKit Viseme Index mapping table
 * Maps directly to ARKit indices (0-14) - no SAPI conversion needed
 */
const PHONEME_TO_VISEME_MAP: Record<string, VisemeID> = {
  // Silence - maps to B_M_P (closed mouth)
  'sil': 11,
  'pau': 11,
  'PAUSE': 11,

  // Vowels
  'AE': 13,     // → AE (cat, bat)
  'AX': 3,      // → Ah (neutral schwa)
  'AH': 3,      // → Ah (father, cup)
  'AA': 3,      // → Ah (father)
  'AO': 4,      // → Oh (law, caught)
  'EY': 0,      // → EE (bait, say)
  'EH': 0,      // → EE (bet, head)
  'UH': 4,      // → Oh (book, put)
  'ER': 1,      // → Er (bird, her)
  'Y': 2,       // → IH (yes - onset)
  'IY': 2,      // → IH (bee, heat)
  'IH': 2,      // → IH (bit, happy)
  'IX': 2,      // → IH (roses)
  'W': 5,       // → W_OO (wet)
  'UW': 5,      // → W_OO (boot, blue)
  'OW': 4,      // → Oh (go, boat)
  'AW': 3,      // → Ah (cow)
  'OY': 4,      // → Oh (boy)
  'AY': 3,      // → Ah (eye, my)

  // Consonants
  'H': 3,       // → Ah (hat - open glottal)
  'HH': 3,      // → Ah (hat)
  'R': 14,      // → R (red)
  'L': 10,      // → T_L_D_N (like)
  'S': 6,       // → S_Z (see)
  'Z': 6,       // → S_Z (zoo)
  'SH': 7,      // → Ch_J (shoe)
  'CH': 7,      // → Ch_J (church)
  'JH': 7,      // → Ch_J (judge)
  'ZH': 7,      // → Ch_J (measure)
  'TH': 9,      // → TH (think)
  'DH': 9,      // → TH (this)
  'F': 8,       // → F_V (fish)
  'V': 8,       // → F_V (very)
  'D': 10,      // → T_L_D_N (dog)
  'T': 10,      // → T_L_D_N (top)
  'N': 10,      // → T_L_D_N (now)
  'K': 12,      // → K_G_H_NG (cat)
  'G': 12,      // → K_G_H_NG (go)
  'NG': 12,     // → K_G_H_NG (sing)
  'P': 11,      // → B_M_P (put)
  'B': 11,      // → B_M_P (boy)
  'M': 11,      // → B_M_P (mom)
};

/**
 * Default duration for each viseme in milliseconds
 * Optimized for snappy, responsive lip-sync
 * Vowels are typically 1.5-2x longer than consonants
 */
const DEFAULT_VOWEL_DURATION = 120; // Reduced from 150 for faster speech
const DEFAULT_CONSONANT_DURATION = 60; // Reduced from 80 for quicker consonants

/**
 * Special pause durations based on punctuation
 * Reduced for more natural, flowing speech
 */
const PAUSE_DURATIONS: Record<string, number> = {
  'PAUSE_SPACE': 50,  // Reduced from 500 - minimal pause between words
  'PAUSE_COMMA': 180, // Reduced from 300
  'PAUSE_PERIOD': 400, // Reduced from 700
  'PAUSE_QUESTION': 400, // Reduced from 700
  'PAUSE_EXCLAMATION': 400, // Reduced from 700
  'PAUSE_SEMICOLON': 250, // Reduced from 400
  'PAUSE_COLON': 250, // Reduced from 400
};

export class VisemeMapper {
  /**
   * Map a single phoneme to its viseme ID and duration
   */
  public getVisemeAndDuration(phoneme: string): PhonemeMapping {
    // Handle pause tokens - return B_M_P (closed mouth)
    if (phoneme.startsWith('PAUSE_')) {
      const duration = PAUSE_DURATIONS[phoneme] || 300;
      return {
        phoneme,
        viseme: 11, // B_M_P (closed mouth)
        duration,
      };
    }

    // Normalize phoneme (uppercase, remove stress markers)
    const normalizedPhoneme = phoneme.toUpperCase().replace(/[0-9]/g, '');

    const visemeId = PHONEME_TO_VISEME_MAP[normalizedPhoneme] ?? 11; // Default to B_M_P (closed)

    // Determine duration based on whether it's a vowel or consonant
    const isVowelPhoneme = this.isVowel(normalizedPhoneme);
    const baseDuration = isVowelPhoneme ? DEFAULT_VOWEL_DURATION : DEFAULT_CONSONANT_DURATION;

    return {
      phoneme: normalizedPhoneme,
      viseme: visemeId,
      duration: baseDuration,
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
    // Vowel phonemes (CMU set)
    const vowels = new Set([
      'AA', 'AE', 'AH', 'AO', 'AW', 'AX', 'AY',
      'EH', 'ER', 'EY',
      'IH', 'IX', 'IY',
      'OW', 'OY',
      'UH', 'UW'
    ]);
    return vowels.has(normalizedPhoneme);
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
