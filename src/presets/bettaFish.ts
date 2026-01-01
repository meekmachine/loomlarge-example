/**
 * Betta Fish Preset - Re-exports from loomlarge
 *
 * This preset is maintained in the loomlarge library.
 * This file re-exports all the preset components for use in the example app.
 */

// Re-export everything from loomlarge's betta fish preset
export {
  // Animal-agnostic names (preferred)
  BETTA_BONES as BONES,
  BETTA_BONE_NODES as BONE_NODES,
  BETTA_BONE_BINDINGS as BONE_BINDINGS,
  BETTA_AU_INFO as AU_INFO,
  BETTA_CONTINUUM_PAIRS_MAP as CONTINUUM_PAIRS_MAP,
  BETTA_CONTINUUM_LABELS as CONTINUUM_LABELS,
  buildContinuumLabels,
  getContinuumLabelForPair,
  BETTA_COMPOSITE_ROTATIONS as COMPOSITE_ROTATIONS,
  BETTA_EYE_MESH_NODES as EYE_MESH_NODES,
  BETTA_MESHES as MESHES,
  BETTA_AU_MAPPING_CONFIG as AU_MAPPING_CONFIG,
  bettaHasLeftRightBones as hasLeftRightBones,
  // Main preset export
  BETTA_FISH_PRESET,
  // Legacy FISH_ prefixed names for backwards compatibility
  FISH_BONES,
  FISH_BONE_NODES,
  FISH_BONE_BINDINGS,
  FISH_AU_INFO,
  FISH_ACTION_INFO,
  FISH_CONTINUUM_PAIRS_MAP,
  FISH_CONTINUUM_LABELS,
  FISH_COMPOSITE_ROTATIONS,
  FISH_EYE_MESH_NODES,
  FISH_MESHES,
  FISH_AU_MAPPING_CONFIG,
  fishHasLeftRightBones,
} from 'loomlarge';

export { BETTA_FISH_PRESET as default } from 'loomlarge';
