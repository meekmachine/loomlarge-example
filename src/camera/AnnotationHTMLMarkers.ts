import * as THREE from 'three';
import type { Annotation, CharacterAnnotationConfig } from './types';

/**
 * Simple HTML overlay markers with numbered dots.
 *
 * These markers sit directly over the annotation targets without lines or labels -
 * just numbered circles that match the annotation index. Simple and clean.
 */
export class AnnotationHTMLMarkers {
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private model: THREE.Object3D | null = null;
  private annotations: Annotation[] = [];
  private currentAnnotation: string | null = null;
  private onSelect: (name: string) => void;

  private labelsContainer: HTMLDivElement;
  private markers: Map<string, { element: HTMLDivElement; position: THREE.Vector3 }> = new Map();

  // Model bounds for visibility calculations
  private modelCenter = new THREE.Vector3();

  constructor(config: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    domElement: HTMLElement;
    onSelect: (name: string) => void;
  }) {
    this.camera = config.camera;
    this.domElement = config.domElement;
    this.onSelect = config.onSelect;

    // Create container for HTML markers
    this.labelsContainer = document.createElement('div');
    this.labelsContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    `;

    // Find parent with relative positioning
    const parent = this.domElement.parentElement;
    if (parent) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(this.labelsContainer);
    }
  }

  setModel(model: THREE.Object3D): void {
    this.model = model;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    box.getCenter(this.modelCenter);
  }

  loadAnnotations(config: CharacterAnnotationConfig): void {
    this.clear();
    this.annotations = config.annotations;

    config.annotations.forEach((annotation, index) => {
      this.createMarker(annotation, index + 1);
    });
  }

  setCurrentAnnotation(name: string | null): void {
    this.currentAnnotation = name;
    this.updateMarkerStyles();
  }

  private createMarker(annotation: Annotation, number: number): void {
    if (!this.model) return;

    const position = this.getAnnotationCenter(annotation);
    if (!position) return;

    // Create numbered dot element
    const marker = document.createElement('div');
    marker.className = 'annotation-html-marker';
    marker.dataset.annotation = annotation.name;
    marker.innerHTML = `<span>${number}</span>`;
    marker.style.cssText = `
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: pointer;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: rgba(66, 153, 225, 0.9);
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: bold;
      color: white;
      transition: all 0.15s ease;
      z-index: 100;
    `;

    // Hover effects
    marker.addEventListener('mouseenter', () => {
      marker.style.transform = 'translate(-50%, -50%) scale(1.2)';
      marker.style.background = 'rgba(99, 179, 237, 1)';
    });
    marker.addEventListener('mouseleave', () => {
      if (this.currentAnnotation !== annotation.name) {
        marker.style.transform = 'translate(-50%, -50%) scale(1)';
        marker.style.background = 'rgba(66, 153, 225, 0.9)';
      }
    });

    // Click handler
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelect(annotation.name);
    });

    this.labelsContainer.appendChild(marker);
    this.markers.set(annotation.name, { element: marker, position: position.clone() });
  }

  private getAnnotationCenter(annotation: Annotation): THREE.Vector3 | null {
    if (!this.model) return null;

    const box = new THREE.Box3();
    let hasObjects = false;

    // Handle '*' for full model
    if (annotation.objects?.includes('*')) {
      box.expandByObject(this.model);
      hasObjects = true;
    } else {
      // Find bones
      if (annotation.bones) {
        for (const boneName of annotation.bones) {
          this.model.traverse((obj) => {
            if (obj.name === boneName) {
              const worldPos = new THREE.Vector3();
              obj.getWorldPosition(worldPos);
              box.expandByPoint(worldPos);
              hasObjects = true;
            }
          });
        }
      }

      // Find meshes
      if (annotation.meshes) {
        for (const meshName of annotation.meshes) {
          this.model.traverse((obj) => {
            if (obj.name === meshName && (obj as THREE.Mesh).isMesh) {
              box.expandByObject(obj);
              hasObjects = true;
            }
          });
        }
      }
    }

    if (!hasObjects || box.isEmpty()) return null;

    const center = new THREE.Vector3();
    box.getCenter(center);

    return center;
  }

  private updateMarkerStyles(): void {
    for (const [name, { element }] of this.markers) {
      const isSelected = name === this.currentAnnotation;
      if (isSelected) {
        element.style.transform = 'translate(-50%, -50%) scale(1.3)';
        element.style.background = 'rgba(99, 179, 237, 1)';
        element.style.boxShadow = '0 0 12px rgba(66, 153, 225, 0.8)';
      } else {
        element.style.transform = 'translate(-50%, -50%) scale(1)';
        element.style.background = 'rgba(66, 153, 225, 0.9)';
        element.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
      }
    }
  }

  /**
   * Update marker positions - call in render loop
   */
  update(): void {
    if (!this.model) return;

    const rect = this.domElement.getBoundingClientRect();

    // Calculate camera viewing angle for visibility checks
    const cameraDir = new THREE.Vector3().subVectors(this.camera.position, this.modelCenter);
    const cameraAngle = Math.atan2(cameraDir.x, cameraDir.z) * (180 / Math.PI);
    const normalizedCameraAngle = ((cameraAngle % 360) + 360) % 360;

    for (const [name, { element, position }] of this.markers) {
      const annotation = this.annotations.find(a => a.name === name);

      // Update position from annotation
      if (annotation) {
        const newPos = this.getAnnotationCenter(annotation);
        if (newPos) {
          position.copy(newPos);
        }
      }

      // Project to screen
      const screenPos = position.clone().project(this.camera);

      // Check if behind camera
      if (screenPos.z > 1) {
        element.style.display = 'none';
        continue;
      }

      // Check camera angle visibility for markers with cameraAngle
      if (annotation?.cameraAngle !== undefined && annotation.cameraAngle !== 0) {
        const markerAngle = annotation.cameraAngle;
        let angleDiff = Math.abs(normalizedCameraAngle - markerAngle);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        if (angleDiff > 90) {
          element.style.display = 'none';
          continue;
        }
      }

      element.style.display = 'flex';

      // Convert to CSS coordinates
      const x = (screenPos.x * 0.5 + 0.5) * rect.width;
      const y = (-screenPos.y * 0.5 + 0.5) * rect.height;

      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  }

  setVisible(visible: boolean): void {
    this.labelsContainer.style.display = visible ? 'block' : 'none';
  }

  clear(): void {
    for (const { element } of this.markers.values()) {
      element.remove();
    }
    this.markers.clear();
  }

  dispose(): void {
    this.clear();
    this.labelsContainer.remove();
  }
}
