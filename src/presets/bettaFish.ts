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
  "Bone.001_Armature",
  "Bone.009_Armature",
  "Bone.027_Armature",
  "Bone.029_Armature",
  "Bone.031_Armature",
  "Bone.028_Armature",
  "Bone.030_Armature",
  "Bone.032_Armature",
  "Bone.010_Armature",
  "Bone.012_Armature",
  "Bone.014_Armature",
  "Bone.016_Armature",
  "Bone.011_Armature",
  "Bone.013_Armature",
  "Bone.015_Armature",
  "Bone.017_Armature",
  "Bone.002_Armature",
  "Bone.003_Armature",
  "Bone.004_Armature",
  "Bone.005_Armature",
  "Bone.020_Armature",
  "Bone.025_Armature",
  "Bone.026_Armature",
  "Bone.039_Armature",
  "Bone.040_Armature",
  "Bone.041_Armature",
  "Bone.042_Armature",
  "Bone.043_Armature",
  "Bone.044_Armature",
  "Bone.045_Armature",
  "Bone.019_Armature",
  "Bone.023_Armature",
  "Bone.024_Armature",
  "Bone.034_Armature",
  "Bone.036_Armature",
  "Bone.038_Armature",
  "Bone.018_Armature",
  "Bone.021_Armature",
  "Bone.022_Armature",
  "Bone.033_Armature",
  "Bone.035_Armature",
  "Bone.037_Armature",
  "Bone.046_Armature",
  "Bone.048_Armature",
  "Bone.050_Armature",
  "Bone.047_Armature",
  "Bone.049_Armature",
  "Bone.051_Armature",
  "Bone.006_Armature",
  "Bone.007_Armature",
  "Bone.008_Armature"
] as const;

// ============================================================================
// SEMANTIC BONE MAPPINGS - Human-readable names for key bones
// ============================================================================

export const FISH_BONE_NODES = {
  // Root and body
  ROOT: 'Armature_rootJoint',
  BODY_ROOT: 'Bone_Armature',
  HEAD: 'Bone.001_Armature',

  // Body spine (front to back)
  BODY_FRONT: 'Bone.002_Armature',
  BODY_MID: 'Bone.003_Armature',
  BODY_BACK: 'Bone.004_Armature',
  TAIL_BASE: 'Bone.005_Armature',

  // Pectoral fins (left/right) - for swimming motion
  PECTORAL_L: 'Bone.046_Armature',
  PECTORAL_L_MID: 'Bone.048_Armature',
  PECTORAL_L_TIP: 'Bone.050_Armature',
  PECTORAL_R: 'Bone.047_Armature',
  PECTORAL_R_MID: 'Bone.049_Armature',
  PECTORAL_R_TIP: 'Bone.051_Armature',

  // Dorsal fin
  DORSAL_ROOT: 'Bone.006_Armature',
  DORSAL_L: 'Bone.007_Armature',
  DORSAL_R: 'Bone.008_Armature',

  // Head area (eyes/gills - left side)
  EYE_AREA_L_1: 'Bone.009_Armature',
  EYE_AREA_L_2: 'Bone.010_Armature',
  EYE_AREA_L_3: 'Bone.011_Armature',

  // Head area (eyes/gills - right side)
  EYE_AREA_R_1: 'Bone.027_Armature',
  EYE_AREA_R_2: 'Bone.028_Armature',

  // Tail fins (multiple chains for flowing motion)
  TAIL_FIN_1: 'Bone.020_Armature',
  TAIL_FIN_2: 'Bone.039_Armature',
  TAIL_FIN_3: 'Bone.019_Armature',
  TAIL_FIN_4: 'Bone.034_Armature',
  TAIL_FIN_5: 'Bone.018_Armature',
  TAIL_FIN_6: 'Bone.033_Armature',
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
