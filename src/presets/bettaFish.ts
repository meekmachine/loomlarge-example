/**
 * Betta Fish Preset - Re-exports from loomlarge
 *
 * This preset is maintained in the loomlarge library.
 * This file re-exports all the preset components for use in the example app.
 *
 * All variable names are animal-agnostic (BONES, AU_INFO, etc.) -
 * same names used across all presets, only the preset name differs.
 */

// Re-export everything from loomlarge's betta fish preset
export {
  BETTA_FISH_PRESET,
  BONES,
  BONE_NODES,
  BONE_BINDINGS,
  AU_INFO,
  CONTINUUM_PAIRS_MAP,
  CONTINUUM_LABELS,
  buildContinuumLabels,
  getContinuumLabelForPair,
  COMPOSITE_ROTATIONS,
  EYE_MESH_NODES,
  MESHES,
  AU_MAPPING_CONFIG,
  hasLeftRightBones,
} from 'loomlarge/presets/bettaFish';

export { BETTA_FISH_PRESET as default } from 'loomlarge/presets/bettaFish';
