# LipSync Agency

Lip-synchronization service for Latticework with phoneme extraction and viseme animation.

## Features

- **Dual Engine Support**: WebSpeech API and SAPI integration
- **Phoneme Extraction**: Automatic phoneme detection from text
- **Viseme Mapping**: 22-viseme Microsoft SAPI system (IDs 0-21)
- **Timeline Animation**: Precise viseme timing with onset/hold/release curves
- **Configurable Parameters**: Intensity, hold duration, speech rate control
- **No External Dependencies**: Built-in phoneme dictionary and extraction

## Installation

The LipSync agency is part of Latticework and requires no additional installation.

## Quick Start

```typescript
import { createLipSyncService } from '@/latticework/lipsync';
import { EngineThree } from '@/engine/EngineThree';

const engine = new EngineThree();

// Create LipSync service
const lipSync = createLipSyncService(
  {
    engine: 'webSpeech',
    onsetIntensity: 90,  // 0-100
    holdMs: 140,          // Viseme hold time
    speechRate: 1.0,      // Speed multiplier
  },
  {
    onVisemeStart: (visemeId, intensity) => {
      console.log(`Viseme ${visemeId} started at ${intensity}%`);
      // Trigger facial animation
      engine.setMouthShape(visemeId, intensity / 100);
    },
    onVisemeEnd: (visemeId) => {
      console.log(`Viseme ${visemeId} ended`);
      // Return to neutral
      engine.setMouthShape(visemeId, 0);
    },
    onSpeechStart: () => console.log('Speech started'),
    onSpeechEnd: () => console.log('Speech ended'),
  }
);

// WebSpeech mode: Manual viseme triggers
lipSync.handleViseme(21, 90); // P/B/M sound at 90% intensity

// SAPI mode: Full timeline
const sapiVisemes = [
  { number: 21, offset: 0, duration: 100 },     // P
  { number: 1, offset: 100, duration: 120 },    // AE
  { number: 19, offset: 220, duration: 80 },    // T
];
const snippet = lipSync.handleSapiVisemes(sapiVisemes);

// Extract viseme timeline from text
const timeline = lipSync.extractVisemeTimeline('Hello world');
console.log(timeline);
// [
//   { visemeId: 12, offsetMs: 0, durationMs: 100 },    // H
//   { visemeId: 4, offsetMs: 100, durationMs: 100 },   // EH
//   { visemeId: 14, offsetMs: 200, durationMs: 100 },  // L
//   ...
// ]

// Stop and cleanup
lipSync.stop();
lipSync.dispose();
```

## API Reference

### `createLipSyncService(config?, callbacks?)`

Creates a new LipSync service instance.

**Parameters:**

- `config` - LipSync configuration
  - `engine?: 'webSpeech' | 'sapi'` - TTS engine mode (default: `'webSpeech'`)
  - `onsetIntensity?: number` - Initial viseme intensity, 0-100 (default: `90`)
  - `holdMs?: number` - Viseme hold duration in ms (default: `140`)
  - `speechRate?: number` - Speech rate multiplier, 0.1-10.0 (default: `1.0`)

- `callbacks` - Event callbacks
  - `onVisemeStart?: (visemeId: VisemeID, intensity: number) => void` - Viseme onset
  - `onVisemeEnd?: (visemeId: VisemeID) => void` - Viseme release
  - `onSpeechStart?: () => void` - Speech begins
  - `onSpeechEnd?: () => void` - Speech ends
  - `onError?: (error: Error) => void` - Error handler

### `LipSyncService` Methods

#### `handleViseme(visemeId: VisemeID, intensity?: number): void`

Trigger a single viseme with hold duration (WebSpeech mode).

```typescript
lipSync.handleViseme(21, 90); // Bilabial (P/B/M) at 90% intensity
```

#### `handleSapiVisemes(visemes: SAPIViseme[]): VisemeSnippet`

Process a SAPI viseme timeline and execute animation.

```typescript
const visemes = [
  { number: 12, offset: 0, duration: 100 },
  { number: 4, offset: 100, duration: 120 },
];
const snippet = lipSync.handleSapiVisemes(visemes);
```

**Returns:** `VisemeSnippet` with animation curves for all 22 visemes.

#### `extractVisemeTimeline(text: string): VisemeEvent[]`

Extract viseme sequence from text using phoneme analysis.

```typescript
const timeline = lipSync.extractVisemeTimeline('Hello');
// Returns: [{ visemeId, offsetMs, durationMs }, ...]
```

#### `stop(): void`

Stop current animation and return to neutral.

```typescript
lipSync.stop();
```

#### `updateConfig(config: Partial<LipSyncConfig>): void`

Update service configuration.

```typescript
lipSync.updateConfig({ onsetIntensity: 80, speechRate: 1.2 });
```

#### `getState(): LipSyncState`

Get current service state.

```typescript
const state = lipSync.getState();
// { status: 'speaking', currentViseme: 21, intensity: 90 }
```

#### `dispose(): void`

Cleanup and release resources.

```typescript
lipSync.dispose();
```

## Viseme System

The LipSync agency uses the Microsoft SAPI 22-viseme system (IDs 0-21):

| ID | Viseme | Phonemes | Description |
|----|--------|----------|-------------|
| 0 | Silence | sil, pau | Mouth closed/neutral |
| 1 | AE-AX-AH | AE, AX, AH | Open front vowel |
| 2 | AA | AA | Open back vowel |
| 3 | AO | AO | Open-mid back rounded |
| 4 | EY-EH-UH | EY, EH, UH | Mid front vowels |
| 5 | ER | ER | R-colored vowel |
| 6 | Y-IY-IH-IX | Y, IY, IH, IX | Close front vowels |
| 7 | W-UW | W, UW | Close back rounded |
| 8 | OW | OW | Diphthong O |
| 9 | AW | AW | Diphthong OW |
| 10 | OY | OY | Diphthong OI |
| 11 | AY | AY | Diphthong AI |
| 12 | H | H, HH | Glottal fricative |
| 13 | R | R | Retroflex approximant |
| 14 | L | L | Lateral approximant |
| 15 | S-Z | S, Z | Alveolar fricatives |
| 16 | SH-CH-JH-ZH | SH, CH, JH, ZH | Postalveolar fricatives |
| 17 | TH-DH | TH, DH | Dental fricatives |
| 18 | F-V | F, V | Labiodental fricatives |
| 19 | D-T-N | D, T, N | Alveolar stops/nasal |
| 20 | K-G-NG | K, G, NG | Velar stops/nasal |
| 21 | P-B-M | P, B, M | Bilabial stops/nasal |

## Phoneme Extraction

The LipSync agency includes a built-in phoneme extractor:

```typescript
import { phonemeExtractor } from '@/latticework/lipsync';

// Extract phonemes from text
const phonemes = phonemeExtractor.extractPhonemes('Hello, world!');
// Returns: ['HH', 'EH', 'L', 'OW', 'PAUSE_COMMA', 'W', 'ER', 'L', 'D', 'PAUSE_PERIOD']

// Add custom words to dictionary
phonemeExtractor.addWord('anthropic', ['AE', 'N', 'TH', 'R', 'AH', 'P', 'IH', 'K']);
```

**Pause Tokens:**
- `PAUSE_SPACE` - 500ms between words
- `PAUSE_COMMA` - 300ms after comma
- `PAUSE_PERIOD` - 700ms after period
- `PAUSE_QUESTION` - 700ms after question mark
- `PAUSE_EXCLAMATION` - 700ms after exclamation

## Viseme Mapping

The viseme mapper converts phonemes to viseme IDs:

```typescript
import { visemeMapper } from '@/latticework/lipsync';

// Get viseme and duration for a phoneme
const mapping = visemeMapper.getVisemeAndDuration('P');
// { phoneme: 'P', viseme: 21, duration: 100 }

// Map multiple phonemes
const mappings = visemeMapper.mapPhonemesToVisemes(['H', 'EH', 'L', 'OW']);

// Check if phoneme is a vowel
const isVowel = visemeMapper.isVowel('AE'); // true

// Adjust duration by speech rate
const adjustedDuration = visemeMapper.adjustDuration(100, 1.5); // 67ms
```

## Integration with Facial Engine

Example integration with EngineThree:

```typescript
import { createLipSyncService } from '@/latticework/lipsync';
import { EngineThree } from '@/engine/EngineThree';

const engine = new EngineThree();

const lipSync = createLipSyncService(
  { engine: 'webSpeech', onsetIntensity: 90 },
  {
    onVisemeStart: (visemeId, intensity) => {
      // Map viseme to jaw/lip AUs
      const normalizedIntensity = intensity / 100;

      // Jaw drop (AU26) based on vowel openness
      if (visemeId >= 1 && visemeId <= 11) {
        engine.setAU(26, normalizedIntensity * 0.8);
      }

      // Lip rounding (AU18) for rounded vowels
      if (visemeId === 7 || visemeId === 8) {
        engine.setAU(18, normalizedIntensity * 0.6);
      }

      // Lip closure (AU24) for bilabials
      if (visemeId === 21) {
        engine.setAU(24, normalizedIntensity);
      }

      // Lip stretch for alveolar sounds
      if (visemeId === 15 || visemeId === 19) {
        engine.setAU(20, normalizedIntensity * 0.4);
      }
    },
    onVisemeEnd: (visemeId) => {
      // Smooth return to neutral
      engine.setAU(26, 0); // Jaw
      engine.setAU(18, 0); // Lip round
      engine.setAU(24, 0); // Lip close
      engine.setAU(20, 0); // Lip stretch
    },
  }
);
```

## Integration with TTS Agency

Combine LipSync with TTS for automatic lip-sync:

```typescript
import { createTTSService } from '@/latticework/tts';
import { createLipSyncService } from '@/latticework/lipsync';

const lipSync = createLipSyncService({ engine: 'webSpeech' });

const tts = createTTSService(
  { engine: 'webSpeech', rate: 1.0 },
  {
    onBoundary: ({ word }) => {
      // Simple word-boundary lip pulse
      lipSync.handleViseme(0, 70); // Neutral pulse
    },
    onViseme: (visemeId, duration) => {
      // Direct viseme from TTS
      lipSync.handleViseme(visemeId, 90);
    },
  }
);

await tts.speak('Hello world!');
```

## Animation Snippet Format

SAPI mode generates animation snippets with curves:

```typescript
{
  name: 'lipsync_1699999999',
  curves: {
    0: [{ time: 0, intensity: 0 }, { time: 5, intensity: 0 }],
    21: [
      { time: 0, intensity: 0 },
      { time: 0.01, intensity: 90 },  // Onset
      { time: 0.09, intensity: 90 },  // Hold (90%)
      { time: 0.1, intensity: 0 },    // Release (10%)
    ],
    // ... curves for visemes 1-20
  },
  maxTime: 5.0,
  loop: false,
  snippetPlaybackRate: 1.0,
  snippetIntensityScale: 1.0
}
```

Each viseme curve has 4 keyframes:
1. **Pre-onset**: intensity = 0
2. **Onset**: intensity jumps to `onsetIntensity` (default 90)
3. **Hold**: sustains at `onsetIntensity` for 90% of duration
4. **Release**: returns to 0 over final 10%

## Performance Considerations

- **WebSpeech mode**: Low overhead, real-time viseme triggers
- **SAPI mode**: Higher upfront cost (curve building), but precise timing
- **Phoneme extraction**: ~1-2ms per word using built-in dictionary
- **Timeline execution**: Uses `setTimeout` for scheduling, accurate to ~4-10ms

## Browser Compatibility

- **Core functionality**: All modern browsers
- **WebSpeech API**: Chrome, Edge (best support), Safari (limited)
- **Audio processing**: Requires Web Audio API support

## License

Part of the LoomLarge project.
