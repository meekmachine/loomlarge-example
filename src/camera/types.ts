import type * as THREE from 'three';

/**
 * Single annotation definition - maps a name to geometry targets
 */
export interface Annotation {
  /** Display name for the annotation */
  name: string;
  /** CC4 bone names to focus on */
  bones?: string[];
  /** Mesh object names to focus on */
  meshes?: string[];
  /** Any object names (bones or meshes). Use ['*'] for all objects */
  objects?: string[];
  /** Override default padding factor for this annotation */
  paddingFactor?: number;
  /**
   * Camera angle in degrees around the Y axis (horizontal orbit).
   * 0 = front (default), 90 = right side, 180 = back, 270 = left side
   */
  cameraAngle?: number;
  /** Fine-tune camera position offset */
  cameraOffset?: {
    x?: number;
    y?: number;
    z?: number;
  };
}

/**
 * Per-character annotation configuration
 */
export interface CharacterAnnotationConfig {
  /** Unique identifier for the character */
  characterId: string;
  /** Display name */
  characterName: string;
  /** Path to GLB file (relative to public folder) */
  modelPath: string;
  /** Which annotation to focus on load */
  defaultAnnotation?: string;
  /** List of available annotations */
  annotations: Annotation[];
}

/**
 * Camera state for save/restore
 */
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Registry of all available characters
 */
export interface AnnotationRegistry {
  characters: CharacterAnnotationConfig[];
  defaultCharacter?: string;
}

/**
 * Configuration for AnnotationCameraController
 */
export interface AnnotationCameraControllerConfig {
  /** The Three.js camera to control */
  camera: THREE.PerspectiveCamera;
  /** DOM element for OrbitControls (usually the canvas or its container) */
  domElement: HTMLElement;
  /** The Three.js scene */
  scene: THREE.Scene;

  // OrbitControls settings
  /** Enable damping/inertia. Default: true */
  enableDamping?: boolean;
  /** Damping factor. Default: 0.05 */
  dampingFactor?: number;
  /** Minimum zoom distance. Default: 0.5 */
  minDistance?: number;
  /** Maximum zoom distance. Default: 10 */
  maxDistance?: number;

  // Animation settings
  /** Default transition duration in ms. Default: 800 */
  transitionDuration?: number;

  // Zoom padding factors (how much extra space around the target)
  /** Default padding factor. Default: 1.5 */
  zoomPaddingFactor?: number;
  /** Padding for small targets (eyes, mouth). Default: 1.2 */
  closeUpPaddingFactor?: number;
  /** Padding for full body view. Default: 2.0 */
  fullBodyPaddingFactor?: number;

  // DOM controls settings
  /** Show built-in annotation selector. Default: true */
  showDOMControls?: boolean;
  /** Container for DOM controls. Default: domElement */
  controlsContainer?: HTMLElement;
}

/**
 * Calculated focus position for camera animation
 */
export interface FocusPosition {
  position: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
}

/**
 * Callback for annotation change events
 */
export type AnnotationChangeCallback = (annotationName: string) => void;

/**
 * Callback for character change events
 */
export type CharacterChangeCallback = (config: CharacterAnnotationConfig) => void;
