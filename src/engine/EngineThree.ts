import * as THREE from 'three';
import {
  AU_TO_MORPHS,
  BONE_AU_TO_BINDINGS,
  AU_MIX_DEFAULTS,
  CC4_BONE_NODES,
  CC4_EYE_MESH_NODES,
  CC4_MESHES,
  VISEME_KEYS,
} from './arkit/shapeDict';
import type { TransitionHandle, ResolvedBones, BoneKey } from './EngineThree.types';
import { ThreeAnimation } from './ThreeAnimation';

// ============================================================================
// DERIVED CONSTANTS - computed from shapeDict core data
// ============================================================================

/** All AU IDs that have bone bindings */
export const BONE_DRIVEN_AUS = new Set(Object.keys(BONE_AU_TO_BINDINGS).map(Number));
const X_AXIS = new THREE.Vector3(1,0,0);
const Y_AXIS = new THREE.Vector3(0,1,0);
const Z_AXIS = new THREE.Vector3(0,0,1);
const deg2rad = (d: number) => (d * Math.PI) / 180;

// Candidate mesh names for most face-related morphs (face, viseme, tongue, hair)
const FACE_MESH_NAME_DEFAULT = 'CC_Base_Body_1';

export class EngineThree {
  private auValues: Record<number, number> = {};

  // Unified transition system - delegated to ThreeAnimation
  private animation = new ThreeAnimation();

  private rigReady = false;
  private missingBoneWarnings = new Set<string>();

  // Skybox storage
  private scene: THREE.Scene | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private skyboxTexture: THREE.Texture | null = null;

  // Unified rotation state tracking for bones
  // Each axis stores value (signed, with scale applied) and maxDegrees for rendering
  private rotations: Record<string, Record<'pitch' | 'yaw' | 'roll', { value: number; maxDegrees: number }>> = {};

  // Nodes with pending rotation changes - applied once per frame in update()
  private pendingCompositeNodes = new Set<string>();
  private isPaused: boolean = false;

  // Primary face mesh used for all AU and viseme morphs (CC_Base_Body_1)
  private faceMeshName: string | null = FACE_MESH_NAME_DEFAULT;
  private faceMesh: THREE.Mesh | null = null;

  // ============================================================================
  // INTERNAL RAF LOOP - EngineThree owns the frame loop
  // ============================================================================
  private clock = new THREE.Clock();
  private rafId: number | null = null;
  private running = false;

  /** Start the internal RAF loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();

    const tick = () => {
      if (!this.running) return;
      const dt = this.clock.getDelta();

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

  /** Dispose the engine */
  dispose() {
    this.stop();
  }

  // ============================================================================
  // OPTIMIZED TRANSITION SYSTEM
  // Pre-resolves morph indices and bone references at transition creation time
  // ============================================================================


  // No constructor needed - all state is initialized inline

  private getMorphValue(key: string): number {
    // Prefer the primary face mesh for AU/viseme morphs
    if (this.faceMesh) {
      const dict: any = (this.faceMesh as any).morphTargetDictionary;
      const infl: any = (this.faceMesh as any).morphTargetInfluences;
      if (dict && infl) {
        const idx = dict[key];
        if (idx !== undefined) return infl[idx] ?? 0;
      }
    }

    // Fallback: scan all meshes (for non-face or unknown morphs)
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
    const target = clamp01(to);

    // Get morph keys and bone bindings directly from shape dict
    const morphKeys = AU_TO_MORPHS[numId] || [];
    const bindings = BONE_AU_TO_BINDINGS[numId] || [];

    // Calculate balance scales
    const effectiveBalance = balance ?? 0;
    const leftScale = effectiveBalance >= 0 ? 1 - effectiveBalance : 1;
    const rightScale = effectiveBalance <= 0 ? 1 + effectiveBalance : 1;

    this.auValues[numId] = target;

    const handles: TransitionHandle[] = [];

    // Transition morphs - L/R pairs get balance scaling, others get full target
    const [leftMorph, rightMorph, ...rest] = morphKeys;
    if (leftMorph) handles.push(this.transitionMorph(leftMorph, target * leftScale, durationMs));
    if (rightMorph) handles.push(this.transitionMorph(rightMorph, target * rightScale, durationMs));
    for (const morph of rest) handles.push(this.transitionMorph(morph, target, durationMs));

    // Transition bones - eyes have 2 bindings (EYE_L, EYE_R), others have 1
    for (const binding of bindings) {
      const axis = binding.channel === 'rx' ? 'pitch' : binding.channel === 'ry' ? 'yaw' : 'roll';
      handles.push(this.transitionBoneRotation(
        binding.node,
        axis,
        target * binding.scale,
        binding.maxDegrees ?? 0,
        durationMs
      ));
    }

    return this.combineHandles(handles);
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
      durationMs,
      (value) => this.setMorph(key, value)
    );
  };

  /**
   * Smoothly transition a composite bone rotation axis.
   * Value should already have scale applied. maxDegrees from binding.
   */
  private transitionBoneRotation = (
    nodeKey: string,
    axis: 'pitch' | 'yaw' | 'roll',
    to: number,
    maxDegrees: number,
    durationMs = 200
  ): TransitionHandle => {
    const transitionKey = `bone_${nodeKey}_${axis}`;
    const from = this.rotations[nodeKey]?.[axis]?.value ?? 0;
    const target = Math.max(-1, Math.min(1, to));
    return this.addTransition(
      transitionKey,
      from,
      target,
      durationMs,
      (value) => this.updateBoneRotation(nodeKey, axis, value, maxDegrees)
    );
  };

  /**
   * Combine multiple TransitionHandles into one.
   * The combined promise resolves when ALL transitions complete.
   */
  private combineHandles(handles: TransitionHandle[]): TransitionHandle {
    if (handles.length === 0) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }
    if (handles.length === 1) {
      return handles[0];
    }
    return {
      promise: Promise.all(handles.map(h => h.promise)).then(() => {}),
      pause: () => handles.forEach(h => h.pause()),
      resume: () => handles.forEach(h => h.resume()),
      cancel: () => handles.forEach(h => h.cancel()),
    };
  }

  // ============================================================================
  // VISEME SYSTEM - Separate from AU System
  //
  // Visemes apply morph targets ONLY (no jaw bone rotation).
  // Jaw movement should be controlled separately via AU 26 if needed.
  // - setViseme() / transitionViseme() apply morph targets only
  // - The AnimationScheduler routes viseme curve IDs (0-14) to transitionViseme()
  // ============================================================================

  /** Track current viseme values for transitions */
  private visemeValues: number[] = new Array(15).fill(0);

  /**
   * Set viseme value immediately (no transition)
   * Applies viseme morph target only (no jaw bone rotation)
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param value - Target value in [0, 1]
   * @param _jawScale - Unused, kept for API compatibility
   */
  setViseme = (visemeIndex: number, value: number, _jawScale: number = 1.0) => {
    if (visemeIndex < 0 || visemeIndex >= VISEME_KEYS.length) return;

    const val = clamp01(value);
    this.visemeValues[visemeIndex] = val;

    // Apply viseme morph only (no jaw bone rotation)
    const morphKey = VISEME_KEYS[visemeIndex];
    this.setMorph(morphKey, val);
  };

  /**
   * Smoothly transition a viseme value
   * Applies viseme morph target only (no jaw bone rotation)
   *
   * @param visemeIndex - Viseme index (0-14) corresponding to VISEME_KEYS
   * @param to - Target value in [0, 1]
   * @param durationMs - Transition duration in milliseconds (default: 80ms)
   * @param _jawScale - Unused, kept for API compatibility
   */
  transitionViseme = (visemeIndex: number, to: number, durationMs = 80, _jawScale: number = 1.0): TransitionHandle => {
    if (visemeIndex < 0 || visemeIndex >= VISEME_KEYS.length) {
      return { promise: Promise.resolve(), pause: () => {}, resume: () => {}, cancel: () => {} };
    }

    const morphKey = VISEME_KEYS[visemeIndex];
    this.visemeValues[visemeIndex] = clamp01(to);

    // Just call transitionMorph - it handles the transition
    return this.transitionMorph(morphKey, to, durationMs);
  };

  /** Advance internal transition tweens by deltaSeconds (called from ThreeProvider RAF loop). */
  update(deltaSeconds: number) {
    const dtSeconds = Math.max(0, deltaSeconds || 0);
    if (dtSeconds <= 0 || this.isPaused) return;

    // Unified transitions (AU, morph, composite movements)
    this.animation.tick(dtSeconds);

    // Flush pending composite rotations (deferred from setAU calls)
    this.flushPendingComposites();
  }

  /** Apply all pending composite rotations and clear the set */
  private flushPendingComposites() {
    if (this.pendingCompositeNodes.size === 0) return;

    for (const nodeKey of this.pendingCompositeNodes) {
      this.applyCompositeRotation(nodeKey as 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE');
    }
    this.pendingCompositeNodes.clear();

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
    durationMs: number,
    apply: (value: number) => void,
    easing?: (t: number) => number
  ): TransitionHandle {
    return this.animation.addTransition(
      key,
      from,
      to,
      durationMs,
      apply,
      easing
    );
  }

  /** Clear all running transitions (used when playback rate changes to prevent timing conflicts). */
  clearTransitions() {
    this.animation.clearTransitions();
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
    return this.animation.getActiveTransitionCount();
  }

  private meshes: THREE.Mesh[] = [];
  private model: THREE.Object3D | null = null;
  // Cache: object name → array of matching objects (avoids repeated traversals)
  private objectNameCache = new Map<string, THREE.Object3D[]>();
  // Hair system removed for now.

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

    // Mark affected bones as pending
    const boneBindings = BONE_AU_TO_BINDINGS[id];
    if (boneBindings) {
      for (const binding of boneBindings) {
        this.pendingCompositeNodes.add(binding.node);
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
    const zero = { value: 0, maxDegrees: 0 };
    this.rotations = {
      JAW: { pitch: { ...zero }, yaw: { ...zero }, roll: { ...zero } },
      HEAD: { pitch: { ...zero }, yaw: { ...zero }, roll: { ...zero } },
      EYE_L: { pitch: { ...zero }, yaw: { ...zero }, roll: { ...zero } },
      EYE_R: { pitch: { ...zero }, yaw: { ...zero }, roll: { ...zero } },
      TONGUE: { pitch: { ...zero }, yaw: { ...zero }, roll: { ...zero } }
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

  onReady = ({ meshes, model, scene, renderer, skyboxTexture }: {
    meshes: THREE.Mesh[];
    model?: THREE.Object3D;
    scene?: THREE.Scene;
    renderer?: THREE.WebGLRenderer;
    skyboxTexture?: THREE.Texture;
  }) => {
    this.meshes = meshes;
    this.objectNameCache.clear();

    // Resolve primary face mesh for AU/viseme morphs
    const defaultFace = meshes.find(m => m.name === FACE_MESH_NAME_DEFAULT);
    if (defaultFace) {
      this.faceMeshName = defaultFace.name;
      this.faceMesh = defaultFace;
    } else {
      // Fallback: pick first mesh that has common face morphs
      const candidate = meshes.find((m) => {
        const dict: any = (m as any).morphTargetDictionary;
        return dict && typeof dict === 'object' && 'Brow_Drop_L' in dict;
      });
      this.faceMeshName = candidate?.name || null;
      this.faceMesh = candidate || null;
    }

    if (scene) this.scene = scene;
    if (renderer) this.renderer = renderer;
    if (skyboxTexture) this.skyboxTexture = skyboxTexture;

    if (model) {
      this.model = model;
      this.bones = this.resolveBones(model);
      this.logResolvedOnce(this.bones);
      this.rigReady = true;
      this.missingBoneWarnings.clear();
      this.setupMeshRenderOrder(model);
    }

  };

  /** Morphs **/
  setMorph = (key: string, v: number) => {
    const val = clamp01(v);
    // All AU / face / viseme morphs live on the primary face mesh.
    // Eye-occlusion and hair morphs are NOT handled here for now.
    if (this.faceMesh) {
      const dict: any = (this.faceMesh as any).morphTargetDictionary;
      const infl: any = (this.faceMesh as any).morphTargetInfluences;
      if (dict && infl) {
        const idx = dict[key];
        if (idx !== undefined) {
          infl[idx] = val;
          return;
        }
      }
    }

    // Fallback: scan all meshes (non-face or unknown morphs)
    for (const m of this.meshes) {
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
    // Hair / per-mesh morphs are disabled for now – no-op.
    return;
  };
  

  /**
   * Set an AU value immediately (no transition).
   *
   * @param id - AU ID (number) or string with side suffix ('12L', '12R')
   * @param v - Intensity value (0-1)
   * @param balance - Optional left/right balance: -1 = left only, 0 = both equally, +1 = right only
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

    this.auValues[id] = v;

    // Apply morphs (with balance for bilateral morphs)
    this.applyBothSides(id, v, effectiveBalance);

    // Apply bones - channel tells us axis, scale gives direction
    const bindings = BONE_AU_TO_BINDINGS[id];
    if (bindings) {
      for (const binding of bindings) {
        const axis = binding.channel === 'rx' ? 'pitch' : binding.channel === 'ry' ? 'yaw' : 'roll';
        this.updateBoneRotation(binding.node, axis, v * binding.scale, binding.maxDegrees ?? 0);
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
   * Value should already have scale applied (signed direction).
   * maxDegrees is stored for use in applyCompositeRotation.
   */
  private updateBoneRotation(
    nodeKey: string,
    axis: 'pitch' | 'yaw' | 'roll',
    value: number,
    maxDegrees: number
  ) {
    if (!this.rotations[nodeKey]) return; // Skip unknown bones
    this.rotations[nodeKey][axis] = {
      value: Math.max(-1, Math.min(1, value)),
      maxDegrees
    };
    this.pendingCompositeNodes.add(nodeKey);
  }

  /**
   * Apply the complete composite rotation for a bone.
   * Combines pitch/yaw/roll from rotation state into a single quaternion.
   * All values and maxDegrees are already stored in rotations state.
   */
  private applyCompositeRotation(nodeKey: BoneKey) {
    const entry = this.bones[nodeKey];
    if (!entry || !this.model) {
      if (!entry && this.rigReady && !this.missingBoneWarnings.has(nodeKey)) {
        this.missingBoneWarnings.add(nodeKey);
      }
      return;
    }

    const { obj, basePos, baseQuat } = entry;
    const rotState = this.rotations[nodeKey];

    // Build composite quaternion from individual axes
    // pitch=rx, yaw=ry, roll=rz
    const compositeQ = new THREE.Quaternion().copy(baseQuat);

    // Apply yaw (ry = Y_AXIS)
    if (rotState.yaw.value !== 0 && rotState.yaw.maxDegrees > 0) {
      const radians = deg2rad(rotState.yaw.maxDegrees) * rotState.yaw.value;
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, radians);
      compositeQ.multiply(deltaQ);
    }

    // Apply pitch (rx = X_AXIS)
    if (rotState.pitch.value !== 0 && rotState.pitch.maxDegrees > 0) {
      const radians = deg2rad(rotState.pitch.maxDegrees) * rotState.pitch.value;
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(X_AXIS, radians);
      compositeQ.multiply(deltaQ);
    }

    // Apply roll (rz = Z_AXIS)
    if (rotState.roll.value !== 0 && rotState.roll.maxDegrees > 0) {
      const radians = deg2rad(rotState.roll.maxDegrees) * rotState.roll.value;
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, radians);
      compositeQ.multiply(deltaQ);
    }

    // Apply composite rotation
    obj.position.copy(basePos);
    obj.quaternion.copy(compositeQ);
    obj.updateMatrixWorld(false);
    this.model.updateMatrixWorld(true);
  }

  /** Resolve CC4 bones using explicit node names from shapeDict. */
  private resolveBones = (root: THREE.Object3D): ResolvedBones => {
    const resolved: ResolvedBones = {};

    const snapshot = (obj: THREE.Object3D): NodeBase => ({
      obj,
      basePos: obj.position.clone(),
      baseQuat: obj.quaternion.clone(),
      baseEuler: new THREE.Euler().setFromQuaternion(obj.quaternion.clone(), obj.rotation.order),
    });

    const findNode = (name?: string | null): THREE.Object3D | null => {
      if (!name) return null;
      return root.getObjectByName(name) || null;
    };

    const register = (key: BoneKey, primary?: string | null, fallback?: string | null) => {
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

  // Hair system removed for now.

  /**
   * Get current head rotation values for hair physics
   * Returns { yaw, pitch, roll } in range [-1, 1]
   */
  getHeadRotation(): { yaw: number; pitch: number; roll: number } {
    return {
      yaw: this.rotations.HEAD?.yaw?.value ?? 0,
      pitch: this.rotations.HEAD?.pitch?.value ?? 0,
      roll: this.rotations.HEAD?.roll?.value ?? 0
    };
  }

  // ========================================
  // End Hair & Eyebrow Control
  // ========================================

  /**
   * Debug helper: log all meshes that have morph targets,
   * along with their morphTargetDictionary keys and current influences.
   *
   * Call from devtools via `engine.logShapeKeys()` after the model is ready.
   */
  logShapeKeys() {
    console.log('[EngineThree.logShapeKeys] --- BEGIN ---');
    const seen = new Set<THREE.Mesh>();

    const processMesh = (mesh: THREE.Mesh, fallbackIndex: number) => {
      const dict = (mesh as any).morphTargetDictionary;
      const infl = (mesh as any).morphTargetInfluences;
      if (!dict || !infl) return;

      const meshName = mesh.name || `(unnamed_${fallbackIndex})`;
      console.log(`\n[Mesh] ${meshName}`);
      console.log('  morphTargetDictionary keys:', Object.keys(dict));

      const byName: Record<string, number> = {};
      for (const [name, idx] of Object.entries(dict as Record<string, number>)) {
        byName[name] = infl[idx] ?? 0;
      }
      console.log('  current influences:', byName);
    };

    // Prefer traversing the full model so we don't miss any morph meshes,
    // even if this.meshes was not populated as expected.
    if (this.model) {
      let i = 0;
      this.model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        seen.add(mesh);
        processMesh(mesh, i++);
      });
    } else {
      console.warn('[EngineThree.logShapeKeys] No model loaded yet (this.model is null).');
    }

    // Also include any meshes tracked in this.meshes that weren't reached via model traversal
    if (this.meshes && this.meshes.length) {
      this.meshes.forEach((mesh, idx) => {
        if (seen.has(mesh)) return;
        processMesh(mesh, idx);
      });
    } else {
      console.warn('[EngineThree.logShapeKeys] this.meshes is empty.');
    }

    console.log('[EngineThree.logShapeKeys] --- END ---');
  }

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

  /** Check if renderer is ready for skybox/tone mapping controls */
  isRendererReady = (): boolean => {
    return this.renderer !== null;
  };
}

function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
