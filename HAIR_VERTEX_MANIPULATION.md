# Hair Vertex Manipulation Guide

This guide demonstrates how to manipulate hair geometry at the vertex level for dynamic hair effects, styling, and physics.

## Available Methods

### 1. `getHairGeometry(objectName: string)`

Get information about hair geometry for inspection or custom manipulation.

```javascript
const hairInfo = engine.getHairGeometry('Side_part_wavy');
console.log('Vertex count:', hairInfo.vertexCount);
console.log('Geometry:', hairInfo.geometry);
```

### 2. `applyHairVertexDisplacement(objectName, displacementFn, blend)`

Apply custom vertex displacement using a function. This is the base method for all vertex effects.

```javascript
// Custom displacement: move all vertices up by 0.1 units
engine.applyHairVertexDisplacement(
  'Side_part_wavy',
  (vertex, index) => {
    return new THREE.Vector3(
      vertex.x,
      vertex.y + 0.1,
      vertex.z
    );
  },
  1.0  // Full blend
);
```

### 3. `applyHairWaveEffect(objectName, options)`

Create wave/wind effects on hair.

**Options:**
- `amplitude` (default: 0.1) - Wave height
- `frequency` (default: 1.0) - Wave speed
- `wavelength` (default: 1.0) - Wave spacing
- `direction` (default: Vector3(1,0,0)) - Wave direction
- `time` (default: 0) - Animation time (for animated waves)
- `blend` (default: 1.0) - Blend factor (0-1)

```javascript
// Simple wave effect
engine.applyHairWaveEffect('Side_part_wavy', {
  amplitude: 0.2,
  frequency: 2.0,
  wavelength: 3.0
});

// Animated wave (call in animation loop)
let time = 0;
function animate() {
  time += 0.016; // ~60fps
  engine.applyHairWaveEffect('Side_part_wavy', {
    amplitude: 0.15,
    frequency: 3.0,
    wavelength: 2.0,
    time: time
  });
  requestAnimationFrame(animate);
}
animate();
```

### 4. `applyHairGravityEffect(objectName, options)`

Simulate gravity/drooping on hair.

**Options:**
- `strength` (default: 0.5) - Gravity strength
- `direction` (default: Vector3(0,-1,0)) - Gravity direction
- `falloff` (default: 1.0) - Distance falloff
- `pivot` (default: Vector3(0,0,0)) - Pivot point (hair root)
- `blend` (default: 1.0) - Blend factor

```javascript
// Simple gravity droop
engine.applyHairGravityEffect('Side_part_wavy', {
  strength: 0.3,
  falloff: 0.5
});

// Heavy droop from specific pivot point
engine.applyHairGravityEffect('Side_part_wavy', {
  strength: 1.0,
  direction: new THREE.Vector3(0, -1, 0),
  falloff: 0.8,
  pivot: new THREE.Vector3(0, 6, 0),  // Hair root position
  blend: 0.7
});
```

### 5. `applyHairCurlEffect(objectName, options)`

Create curl/twist effects on hair.

**Options:**
- `intensity` (default: 1.0) - Curl intensity
- `radius` (default: 0.5) - Curl radius
- `axis` (default: Vector3(0,1,0)) - Curl axis
- `center` (default: Vector3(0,0,0)) - Center point
- `blend` (default: 1.0) - Blend factor

```javascript
// Gentle curl
engine.applyHairCurlEffect('Side_part_wavy', {
  intensity: 0.5,
  radius: 0.3
});

// Tight spiral
engine.applyHairCurlEffect('Side_part_wavy', {
  intensity: 2.0,
  radius: 0.2,
  axis: new THREE.Vector3(0, 1, 0),
  blend: 0.8
});
```

### 6. `resetHairGeometry(objectName)`

Reset hair to original geometry.

```javascript
// Reset to original shape
engine.resetHairGeometry('Side_part_wavy');
```

### 7. `applyHairVertexShader(objectName, shaderCode)`

Apply custom GPU-based vertex shader for advanced effects (experimental).

```javascript
// Custom shader displacement
const shaderCode = `
  vec3 transformed = position;
  transformed.y += sin(position.x * 3.0 + time) * 0.1;
`;

engine.applyHairVertexShader('Side_part_wavy', shaderCode);
```

## Usage Examples

### Example 1: Animated Wind Effect

```javascript
// Access engine globally
const engine = window.engine;

let time = 0;
function animateWind() {
  time += 0.016;

  // Apply wave to all hair objects
  ['Side_part_wavy', 'CC_Base_Hair'].forEach(hairName => {
    engine.applyHairWaveEffect(hairName, {
      amplitude: 0.15,
      frequency: 2.5,
      wavelength: 2.0,
      direction: new THREE.Vector3(1, 0, 0.5),  // Wind from side
      time: time,
      blend: 0.8
    });
  });

  requestAnimationFrame(animateWind);
}
animateWind();
```

### Example 2: Gravity Droop on Head Movement

```javascript
// React to head rotation with gravity
engine.subscribe('HEAD_ROTATION', (rotation) => {
  const gravityDir = new THREE.Vector3(0, -1, 0)
    .applyEuler(rotation);

  engine.applyHairGravityEffect('Side_part_wavy', {
    strength: 0.4,
    direction: gravityDir,
    falloff: 0.6,
    pivot: new THREE.Vector3(0, 6, 0)
  });
});
```

### Example 3: Curl Styling

```javascript
// Apply different curl patterns to different hair sections
engine.applyHairCurlEffect('Side_part_wavy', {
  intensity: 0.8,
  radius: 0.4,
  axis: new THREE.Vector3(0.2, 1, 0),  // Slight angle
  blend: 1.0
});

// Tighter curls on another section
engine.applyHairCurlEffect('CC_Base_Hair', {
  intensity: 1.5,
  radius: 0.25,
  axis: new THREE.Vector3(0, 1, 0),
  blend: 0.9
});
```

### Example 4: Combined Effects

```javascript
// Combine multiple effects with different blend values
function applyHairStyle(hairName) {
  // Base gravity
  engine.applyHairGravityEffect(hairName, {
    strength: 0.2,
    blend: 0.5
  });

  // Add wave on top
  engine.applyHairWaveEffect(hairName, {
    amplitude: 0.1,
    frequency: 1.0,
    wavelength: 4.0,
    time: Date.now() * 0.001,
    blend: 0.3
  });

  // Slight curl
  engine.applyHairCurlEffect(hairName, {
    intensity: 0.3,
    radius: 0.6,
    blend: 0.2
  });
}

// Apply to all hair
['Side_part_wavy', 'CC_Base_Hair'].forEach(applyHairStyle);
```

### Example 5: Interactive Mouse-Based Wind

```javascript
let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth) * 2 - 1;
  mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
});

function animateInteractive() {
  const windDirection = new THREE.Vector3(mouseX, 0, mouseY).normalize();
  const windStrength = Math.sqrt(mouseX * mouseX + mouseY * mouseY) * 0.2;

  engine.applyHairWaveEffect('Side_part_wavy', {
    amplitude: windStrength,
    frequency: 2.0,
    wavelength: 2.0,
    direction: windDirection,
    time: Date.now() * 0.001
  });

  requestAnimationFrame(animateInteractive);
}
animateInteractive();
```

## Console Testing

Quick tests you can run in the browser console:

```javascript
// Get engine reference
const engine = window.engine;

// Test 1: Simple wave
engine.applyHairWaveEffect('Side_part_wavy', { amplitude: 0.3 });

// Test 2: Gravity droop
engine.applyHairGravityEffect('Side_part_wavy', { strength: 0.5 });

// Test 3: Curl
engine.applyHairCurlEffect('Side_part_wavy', { intensity: 1.0 });

// Test 4: Reset
engine.resetHairGeometry('Side_part_wavy');

// Test 5: Custom displacement - move vertices randomly
engine.applyHairVertexDisplacement('Side_part_wavy', (vertex, index) => {
  const noise = (Math.random() - 0.5) * 0.1;
  return new THREE.Vector3(
    vertex.x + noise,
    vertex.y + noise,
    vertex.z + noise
  );
}, 0.3);

// Test 6: Get geometry info
const info = engine.getHairGeometry('Side_part_wavy');
console.log('Hair has', info.vertexCount, 'vertices');
```

## Performance Considerations

1. **CPU vs GPU**: The vertex displacement methods run on CPU. For real-time animated effects with many vertices, consider using `applyHairVertexShader()` for GPU-based displacement.

2. **Blend Factor**: Use lower blend values (0.2-0.5) when combining multiple effects to avoid extreme deformations.

3. **Update Frequency**: For animated effects, aim for 30-60 FPS updates. Higher frequencies may cause performance issues on lower-end devices.

4. **Vertex Count**: Hair with more vertices will be slower to manipulate. Use `getHairGeometry()` to check vertex count before applying effects.

5. **Geometry Caching**: Original positions are cached automatically. Resetting is fast, but first-time displacement stores the original positions.

## Integration with Latticework

The hair vertex manipulation is fully integrated with the engine-agnostic architecture:

- All methods are in `EngineThree` (engine layer)
- No direct Three.js access needed from application code
- Can be called from HairService or directly from app
- Works seamlessly with existing hair color/outline controls

## Future Enhancements

Potential additions for the vertex manipulation system:

- [ ] Hair strand simulation (per-strand physics)
- [ ] Collision detection with head/body
- [ ] Hair growth/length animation
- [ ] Hair particle effects (sparkles, etc.)
- [ ] Baked animation export
- [ ] Soft body dynamics
- [ ] Hair clumping/grouping
- [ ] Procedural hair generation
- [ ] Hair morphing between styles

## Troubleshooting

**Q: Hair disappears after applying effects**
A: Check blend values - values > 1.0 can cause extreme displacement. Use `resetHairGeometry()` to restore.

**Q: Effects look too subtle**
A: Increase amplitude/strength/intensity values, or increase blend factor to 1.0.

**Q: Performance is slow**
A: Reduce update frequency, use lower blend values, or switch to shader-based effects.

**Q: Effects don't animate smoothly**
A: Make sure you're passing an incrementing `time` value to animated effects like wave.

**Q: Multiple effects interfere with each other**
A: Effects blend multiplicatively. Reset geometry between different effect types, or use lower blend values.

## Architecture Notes

All vertex manipulation happens in the `EngineThree` layer to maintain the engine-agnostic latticework architecture:

```
┌─────────────────────────────────┐
│   Application / UI Layer        │
│   (HairSection, HairService)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Latticework Layer              │
│   (State Management, XState)     │
│   - HairService                  │
│   - HairMachine                  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Engine Layer (EngineThree)    │
│   - Vertex manipulation methods  │
│   - Three.js geometry access     │
│   - GPU shader integration       │
└─────────────────────────────────┘
```

This ensures that if you ever switch from Three.js to another engine (Babylon.js, PlayCanvas, etc.), only the `EngineThree` layer needs to be rewritten.
