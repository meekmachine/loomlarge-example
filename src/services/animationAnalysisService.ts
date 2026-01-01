/**
 * Animation Analysis Service
 *
 * Analyzes embedded animation clips to understand bone behavior patterns.
 * Useful for:
 * - Validating that expected bones are actually animated
 * - Discovering which bones work together (chains)
 * - Inferring AU mappings from observed motion patterns
 * - Creating new AU definitions based on existing animations
 */

import * as THREE from 'three';
import type { ClipInfo, TrackInfo, ModelData } from './modelIntrospectionService';

/**
 * Per-bone animation analysis
 */
export interface BoneAnimationProfile {
  boneName: string;
  /** Total rotation range in degrees for each axis */
  rotationRange: {
    x: { min: number; max: number; range: number };
    y: { min: number; max: number; range: number };
    z: { min: number; max: number; range: number };
  };
  /** Total translation range in units for each axis */
  translationRange: {
    x: { min: number; max: number; range: number };
    y: { min: number; max: number; range: number };
    z: { min: number; max: number; range: number };
  };
  /** Number of keyframes across all tracks */
  keyframeCount: number;
  /** Whether this bone has significant motion */
  isActive: boolean;
  /** Primary motion axis (the one with most range) */
  primaryAxis: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz' | null;
  /** Normalized activity score (0-1) relative to most active bone */
  activityScore: number;
}

/**
 * Analysis of bone relationships and chains
 */
export interface BoneChain {
  /** Root bone of the chain */
  root: string;
  /** All bones in the chain (including root) */
  bones: string[];
  /** Motion correlation between chain members */
  correlatedMotion: boolean;
  /** Suggested semantic name based on patterns */
  suggestedName: string;
}

/**
 * Complete animation analysis result
 */
export interface AnimationAnalysis {
  clipName: string;
  duration: number;
  /** Per-bone motion profiles */
  boneProfiles: BoneAnimationProfile[];
  /** Bones sorted by activity (most active first) */
  activeBonesByActivity: string[];
  /** Detected bone chains */
  chains: BoneChain[];
  /** Suggested AU mappings based on motion patterns */
  suggestedAUs: SuggestedAUMapping[];
  /** Summary statistics */
  stats: {
    totalBones: number;
    activeBones: number;
    inactiveBones: number;
    maxRotationDegrees: number;
    maxTranslationUnits: number;
  };
}

/**
 * Suggested AU mapping inferred from animation
 */
export interface SuggestedAUMapping {
  /** Descriptive name for the action */
  actionName: string;
  /** Suggested AU ID (or 0 if new) */
  suggestedAuId: number;
  /** Bones involved */
  bones: string[];
  /** Primary rotation axis */
  primaryChannel: 'rx' | 'ry' | 'rz';
  /** Suggested max degrees based on observed range */
  suggestedMaxDegrees: number;
  /** Confidence in this suggestion (0-1) */
  confidence: number;
  /** Reasoning for this suggestion */
  reason: string;
}

/**
 * Convert quaternion to Euler angles in degrees
 */
function quaternionToEulerDegrees(q: THREE.Quaternion): THREE.Vector3 {
  const euler = new THREE.Euler().setFromQuaternion(q);
  return new THREE.Vector3(
    THREE.MathUtils.radToDeg(euler.x),
    THREE.MathUtils.radToDeg(euler.y),
    THREE.MathUtils.radToDeg(euler.z)
  );
}

/**
 * Analyze a single animation clip
 */
export function analyzeAnimationClip(clip: THREE.AnimationClip): AnimationAnalysis {
  const boneData = new Map<string, {
    rotations: THREE.Quaternion[];
    positions: THREE.Vector3[];
    keyframeCount: number;
  }>();

  // Extract all keyframe data by bone
  for (const track of clip.tracks) {
    const parts = track.name.split('.');
    const boneName = parts[0];
    const property = parts.slice(1).join('.');

    if (!boneData.has(boneName)) {
      boneData.set(boneName, {
        rotations: [],
        positions: [],
        keyframeCount: 0,
      });
    }

    const data = boneData.get(boneName)!;
    data.keyframeCount += track.times.length;

    const valueSize = track.getValueSize();

    if (property.includes('quaternion')) {
      // Quaternion values (4 components)
      for (let i = 0; i < track.values.length; i += 4) {
        data.rotations.push(new THREE.Quaternion(
          track.values[i],
          track.values[i + 1],
          track.values[i + 2],
          track.values[i + 3]
        ));
      }
    } else if (property.includes('position')) {
      // Position values (3 components)
      for (let i = 0; i < track.values.length; i += 3) {
        data.positions.push(new THREE.Vector3(
          track.values[i],
          track.values[i + 1],
          track.values[i + 2]
        ));
      }
    }
  }

  // Calculate profiles for each bone
  const boneProfiles: BoneAnimationProfile[] = [];
  let maxActivity = 0;

  for (const [boneName, data] of boneData) {
    // Calculate rotation ranges (convert quaternions to euler)
    const eulerAngles = data.rotations.map(q => quaternionToEulerDegrees(q));

    const rotX = eulerAngles.length > 0
      ? { min: Math.min(...eulerAngles.map(e => e.x)), max: Math.max(...eulerAngles.map(e => e.x)) }
      : { min: 0, max: 0 };
    const rotY = eulerAngles.length > 0
      ? { min: Math.min(...eulerAngles.map(e => e.y)), max: Math.max(...eulerAngles.map(e => e.y)) }
      : { min: 0, max: 0 };
    const rotZ = eulerAngles.length > 0
      ? { min: Math.min(...eulerAngles.map(e => e.z)), max: Math.max(...eulerAngles.map(e => e.z)) }
      : { min: 0, max: 0 };

    // Calculate translation ranges
    const posX = data.positions.length > 0
      ? { min: Math.min(...data.positions.map(p => p.x)), max: Math.max(...data.positions.map(p => p.x)) }
      : { min: 0, max: 0 };
    const posY = data.positions.length > 0
      ? { min: Math.min(...data.positions.map(p => p.y)), max: Math.max(...data.positions.map(p => p.y)) }
      : { min: 0, max: 0 };
    const posZ = data.positions.length > 0
      ? { min: Math.min(...data.positions.map(p => p.z)), max: Math.max(...data.positions.map(p => p.z)) }
      : { min: 0, max: 0 };

    const rotationRange = {
      x: { ...rotX, range: rotX.max - rotX.min },
      y: { ...rotY, range: rotY.max - rotY.min },
      z: { ...rotZ, range: rotZ.max - rotZ.min },
    };

    const translationRange = {
      x: { ...posX, range: posX.max - posX.min },
      y: { ...posY, range: posY.max - posY.min },
      z: { ...posZ, range: posZ.max - posZ.min },
    };

    // Determine primary axis
    const ranges = [
      { axis: 'rx' as const, value: rotationRange.x.range },
      { axis: 'ry' as const, value: rotationRange.y.range },
      { axis: 'rz' as const, value: rotationRange.z.range },
      { axis: 'tx' as const, value: translationRange.x.range * 100 }, // Scale for comparison
      { axis: 'ty' as const, value: translationRange.y.range * 100 },
      { axis: 'tz' as const, value: translationRange.z.range * 100 },
    ];

    const maxRange = Math.max(...ranges.map(r => r.value));
    const primaryAxis = maxRange > 0.1 ? ranges.find(r => r.value === maxRange)?.axis || null : null;

    // Activity is sum of all rotation ranges
    const totalRotationRange = rotationRange.x.range + rotationRange.y.range + rotationRange.z.range;
    const isActive = totalRotationRange > 1; // More than 1 degree total motion

    if (totalRotationRange > maxActivity) {
      maxActivity = totalRotationRange;
    }

    boneProfiles.push({
      boneName,
      rotationRange,
      translationRange,
      keyframeCount: data.keyframeCount,
      isActive,
      primaryAxis,
      activityScore: 0, // Will be normalized later
    });
  }

  // Normalize activity scores
  for (const profile of boneProfiles) {
    const totalRange = profile.rotationRange.x.range +
                       profile.rotationRange.y.range +
                       profile.rotationRange.z.range;
    profile.activityScore = maxActivity > 0 ? totalRange / maxActivity : 0;
  }

  // Sort by activity
  boneProfiles.sort((a, b) => b.activityScore - a.activityScore);
  const activeBonesByActivity = boneProfiles
    .filter(p => p.isActive)
    .map(p => p.boneName);

  // Detect chains (simplified - looks for numbered bone sequences)
  const chains = detectBoneChains(boneProfiles);

  // Suggest AU mappings
  const suggestedAUs = suggestAUMappings(boneProfiles, chains);

  // Calculate stats
  const stats = {
    totalBones: boneProfiles.length,
    activeBones: boneProfiles.filter(p => p.isActive).length,
    inactiveBones: boneProfiles.filter(p => !p.isActive).length,
    maxRotationDegrees: Math.max(
      ...boneProfiles.flatMap(p => [
        p.rotationRange.x.range,
        p.rotationRange.y.range,
        p.rotationRange.z.range,
      ])
    ),
    maxTranslationUnits: Math.max(
      ...boneProfiles.flatMap(p => [
        p.translationRange.x.range,
        p.translationRange.y.range,
        p.translationRange.z.range,
      ])
    ),
  };

  return {
    clipName: clip.name,
    duration: clip.duration,
    boneProfiles,
    activeBonesByActivity,
    chains,
    suggestedAUs,
    stats,
  };
}

/**
 * Detect bone chains based on naming patterns
 */
function detectBoneChains(profiles: BoneAnimationProfile[]): BoneChain[] {
  const chains: BoneChain[] = [];
  const usedBones = new Set<string>();

  // Look for numbered sequences (e.g., Bone001, Bone002, Bone003)
  const numberedBones = profiles
    .map(p => p.boneName)
    .filter(name => /\d{2,3}/.test(name));

  // Group by prefix
  const prefixGroups = new Map<string, string[]>();
  for (const name of numberedBones) {
    const match = name.match(/^(.+?)(\d{2,3})(.*)$/);
    if (match) {
      const [, prefix, , suffix] = match;
      const key = prefix + '***' + suffix;
      if (!prefixGroups.has(key)) {
        prefixGroups.set(key, []);
      }
      prefixGroups.get(key)!.push(name);
    }
  }

  // Create chains from groups
  for (const [key, bones] of prefixGroups) {
    if (bones.length >= 2) {
      // Sort numerically
      bones.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      });

      for (const bone of bones) {
        usedBones.add(bone);
      }

      // Suggest name based on bone name patterns
      const rootName = bones[0].toLowerCase();
      let suggestedName = 'Chain';
      if (rootName.includes('tail')) suggestedName = 'Tail';
      else if (rootName.includes('fin')) suggestedName = 'Fin';
      else if (rootName.includes('spine')) suggestedName = 'Spine';
      else if (rootName.includes('arm')) suggestedName = 'Arm';
      else if (rootName.includes('leg')) suggestedName = 'Leg';

      chains.push({
        root: bones[0],
        bones,
        correlatedMotion: true, // Assume correlated for numbered chains
        suggestedName,
      });
    }
  }

  return chains;
}

/**
 * Suggest AU mappings based on animation analysis
 */
function suggestAUMappings(
  profiles: BoneAnimationProfile[],
  chains: BoneChain[]
): SuggestedAUMapping[] {
  const suggestions: SuggestedAUMapping[] = [];

  // Suggest AUs for highly active bones
  const activeProfiles = profiles.filter(p => p.isActive && p.activityScore > 0.3);

  for (const profile of activeProfiles) {
    const boneName = profile.boneName.toLowerCase();

    // Determine suggested AU based on bone name and motion
    let suggestedAuId = 0;
    let actionName = '';

    if (boneName.includes('head')) {
      if (profile.primaryAxis === 'ry') {
        suggestedAuId = profile.rotationRange.y.max > 0 ? 51 : 52; // Head turn
        actionName = 'Head Turn';
      } else if (profile.primaryAxis === 'rx') {
        suggestedAuId = profile.rotationRange.x.max > 0 ? 54 : 53; // Head pitch
        actionName = 'Head Pitch';
      } else if (profile.primaryAxis === 'rz') {
        suggestedAuId = 55; // Head tilt
        actionName = 'Head Tilt';
      }
    } else if (boneName.includes('tail')) {
      actionName = 'Tail Movement';
      suggestedAuId = 12; // Fish-specific
    } else if (boneName.includes('fin') || boneName.includes('pectoral')) {
      actionName = 'Fin Movement';
      suggestedAuId = 20; // Fish-specific
    } else if (boneName.includes('jaw')) {
      actionName = 'Jaw Movement';
      suggestedAuId = 26;
    }

    if (actionName && profile.primaryAxis) {
      const maxDegrees = Math.ceil(
        Math.max(
          profile.rotationRange.x.range,
          profile.rotationRange.y.range,
          profile.rotationRange.z.range
        )
      );

      suggestions.push({
        actionName,
        suggestedAuId,
        bones: [profile.boneName],
        primaryChannel: profile.primaryAxis.startsWith('r')
          ? profile.primaryAxis as 'rx' | 'ry' | 'rz'
          : 'rz',
        suggestedMaxDegrees: Math.max(maxDegrees, 15), // Minimum 15 degrees
        confidence: profile.activityScore,
        reason: `High activity (${(profile.activityScore * 100).toFixed(0)}%) with primary motion on ${profile.primaryAxis}`,
      });
    }
  }

  // Suggest AUs for chains
  for (const chain of chains) {
    if (chain.bones.length >= 3) {
      suggestions.push({
        actionName: `${chain.suggestedName} Wave`,
        suggestedAuId: 0, // New AU
        bones: chain.bones,
        primaryChannel: 'rz',
        suggestedMaxDegrees: 30,
        confidence: 0.6,
        reason: `Detected ${chain.bones.length}-bone chain with correlated motion`,
      });
    }
  }

  return suggestions;
}

/**
 * Format animation analysis as readable text
 */
export function formatAnimationReport(analysis: AnimationAnalysis): string {
  const lines: string[] = [
    `Animation Analysis: "${analysis.clipName}"`,
    `=======================================`,
    `Duration: ${analysis.duration.toFixed(2)}s`,
    ``,
    `Bones: ${analysis.stats.totalBones} total`,
    `  Active: ${analysis.stats.activeBones}`,
    `  Inactive: ${analysis.stats.inactiveBones}`,
    `  Max rotation: ${analysis.stats.maxRotationDegrees.toFixed(1)}°`,
    `  Max translation: ${analysis.stats.maxTranslationUnits.toFixed(4)} units`,
    ``,
  ];

  if (analysis.activeBonesByActivity.length > 0) {
    lines.push(`Most Active Bones (top 10):`);
    for (const boneName of analysis.activeBonesByActivity.slice(0, 10)) {
      const profile = analysis.boneProfiles.find(p => p.boneName === boneName)!;
      const activity = (profile.activityScore * 100).toFixed(0);
      lines.push(`  ${boneName}: ${activity}% activity, primary axis: ${profile.primaryAxis || 'none'}`);
    }
    lines.push('');
  }

  if (analysis.chains.length > 0) {
    lines.push(`Detected Chains:`);
    for (const chain of analysis.chains) {
      lines.push(`  ${chain.suggestedName}: ${chain.bones.length} bones (root: ${chain.root})`);
    }
    lines.push('');
  }

  if (analysis.suggestedAUs.length > 0) {
    lines.push(`Suggested AU Mappings:`);
    for (const suggestion of analysis.suggestedAUs) {
      const confidence = (suggestion.confidence * 100).toFixed(0);
      lines.push(`  ${suggestion.actionName} (AU ${suggestion.suggestedAuId || 'NEW'})`);
      lines.push(`    Bones: ${suggestion.bones.join(', ')}`);
      lines.push(`    Channel: ${suggestion.primaryChannel}, Max: ${suggestion.suggestedMaxDegrees}°`);
      lines.push(`    Confidence: ${confidence}%`);
      lines.push(`    Reason: ${suggestion.reason}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate bone binding code from animation analysis
 */
export function generateBoneBindingsFromAnalysis(
  analysis: AnimationAnalysis,
  semanticMapping: Record<string, string> // e.g., { 'HEAD': 'Bone001_Armature' }
): string {
  const lines: string[] = [
    `// Auto-generated bone bindings from animation "${analysis.clipName}"`,
    `// `,
    ``,
    `export const BONE_BINDINGS: Record<number, BoneBinding[]> = {`,
  ];

  // Reverse the semantic mapping
  const boneToSemantic = new Map<string, string>();
  for (const [semantic, bone] of Object.entries(semanticMapping)) {
    boneToSemantic.set(bone, semantic);
  }

  for (const suggestion of analysis.suggestedAUs) {
    if (suggestion.suggestedAuId === 0) continue; // Skip new AUs for now

    lines.push(`  // ${suggestion.actionName}`);
    lines.push(`  [${suggestion.suggestedAuId}]: [`);

    for (const boneName of suggestion.bones) {
      const semantic = boneToSemantic.get(boneName) || `'${boneName}'`;
      lines.push(`    { node: '${semantic}', channel: '${suggestion.primaryChannel}', scale: 1, maxDegrees: ${suggestion.suggestedMaxDegrees} },`);
    }

    lines.push(`  ],`);
  }

  lines.push(`};`);

  return lines.join('\n');
}
