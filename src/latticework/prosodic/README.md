# Prosodic Expression Agency

Prosodic gesture service for Latticework that adds natural brow raises and head nods during speech.

## Features

- **Parallel Animation Control**: Independent brow and head gesture loops
- **Word Boundary Pulses**: Automatic brow/head pulses on word boundaries
- **Graceful Fade-outs**: Multi-step intensity scaling for smooth transitions
- **Configurable Priorities**: Control animation layering and blending
- **Debounced Pulses**: Prevents rapid-fire gestures
- **LocalStorage Integration**: Load animation snippets from browser storage

## Installation

The Prosodic Expression agency is part of Latticework and requires no additional installation.

## Quick Start

```typescript
import { createProsodicService } from '@/latticework/prosodic';

// Create Prosodic service
const prosodic = createProsodicService(
  {
    browLoopKey: 'speakingAnimationsList/browRaiseSmall',
    headLoopKey: 'speakingAnimationsList/headNodSmall',
    browPriority: 2,
    headPriority: 2,
    defaultIntensity: 1.0,
    fadeSteps: 4,
    fadeStepInterval: 120,  // ms per fade step
  },
  {
    onBrowStart: () => console.log('Brow raise started'),
    onBrowStop: () => console.log('Brow raise stopped'),
    onHeadStart: () => console.log('Head nod started'),
    onHeadStop: () => console.log('Head nod stopped'),
    onPulse: (channel, wordIndex) => {
      console.log(`Pulse on ${channel} at word ${wordIndex}`);
    },
  }
);

// Start talking - activates brow and head loops
prosodic.startTalking();

// Pulse on word boundaries
let wordIndex = 0;
setInterval(() => {
  prosodic.pulse(wordIndex++);
}, 500);

// Stop talking with graceful fade-out
setTimeout(() => {
  prosodic.stopTalking('both');  // Fade out both channels
}, 5000);

// Immediate stop (no fade)
prosodic.stop();

// Cleanup
prosodic.dispose();
```

## API Reference

### `createProsodicService(config?, callbacks?)`

Creates a new Prosodic Expression service instance.

**Parameters:**

- `config` - Prosodic configuration
  - `browLoopKey?: string` - Animation key for brow loop (default: `'speakingAnimationsList/browRaiseSmall'`)
  - `headLoopKey?: string` - Animation key for head loop (default: `'speakingAnimationsList/headNodSmall'`)
  - `browPriority?: number` - Brow animation priority (default: `2`)
  - `headPriority?: number` - Head animation priority (default: `2`)
  - `pulsePriority?: number` - Pulse animation priority (default: `5`)
  - `defaultIntensity?: number` - Default intensity scale, 0.0-1.0 (default: `1.0`)
  - `fadeSteps?: number` - Number of fade-out steps (default: `4`)
  - `fadeStepInterval?: number` - Milliseconds per fade step (default: `120`)

- `callbacks` - Event callbacks
  - `onBrowStart?: () => void` - Brow animation starts
  - `onBrowStop?: () => void` - Brow animation stops
  - `onHeadStart?: () => void` - Head animation starts
  - `onHeadStop?: () => void` - Head animation stops
  - `onPulse?: (channel: ProsodicChannel, wordIndex: number) => void` - Pulse event
  - `onError?: (error: Error) => void` - Error handler

### `ProsodicService` Methods

#### `startTalking(): void`

Start prosodic gestures - activates brow and head loops.

```typescript
prosodic.startTalking();
```

#### `stopTalking(fadeChannel?: ProsodicChannel): void`

Stop prosodic gestures with graceful fade-out.

**Parameters:**
- `fadeChannel?: 'brow' | 'head' | 'both'` - Which channels to fade (default: `'both'`)

```typescript
prosodic.stopTalking('both');   // Fade out both
prosodic.stopTalking('brow');   // Fade out brow only
prosodic.stopTalking('head');   // Fade out head only
```

**Fade Behavior:**
- Brow fades immediately
- Head fades with 100ms delay (when `'both'` is selected)
- Multi-step intensity reduction: 1.0 → 0.75 → 0.5 → 0.25 → 0

#### `pulse(wordIndex: number): void`

Trigger prosodic pulse on word boundary.

**Behavior:**
- Brow pulse on **every** word
- Head nod on **every second** word (`wordIndex % 2 === 1`)
- Pulses are debounced to 120ms minimum interval

```typescript
let wordIndex = 0;
tts.onBoundary(() => {
  prosodic.pulse(wordIndex++);
});
```

#### `stop(): void`

Stop immediately without fade-out.

```typescript
prosodic.stop();
```

#### `updateConfig(config: Partial<ProsodicConfig>): void`

Update service configuration.

```typescript
prosodic.updateConfig({
  defaultIntensity: 0.8,
  fadeSteps: 6,
});
```

#### `getState(): ProsodicState`

Get current service state.

```typescript
const state = prosodic.getState();
// {
//   browStatus: 'active',
//   headStatus: 'active',
//   browIntensity: 1.0,
//   headIntensity: 1.0,
//   isLooping: true
// }
```

#### `getSnippets(): { brow: AnimationSnippet | null; head: AnimationSnippet | null }`

Get current animation snippets for external animation manager integration.

```typescript
const { brow, head } = prosodic.getSnippets();
if (brow) {
  console.log('Brow animation:', brow.name, brow.isPlaying);
}
```

#### `dispose(): void`

Cleanup and release resources.

```typescript
prosodic.dispose();
```

## Animation Snippet Format

Animation snippets are loaded from localStorage with the following structure:

```typescript
{
  name: 'browRaiseSmall',
  curves: {
    '1': [  // AU1 - Inner Brow Raise
      { time: 0.0, intensity: 0 },
      { time: 0.2, intensity: 0.8 },
      { time: 0.8, intensity: 0.8 },
      { time: 1.0, intensity: 0 },
    ],
    '2': [  // AU2 - Outer Brow Raise
      { time: 0.0, intensity: 0 },
      { time: 0.2, intensity: 0.6 },
      { time: 0.8, intensity: 0.6 },
      { time: 1.0, intensity: 0 },
    ],
  },
  snippetCategory: 'brow',
  snippetPriority: 2,
  currentTime: 0,
  isPlaying: true,
  loop: true,
  snippetIntensityScale: 1.0,
  maxTime: 1.0,
  snippetPlaybackRate: 1.0
}
```

## Integration with TTS

Combine Prosodic Expression with TTS for natural speech gestures:

```typescript
import { createTTSService } from '@/latticework/tts';
import { createProsodicService } from '@/latticework/prosodic';

const prosodic = createProsodicService();

const tts = createTTSService(
  { engine: 'webSpeech', rate: 1.0 },
  {
    onStart: () => {
      prosodic.startTalking();
    },
    onBoundary: ({ word, charIndex }) => {
      // Pulse on each word
      const wordIndex = word.split(' ').length - 1;
      prosodic.pulse(wordIndex);
    },
    onEnd: () => {
      prosodic.stopTalking('both');
    },
  }
);

await tts.speak('Hello world! How are you today?');
```

## Integration with Facial Engine

Example integration with EngineThree:

```typescript
import { createProsodicService } from '@/latticework/prosodic';
import { EngineThree } from '@/engine/EngineThree';

const engine = new EngineThree();

const prosodic = createProsodicService(
  { defaultIntensity: 0.8 },
  {
    onBrowStart: () => {
      // Start brow raise loop
      engine.setAU(1, 0.6);  // Inner brow raise
      engine.setAU(2, 0.6);  // Outer brow raise
    },
    onBrowStop: () => {
      // Return to neutral
      engine.setAU(1, 0);
      engine.setAU(2, 0);
    },
    onHeadStart: () => {
      // Start head nod loop
      engine.setHeadVertical(0.3);  // Slight nod
    },
    onHeadStop: () => {
      // Return to neutral
      engine.setHeadVertical(0);
    },
    onPulse: (channel, wordIndex) => {
      if (channel === 'brow' || channel === 'both') {
        // Brow pulse - quick raise
        engine.setAU(1, 0.8);
        engine.setAU(2, 0.8);
        setTimeout(() => {
          engine.setAU(1, 0.6);
          engine.setAU(2, 0.6);
        }, 100);
      }

      if (channel === 'head' || channel === 'both') {
        // Head nod pulse
        engine.setHeadVertical(0.5);
        setTimeout(() => {
          engine.setHeadVertical(0.3);
        }, 150);
      }
    },
  }
);

prosodic.startTalking();
```

## Complete Speech Pipeline

Example of full TTS + LipSync + Prosodic integration:

```typescript
import { createTTSService } from '@/latticework/tts';
import { createLipSyncService } from '@/latticework/lipsync';
import { createProsodicService } from '@/latticework/prosodic';
import { EngineThree } from '@/engine/EngineThree';

const engine = new EngineThree();

// LipSync for mouth movements
const lipSync = createLipSyncService(
  { onsetIntensity: 90, holdMs: 140 },
  {
    onVisemeStart: (visemeId, intensity) => {
      // Map viseme to jaw/lip AUs
      engine.setMouthShape(visemeId, intensity / 100);
    },
  }
);

// Prosodic for brow/head gestures
const prosodic = createProsodicService();

// TTS orchestrates everything
let wordIndex = 0;
const tts = createTTSService(
  { engine: 'webSpeech', rate: 1.0 },
  {
    onStart: () => {
      prosodic.startTalking();
    },
    onBoundary: ({ word }) => {
      // Lip pulse
      lipSync.handleViseme(0, 70);

      // Prosodic pulse
      prosodic.pulse(wordIndex++);
    },
    onViseme: (visemeId, duration) => {
      // Precise lip-sync
      lipSync.handleViseme(visemeId, 90);
    },
    onEnd: () => {
      prosodic.stopTalking('both');
      lipSync.stop();
      wordIndex = 0;
    },
  }
);

// Speak text
await tts.speak('Hello! How are you today? I hope you are doing well.');
```

## Fade-Out Behavior

The graceful fade-out uses multi-step intensity scaling:

**Default Configuration:**
- `fadeSteps: 4`
- `fadeStepInterval: 120ms`

**Fade Sequence:**
```
Step 1 (0ms):   intensity = 0.75
Step 2 (120ms): intensity = 0.50
Step 3 (240ms): intensity = 0.25
Step 4 (360ms): intensity = 0.00 → animation stops
```

Total fade duration: `fadeSteps * fadeStepInterval = 480ms`

**Custom Fade:**
```typescript
prosodic.updateConfig({
  fadeSteps: 6,
  fadeStepInterval: 100,
});
// Now: 6 steps × 100ms = 600ms total fade
```

## Pulse Debouncing

Pulses are automatically debounced to prevent rapid-fire gestures:

```typescript
// Built-in debounce: 120ms minimum between pulses
prosodic.pulse(0);  // Triggers
prosodic.pulse(1);  // Ignored (< 120ms since last pulse)

setTimeout(() => {
  prosodic.pulse(2);  // Triggers (> 120ms since last pulse)
}, 150);
```

## Animation Priorities

Animation priorities control layering when multiple snippets are playing:

- **Loop animations**: Priority 2 (brow, head)
- **Pulse animations**: Priority 5 (higher priority = overrides loops)

This ensures that word-boundary pulses override the background loops.

## LocalStorage Integration

Animation snippets are loaded from localStorage with keys:

```typescript
// Default keys
const DEFAULT_KEYS = {
  BROW_LOOP: 'speakingAnimationsList/browRaiseSmall',
  HEAD_LOOP: 'speakingAnimationsList/headNodSmall',
  BROW_PULSE: 'speakingAnimationsList/browPulse',
  HEAD_PULSE: 'speakingAnimationsList/headPulse',
};

// Store animation snippets
localStorage.setItem(
  'speakingAnimationsList/browRaiseSmall',
  JSON.stringify({
    curves: { /* AU curves */ },
    maxTime: 1.0,
    // ... other properties
  })
);
```

## Performance Considerations

- **Fade-out overhead**: ~4-6 setTimeout calls per fade (minimal)
- **Pulse debouncing**: Prevents excessive animation updates
- **Animation loops**: Run continuously during speech (efficient for long utterances)
- **Memory footprint**: ~1-2 KB per animation snippet

## Browser Compatibility

- **Core functionality**: All modern browsers
- **LocalStorage**: IE8+ and all modern browsers
- **Performance timing**: Uses `performance.now()` for precise debouncing

## License

Part of the LoomLarge project.
