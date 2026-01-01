/**
 * Mapping Analysis Service
 *
 * Compares expected AU/bone/morph mappings against actual model data
 * to identify broken mappings and suggest corrections.
 *
 * Focused on skeletal-only models like the Betta fish.
 */

import type { ModelData, BoneInfo } from './modelIntrospectionService';
import type { AUMappingConfig, MeshInfo } from 'loomlarge';
import type { BoneBinding, AUInfo } from 'loomlarge';

/**
 * Result of comparing a preset against actual model data
 */
export interface MappingAnalysis {
  /** Bones expected by preset but not found in model */
  missingBones: MissingBoneInfo[];
  /** Morphs expected by preset but not found in model */
  missingMorphs: MissingMorphInfo[];
  /** Bones found in model that aren't referenced in preset */
  unusedBones: string[];
  /** Morphs found in model that aren't referenced in preset */
  unusedMorphs: string[];
  /** Suggested corrections for missing mappings */
  suggestions: MappingSuggestion[];
  /** Overall mapping health score (0-100) */
  healthScore: number;
  /** Summary of issues */
  summary: string;
}

export interface MissingBoneInfo {
  /** Semantic key (e.g., 'HEAD', 'JAW') */
  semanticKey: string;
  /** Expected bone name from preset */
  expectedName: string;
  /** Which AUs use this bone */
  affectedAUs: number[];
}

export interface MissingMorphInfo {
  /** Morph target name expected */
  morphName: string;
  /** Which AUs use this morph */
  affectedAUs: number[];
}

export interface MappingSuggestion {
  type: 'bone' | 'morph';
  /** Original name from preset */
  expected: string;
  /** Suggested replacement from model */
  suggested: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for suggestion */
  reason: string;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();

  if (lowerA === lowerB) return 1;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(lowerA, lowerB);
  return 1 - distance / maxLen;
}

/**
 * Extract semantic meaning from bone name
 */
function extractBoneSemantics(name: string): string[] {
  const semantics: string[] = [];
  const lower = name.toLowerCase();

  // Common bone semantic patterns
  const patterns: Record<string, string[]> = {
    head: ['head', 'skull', 'cranium'],
    neck: ['neck', 'cervical'],
    jaw: ['jaw', 'mandible', 'chin'],
    eye: ['eye', 'ocular', 'orbital'],
    tongue: ['tongue', 'lingual'],
    spine: ['spine', 'vertebra', 'spinal', 'back'],
    arm: ['arm', 'upper_arm', 'forearm', 'humerus', 'radius', 'ulna'],
    hand: ['hand', 'wrist', 'palm'],
    finger: ['finger', 'thumb', 'index', 'middle', 'ring', 'pinky', 'phalang'],
    leg: ['leg', 'thigh', 'calf', 'femur', 'tibia', 'fibula'],
    foot: ['foot', 'ankle', 'heel', 'toe'],
    tail: ['tail', 'caudal'],
    fin: ['fin', 'pectoral', 'dorsal', 'ventral', 'pelvic', 'anal', 'caudal'],
    gill: ['gill', 'opercul', 'branchiostegal'],
    root: ['root', 'armature', 'skeleton'],
    body: ['body', 'torso', 'trunk', 'hip', 'pelvis'],
  };

  for (const [semantic, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => lower.includes(k))) {
      semantics.push(semantic);
    }
  }

  // Left/right detection
  if (lower.includes('_l') || lower.includes('left') || lower.includes('.l')) {
    semantics.push('left');
  }
  if (lower.includes('_r') || lower.includes('right') || lower.includes('.r')) {
    semantics.push('right');
  }

  return semantics;
}

/**
 * Find best matching bone from model for an expected bone name
 */
function findBestBoneMatch(
  expectedName: string,
  modelBones: BoneInfo[],
  semanticKey: string
): MappingSuggestion | null {
  const expectedSemantics = extractBoneSemantics(expectedName);
  const keySemantics = extractBoneSemantics(semanticKey);

  let bestMatch: MappingSuggestion | null = null;
  let bestScore = 0;

  for (const bone of modelBones) {
    // String similarity
    const nameSimilarity = stringSimilarity(expectedName, bone.name);

    // Semantic similarity
    const boneSemantics = extractBoneSemantics(bone.name);
    const semanticOverlap = [...expectedSemantics, ...keySemantics].filter(
      s => boneSemantics.includes(s)
    ).length;
    const semanticScore = semanticOverlap / Math.max(expectedSemantics.length + keySemantics.length, 1);

    // Combined score (weighted)
    const score = nameSimilarity * 0.6 + semanticScore * 0.4;

    if (score > bestScore && score > 0.3) {
      bestScore = score;
      const reasons: string[] = [];
      if (nameSimilarity > 0.5) reasons.push(`similar name (${(nameSimilarity * 100).toFixed(0)}%)`);
      if (semanticOverlap > 0) reasons.push(`semantic match: ${boneSemantics.filter(s => [...expectedSemantics, ...keySemantics].includes(s)).join(', ')}`);

      bestMatch = {
        type: 'bone',
        expected: expectedName,
        suggested: bone.name,
        confidence: score,
        reason: reasons.join('; ') || 'fuzzy match',
      };
    }
  }

  return bestMatch;
}

/**
 * Analyze bone mapping configuration against actual model data
 */
export function analyzeBoneMappings(
  modelData: ModelData,
  boneNodes: Record<string, string>,
  auToBones: Record<number, BoneBinding[]>
): {
  missingBones: MissingBoneInfo[];
  suggestions: MappingSuggestion[];
  unusedBones: string[];
} {
  const missingBones: MissingBoneInfo[] = [];
  const suggestions: MappingSuggestion[] = [];
  const usedBones = new Set<string>();

  // Check each semantic key
  for (const [semanticKey, expectedBoneName] of Object.entries(boneNodes)) {
    const found = modelData.boneMap.has(expectedBoneName);

    if (found) {
      usedBones.add(expectedBoneName);
    } else {
      // Find which AUs are affected
      const affectedAUs: number[] = [];
      for (const [auId, bindings] of Object.entries(auToBones)) {
        if (bindings.some(b => b.node === semanticKey)) {
          affectedAUs.push(parseInt(auId));
        }
      }

      missingBones.push({
        semanticKey,
        expectedName: expectedBoneName,
        affectedAUs,
      });

      // Try to find a match
      const suggestion = findBestBoneMatch(expectedBoneName, modelData.bones, semanticKey);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }
  }

  // Find unused bones
  const unusedBones = modelData.boneNames.filter(name => !usedBones.has(name));

  return { missingBones, suggestions, unusedBones };
}

/**
 * Analyze morph mapping configuration against actual model data
 */
export function analyzeMorphMappings(
  modelData: ModelData,
  auToMorphs: Record<number, string[]>
): {
  missingMorphs: MissingMorphInfo[];
  suggestions: MappingSuggestion[];
  unusedMorphs: string[];
} {
  const missingMorphs: MissingMorphInfo[] = [];
  const suggestions: MappingSuggestion[] = [];
  const usedMorphs = new Set<string>();
  const morphNameSet = new Set(modelData.morphNames);

  // Check each AU's morph targets
  for (const [auId, morphNames] of Object.entries(auToMorphs)) {
    for (const morphName of morphNames) {
      if (morphNameSet.has(morphName)) {
        usedMorphs.add(morphName);
      } else {
        // Check if this morph is already in missing list
        const existing = missingMorphs.find(m => m.morphName === morphName);
        if (existing) {
          existing.affectedAUs.push(parseInt(auId));
        } else {
          missingMorphs.push({
            morphName,
            affectedAUs: [parseInt(auId)],
          });

          // Try to find a match
          let bestSuggestion: MappingSuggestion | null = null;
          let bestScore = 0;

          for (const actualMorph of modelData.morphNames) {
            const score = stringSimilarity(morphName, actualMorph);
            if (score > bestScore && score > 0.4) {
              bestScore = score;
              bestSuggestion = {
                type: 'morph',
                expected: morphName,
                suggested: actualMorph,
                confidence: score,
                reason: `similar name (${(score * 100).toFixed(0)}% match)`,
              };
            }
          }

          if (bestSuggestion) {
            suggestions.push(bestSuggestion);
          }
        }
      }
    }
  }

  const unusedMorphs = modelData.morphNames.filter(name => !usedMorphs.has(name));

  return { missingMorphs, suggestions, unusedMorphs };
}

/**
 * Analyze a complete preset against model data
 */
export function analyzeMapping(
  modelData: ModelData,
  preset: AUMappingConfig
): MappingAnalysis {
  // Analyze bone mappings
  const boneAnalysis = analyzeBoneMappings(
    modelData,
    preset.boneNodes,
    preset.auToBones
  );

  // Analyze morph mappings (only if model has morphs)
  const morphAnalysis = modelData.morphs.length > 0
    ? analyzeMorphMappings(modelData, preset.auToMorphs)
    : { missingMorphs: [], suggestions: [], unusedMorphs: [] };

  // Combine suggestions
  const allSuggestions = [...boneAnalysis.suggestions, ...morphAnalysis.suggestions];

  // Calculate health score
  const totalExpectedBones = Object.keys(preset.boneNodes).length;
  const totalExpectedMorphs = Object.values(preset.auToMorphs).flat().length;
  const totalMissing = boneAnalysis.missingBones.length + morphAnalysis.missingMorphs.length;
  const totalExpected = totalExpectedBones + totalExpectedMorphs;

  const healthScore = totalExpected > 0
    ? Math.round(((totalExpected - totalMissing) / totalExpected) * 100)
    : 100;

  // Generate summary
  const summaryParts: string[] = [];
  if (boneAnalysis.missingBones.length > 0) {
    summaryParts.push(`${boneAnalysis.missingBones.length} missing bones`);
  }
  if (morphAnalysis.missingMorphs.length > 0) {
    summaryParts.push(`${morphAnalysis.missingMorphs.length} missing morphs`);
  }
  if (allSuggestions.length > 0) {
    summaryParts.push(`${allSuggestions.length} suggestions available`);
  }

  const summary = summaryParts.length > 0
    ? summaryParts.join(', ')
    : 'All mappings valid';

  return {
    missingBones: boneAnalysis.missingBones,
    missingMorphs: morphAnalysis.missingMorphs,
    unusedBones: boneAnalysis.unusedBones,
    unusedMorphs: morphAnalysis.unusedMorphs,
    suggestions: allSuggestions,
    healthScore,
    summary,
  };
}

/**
 * Generate a corrected preset based on analysis suggestions
 */
export function generateCorrectedPreset(
  original: AUMappingConfig,
  analysis: MappingAnalysis
): AUMappingConfig {
  // Create a map of corrections
  const boneCorrections = new Map<string, string>();
  const morphCorrections = new Map<string, string>();

  for (const suggestion of analysis.suggestions) {
    if (suggestion.type === 'bone' && suggestion.confidence > 0.5) {
      boneCorrections.set(suggestion.expected, suggestion.suggested);
    } else if (suggestion.type === 'morph' && suggestion.confidence > 0.5) {
      morphCorrections.set(suggestion.expected, suggestion.suggested);
    }
  }

  // Apply bone corrections
  const correctedBoneNodes: Record<string, string> = {};
  for (const [key, value] of Object.entries(original.boneNodes)) {
    correctedBoneNodes[key] = boneCorrections.get(value) || value;
  }

  // Apply morph corrections
  const correctedAuToMorphs: Record<number, string[]> = {};
  for (const [auId, morphs] of Object.entries(original.auToMorphs)) {
    correctedAuToMorphs[parseInt(auId)] = morphs.map(
      m => morphCorrections.get(m) || m
    );
  }

  return {
    ...original,
    boneNodes: correctedBoneNodes,
    auToMorphs: correctedAuToMorphs,
  };
}

/**
 * Format analysis as human-readable text
 */
export function formatAnalysisReport(analysis: MappingAnalysis): string {
  const lines: string[] = [
    `Mapping Analysis Report`,
    `=======================`,
    `Health Score: ${analysis.healthScore}%`,
    `Summary: ${analysis.summary}`,
    ``,
  ];

  if (analysis.missingBones.length > 0) {
    lines.push(`Missing Bones (${analysis.missingBones.length}):`);
    for (const missing of analysis.missingBones) {
      lines.push(`  ${missing.semanticKey}: "${missing.expectedName}"`);
      if (missing.affectedAUs.length > 0) {
        lines.push(`    Affects AUs: ${missing.affectedAUs.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (analysis.missingMorphs.length > 0) {
    lines.push(`Missing Morphs (${analysis.missingMorphs.length}):`);
    for (const missing of analysis.missingMorphs) {
      lines.push(`  "${missing.morphName}"`);
      if (missing.affectedAUs.length > 0) {
        lines.push(`    Affects AUs: ${missing.affectedAUs.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (analysis.suggestions.length > 0) {
    lines.push(`Suggestions (${analysis.suggestions.length}):`);
    for (const suggestion of analysis.suggestions) {
      const confidence = (suggestion.confidence * 100).toFixed(0);
      lines.push(`  ${suggestion.type}: "${suggestion.expected}" → "${suggestion.suggested}" (${confidence}%)`);
      lines.push(`    Reason: ${suggestion.reason}`);
    }
    lines.push('');
  }

  if (analysis.unusedBones.length > 0) {
    lines.push(`Unused Model Bones (${analysis.unusedBones.length}):`);
    lines.push(`  ${analysis.unusedBones.slice(0, 20).join(', ')}${analysis.unusedBones.length > 20 ? '...' : ''}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Export corrected preset as TypeScript code
 */
export function exportPresetAsCode(
  preset: AUMappingConfig,
  presetName: string = 'CUSTOM_PRESET'
): string {
  const lines: string[] = [
    `/**`,
    ` * ${presetName} - Auto-generated AU Mapping Configuration`,
    ` * Generated by mapping-fixer skill`,
    ` */`,
    ``,
    `import type { AUMappingConfig } from 'loomlarge';`,
    ``,
    `export const ${presetName}: AUMappingConfig = {`,
    `  boneNodes: ${JSON.stringify(preset.boneNodes, null, 4).replace(/\n/g, '\n  ')},`,
    ``,
    `  auToBones: ${JSON.stringify(preset.auToBones, null, 4).replace(/\n/g, '\n  ')},`,
    ``,
    `  auToMorphs: ${JSON.stringify(preset.auToMorphs, null, 4).replace(/\n/g, '\n  ')},`,
    ``,
    `  morphToMesh: ${JSON.stringify(preset.morphToMesh, null, 4).replace(/\n/g, '\n  ')},`,
    ``,
    `  visemeKeys: ${JSON.stringify(preset.visemeKeys)},`,
  ];

  if (preset.auMixDefaults) {
    lines.push(``, `  auMixDefaults: ${JSON.stringify(preset.auMixDefaults, null, 4).replace(/\n/g, '\n  ')},`);
  }

  if (preset.eyeMeshNodes) {
    lines.push(``, `  eyeMeshNodes: ${JSON.stringify(preset.eyeMeshNodes, null, 4).replace(/\n/g, '\n  ')},`);
  }

  lines.push(`};`);
  lines.push(``);
  lines.push(`export default ${presetName};`);

  return lines.join('\n');
}
