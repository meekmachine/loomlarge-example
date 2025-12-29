/**
 * Betta Fish Preset - Skeletal Animation Mappings
 *
 * Bone mappings for the betta fish model from Sketchfab.
 * This fish has 53 bones and 1 embedded animation ("Take 01" swimming).
 * No morph targets/blend shapes - all animation is skeletal.
 *
 * Bone structure (inferred from hierarchy):
 * - Armature_rootJoint: Root
 *   - Bone_Armature: Main body root
 *     - Bone.001_Armature: Head/Front body
 *       - Bone.009-017: Likely eyes/gills area (left/right symmetry)
 *     - Bone.002_Armature: Body spine chain
 *       - Bone.003 → 004 → 005: Body to tail
 *         - Bone.018-045: Tail fins (multiple branching chains)
 *     - Bone.046/047: Pectoral fins (left/right)
 *   - Bone.006_Armature: Dorsal fin area
 *     - Bone.007/008: Dorsal fin bones
 */

import type { BoneBinding, AUInfo, CompositeRotation } from 'loomlarge';

// ============================================================================
// BONE NAMES - All 53 bones in the fish skeleton
// ============================================================================

export const FISH_BONES = [
  "Armature_rootJoint",
  "Bone_Armature",
  "Bone001_Armature",
  "Bone009_Armature",
  "Bone027_Armature",
  "Bone029_Armature",
  "Bone031_Armature",
  "Bone028_Armature",
  "Bone030_Armature",
  "Bone032_Armature",
  "Bone010_Armature",
  "Bone012_Armature",
  "Bone014_Armature",
  "Bone016_Armature",
  "Bone011_Armature",
  "Bone013_Armature",
  "Bone015_Armature",
  "Bone017_Armature",
  "Bone002_Armature",
  "Bone003_Armature",
  "Bone004_Armature",
  "Bone005_Armature",
  "Bone020_Armature",
  "Bone025_Armature",
  "Bone026_Armature",
  "Bone039_Armature",
  "Bone040_Armature",
  "Bone041_Armature",
  "Bone042_Armature",
  "Bone043_Armature",
  "Bone044_Armature",
  "Bone045_Armature",
  "Bone019_Armature",
  "Bone023_Armature",
  "Bone024_Armature",
  "Bone034_Armature",
  "Bone036_Armature",
  "Bone038_Armature",
  "Bone018_Armature",
  "Bone021_Armature",
  "Bone022_Armature",
  "Bone033_Armature",
  "Bone035_Armature",
  "Bone037_Armature",
  "Bone046_Armature",
  "Bone048_Armature",
  "Bone050_Armature",
  "Bone047_Armature",
  "Bone049_Armature",
  "Bone051_Armature",
  "Bone006_Armature",
  "Bone007_Armature",
  "Bone008_Armature"
] as const;

// ============================================================================
// SEMANTIC BONE MAPPINGS - Human-readable names for key bones
// ============================================================================

export const FISH_BONE_NODES = {
  // Root and body
  ROOT: 'Armature_rootJoint',
  BODY_ROOT: 'Bone_Armature',
  HEAD: 'Bone001_Armature',

  // Body spine (front to back)
  BODY_FRONT: 'Bone002_Armature',
  BODY_MID: 'Bone003_Armature',
  BODY_BACK: 'Bone004_Armature',
  TAIL_BASE: 'Bone005_Armature',

  // Pectoral fins (left/right) - for swimming motion
  PECTORAL_L: 'Bone046_Armature',
  PECTORAL_L_MID: 'Bone048_Armature',
  PECTORAL_L_TIP: 'Bone050_Armature',
  PECTORAL_R: 'Bone047_Armature',
  PECTORAL_R_MID: 'Bone049_Armature',
  PECTORAL_R_TIP: 'Bone051_Armature',

  // Dorsal fin
  DORSAL_ROOT: 'Bone006_Armature',
  DORSAL_L: 'Bone007_Armature',
  DORSAL_R: 'Bone008_Armature',

  // Head area (eyes/gills - left side)
  EYE_AREA_L_1: 'Bone009_Armature',
  EYE_AREA_L_2: 'Bone010_Armature',
  EYE_AREA_L_3: 'Bone011_Armature',

  // Head area (eyes/gills - right side)
  EYE_AREA_R_1: 'Bone027_Armature',
  EYE_AREA_R_2: 'Bone028_Armature',

  // Tail fins (multiple chains for flowing motion)
  TAIL_FIN_1: 'Bone020_Armature',
  TAIL_FIN_2: 'Bone039_Armature',
  TAIL_FIN_3: 'Bone019_Armature',
  TAIL_FIN_4: 'Bone034_Armature',
  TAIL_FIN_5: 'Bone018_Armature',
  TAIL_FIN_6: 'Bone033_Armature',
} as const;

// ============================================================================
// CUSTOM ACTION MAPPINGS - Fish-specific "Action Units"
// These are analogous to FACS AUs but for fish body movements
// ============================================================================

/** Fish Action Units - custom IDs for fish movements */
export enum FishAction {
  // Body movements
  SWIM_WAVE = 1,      // Full body S-wave (main swimming motion)
  TURN_LEFT = 2,      // Turn head/body left
  TURN_RIGHT = 3,     // Turn head/body right
  PITCH_UP = 4,       // Nose up
  PITCH_DOWN = 5,     // Nose down
  ROLL_LEFT = 6,      // Roll body left
  ROLL_RIGHT = 7,     // Roll body right

  // Fin movements
  PECTORAL_FLAP = 10, // Pectoral fins flap
  DORSAL_WAVE = 11,   // Dorsal fin undulation
  TAIL_SWEEP = 12,    // Tail fin sweep left/right

  // Expressions (limited for fish)
  GILL_FLARE = 20,    // Gills flare out (breathing)
  EYE_LOOK = 21,      // Eye area movement (if applicable)
}

// ============================================================================
// BONE BINDINGS - Map FishActions to bone rotations
// ============================================================================

export const FISH_BONE_BINDINGS: Record<number, BoneBinding[]> = {
  // Turn left - rotate body around Y axis
  // Note: scale must be 1 or -1, use maxDegrees to control influence per bone
  [FishAction.TURN_LEFT]: [
    { node: 'HEAD', channel: 'ry', scale: 1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: 1, maxDegrees: 14 },  // 20 * 0.7
    { node: 'BODY_MID', channel: 'ry', scale: 1, maxDegrees: 5 },     // 12 * 0.4
  ],

  // Turn right - rotate body around Y axis (negative)
  [FishAction.TURN_RIGHT]: [
    { node: 'HEAD', channel: 'ry', scale: -1, maxDegrees: 30 },
    { node: 'BODY_FRONT', channel: 'ry', scale: -1, maxDegrees: 14 },
    { node: 'BODY_MID', channel: 'ry', scale: -1, maxDegrees: 5 },
  ],

  // Pitch up - nose up
  [FishAction.PITCH_UP]: [
    { node: 'HEAD', channel: 'rx', scale: -1, maxDegrees: 20 },
    { node: 'BODY_FRONT', channel: 'rx', scale: -1, maxDegrees: 5 },  // 10 * 0.5
  ],

  // Pitch down - nose down
  [FishAction.PITCH_DOWN]: [
    { node: 'HEAD', channel: 'rx', scale: 1, maxDegrees: 20 },
    { node: 'BODY_FRONT', channel: 'rx', scale: 1, maxDegrees: 5 },
  ],

  // Roll left
  [FishAction.ROLL_LEFT]: [
    { node: 'BODY_ROOT', channel: 'rz', scale: -1, maxDegrees: 25 },
  ],

  // Roll right
  [FishAction.ROLL_RIGHT]: [
    { node: 'BODY_ROOT', channel: 'rz', scale: 1, maxDegrees: 25 },
  ],

  // Tail sweep (for quick darting movements)
  [FishAction.TAIL_SWEEP]: [
    { node: 'TAIL_BASE', channel: 'ry', scale: 1, maxDegrees: 45 },
    { node: 'BODY_BACK', channel: 'ry', scale: 1, maxDegrees: 12 },  // 25 * 0.5
  ],
};

// ============================================================================
// FISH AU INFO - Metadata for each action (compatible with loomlarge AUInfo)
// facePart is used to group controls in the UI
// ============================================================================

export const FISH_AU_INFO: Record<string, AUInfo> = {
  // Body Orientation
  '2': { id: '2', name: 'Turn Left', facePart: 'Body Orientation' },
  '3': { id: '3', name: 'Turn Right', facePart: 'Body Orientation' },
  '4': { id: '4', name: 'Pitch Up', facePart: 'Body Orientation' },
  '5': { id: '5', name: 'Pitch Down', facePart: 'Body Orientation' },
  '6': { id: '6', name: 'Roll Left', facePart: 'Body Orientation' },
  '7': { id: '7', name: 'Roll Right', facePart: 'Body Orientation' },

  // Fins & Tail
  '12': { id: '12', name: 'Tail Sweep', facePart: 'Fins & Tail' },
};

// ============================================================================
// CONTINUUM PAIRS - Define which AUs form bidirectional pairs for sliders
// ============================================================================

/**
 * Fish continuum pairs - maps AU ID to its partner for bidirectional sliders
 * Format matches loomlarge's CONTINUUM_PAIRS_MAP
 */
export const FISH_CONTINUUM_PAIRS_MAP: Record<number, {
  pairId: number;
  isNegative: boolean;
  axis: 'pitch' | 'yaw' | 'roll';
  node: string;
}> = {
  // Turn (yaw) - head left/right
  [FishAction.TURN_LEFT]: { pairId: FishAction.TURN_RIGHT, isNegative: true, axis: 'yaw', node: 'HEAD' },
  [FishAction.TURN_RIGHT]: { pairId: FishAction.TURN_LEFT, isNegative: false, axis: 'yaw', node: 'HEAD' },
  // Pitch - nose up/down
  [FishAction.PITCH_DOWN]: { pairId: FishAction.PITCH_UP, isNegative: true, axis: 'pitch', node: 'HEAD' },
  [FishAction.PITCH_UP]: { pairId: FishAction.PITCH_DOWN, isNegative: false, axis: 'pitch', node: 'HEAD' },
  // Roll - body tilt left/right
  [FishAction.ROLL_LEFT]: { pairId: FishAction.ROLL_RIGHT, isNegative: true, axis: 'roll', node: 'BODY_ROOT' },
  [FishAction.ROLL_RIGHT]: { pairId: FishAction.ROLL_LEFT, isNegative: false, axis: 'roll', node: 'BODY_ROOT' },
};

/**
 * Human-readable labels for fish continuum pairs
 * Key format: "negativeAU-positiveAU"
 */
export const FISH_CONTINUUM_LABELS: Record<string, string> = {
  '2-3': 'Turn — Left ↔ Right',
  '5-4': 'Pitch — Down ↔ Up',
  '6-7': 'Roll — Left ↔ Right',
};

// ============================================================================
// COMPOSITE ROTATIONS - Defines how AUs map to bone rotation axes
// This is required for the engine to properly apply bone rotations
// ============================================================================

export const FISH_COMPOSITE_ROTATIONS: CompositeRotation[] = [
  {
    node: 'HEAD',
    pitch: { aus: [4, 5], axis: 'rx', negative: 5, positive: 4 },  // Pitch down/up
    yaw: { aus: [2, 3], axis: 'ry', negative: 2, positive: 3 },    // Turn left/right
    roll: null,
  },
  {
    node: 'BODY_FRONT',
    pitch: { aus: [4, 5], axis: 'rx', negative: 5, positive: 4 },
    yaw: { aus: [2, 3], axis: 'ry', negative: 2, positive: 3 },
    roll: null,
  },
  {
    node: 'BODY_MID',
    pitch: null,
    yaw: { aus: [2, 3], axis: 'ry', negative: 2, positive: 3 },
    roll: null,
  },
  {
    node: 'BODY_ROOT',
    pitch: null,
    yaw: null,
    roll: { aus: [6, 7], axis: 'rz', negative: 6, positive: 7 },   // Roll left/right
  },
  {
    node: 'TAIL_BASE',
    pitch: null,
    yaw: { aus: [12], axis: 'ry' },  // Tail sweep (single AU)
    roll: null,
  },
  {
    node: 'BODY_BACK',
    pitch: null,
    yaw: { aus: [12], axis: 'ry' },  // Tail sweep follows tail base
    roll: null,
  },
];

// Legacy format for backwards compatibility
export const FISH_ACTION_INFO = FISH_AU_INFO;

// ============================================================================
// PRESET EXPORT
// ============================================================================

export const BETTA_FISH_PRESET = {
  name: 'Betta Fish',
  bones: FISH_BONES,
  boneNodes: FISH_BONE_NODES,
  boneBindings: FISH_BONE_BINDINGS,
  actionInfo: FISH_ACTION_INFO,
  // No morph targets in this model
  auToMorphs: {} as Record<number, string[]>,
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],
};

// Engine-compatible config format for LoomLargeThree
export const FISH_AU_MAPPING_CONFIG = {
  auToBones: FISH_BONE_BINDINGS,
  boneNodes: FISH_BONE_NODES,
  auToMorphs: {} as Record<number, string[]>,
  morphToMesh: {} as Record<string, string[]>,
  visemeKeys: [] as string[],
  auInfo: FISH_AU_INFO,
  compositeRotations: FISH_COMPOSITE_ROTATIONS,
};

export default BETTA_FISH_PRESET;
