/**
 * Hair Service
 *
 * Service layer for managing hair customization.
 * Bridges the XState machine with LoomLargeThree for rendering updates.
 * Part of the latticework agency architecture.
 *
 * NOTE: This service is engine-agnostic - it does not import Three.js.
 * All rendering operations are delegated to LoomLargeThree.
 *
 * Physics is handled by LoomLargeThree - this service just manages config/state.
 */

import { createActor } from 'xstate';
import { hairMachine } from './hairMachine';
import { HairObjectRef, HairEvent, HairState } from './types';
import type { LoomLargeThree } from 'loom3';

// Hair physics configuration (mirrors engine config)
interface HairPhysicsConfig {
  enabled: boolean;
  stiffness: number;
  damping: number;
  inertia: number;
  gravity: number;
  responseScale: number;
  idleSwayAmount: number;
  idleSwaySpeed: number;
  windStrength: number;
  windDirectionX: number;
  windDirectionZ: number;
  windTurbulence: number;
  windFrequency: number;
}

export class HairService {
  private actor: ReturnType<typeof createActor<typeof hairMachine>>;
  private objects: HairObjectRef[] = [];
  private hairMeshNames: string[] = [];
  private subscribers: Set<(state: HairState) => void> = new Set();
  private engine: LoomLargeThree | null = null;

  // Physics config (UI state - synced to engine)
  private physicsConfig: HairPhysicsConfig = {
    enabled: false,
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
  private physicsSubscribers: Set<(config: HairPhysicsConfig) => void> = new Set();

  constructor(engine?: LoomLargeThree) {
    this.actor = createActor(hairMachine);
    this.engine = engine || null;

    // Sync physics config from engine (preserves state when UI remounts)
    if (engine) {
      const engineConfig = engine.getHairPhysicsConfig();
      const isEnabled = engine.isHairPhysicsEnabled();
      this.physicsConfig = {
        ...this.physicsConfig,
        ...engineConfig,
        enabled: isEnabled,
      };
    }

    // Subscribe to state changes
    this.actor.subscribe((snapshot) => {
      const state = snapshot.context.state;

      // Apply changes via engine
      this.applyStateToScene(state);

      // Notify subscribers
      this.subscribers.forEach((callback) => callback(state));
    });

    this.actor.start();
  }

  /**
   * Register hair/eyebrow objects from the scene
   * Delegates all Three.js operations to LoomLargeThree
   *
   * NOTE: Does NOT apply colors - preserves whatever the model has.
   * The UI will show default values but won't change the actual hair color
   * until the user makes a change.
   */
  registerObjects(objects: any[]) {
    if (!this.engine) {
      console.warn('[HairService] No engine available for registration');
      return;
    }

    // Delegate registration to engine - returns engine-agnostic metadata
    this.objects = this.engine.registerHairObjects(objects);
    this.hairMeshNames = this.objects
      .filter((obj) => obj.isMesh && !obj.isEyebrow)
      .map((obj) => obj.name);

    // DON'T reset or apply colors - let the model keep its original colors
    // The state machine starts with defaults for UI display purposes only
  }

  /**
   * Send an event to the state machine
   */
  send(event: HairEvent) {
    this.actor.send(event);
  }

  /**
   * Get current hair state
   */
  getState(): HairState {
    return this.actor.getSnapshot().context.state;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: HairState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Apply the current state to the scene via LoomLargeThree
   * No direct Three.js manipulation - all operations delegated to engine
   */
  private applyStateToScene(state: HairState) {
    if (!this.engine) return;

    this.objects.forEach((objRef) => {
      const { name, isEyebrow, isMesh } = objRef;

      // Only apply to meshes
      if (!isMesh) return;

      // Select color based on object type
      const color = isEyebrow ? state.eyebrowColor : state.hairColor;

      // Get part-specific state
      const partState = state.parts[name];

      // Build state object for engine
      const objectState = {
        color: {
          baseColor: color.baseColor,
          emissive: color.emissive,
          emissiveIntensity: color.emissiveIntensity,
        },
        outline: {
          show: state.showOutline,
          color: state.outlineColor,
          opacity: state.outlineOpacity,
        },
        visible: partState?.visible ?? true,
        scale: partState?.scale ? { x: partState.scale, y: partState.scale, z: partState.scale } : undefined,
        position: partState?.position ? { x: partState.position[0], y: partState.position[1], z: partState.position[2] } : undefined,
        isEyebrow: isEyebrow,
      };

      // Delegate all rendering to engine
      this.engine.applyHairStateToObject(name, objectState);
    });
  }

  /**
   * Animate hair using morph targets (shape keys)
   */
  animateHairMorph(morphKey: string, targetValue: number, durationMs: number = 300) {
    if (!this.engine) {
      console.warn('[HairService] No engine available for hair animation');
      return;
    }

    this.engine.transitionMorph(morphKey, targetValue, durationMs, this.hairMeshNames);
  }

  /**
   * Set hair morph instantly (no transition)
   */
  setHairMorph(morphKey: string, value: number) {
    if (!this.engine) return;

    if (this.hairMeshNames.length > 0) {
      this.engine.setMorphOnMeshes(this.hairMeshNames, morphKey, value);
    } else {
      this.engine.setMorph(morphKey, value);
    }
  }

  /**
   * Get list of available hair morphs
   */
  getAvailableHairMorphs(): string[] {
    if (!this.engine) return [];

    const hairObj = this.objects.find(obj => !obj.isEyebrow && obj.isMesh);
    if (!hairObj) return [];

    return this.engine.getHairMorphTargets(hairObj.name);
  }

  // ==========================================
  // HAIR PHYSICS - Delegates to Engine
  // ==========================================

  /**
   * Enable or disable hair physics simulation
   */
  setPhysicsEnabled(enabled: boolean) {
    this.physicsConfig.enabled = enabled;
    this.engine?.setHairPhysicsEnabled(enabled);
    this.notifyPhysicsSubscribers();
  }

  /**
   * Check if physics is enabled
   */
  isPhysicsEnabled(): boolean {
    return this.physicsConfig.enabled;
  }

  /**
   * Update physics configuration
   */
  updatePhysicsConfig(updates: Partial<HairPhysicsConfig>) {
    this.physicsConfig = { ...this.physicsConfig, ...updates };

    // Sync to engine (exclude 'enabled' - that's handled separately)
    const { enabled, ...configWithoutEnabled } = this.physicsConfig;
    this.engine?.setHairPhysicsConfig(configWithoutEnabled);

    this.notifyPhysicsSubscribers();
  }

  /**
   * Get current physics configuration
   */
  getPhysicsConfig(): HairPhysicsConfig {
    return { ...this.physicsConfig };
  }

  /**
   * Subscribe to physics config changes
   */
  subscribeToPhysics(callback: (config: HairPhysicsConfig) => void): () => void {
    this.physicsSubscribers.add(callback);
    return () => this.physicsSubscribers.delete(callback);
  }

  private notifyPhysicsSubscribers() {
    this.physicsSubscribers.forEach(cb => cb(this.getPhysicsConfig()));
  }

  /**
   * Cleanup
   * Note: Does NOT disable physics - physics state persists in the engine
   * even when the UI component unmounts
   */
  dispose() {
    // Don't disable physics here - it should persist when drawer closes
    // this.engine?.setHairPhysicsEnabled(false);

    this.actor.stop();
    this.subscribers.clear();
    this.physicsSubscribers.clear();
    this.objects = [];
    this.hairMeshNames = [];
  }
}
