import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraDOMControls } from './DOMControls';
import { AnnotationMarkers } from './AnnotationMarkers';
import type {
  AnnotationCameraControllerConfig,
  CharacterAnnotationConfig,
  Annotation,
  CameraState,
  FocusPosition,
  AnnotationChangeCallback,
} from './types';

/**
 * Default configuration values
 */
const DEFAULTS = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 0.5,
  maxDistance: 10,
  transitionDuration: 800,
  zoomPaddingFactor: 1.5,
  closeUpPaddingFactor: 1.2,
  fullBodyPaddingFactor: 2.0,
  showDOMControls: true,
};

/**
 * AnnotationCameraController - A unified camera controller for character viewers
 *
 * Features:
 * - OrbitControls wrapper for smooth camera interaction
 * - Focus on specific bones, meshes, or named annotations
 * - Smart bounding box calculation with size-based padding
 * - Smooth animated transitions between views
 * - Self-contained DOM controls for annotation selection
 *
 * Designed for future NPM packaging - no React dependencies.
 */
export class AnnotationCameraController {
  // Public readonly properties
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly scene: THREE.Scene;

  // Configuration
  private config: Required<
    Pick<
      AnnotationCameraControllerConfig,
      | 'enableDamping'
      | 'dampingFactor'
      | 'minDistance'
      | 'maxDistance'
      | 'transitionDuration'
      | 'zoomPaddingFactor'
      | 'closeUpPaddingFactor'
      | 'fullBodyPaddingFactor'
      | 'showDOMControls'
    >
  >;
  private controlsContainer: HTMLElement;

  // State
  private model: THREE.Object3D | null = null;
  private annotations: Annotation[] = [];
  private currentAnnotation: string | null = null;
  private characterConfig: CharacterAnnotationConfig | null = null;

  // Animation
  private animationId: number | null = null;
  private isAnimating = false;

  // DOM Controls
  private domControls: CameraDOMControls | null = null;

  // 3D Markers
  private markers: AnnotationMarkers | null = null;
  private domElement: HTMLElement;

  // Callbacks
  private onAnnotationChangeCallbacks: AnnotationChangeCallback[] = [];

  constructor(inputConfig: AnnotationCameraControllerConfig) {
    this.camera = inputConfig.camera;
    this.scene = inputConfig.scene;
    this.domElement = inputConfig.domElement;
    this.controlsContainer = inputConfig.controlsContainer || inputConfig.domElement;

    // Merge config with defaults
    this.config = {
      enableDamping: inputConfig.enableDamping ?? DEFAULTS.enableDamping,
      dampingFactor: inputConfig.dampingFactor ?? DEFAULTS.dampingFactor,
      minDistance: inputConfig.minDistance ?? DEFAULTS.minDistance,
      maxDistance: inputConfig.maxDistance ?? DEFAULTS.maxDistance,
      transitionDuration: inputConfig.transitionDuration ?? DEFAULTS.transitionDuration,
      zoomPaddingFactor: inputConfig.zoomPaddingFactor ?? DEFAULTS.zoomPaddingFactor,
      closeUpPaddingFactor: inputConfig.closeUpPaddingFactor ?? DEFAULTS.closeUpPaddingFactor,
      fullBodyPaddingFactor: inputConfig.fullBodyPaddingFactor ?? DEFAULTS.fullBodyPaddingFactor,
      showDOMControls: inputConfig.showDOMControls ?? DEFAULTS.showDOMControls,
    };

    // Set initial camera position before creating OrbitControls
    // This ensures camera isn't at origin (inside model)
    this.camera.position.set(0, 1, 3);

    // Create OrbitControls
    this.controls = new OrbitControls(this.camera, inputConfig.domElement);
    this.controls.enableDamping = this.config.enableDamping;
    this.controls.dampingFactor = this.config.dampingFactor;
    this.controls.minDistance = this.config.minDistance;
    this.controls.maxDistance = this.config.maxDistance;

    // Set initial target to roughly character center height
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    console.log(`[Camera] Initialized at position=(${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z}), target=(${this.controls.target.x}, ${this.controls.target.y}, ${this.controls.target.z}), aspect=${this.camera.aspect}`);

    // Initialize DOM controls if enabled
    if (this.config.showDOMControls) {
      this.initDOMControls();
    }

    // Initialize 3D markers
    this.markers = new AnnotationMarkers({
      scene: this.scene,
      camera: this.camera,
      domElement: this.domElement,
      onSelect: (name) => this.focusAnnotation(name),
    });
  }

  // ====== CORE PUBLIC METHODS ======

  /**
   * Set the model to use for bone/mesh lookups
   * Must be called after model loads
   */
  setModel(model: THREE.Object3D): void {
    this.model = model;
    this.markers?.setModel(model);

    // Force update world matrices
    this.scene.updateMatrixWorld(true);

    // Calculate model bounding box to understand its position/size
    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    console.log(`[Camera] Model set. Bounding box: min=(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) max=(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`);
    console.log(`[Camera] Model center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);
    console.log(`[Camera] Model world position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
  }

  /**
   * Load annotation config for a character
   */
  loadAnnotations(config: CharacterAnnotationConfig): void {
    this.characterConfig = config;
    this.annotations = config.annotations;
    this.updateDOMControls();

    // Load markers
    this.markers?.loadAnnotations(config);

    // Focus default annotation if specified (immediate, no animation)
    if (config.defaultAnnotation) {
      this.focusAnnotation(config.defaultAnnotation, 0);
    }
  }

  /**
   * Focus on a named annotation from the loaded config
   */
  async focusAnnotation(name: string, duration?: number): Promise<void> {
    console.log(`[Camera] focusAnnotation called: "${name}", duration=${duration}, camera.aspect=${this.camera.aspect.toFixed(2)}`);

    const annotation = this.annotations.find((a) => a.name === name);
    if (!annotation) {
      console.warn(`[AnnotationCameraController] Annotation "${name}" not found`);
      return;
    }

    const objects = this.resolveAnnotationObjects(annotation);
    if (objects.length === 0) {
      console.warn(`[AnnotationCameraController] No objects found for annotation "${name}"`);
      return;
    }

    this.currentAnnotation = name;
    this.notifyAnnotationChange(name);

    const focusPos = this.calculateFocusPosition(objects, annotation.paddingFactor);

    // Apply camera offset if specified
    if (annotation.cameraOffset) {
      if (annotation.cameraOffset.x) focusPos.position.x += annotation.cameraOffset.x;
      if (annotation.cameraOffset.y) focusPos.position.y += annotation.cameraOffset.y;
      if (annotation.cameraOffset.z) focusPos.position.z += annotation.cameraOffset.z;
    }

    console.log(`[Camera] focusAnnotation "${name}": camera pos=(${focusPos.position.x.toFixed(3)}, ${focusPos.position.y.toFixed(3)}, ${focusPos.position.z.toFixed(3)}), target=(${focusPos.target.x.toFixed(3)}, ${focusPos.target.y.toFixed(3)}, ${focusPos.target.z.toFixed(3)})`);

    await this.animateCamera(focusPos.position, focusPos.target, duration ?? this.config.transitionDuration);
  }

  /**
   * Focus on specific bones by name
   */
  async focusBones(boneNames: string[], duration?: number): Promise<void> {
    const objects = this.findObjectsByNames(boneNames, 'Bone');
    if (objects.length === 0) {
      console.warn(`[AnnotationCameraController] No bones found: ${boneNames.join(', ')}`);
      return;
    }

    const focusPos = this.calculateFocusPosition(objects);
    await this.animateCamera(focusPos.position, focusPos.target, duration ?? this.config.transitionDuration);
  }

  /**
   * Focus on specific meshes by name
   */
  async focusMeshes(meshNames: string[], duration?: number): Promise<void> {
    const objects = this.findObjectsByNames(meshNames, 'Mesh');
    if (objects.length === 0) {
      console.warn(`[AnnotationCameraController] No meshes found: ${meshNames.join(', ')}`);
      return;
    }

    const focusPos = this.calculateFocusPosition(objects);
    await this.animateCamera(focusPos.position, focusPos.target, duration ?? this.config.transitionDuration);
  }

  /**
   * Focus on the full body (entire model bounding box)
   */
  async focusFullBody(duration?: number): Promise<void> {
    if (!this.model) {
      console.warn('[AnnotationCameraController] No model set');
      return;
    }

    const focusPos = this.calculateFocusPosition([this.model], this.config.fullBodyPaddingFactor);
    await this.animateCamera(focusPos.position, focusPos.target, duration ?? this.config.transitionDuration);
  }

  /**
   * Focus on arbitrary objects
   */
  async focusObjects(objects: THREE.Object3D[], duration?: number): Promise<void> {
    if (objects.length === 0) {
      console.warn('[AnnotationCameraController] No objects provided');
      return;
    }

    const focusPos = this.calculateFocusPosition(objects);
    await this.animateCamera(focusPos.position, focusPos.target, duration ?? this.config.transitionDuration);
  }

  // ====== CONFIG/STATE METHODS ======

  /**
   * Get list of available annotation names
   */
  getAnnotationNames(): string[] {
    return this.annotations.map((a) => a.name);
  }

  /**
   * Get current annotation name
   */
  getCurrentAnnotation(): string | null {
    return this.currentAnnotation;
  }

  /**
   * Get loaded character config
   */
  getCharacterConfig(): CharacterAnnotationConfig | null {
    return this.characterConfig;
  }

  /**
   * Get current camera state
   */
  getCameraState(): CameraState {
    return {
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.controls.target.x, this.controls.target.y, this.controls.target.z],
    };
  }

  /**
   * Set camera state directly (no animation)
   */
  setCameraState(state: CameraState): void {
    this.camera.position.set(...state.position);
    this.controls.target.set(...state.target);
    this.controls.update();
  }

  /**
   * Animate to camera state
   */
  async animateToCameraState(state: CameraState, duration?: number): Promise<void> {
    const targetPosition = new THREE.Vector3(...state.position);
    const targetLookAt = new THREE.Vector3(...state.target);
    await this.animateCamera(targetPosition, targetLookAt, duration ?? this.config.transitionDuration);
  }

  // ====== DOM CONTROLS ======

  /**
   * Show/hide built-in DOM controls
   */
  setDOMControlsVisible(visible: boolean): void {
    this.domControls?.setVisible(visible);
  }

  /**
   * Update DOM controls to reflect current annotations
   */
  updateDOMControls(): void {
    if (!this.domControls) return;
    this.domControls.updateAnnotations(this.getAnnotationNames(), this.currentAnnotation ?? undefined);
  }

  // ====== CALLBACKS ======

  /**
   * Register callback for annotation changes
   */
  onAnnotationChange(callback: AnnotationChangeCallback): () => void {
    this.onAnnotationChangeCallbacks.push(callback);
    return () => {
      const index = this.onAnnotationChangeCallbacks.indexOf(callback);
      if (index > -1) this.onAnnotationChangeCallbacks.splice(index, 1);
    };
  }

  // ====== LIFECYCLE ======

  /**
   * Update loop - call in animation frame
   */
  update(): void {
    this.controls.update();
    this.markers?.update();
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    // Cancel any running animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Dispose DOM controls
    this.domControls?.dispose();
    this.domControls = null;

    // Dispose markers
    this.markers?.dispose();
    this.markers = null;

    // Dispose OrbitControls
    this.controls.dispose();

    // Clear callbacks
    this.onAnnotationChangeCallbacks = [];
  }

  // ====== PRIVATE METHODS ======

  private initDOMControls(): void {
    this.domControls = new CameraDOMControls({
      container: this.controlsContainer,
      annotations: this.getAnnotationNames(),
      currentAnnotation: this.currentAnnotation ?? undefined,
      onAnnotationSelect: (name) => this.focusAnnotation(name),
    });
  }

  private notifyAnnotationChange(name: string): void {
    this.onAnnotationChangeCallbacks.forEach((cb) => cb(name));
    this.domControls?.setCurrentAnnotation(name);
    this.markers?.setCurrentAnnotation(name);
  }

  /**
   * Resolve annotation definition to actual Object3D instances
   */
  private resolveAnnotationObjects(annotation: Annotation): THREE.Object3D[] {
    if (!this.model) return [];

    const objects: THREE.Object3D[] = [];

    // Handle special '*' case for all objects - collect all meshes
    if (annotation.objects?.includes('*')) {
      const meshes: THREE.Object3D[] = [];
      this.model.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          meshes.push(obj);
        }
      });
      console.log(`[Camera] Found ${meshes.length} meshes for full body`);
      return meshes.length > 0 ? meshes : [this.model];
    }

    // Find bones
    if (annotation.bones) {
      objects.push(...this.findObjectsByNames(annotation.bones, 'Bone'));
    }

    // Find meshes
    if (annotation.meshes) {
      objects.push(...this.findObjectsByNames(annotation.meshes, 'Mesh'));
    }

    // Find any objects
    if (annotation.objects) {
      objects.push(...this.findObjectsByNames(annotation.objects));
    }

    return objects;
  }

  /**
   * Find objects by name with optional type filter
   */
  private findObjectsByNames(names: string[], type?: string): THREE.Object3D[] {
    if (!this.model) return [];

    const found: THREE.Object3D[] = [];
    const nameSet = new Set(names);

    this.model.traverse((obj) => {
      if (nameSet.has(obj.name)) {
        if (!type || obj.type === type) {
          found.push(obj);
        }
      }
    });

    return found;
  }

  /**
   * Calculate optimal camera position to frame objects
   */
  private calculateFocusPosition(objects: THREE.Object3D[], overridePadding?: number): FocusPosition {
    // Force update world matrices on entire scene before computing bounding box
    this.scene.updateMatrixWorld(true);

    // Compute combined bounding box
    const box = new THREE.Box3();

    console.log(`[Camera] Calculating focus for ${objects.length} objects:`, objects.map(o => `${o.name}(${o.type})`));

    for (const obj of objects) {
      // For bones, we need to get their world position directly (bones have no geometry)
      if (obj.type === 'Bone') {
        const worldPos = new THREE.Vector3();
        obj.getWorldPosition(worldPos);
        // Expand box with a small sphere around the bone position
        box.expandByPoint(worldPos);
        console.log(`[Camera] Bone ${obj.name} at:`, worldPos.x.toFixed(3), worldPos.y.toFixed(3), worldPos.z.toFixed(3));
      } else {
        // For meshes and other objects, use expandByObject
        const objBox = new THREE.Box3().setFromObject(obj);
        if (!objBox.isEmpty()) {
          box.union(objBox);
          console.log(`[Camera] Object ${obj.name} box: min=(${objBox.min.x.toFixed(2)}, ${objBox.min.y.toFixed(2)}, ${objBox.min.z.toFixed(2)}) max=(${objBox.max.x.toFixed(2)}, ${objBox.max.y.toFixed(2)}, ${objBox.max.z.toFixed(2)})`);
        }
      }
    }

    // Check if box is valid
    if (box.isEmpty()) {
      console.warn('[Camera] Bounding box is empty! Falling back to default view');
      return {
        position: new THREE.Vector3(0, 0.8, 2.5),
        target: new THREE.Vector3(0, 0.8, 0),
        distance: 2.5,
      };
    }

    // Get center and size
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    console.log(`[Camera] Final box: min=(${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) max=(${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`);
    console.log(`[Camera] Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), Size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);

    // Get camera aspect ratio
    const aspect = this.camera.aspect;
    const fovRad = this.camera.fov * (Math.PI / 180);

    // Calculate horizontal FOV from vertical FOV
    const fovH = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);

    // Calculate distance needed to fit height and width in view
    // Add some buffer to ensure we don't clip
    const distanceForHeight = size.y > 0 ? (size.y / 2) / Math.tan(fovRad / 2) : 1;
    const distanceForWidth = size.x > 0 ? (size.x / 2) / Math.tan(fovH / 2) : 1;

    // Use the larger distance to ensure everything fits
    const baseDistance = Math.max(distanceForHeight, distanceForWidth, 0.5);

    // Apply padding factor
    const padding = overridePadding ?? this.getPaddingFactor(Math.max(size.x, size.y, size.z));
    const distance = Math.max(baseDistance * padding, this.config.minDistance);

    // Position camera directly in front of center, looking at center
    const position = new THREE.Vector3(center.x, center.y, center.z + distance);

    console.log(`[Camera] Framing result: position=(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), target=(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), distance=${distance.toFixed(2)}`);

    return { position, target: center, distance };
  }

  /**
   * Get appropriate padding factor based on target size
   */
  private getPaddingFactor(size: number): number {
    // Small targets (eyes, mouth) get tighter framing
    if (size < 0.3) return this.config.closeUpPaddingFactor;
    // Full body gets wider framing
    if (size > 1.5) return this.config.fullBodyPaddingFactor;
    // Default padding
    return this.config.zoomPaddingFactor;
  }

  /**
   * Animate camera to target position with smooth easing
   */
  private animateCamera(
    targetPosition: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    duration: number
  ): Promise<void> {
    return new Promise((resolve) => {
      // Cancel any existing animation
      if (this.animationId !== null) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      // Skip animation if duration is 0
      if (duration <= 0) {
        this.camera.position.copy(targetPosition);
        this.controls.target.copy(targetLookAt);

        // Force camera to look at target - OrbitControls.update() doesn't always
        // properly orient the camera when position/target are set programmatically
        this.camera.lookAt(targetLookAt);
        this.controls.update();

        console.log(`[Camera] Instant move to position=(${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}), target=(${targetLookAt.x.toFixed(2)}, ${targetLookAt.y.toFixed(2)}, ${targetLookAt.z.toFixed(2)})`);
        console.log(`[Camera] After update - camera.position=(${this.camera.position.x.toFixed(2)}, ${this.camera.position.y.toFixed(2)}, ${this.camera.position.z.toFixed(2)})`);
        resolve();
        return;
      }

      const startPosition = this.camera.position.clone();
      const startTarget = this.controls.target.clone();
      const startTime = performance.now();

      this.isAnimating = true;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Ease-out cubic for smooth deceleration
        const ease = 1 - Math.pow(1 - t, 3);

        // Interpolate position and target
        this.camera.position.lerpVectors(startPosition, targetPosition, ease);
        this.controls.target.lerpVectors(startTarget, targetLookAt, ease);
        this.controls.update();

        if (t < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.animationId = null;
          this.isAnimating = false;
          // Final update - OrbitControls handles camera orientation
          this.controls.update();
          console.log(`[Camera] Animation complete. Camera at (${this.camera.position.x.toFixed(3)}, ${this.camera.position.y.toFixed(3)}, ${this.camera.position.z.toFixed(3)}), controls.target=(${this.controls.target.x.toFixed(3)}, ${this.controls.target.y.toFixed(3)}, ${this.controls.target.z.toFixed(3)})`);
          resolve();
        }
      };

      this.animationId = requestAnimationFrame(animate);
    });
  }
}
