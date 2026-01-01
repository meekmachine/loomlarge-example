/**
 * Model Introspection Service
 *
 * Extracts bones, morph targets, and animation data from loaded 3D models.
 * Used for diagnosing broken mappings and generating corrected configurations.
 */

import * as THREE from 'three';

/**
 * Bone info extracted from model skeleton
 */
export interface BoneInfo {
  name: string;
  parent: string | null;
  children: string[];
  worldPosition: { x: number; y: number; z: number };
  /** Depth in hierarchy (0 = root) */
  depth: number;
}

/**
 * Morph target info extracted from mesh
 */
export interface MorphInfo {
  name: string;
  meshName: string;
  index: number;
}

/**
 * Animation track info
 */
export interface TrackInfo {
  name: string;
  targetName: string;
  property: string;
  type: 'position' | 'rotation' | 'scale' | 'morph' | 'unknown';
  keyframeCount: number;
  /** Min/max values observed in keyframes */
  valueRange?: { min: number[]; max: number[] };
}

/**
 * Animation clip info
 */
export interface ClipInfo {
  name: string;
  duration: number;
  tracks: TrackInfo[];
  /** Bones that have animation tracks */
  animatedBones: string[];
  /** Morphs that have animation tracks */
  animatedMorphs: string[];
}

/**
 * Complete model data extraction result
 */
export interface ModelData {
  /** All bones in the skeleton */
  bones: BoneInfo[];
  /** All morph targets across all meshes */
  morphs: MorphInfo[];
  /** All animation clips */
  animations: ClipInfo[];
  /** Bone name to BoneInfo lookup */
  boneMap: Map<string, BoneInfo>;
  /** Quick list of bone names */
  boneNames: string[];
  /** Quick list of morph names (may have duplicates across meshes) */
  morphNames: string[];
  /** Meshes with morph targets */
  morphMeshes: string[];
}

/**
 * Extract bone hierarchy from a Three.js object
 */
function extractBones(root: THREE.Object3D): BoneInfo[] {
  const bones: BoneInfo[] = [];
  const boneDepths = new Map<string, number>();

  // First pass: find all bones and calculate depths
  root.traverse((obj) => {
    if (obj instanceof THREE.Bone || obj.type === 'Bone') {
      const worldPos = new THREE.Vector3();
      obj.getWorldPosition(worldPos);

      // Calculate depth by walking up the parent chain
      let depth = 0;
      let parent = obj.parent;
      while (parent) {
        if (parent instanceof THREE.Bone || parent.type === 'Bone') {
          depth++;
        }
        parent = parent.parent;
      }
      boneDepths.set(obj.name, depth);

      const parentBone = obj.parent instanceof THREE.Bone || obj.parent?.type === 'Bone'
        ? obj.parent.name
        : null;

      bones.push({
        name: obj.name,
        parent: parentBone,
        children: [], // Will be filled in second pass
        worldPosition: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
        depth,
      });
    }
  });

  // Second pass: fill in children
  for (const bone of bones) {
    bone.children = bones
      .filter(b => b.parent === bone.name)
      .map(b => b.name);
  }

  // Sort by depth, then alphabetically
  bones.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });

  return bones;
}

/**
 * Extract morph targets from meshes
 */
function extractMorphs(meshes: THREE.Mesh[]): MorphInfo[] {
  const morphs: MorphInfo[] = [];

  for (const mesh of meshes) {
    const geo = mesh.geometry;
    if (!geo.morphAttributes) continue;

    // Get morph target dictionary if available
    const dict = (geo as any).morphTargetDictionary as Record<string, number> | undefined;

    if (dict) {
      for (const [name, index] of Object.entries(dict)) {
        morphs.push({
          name,
          meshName: mesh.name,
          index,
        });
      }
    } else if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
      // Fallback: no dictionary, just numbered morphs
      for (let i = 0; i < mesh.morphTargetInfluences.length; i++) {
        morphs.push({
          name: `morph_${i}`,
          meshName: mesh.name,
          index: i,
        });
      }
    }
  }

  return morphs;
}

/**
 * Parse animation track to extract info
 */
function parseTrack(track: THREE.KeyframeTrack): TrackInfo {
  // Track name format: "objectName.property" or "objectName.property[index]"
  const parts = track.name.split('.');
  const targetName = parts[0];
  const property = parts.slice(1).join('.');

  let type: TrackInfo['type'] = 'unknown';
  if (property.includes('position')) type = 'position';
  else if (property.includes('quaternion') || property.includes('rotation')) type = 'rotation';
  else if (property.includes('scale')) type = 'scale';
  else if (property.includes('morphTargetInfluences')) type = 'morph';

  // Calculate value ranges
  const values = track.values;
  const valueSize = track.getValueSize();
  let min: number[] = [];
  let max: number[] = [];

  if (values.length > 0) {
    min = Array(valueSize).fill(Infinity);
    max = Array(valueSize).fill(-Infinity);

    for (let i = 0; i < values.length; i += valueSize) {
      for (let j = 0; j < valueSize; j++) {
        const v = values[i + j];
        if (v < min[j]) min[j] = v;
        if (v > max[j]) max[j] = v;
      }
    }
  }

  return {
    name: track.name,
    targetName,
    property,
    type,
    keyframeCount: track.times.length,
    valueRange: min.length > 0 ? { min, max } : undefined,
  };
}

/**
 * Extract animation clip info
 */
function extractAnimations(animations: THREE.AnimationClip[]): ClipInfo[] {
  return animations.map(clip => {
    const tracks = clip.tracks.map(parseTrack);

    const animatedBones = new Set<string>();
    const animatedMorphs = new Set<string>();

    for (const track of tracks) {
      if (track.type === 'rotation' || track.type === 'position') {
        animatedBones.add(track.targetName);
      } else if (track.type === 'morph') {
        animatedMorphs.add(track.name);
      }
    }

    return {
      name: clip.name,
      duration: clip.duration,
      tracks,
      animatedBones: Array.from(animatedBones),
      animatedMorphs: Array.from(animatedMorphs),
    };
  });
}

/**
 * Extract all available data from a loaded model
 *
 * @param model - The root Object3D of the loaded model
 * @param meshes - Array of meshes with morph targets
 * @param animations - Array of AnimationClips from the GLTF
 */
export function extractModelData(
  model: THREE.Object3D,
  meshes: THREE.Mesh[] = [],
  animations: THREE.AnimationClip[] = []
): ModelData {
  const bones = extractBones(model);
  const morphs = extractMorphs(meshes);
  const animationInfos = extractAnimations(animations);

  const boneMap = new Map<string, BoneInfo>();
  for (const bone of bones) {
    boneMap.set(bone.name, bone);
  }

  const morphMeshes = [...new Set(morphs.map(m => m.meshName))];

  return {
    bones,
    morphs,
    animations: animationInfos,
    boneMap,
    boneNames: bones.map(b => b.name),
    morphNames: morphs.map(m => m.name),
    morphMeshes,
  };
}

/**
 * Find a bone by name (exact match)
 */
export function findBone(data: ModelData, name: string): BoneInfo | undefined {
  return data.boneMap.get(name);
}

/**
 * Find bones matching a pattern (case-insensitive)
 */
export function findBonesMatching(data: ModelData, pattern: string): BoneInfo[] {
  const regex = new RegExp(pattern, 'i');
  return data.bones.filter(b => regex.test(b.name));
}

/**
 * Find morphs matching a pattern (case-insensitive)
 */
export function findMorphsMatching(data: ModelData, pattern: string): MorphInfo[] {
  const regex = new RegExp(pattern, 'i');
  return data.morphs.filter(m => regex.test(m.name));
}

/**
 * Get bone hierarchy as indented text
 */
export function formatBoneHierarchy(data: ModelData): string {
  const lines: string[] = [];

  for (const bone of data.bones) {
    const indent = '  '.repeat(bone.depth);
    const childCount = bone.children.length;
    const childInfo = childCount > 0 ? ` (${childCount} children)` : '';
    lines.push(`${indent}${bone.name}${childInfo}`);
  }

  return lines.join('\n');
}

/**
 * Get summary statistics about the model
 */
export function getModelSummary(data: ModelData): string {
  const lines: string[] = [
    `Bones: ${data.bones.length}`,
    `  Root bones: ${data.bones.filter(b => !b.parent).length}`,
    `  Max depth: ${Math.max(...data.bones.map(b => b.depth), 0)}`,
    `Morph Targets: ${data.morphs.length}`,
    `  Meshes with morphs: ${data.morphMeshes.length}`,
    `Animations: ${data.animations.length}`,
  ];

  for (const anim of data.animations) {
    lines.push(`  "${anim.name}": ${anim.duration.toFixed(2)}s, ${anim.tracks.length} tracks`);
    lines.push(`    Animated bones: ${anim.animatedBones.length}`);
    if (anim.animatedMorphs.length > 0) {
      lines.push(`    Animated morphs: ${anim.animatedMorphs.length}`);
    }
  }

  return lines.join('\n');
}

/**
 * Export model data as JSON for analysis
 */
export function exportModelDataAsJSON(data: ModelData): string {
  return JSON.stringify({
    boneNames: data.boneNames,
    boneHierarchy: data.bones.map(b => ({
      name: b.name,
      parent: b.parent,
      depth: b.depth,
    })),
    morphNames: data.morphNames,
    morphsByMesh: Object.fromEntries(
      data.morphMeshes.map(meshName => [
        meshName,
        data.morphs.filter(m => m.meshName === meshName).map(m => m.name),
      ])
    ),
    animations: data.animations.map(a => ({
      name: a.name,
      duration: a.duration,
      animatedBones: a.animatedBones,
      animatedMorphs: a.animatedMorphs,
    })),
  }, null, 2);
}
