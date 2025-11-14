/**
 * PhonemeExtractor
 * Extracts phonemes from text for lip-sync animation
 * Uses simple heuristic-based phoneme extraction (no external dependencies)
 */

/**
 * Simple phoneme dictionary for common English words
 * Format: word -> phoneme array
 * This is a minimal dictionary - can be expanded as needed
 */
const PHONEME_DICT: Record<string, string[]> = {
  // Common words
  'hello': ['HH', 'EH', 'L', 'OW'],
  'world': ['W', 'ER', 'L', 'D'],
  'the': ['DH', 'AH'],
  'a': ['AH'],
  'an': ['AE', 'N'],
  'and': ['AE', 'N', 'D'],
  'or': ['AO', 'R'],
  'but': ['B', 'AH', 'T'],
  'is': ['IH', 'Z'],
  'are': ['AA', 'R'],
  'was': ['W', 'AA', 'Z'],
  'were': ['W', 'ER'],
  'be': ['B', 'IY'],
  'been': ['B', 'IH', 'N'],
  'have': ['HH', 'AE', 'V'],
  'has': ['HH', 'AE', 'Z'],
  'had': ['HH', 'AE', 'D'],
  'do': ['D', 'UW'],
  'does': ['D', 'AH', 'Z'],
  'did': ['D', 'IH', 'D'],
  'will': ['W', 'IH', 'L'],
  'would': ['W', 'UH', 'D'],
  'can': ['K', 'AE', 'N'],
  'could': ['K', 'UH', 'D'],
  'should': ['SH', 'UH', 'D'],
  'may': ['M', 'EY'],
  'might': ['M', 'AY', 'T'],
  'must': ['M', 'AH', 'S', 'T'],
  'i': ['AY'],
  'you': ['Y', 'UW'],
  'he': ['HH', 'IY'],
  'she': ['SH', 'IY'],
  'it': ['IH', 'T'],
  'we': ['W', 'IY'],
  'they': ['DH', 'EY'],
  'me': ['M', 'IY'],
  'him': ['HH', 'IH', 'M'],
  'her': ['HH', 'ER'],
  'us': ['AH', 'S'],
  'them': ['DH', 'EH', 'M'],
  'my': ['M', 'AY'],
  'your': ['Y', 'AO', 'R'],
  'his': ['HH', 'IH', 'Z'],
  'our': ['AW', 'R'],
  'their': ['DH', 'EH', 'R'],
  'this': ['DH', 'IH', 'S'],
  'that': ['DH', 'AE', 'T'],
  'these': ['DH', 'IY', 'Z'],
  'those': ['DH', 'OW', 'Z'],
  'what': ['W', 'AH', 'T'],
  'when': ['W', 'EH', 'N'],
  'where': ['W', 'EH', 'R'],
  'who': ['HH', 'UW'],
  'which': ['W', 'IH', 'CH'],
  'why': ['W', 'AY'],
  'how': ['HH', 'AW'],
  'yes': ['Y', 'EH', 'S'],
  'no': ['N', 'OW'],
  'not': ['N', 'AA', 'T'],
  'all': ['AO', 'L'],
  'some': ['S', 'AH', 'M'],
  'any': ['EH', 'N', 'IY'],
  'many': ['M', 'EH', 'N', 'IY'],
  'much': ['M', 'AH', 'CH'],
  'more': ['M', 'AO', 'R'],
  'most': ['M', 'OW', 'S', 'T'],
  'other': ['AH', 'DH', 'ER'],
  'such': ['S', 'AH', 'CH'],
  'very': ['V', 'EH', 'R', 'IY'],
  'good': ['G', 'UH', 'D'],
  'new': ['N', 'UW'],
  'first': ['F', 'ER', 'S', 'T'],
  'last': ['L', 'AE', 'S', 'T'],
  'long': ['L', 'AO', 'NG'],
  'great': ['G', 'R', 'EY', 'T'],
  'little': ['L', 'IH', 'T', 'AH', 'L'],
  'own': ['OW', 'N'],
  'old': ['OW', 'L', 'D'],
  'right': ['R', 'AY', 'T'],
  'big': ['B', 'IH', 'G'],
  'high': ['HH', 'AY'],
  'different': ['D', 'IH', 'F', 'ER', 'AH', 'N', 'T'],
  'small': ['S', 'M', 'AO', 'L'],
  'large': ['L', 'AA', 'R', 'JH'],
  'next': ['N', 'EH', 'K', 'S', 'T'],
  'early': ['ER', 'L', 'IY'],
  'young': ['Y', 'AH', 'NG'],
};

/**
 * Phoneme patterns for grapheme-to-phoneme conversion
 * Simple rule-based patterns for common letter combinations
 */
const GRAPHEME_PATTERNS: Array<{ pattern: RegExp; phonemes: string[] }> = [
  // Vowels
  { pattern: /^a$/i, phonemes: ['AH'] },
  { pattern: /^e$/i, phonemes: ['IY'] },
  { pattern: /^i$/i, phonemes: ['AY'] },
  { pattern: /^o$/i, phonemes: ['OW'] },
  { pattern: /^u$/i, phonemes: ['Y', 'UW'] },

  // Consonants
  { pattern: /^b/i, phonemes: ['B'] },
  { pattern: /^c(?=[eiy])/i, phonemes: ['S'] },
  { pattern: /^c/i, phonemes: ['K'] },
  { pattern: /^d/i, phonemes: ['D'] },
  { pattern: /^f/i, phonemes: ['F'] },
  { pattern: /^g(?=[eiy])/i, phonemes: ['JH'] },
  { pattern: /^g/i, phonemes: ['G'] },
  { pattern: /^h/i, phonemes: ['HH'] },
  { pattern: /^j/i, phonemes: ['JH'] },
  { pattern: /^k/i, phonemes: ['K'] },
  { pattern: /^l/i, phonemes: ['L'] },
  { pattern: /^m/i, phonemes: ['M'] },
  { pattern: /^n/i, phonemes: ['N'] },
  { pattern: /^p/i, phonemes: ['P'] },
  { pattern: /^qu/i, phonemes: ['K', 'W'] },
  { pattern: /^r/i, phonemes: ['R'] },
  { pattern: /^s(?=h)/i, phonemes: ['SH'] },
  { pattern: /^s/i, phonemes: ['S'] },
  { pattern: /^t(?=h)/i, phonemes: ['TH'] },
  { pattern: /^t/i, phonemes: ['T'] },
  { pattern: /^v/i, phonemes: ['V'] },
  { pattern: /^w/i, phonemes: ['W'] },
  { pattern: /^x/i, phonemes: ['K', 'S'] },
  { pattern: /^y(?=[aeiou])/i, phonemes: ['Y'] },
  { pattern: /^y/i, phonemes: ['IY'] },
  { pattern: /^z/i, phonemes: ['Z'] },
];

export class PhonemeExtractor {
  /**
   * Extract phonemes from text
   * Returns array of phoneme strings including PAUSE tokens
   */
  public extractPhonemes(text: string): string[] {
    const phonemes: string[] = [];

    // Tokenize by words and punctuation
    const tokens = this.tokenize(text);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Handle punctuation (add pauses)
      if (this.isPunctuation(token)) {
        const pauseToken = this.getPauseToken(token);
        if (pauseToken) {
          phonemes.push(pauseToken);
        }
        continue;
      }

      // Convert word to phonemes
      const word = token.toLowerCase();
      const wordPhonemes = this.wordToPhonemes(word);
      phonemes.push(...wordPhonemes);

      // Add small pause between words (except before punctuation)
      const nextToken = tokens[i + 1];
      if (nextToken && !this.isPunctuation(nextToken)) {
        phonemes.push('PAUSE_SPACE');
      }
    }

    return phonemes;
  }

  /**
   * Tokenize text into words and punctuation
   */
  private tokenize(text: string): string[] {
    // Split on whitespace and punctuation, but keep punctuation
    return text
      .replace(/([.,!?;:])/g, ' $1 ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  /**
   * Check if token is punctuation
   */
  private isPunctuation(token: string): boolean {
    return /^[.,!?;:]$/.test(token);
  }

  /**
   * Get pause token for punctuation
   */
  private getPauseToken(punctuation: string): string | null {
    const pauseMap: Record<string, string> = {
      ' ': 'PAUSE_SPACE',
      ',': 'PAUSE_COMMA',
      '.': 'PAUSE_PERIOD',
      '?': 'PAUSE_QUESTION',
      '!': 'PAUSE_EXCLAMATION',
      ';': 'PAUSE_SEMICOLON',
      ':': 'PAUSE_COLON',
    };

    return pauseMap[punctuation] || null;
  }

  /**
   * Convert a word to phonemes
   * Uses dictionary lookup first, falls back to grapheme-to-phoneme rules
   */
  private wordToPhonemes(word: string): string[] {
    // Dictionary lookup
    if (PHONEME_DICT[word]) {
      return [...PHONEME_DICT[word]];
    }

    // Fallback to simple grapheme-to-phoneme conversion
    return this.graphemeToPhoneme(word);
  }

  /**
   * Simple grapheme-to-phoneme conversion
   * This is a very basic implementation - can be improved
   */
  private graphemeToPhoneme(word: string): string[] {
    const phonemes: string[] = [];
    let remaining = word;

    while (remaining.length > 0) {
      let matched = false;

      // Try to match patterns
      for (const { pattern, phonemes: phonemeList } of GRAPHEME_PATTERNS) {
        if (pattern.test(remaining)) {
          phonemes.push(...phonemeList);
          remaining = remaining.replace(pattern, '');
          matched = true;
          break;
        }
      }

      // If no match, skip the character
      if (!matched) {
        remaining = remaining.slice(1);
      }
    }

    return phonemes.length > 0 ? phonemes : ['AH']; // Default to neutral vowel
  }

  /**
   * Add a word to the dictionary (for runtime extension)
   */
  public addWord(word: string, phonemes: string[]): void {
    PHONEME_DICT[word.toLowerCase()] = phonemes;
  }

  /**
   * Get the phoneme dictionary (for debugging)
   */
  public getDictionary(): Record<string, string[]> {
    return { ...PHONEME_DICT };
  }
}

// Export singleton instance
export const phonemeExtractor = new PhonemeExtractor();
