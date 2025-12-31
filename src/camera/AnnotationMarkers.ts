import * as THREE from 'three';
import type { Annotation, CharacterAnnotationConfig } from './types';

/**
 * 3D visual markers for annotations that can be clicked
 */
export class AnnotationMarkers {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private markers: Map<string, THREE.Sprite> = new Map();
  private labels: Map<string, HTMLDivElement> = new Map();
  private labelsContainer: HTMLDivElement;
  private raycaster: THREE.Raycaster;
  private onSelect: (name: string) => void;
  private model: THREE.Object3D | null = null;
  private annotations: Annotation[] = [];
  private currentAnnotation: string | null = null;

  constructor(config: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    domElement: HTMLElement;
    onSelect: (name: string) => void;
  }) {
    this.scene = config.scene;
    this.camera = config.camera;
    this.domElement = config.domElement;
    this.onSelect = config.onSelect;
    this.raycaster = new THREE.Raycaster();

    // Create container for HTML labels
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

    // Find parent with relative positioning or the canvas parent
    const parent = this.domElement.parentElement;
    if (parent) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(this.labelsContainer);
    }

    // Add click handler
    this.domElement.addEventListener('click', this.onClick);
  }

  setModel(model: THREE.Object3D): void {
    this.model = model;
  }

  loadAnnotations(config: CharacterAnnotationConfig): void {
    this.clear();
    this.annotations = config.annotations;

    for (const annotation of config.annotations) {
      this.createMarker(annotation);
    }
  }

  setCurrentAnnotation(name: string | null): void {
    this.currentAnnotation = name;
    this.updateMarkerStyles();
  }

  private createMarker(annotation: Annotation): void {
    if (!this.model) return;

    // Calculate center position for this annotation
    const position = this.getAnnotationCenter(annotation);
    if (!position) return;

    // Create HTML label (more reliable than sprites for clicking)
    const label = document.createElement('div');
    label.className = 'annotation-marker';
    label.dataset.annotation = annotation.name;
    label.innerHTML = `
      <div class="marker-dot"></div>
      <div class="marker-label">${this.formatName(annotation.name)}</div>
    `;
    label.style.cssText = `
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      color: white;
      white-space: nowrap;
      z-index: 100;
    `;

    // Style the dot
    const dot = label.querySelector('.marker-dot') as HTMLElement;
    if (dot) {
      dot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4299e1;
        box-shadow: 0 0 6px #4299e1;
      `;
    }

    // Add hover effect
    label.addEventListener('mouseenter', () => {
      label.style.background = 'rgba(66, 153, 225, 0.8)';
      label.style.borderColor = '#4299e1';
    });
    label.addEventListener('mouseleave', () => {
      if (this.currentAnnotation !== annotation.name) {
        label.style.background = 'rgba(0, 0, 0, 0.6)';
        label.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }
    });

    // Add click handler
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSelect(annotation.name);
    });

    this.labelsContainer.appendChild(label);
    this.labels.set(annotation.name, label);

    // Store position for updates
    (label as any).__position = position.clone();
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

      // Find meshes - Note: For skinned meshes, prefer also specifying bones
      // for accurate marker positioning since mesh world position may be at origin
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

    // If annotation has a cameraAngle, offset the marker position to that side of the model
    // This makes markers appear on the appropriate surface (e.g., back marker on the back)
    if (annotation.cameraAngle !== undefined && annotation.cameraAngle !== 0) {
      // Get the model's bounding box to determine offset distance
      const modelBox = new THREE.Box3().setFromObject(this.model);
      const modelSize = new THREE.Vector3();
      modelBox.getSize(modelSize);

      // Use half the depth (z-axis) as the offset distance
      const offsetDistance = modelSize.z * 0.5;

      // Calculate offset direction based on camera angle
      const angleRad = (annotation.cameraAngle * Math.PI) / 180;
      center.x += Math.sin(angleRad) * offsetDistance;
      center.z -= Math.cos(angleRad) * offsetDistance;
    }

    return center;
  }

  private formatName(name: string): string {
    return name
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private updateMarkerStyles(): void {
    for (const [name, label] of this.labels) {
      if (name === this.currentAnnotation) {
        label.style.background = 'rgba(66, 153, 225, 0.8)';
        label.style.borderColor = '#4299e1';
      } else {
        label.style.background = 'rgba(0, 0, 0, 0.6)';
        label.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }
    }
  }

  private onClick = (event: MouseEvent): void => {
    // This handles clicks on the 3D canvas that might hit markers
    // The HTML labels handle their own clicks
  };

  /**
   * Update label positions - call this in render loop
   */
  update(): void {
    if (!this.model) return;

    const rect = this.domElement.getBoundingClientRect();

    // Calculate camera's viewing angle around the model (in degrees)
    // This tells us if we're looking from front (0°), back (180°), etc.
    const modelCenter = new THREE.Vector3();
    new THREE.Box3().setFromObject(this.model).getCenter(modelCenter);
    const cameraDir = new THREE.Vector3().subVectors(this.camera.position, modelCenter);
    const cameraAngle = Math.atan2(cameraDir.x, cameraDir.z) * (180 / Math.PI);
    // Normalize to 0-360
    const normalizedCameraAngle = ((cameraAngle % 360) + 360) % 360;

    // First pass: calculate positions and visibility
    const visibleLabels: Array<{ name: string; label: HTMLDivElement; x: number; y: number }> = [];

    for (const [name, label] of this.labels) {
      const position = (label as any).__position as THREE.Vector3;
      if (!position) continue;

      // Update position based on current model transform
      const annotation = this.annotations.find(a => a.name === name);
      if (annotation) {
        const newPos = this.getAnnotationCenter(annotation);
        if (newPos) {
          position.copy(newPos);
        }
      }

      // Project to screen space
      const screenPos = position.clone().project(this.camera);

      // Check if in front of camera
      if (screenPos.z > 1) {
        label.style.display = 'none';
        continue;
      }

      // For markers with a cameraAngle, only show when camera is viewing from approximately that angle
      // This ensures "back" marker only shows when viewing from behind
      if (annotation?.cameraAngle !== undefined && annotation.cameraAngle !== 0) {
        const markerAngle = annotation.cameraAngle;
        // Calculate angle difference (accounting for wrap-around at 360°)
        let angleDiff = Math.abs(normalizedCameraAngle - markerAngle);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;

        // Hide marker if camera is not within ~90° of the marker's intended viewing angle
        if (angleDiff > 90) {
          label.style.display = 'none';
          continue;
        }
      }

      label.style.display = 'flex';

      // Convert to CSS coordinates
      const x = (screenPos.x * 0.5 + 0.5) * rect.width;
      const y = (-screenPos.y * 0.5 + 0.5) * rect.height;

      visibleLabels.push({ name, label, x, y });
    }

    // Second pass: spread overlapping labels vertically and horizontally
    const labelHeight = 24; // Approximate label height
    const labelWidth = 80;  // Approximate label width
    const minVerticalGap = 8;
    const minHorizontalGap = 10;

    // Sort by Y position (top to bottom) then by X (left to right)
    visibleLabels.sort((a, b) => a.y - b.y || a.x - b.x);

    // Check for overlaps and spread labels apart
    for (let i = 0; i < visibleLabels.length; i++) {
      for (let j = i + 1; j < visibleLabels.length; j++) {
        const a = visibleLabels[i];
        const b = visibleLabels[j];

        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);

        // Check if labels overlap (within bounding box)
        if (dx < labelWidth && dy < labelHeight + minVerticalGap) {
          // Labels overlap - spread them apart
          const overlapY = (labelHeight + minVerticalGap) - dy;
          const overlapX = (labelWidth + minHorizontalGap) - dx;

          // Prefer vertical spreading, but also spread horizontally if needed
          if (overlapY > 0) {
            // Spread vertically: move upper label up, lower label down
            const spreadY = overlapY / 2 + minVerticalGap;
            if (a.y < b.y) {
              a.y -= spreadY;
              b.y += spreadY;
            } else {
              a.y += spreadY;
              b.y -= spreadY;
            }
          }

          // If still horizontally close, also spread horizontally
          if (dx < labelWidth * 0.5 && overlapX > 0) {
            const spreadX = overlapX / 2 + minHorizontalGap;
            if (a.x < b.x) {
              a.x -= spreadX * 0.3;
              b.x += spreadX * 0.3;
            } else {
              a.x += spreadX * 0.3;
              b.x -= spreadX * 0.3;
            }
          }
        }
      }
    }

    // Apply final positions
    for (const { label, x, y } of visibleLabels) {
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
    }
  }

  /**
   * Show/hide all markers
   */
  setVisible(visible: boolean): void {
    this.labelsContainer.style.display = visible ? 'block' : 'none';
  }

  /**
   * Clear all markers
   */
  clear(): void {
    for (const label of this.labels.values()) {
      label.remove();
    }
    this.labels.clear();
    this.markers.clear();
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.domElement.removeEventListener('click', this.onClick);
    this.clear();
    this.labelsContainer.remove();
  }
}
