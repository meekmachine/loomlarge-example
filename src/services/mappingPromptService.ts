/**
 * Mapping Prompt Service
 *
 * Generates structured prompts for AI-assisted mapping analysis and correction.
 * These prompts can be used with Claude (via skill or API) to:
 * - Analyze model bone/morph structure
 * - Suggest semantic mappings
 * - Infer AU mappings from animation patterns
 * - Generate corrected preset configurations
 */

import type { ModelData, BoneInfo, ClipInfo } from './modelIntrospectionService';
import type { MappingAnalysis, MissingBoneInfo } from './mappingAnalysisService';
import type { AnimationAnalysis, BoneAnimationProfile } from './animationAnalysisService';

/**
 * Common bone naming conventions for reference in prompts
 */
const NAMING_CONVENTIONS = {
  CC4: {
    prefix: 'CC_Base_',
    examples: {
      HEAD: 'CC_Base_Head',
      JAW: 'CC_Base_JawRoot',
      EYE_L: 'CC_Base_L_Eye',
      EYE_R: 'CC_Base_R_Eye',
      TONGUE: 'CC_Base_Tongue01',
      NECK: 'CC_Base_NeckTwist01',
      SPINE: 'CC_Base_Spine01',
    },
  },
  Mixamo: {
    prefix: 'mixamorig:',
    examples: {
      HEAD: 'mixamorig:Head',
      JAW: 'mixamorig:Jaw',
      EYE_L: 'mixamorig:LeftEye',
      EYE_R: 'mixamorig:RightEye',
      NECK: 'mixamorig:Neck',
      SPINE: 'mixamorig:Spine',
    },
  },
  Generic: {
    prefix: '',
    examples: {
      HEAD: 'Head',
      JAW: 'Jaw',
      EYE_L: 'Eye_L',
      EYE_R: 'Eye_R',
      TONGUE: 'Tongue',
      NECK: 'Neck',
      SPINE: 'Spine',
    },
  },
  Skeletal: {
    prefix: 'Bone',
    note: 'Numbered bones like Bone001, Bone002, etc. Common in non-humanoid models.',
    examples: {
      ROOT: 'Armature_rootJoint',
      BODY: 'Bone_Armature',
      HEAD: 'Bone001_Armature',
    },
  },
};

/**
 * Generate a prompt for bone semantic mapping analysis
 */
export function generateBoneMappingPrompt(modelData: ModelData): string {
  const boneList = modelData.boneNames.join('\n');
  const hierarchy = modelData.bones
    .map(b => `${'  '.repeat(b.depth)}${b.name}${b.children.length > 0 ? ` (${b.children.length} children)` : ''}`)
    .join('\n');

  return `# Bone Semantic Mapping Analysis

## Task
Analyze the bone hierarchy of this 3D model and identify which bones correspond to standard semantic keys used for facial animation and body control.

## Model Bone Hierarchy
\`\`\`
${hierarchy}
\`\`\`

## All Bone Names (flat list)
${boneList}

## Required Semantic Keys
For facial animation control, we need to identify these bones:
- HEAD: Main head bone (controls head rotation)
- NECK: Neck bone (may not exist in all rigs)
- JAW: Jaw bone (controls mouth open/close)
- EYE_L: Left eye bone (controls left eye rotation)
- EYE_R: Right eye bone (controls right eye rotation)
- TONGUE: Tongue bone (may not exist in all rigs)

For body control (if humanoid):
- SPINE: Main spine/torso bone
- HIPS: Hip/pelvis root bone

For non-humanoid models (like fish), also identify:
- BODY_ROOT: Main body attachment point
- TAIL_BASE: Start of tail chain
- FIN bones: Any fin-related bones
- GILL bones: Any gill-related bones

## Known Naming Conventions
${Object.entries(NAMING_CONVENTIONS).map(([name, conv]) =>
  `### ${name}
${'note' in conv ? conv.note : ''}
Examples: ${Object.entries(conv.examples).map(([k, v]) => `${k}="${v}"`).join(', ')}`
).join('\n\n')}

## Instructions
1. Examine the bone names and hierarchy structure
2. Identify the naming convention being used (or describe if custom)
3. For each semantic key, identify the most likely matching bone
4. Note any bones that don't have clear semantic meaning
5. Identify any bone chains (numbered sequences like Bone001, Bone002, etc.)

## Output Format
Provide your analysis as:

### Detected Naming Convention
[Name of convention or "Custom"]

### Semantic Mappings
\`\`\`json
{
  "HEAD": "actual_bone_name",
  "JAW": "actual_bone_name or null",
  "EYE_L": "actual_bone_name or null",
  "EYE_R": "actual_bone_name or null",
  "TONGUE": "actual_bone_name or null",
  "NECK": "actual_bone_name or null",
  // ... other mappings
}
\`\`\`

### Bone Chains
List any detected bone chains with their purpose:
- [Chain description]: bone1, bone2, bone3...

### Unmapped Bones
List bones that don't fit standard categories.

### Notes
Any observations about the rig structure.
`;
}

/**
 * Generate a prompt for morph target mapping (if model has morphs)
 */
export function generateMorphMappingPrompt(modelData: ModelData): string {
  if (modelData.morphs.length === 0) {
    return `# Morph Target Mapping

This model has no morph targets (blend shapes). It is a skeletal-only model.
All facial animation must be done through bone rotations.`;
  }

  const morphsByMesh = new Map<string, string[]>();
  for (const morph of modelData.morphs) {
    if (!morphsByMesh.has(morph.meshName)) {
      morphsByMesh.set(morph.meshName, []);
    }
    morphsByMesh.get(morph.meshName)!.push(morph.name);
  }

  let morphList = '';
  for (const [meshName, morphs] of morphsByMesh) {
    morphList += `\n### Mesh: ${meshName}\n`;
    morphList += morphs.join('\n');
    morphList += '\n';
  }

  return `# Morph Target Mapping Analysis

## Task
Analyze the morph targets (blend shapes) in this 3D model and map them to FACS Action Units.

## Available Morph Targets
${morphList}

## FACS Action Units to Map
Key facial AUs that typically have morph targets:

**Brow/Forehead:**
- AU1: Inner Brow Raiser (frontalis medial)
- AU2: Outer Brow Raiser (frontalis lateral)
- AU4: Brow Lowerer (corrugator)

**Eyes/Lids:**
- AU5: Upper Lid Raiser (levator palpebrae)
- AU6: Cheek Raiser (orbicularis oculi)
- AU7: Lid Tightener (orbicularis oculi)
- AU43/45: Eyes Closed / Blink

**Mouth:**
- AU10: Upper Lip Raiser
- AU12: Lip Corner Puller (smile)
- AU15: Lip Corner Depressor (frown)
- AU17: Chin Raiser
- AU18: Lip Pucker
- AU22: Lip Funneler
- AU25: Lips Part
- AU26: Jaw Drop (often combined with bone)

**Common Naming Patterns:**
- CC4: Brow_Raise_Inner_L, Mouth_Smile_L, Eye_Blink_L
- ARKit: browInnerUp, mouthSmile_L, eyeBlink_L
- Generic: BrowRaise_L, Smile_L, Blink_L

## Instructions
1. Identify the morph naming convention
2. Map each morph to its corresponding AU
3. Note left/right pairs (_L/_R suffixes)
4. Identify any morphs that don't map to standard AUs

## Output Format
\`\`\`json
{
  "auToMorphs": {
    "1": ["morph_name_L", "morph_name_R"],
    "12": ["smile_morph_L", "smile_morph_R"],
    // ...
  },
  "unmappedMorphs": ["morph1", "morph2"],
  "notes": "Description of naming pattern and any issues"
}
\`\`\`
`;
}

/**
 * Generate a prompt for animation-based AU inference
 */
export function generateAnimationAnalysisPrompt(
  modelData: ModelData,
  animationAnalysis: AnimationAnalysis
): string {
  const activeBonesInfo = animationAnalysis.boneProfiles
    .filter(p => p.isActive)
    .slice(0, 20)
    .map(p => {
      const rotRanges = [
        p.rotationRange.x.range > 1 ? `rx:${p.rotationRange.x.range.toFixed(1)}°` : '',
        p.rotationRange.y.range > 1 ? `ry:${p.rotationRange.y.range.toFixed(1)}°` : '',
        p.rotationRange.z.range > 1 ? `rz:${p.rotationRange.z.range.toFixed(1)}°` : '',
      ].filter(Boolean).join(', ');
      return `- ${p.boneName}: ${rotRanges} (${(p.activityScore * 100).toFixed(0)}% activity)`;
    })
    .join('\n');

  const chainsInfo = animationAnalysis.chains
    .map(c => `- ${c.suggestedName}: ${c.bones.slice(0, 5).join(' → ')}${c.bones.length > 5 ? '...' : ''}`)
    .join('\n');

  return `# Animation-Based AU Inference

## Task
Analyze this animation clip to infer what Action Units (AU mappings) would recreate the observed bone motions.

## Animation Clip: "${animationAnalysis.clipName}"
Duration: ${animationAnalysis.duration.toFixed(2)}s
Total Bones: ${animationAnalysis.stats.totalBones}
Active Bones: ${animationAnalysis.stats.activeBones}

## Most Active Bones (by rotation range)
${activeBonesInfo}

## Detected Bone Chains
${chainsInfo || 'No chains detected'}

## Model Type Analysis
Based on the bone names and animation patterns, this appears to be:
${modelData.morphs.length === 0 ? '- Skeletal-only model (no blend shapes)' : '- Model with blend shapes'}
${modelData.boneNames.some(n => /tail|fin|gill/i.test(n)) ? '- Non-humanoid (possibly aquatic/fish)' : '- Possibly humanoid'}

## Instructions
1. Analyze the motion patterns to identify distinct actions
2. Group bones that move together (chains, pairs)
3. Suggest AU mappings that would recreate this animation
4. For each suggested AU, specify:
   - Which bones to use
   - Primary rotation channel (rx, ry, or rz)
   - Maximum degrees based on observed range
   - Direction (positive/negative scale)

## Output Format
\`\`\`json
{
  "inferredAUs": [
    {
      "auId": 12,
      "name": "Tail Sweep Left",
      "bones": [
        { "node": "TAIL_BASE", "channel": "rz", "scale": 1, "maxDegrees": 30 }
      ],
      "reasoning": "Bone005 shows 45° rotation range on rz axis"
    }
  ],
  "boneGroups": [
    {
      "name": "Tail Chain",
      "bones": ["Bone005", "Bone006", "Bone007"],
      "movementType": "Wave/undulation"
    }
  ],
  "notes": "Additional observations"
}
\`\`\`

## Standard AU Reference
For non-humanoid models, use custom AU IDs (1-99 are reserved for FACS):
- Body orientation: 2-10
- Primary appendage motion: 11-20
- Secondary appendage: 21-30
- Head movement: 51-56 (standard FACS range)
- Eye movement: 61-64 (standard FACS range)
`;
}

/**
 * Generate a prompt for fixing broken mappings
 */
export function generateMappingFixPrompt(
  modelData: ModelData,
  analysis: MappingAnalysis,
  presetName: string
): string {
  const missingBonesInfo = analysis.missingBones
    .map(m => `- ${m.semanticKey}: expected "${m.expectedName}", affects AUs: ${m.affectedAUs.join(', ')}`)
    .join('\n');

  const suggestionsInfo = analysis.suggestions
    .map(s => `- ${s.type}: "${s.expected}" → "${s.suggested}" (${(s.confidence * 100).toFixed(0)}% confidence): ${s.reason}`)
    .join('\n');

  const unusedBonesInfo = analysis.unusedBones.slice(0, 30).join(', ');

  return `# Mapping Fix Analysis

## Task
Fix the broken mappings between the ${presetName} preset and this model.

## Current Status
Health Score: ${analysis.healthScore}%
Summary: ${analysis.summary}

## Missing Bone Mappings
${missingBonesInfo || 'None'}

## Missing Morph Mappings
${analysis.missingMorphs.length > 0
  ? analysis.missingMorphs.map(m => `- "${m.morphName}" affects AUs: ${m.affectedAUs.join(', ')}`).join('\n')
  : 'None (or model has no morphs)'}

## Auto-Generated Suggestions
${suggestionsInfo || 'No suggestions available'}

## Available Unused Bones
${unusedBonesInfo}${analysis.unusedBones.length > 30 ? '...' : ''}

## All Model Bones
${modelData.boneNames.join(', ')}

## Instructions
1. Review the auto-generated suggestions
2. Confirm or correct each suggestion
3. For missing mappings without suggestions, find the best match
4. Consider the bone hierarchy when making decisions
5. Ensure left/right symmetry where appropriate

## Output Format
Provide the corrected boneNodes mapping:

\`\`\`json
{
  "boneNodes": {
    "HEAD": "correct_bone_name",
    "JAW": "correct_bone_name",
    // ... all semantic keys
  },
  "corrections": [
    {
      "semanticKey": "HEAD",
      "originalSuggestion": "Bone001",
      "finalChoice": "Bone001",
      "reasoning": "Confirmed - this is the head bone based on hierarchy position"
    }
  ],
  "unmappable": [
    {
      "semanticKey": "TONGUE",
      "reason": "Model has no tongue bone"
    }
  ]
}
\`\`\`
`;
}

/**
 * Generate a prompt for creating a new preset from scratch
 */
export function generateNewPresetPrompt(
  modelData: ModelData,
  modelType: 'humanoid' | 'fish' | 'quadruped' | 'custom',
  animationAnalysis?: AnimationAnalysis
): string {
  let basePrompt = `# New Preset Generation

## Task
Create a complete AUMappingConfig preset for this ${modelType} model.

## Model Summary
- Bones: ${modelData.boneNames.length}
- Morph Targets: ${modelData.morphs.length}
- Animations: ${modelData.animations.length}

## Bone Hierarchy
\`\`\`
${modelData.bones
  .map(b => `${'  '.repeat(b.depth)}${b.name}`)
  .slice(0, 60)
  .join('\n')}
${modelData.bones.length > 60 ? '\n... (truncated)' : ''}
\`\`\`
`;

  if (modelData.morphs.length > 0) {
    basePrompt += `
## Morph Targets
${modelData.morphNames.slice(0, 50).join(', ')}
${modelData.morphNames.length > 50 ? '\n... (truncated)' : ''}
`;
  }

  if (animationAnalysis) {
    basePrompt += `
## Animation Analysis
Active bones: ${animationAnalysis.activeBonesByActivity.slice(0, 10).join(', ')}
Detected chains: ${animationAnalysis.chains.length}
`;
  }

  basePrompt += `
## Instructions
Create a complete AUMappingConfig with:
1. boneNodes: Semantic key → actual bone name
2. auToBones: AU ID → bone bindings with channel, scale, maxDegrees
3. auToMorphs: AU ID → morph target names (if morphs exist)
4. auInfo: Metadata for each AU
5. compositeRotations: Define rotation axes for animated bones

## Model Type Considerations
`;

  if (modelType === 'fish') {
    basePrompt += `
For fish models:
- Body orientation AUs (turn, pitch, roll): 2-7
- Tail movements: 12-15
- Pectoral fins: 20-27
- Ventral/pelvic fins: 30-33
- Dorsal fin / head tilt: 40-41
- Gill/throat: 50-53
- Eye movement: 61-64 (standard)
`;
  } else if (modelType === 'humanoid') {
    basePrompt += `
For humanoid models, use standard FACS AU IDs:
- Brow: 1, 2, 4
- Eyes: 5, 6, 7, 43, 45
- Mouth: 10, 12, 15, 17, 18, 22, 25, 26
- Head position: 51-56
- Eye direction: 61-64
`;
  }

  basePrompt += `
## Output Format
Provide complete TypeScript code for the preset:

\`\`\`typescript
import type { AUMappingConfig, BoneBinding, AUInfo } from 'loomlarge';

export const BONE_NODES = {
  // semantic key: actual bone name
};

export const AU_TO_BONES: Record<number, BoneBinding[]> = {
  // AU ID: [{ node, channel, scale, maxDegrees }]
};

export const AU_TO_MORPHS: Record<number, string[]> = {
  // AU ID: [morph names]
};

export const AU_INFO: Record<string, AUInfo> = {
  // AU ID string: { id, name, facePart }
};

export const PRESET: AUMappingConfig = {
  boneNodes: BONE_NODES,
  auToBones: AU_TO_BONES,
  auToMorphs: AU_TO_MORPHS,
  morphToMesh: {},
  visemeKeys: [],
  auInfo: AU_INFO,
};
\`\`\`
`;

  return basePrompt;
}

/**
 * Generate a summary prompt for quick diagnostics
 */
export function generateQuickDiagnosticPrompt(
  modelData: ModelData,
  analysis?: MappingAnalysis
): string {
  return `# Quick Model Diagnostic

## Model at a Glance
- Bones: ${modelData.boneNames.length}
- Morphs: ${modelData.morphs.length}
- Animations: ${modelData.animations.length}
${analysis ? `- Mapping Health: ${analysis.healthScore}%` : ''}

## Bone Names Sample
${modelData.boneNames.slice(0, 15).join(', ')}

## Quick Questions
1. What naming convention does this model use?
2. Is this a humanoid, fish, or other creature?
3. Are there obvious issues with the current mapping?
4. What's the recommended preset to start from?

${analysis ? `
## Current Issues
${analysis.summary}
` : ''}
`;
}

/**
 * Export all prompts for a model as a single document
 */
export function exportAllPrompts(
  modelData: ModelData,
  analysis?: MappingAnalysis,
  animationAnalysis?: AnimationAnalysis
): string {
  const sections: string[] = [
    '=' .repeat(80),
    'MAPPING ANALYSIS PROMPTS',
    '=' .repeat(80),
    '',
    generateBoneMappingPrompt(modelData),
    '',
    '-'.repeat(80),
    '',
    generateMorphMappingPrompt(modelData),
  ];

  if (animationAnalysis) {
    sections.push(
      '',
      '-'.repeat(80),
      '',
      generateAnimationAnalysisPrompt(modelData, animationAnalysis)
    );
  }

  if (analysis) {
    sections.push(
      '',
      '-'.repeat(80),
      '',
      generateMappingFixPrompt(modelData, analysis, 'Current Preset')
    );
  }

  return sections.join('\n');
}
