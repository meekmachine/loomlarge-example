/**
 * Annotation Camera Controller
 *
 * A unified camera controller for Three.js character viewers.
 * Designed for future NPM packaging - no React dependencies.
 */

export { AnnotationCameraController } from './AnnotationCameraController';
export { CameraDOMControls } from './DOMControls';

// Export all types
export type {
  Annotation,
  CharacterAnnotationConfig,
  CameraState,
  AnnotationRegistry,
  AnnotationCameraControllerConfig,
  FocusPosition,
  AnnotationChangeCallback,
  CharacterChangeCallback,
} from './types';
