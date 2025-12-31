---
name: annotation-camera
description: Work with the 3D annotation camera system. Use when adding annotations, modifying camera behavior, creating markers, or adjusting how the camera focuses on bones/meshes. Covers AnnotationCameraController, AnnotationMarkers, Annotation3DMarkers, and annotation presets.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Annotation Camera System

The annotation camera system provides interactive 3D navigation for character models, with clickable markers that focus the camera on specific body parts.

## Architecture Overview

```
AnnotationCameraController (main orchestrator)
├── OrbitControls (mouse interaction)
├── AnnotationMarkers (HTML-based labels) OR Annotation3DMarkers (3D geometry)
├── CameraDOMControls (dropdown selector)
└── Annotations config (per-character presets)
```

## Key Files

| File | Purpose |
|------|---------|
| [src/camera/AnnotationCameraController.ts](src/camera/AnnotationCameraController.ts) | Main controller - camera animation, focus logic, marker coordination |
| [src/camera/Annotation3DMarkers.ts](src/camera/Annotation3DMarkers.ts) | 3D geometry markers with spheres and lines on mesh surface |
| [src/camera/DOMControls.ts](src/camera/DOMControls.ts) | Dropdown UI for annotation selection |
| [src/camera/types.ts](src/camera/types.ts) | TypeScript interfaces for annotations and config |
| [src/presets/annotations.ts](src/presets/annotations.ts) | Character-specific annotation definitions |

## Annotation Interface

```typescript
interface Annotation {
  name: string;              // Display name (snake_case recommended)
  bones?: string[];          // Bone names to focus on
  meshes?: string[];         // Mesh names to focus on
  objects?: string[];        // Any object names (use ['*'] for all)
  paddingFactor?: number;    // Zoom padding (1.0 = tight, 2.0 = loose)
  cameraAngle?: number;      // Y-axis rotation (0=front, 90=right, 180=back, 270=left)
  cameraOffset?: { x?, y?, z? }; // Fine-tune camera position
}
```

## Adding a New Annotation

1. Open [src/presets/annotations.ts](src/presets/annotations.ts)
2. Find the character config (e.g., `JONATHAN_ANNOTATIONS`)
3. Add to the `annotations` array:

```typescript
{
  name: 'left_shoulder',
  bones: ['CC_Base_L_Clavicle', 'CC_Base_L_Upperarm'],
  paddingFactor: 1.4,
  cameraAngle: 270,  // View from left side
}
```

## 3D Markers

All markers are pure 3D geometry (no HTML overlays):
- **Sphere dots** placed on mesh surface via raycasting
- **3D lines** extending outward from the surface
- **Sprite labels** (canvas-rendered text billboards) at line endpoints
- Markers rotate with the model and have proper depth
- Click detection via 3D raycasting

## Camera Focus Methods

```typescript
// Focus on named annotation
controller.focusAnnotation('left_eye', 800);

// Focus on specific bones
controller.focusBones(['CC_Base_L_Hand'], 800);

// Focus on meshes
controller.focusMeshes(['CC_Base_Eye'], 800);

// Focus on full body
controller.focusFullBody(800);
```

## Camera Angle Convention

| Angle | View Direction |
|-------|----------------|
| 0     | Front (default) |
| 90    | Right side |
| 180   | Back |
| 270   | Left side |

## Padding Factor Guidelines

| Target Size | Recommended Padding |
|-------------|---------------------|
| Eyes, mouth | 1.2 - 1.5 |
| Head, hands | 1.3 - 1.6 |
| Upper body  | 1.5 - 1.8 |
| Full body   | 2.0 - 2.5 |

## CRITICAL: Skinned Mesh Positioning

**Skinned meshes (eyes, teeth, tongue, etc.) have their geometry at world origin (0,0,0).** The mesh is positioned by the skeleton bones at runtime.

### Consequence for Annotations
- **NEVER use `meshes` alone for skinned mesh parts** - the marker will appear at model origin (usually the feet)
- **NEVER mix `meshes` with `bones` if the meshes are skinned** - the skinned mesh origin (0,0,0) will skew the center calculation
- **ALWAYS use `bones` for accurate marker positioning** on body parts controlled by skeleton

### Examples
```typescript
// WRONG - marker will appear at feet/origin
{
  name: 'left_eye',
  meshes: ['CC_Base_Eye'],  // BAD: skinned mesh at origin
  paddingFactor: 1.2,
}

// WRONG - mixing bones and skinned meshes skews center toward origin
{
  name: 'mouth',
  bones: ['CC_Base_JawRoot'],
  meshes: ['CC_Base_Teeth', 'CC_Base_Tongue'],  // BAD: these are at (0,0,0)
  paddingFactor: 1.5,
}

// CORRECT - marker appears at actual eye position
{
  name: 'left_eye',
  bones: ['CC_Base_L_Eye'],  // GOOD: bone has correct world position
  paddingFactor: 1.2,
}

// CORRECT - mouth uses only bones
{
  name: 'mouth',
  bones: ['CC_Base_JawRoot'],  // GOOD: bone only, no skinned meshes
  paddingFactor: 1.5,
}
```

### CC4 Skinned Meshes to Avoid
- `CC_Base_Eye`, `CC_Base_Eye_1` → Use `CC_Base_L_Eye`, `CC_Base_R_Eye` bones
- `CC_Base_Teeth`, `CC_Base_Tongue` → Use `CC_Base_JawRoot` bone

## Bone Names by Character

### CC4 Characters (Jonathan)
- Head: `CC_Base_Head`, `CC_Base_JawRoot`
- Eyes: `CC_Base_L_Eye`, `CC_Base_R_Eye` (use bones, NOT mesh names)
- Spine: `CC_Base_Spine01`, `CC_Base_Spine02`
- Arms: `CC_Base_L_Clavicle`, `CC_Base_L_Upperarm`, `CC_Base_L_Hand`
- Legs: `CC_Base_L_Thigh`, `CC_Base_L_Foot`, `CC_Base_L_ToeBase`

### Skeletal Models (Betta Fish)
- Use armature bone names: `Bone001_Armature`, `Bone002_Armature`, etc.

## Customizing 3D Markers

Edit `DEFAULT_CONFIG` in [Annotation3DMarkers.ts](src/camera/Annotation3DMarkers.ts):

```typescript
const DEFAULT_CONFIG = {
  markerRadius: 0.012,           // Size of sphere on mesh surface
  markerColor: 0x4299e1,         // Blue color
  lineColor: 0x4299e1,           // Line color
  lineLength: 0.12,              // Line extension from surface
  labelColor: '#ffffff',         // Text color
  labelBackground: 'rgba(0, 0, 0, 0.75)', // Label background
  labelFontSize: 48,             // Font size for texture (higher = sharper)
  labelScale: 0.04,              // Label size in world units
};
```

## Outward Direction for Markers

The direction markers point is determined semantically based on annotation name:

| Annotation Type | Outward Direction |
|-----------------|-------------------|
| eye, face, mouth, head | Forward (+Z) |
| full_body, body, upper_body | Forward (+Z) |
| back | Backward (-Z) via cameraAngle: 180 |
| left_hand | Left (-X) via cameraAngle: 270 |
| right_hand | Right (+X) via cameraAngle: 90 |
| foot | Down and forward |
| dorsal_fin | Up (+Y) |
| ventral_fin | Down (-Y) |
| pectoral_fin_left | Left (-X) |
| pectoral_fin_right | Right (+X) |
| tail | Backward (-Z) |

**Important**: For face-related markers (eyes, mouth, head), the outward direction must be FORWARD (+Z), not the direction from model center, because model center is typically at waist level and pointing from there to the face would hit the top of the head.

## Surface Point Detection

3D markers use raycasting to place spheres on the mesh surface:

1. Calculate annotation center from bones/meshes
2. Determine semantic outward direction based on annotation type
3. Cast ray from outside model toward center along that direction
3. Use first intersection point as marker position
4. Offset slightly along surface normal to prevent z-fighting

## Animation System

Camera transitions use spherical interpolation for smooth orbital motion:

- `toSpherical()` / `fromSpherical()` - coordinate conversion
- Pullback arc for large rotations (avoids passing through model)
- Ease-in-out timing function

## Common Tasks

### Add annotation for new body part
1. Identify bone/mesh names (check model in Three.js inspector)
2. Add annotation entry in [annotations.ts](src/presets/annotations.ts)
3. Set appropriate `paddingFactor` and `cameraAngle`

### Adjust marker appearance
Edit [Annotation3DMarkers.ts](src/camera/Annotation3DMarkers.ts) `DEFAULT_CONFIG`

### Change animation timing
Modify `transitionDuration` in controller config or pass duration to focus methods

### Debug camera positioning
Watch console logs prefixed with `[Camera]` - they show bounding boxes, positions, and angles
