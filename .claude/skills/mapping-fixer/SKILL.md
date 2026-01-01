---
name: mapping-fixer
description: Diagnose and fix broken bone/blend shape/annotation mappings on 3D characters. Analyzes model data, compares against presets, extracts animation data, and generates corrected mappings. Use when annotations don't work, AUs don't animate correctly, or importing new character models. Primary focus on skeletal-only models like the Betta fish.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Mapping Fixer Skill

This skill helps diagnose and repair broken mappings for 3D character models in the LoomLarge system. It covers:

- **Bone mappings** - Skeleton bone names that control head, eyes, jaw, tongue
- **Blend shape / morph target mappings** - Facial expression morphs (AU to morph names)
- **Annotation mappings** - Camera focus points tied to specific bones/meshes
- **Animation analysis** - Extract which bones are active in animation clips

## Architecture Overview

```
Model Loading (GLB/GLTF)
├── Extract skeleton bones (names, hierarchy)
├── Extract mesh morph targets (blend shapes)
├── Extract embedded animations (clips with keyframes)
└── Compare against expected preset (CC4, Fish, etc.)

Mapping Analysis
├── Find missing bones (expected but not in model)
├── Find missing morphs (expected but not in model)
├── Suggest alternatives (fuzzy matching, similar names)
└── Generate corrected preset config

Animation Extraction
├── Parse AnimationClip tracks
├── Identify which bones have keyframes
├── Calculate activation patterns (range of motion)
└── Suggest AU mappings based on observed behavior
```

## Key Files

| File | Purpose |
|------|---------|
| [src/presets/annotations.ts](src/presets/annotations.ts) | Character annotation configs with bone names |
| [node_modules/loomlarge/src/presets/cc4.ts](node_modules/loomlarge/src/presets/cc4.ts) | CC4 preset - AU to morph/bone mappings |
| [node_modules/loomlarge/src/presets/bettaFish.ts](node_modules/loomlarge/src/presets/bettaFish.ts) | Fish preset - skeletal-only mappings |
| [node_modules/loomlarge/src/mappings/types.ts](node_modules/loomlarge/src/mappings/types.ts) | AUMappingConfig interface |
| [src/scenes/CharacterGLBScene.tsx](src/scenes/CharacterGLBScene.tsx) | Model loading and engine initialization |

### Mapping Analysis Services

| File | Purpose |
|------|---------|
| [src/services/modelIntrospectionService.ts](src/services/modelIntrospectionService.ts) | Extract bones/morphs/animations from loaded models |
| [src/services/mappingAnalysisService.ts](src/services/mappingAnalysisService.ts) | Compare expected vs actual mappings, suggest fixes |
| [src/services/animationAnalysisService.ts](src/services/animationAnalysisService.ts) | Analyze animation clips to infer AU mappings |
| [src/services/mappingPromptService.ts](src/services/mappingPromptService.ts) | Generate AI prompts for Claude analysis |
| [src/services/mappingWizardService.ts](src/services/mappingWizardService.ts) | Orchestrate the full wizard workflow |

## Common Mapping Issues

### 1. Wrong Bone Names

**Symptom**: AU controls don't animate (e.g., head doesn't turn)

**Cause**: Model uses different bone naming convention

**Example**: CC4 uses `CC_Base_Head`, Mixamo uses `mixamorig:Head`

**Fix**: Update `boneNodes` mapping:
```typescript
const CUSTOM_BONE_NODES = {
  HEAD: 'mixamorig:Head',      // was: 'CC_Base_Head'
  JAW: 'mixamorig:Jaw',        // was: 'CC_Base_JawRoot'
  EYE_L: 'mixamorig:LeftEye',  // was: 'CC_Base_L_Eye'
  EYE_R: 'mixamorig:RightEye', // was: 'CC_Base_R_Eye'
  // ...
};
```

### 2. Missing Morph Targets

**Symptom**: Facial expressions don't work (e.g., no smile)

**Cause**: Model has different morph target names or is missing expected morphs

**Example**: CC4 expects `Mouth_Smile_L`, model has `mouthSmile_L`

**Fix**: Update `auToMorphs` mapping:
```typescript
const CUSTOM_AU_TO_MORPHS: Record<number, string[]> = {
  12: ['mouthSmile_L', 'mouthSmile_R'],  // was: ['Mouth_Smile_L', 'Mouth_Smile_R']
  // ...
};
```

### 3. Broken Annotations

**Symptom**: Camera doesn't focus on correct body part, markers appear at wrong position

**Cause**: Annotation references bones that don't exist in the model

**Fix**: Update `annotations.ts` with correct bone names for the character

### 4. Skeletal-Only Models

**Symptom**: Model has no morph targets at all (like the Betta fish)

**Cause**: Model was rigged for skeletal animation only, not blend shapes

**Fix**: Create bone-only AU mappings (like `FISH_AU_MAPPING_CONFIG`)

## Diagnostic Process

### Step 1: Extract Available Data from Model

Use the model introspection service to get all available bones and morphs:

```typescript
import { extractModelData } from './services/modelIntrospectionService';

// After model loads in CharacterGLBScene
const modelData = extractModelData(model, meshes, animations);

console.log('Bones:', modelData.bones);
console.log('Morphs:', modelData.morphs);
console.log('Animations:', modelData.animations);
```

### Step 2: Compare Against Expected Preset

```typescript
import { analyzeMapping } from './services/mappingAnalysisService';

const analysis = analyzeMapping(modelData, CC4_PRESET);

console.log('Missing bones:', analysis.missingBones);
console.log('Missing morphs:', analysis.missingMorphs);
console.log('Suggested mappings:', analysis.suggestions);
```

### Step 3: Generate Corrected Config

```typescript
import { generateCorrectedPreset } from './services/mappingAnalysisService';

const correctedPreset = generateCorrectedPreset(modelData, CC4_PRESET);
// This outputs a new AUMappingConfig with corrected bone/morph names
```

## Animation Analysis for Creating New Mappings

When importing a model with embedded animations, analyze which bones are used:

```typescript
import { analyzeAnimationClip } from './services/animationAnalysisService';

for (const clip of animations) {
  const analysis = analyzeAnimationClip(clip);
  console.log(`Animation "${clip.name}":`);
  console.log('  Active bones:', analysis.activeBones);
  console.log('  Rotation ranges:', analysis.rotationRanges);
}
```

This helps identify:
- Which bones are actually animated (skeleton validation)
- Range of motion for each bone (helps set `maxDegrees`)
- Patterns that might correspond to specific AUs

## Creating a New Character Preset

### From Scratch

1. Load model and extract all bones/morphs
2. Identify bone naming convention (CC4, Mixamo, custom)
3. Map semantic bone names (HEAD, JAW, etc.) to actual names
4. Map AU IDs to available morph target names
5. Create annotation config with correct bone references

### From Existing Preset

1. Start with closest matching preset (CC4 for humanoid, Fish for skeletal)
2. Run mapping analysis to find mismatches
3. Apply suggested corrections
4. Test each AU to verify animations work

## AUMappingConfig Structure

```typescript
interface AUMappingConfig {
  // AU ID → morph target names (e.g., AU 12 → Smile morphs)
  auToMorphs: Record<number, string[]>;

  // AU ID → bone transformations (e.g., AU 51 → HEAD rotation)
  auToBones: Record<number, BoneBinding[]>;

  // Semantic key → actual bone name (e.g., 'HEAD' → 'CC_Base_Head')
  boneNodes: Record<string, string>;

  // Morph category → mesh names (e.g., 'face' → ['CC_Base_Body_1'])
  morphToMesh: Record<string, string[]>;

  // Viseme keys for lip-sync (typically 15 phoneme positions)
  visemeKeys: string[];

  // Optional: Default morph/bone blend weights
  auMixDefaults?: Record<number, number>;

  // Optional: AU metadata (names, descriptions)
  auInfo?: Record<string, AUInfo>;

  // Optional: Eye mesh node fallbacks
  eyeMeshNodes?: { LEFT: string; RIGHT: string };

  // Optional: Composite rotation definitions
  compositeRotations?: CompositeRotation[];
}
```

## BoneBinding Structure

```typescript
interface BoneBinding {
  node: string;           // Semantic key (e.g., 'HEAD', 'JAW')
  channel: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz';
  scale: -1 | 1;          // Direction multiplier
  maxDegrees?: number;    // Max rotation for this AU (for rotation channels)
  maxUnits?: number;      // Max translation (for translation channels)
}
```

## Annotation Structure

```typescript
interface Annotation {
  name: string;           // e.g., 'left_eye', 'head', 'full_body'
  bones?: string[];       // Bone names to focus on (use for skinned parts)
  meshes?: string[];      // Mesh names (only for non-skinned meshes)
  objects?: string[];     // Any object names (['*'] for all)
  paddingFactor?: number; // Zoom level (1.0 = tight, 2.0 = loose)
  cameraAngle?: number;   // View angle (0=front, 90=right, 180=back, 270=left)
}
```

## Common Bone Naming Conventions

| Semantic | CC4 | Mixamo | Generic |
|----------|-----|--------|---------|
| HEAD | CC_Base_Head | mixamorig:Head | Head |
| NECK | CC_Base_NeckTwist01 | mixamorig:Neck | Neck |
| JAW | CC_Base_JawRoot | mixamorig:Jaw | Jaw |
| EYE_L | CC_Base_L_Eye | mixamorig:LeftEye | Eye_L |
| EYE_R | CC_Base_R_Eye | mixamorig:RightEye | Eye_R |
| TONGUE | CC_Base_Tongue01 | - | Tongue |
| SPINE | CC_Base_Spine01 | mixamorig:Spine | Spine |

## Common Morph Target Patterns

| AU | CC4 Pattern | ARKit Pattern | Generic |
|----|-------------|---------------|---------|
| 1 (Inner Brow Raise) | Brow_Raise_Inner_L/R | browInnerUp | BrowInnerUp_L/R |
| 2 (Outer Brow Raise) | Brow_Raise_Outer_L/R | browOuterUp_L/R | BrowOuterUp_L/R |
| 12 (Smile) | Mouth_Smile_L/R | mouthSmile_L/R | Smile_L/R |
| 43/45 (Blink) | Eye_Blink_L/R | eyeBlink_L/R | Blink_L/R |

## Wizard Flow for App Integration

When building an in-app wizard to guide users through fixing mappings:

### Phase 1: Model Analysis
1. Load the model
2. Extract all bones, morphs, animations
3. Present summary to user

### Phase 2: Preset Selection
1. Show available presets (CC4, Fish, Custom)
2. User selects closest match
3. Run comparison analysis

### Phase 3: Issue Detection
1. Display missing bones
2. Display missing morphs
3. Highlight broken annotations

### Phase 4: Mapping Suggestions
1. Fuzzy match bone names
2. Fuzzy match morph names
3. Present suggested corrections

### Phase 5: Interactive Testing
1. Apply suggested mappings temporarily
2. Let user test each AU with sliders
3. Fine-tune mappings based on visual feedback

### Phase 6: Save Configuration
1. Generate final AUMappingConfig
2. Generate annotation config
3. Save to presets directory

## AI Prompt Templates for Backend

When implementing the AI wizard backend, use these prompt patterns:

### Bone Mapping Analysis
```
Given a 3D model with the following bones:
${boneList.join('\n')}

And expecting these semantic bone mappings:
HEAD, NECK, JAW, EYE_L, EYE_R, TONGUE, SPINE

Analyze which bones likely correspond to each semantic key.
Consider naming patterns like:
- CC4: CC_Base_Head, CC_Base_JawRoot
- Mixamo: mixamorig:Head, mixamorig:Jaw
- Generic: Head, Jaw, LeftEye

Output a mapping from semantic key to actual bone name.
```

### Morph Target Mapping
```
Given a 3D model with the following morph targets:
${morphList.join('\n')}

And needing to map these FACS Action Units:
- AU1: Inner Brow Raiser
- AU2: Outer Brow Raiser
- AU12: Lip Corner Puller (Smile)
...

Find morph targets that likely correspond to each AU.
Consider naming patterns like:
- CC4: Brow_Raise_Inner_L, Mouth_Smile_L
- ARKit: browInnerUp, mouthSmile_L
- Generic: BrowRaise_L, Smile_L

Output a mapping from AU ID to morph target names.
```

### Animation Behavior Analysis
```
Given animation clip "${clipName}" with these bone tracks:
${trackSummary}

And these rotation patterns:
${rotationPatterns}

Identify which bones are:
1. Primary movers (large rotation range, consistent use)
2. Secondary/follower bones (smaller range, follow primary)
3. Idle/breathing bones (subtle constant motion)

Suggest which AU mappings would recreate this motion.
```

---

## Fish Model Workflow (Primary Use Case)

The Betta fish model is a skeletal-only model with 53 bones and embedded swimming animation. Here's the specific workflow for fixing its mappings:

### Current Fish Bone Structure

```
Armature_rootJoint (root)
  Bone_Armature (body root)
    Bone001_Armature (HEAD)
      Bone009-017_Armature (PECTORAL FINS - decorative head fins)
    Bone002_Armature (BODY_FRONT)
      Bone003_Armature (BODY_MID)
        Bone018, Bone033 (VENTRAL FINS - belly fins)
        Bone004_Armature (BODY_BACK)
          Bone005_Armature (TAIL_BASE)
            Bone020, Bone039+ (TAIL FIN chains)
    Bone046-051 (THROAT_L / GILL_R - branchiostegal/operculum)
  Bone006_Armature (DORSAL_ROOT)
    Bone007, Bone008 (DORSAL FIN sides)
```

### Fish AU Mapping Reference

| AU Range | Category | Examples |
|----------|----------|----------|
| 2-7 | Body Orientation | Turn L/R, Pitch Up/Down, Roll L/R |
| 12-15 | Tail (Caudal Fin) | Sweep L/R, Spread/Close |
| 20-27 | Pectoral Fins | Up/Down, Forward/Back (L/R) |
| 30-33 | Ventral/Pelvic Fins | Up/Down (L/R) |
| 40-41 | Head Tilt | Tilt L/R (via dorsal area) |
| 50-53 | Throat/Gill | Throat Expand/Contract, Gill Flare/Close |
| 61-64 | Eye Movement | Look L/R/Up/Down |

### Using the Services

```typescript
import { runFishMappingWizard, printWizardResults } from './services/mappingWizardService';
import { FISH_AU_MAPPING_CONFIG } from 'loomlarge';

// After model loads in CharacterGLBScene onReady:
const result = runFishMappingWizard(
  model,           // THREE.Object3D
  meshes,          // THREE.Mesh[]
  animations,      // THREE.AnimationClip[]
  FISH_AU_MAPPING_CONFIG
);

// For console output (Claude skill):
printWizardResults(result.outputs);

// For UI display:
// - result.outputs.modelSummary
// - result.outputs.boneHierarchy
// - result.outputs.analysisReport
// - result.outputs.prompts (for AI backend)
// - result.outputs.correctedPresetCode
```

### Creating Animation Snippets from AUs

Once mappings are correct, you can create animation snippets that combine AU keyframes:

```typescript
// Example: Swimming animation snippet
const swimmingSnippet = {
  name: 'swimming',
  duration: 2000,
  keyframes: [
    // Tail sweep cycle
    { time: 0, au: 12, value: 0.5 },      // Tail left
    { time: 500, au: 13, value: 0.5 },    // Tail right
    { time: 1000, au: 12, value: 0.5 },   // Tail left
    { time: 1500, au: 13, value: 0.5 },   // Tail right
    { time: 2000, au: 12, value: 0 },     // Reset

    // Pectoral fin motion
    { time: 0, au: 20, value: 0.3 },      // Pectoral L up
    { time: 250, au: 21, value: 0.3 },    // Pectoral L down
    // ... etc
  ],
};
```

### Debugging Tips

1. **Bone not animating?** Check if the semantic key in `boneNodes` matches the actual bone name
2. **Wrong rotation axis?** Fish bones often use `rz` for horizontal sweep, `rx` for vertical
3. **Fins moving wrong direction?** Adjust `scale` (-1 or 1) in the binding
4. **Motion too subtle?** Increase `maxDegrees` in the binding

### Quick Test Commands

```typescript
// Test a single AU from browser console:
window.engine.setAU(12, 0.5);  // Tail sweep left at 50%
window.engine.setAU(13, 0.5);  // Tail sweep right at 50%
window.engine.setAU(20, 1);    // Left pectoral up full
```
