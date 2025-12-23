import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { HalftonePass } from 'three/examples/jsm/postprocessing/HalftonePass.js';
import { DotScreenPass } from 'three/examples/jsm/postprocessing/DotScreenPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
import { SepiaShader } from 'three/examples/jsm/shaders/SepiaShader.js';
import {
  AU_TO_MORPHS,
  BONE_AU_TO_BINDINGS,
  COMPOSITE_ROTATIONS,
  AU_MIX_DEFAULTS,
  CC4_BONE_NODES,
  CC4_EYE_MESH_NODES,
  CC4_MESHES,
  CONTINUUM_PAIRS_MAP,
  EYE_AXIS,
  VISEME_KEYS,
  type CompositeRotation,
} from './arkit/shapeDict';
import { createAnimationService } from '../latticework/animation/animationService';
import type { Engine } from './EngineThree.types';

// Post-processing effect types
export type PostEffect =
  | 'none'
  | 'bloom'
  | 'film'
  | 'glitch'
  | 'halftone'
  | 'dotScreen'
  | 'vignette'
  | 'sepia';

// Effect parameter types
export type BloomParams = { strength: number; radius: number; threshold: number };
export type FilmParams = { intensity: number };
export type GlitchParams = { wild: boolean };
export type HalftoneParams = { radius: number; scatter: number; greyscale: boolean };
export type DotScreenParams = { scale: number; angle: number };
export type VignetteParams = { offset: number; darkness: number };
export type SepiaParams = { amount: number };

export type EffectParams = {
  bloom: BloomParams;
  film: FilmParams;
  glitch: GlitchParams;
  halftone: HalftoneParams;
  dotScreen: DotScreenParams;
  vignette: VignetteParams;
  sepia: SepiaParams;
};

// Default effect parameters
export const DEFAULT_EFFECT_PARAMS: EffectParams = {
  bloom: { strength: 0.5, radius: 0.4, threshold: 0.85 },
  film: { intensity: 0.35 },
  glitch: { wild: false },
  halftone: { radius: 4, scatter: 0, greyscale: false },
  dotScreen: { scale: 0.8, angle: 0.5 },
  vignette: { offset: 1.0, darkness: 1.2 },
  sepia: { amount: 0.9 },
};

// ============================================================================
// DERIVED CONSTANTS - computed from shapeDict core data
// ============================================================================

/** All AU IDs that have bone bindings */
export const BONE_DRIVEN_AUS = new Set(Object.keys(BONE_AU_TO_BINDINGS).map(Number));

// Re-export from shapeDict for backwards compatibility
export { EYE_AXIS, CONTINUUM_PAIRS_MAP };

/** AUs that have both morphs and bones - can blend between them */
export const MIXED_AUS = new Set(
  Object.keys(AU_TO_MORPHS)
    .map(Number)
    .filter(id => AU_TO_MORPHS[id]?.length && BONE_AU_TO_BINDINGS[id]?.length)
);

/** Map AU ID to which composite rotation it belongs to, and which axis */
export const AU_TO_COMPOSITE_MAP = new Map<number, {
  nodes: CompositeRotation['node'][];
  axis: 'pitch' | 'yaw' | 'roll';
}>();

// Build the reverse mapping from COMPOSITE_ROTATIONS
COMPOSITE_ROTATIONS.forEach(comp => {
  (['pitch', 'yaw', 'roll'] as const).forEach(axisName => {
    const axis = comp[axisName];
    if (axis) {
      axis.aus.forEach(auId => {
        const existing = AU_TO_COMPOSITE_MAP.get(auId);
        if (existing) {
          existing.nodes.push(comp.node);
        } else {
          AU_TO_COMPOSITE_MAP.set(auId, { nodes: [comp.node], axis: axisName });
        }
      });
    }
  });
});

/** Continuum pairs derived from COMPOSITE_ROTATIONS for UI sliders */
export const CONTINUUM_PAIRS: Array<{ negative: number; positive: number; showBlend: boolean }> = (() => {
  const seen = new Set<string>();
  const pairs: Array<{ negative: number; positive: number; showBlend: boolean }> = [];
  // Add bone-driven continuum pairs from COMPOSITE_ROTATIONS
  for (const comp of COMPOSITE_ROTATIONS) {
    for (const axisName of ['pitch', 'yaw', 'roll'] as const) {
      const axis = comp[axisName];
      if (axis?.negative !== undefined && axis?.positive !== undefined) {
        const key = `${axis.negative}-${axis.positive}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ negative: axis.negative, positive: axis.positive, showBlend: true });
        }
      }
    }
  }
  // Add morph-only continuum pairs from CONTINUUM_PAIRS_MAP (e.g., tongue morphs)
  for (const [auIdStr, info] of Object.entries(CONTINUUM_PAIRS_MAP)) {
    const auId = Number(auIdStr);
    if (info.isNegative) {
      const key = `${auId}-${info.pairId}`;
      if (!seen.has(key)) {
        seen.add(key);
        // showBlend false for morph-only pairs (no bone to blend with)
        pairs.push({ negative: auId, positive: info.pairId, showBlend: false });
      }
    }
  }
  return pairs;
})();

/** Check if an AU has separate left/right morphs */
export function hasLeftRightMorphs(auId: number): boolean {
  const morphs = AU_TO_MORPHS[auId] || [];
  const hasLeft = morphs.some(k => /_L$|Left$/.test(k));
  const hasRight = morphs.some(k => /_R$|Right$/.test(k));
  return hasLeft && hasRight;
}

const X_AXIS = new THREE.Vector3(1,0,0);
const Y_AXIS = new THREE.Vector3(0,1,0);
const Z_AXIS = new THREE.Vector3(0,0,1);
const deg2rad = (d: number) => (d * Math.PI) / 180;

type BoneKeys = 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE';

type NodeBase = {
  obj: THREE.Object3D;
  basePos: THREE.Vector3;
  baseQuat: THREE.Quaternion;
  baseEuler: THREE.Euler;
};

type ResolvedBones = Partial<Record<BoneKeys, NodeBase>>;

// Unified transition system - simple lerp-based
type Transition = {
  key: string;
  from: number;
  to: number;
  duration: number;      // seconds
  elapsed: number;       // seconds
  apply: (value: number) => void;
  easing: (t: number) => number;
  resolve?: () => void;  // Called when transition completes
  paused: boolean;       // Individual pause state
};

/**
 * TransitionHandle - returned from transitionAU/transitionMorph/transitionContinuum
 * Provides promise-based completion notification plus fine-grained control.
 *
 * The animation agency uses these handles to await keyframe transitions,
 * then schedule the next keyframe when the promise resolves.
 */
export type TransitionHandle = {
  /** Resolves when the transition completes (or is cancelled) */
  promise: Promise<void>;
  /** Pause this transition (holds at current value) */
  pause: () => void;
  /** Resume this transition after pause */
  resume: () => void;
  /** Cancel this transition immediately (resolves promise) */
  cancel: () => void;
};

// Optimized transition types - pre-resolved targets for direct access
type MorphTarget = {
  mesh: THREE.Mesh;
  index: number;
  key: string;
};

type BoneTarget = {
  bone: NodeBase;
  node: string;
  channel: 'rx' | 'ry' | 'rz' | 'tx' | 'ty' | 'tz';
  scale: number;
  maxDegrees?: number;
  maxUnits?: number;
};

type ResolvedAUTargets = {
  auId: number;
  morphTargets: MorphTarget[];
  boneTargets: BoneTarget[];
  mixWeight: number;
  compositeInfo: {
    nodes: CompositeRotation['node'][];
    axis: 'pitch' | 'yaw' | 'roll';
  } | null;
};


export class EngineThree {
  private auValues: Record<number, number> = {};

  // Unified transition system - simple lerp-based
  private transitions = new Map<string, Transition>();

  private rigReady = false;
  private missingBoneWarnings = new Set<string>();

  // Skybox storage
  private scene: THREE.Scene | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private skyboxTexture: THREE.Texture | null = null;


  // Post-processing
  private composer: EffectComposer | null = null;
  private currentEffect: PostEffect = 'none';
  private effectPass: Pass | null = null;
  private effectParams: EffectParams = { ...DEFAULT_EFFECT_PARAMS };

  // Unified rotation state tracking for bones
  // Each bone maintains its complete 3D rotation (pitch/yaw/roll) to prevent overwriting
  // TODO: Eventually build this dynamically from shapeDict data and include ALL bones,
  // not just face/head bones. For now, hardcoded to the 5 composite face bones.
  private rotations: Record<string, { pitch: number; yaw: number; roll: number }> = {
    JAW: { pitch: 0, yaw: 0, roll: 0 },
    HEAD: { pitch: 0, yaw: 0, roll: 0 },
    EYE_L: { pitch: 0, yaw: 0, roll: 0 },
    EYE_R: { pitch: 0, yaw: 0, roll: 0 },
    TONGUE: { pitch: 0, yaw: 0, roll: 0 }
  };

  // Nodes with pending rotation changes - applied once per frame in update()
  private pendingCompositeNodes = new Set<string>();
  private isPaused: boolean = false;
  private easeInOutQuad = (t:number) => (t<0.5? 2*t*t : -1+(4-2*t)*t);

  // ============================================================================
  // INTERNAL RAF LOOP - EngineThree owns the frame loop
  // ============================================================================
  private clock = new THREE.Clock();
  private rafId: number | null = null;
  private running = false;
  private frameListeners = new Set<(dt: number) => void>();

  /** Animation service - created lazily when start() is called */
  private _anim: ReturnType<typeof createAnimationService> | null = null;

  /** Get the animation service (creates it if needed) */
  get anim(): ReturnType<typeof createAnimationService> {
    if (!this._anim) {
      this._anim = this.createAnimService();
    }
    return this._anim;
  }

  /** Create the animation service with this engine as the host */
  private createAnimService(): ReturnType<typeof createAnimationService> {
    const host: Engine = {
      applyAU: (id, v) => this.setAU(id as number, v),
      setMorph: (key, v) => this.setMorph(key, v),
      transitionAU: (id, v, dur, balance) => this.transitionAU(id, v, dur, balance),
      transitionMorph: (key, v, dur) => this.transitionMorph(key, v, dur),
      transitionContinuum: (negAU, posAU, v, dur) => this.transitionContinuum(negAU, posAU, v, dur),
      // Viseme methods - separate from AU system with integrated jaw control
      setViseme: (idx, v, jawScale) => this.setViseme(idx, v, jawScale),
      transitionViseme: (idx, v, dur, jawScale) => this.transitionViseme(idx, v, dur, jawScale),
      onSnippetEnd: (name) => {
        try {
          window.dispatchEvent(new CustomEvent('visos:snippetEnd', { detail: { name } }));
        } catch {}
        try {
          (window as any).__lastSnippetEnded = name;
        } catch {}
      }
    };
    const svc = createAnimationService(host);
    (window as any).anim = svc; // dev handle
    return svc;
  }

  /** Subscribe to frame updates. Returns an unsubscribe function. */
  addFrameListener(callback: (dt: number) => void): () => void {
    this.frameListeners.add(callback);
    return () => this.frameListeners.delete(callback);
  }

  /** Start the internal RAF loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();

    // Ensure anim service exists (initializes scheduler and machine)
    this.anim;

    const tick = () => {
      if (!this.running) return;
      const dt = this.clock.getDelta();

      // NOTE: step(dt) polling is DISABLED - promise-based playback runners now handle
      // keyframe transitions. The runners fire transitions at keyframe boundaries and
      // await TransitionHandle.promise before scheduling the next keyframe.
      // The step(dt) method still exists in scheduler for backwards compatibility
      // (e.g., flushOnce for scrubbing) but is not called from the RAF loop.

      // Notify frame listeners
      this.frameListeners.forEach((fn) => {
        try { fn(dt); } catch {}
      });

      // Update transitions, mixers, mouse tracking
      this.update(dt);

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  /** Stop the internal RAF loop */
  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clock.stop();
  }

  /** Check if the engine loop is running */
  isRunning(): boolean {
    return this.running;
  }

  /** Dispose the engine and animation service */
  dispose() {
    this.stop();
    try {
      this._anim?.dispose?.();
    } catch {}
    this._anim = null;
  }

  // ============================================================================
  // OPTIMIZED TRANSITION SYSTEM
  // Pre-resolves morph indices and bone references at transition creation time
  // ============================================================================

  // Cache: morph key → array of { mesh, index } for direct access
  private morphIndexCache = new Map<string, Array<{ mesh: THREE.Mesh; index: number }>>();

  /** Build the morph index cache after meshes are loaded */
  private buildMorphIndexCache() {
    this.morphIndexCache.clear();

    for (const mesh of this.meshes) {
      const dict = (mesh as any).morphTargetDictionary as Record<string, number> | undefined;
      if (!dict) continue;

      for (const [key, index] of Object.entries(dict)) {
        let entries = this.morphIndexCache.get(key);
        if (!entries) {
          entries = [];
          this.morphIndexCache.set(key, entries);
        }
        entries.push({ mesh, index });
      }
    }

    // console.log(`[EngineThree] Built morph index cache: ${this.morphIndexCache.size} unique morph keys`);
  }

  /**
   * Resolve all targets for an AU transition upfront.
   * Returns morph targets with direct mesh/index access and bone rotation configs.
   */
  private resolveAUTargets(auId: number): ResolvedAUTargets | null {
    const morphKeys = AU_TO_MORPHS[auId] || [];
    const boneBindings = BONE_AU_TO_BINDINGS[auId] || [];
    const mixWeight = MIXED_AUS.has(auId) ? this.getAUMixWeight(auId) : 1.0;

    // Resolve morph targets to direct mesh/index references
    const morphTargets: MorphTarget[] = [];
    for (const key of morphKeys) {
      const entries = this.morphIndexCache.get(key);
      if (entries) {
        for (const { mesh, index } of entries) {
          // Skip occlusion and tearline meshes
          const name = (mesh.name || '').toLowerCase();
          if (name.includes('occlusion') || name.includes('tearline')) continue;
          morphTargets.push({ mesh, index, key });
        }
      }
    }

    // Resolve bone targets to direct bone references
    const boneTargets: BoneTarget[] = [];
    for (const binding of boneBindings) {
      const boneEntry = this.bones[binding.node as BoneKeys];
      if (boneEntry) {
        boneTargets.push({
          bone: boneEntry,
          node: binding.node,
          channel: binding.channel,
          scale: binding.scale,
          maxDegrees: binding.maxDegrees,
          maxUnits: binding.maxUnits
        });
      }
    }

    // Check if this AU is part of a composite rotation
    const compositeInfo = AU_TO_COMPOSITE_MAP.get(auId);

    return {
      auId,
      morphTargets,
      boneTargets,
      mixWeight,
      compositeInfo: compositeInfo || null
    };
  }

  /** Apply a single bone target directly (for non-composite bones) */
  private applyBoneTargetDirect(target: BoneTarget, value: number) {
    const { bone, channel, scale, maxDegrees, maxUnits } = target;
    const { obj, basePos, baseQuat } = bone;

    const clampedVal = Math.min(1, Math.max(-1, value));
    const radians = maxDegrees ? deg2rad(maxDegrees) * clampedVal * scale : 0;
    const units = maxUnits ? maxUnits * clampedVal * scale : 0;

    obj.position.copy(basePos);

    if (channel === 'rx' || channel === 'ry' || channel === 'rz') {
      const axis = channel === 'rx' ? X_AXIS : channel === 'ry' ? Y_AXIS : Z_AXIS;
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
      obj.quaternion.copy(baseQuat).multiply(deltaQ);
    } else {
      const dir = channel === 'tx' ? X_AXIS.clone() : channel === 'ty' ? Y_AXIS.clone() : Z_AXIS.clone();
      dir.applyQuaternion(baseQuat);
      obj.position.copy(basePos).add(dir.multiplyScalar(units));
    }

    obj.updateMatrixWorld(false);
  }

  // No constructor needed - all state is initialized inline

  private getMorphValue(key: string): number {
    for (const m of this.meshes) {
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) return infl[idx] ?? 0;
    }
    return 0;
  }
  /**
   * Smoothly tween an AU to a target value.
   * For continuum pairs (e.g., AU 41/42 tongue tilt), supports -1 to +1 range:
   * - Negative values activate the paired AU
   * - Positive values activate this AU
   */
  /**
   * Smoothly tween an AU to a target value.
   * For continuum pairs (e.g., AU 41/42 tongue tilt), supports -1 to +1 range.
   *
   * @param id - AU ID (number) or string with side suffix ('12L', '12R')
   * @param to - Target intensity value
   * @param durationMs - Transition duration in milliseconds
   * @param balance - Optional left/right balance: -1 = left only, 0 = both equally, +1 = right only
   */
  transitionAU = (id: number | string, to: number, durationMs = 200, balance?: number): TransitionHandle => {
    const numId = typeof id === 'string' ? Number(id.replace(/[^\d]/g, '')) : id;
    const pairInfo = CONTINUUM_PAIRS_MAP[numId];

    // For continuum pairs, use the continuum transition system
    if (pairInfo) {
      const negAU = pairInfo.isNegative ? numId : pairInfo.pairId;
      const posAU = pairInfo.isNegative ? pairInfo.pairId : numId;
      const continuumTarget = pairInfo.isNegative ? -to : to;
      return this.transitionContinuum(negAU, posAU, continuumTarget, durationMs);
    }

    // Store balance if provided
    if (balance !== undefined) {
      this.auBalances[numId] = Math.max(-1, Math.min(1, balance));
    }

    // Get effective balance (from param or stored)
    const effectiveBalance = balance ?? this.auBalances[numId] ?? 0;

    // Resolve targets upfront for direct application
    const resolved = this.resolveAUTargets(numId);
    if (!resolved) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }

    // Separate left and right morphs for balance application
    const leftMorphs: MorphTarget[] = [];
    const rightMorphs: MorphTarget[] = [];
    const neutralMorphs: MorphTarget[] = [];

    for (const mt of resolved.morphTargets) {
      if (/(_L|Left)$/.test(mt.key)) {
        leftMorphs.push(mt);
      } else if (/(_R|Right)$/.test(mt.key)) {
        rightMorphs.push(mt);
      } else {
        neutralMorphs.push(mt);
      }
    }

    // Calculate balance scales (computed once, used each tick)
    const leftScale = effectiveBalance >= 0 ? 1 - effectiveBalance : 1;
    const rightScale = effectiveBalance <= 0 ? 1 + effectiveBalance : 1;

    const transitionKey = `au_${numId}`;
    const from = this.auValues[numId] ?? 0;
    const target = clamp01(to);

    // Optimized apply function with balance
    const applyWithBalance = (value: number) => {
      this.auValues[numId] = value;
      const morphValue = value * resolved.mixWeight;

      // Apply morphs with balance scaling
      for (const { mesh, index } of leftMorphs) {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = morphValue * leftScale;
        }
      }
      for (const { mesh, index } of rightMorphs) {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = morphValue * rightScale;
        }
      }
      for (const { mesh, index } of neutralMorphs) {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = morphValue;
        }
      }

      // Handle bone rotations (same as transitionAUOptimized)
      if (resolved.compositeInfo) {
        for (const nodeKey of resolved.compositeInfo.nodes) {
          const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
          if (!config) continue;
          const axisConfig = config[resolved.compositeInfo.axis];
          if (!axisConfig) continue;

          let axisValue = 0;
          if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
            const negValue = this.auValues[axisConfig.negative] ?? 0;
            const posValue = this.auValues[axisConfig.positive] ?? 0;
            axisValue = posValue - negValue;
          } else if (axisConfig.aus.length > 1) {
            axisValue = Math.max(...axisConfig.aus.map(auId => this.auValues[auId] ?? 0));
          } else {
            axisValue = value;
          }

          this.rotations[nodeKey][resolved.compositeInfo.axis] = Math.max(-1, Math.min(1, axisValue));
          this.pendingCompositeNodes.add(nodeKey);
        }
      } else {
        for (const boneTarget of resolved.boneTargets) {
          this.applyBoneTargetDirect(boneTarget, value);
        }
      }
    };

    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      applyWithBalance
    );
  };

  /**
   * Smoothly transition the left/right balance for a bilateral AU.
   *
   * @param id - AU ID
   * @param toBalance - Target balance: -1 = left only, 0 = both equally, +1 = right only
   * @param durationMs - Transition duration in milliseconds
   */
  transitionAUBalance = (id: number, toBalance: number, durationMs = 200): TransitionHandle => {
    const transitionKey = `au_balance_${id}`;
    const from = this.auBalances[id] ?? 0;
    const target = Math.max(-1, Math.min(1, toBalance));
    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      (value) => this.setAUBalance(id, value)
    );
  };

  /** Smoothly tween a morph to a target value */
  transitionMorph = (key: string, to: number, durationMs = 120): TransitionHandle => {
    const transitionKey = `morph_${key}`;
    const from = this.getMorphValue(key);
    const target = clamp01(to);
    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      (value) => this.setMorph(key, value)
    );
  };

  // ============================================================================
  // VISEME SYSTEM - Separate from AU System
  //
  // Visemes apply BOTH morph targets AND jaw bone rotation in a coordinated way.
  // This is intentionally separate from the AU system to avoid conflicts:
  // - setViseme() / transitionViseme() handle jaw internally via applyJawBoneRotation()
  // - Do NOT use setAU(26) alongside visemes - that causes double jaw movement
  // - The AnimationScheduler routes viseme curve IDs (0-14) to transitionViseme()
  // ============================================================================

  /**
   * Jaw opening amounts for each viseme index (0-14)
   * Based on phonetic properties - how much the jaw opens for each mouth shape
   */
  private visemeJawAmounts: number[] = [
    0.2,  // 0: EE - minimal jaw, high front vowel
    0.4,  // 1: Er - medium, r-colored
    0.3,  // 2: IH - slight, high front
    0.8,  // 3: Ah - wide open
    0.7,  // 4: Oh - rounded, medium-wide
    0.4,  // 5: W_OO - rounded, moderate
    0.1,  // 6: S_Z - nearly closed, sibilants
    0.2,  // 7: Ch_J - slight, postalveolar
    0.15, // 8: F_V - nearly closed, labiodental
    0.2,  // 9: TH - slight, dental
    0.15, // 10: T_L_D_N - slight, alveolar
    0.0,  // 11: B_M_P - fully closed, bilabial
    0.3,  // 12: K_G_H_NG - medium, velar
    0.6,  // 13: AE - medium open, neutral vowel
    0.3,  // 14: R - retroflex, small
  ];

  /** Track current viseme values for transitions */
  private visemeValues: number[] = new Array(15).fill(0);

  /**
   * Set viseme value immediately (no transition)
   * Applies both viseme morph target AND jaw bone rotation
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param value - Target value in [0, 1]
   * @param jawScale - Optional jaw activation multiplier (default: 1.0)
   */
  setViseme = (visemeIndex: number, value: number, jawScale: number = 1.0) => {
    if (visemeIndex < 0 || visemeIndex >= VISEME_KEYS.length) return;

    const val = clamp01(value);
    this.visemeValues[visemeIndex] = val;

    // Apply viseme morph
    const morphKey = VISEME_KEYS[visemeIndex];
    this.setMorph(morphKey, val);

    // Apply jaw bone rotation based on viseme type
    const jawAmount = this.visemeJawAmounts[visemeIndex] * val * jawScale;
    this.applyJawBoneRotation(jawAmount);
  };

  /**
   * Apply jaw bone rotation directly (separate from AU system)
   * Used by viseme system for phonetic jaw movement
   */
  private applyJawBoneRotation = (jawAmount: number) => {
    const jawBone = this.bones.JAW;
    if (!jawBone) return;

    const clampedVal = clamp01(jawAmount);
    // JAW bone rotates on rz axis - increased to 25 degrees for more expressive speech
    // (was 14.6, AU 27 Mouth Stretch uses 18.25, allowing more range for visemes)
    const maxDegrees = 25;
    const radians = deg2rad(maxDegrees) * clampedVal;

    // Apply rotation relative to base pose
    const deltaQ = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, radians);
    jawBone.obj.quaternion.copy(jawBone.baseQuat).multiply(deltaQ);
    jawBone.obj.updateMatrixWorld(false);
  };

  /**
   * Get current combined jaw amount from all active visemes
   * Sums weighted jaw contributions from each viseme
   */
  private getVisemeJawAmount = (jawScale: number): number => {
    let totalJaw = 0;
    for (let i = 0; i < this.visemeValues.length; i++) {
      totalJaw += this.visemeValues[i] * this.visemeJawAmounts[i];
    }
    return Math.min(1, totalJaw * jawScale);
  };

  /**
   * Smoothly transition a viseme value
   * Applies both viseme morph target AND jaw bone rotation
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param to - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 80ms)
   * @param jawScale - Optional jaw activation multiplier (default: 1.0)
   */
  transitionViseme = (visemeIndex: number, to: number, durationMs = 80, jawScale: number = 1.0): TransitionHandle => {
    if (visemeIndex < 0 || visemeIndex >= VISEME_KEYS.length) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }

    const transitionKey = `viseme_${visemeIndex}`;
    const from = this.visemeValues[visemeIndex] ?? 0;
    const target = clamp01(to);

    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs / 1000,
      (value) => {
        this.visemeValues[visemeIndex] = value;

        // Apply viseme morph
        const morphKey = VISEME_KEYS[visemeIndex];
        this.setMorph(morphKey, value);

        // Apply combined jaw from all active visemes
        const combinedJaw = this.getVisemeJawAmount(jawScale);
        this.applyJawBoneRotation(combinedJaw);
      }
    );
  };

  /**
   * Set a continuum AU pair immediately (no animation).
   *
   * Sign convention:
   * - Negative value (-1 to 0): activates negAU (e.g., head left, eyes left)
   * - Positive value (0 to +1): activates posAU (e.g., head right, eyes right)
   *
   * Internally calls setAU() which handles:
   * - Morph application (scaled by mixWeight)
   * - Bone rotation (always at full strength based on value)
   *
   * @param negAU - AU ID for negative direction (e.g., 31 for head left, 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 32 for head right, 62 for eyes right)
   * @param continuumValue - Value from -1 (full negative) to +1 (full positive)
   */
  setContinuum = (negAU: number, posAU: number, continuumValue: number) => {
    const value = Math.max(-1, Math.min(1, continuumValue));

    // Negative value = activate negAU, zero posAU
    // Positive value = activate posAU, zero negAU
    const negVal = value < 0 ? Math.abs(value) : 0;
    const posVal = value > 0 ? value : 0;

    this.setAU(negAU, negVal);
    this.setAU(posAU, posVal);
  };

  /**
   * Smoothly transition a continuum AU pair (e.g., eyes left/right, head up/down).
   * Takes a continuum value from -1 to +1 and internally manages both AU values.
   *
   * Sign convention:
   * - Negative value (-1 to 0): activates negAU (e.g., head left, eyes left)
   * - Positive value (0 to +1): activates posAU (e.g., head right, eyes right)
   *
   * @param negAU - AU ID for negative direction (e.g., 31 for head left, 61 for eyes left)
   * @param posAU - AU ID for positive direction (e.g., 32 for head right, 62 for eyes right)
   * @param continuumValue - Target value from -1 (full negative) to +1 (full positive)
   * @param durationMs - Transition duration in milliseconds
   */
  transitionContinuum = (negAU: number, posAU: number, continuumValue: number, durationMs = 200): TransitionHandle => {
    const target = Math.max(-1, Math.min(1, continuumValue));
    const driverKey = `continuum_${negAU}_${posAU}`;

    // Get current continuum value: negative if negAU active, positive if posAU active
    const currentNeg = this.auValues[negAU] ?? 0;
    const currentPos = this.auValues[posAU] ?? 0;
    const currentContinuum = currentPos - currentNeg;  // pos - neg so positive = right

    return this.addTransition(
      driverKey,
      currentContinuum,
      target,
      durationMs / 1000,
      (value) => this.setContinuum(negAU, posAU, value)
    );
  };

  /** Advance internal transition tweens by deltaSeconds (called from ThreeProvider RAF loop). */
  update(deltaSeconds: number) {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;

    // Unified transitions (AU, morph, composite movements)
    this.tickTransitions(dtSeconds);

    // Flush pending composite rotations (deferred from setAU calls)
    // Also triggers hair updates when HEAD changes
    this.flushPendingComposites();

    // Wind/idle hair animations (only when enabled)
    this.updateHairWindIdle(dtSeconds);
  }

  /** Apply all pending composite rotations and clear the set */
  private flushPendingComposites() {
    if (this.pendingCompositeNodes.size === 0) return;

    // Check if HEAD changed - triggers hair physics update
    const headChanged = this.pendingCompositeNodes.has('HEAD');

    for (const nodeKey of this.pendingCompositeNodes) {
      this.applyCompositeRotation(nodeKey as 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE');
    }
    this.pendingCompositeNodes.clear();

    // Update hair when head rotation changes
    if (headChanged && this.hairPhysicsEnabled) {
      this.updateHairForHeadChange();
    }
  }

  /**
   * Tick all active transitions by dt seconds.
   * Applies eased interpolation and removes completed transitions.
   * Respects individual transition pause state.
   */
  private tickTransitions(dt: number) {
    const completed: string[] = [];

    this.transitions.forEach((t, key) => {
      // Skip paused transitions
      if (t.paused) return;

      t.elapsed += dt;
      const progress = Math.min(t.elapsed / t.duration, 1.0);
      const easedProgress = t.easing(progress);

      // Interpolate and apply
      const value = t.from + (t.to - t.from) * easedProgress;
      t.apply(value);

      // Check completion
      if (progress >= 1.0) {
        completed.push(key);
        t.resolve?.();
      }
    });

    // Remove completed transitions
    completed.forEach(key => this.transitions.delete(key));
  }

  /**
   * Add or replace a transition for the given key.
   * If a transition with the same key exists, it is cancelled and replaced.
   * @returns TransitionHandle with { promise, pause, resume, cancel }
   */
  private addTransition(
    key: string,
    from: number,
    to: number,
    durationSec: number,
    apply: (value: number) => void,
    easing: (t: number) => number = this.easeInOutQuad
  ): TransitionHandle {
    // Cancel existing transition for this key
    const existing = this.transitions.get(key);
    if (existing?.resolve) {
      existing.resolve(); // Resolve immediately (cancelled)
    }

    // Instant transition if duration is 0 or values are equal
    if (durationSec <= 0 || Math.abs(to - from) < 1e-6) {
      apply(to);
      return {
        promise: Promise.resolve(),
        pause: () => {},
        resume: () => {},
        cancel: () => {},
      };
    }

    let transitionObj: Transition | null = null;

    const promise = new Promise<void>((resolve) => {
      transitionObj = {
        key,
        from,
        to,
        duration: durationSec,
        elapsed: 0,
        apply,
        easing,
        resolve,
        paused: false,
      };
      this.transitions.set(key, transitionObj);
    });

    return {
      promise,
      pause: () => {
        const t = this.transitions.get(key);
        if (t) t.paused = true;
      },
      resume: () => {
        const t = this.transitions.get(key);
        if (t) t.paused = false;
      },
      cancel: () => {
        const t = this.transitions.get(key);
        if (t) {
          t.resolve?.();
          this.transitions.delete(key);
        }
      },
    };
  }

  /** Clear all running transitions (used when playback rate changes to prevent timing conflicts). */
  clearTransitions() {
    this.transitions.forEach(t => t.resolve?.());
    this.transitions.clear();
  }

  /** Pause all active transitions (they will resume when update() is called again). */
  pause() {
    this.isPaused = true;
  }

  /** Resume all paused transitions. */
  resume() {
    this.isPaused = false;
  }

  /** Get current pause state. */
  getPaused(): boolean {
    return this.isPaused;
  }

  /** Get count of active transitions (useful for debugging). */
  getActiveTransitionCount(): number {
    return this.transitions.size;
  }

  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  // Cache: object name → array of matching objects (avoids repeated traversals)
  private objectNameCache = new Map<string, THREE.Object3D[]>();
  // Direct reference to registered hair objects (avoids model lookup race condition)
  private registeredHairObjects = new Map<string, THREE.Object3D>();

  // Hair physics state - spring-damper simulation for secondary motion
  private hairPhysicsEnabled = false;
  private hairPhysicsConfig = {
    stiffness: 7.5,
    damping: 0.18,
    inertia: 3.5,
    gravity: 12,
    responseScale: 2.5,
    idleSwayAmount: 0.12,
    idleSwaySpeed: 1.0,
    windStrength: 0,
    windDirectionX: 1.0,
    windDirectionZ: 0,
    windTurbulence: 0.3,
    windFrequency: 1.4,
  };
  // State for wind/idle animations (these need continuous updates)
  private hairWindIdleState = {
    windTime: 0,
    idlePhase: 0,
    smoothedWindX: 0,
    smoothedWindZ: 0,
  };

  /** Get all mesh info for UI display (traverses full model, not just morph meshes) */
  getMeshList = (): Array<{ name: string; visible: boolean; category: string; morphCount: number }> => {
    if (!this.model) return [];
    const result: Array<{ name: string; visible: boolean; category: string; morphCount: number }> = [];
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const info = CC4_MESHES[mesh.name];
        result.push({
          name: mesh.name,
          visible: mesh.visible,
          category: info?.category || 'other',
          morphCount: info?.morphCount ?? (mesh.morphTargetInfluences?.length || 0),
        });
      }
    });
    return result;
  };

  /** Set mesh visibility by name (searches full model) */
  setMeshVisible = (meshName: string, visible: boolean) => {
    if (!this.model) return;
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.name === meshName) {
        obj.visible = visible;
      }
    });
  };

  /** Set visibility for all meshes of a category */
  setCategoryVisible = (category: string, visible: boolean) => {
    if (!this.model) return;
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const info = CC4_MESHES[obj.name];
        if (info?.category === category) {
          obj.visible = visible;
        }
      }
    });
  };
  private bones: ResolvedBones = {};

  // --- Mix weight system ---
  // Bones always apply at 100%. Mix weight controls the morph overlay:
  // 0 = bone only (no morph), 1 = bone + full morph overlay
  private mixWeights: Record<number, number> = { ...AU_MIX_DEFAULTS };

  // --- Balance system for bilateral AUs ---
  // Controls left/right asymmetry for AUs with separate L/R morphs (blink, smile, etc.)
  // -1 = left only, 0 = both sides equally, +1 = right only
  private auBalances: Record<number, number> = {};

  setAUMixWeight = (id: number, weight: number) => {
    this.mixWeights[id] = clamp01(weight);

    // Reapply just this AU's morph with the new mix weight
    const v = this.auValues[id] ?? 0;
    if (v > 0) this.applyBothSides(id, v);

    // Mark affected bone as pending (bones don't change, but ensures consistency)
    const compositeInfo = AU_TO_COMPOSITE_MAP.get(id);
    if (compositeInfo) {
      for (const nodeKey of compositeInfo.nodes) {
        this.pendingCompositeNodes.add(nodeKey);
      }
    }
  };

  getAUMixWeight = (id: number): number => {
    // Return stored mix weight, or default from AU_MIX_DEFAULTS, or 1.0 (full bone)
    return this.mixWeights[id] ?? AU_MIX_DEFAULTS[id] ?? 1.0;
  };

  /**
   * Set the left/right balance for a bilateral AU.
   * @param id - AU ID
   * @param balance - Value from -1 (left only) to +1 (right only), 0 = both sides equally
   */
  setAUBalance = (id: number, balance: number) => {
    this.auBalances[id] = Math.max(-1, Math.min(1, balance));

    // Re-apply the AU with current value and new balance
    const currentValue = this.auValues[id] ?? 0;
    if (currentValue > 0) {
      this.applyBothSides(id, currentValue, this.auBalances[id]);
    }
  };

  /**
   * Get the current left/right balance for an AU.
   * @returns Balance from -1 (left only) to +1 (right only), default 0 (both sides)
   */
  getAUBalance = (id: number): number => {
    return this.auBalances[id] ?? 0;
  };

  /**
   * Reset all facial animation to neutral state.
   * This resets both blend shapes (morphs) AND bone rotations.
   */
  resetToNeutral = () => {
    // 1. Clear all AU values
    this.auValues = {};

    // 2. Reset all composite bone rotation state
    this.rotations = {
      JAW: { pitch: 0, yaw: 0, roll: 0 },
      HEAD: { pitch: 0, yaw: 0, roll: 0 },
      EYE_L: { pitch: 0, yaw: 0, roll: 0 },
      EYE_R: { pitch: 0, yaw: 0, roll: 0 },
      TONGUE: { pitch: 0, yaw: 0, roll: 0 }
    };

    // 3. Clear all active transitions
    this.clearTransitions();

    // 4. Mark all composite bones as pending (they'll reset to base in flushPendingComposites)
    (['HEAD', 'EYE_L', 'EYE_R', 'JAW', 'TONGUE'] as const).forEach(node => {
      this.pendingCompositeNodes.add(node);
    });

    // 5. Zero out all morphs directly
    for (const m of this.meshes) {
      const infl: any = (m as any).morphTargetInfluences;
      if (!infl) continue;
      for (let i = 0; i < infl.length; i++) {
        infl[i] = 0;
      }
    }

    // 6. Reset all bones to their base transforms
    Object.values(this.bones).forEach((entry) => {
      if (!entry) return;
      entry.obj.position.copy(entry.basePos);
      entry.obj.quaternion.copy(entry.baseQuat);
    });
  };

  hasBoneBinding = (id: number) => BONE_DRIVEN_AUS.has(id);

  onReady = ({ meshes, model, scene, renderer, skyboxTexture, composer }: {
    meshes: THREE.Mesh[];
    model?: THREE.Object3D;
    scene?: THREE.Scene;
    renderer?: THREE.WebGLRenderer;
    skyboxTexture?: THREE.Texture;
    composer?: EffectComposer;
  }) => {
    this.meshes = meshes;
    this.buildMorphIndexCache();
    this.objectNameCache.clear();

    if (scene) this.scene = scene;
    if (renderer) this.renderer = renderer;
    if (skyboxTexture) this.skyboxTexture = skyboxTexture;
    if (composer) this.composer = composer;

    if (model) {
      this.model = model;
      this.bones = this.resolveBones(model);
      this.logResolvedOnce(this.bones);
      this.rigReady = true;
      this.missingBoneWarnings.clear();
      this.setupMeshRenderOrder(model);

      // Defer hair registry to next frame
      this.registeredHairObjects.clear();
      requestAnimationFrame(() => {
        if (!this.model) return;
        this.model.traverse((obj) => {
          const info = CC4_MESHES[obj.name];
          if (info?.category === 'hair' || info?.category === 'eyebrow') {
            this.registeredHairObjects.set(obj.name, obj);
          }
        });
      });
    }

  };

  /** Morphs **/
  setMorph = (key: string, v: number) => {
    const val = clamp01(v);
    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (name.includes('occlusion') || name.includes('tearline')) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) infl[idx] = val;
    }
  };

  /**
   * Set a morph on a specific subset of meshes.
   * This avoids iterating over the entire scene for hair-only updates.
   */
  setMorphOnMeshes = (meshNames: string[], key: string, v: number) => {
    if (!meshNames || meshNames.length === 0) {
      this.setMorph(key, v);
      return;
    }

    const val = clamp01(v);
    const nameSet = new Set(meshNames.map((n) => (n || '').toLowerCase()));

    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (!nameSet.has(name)) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      const idx = dict[key];
      if (idx !== undefined) infl[idx] = val;
    }
  };

  applyMorphs = (keys: string[], v: number) => {
    const val = clamp01(v);
    const foundMorphs: string[] = [];
    const notFoundMorphs: string[] = [];

    for (const m of this.meshes) {
      const name = (m.name || '').toLowerCase();
      if (name.includes('occlusion') || name.includes('tearline')) continue;
      const dict: any = (m as any).morphTargetDictionary;
      const infl: any = (m as any).morphTargetInfluences;
      if (!dict || !infl) continue;
      for (const k of keys) {
        const idx = dict[k];
        if (idx !== undefined) {
          infl[idx] = val;
          if (!foundMorphs.includes(k)) foundMorphs.push(k);
        } else {
          if (!notFoundMorphs.includes(k)) notFoundMorphs.push(k);
        }
      }
    }

  };

  /**
   * Set an AU value. Supports multiple formats:
   * - Numeric ID with 0-1 value: setAU(12, 0.5) - standard activation
   * - Numeric ID with -1 to +1 value: setAU(41, -0.5) - for continuum pairs, negative activates the pair
   * - String with side: setAU('12L', 0.5) - left side only (legacy, converts to balance=-1)
   *
   * @param id - AU ID (number) or string with side suffix ('12L', '12R')
   * @param v - Intensity value (0-1 for standard AUs, -1 to +1 for continuum pairs)
   * @param balance - Optional left/right balance: -1 = left only, 0 = both equally, +1 = right only
   *
   * For continuum pairs (e.g., AU 41/42 tongue tilt), passing a negative value to either AU
   * will automatically activate the paired AU instead.
   */
  setAU = (id: number | string, v: number, balance?: number) => {
    if (typeof id === 'string') {
      const match = id.match(/^(\d+)([LR])$/i);
      if (match) {
        // Legacy string format: '12L' → setAU(12, v, -1), '12R' → setAU(12, v, +1)
        const au = Number(match[1]);
        const side = match[2].toUpperCase() as 'L' | 'R';
        const sideBalance = side === 'L' ? -1 : 1;
        this.setAU(au, v, sideBalance);
        return;
      }
      const n = Number(id);
      if (!Number.isNaN(n)) {
        this.setAU(n, v, balance);
      }
      return;
    }

    // Get balance from parameter or stored value
    const effectiveBalance = balance ?? this.auBalances[id] ?? 0;

    // Store balance if explicitly provided
    if (balance !== undefined) {
      this.auBalances[id] = Math.max(-1, Math.min(1, balance));
    }

    // Check if this AU is part of a continuum pair and handle negative values
    const pairInfo = CONTINUUM_PAIRS_MAP[id];
    if (pairInfo && v < 0) {
      // Negative value on a continuum AU - activate the paired AU instead
      const absVal = Math.abs(v);
      this.auValues[id] = 0;
      this.auValues[pairInfo.pairId] = absVal;
      // Continue with the paired AU's composite rotation logic
      this.applyBothSides(pairInfo.pairId, absVal, effectiveBalance);
      const compositeInfo = AU_TO_COMPOSITE_MAP.get(pairInfo.pairId);
      if (compositeInfo) {
        for (const nodeKey of compositeInfo.nodes) {
          const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
          if (!config) continue;
          const axisConfig = config[compositeInfo.axis];
          if (!axisConfig) continue;
          let axisValue = 0;
          if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
            const negValue = this.auValues[axisConfig.negative] ?? 0;
            const posValue = this.auValues[axisConfig.positive] ?? 0;
            axisValue = posValue - negValue;
          } else {
            axisValue = absVal;
          }
          this.updateBoneRotation(nodeKey, compositeInfo.axis, axisValue);
          this.pendingCompositeNodes.add(nodeKey);
        }
      }
      return;
    }

    this.auValues[id] = v;

    // Check if this AU is part of a composite rotation system
    const compositeInfo = AU_TO_COMPOSITE_MAP.get(id);

    if (compositeInfo) {
      // This AU affects composite bone rotations (jaw, head, eyes)
      // Always apply morphs first (with balance for bilateral morphs)
      this.applyBothSides(id, v, effectiveBalance);

      // Update rotation state for each affected node
      for (const nodeKey of compositeInfo.nodes) {
        // Determine the value for this axis based on the continuum
        const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
        if (!config) continue;

        const axisConfig = config[compositeInfo.axis];
        if (!axisConfig) continue;

        // Calculate axis value based on whether it's a continuum or multi-AU axis
        let axisValue = 0;
        if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
          // Continuum: calculate difference between positive and negative AUs
          const negValue = this.auValues[axisConfig.negative] ?? 0;
          const posValue = this.auValues[axisConfig.positive] ?? 0;
          axisValue = posValue - negValue;
        } else if (axisConfig.aus.length > 1) {
          // Multiple AUs affect same axis (e.g., jaw drop has AU 25, 26, 27)
          // Use the maximum value among all AUs for this axis
          axisValue = Math.max(...axisConfig.aus.map(auId => this.auValues[auId] ?? 0));
        } else {
          // Single AU controls this axis
          axisValue = v;
        }

        // Update the rotation state for this axis
        this.updateBoneRotation(nodeKey, compositeInfo.axis, axisValue);

        // Mark node as pending - will be applied in update()
        this.pendingCompositeNodes.add(nodeKey);
      }
    } else {
      // Non-composite AU: apply directly to both morphs and bones (with balance)
      this.applyBothSides(id, v, effectiveBalance);
      if (this.hasBoneBinding(id)) {
        this.applyBones(id, v);
      }
    }
  };

  /** Engine internals **/
  /**
   * Apply morphs for an AU, with mix weight scaling for mixed AUs.
   *
   * ⚠️ CRITICAL MIX WEIGHT BEHAVIOR:
   * - For mixed AUs (bones + morphs): morphValue = v * mixWeight
   *   - mixWeight = 0.0 → morphValue = 0 (no morph, bones only)
   *   - mixWeight = 1.0 → morphValue = v (full morph + bones)
   * - For morph-only AUs: morphValue = v (always 100%)
   *
   * Note: Bones are NOT scaled here - they're handled separately in applyCompositeMotion
   * See: MIX_WEIGHT_SYSTEM.md for detailed explanation
   */
  /**
   * Apply morphs for an AU, with mix weight scaling and optional left/right balance.
   *
   * @param id - AU ID
   * @param v - Intensity value (0-1)
   * @param balance - Left/right balance: -1 = left only, 0 = both equally, +1 = right only
   *
   * Balance scaling:
   * - balance = -1: leftScale = 1.0, rightScale = 0.0
   * - balance =  0: leftScale = 1.0, rightScale = 1.0 (default)
   * - balance = +1: leftScale = 0.0, rightScale = 1.0
   */
  private applyBothSides = (id: number, v: number, balance: number = 0) => {
    // For head and eye AUs that aren't left/right split, apply all keys directly
    const globalAUs = new Set([31, 32, 33, 54, 61, 62, 63, 64]);
    const keys = AU_TO_MORPHS[id] || [];

    // ⚠️ CRITICAL: Scale morphs by mixWeight (NOT bones - they're handled elsewhere)
    // For mixed AUs: morphValue = v * mixWeight
    // mixWeight = 0.0 → no morph (bone only)
    // mixWeight = 1.0 → full morph (bone + morph)
    const mixWeight = MIXED_AUS.has(id) ? this.getAUMixWeight(id) : 1.0;
    const morphValue = v * mixWeight;

    if (globalAUs.has(id)) {
      // Global AUs (head, eyes) don't have L/R split - apply uniformly
      this.applyMorphs(keys, morphValue);
    } else {
      const leftKeys = keys.filter(k => /(_L|Left)$/.test(k));
      const rightKeys = keys.filter(k => /(_R|Right)$/.test(k));
      if (leftKeys.length || rightKeys.length) {
        // Calculate left/right scales based on balance
        // balance = -1: left = 1, right = 0
        // balance =  0: left = 1, right = 1
        // balance = +1: left = 0, right = 1
        const leftScale = balance >= 0 ? 1 - balance : 1;
        const rightScale = balance <= 0 ? 1 + balance : 1;

        this.applyMorphs(leftKeys, morphValue * leftScale);
        this.applyMorphs(rightKeys, morphValue * rightScale);
      } else if (keys.length) {
        // No L/R split - apply uniformly
        this.applyMorphs(keys, morphValue);
      }
    }
  };

  /**
   * Update rotation state for a specific axis of a composite bone.
   * This allows independent control of pitch/yaw/roll without overwriting.
   */
  private updateBoneRotation(
    nodeKey: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE',
    axis: 'pitch' | 'yaw' | 'roll',
    value: number
  ) {
    this.rotations[nodeKey][axis] = Math.max(-1, Math.min(1, value));
  }

  /**
   * Apply the complete composite rotation for a bone.
   * Combines pitch/yaw/roll from rotation state into a single quaternion.
   */
  private applyCompositeRotation(nodeKey: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE') {
    const bones = this.bones;
    const entry = bones[nodeKey];
    if (!entry || !this.model) {
      if (!entry && this.rigReady && !this.missingBoneWarnings.has(nodeKey)) {
        // console.warn(`[EngineThree] applyCompositeRotation: No bone entry for ${nodeKey}`);
        this.missingBoneWarnings.add(nodeKey);
      }
      return;
    }

    const { obj, basePos, baseQuat } = entry;
    const rotState = this.rotations[nodeKey];

    // Find the composite rotation config for this node
    const config = COMPOSITE_ROTATIONS.find(c => c.node === nodeKey);
    if (!config) return;

    // Helper to get binding from the correct AU for an axis based on direction
    const getBindingForAxis = (
      axisConfig: typeof config.pitch | typeof config.yaw | typeof config.roll,
      direction: number
    ) => {
      if (!axisConfig) return null;

      // For continuum pairs, select the AU based on direction
      // negative direction → use negative AU's binding
      // positive direction → use positive AU's binding
      if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
        const auId = direction < 0 ? axisConfig.negative : axisConfig.positive;
        return BONE_AU_TO_BINDINGS[auId]?.[0];
      }

      // If multiple AUs (non-continuum), find which one is active (has highest value)
      if (axisConfig.aus.length > 1) {
        let maxAU = axisConfig.aus[0];
        let maxValue = this.auValues[maxAU] ?? 0;
        for (const auId of axisConfig.aus) {
          const val = this.auValues[auId] ?? 0;
          if (val > maxValue) {
            maxValue = val;
            maxAU = auId;
          }
        }
        return BONE_AU_TO_BINDINGS[maxAU]?.[0];
      }

      // Single AU - use first AU
      return BONE_AU_TO_BINDINGS[axisConfig.aus[0]]?.[0];
    };

    // Build composite quaternion from individual axes
    const compositeQ = new THREE.Quaternion().copy(baseQuat);

    // Helper to get axis from config
    const getAxis = (axisName: 'rx' | 'ry' | 'rz') =>
      axisName === 'rx' ? X_AXIS : axisName === 'ry' ? Y_AXIS : Z_AXIS;

    // Apply rotations in order: yaw, pitch, roll
    // Use the channel from the binding (BONE_AU_TO_BINDINGS) as the source of truth for axis
    if (config.yaw && rotState.yaw !== 0) {
      const binding = getBindingForAxis(config.yaw, rotState.yaw);
      if (binding?.maxDegrees && binding.channel) {
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.yaw) * binding.scale;
        const axis = getAxis(binding.channel as 'rx' | 'ry' | 'rz');
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.pitch && rotState.pitch !== 0) {
      const binding = getBindingForAxis(config.pitch, rotState.pitch);
      if (binding?.maxDegrees && binding.channel) {
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.pitch) * binding.scale;
        const axis = getAxis(binding.channel as 'rx' | 'ry' | 'rz');
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    if (config.roll && rotState.roll !== 0) {
      const binding = getBindingForAxis(config.roll, rotState.roll);
      if (binding?.maxDegrees && binding.channel) {
        const radians = deg2rad(binding.maxDegrees) * Math.abs(rotState.roll) * binding.scale;
        const axis = getAxis(binding.channel as 'rx' | 'ry' | 'rz');
        const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        compositeQ.multiply(deltaQ);
      }
    }

    // Apply composite rotation
    obj.position.copy(basePos);
    obj.quaternion.copy(compositeQ);
    obj.updateMatrixWorld(false);
    this.model.updateMatrixWorld(true);
    // console.log(`  → Applied composite rotation to ${nodeKey} bone`);
  }

  private applyBones = (id: number, v: number) => {
    const bindings = BONE_AU_TO_BINDINGS[id];
    if (!bindings || !bindings.length || !this.model) return;
    const bones = this.bones;

    // Clamp to normalized range (-1 to +1) to preserve natural limits
    const val = Math.min(1, Math.max(-1, v));

    for (const b of bindings) {
      const entry = bones[b.node as BoneKeys];
      if (!entry) continue;

      // Eye axis override for CC rigs
      let binding = { ...b };
      if (id >= 61 && id <= 62) {
        binding = { ...binding, channel: EYE_AXIS.yaw };
      } else if (id >= 63 && id <= 64) {
        binding = { ...binding, channel: EYE_AXIS.pitch };
      }

      // Use absolute magnitude (0–1) with signed rotation respecting maxDegrees
      const absVal = Math.abs(val);
      const signedScale = Math.sign(val) || 1;
      const radians = b.maxDegrees ? deg2rad(b.maxDegrees) * absVal * b.scale * signedScale : 0;
      const units = b.maxUnits ? b.maxUnits * absVal * b.scale * signedScale : 0;

      // Apply the binding
      this.applySingleBinding(entry, { ...binding, maxDegrees: b.maxDegrees, maxUnits: b.maxUnits, scale: b.scale }, val);
    }

    this.model.updateMatrixWorld(true);
  };

  private applySingleBinding(
    entry: NodeBase,
    b: { channel: string; maxDegrees?: number; maxUnits?: number; scale: number; node?: string },
    val: number
  ) {
    const { obj, basePos, baseQuat } = entry;

    // Clamp input to natural range [-1, 1]
    const clampedVal = Math.min(1, Math.max(-1, val));

    // Calculate radians/units respecting maxDegrees and scale
    const radians = b.maxDegrees ? deg2rad(b.maxDegrees) * clampedVal * b.scale : 0;
    const units = b.maxUnits ? b.maxUnits * clampedVal * b.scale : 0;

    // Maintain base position (no drift)
    obj.position.copy(basePos);

    // Apply combined axis rotation while preserving boundaries
    if (b.channel === 'rx' || b.channel === 'ry' || b.channel === 'rz') {
      const deltaQ = new THREE.Quaternion();
      const axis = b.channel === 'rx' ? X_AXIS : b.channel === 'ry' ? Y_AXIS : Z_AXIS;

      // Compute new rotation relative to baseQuat (no accumulation here; callers should compose before calling)
      deltaQ.setFromAxisAngle(axis, radians);
      obj.quaternion.copy(baseQuat).multiply(deltaQ);
    } else {
      const dir =
        b.channel === 'tx' ? X_AXIS.clone() :
        b.channel === 'ty' ? Y_AXIS.clone() : Z_AXIS.clone();
      dir.applyQuaternion(baseQuat);
      const offset = dir.multiplyScalar(units);
      obj.position.copy(basePos).add(offset);
    }

    // Update only this node’s matrix without resetting others
    obj.updateMatrixWorld(false);
  }

  /** Resolve CC4 bones using explicit node names (no heuristics). */
  private resolveBones = (root: THREE.Object3D): ResolvedBones => {
    const resolved: ResolvedBones = {};

    const snapshot = (obj: THREE.Object3D): NodeBase => ({
      obj,
      basePos: obj.position.clone(),
      baseQuat: obj.quaternion.clone(),
      baseEuler: new THREE.Euler().setFromQuaternion(obj.quaternion.clone(), obj.rotation.order),
    });

    // Build name→object map in a single traverse (instead of multiple getObjectByName calls)
    const boneNames = new Set([
      CC4_BONE_NODES.EYE_L, CC4_BONE_NODES.EYE_R, CC4_BONE_NODES.JAW,
      CC4_BONE_NODES.HEAD, CC4_BONE_NODES.NECK, CC4_BONE_NODES.TONGUE,
      CC4_BONE_NODES.NECK_TWIST, CC4_EYE_MESH_NODES.LEFT, CC4_EYE_MESH_NODES.RIGHT
    ].filter(Boolean) as string[]);

    const nodeMap = new Map<string, THREE.Object3D>();
    root.traverse((obj) => {
      if (obj.name && boneNames.has(obj.name)) {
        nodeMap.set(obj.name, obj);
      }
    });

    const findNode = (name?: string | null): THREE.Object3D | null => {
      if (!name) return null;
      return nodeMap.get(name) || null;
    };

    const register = (key: BoneKeys, primary?: string | null, fallback?: string | null) => {
      if (resolved[key]) return;
      const node = findNode(primary) || findNode(fallback || undefined);
      if (node) resolved[key] = snapshot(node);
    };

    register('EYE_L', CC4_BONE_NODES.EYE_L, CC4_EYE_MESH_NODES.LEFT);
    register('EYE_R', CC4_BONE_NODES.EYE_R, CC4_EYE_MESH_NODES.RIGHT);
    register('JAW', CC4_BONE_NODES.JAW);
    register('HEAD', CC4_BONE_NODES.HEAD);
    register('NECK', CC4_BONE_NODES.NECK);
    register('TONGUE', CC4_BONE_NODES.TONGUE);

    const neckTwist = findNode(CC4_BONE_NODES.NECK_TWIST);
    if (neckTwist) (resolved as any).NECK2 = snapshot(neckTwist);

    return resolved;
  };

  // ========================================
  // Hair & Eyebrow Color Control
  // ========================================

  /**
   * Set up render order for all meshes to ensure proper layering.
   * Eyes render first (behind), then face/body, then hair (on top).
   * This prevents eyes from showing through transparent hair.
   * Also populates registeredHairObjects for hair physics.
   */
  private setupMeshRenderOrder(model: THREE.Object3D) {
    this.registeredHairObjects.clear();

    model.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const info = CC4_MESHES[mesh.name];
      const category = info?.category;

      // Render order hierarchy:
      // -10: Eyes (render first, behind everything)
      //  -5: Eye occlusion, tear lines
      //   0: Body, teeth, tongue (default)
      //   5: Eyebrows (above face)
      //  10: Hair (render last, on top of everything)
      switch (category) {
        case 'eye':
        case 'cornea':
          mesh.renderOrder = -10;
          break;
        case 'eyeOcclusion':
        case 'tearLine':
          mesh.renderOrder = -5;
          break;
        case 'eyebrow':
          mesh.renderOrder = 5;
          this.registeredHairObjects.set(obj.name, obj);
          break;
        case 'hair':
          mesh.renderOrder = 10;
          this.registeredHairObjects.set(obj.name, obj);
          break;
        // body, teeth, tongue, etc. stay at default 0
      }
    });
  }

  /**
   * Apply color to a hair or eyebrow mesh
   */
  setHairColor(mesh: THREE.Mesh, baseColor: string, emissive: string, emissiveIntensity: number, isEyebrow: boolean = false) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((mat) => {
      const standardMat = mat as THREE.MeshStandardMaterial;

      // Set base color
      if (standardMat.color !== undefined) {
        standardMat.color.set(baseColor);
      }

      // Set emissive glow
      if (standardMat.emissive !== undefined) {
        standardMat.emissive.set(emissive);
        standardMat.emissiveIntensity = emissiveIntensity;
      }
    });

    // Set renderOrder: eyebrows=5, hair=10 (consistent with setupMeshRenderOrder)
    mesh.renderOrder = isEyebrow ? 5 : 10;
  }

  /**
   * Create or remove wireframe outline for a mesh
   */
  setHairOutline(mesh: THREE.Mesh, show: boolean, color: string, opacity: number): THREE.LineSegments | undefined {
    // Remove existing wireframe if present
    const existingWireframe = mesh.children.find(
      (child) => child.name === `${mesh.name}_wireframe`
    ) as THREE.LineSegments | undefined;

    if (existingWireframe) {
      mesh.remove(existingWireframe);
      existingWireframe.geometry.dispose();
      (existingWireframe.material as THREE.Material).dispose();
    }

    // Add wireframe if requested
    if (show) {
      const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2,
        transparent: true,
        opacity: opacity,
      });
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      wireframe.name = `${mesh.name}_wireframe`;
      mesh.add(wireframe);
      return wireframe;
    }

    return undefined;
  }


  /**
   * Get registered hair objects (populated in onReady from CC4_MESHES)
   */
  getRegisteredHairObjects(): THREE.Object3D[] {
    return Array.from(this.registeredHairObjects.values());
  }

  /**
   * Register hair objects and return engine-agnostic metadata.
   * Classification is handled by shapeDict (single source of truth).
   * Also stores direct references to avoid model lookup race conditions.
   */
  registerHairObjects(objects: THREE.Object3D[]): Array<{
    name: string;
    isEyebrow: boolean;
    isMesh: boolean;
  }> {
    // Store direct references for immediate access (before onReady sets this.model)
    this.registeredHairObjects.clear();
    this.cachedHairMeshNames = null; // Invalidate cache
    objects.forEach(obj => {
      this.registeredHairObjects.set(obj.name, obj);
    });

    return objects.map((obj) => {
      const isMesh = (obj as THREE.Mesh).isMesh || false;
      const info = CC4_MESHES[obj.name];
      const isEyebrow = info?.category === 'eyebrow';

      if (isMesh) {
        const mesh = obj as THREE.Mesh;
        // Eyebrows=5, hair=10 (consistent with setupMeshRenderOrder)
        mesh.renderOrder = isEyebrow ? 5 : 10;
      }

      return {
        name: obj.name,
        isEyebrow,
        isMesh,
      };
    });
  }

  /**
   * Apply hair state to scene objects by name
   * This method handles all Three.js-specific operations for applying hair state
   * NOTE: Handles objects with _1, _2, etc suffixes (e.g. Side_part_wavy_1, Side_part_wavy_2)
   */
  applyHairStateToObject(
    objectName: string,
    state: {
      color: { baseColor: string; emissive: string; emissiveIntensity: number };
      outline: { show: boolean; color: string; opacity: number };
      visible?: boolean;
      scale?: number;
      position?: [number, number, number];
      isEyebrow?: boolean;
    }
  ): THREE.LineSegments | undefined {
    // Use registered hair objects (built in onReady from CC4_MESHES)
    const registeredObj = this.registeredHairObjects.get(objectName);
    if (!registeredObj) {
      // Not a registered hair object - skip silently (may be called before onReady)
      return undefined;
    }

    const matchingObjects = [registeredObj];

    let lastOutline: THREE.LineSegments | undefined;

    // Apply state to all matching objects
    matchingObjects.forEach((object) => {
      // Apply visibility
      if (state.visible !== undefined) {
        object.visible = state.visible;
      }

      // Apply scale
      if (state.scale !== undefined) {
        object.scale.setScalar(state.scale);
      }

      // Apply position
      if (state.position) {
        const [x, y, z] = state.position;
        object.position.set(x, y, z);
      }

      // Apply color if it's a mesh
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        this.setHairColor(
          mesh,
          state.color.baseColor,
          state.color.emissive,
          state.color.emissiveIntensity,
          state.isEyebrow || false
        );

        // Apply outline
        lastOutline = this.setHairOutline(
          mesh,
          state.outline.show,
          state.outline.color,
          state.outline.opacity
        );
      }
    });

    return lastOutline;
  }

  /**
   * Get available hair morph targets from a hair object
   * Returns array of morph target names
   */
  getHairMorphTargets(objectName: string): string[] {
    const object = this.model?.getObjectByName(objectName);
    if (!object || !(object as THREE.Mesh).isMesh) return [];

    const mesh = object as THREE.Mesh;
    const dict = (mesh as any).morphTargetDictionary;
    if (!dict) return [];

    return Object.keys(dict);
  }

  // ========================================
  // Hair Physics System
  // ========================================

  /** Enable or disable hair physics simulation */
  setHairPhysicsEnabled(enabled: boolean) {
    this.hairPhysicsEnabled = enabled;
    if (!enabled) {
      // Reset hair morphs to neutral via transitions
      const duration = 200;
      this.transitionHairMorph('L_Hair_Left', 0, duration);
      this.transitionHairMorph('L_Hair_Right', 0, duration);
      this.transitionHairMorph('L_Hair_Front', 0, duration);
      this.transitionHairMorph('Fluffy_Right', 0, duration);
      this.transitionHairMorph('Fluffy_Bottom_ALL', 0, duration);
    }
  }

  /** Update hair physics configuration */
  setHairPhysicsConfig(config: Partial<typeof this.hairPhysicsConfig>) {
    this.hairPhysicsConfig = { ...this.hairPhysicsConfig, ...config };
  }

  /** Get current hair physics config (for UI) */
  getHairPhysicsConfig() {
    return { ...this.hairPhysicsConfig };
  }

  /**
   * Lightweight per-frame update for wind and idle sway.
   * Only runs when wind or idle is enabled. Much cheaper than full physics.
   */
  private updateHairWindIdle(dt: number) {
    if (!this.hairPhysicsEnabled) return;
    if (this.registeredHairObjects.size === 0) return;

    const cfg = this.hairPhysicsConfig;
    const st = this.hairWindIdleState;

    // Skip if neither wind nor idle is active
    const hasWind = cfg.windStrength > 0;
    const hasIdle = cfg.idleSwayAmount > 0;
    if (!hasWind && !hasIdle) return;

    // Update time-based state
    st.idlePhase += dt * cfg.idleSwaySpeed;
    st.windTime += dt;

    // Calculate wind contribution
    let windOffset = 0;
    if (hasWind) {
      const primaryWave = Math.sin(st.windTime * cfg.windFrequency);
      const secondaryWave = Math.sin(st.windTime * cfg.windFrequency * 1.7) * 0.3;
      const waveStrength = primaryWave + secondaryWave;

      const targetWind = cfg.windDirectionX * waveStrength * cfg.windStrength * 0.1;
      const smoothFactor = 1 - Math.exp(-dt * 8);
      st.smoothedWindX += (targetWind - st.smoothedWindX) * smoothFactor;
      windOffset = st.smoothedWindX;
    }

    // Calculate idle sway contribution
    let idleOffset = 0;
    if (hasIdle) {
      idleOffset = Math.sin(st.idlePhase * Math.PI * 2) * cfg.idleSwayAmount;
    }

    // Combined horizontal offset for left/right morphs
    const horizontal = windOffset + idleOffset;

    // Calculate all morph values (same as updateHairForHeadChange)
    const leftValue = clamp01(horizontal > 0 ? horizontal : 0);
    const rightValue = clamp01(horizontal < 0 ? -horizontal : 0);
    const fluffyRightValue = clamp01(rightValue * 0.7);
    const movementIntensity = Math.abs(horizontal);
    const fluffyBottomValue = clamp01(movementIntensity * 0.25);

    // Only update if there's meaningful change
    if (Math.abs(horizontal) > 0.001) {
      const duration = 50; // Short for responsive feel
      this.transitionHairMorph('L_Hair_Left', leftValue, duration);
      this.transitionHairMorph('L_Hair_Right', rightValue, duration);
      this.transitionHairMorph('Fluffy_Right', fluffyRightValue, duration);
      this.transitionHairMorph('Fluffy_Bottom_ALL', fluffyBottomValue, duration);
      // Note: L_Hair_Front is driven by head pitch, not wind/idle
    }
  }

  /**
   * Event-driven hair update - called when HEAD rotation changes.
   * Calculates target morph values and schedules transitions.
   * No per-frame simulation - uses transition system for smooth interpolation.
   */
  private updateHairForHeadChange() {
    if (this.registeredHairObjects.size === 0) return;

    const cfg = this.hairPhysicsConfig;
    const headYaw = this.rotations.HEAD?.yaw ?? 0;
    const headPitch = this.rotations.HEAD?.pitch ?? 0;

    // Calculate hair offset based on head position
    // Hair swings opposite to head rotation (inertia effect)
    const horizontal = -headYaw * cfg.inertia * cfg.responseScale;
    const vertical = headPitch * cfg.gravity * 0.1 * cfg.responseScale;

    // Map to morph targets
    const leftValue = clamp01(horizontal > 0 ? horizontal : 0);
    const rightValue = clamp01(horizontal < 0 ? -horizontal : 0);
    const frontValue = clamp01(vertical * 0.5);
    const fluffyRightValue = clamp01(rightValue * 0.7);
    const movementIntensity = Math.abs(horizontal) + Math.abs(vertical);
    const fluffyBottomValue = clamp01(movementIntensity * 0.25);

    // Schedule transitions for each hair morph (spring-like easing via transition duration)
    const duration = 150; // ms - short for responsive feel
    this.transitionHairMorph('L_Hair_Left', leftValue, duration);
    this.transitionHairMorph('L_Hair_Right', rightValue, duration);
    this.transitionHairMorph('L_Hair_Front', frontValue, duration);
    this.transitionHairMorph('Fluffy_Right', fluffyRightValue, duration);
    this.transitionHairMorph('Fluffy_Bottom_ALL', fluffyBottomValue, duration);
  }

  /**
   * Transition a hair morph target to a value.
   * Only applies to registered hair meshes (not eyebrows).
   */
  private transitionHairMorph(morphKey: string, to: number, durationMs: number) {
    const transitionKey = `hair_${morphKey}`;
    const from = this.getHairMorphValue(morphKey);

    // Get hair mesh names (cached)
    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return;

    this.addTransition(
      transitionKey,
      from,
      to,
      durationMs / 1000,
      (value) => this.setMorphOnMeshes(hairMeshNames, morphKey, value)
    );
  }

  /** Get current value of a hair morph (from first hair mesh) */
  private getHairMorphValue(morphKey: string): number {
    const hairMeshNames = this.getHairMeshNames();
    if (hairMeshNames.length === 0) return 0;

    const meshName = hairMeshNames[0];
    const obj = this.registeredHairObjects.get(meshName);
    if (!obj || !(obj as THREE.Mesh).isMesh) return 0;

    const mesh = obj as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dict || !influences) return 0;

    const index = dict[morphKey];
    return index !== undefined ? influences[index] : 0;
  }

  /** Get cached list of hair mesh names (excludes eyebrows) */
  private cachedHairMeshNames: string[] | null = null;
  private getHairMeshNames(): string[] {
    if (this.cachedHairMeshNames) return this.cachedHairMeshNames;

    const names: string[] = [];
    this.registeredHairObjects.forEach((_, name) => {
      const info = CC4_MESHES[name];
      if (info?.category === 'hair') {
        names.push(name);
      }
    });
    this.cachedHairMeshNames = names;
    return names;
  }

  /**
   * Get current head rotation values for hair physics
   * Returns { yaw, pitch, roll } in range [-1, 1]
   */
  getHeadRotation(): { yaw: number; pitch: number; roll: number } {
    return {
      yaw: this.rotations.HEAD?.yaw ?? 0,
      pitch: this.rotations.HEAD?.pitch ?? 0,
      roll: this.rotations.HEAD?.roll ?? 0
    };
  }

  // ========================================
  // End Hair & Eyebrow Control
  // ========================================

  private logResolvedOnce = (_bones: ResolvedBones) => {
    // Debug logging disabled for performance
    // Call engine.logShapeKeys() and engine.logResolvedBones() manually if needed
  };

  // ============================================================================
  // SKYBOX CONTROL METHODS
  // ============================================================================

  /** Rotate skybox - not supported with scene.background texture approach */
  setSkyboxRotation = (_degrees: number) => {
    // Rotation not supported - would require upgrading Three.js or using a skybox mesh
  };

  /** Set skybox blur (0-1) */
  setSkyboxBlur = (blur: number) => {
    if (this.scene) {
      this.scene.backgroundBlurriness = Math.max(0, Math.min(1, blur));
    }
  };

  /** Set skybox intensity (0-2) */
  setSkyboxIntensity = (intensity: number) => {
    if (this.scene) {
      this.scene.backgroundIntensity = Math.max(0, Math.min(2, intensity));
    }
  };

  /** Check if skybox is ready - checks if scene has background */
  isSkyboxReady = (): boolean => {
    return this.scene !== null && this.scene.background !== null;
  };

  /** Set skybox texture reference (called when texture finishes loading) */
  setSkyboxTexture = (texture: THREE.Texture) => {
    this.skyboxTexture = texture;
  };

  // ============================================================================
  // POST-PROCESSING CONTROL METHODS
  // ============================================================================

  /** Set tone mapping type */
  setToneMapping = (type: THREE.ToneMapping) => {
    if (this.renderer) {
      this.renderer.toneMapping = type;
    }
  };

  /** Get current tone mapping type */
  getToneMapping = (): THREE.ToneMapping => {
    return this.renderer?.toneMapping ?? THREE.NoToneMapping;
  };

  /** Set tone mapping exposure (0.1-3) */
  setExposure = (exposure: number) => {
    if (this.renderer) {
      this.renderer.toneMappingExposure = Math.max(0.1, Math.min(3, exposure));
    }
  };

  /** Get current exposure */
  getExposure = (): number => {
    return this.renderer?.toneMappingExposure ?? 1;
  };

  /** Set environment intensity for materials (0-3) */
  setEnvironmentIntensity = (intensity: number) => {
    if (this.scene) {
      (this.scene as any).environmentIntensity = Math.max(0, Math.min(3, intensity));
    }
  };

  /** Get current environment intensity */
  getEnvironmentIntensity = (): number => {
    return (this.scene as any)?.environmentIntensity ?? 1;
  };

  /** Check if renderer is ready for post-processing controls */
  isRendererReady = (): boolean => {
    return this.renderer !== null;
  };

  // ============================================================================
  // POST-PROCESSING EFFECTS
  // ============================================================================

  /** Get current post-processing effect */
  getPostEffect = (): PostEffect => {
    return this.currentEffect;
  };

  /** Set post-processing effect */
  setPostEffect = (effect: PostEffect) => {
    if (!this.composer || !this.renderer) {
      console.warn('[EngineThree] Cannot set post effect - composer or renderer not ready');
      return;
    }

    // Remove current effect pass if exists
    if (this.effectPass) {
      this.composer.removePass(this.effectPass);
      this.effectPass = null;
    }

    this.currentEffect = effect;

    if (effect === 'none') {
      return;
    }

    const width = this.renderer.domElement.width;
    const height = this.renderer.domElement.height;
    const p = this.effectParams;

    // Create the appropriate pass based on effect type
    switch (effect) {
      case 'bloom': {
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(width, height),
          p.bloom.strength,
          p.bloom.radius,
          p.bloom.threshold
        );
        this.effectPass = bloomPass;
        break;
      }
      case 'film': {
        const filmPass = new FilmPass(p.film.intensity);
        this.effectPass = filmPass;
        break;
      }
      case 'glitch': {
        const glitchPass = new GlitchPass();
        glitchPass.goWild = p.glitch.wild;
        this.effectPass = glitchPass;
        break;
      }
      case 'halftone': {
        const halftonePass = new HalftonePass(width, height, {
          shape: 1,
          radius: p.halftone.radius,
          rotateR: Math.PI / 12,
          rotateB: Math.PI / 12 * 2,
          rotateG: Math.PI / 12 * 3,
          scatter: p.halftone.scatter,
          blending: 1,
          blendingMode: 1,
          greyscale: p.halftone.greyscale,
        });
        this.effectPass = halftonePass;
        break;
      }
      case 'dotScreen': {
        const dotScreenPass = new DotScreenPass(
          new THREE.Vector2(0, 0),
          p.dotScreen.angle,
          p.dotScreen.scale
        );
        this.effectPass = dotScreenPass;
        break;
      }
      case 'vignette': {
        const vignettePass = new ShaderPass(VignetteShader);
        vignettePass.uniforms['offset'].value = p.vignette.offset;
        vignettePass.uniforms['darkness'].value = p.vignette.darkness;
        this.effectPass = vignettePass;
        break;
      }
      case 'sepia': {
        const sepiaPass = new ShaderPass(SepiaShader);
        sepiaPass.uniforms['amount'].value = p.sepia.amount;
        this.effectPass = sepiaPass;
        break;
      }
    }

    if (this.effectPass) {
      this.composer.addPass(this.effectPass);
    }
  };

  /** Get effect parameters for a specific effect */
  getEffectParams = <T extends keyof EffectParams>(effect: T): EffectParams[T] => {
    return { ...this.effectParams[effect] };
  };

  /** Set effect parameters and update the effect if it's currently active */
  setEffectParams = <T extends keyof EffectParams>(effect: T, params: Partial<EffectParams[T]>) => {
    this.effectParams[effect] = { ...this.effectParams[effect], ...params } as EffectParams[T];

    // If this effect is currently active, update the pass directly
    if (this.currentEffect === effect && this.effectPass) {
      this.updateEffectPass(effect);
    }
  };

  /** Update the current effect pass with stored parameters */
  private updateEffectPass = (effect: keyof EffectParams) => {
    if (!this.effectPass) return;

    const p = this.effectParams;

    switch (effect) {
      case 'bloom': {
        const pass = this.effectPass as UnrealBloomPass;
        pass.strength = p.bloom.strength;
        pass.radius = p.bloom.radius;
        pass.threshold = p.bloom.threshold;
        break;
      }
      case 'film': {
        const pass = this.effectPass as FilmPass;
        (pass as any).uniforms.intensity.value = p.film.intensity;
        break;
      }
      case 'glitch': {
        const pass = this.effectPass as GlitchPass;
        pass.goWild = p.glitch.wild;
        break;
      }
      case 'halftone': {
        const pass = this.effectPass as HalftonePass;
        (pass as any).uniforms.radius.value = p.halftone.radius;
        (pass as any).uniforms.scatter.value = p.halftone.scatter;
        (pass as any).uniforms.greyscale.value = p.halftone.greyscale ? 1 : 0;
        break;
      }
      case 'dotScreen': {
        const pass = this.effectPass as DotScreenPass;
        (pass as any).uniforms.scale.value = p.dotScreen.scale;
        (pass as any).uniforms.angle.value = p.dotScreen.angle;
        break;
      }
      case 'vignette': {
        const pass = this.effectPass as ShaderPass;
        pass.uniforms['offset'].value = p.vignette.offset;
        pass.uniforms['darkness'].value = p.vignette.darkness;
        break;
      }
      case 'sepia': {
        const pass = this.effectPass as ShaderPass;
        pass.uniforms['amount'].value = p.sepia.amount;
        break;
      }
    }
  };

  /** Check if composer is ready for effects */
  isComposerReady = (): boolean => {
    return this.composer !== null;
  };
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
