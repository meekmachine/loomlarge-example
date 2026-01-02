/**
 * Mapping Wizard Service
 *
 * Orchestrates the mapping diagnosis and repair workflow.
 * This is the main entry point for both:
 * - Claude skill usage (manual CLI-based mapping fixes)
 * - App wizard UI (guided step-by-step with AI backend)
 */

import * as THREE from 'three';
import {
  extractModelData,
  formatBoneHierarchy,
  getModelSummary,
  exportModelDataAsJSON,
  type ModelData,
} from './modelIntrospectionService';
import {
  analyzeMapping,
  formatAnalysisReport,
  generateCorrectedPreset,
  exportPresetAsCode,
  type MappingAnalysis,
} from './mappingAnalysisService';
import {
  analyzeAnimationClip,
  formatAnimationReport,
  type AnimationAnalysis,
} from './animationAnalysisService';
import {
  generateBoneMappingPrompt,
  generateMorphMappingPrompt,
  generateAnimationAnalysisPrompt,
  generateMappingFixPrompt,
  generateNewPresetPrompt,
  generateQuickDiagnosticPrompt,
  exportAllPrompts,
} from './mappingPromptService';
import type { AUMappingConfig } from 'loom3';

/**
 * Wizard state representing the current step and gathered data
 */
export interface WizardState {
  step: WizardStep;
  modelData: ModelData | null;
  animationAnalyses: AnimationAnalysis[];
  currentPreset: AUMappingConfig | null;
  mappingAnalysis: MappingAnalysis | null;
  correctedPreset: AUMappingConfig | null;
  prompts: {
    boneMapping?: string;
    morphMapping?: string;
    animationAnalysis?: string;
    mappingFix?: string;
    newPreset?: string;
  };
  errors: string[];
}

export type WizardStep =
  | 'idle'
  | 'loading_model'
  | 'analyzing_model'
  | 'analyzing_animations'
  | 'comparing_preset'
  | 'generating_suggestions'
  | 'reviewing_corrections'
  | 'testing_mappings'
  | 'saving_preset'
  | 'complete'
  | 'error';

/**
 * Initialize a new wizard state
 */
export function createWizardState(): WizardState {
  return {
    step: 'idle',
    modelData: null,
    animationAnalyses: [],
    currentPreset: null,
    mappingAnalysis: null,
    correctedPreset: null,
    prompts: {},
    errors: [],
  };
}

/**
 * Phase 1: Analyze a loaded model
 *
 * @param model - The loaded Three.js Object3D
 * @param meshes - Meshes with morph targets
 * @param animations - Animation clips from the GLTF
 */
export function analyzeModel(
  model: THREE.Object3D,
  meshes: THREE.Mesh[] = [],
  animations: THREE.AnimationClip[] = []
): {
  modelData: ModelData;
  animationAnalyses: AnimationAnalysis[];
  summary: string;
  hierarchy: string;
  json: string;
} {
  const modelData = extractModelData(model, meshes, animations);
  const animationAnalyses = animations.map(clip => analyzeAnimationClip(clip));

  return {
    modelData,
    animationAnalyses,
    summary: getModelSummary(modelData),
    hierarchy: formatBoneHierarchy(modelData),
    json: exportModelDataAsJSON(modelData),
  };
}

/**
 * Phase 2: Compare model against a preset
 */
export function compareWithPreset(
  modelData: ModelData,
  preset: AUMappingConfig
): {
  analysis: MappingAnalysis;
  report: string;
  correctedPreset: AUMappingConfig;
} {
  const analysis = analyzeMapping(modelData, preset);
  const report = formatAnalysisReport(analysis);
  const correctedPreset = generateCorrectedPreset(preset, analysis);

  return {
    analysis,
    report,
    correctedPreset,
  };
}

/**
 * Phase 3: Generate AI prompts for deeper analysis
 */
export function generatePrompts(
  modelData: ModelData,
  analysis?: MappingAnalysis,
  animationAnalysis?: AnimationAnalysis,
  modelType: 'humanoid' | 'fish' | 'quadruped' | 'custom' = 'fish'
): {
  boneMapping: string;
  morphMapping: string;
  animationAnalysis?: string;
  mappingFix?: string;
  newPreset: string;
  quickDiagnostic: string;
  allPrompts: string;
} {
  return {
    boneMapping: generateBoneMappingPrompt(modelData),
    morphMapping: generateMorphMappingPrompt(modelData),
    animationAnalysis: animationAnalysis
      ? generateAnimationAnalysisPrompt(modelData, animationAnalysis)
      : undefined,
    mappingFix: analysis
      ? generateMappingFixPrompt(modelData, analysis, 'Current Preset')
      : undefined,
    newPreset: generateNewPresetPrompt(modelData, modelType, animationAnalysis),
    quickDiagnostic: generateQuickDiagnosticPrompt(modelData, analysis),
    allPrompts: exportAllPrompts(modelData, analysis, animationAnalysis),
  };
}

/**
 * Phase 4: Export corrected preset as code
 */
export function exportAsCode(
  preset: AUMappingConfig,
  presetName: string = 'CUSTOM_PRESET'
): string {
  return exportPresetAsCode(preset, presetName);
}

/**
 * Complete wizard flow for fish model (main use case)
 *
 * This function runs the complete analysis and returns all data
 * needed for either:
 * - Display in console (Claude skill usage)
 * - Display in UI (app wizard)
 */
export function runFishMappingWizard(
  model: THREE.Object3D,
  meshes: THREE.Mesh[],
  animations: THREE.AnimationClip[],
  currentPreset: AUMappingConfig
): {
  state: WizardState;
  outputs: {
    modelSummary: string;
    boneHierarchy: string;
    animationReports: string[];
    analysisReport: string;
    prompts: WizardState['prompts'];
    correctedPresetCode: string;
  };
} {
  const state = createWizardState();

  try {
    // Phase 1: Analyze model
    state.step = 'analyzing_model';
    const modelAnalysis = analyzeModel(model, meshes, animations);
    state.modelData = modelAnalysis.modelData;

    // Phase 2: Analyze animations
    state.step = 'analyzing_animations';
    state.animationAnalyses = modelAnalysis.animationAnalyses;

    // Phase 3: Compare with preset
    state.step = 'comparing_preset';
    state.currentPreset = currentPreset;
    const comparison = compareWithPreset(state.modelData, currentPreset);
    state.mappingAnalysis = comparison.analysis;
    state.correctedPreset = comparison.correctedPreset;

    // Phase 4: Generate prompts
    state.step = 'generating_suggestions';
    const prompts = generatePrompts(
      state.modelData,
      state.mappingAnalysis,
      state.animationAnalyses[0],
      'fish'
    );
    state.prompts = prompts;

    // Complete
    state.step = 'complete';

    return {
      state,
      outputs: {
        modelSummary: modelAnalysis.summary,
        boneHierarchy: modelAnalysis.hierarchy,
        animationReports: state.animationAnalyses.map(a => formatAnimationReport(a)),
        analysisReport: comparison.report,
        prompts: state.prompts,
        correctedPresetCode: exportAsCode(state.correctedPreset, 'CORRECTED_FISH_PRESET'),
      },
    };
  } catch (error) {
    state.step = 'error';
    state.errors.push(error instanceof Error ? error.message : String(error));
    return {
      state,
      outputs: {
        modelSummary: '',
        boneHierarchy: '',
        animationReports: [],
        analysisReport: '',
        prompts: {},
        correctedPresetCode: '',
      },
    };
  }
}

/**
 * Run wizard from raw model data (for non-Three.js contexts)
 */
export function runWizardFromData(
  boneNames: string[],
  boneHierarchy: Array<{ name: string; parent: string | null; depth: number }>,
  morphNames: string[],
  morphMeshes: string[],
  currentPreset: AUMappingConfig
): {
  analysis: MappingAnalysis;
  report: string;
  prompts: ReturnType<typeof generatePrompts>;
  correctedPresetCode: string;
} {
  // Reconstruct minimal ModelData
  const modelData: ModelData = {
    bones: boneHierarchy.map(b => ({
      name: b.name,
      parent: b.parent,
      children: boneHierarchy.filter(c => c.parent === b.name).map(c => c.name),
      worldPosition: { x: 0, y: 0, z: 0 },
      depth: b.depth,
    })),
    morphs: morphNames.map((name, i) => ({
      name,
      meshName: morphMeshes[0] || 'default',
      index: i,
    })),
    animations: [],
    boneMap: new Map(),
    boneNames,
    morphNames,
    morphMeshes,
  };

  // Build bone map
  for (const bone of modelData.bones) {
    modelData.boneMap.set(bone.name, bone);
  }

  const comparison = compareWithPreset(modelData, currentPreset);
  const prompts = generatePrompts(modelData, comparison.analysis, undefined, 'fish');
  const correctedPreset = generateCorrectedPreset(currentPreset, comparison.analysis);

  return {
    analysis: comparison.analysis,
    report: comparison.report,
    prompts,
    correctedPresetCode: exportAsCode(correctedPreset, 'CORRECTED_PRESET'),
  };
}

/**
 * Console output for Claude skill usage
 */
export function printWizardResults(outputs: ReturnType<typeof runFishMappingWizard>['outputs']): void {
  console.log('\n' + '='.repeat(80));
  console.log('MODEL ANALYSIS');
  console.log('='.repeat(80));
  console.log(outputs.modelSummary);

  console.log('\n' + '='.repeat(80));
  console.log('BONE HIERARCHY');
  console.log('='.repeat(80));
  console.log(outputs.boneHierarchy);

  if (outputs.animationReports.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('ANIMATION ANALYSIS');
    console.log('='.repeat(80));
    for (const report of outputs.animationReports) {
      console.log(report);
      console.log('-'.repeat(40));
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('MAPPING ANALYSIS');
  console.log('='.repeat(80));
  console.log(outputs.analysisReport);

  console.log('\n' + '='.repeat(80));
  console.log('AI PROMPTS AVAILABLE');
  console.log('='.repeat(80));
  console.log('Use these prompts with Claude for deeper analysis:');
  console.log('- Bone mapping prompt');
  console.log('- Morph mapping prompt');
  if (outputs.prompts.animationAnalysis) {
    console.log('- Animation analysis prompt');
  }
  if (outputs.prompts.mappingFix) {
    console.log('- Mapping fix prompt');
  }
  console.log('- New preset generation prompt');

  console.log('\n' + '='.repeat(80));
  console.log('CORRECTED PRESET CODE');
  console.log('='.repeat(80));
  console.log(outputs.correctedPresetCode);
}
