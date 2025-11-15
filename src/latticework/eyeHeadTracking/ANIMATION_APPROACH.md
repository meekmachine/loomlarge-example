# Eye/Head Tracking Animation Approach

## Problem Statement

We want to use the animation service (curve scheduling) for eye/head tracking instead of direct composite method calls, but the composite methods need to coordinate multiple AUs and bones simultaneously.

## Current Working Approach (Direct Composite)

```typescript
// Direct composite calls (WORKING)
engine.applyEyeComposite(yaw, pitch);     // yaw: -1 to +1, pitch: -1 to +1
engine.applyHeadComposite(yaw, pitch, roll);
```

This works because `applyCompositeMotion` internally:
- Splits continuum values into directional AU pairs (e.g., yaw=-0.5 → AU61=0.5, AU62=0)
- Applies morphs for each direction
- Applies coordinated bone rotations using `applyBoneComposite`
- Updates both morphs AND bones in sync

## Challenge with Animation Scheduling

The animation service schedules individual AU curves:
```typescript
anim.schedule({
  name: 'eyeGaze',
  curves: {
    '61': [{ time: 0, intensity: 0.5 }],  // Individual AU
    '62': [{ time: 0, intensity: 0 }]
  }
});
```

Then the animation service calls:
```typescript
engine.setAU(61, 0.5);  // Individual AU application
engine.setAU(62, 0);
```

### Why This Breaks Composite Movement

When `setAU` is called for composite AUs (61, 62, 63, 64, 31, 32, 33, 54):
1. It applies the morph for that AU
2. It updates the bone rotation state
3. It calls `applyCompositeRotation` for the affected bone

BUT - the bone rotation state expects CONTINUUM values (e.g., -0.5 for left), not individual AU intensities (0.5 for AU61 + 0 for AU62).

The `setAU` logic tries to reconstruct the continuum value from the AU pair:
```typescript
if (axisConfig.negative !== undefined && axisConfig.positive !== undefined) {
  const negValue = this.auValues[axisConfig.negative] ?? 0;
  const posValue = this.auValues[axisConfig.positive] ?? 0;
  axisValue = posValue - negValue;  // Reconstruct continuum
}
```

This works IF both AUs are set, but with animation scheduling:
- Different snippets may set different AUs at different times
- Priority blending may mix values from different snippets
- Result: partial/incorrect movement

## Potential Solutions

### Solution 1: Virtual Continuum AUs

Create virtual AU IDs that represent continuum values:
```typescript
// Virtual AUs (100-series for continuums)
anim.schedule({
  name: 'eyeGaze',
  curves: {
    '100': [{ time: 0, intensity: -0.5 }],  // Eye yaw continuum (-1 to +1)
    '101': [{ time: 0, intensity: 0.3 }]    // Eye pitch continuum (-1 to +1)
  }
});
```

Then in animation service `applyAU`:
```typescript
if (id >= 100 && id < 200) {
  // Virtual continuum AU - call composite method
  switch(id) {
    case 100: // Eye yaw continuum
      engine.updateEyeYaw(v);  // Updates both AU61/62 and bone state
      break;
    case 101: // Eye pitch continuum
      engine.updateEyePitch(v);
      break;
    // ... etc
  }
}
```

### Solution 2: Special Snippet Category

Mark eye/head tracking snippets with a special category that triggers composite handling:
```typescript
anim.schedule({
  name: 'eyeGaze',
  snippetCategory: 'composite_eye',  // Special category
  curves: {
    'yaw': [{ time: 0, intensity: -0.5 }],   // Continuum values
    'pitch': [{ time: 0, intensity: 0.3 }]
  }
});
```

### Solution 3: Keep Direct Composite (Current)

Accept that real-time tracking needs direct composite calls because:
- Sub-frame latency requirements
- Need for coordinated multi-AU updates
- Simplicity and performance

Use animation service ONLY for:
- Pre-authored animation clips
- Lip-sync visemes
- Emotional expressions
- Idle behaviors

Use direct composite calls for:
- Real-time tracking (mouse, webcam)
- Interactive gaze control
- Reactive behaviors

## Implemented Solution: Virtual Continuum AUs

We've implemented **Solution 1 (Virtual Continuum AUs)** as a proof of concept to enable animation-based tracking while preserving composite behavior.

### How It Works

1. **Virtual AU IDs (100-series)**:
   ```typescript
   const VIRTUAL_AUS = {
     EYE_YAW: '100',      // -1 (left) to +1 (right)
     EYE_PITCH: '101',    // -1 (down) to +1 (up)
     HEAD_YAW: '102',     // -1 (left) to +1 (right)
     HEAD_PITCH: '103',   // -1 (down) to +1 (up)
     HEAD_ROLL: '104',    // -1 (left tilt) to +1 (right tilt)
   };
   ```

2. **Scheduler schedules virtual AUs**:
   ```typescript
   anim.schedule({
     name: 'eyeHeadTracking/eyes',
     curves: {
       '100': [{ time: 0, intensity: -0.5 }],  // Eye yaw continuum
       '101': [{ time: 0, intensity: 0.3 }]    // Eye pitch continuum
     },
     snippetCategory: 'eyeHeadTracking',
     snippetPriority: 20
   });
   ```

3. **Animation service host intercepts virtual AUs** (in `threeContext.tsx`):
   ```typescript
   const host = {
     applyAU: (id: number | string, v: number) => {
       const numId = typeof id === 'string' ? parseInt(id, 10) : id;

       // Handle virtual continuum AUs
       if (numId >= 100 && numId < 200) {
         switch(numId) {
           case 100: // Eye Yaw
             continuumState.eyeYaw = v;
             engine.applyEyeComposite(continuumState.eyeYaw, continuumState.eyePitch);
             return;
           case 101: // Eye Pitch
             continuumState.eyePitch = v;
             engine.applyEyeComposite(continuumState.eyeYaw, continuumState.eyePitch);
             return;
           // ... etc
         }
       }

       // Regular AU handling
       engine.setAU(id, v);
     }
   };
   ```

### Benefits

✅ **Uses animation service** - Can leverage priority blending, timing, etc.
✅ **Preserves composite behavior** - Both morphs and bones move together
✅ **Simple interface** - Schedule continuum values directly (-1 to +1)
✅ **No AU pair complexity** - Don't need to split into directional AUs
✅ **Coordinated updates** - Composite methods handle multi-AU/bone coordination

### Tradeoffs

⚠️ **Calling composite on every AU update** - Each virtual AU triggers a full composite call
   - Eye yaw update → calls `applyEyeComposite(yaw, pitch)`
   - Eye pitch update → calls `applyEyeComposite(yaw, pitch)` again
   - Could be optimized to batch updates

⚠️ **State tracking required** - Need to track current continuum values in host
   - Adds complexity to animation service host
   - State could get out of sync if not careful

⚠️ **Virtual AU namespace** - Need to reserve ID range (100-199)
   - Shouldn't conflict with real ARKit AUs (1-99)
   - Need to document this convention

### Current Approach vs. Virtual AU Approach

| Aspect | Direct Composite (Current) | Virtual AU Approach |
|--------|---------------------------|---------------------|
| **Simplicity** | ✅ Very simple | ⚠️ More complex (virtual AUs, host logic) |
| **Performance** | ✅ Direct calls, no overhead | ⚠️ Extra logic in host, redundant composite calls |
| **Animation Integration** | ❌ Bypasses animation service | ✅ Full animation service integration |
| **Priority Blending** | ❌ Not supported | ✅ Supported (blend with other animations) |
| **Timing/Curves** | ❌ Manual implementation needed | ✅ Built-in from animation service |
| **Maintenance** | ✅ Isolated from animation system | ⚠️ Coupled to animation service host |

### Recommendation

**Current production use: Direct composite approach**
- Simpler, faster, proven working
- Best for real-time interactive tracking

**Future exploration: Virtual AU approach**
- Enables advanced animation features (priority blending, curves, etc.)
- Useful if we want to blend tracking with other facial animations
- Could be optimized to batch composite calls

**Both can coexist**:
- Direct composite for simple real-time tracking
- Virtual AUs when animation service features are needed
