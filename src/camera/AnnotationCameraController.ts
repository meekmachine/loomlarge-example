import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraDOMControls } from './DOMControls';
import { Annotation3DMarkers } from './Annotation3DMarkers';
import { AnnotationHTMLMarkers } from './AnnotationHTMLMarkers';
import type {
  AnnotationCameraControllerConfig,
  CharacterAnnotationConfig,
  Annotation,
  CameraState,
  FocusPosition,
  AnnotationChangeCallback,
  MarkerStyle,
} from './types';

/** Common interface for marker implementations */
interface AnnotationMarkers {
  setModel(model: THREE.Object3D): void;
  loadAnnotations(config: CharacterAnnotationConfig): void;
  setCurrentAnnotation(name: string | null): void;
  update(): void;
  setVisible(visible: boolean): void;
  clear(): void;
  dispose(): void;
}

/**
 * Default configuration values
 */
const DEFAULTS = {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 0.5,
  maxDistance: 10,
  transitionDuration: 1400, // Slower, more graceful camera transitions
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

  // Markers (can be 3D or HTML style)
  private markers: AnnotationMarkers | null = null;
  private currentMarkerStyle: MarkerStyle = '3d';
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

    // Markers will be initialized when loadAnnotations is called
    // based on the character's markerStyle preference
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

    // Determine marker style (default to '3d' if not specified)
    const markerStyle = config.markerStyle ?? '3d';

    // If marker style changed or markers don't exist, recreate them
    if (this.currentMarkerStyle !== markerStyle || !this.markers) {
      // Dispose existing markers
      this.markers?.dispose();

      // Create appropriate marker type
      if (markerStyle === 'html') {
        this.markers = new AnnotationHTMLMarkers({
          scene: this.scene,
          camera: this.camera,
          domElement: this.domElement,
          onSelect: (name: string) => this.focusAnnotation(name),
        });
      } else {
        this.markers = new Annotation3DMarkers({
          scene: this.scene,
          camera: this.camera,
          domElement: this.domElement,
          onSelect: (name: string) => this.focusAnnotation(name),
        });
      }

      this.currentMarkerStyle = markerStyle;

      // Set model if already available
      if (this.model) {
        this.markers.setModel(this.model);
      }
    }

    // Load annotations into markers
    this.markers.loadAnnotations(config);

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

    const focusPos = this.calculateFocusPosition(objects, annotation.paddingFactor, annotation.cameraAngle);

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

  // ====== MARKERS ======

  /**
   * Show/hide annotation markers
   */
  setMarkersVisible(visible: boolean): void {
    this.markers?.setVisible(visible);
  }

  /**
   * Get current markers visibility state
   */
  getMarkersVisible(): boolean {
    // Default to true if no markers exist yet
    return this.markers ? true : true;
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
   * Get bounding box of vertices influenced by a bone from skinned meshes
   * This finds the actual geometry size around a bone for proper framing
   *
   * For skinned meshes, we need to compute the actual skinned vertex positions,
   * not just the bind pose positions.
   */
  private getBoneInfluencedBoundingBox(bone: THREE.Bone): THREE.Box3 | null {
    if (!this.model) return null;

    const box = new THREE.Box3();

    // Find the bone index in any skeleton
    let boneIndex = -1;
    let skeleton: THREE.Skeleton | null = null;

    this.model.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh && mesh.skeleton) {
        const idx = mesh.skeleton.bones.indexOf(bone);
        if (idx !== -1) {
          boneIndex = idx;
          skeleton = mesh.skeleton;
        }
      }
    });

    if (boneIndex === -1 || !skeleton) {
      return null;
    }

    // Find all skinned meshes and collect vertices influenced by this bone
    const tempVertex = new THREE.Vector3();
    const skinned = new THREE.Vector3();
    const tempMatrix = new THREE.Matrix4();

    this.model.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || mesh.skeleton !== skeleton) return;

      // Ensure bone matrices are up to date
      mesh.skeleton.update();

      const geometry = mesh.geometry;
      const positionAttr = geometry.getAttribute('position');
      const skinIndexAttr = geometry.getAttribute('skinIndex');
      const skinWeightAttr = geometry.getAttribute('skinWeight');

      if (!positionAttr || !skinIndexAttr || !skinWeightAttr) return;

      // Get the bind matrix inverse for skinning calculation
      const bindMatrixInverse = mesh.bindMatrixInverse;

      // Check each vertex
      for (let i = 0; i < positionAttr.count; i++) {
        // Check if this vertex is influenced by our bone (weight > 0.1)
        let isInfluenced = false;
        for (let j = 0; j < 4; j++) {
          const skinIdx = skinIndexAttr.getComponent(i, j);
          const weight = skinWeightAttr.getComponent(i, j);
          if (skinIdx === boneIndex && weight > 0.1) {
            isInfluenced = true;
            break;
          }
        }

        if (isInfluenced) {
          // Get the vertex position in local space
          tempVertex.fromBufferAttribute(positionAttr, i);

          // Apply skinning transformation
          // skinned = sum(weight_i * boneMatrix_i * bindMatrixInverse * vertex)
          skinned.set(0, 0, 0);

          for (let j = 0; j < 4; j++) {
            const skinIdx = skinIndexAttr.getComponent(i, j);
            const weight = skinWeightAttr.getComponent(i, j);

            if (weight > 0) {
              // Get bone matrix (already includes world transform)
              const boneMatrix = mesh.skeleton.boneMatrices;
              tempMatrix.fromArray(boneMatrix, skinIdx * 16);

              // Transform vertex: boneMatrix * bindMatrixInverse * vertex
              const transformed = tempVertex.clone();
              transformed.applyMatrix4(bindMatrixInverse);
              transformed.applyMatrix4(tempMatrix);
              transformed.multiplyScalar(weight);

              skinned.add(transformed);
            }
          }

          // Apply mesh world matrix to get final world position
          skinned.applyMatrix4(mesh.matrixWorld);
          box.expandByPoint(skinned);
        }
      }
    });

    return box.isEmpty() ? null : box;
  }

  /**
   * Calculate optimal camera position to frame objects
   * @param objects - Objects to focus on
   * @param overridePadding - Optional padding factor override
   * @param cameraAngle - Camera angle in degrees around Y axis (0 = front, 180 = back)
   */
  private calculateFocusPosition(objects: THREE.Object3D[], overridePadding?: number, cameraAngle?: number): FocusPosition {
    // Force update world matrices on entire scene before computing bounding box
    this.scene.updateMatrixWorld(true);

    // Compute combined bounding box
    const box = new THREE.Box3();

    console.log(`[Camera] Calculating focus for ${objects.length} objects:`, objects.map(o => `${o.name}(${o.type})`));

    for (const obj of objects) {
      // For bones, find the geometry influenced by this bone from skinned meshes
      if (obj.type === 'Bone') {
        const bone = obj as THREE.Bone;
        const worldPos = new THREE.Vector3();
        bone.getWorldPosition(worldPos);

        // Find skinned meshes and get vertices influenced by this bone
        const boneBox = this.getBoneInfluencedBoundingBox(bone);
        if (boneBox && !boneBox.isEmpty()) {
          box.union(boneBox);
          const boneSize = new THREE.Vector3();
          boneBox.getSize(boneSize);
          console.log(`[Camera] Bone ${obj.name} influenced geometry box: size=(${boneSize.x.toFixed(3)}, ${boneSize.y.toFixed(3)}, ${boneSize.z.toFixed(3)})`);
        } else {
          // Fallback: just use the bone position
          box.expandByPoint(worldPos);
          console.log(`[Camera] Bone ${obj.name} at:`, worldPos.x.toFixed(3), worldPos.y.toFixed(3), worldPos.z.toFixed(3));
        }
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

    // Determine the effective camera angle
    // If no explicit angle provided, calculate one based on target offset from model center
    let effectiveAngle = cameraAngle ?? 0;

    if (this.model && cameraAngle === undefined) {
      const modelBox = new THREE.Box3().setFromObject(this.model);
      const modelCenter = new THREE.Vector3();
      const modelSize = new THREE.Vector3();
      modelBox.getCenter(modelCenter);
      modelBox.getSize(modelSize);

      // Calculate horizontal offset from model center (X axis)
      const horizontalOffset = center.x - modelCenter.x;
      const maxSize = Math.max(size.x, size.y, size.z);

      // For small/medium targets that are off-center, auto-rotate camera towards them
      // This creates a more natural viewing angle for things like eyes
      // Threshold: targets smaller than ~20cm that are noticeably off-center
      if (maxSize < 0.25 && Math.abs(horizontalOffset) > 0.01) {
        // Calculate angle based on offset - targets further to the side get more rotation
        // Use atan to get a natural angle that points towards the target
        // Scale factor determines how aggressively camera rotates (higher = more rotation)
        const scaleFactor = 2.5; // Multiplier for more pronounced rotation
        const autoAngle = Math.atan2(horizontalOffset * scaleFactor, modelSize.z / 2) * (180 / Math.PI);
        effectiveAngle = autoAngle;
        console.log(`[Camera] Auto-angle for off-center target: offset=${horizontalOffset.toFixed(3)}, size=${maxSize.toFixed(3)}, angle=${effectiveAngle.toFixed(1)}°`);
      }
    }

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
    let distance = Math.max(baseDistance * padding, this.config.minDistance);

    // For angled views, ensure camera doesn't end up inside the model
    // Calculate the model's bounding box to get its full extent
    const angleRad = (effectiveAngle * Math.PI) / 180;
    if (this.model && effectiveAngle !== 0) {
      const modelBox = new THREE.Box3().setFromObject(this.model);
      const modelCenter = new THREE.Vector3();
      const modelSize = new THREE.Vector3();
      modelBox.getCenter(modelCenter);
      modelBox.getSize(modelSize);

      // Calculate the distance from target center to the edge of the model in the camera direction
      // This ensures the camera clears the model body
      const cosAngle = Math.abs(Math.cos(angleRad));
      const sinAngle = Math.abs(Math.sin(angleRad));
      // How far the model extends in the camera's approach direction
      const modelDepthInDirection = (modelSize.z / 2) * cosAngle + (modelSize.x / 2) * sinAngle;

      // Also account for offset from model center to target center
      const targetToModelCenter = new THREE.Vector3().subVectors(modelCenter, center);
      const offsetInCameraDir = Math.abs(targetToModelCenter.x * Math.sin(angleRad) + targetToModelCenter.z * Math.cos(angleRad));

      // Minimum safe distance = model extent + offset + buffer
      const minSafeDistance = modelDepthInDirection + offsetInCameraDir + 0.3;

      console.log(`[Camera] Side view safety: modelDepth=${modelDepthInDirection.toFixed(2)}, offset=${offsetInCameraDir.toFixed(2)}, minSafe=${minSafeDistance.toFixed(2)}`);

      distance = Math.max(distance, minSafeDistance * padding);
    }

    // Position camera at the specified angle around the target
    // Default angle is 0 (front), 180 = back, 90 = right side, 270 = left side
    const position = new THREE.Vector3(
      center.x + Math.sin(angleRad) * distance,
      center.y,
      center.z + Math.cos(angleRad) * distance
    );

    console.log(`[Camera] Framing result: position=(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}), target=(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), distance=${distance.toFixed(2)}, angle=${effectiveAngle.toFixed(1)}°`);

    return { position, target: center, distance };
  }

  /**
   * Get appropriate padding factor based on target size
   * Smaller targets get tighter framing for better detail visibility
   */
  private getPaddingFactor(size: number): number {
    // Very small targets (individual eyes) get extra tight framing
    if (size < 0.1) return this.config.closeUpPaddingFactor * 0.7;
    // Small targets (eyes, mouth) get tighter framing
    if (size < 0.3) return this.config.closeUpPaddingFactor;
    // Full body gets wider framing
    if (size > 1.5) return this.config.fullBodyPaddingFactor;
    // Default padding
    return this.config.zoomPaddingFactor;
  }

  /**
   * Convert Cartesian position to spherical coordinates relative to a center point
   */
  private toSpherical(position: THREE.Vector3, center: THREE.Vector3): { radius: number; theta: number; phi: number } {
    const offset = position.clone().sub(center);
    const radius = offset.length();
    // theta: angle around Y axis (azimuth), phi: angle from Y axis (polar)
    const theta = Math.atan2(offset.x, offset.z);
    const phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));
    return { radius, theta, phi };
  }

  /**
   * Convert spherical coordinates to Cartesian position relative to a center point
   */
  private fromSpherical(spherical: { radius: number; theta: number; phi: number }, center: THREE.Vector3): THREE.Vector3 {
    const { radius, theta, phi } = spherical;
    return new THREE.Vector3(
      center.x + radius * Math.sin(phi) * Math.sin(theta),
      center.y + radius * Math.cos(phi),
      center.z + radius * Math.sin(phi) * Math.cos(theta)
    );
  }

  /**
   * Animate camera to target position with smooth easing
   * Uses spherical interpolation to orbit around the target rather than moving in a straight line
   * When significant rotation is needed, pulls back to a wider arc to avoid passing through the model
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

      // Convert to spherical coordinates for smooth orbital animation
      // Use the interpolated target as the center for spherical interpolation
      const startSpherical = this.toSpherical(startPosition, startTarget);
      const endSpherical = this.toSpherical(targetPosition, targetLookAt);

      // Handle theta wrap-around: choose the shortest path
      let deltaTheta = endSpherical.theta - startSpherical.theta;
      if (deltaTheta > Math.PI) deltaTheta -= 2 * Math.PI;
      if (deltaTheta < -Math.PI) deltaTheta += 2 * Math.PI;

      // Calculate pullback amount based on rotation, target movement, AND zoom change
      // This ensures smooth arcs for ALL transitions, even between similar zoom levels
      const rotationMagnitude = Math.abs(deltaTheta) / Math.PI; // 0 to 1 (0 = no rotation, 1 = 180°)

      // Consider how far the target moves - important for eye-to-eye transitions
      const targetMovement = startTarget.distanceTo(targetLookAt);
      const maxRadius = Math.max(startSpherical.radius, endSpherical.radius);
      // Normalize target movement relative to camera distance, with higher sensitivity
      const movementMagnitude = Math.min(targetMovement / (maxRadius * 0.3), 1);

      // Consider zoom/radius change
      const radiusChange = Math.abs(endSpherical.radius - startSpherical.radius);
      const zoomMagnitude = Math.min(radiusChange / maxRadius, 1);

      // Combined magnitude: take the maximum effect, with a minimum baseline
      // This ensures we ALWAYS have some pullback arc, even for small movements
      const baseMagnitude = Math.max(rotationMagnitude, movementMagnitude, zoomMagnitude * 0.5);
      // Ensure minimum pullback of 0.3 for any animation (graceful arc)
      const combinedMagnitude = Math.max(baseMagnitude, 0.3);

      // Pull back proportionally: more movement/rotation = bigger arc
      // Increased multiplier (2.0) for more dramatic pullback
      const pullbackFactor = 1 + combinedMagnitude * 2.0;
      const arcRadius = maxRadius * pullbackFactor;

      console.log(`[Camera] Animation: deltaTheta=${(deltaTheta * 180 / Math.PI).toFixed(1)}°, targetMove=${targetMovement.toFixed(3)}, rotMag=${rotationMagnitude.toFixed(2)}, moveMag=${movementMagnitude.toFixed(2)}, combinedMag=${combinedMagnitude.toFixed(2)}, pullback=${pullbackFactor.toFixed(2)}`);

      this.isAnimating = true;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Ease-in-out for smooth acceleration and deceleration
        // This feels more graceful than ease-out alone for orbital motion
        const ease = t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Interpolate the look-at target
        const currentTarget = new THREE.Vector3().lerpVectors(startTarget, targetLookAt, ease);
        this.controls.target.copy(currentTarget);

        // Calculate radius with pullback arc
        // Use a sine curve to smoothly pull back in the middle of the animation
        // sin(π * t) peaks at t=0.5, giving us the arc shape
        const arcInfluence = Math.sin(Math.PI * t);
        const baseRadius = startSpherical.radius + (endSpherical.radius - startSpherical.radius) * ease;
        // Always apply the full pullback arc - this creates the "zoom out and back in" effect
        const pullbackAmount = (arcRadius - baseRadius) * arcInfluence;
        const currentRadius = baseRadius + pullbackAmount;

        // Interpolate spherical coordinates for orbital motion
        const currentSpherical = {
          radius: currentRadius,
          theta: startSpherical.theta + deltaTheta * ease,
          phi: startSpherical.phi + (endSpherical.phi - startSpherical.phi) * ease,
        };

        // Convert back to Cartesian and set camera position
        const currentPosition = this.fromSpherical(currentSpherical, currentTarget);
        this.camera.position.copy(currentPosition);
        this.controls.update();

        if (t < 1) {
          this.animationId = requestAnimationFrame(animate);
        } else {
          this.animationId = null;
          this.isAnimating = false;
          // Final update - ensure exact final position
          this.camera.position.copy(targetPosition);
          this.controls.target.copy(targetLookAt);
          this.controls.update();
          console.log(`[Camera] Animation complete. Camera at (${this.camera.position.x.toFixed(3)}, ${this.camera.position.y.toFixed(3)}, ${this.camera.position.z.toFixed(3)}), controls.target=(${this.controls.target.x.toFixed(3)}, ${this.controls.target.y.toFixed(3)}, ${this.controls.target.z.toFixed(3)})`);
          resolve();
        }
      };

      this.animationId = requestAnimationFrame(animate);
    });
  }
}
