import * as THREE from 'three';
import type { Annotation, CharacterAnnotationConfig } from './types';

interface MarkerConfig {
  markerRadius?: number;
  markerColor?: number;
  lineColor?: number;
  lineLength?: number;
  labelColor?: string;
  labelBackground?: string;
  labelFontSize?: number;
  labelScale?: number;
}

const DEFAULT_CONFIG: Required<MarkerConfig> = {
  markerRadius: 0.015,
  markerColor: 0x4299e1,
  lineColor: 0x4299e1,
  lineLength: 0.5,
  labelColor: '#ffffff',
  labelBackground: 'rgba(0, 0, 0, 0.75)',
  labelFontSize: 32,
  labelScale: 0.04,
};

// Reference model height for scaling (human character is ~1.8 units tall)
const REFERENCE_MODEL_HEIGHT = 1.8;

// Zoom threshold for scaling markers (relative to model height)
// When camera is closer than this ratio of model height, markers shrink
const ZOOM_THRESHOLD_RATIO = 0.8;
const ZOOMED_IN_SPHERE_SCALE = 0.25; // Spheres get much smaller (25%) when zoomed in
const ZOOMED_IN_LABEL_SCALE = 0.85; // Labels stay readable - only slightly smaller
const ZOOMED_IN_LINE_SCALE = 0.3; // Lines get much shorter when zoomed in

/**
 * Pure 3D visual markers for annotations.
 *
 * SIMPLE RULE: Lines always point AWAY from model center.
 * - Horizontal: left annotations go left, right go right
 * - Vertical: high annotations go up, low go down
 */
export class Annotation3DMarkers {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;
  private model: THREE.Object3D | null = null;
  private annotations: Annotation[] = [];
  private currentAnnotation: string | null = null;
  private onSelect: (name: string) => void;
  private config: Required<MarkerConfig>;

  private markerGroup: THREE.Group;
  private markerMeshes: Map<string, THREE.Mesh> = new Map();
  private lineMeshes: Map<string, THREE.Line> = new Map();
  private lineEndpoints: Map<string, { start: THREE.Vector3; end: THREE.Vector3; direction: THREE.Vector3 }> = new Map();
  private labelSprites: Map<string, THREE.Sprite> = new Map();
  private labelScales: Map<string, { x: number; y: number }> = new Map();

  // Model bounds - cached once when model is set
  private modelCenter = new THREE.Vector3();
  private modelSize = new THREE.Vector3();

  // Zoom-based scaling state (only updates when crossing threshold)
  private isZoomedIn = false;
  private zoomThreshold = 1.0; // Calculated from model size
  private lastCameraDistance = -1; // Cache to avoid unnecessary checks

  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(inputConfig: {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    domElement: HTMLElement;
    onSelect: (name: string) => void;
    markerConfig?: MarkerConfig;
  }) {
    this.scene = inputConfig.scene;
    this.camera = inputConfig.camera;
    this.domElement = inputConfig.domElement;
    this.onSelect = inputConfig.onSelect;
    this.config = { ...DEFAULT_CONFIG, ...inputConfig.markerConfig };

    this.markerGroup = new THREE.Group();
    this.markerGroup.name = 'Annotation3DMarkers';
    this.scene.add(this.markerGroup);

    this.domElement.addEventListener('click', this.onClick);
  }

  setModel(model: THREE.Object3D): void {
    this.model = model;
    // Force update of world matrices before computing bounds
    model.updateMatrixWorld(true);
    // Cache model bounds
    const box = new THREE.Box3().setFromObject(model);
    box.getCenter(this.modelCenter);
    box.getSize(this.modelSize);

    // Calculate zoom threshold based on model height
    this.zoomThreshold = this.modelSize.y * ZOOM_THRESHOLD_RATIO;
    this.lastCameraDistance = -1; // Reset to force recalculation
    this.isZoomedIn = false;
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

  /**
   * Create a marker for an annotation.
   *
   * Algorithm:
   * 1. Find annotation center from bones/meshes
   * 2. Determine best outward direction based on annotation type and cameraAngle
   * 3. Raycast from outside toward annotation center to find surface point
   * 4. Line extends outward from surface
   */
  private createMarker(annotation: Annotation): void {
    if (!this.model) return;

    // Get annotation center and bounding box
    const result = this.getAnnotationCenterAndBox(annotation);
    if (!result) {
      console.warn(`[3DMarkers] ${annotation.name}: bones/meshes not found`);
      return;
    }

    const { center: annotationCenter, box: annotationBox } = result;

    // Determine outward direction based on annotation type
    const outwardDir = this.getOutwardDirection(annotation, annotationCenter);

    // Determine surface point based on annotation type
    let surfacePoint: THREE.Vector3;

    // For mesh-only annotations (like eyes), place marker at the front of the mesh bounding box
    // These are typically internal meshes where raycasting to outer surface doesn't make sense
    const isMeshOnly = annotation.meshes && annotation.meshes.length > 0 && !annotation.bones && !annotation.objects;

    if (isMeshOnly) {
      // Place marker at the front surface of the annotation's bounding box
      const boxSize = new THREE.Vector3();
      annotationBox.getSize(boxSize);
      surfacePoint = annotationCenter.clone().add(outwardDir.clone().multiplyScalar(Math.max(boxSize.x, boxSize.y, boxSize.z) * 0.5));
    } else {
      // For bone/object annotations, raycast to find the outer surface
      surfacePoint = this.findSurfacePoint(annotationCenter, outwardDir);
    }

    // Scale relative to reference model height so fish and human look the same
    const modelHeight = this.modelSize.y;
    const scale = modelHeight / REFERENCE_MODEL_HEIGHT;
    const scaledRadius = this.config.markerRadius * scale;
    const scaledLineLength = this.config.lineLength * scale;

    // Create sphere at surface
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(scaledRadius, 12, 12),
      new THREE.MeshBasicMaterial({
        color: this.config.markerColor,
        transparent: true,
        opacity: 0.95,
      })
    );
    sphere.position.copy(surfacePoint);
    sphere.name = `marker_${annotation.name}`;
    sphere.userData.annotation = annotation.name;
    sphere.userData.cameraAngle = annotation.cameraAngle;
    this.markerGroup.add(sphere);
    this.markerMeshes.set(annotation.name, sphere);

    // Line end point: extend outward from surface
    const lineEnd = surfacePoint.clone().add(
      outwardDir.clone().multiplyScalar(scaledLineLength)
    );

    // Store line endpoints for zoom scaling
    this.lineEndpoints.set(annotation.name, {
      start: surfacePoint.clone(),
      end: lineEnd.clone(),
      direction: outwardDir.clone(),
    });

    // Create line
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([surfacePoint.clone(), lineEnd]),
      new THREE.LineBasicMaterial({
        color: this.config.lineColor,
        transparent: true,
        opacity: 0.9,
      })
    );
    line.name = `line_${annotation.name}`;
    line.userData.annotation = annotation.name;
    this.markerGroup.add(line);
    this.lineMeshes.set(annotation.name, line);

    // Create label at line end
    const label = this.createLabelSprite(annotation.name);
    label.position.copy(lineEnd);
    label.name = `label_${annotation.name}`;
    label.userData.annotation = annotation.name;
    this.markerGroup.add(label);
    this.labelSprites.set(annotation.name, label);
    this.labelScales.set(annotation.name, { x: label.scale.x, y: label.scale.y });

    console.log(`[3DMarkers] ${annotation.name}: surface=(${surfacePoint.x.toFixed(3)}, ${surfacePoint.y.toFixed(3)}, ${surfacePoint.z.toFixed(3)}), outward=(${outwardDir.x.toFixed(2)}, ${outwardDir.y.toFixed(2)}, ${outwardDir.z.toFixed(2)})`);
  }

  /**
   * Determine the outward direction for marker placement based on annotation type.
   *
   * This uses semantic knowledge about body parts:
   * - Face/eyes/mouth: forward (positive Z)
   * - Back: backward (negative Z)
   * - Left parts: left (negative X)
   * - Right parts: right (positive X)
   * - Feet: down (negative Y)
   * - If cameraAngle is specified, use that angle
   * - Default: direction from model center to annotation center
   */
  private getOutwardDirection(annotation: Annotation, annotationCenter: THREE.Vector3): THREE.Vector3 {
    const name = annotation.name.toLowerCase();

    // If annotation has a specific cameraAngle, use that direction
    if (annotation.cameraAngle !== undefined && annotation.cameraAngle !== 0) {
      const angleRad = (annotation.cameraAngle * Math.PI) / 180;
      return new THREE.Vector3(Math.sin(angleRad), 0, Math.cos(angleRad)).normalize();
    }

    // Semantic direction based on annotation name
    // Eyes should point outward to the side (left eye goes left, right eye goes right)
    if (name.includes('left_eye') || name.includes('left eye')) {
      return new THREE.Vector3(-1, 0.1, 0.3).normalize(); // Left and slightly up/forward
    }
    if (name.includes('right_eye') || name.includes('right eye')) {
      return new THREE.Vector3(1, 0.1, 0.3).normalize(); // Right and slightly up/forward
    }

    // Other face-related annotations should point FORWARD (positive Z)
    if (name.includes('face') || name.includes('mouth') || name.includes('head')) {
      return new THREE.Vector3(0, 0, 1);
    }

    // Full body points forward
    if (name.includes('full_body') || name === 'body') {
      return new THREE.Vector3(0, 0, 1);
    }

    // Upper body points forward
    if (name.includes('upper_body') || name.includes('torso') || name.includes('chest')) {
      return new THREE.Vector3(0, 0, 1);
    }

    // Feet point down and slightly forward
    if (name.includes('foot') || name.includes('feet')) {
      return new THREE.Vector3(0, -0.5, 0.5).normalize();
    }

    // Fins (for fish) - use horizontal direction based on left/right
    if (name.includes('fin')) {
      if (name.includes('left')) {
        return new THREE.Vector3(-1, 0, 0);
      } else if (name.includes('right')) {
        return new THREE.Vector3(1, 0, 0);
      } else if (name.includes('dorsal')) {
        return new THREE.Vector3(0, 1, 0); // Top fin points up
      } else if (name.includes('ventral')) {
        return new THREE.Vector3(0, -1, 0); // Bottom fins point down
      }
    }

    // Tail points backward
    if (name.includes('tail')) {
      return new THREE.Vector3(0, 0, -1);
    }

    // Gills point to the side
    if (name.includes('gill')) {
      return new THREE.Vector3(1, 0, 0.3).normalize();
    }

    // Default: use direction from model center (original behavior)
    const dir = new THREE.Vector3().subVectors(annotationCenter, this.modelCenter);
    if (dir.length() < 0.001) {
      return new THREE.Vector3(0, 0, 1); // Default to front
    }
    return dir.normalize();
  }

  /**
   * Find surface point by raycasting from OUTSIDE toward the annotation center.
   * This ensures we hit the outer surface facing the outward direction.
   */
  private findSurfacePoint(target: THREE.Vector3, outwardDir: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return target.clone();

    // Collect all meshes
    const meshes: THREE.Mesh[] = [];
    this.model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        meshes.push(obj as THREE.Mesh);
      }
    });

    if (meshes.length === 0) return target.clone();

    const modelScale = Math.max(this.modelSize.x, this.modelSize.y, this.modelSize.z);
    const scale = this.modelSize.y / REFERENCE_MODEL_HEIGHT;

    // Cast ray from far outside, coming IN toward the target
    const rayOrigin = target.clone().add(outwardDir.clone().multiplyScalar(modelScale * 2));
    const rayDir = outwardDir.clone().negate();

    this.raycaster.set(rayOrigin, rayDir);
    this.raycaster.far = modelScale * 4;

    const hits = this.raycaster.intersectObjects(meshes, false);

    // Find the first hit (outer surface)
    if (hits.length > 0) {
      const hit = hits[0].point.clone();
      // Offset slightly along outward direction to sit on surface
      hit.add(outwardDir.clone().multiplyScalar(this.config.markerRadius * scale));
      return hit;
    }

    // Fallback: try raycasting from model center outward through target
    const rayOrigin2 = this.modelCenter.clone();
    const rayDir2 = outwardDir.clone();
    this.raycaster.set(rayOrigin2, rayDir2);
    this.raycaster.far = modelScale * 2;

    const hits2 = this.raycaster.intersectObjects(meshes, false);
    if (hits2.length > 0) {
      // Use the LAST hit (furthest out = outer surface)
      const hit = hits2[hits2.length - 1].point.clone();
      hit.add(outwardDir.clone().multiplyScalar(this.config.markerRadius * scale));
      return hit;
    }

    // Final fallback: place marker at annotation center offset outward
    return target.clone().add(outwardDir.clone().multiplyScalar(0.05 * scale));
  }

  /**
   * Get center point and bounding box of annotation's bones/meshes.
   */
  private getAnnotationCenterAndBox(annotation: Annotation): { center: THREE.Vector3; box: THREE.Box3 } | null {
    if (!this.model) return null;

    // CRITICAL: Force update of all world matrices including skeleton bones
    // Without this, bone.getWorldPosition() may return stale/origin values
    this.model.updateMatrixWorld(true);

    const box = new THREE.Box3();
    let found = false;
    const foundItems: string[] = [];

    // Handle full body (*)
    if (annotation.objects?.includes('*')) {
      box.setFromObject(this.model);
      found = true;
      foundItems.push('full model');
    } else {
      // Find bones
      if (annotation.bones) {
        const tempVec = new THREE.Vector3();
        for (const boneName of annotation.bones) {
          this.model.traverse((obj) => {
            if (obj.name === boneName) {
              obj.getWorldPosition(tempVec);
              box.expandByPoint(tempVec);
              found = true;
              foundItems.push(`bone:${boneName} at (${tempVec.x.toFixed(2)}, ${tempVec.y.toFixed(2)}, ${tempVec.z.toFixed(2)})`);
            }
          });
        }
      }

      // Find meshes
      if (annotation.meshes) {
        for (const meshName of annotation.meshes) {
          this.model.traverse((obj) => {
            if (obj.name === meshName && (obj as THREE.Mesh).isMesh) {
              const mesh = obj as THREE.Mesh;

              // For skinned meshes, the geometry is at origin - we need to find the
              // associated bone position instead, or compute world-space bounds
              let meshCenter = new THREE.Vector3();

              // Check if this is a skinned mesh by looking for a parent bone
              // or if the mesh has very small bounds near origin
              const meshBox = new THREE.Box3().setFromObject(mesh);
              meshBox.getCenter(meshCenter);

              // If center is near origin, this is likely a skinned mesh
              // Try to find the bone that controls it by name pattern
              if (meshCenter.length() < 0.1) {
                // For CC_Base_Eye and CC_Base_Eye_1, use the eye bones (CC4/human)
                if (meshName.includes('CC_Base_Eye')) {
                  const isLeft = !meshName.includes('_1'); // CC_Base_Eye is left, CC_Base_Eye_1 is right
                  const eyeBoneName = isLeft ? 'CC_Base_L_Eye' : 'CC_Base_R_Eye';
                  this.model.traverse((boneObj) => {
                    if (boneObj.name === eyeBoneName) {
                      boneObj.getWorldPosition(meshCenter);
                    }
                  });
                } else if (meshName === 'EYES_0') {
                  // Fish eye mesh - use head bone (Bone001_Armature) and offset forward
                  // The fish model is small and the head bone is deep inside the body,
                  // so we need a significant forward offset to reach the visible eye surface
                  this.model.traverse((boneObj) => {
                    if (boneObj.name === 'Bone001_Armature') {
                      boneObj.getWorldPosition(meshCenter);
                      // Offset forward toward the face where eyes are visible
                      meshCenter.z += 0.12; // Forward offset to reach eye surface
                    }
                  });
                } else if (meshName.includes('Tongue') || meshName.includes('Teeth')) {
                  // For tongue/teeth, use jaw bone
                  this.model.traverse((boneObj) => {
                    if (boneObj.name === 'CC_Base_JawRoot') {
                      boneObj.getWorldPosition(meshCenter);
                    }
                  });
                } else {
                  // Fallback: use mesh world position
                  mesh.getWorldPosition(meshCenter);
                }
              }

              box.expandByPoint(meshCenter);
              found = true;
              foundItems.push(`mesh:${meshName} center at (${meshCenter.x.toFixed(2)}, ${meshCenter.y.toFixed(2)}, ${meshCenter.z.toFixed(2)})`);
            }
          });
        }
      }
    }

    if (!found || box.isEmpty()) {
      console.warn(`[3DMarkers] ${annotation.name}: nothing found`);
      return null;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    console.log(`[3DMarkers] ${annotation.name}: found [${foundItems.join(', ')}] -> center (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
    return { center, box };
  }

  private createLabelSprite(name: string): THREE.Sprite {
    const text = name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const fontSize = this.config.labelFontSize;
    const font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.font = font;

    const padding = fontSize * 0.5;
    const textWidth = ctx.measureText(text).width;
    canvas.width = Math.ceil(textWidth + padding * 2);
    canvas.height = Math.ceil(fontSize + padding * 1.5);

    // Background
    ctx.fillStyle = this.config.labelBackground;
    const r = fontSize * 0.3;
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, r);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(66, 153, 225, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, r);
    ctx.stroke();

    // Text
    ctx.font = font;
    ctx.fillStyle = this.config.labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: false, // Disable size attenuation - we'll scale manually for consistent screen size
      })
    );

    // With sizeAttenuation: false, sprite scale is in normalized device coordinates (screen space)
    // Use a fixed screen-relative scale so labels appear same size regardless of model/camera distance
    const baseScale = 0.024; // Fixed screen-relative size
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(baseScale * aspect, baseScale, 1);

    return sprite;
  }

  private updateMarkerStyles(): void {
    // Get current zoom scale factors
    const sphereScale = this.isZoomedIn ? ZOOMED_IN_SPHERE_SCALE : 1.0;
    const labelScale = this.isZoomedIn ? ZOOMED_IN_LABEL_SCALE : 1.0;

    for (const [name, sphere] of this.markerMeshes) {
      const line = this.lineMeshes.get(name);
      const label = this.labelSprites.get(name);
      const baseScale = this.labelScales.get(name);
      const isSelected = name === this.currentAnnotation;

      (sphere.material as THREE.MeshBasicMaterial).color.setHex(
        isSelected ? 0x63b3ed : this.config.markerColor
      );
      // Apply zoom scale with selection highlight
      sphere.scale.setScalar((isSelected ? 1.3 : 1) * sphereScale);

      if (line) {
        (line.material as THREE.LineBasicMaterial).color.setHex(
          isSelected ? 0x63b3ed : this.config.lineColor
        );
        (line.material as THREE.LineBasicMaterial).opacity = isSelected ? 1 : (this.isZoomedIn ? 0.6 : 0.9);
      }

      if (label && baseScale) {
        const s = isSelected ? 1.1 : 1;
        // Apply label scale with selection highlight (labels stay more readable)
        label.scale.set(baseScale.x * s * labelScale, baseScale.y * s * labelScale, 1);
      }
    }
  }

  private onClick = (event: MouseEvent): void => {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const clickables = [...this.markerMeshes.values(), ...this.labelSprites.values()];
    const hits = this.raycaster.intersectObjects(clickables, false);

    if (hits.length > 0 && hits[0].object.userData.annotation) {
      this.onSelect(hits[0].object.userData.annotation);
    }
  };

  /**
   * Per-frame update: visibility based on camera angle + zoom-based scaling.
   * Scaling only updates when crossing the zoom threshold (not every frame).
   */
  update(): void {
    if (!this.model) return;

    const dx = this.camera.position.x - this.modelCenter.x;
    const dy = this.camera.position.y - this.modelCenter.y;
    const dz = this.camera.position.z - this.modelCenter.z;

    // Camera angle for visibility
    const cameraAngle = ((Math.atan2(dx, dz) * 180 / Math.PI) % 360 + 360) % 360;

    // Check zoom threshold (only when distance changes significantly)
    const cameraDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Only check threshold if distance changed by more than 5% (avoids micro-updates)
    const distanceChanged = this.lastCameraDistance < 0 ||
      Math.abs(cameraDistance - this.lastCameraDistance) > this.lastCameraDistance * 0.05;

    if (distanceChanged) {
      this.lastCameraDistance = cameraDistance;

      // Check if we crossed the threshold
      const shouldBeZoomedIn = cameraDistance < this.zoomThreshold;
      if (shouldBeZoomedIn !== this.isZoomedIn) {
        this.isZoomedIn = shouldBeZoomedIn;
        this.applyZoomScale(shouldBeZoomedIn ? ZOOMED_IN_SPHERE_SCALE : 1.0);
      }
    }

    // Visibility based on camera angle (cheap operation)
    for (const [name, sphere] of this.markerMeshes) {
      const markerAngle = sphere.userData.cameraAngle;

      if (markerAngle !== undefined && markerAngle !== 0) {
        let diff = Math.abs(cameraAngle - markerAngle);
        if (diff > 180) diff = 360 - diff;

        const visible = diff <= 90;
        sphere.visible = visible;

        const line = this.lineMeshes.get(name);
        const label = this.labelSprites.get(name);
        if (line) line.visible = visible;
        if (label) label.visible = visible;
      }
    }
  }

  /**
   * Apply zoom-based scaling to all markers, lines, and labels.
   * Only called when crossing the zoom threshold (not every frame).
   */
  private applyZoomScale(scaleFactor: number): void {
    const isZoomed = scaleFactor < 1;
    const sphereScaleFactor = isZoomed ? ZOOMED_IN_SPHERE_SCALE : 1.0;
    const lineScaleFactor = isZoomed ? ZOOMED_IN_LINE_SCALE : 1.0;
    const labelScaleFactor = isZoomed ? ZOOMED_IN_LABEL_SCALE : 1.0;

    // Scale marker spheres (much smaller when zoomed in)
    for (const sphere of this.markerMeshes.values()) {
      sphere.scale.setScalar(sphereScaleFactor);
    }

    // Scale lines by updating their geometry to shorter length
    for (const [name, line] of this.lineMeshes) {
      const endpoints = this.lineEndpoints.get(name);
      if (endpoints) {
        const material = line.material as THREE.LineBasicMaterial;
        // Make lines more transparent when zoomed in
        material.opacity = isZoomed ? 0.6 : 0.9;

        // Calculate new end point based on line scale
        const lineLength = endpoints.start.distanceTo(endpoints.end);
        const newLength = lineLength * lineScaleFactor;
        const newEnd = endpoints.start.clone().add(
          endpoints.direction.clone().multiplyScalar(newLength)
        );

        // Update line geometry
        const positions = line.geometry.getAttribute('position');
        positions.setXYZ(1, newEnd.x, newEnd.y, newEnd.z);
        positions.needsUpdate = true;

        // Move label to new line end
        const label = this.labelSprites.get(name);
        if (label) {
          label.position.copy(newEnd);
        }
      }
    }

    // Scale labels using their stored base scales (labels stay more readable)
    for (const [name, label] of this.labelSprites) {
      const baseScale = this.labelScales.get(name);
      if (baseScale) {
        label.scale.set(
          baseScale.x * labelScaleFactor,
          baseScale.y * labelScaleFactor,
          1
        );
      }
    }
  }

  setVisible(visible: boolean): void {
    this.markerGroup.visible = visible;
  }

  clear(): void {
    while (this.markerGroup.children.length > 0) {
      const child = this.markerGroup.children[0];
      this.markerGroup.remove(child);

      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mat = mesh.material as THREE.Material;
        if ((mat as THREE.SpriteMaterial).map) {
          (mat as THREE.SpriteMaterial).map!.dispose();
        }
        mat.dispose();
      }
    }

    this.markerMeshes.clear();
    this.lineMeshes.clear();
    this.lineEndpoints.clear();
    this.labelSprites.clear();
    this.labelScales.clear();
  }

  dispose(): void {
    this.domElement.removeEventListener('click', this.onClick);
    this.clear();
    this.scene.remove(this.markerGroup);
  }
}
