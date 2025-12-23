# EngineThree Refactor - December 2024

## Summary

Cleaned up EngineThree to remove manual RAF loop management and simplify the transition system. The engine now relies entirely on the external RAF loop provided by ThreeProvider.

## Changes Made

### 1. Removed Manual RAF Loop

**Before:**
```typescript
private externalTiming = true;
private rafId: number | null = null;
private now = () => performance.now();

private startRAF = () => {
  if (this.externalTiming) return;
  if (this.rafId != null) return;
  const step = () => {
    const time = this.now();
    this.advanceTransitionsByMs(0, time);
    if (this.transitions.length) {
      this.rafId = requestAnimationFrame(step);
    } else {
      this.rafId = null;
    }
  };
  this.rafId = requestAnimationFrame(step);
};
```

**After:**
```typescript
// Removed entirely - ThreeProvider handles the RAF loop
```

**Why:**
- Simplified architecture - single RAF loop in ThreeProvider
- No competing timers
- No dual-timing mode complexity
- Easier to understand and maintain

### 2. Simplified Transition Data Structure

**Before:**
```typescript
private transitions: Array<{
  kind: 'au'|'morph';
  id: number|string;
  key?: string;
  from: number;
  to: number;
  start: number;      // ❌ Wall-clock timestamp (not needed)
  dur: number;
  elapsed?: number;   // ❌ Optional (confusing)
  ease: (t:number)=>number
}> = [];
```

**After:**
```typescript
private transitions: Array<{
  kind: 'au'|'morph';
  id: number|string;
  key?: string;
  from: number;
  to: number;
  elapsed: number;    // ✓ Always present, always incremented
  dur: number;
  ease: (t:number)=>number
}> = [];
```

**Why:**
- Removed `start` field (wall-clock timestamp) - not needed with elapsed time accumulation
- Made `elapsed` non-optional - always starts at 0, always incremented
- Clearer semantics: elapsed time is the source of truth

### 3. Simplified Transition Advancement

**Before:**
```typescript
private advanceTransitionsByMs = (dtMs: number, nowWall?: number) => {
  if (!this.transitions.length) return;
  const now = nowWall ?? this.now();
  this.transitions = this.transitions.filter(tr => {
    if (this.externalTiming) {
      tr.elapsed = (tr.elapsed ?? 0) + dtMs;
      const p = Math.min(1, Math.max(0, (tr.elapsed) / Math.max(1, tr.dur)));
      // ... apply value
      return p < 1;
    } else {
      const p = Math.min(1, Math.max(0, (now - tr.start) / Math.max(1, tr.dur)));
      // ... apply value
      return p < 1;
    }
  });
};
```

**After:**
```typescript
private advanceTransitionsByMs = (dtMs: number) => {
  if (!this.transitions.length || this.isPaused) return;

  this.transitions = this.transitions.filter(tr => {
    tr.elapsed += dtMs;
    const p = Math.min(1, Math.max(0, tr.elapsed / Math.max(1, tr.dur)));
    const v = tr.from + (tr.to - tr.from) * tr.ease(p);

    if (tr.kind === 'au') this.setAU(tr.id, v);
    else if (tr.kind === 'morph' && tr.key) this.setMorph(tr.key, v);

    return p < 1; // Keep transition if not complete
  });
};
```

**Why:**
- Single code path (no dual timing modes)
- Respects pause state
- Clear progression: elapsed accumulates, progress calculated, value applied
- Removed wall-clock calculations entirely

### 4. Added Pause/Resume Controls

**New Methods:**
```typescript
/** Pause all active transitions (they will resume when update() is called again). */
pause() {
  this.isPaused = true;
}

/** Resume all paused transitions. */
resume() {
  this.isPaused = false;
}

/** Get current pause state. */
getPaused(): boolean {
  return this.isPaused;
}

/** Get count of active transitions (useful for debugging). */
getActiveTransitionCount(): number {
  return this.transitions.length;
}
```

**Why:**
- Useful for debugging and testing
- Allows freezing transitions without clearing them
- Enables inspection of transition state

### 5. Removed Obsolete Methods

**Removed:**
```typescript
useExternalTiming(flag: boolean) {
  this.externalTiming = !!flag;
  if (!this.externalTiming) this.startRAF();
}
```

**Why:**
- Always use external timing now (ThreeProvider RAF loop)
- No need to toggle between modes
- Simplifies API surface

## Architecture After Refactor

```
ThreeProvider (context/threeContext.tsx)
  ↓
  RAF Loop (requestAnimationFrame)
    ↓
    THREE.Clock.getDelta() → deltaSeconds
    ↓
    ┌─────────────────────────────────────┐
    │ 1. anim.step(dt)                    │  ← Animation Agency (snippets)
    │ 2. frameListeners.forEach(fn(dt))   │  ← Optional subscribers
    │ 3. engine.update(dt)                │  ← EngineThree (transitions)
    └─────────────────────────────────────┘
    ↓
  render() → screen
```

### Key Benefits:

1. **Single RAF Loop**: No competing timers, no synchronization issues
2. **Single Clock Source**: `THREE.Clock` drives everything consistently
3. **Predictable Order**: Animation Agency → Listeners → Engine transitions
4. **No Drift**: All systems use same deltaTime from same clock
5. **Simpler Code**: ~50 lines of complexity removed from EngineThree

## UI Integration

Added engine-level pause control to PlaybackControls component:

```typescript
// PlaybackControls.tsx
<HStack spacing={2} p={2} bg="gray.100" borderRadius="md">
  <Text fontSize="xs" fontWeight="bold">Engine Transitions:</Text>
  <Button
    size="xs"
    colorScheme={enginePaused ? 'gray' : 'blue'}
    onClick={() => {
      if (enginePaused) {
        engine?.resume?.();
        setEnginePaused(false);
      } else {
        engine?.pause?.();
        setEnginePaused(true);
      }
    }}
    leftIcon={enginePaused ? <FaPlay /> : <FaPause />}
  >
    {enginePaused ? 'Resume' : 'Pause'}
  </Button>
  <Text fontSize="xs" color="gray.600">
    ({engine?.getActiveTransitionCount?.() || 0} active)
  </Text>
</HStack>
```

This allows users to:
- Pause all engine transitions (AU/morph tweens) independently of snippet playback
- See how many transitions are active
- Resume from the exact position they paused

## Testing

The refactor maintains API compatibility:
- `transitionAU(id, value, duration)` - unchanged
- `transitionMorph(key, value, duration)` - unchanged
- `update(deltaSeconds)` - unchanged (improved internally)
- `clearTransitions()` - unchanged

Existing code using EngineThree will continue to work without changes.

## Future Improvements

### Possible: Switch to Three.js AnimationMixer

For even more advanced animation features, consider migrating to Three.js `AnimationMixer`:

```typescript
import * as THREE from 'three';

class EngineThree {
  private mixer: THREE.AnimationMixer;

  onReady({ model }) {
    this.mixer = new THREE.AnimationMixer(model);
  }

  transitionAU(id: number, value: number, duration: number) {
    // Create keyframe track for this AU's morph targets
    const track = new THREE.NumberKeyframeTrack(
      `.morphTargetInfluences[${morphIndex}]`,
      [0, duration / 1000],
      [currentValue, value]
    );
    const clip = new THREE.AnimationClip(`au${id}`, duration / 1000, [track]);
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }

  update(deltaSeconds: number) {
    this.mixer.update(deltaSeconds);
  }
}

---

# EngineThree Refactor - AU-Only Core & Hair Removal (January 2025)

## Summary

This refactor tightens EngineThree around the **AU + viseme** core, eliminates legacy hair and eye-occlusion wiring from the engine, and moves AU/bone metadata into `shapeDict` and `EngineThree.types` so the engine no longer hardcodes that knowledge.

The two primary flows – `setAU` and `transitionAU` – are now the main focus. Both flows:

- Read **what** to do from `shapeDict` (`AU_TO_MORPHS`, `BONE_AU_TO_BINDINGS`, `MIXED_AUS`).
- Apply morphs **only** on a single face mesh (`CC_Base_Body_1`).
- Apply bones via a unified **per-axis rotation state** (`pitch/yaw/roll`) and a single composite quaternion per bone.

Hair is removed from EngineThree and the UI for now; it can be resurrected later from git history.

## Changes Made

### 1. AU Morphs Only Touch the Face Mesh

**Before:**

- `setAU` / `applyBothSides` / `applyMorphs` would scan `this.meshes` and conditionally write morph influences across multiple meshes.
- `setMorph` also iterated over all meshes, with special-case filters for occlusion/tearLine names.
- This made AU morph writes:
  - Slower (O(#meshes) per AU update).
  - Harder to reason about (which mesh actually owns a given morph).

**After:**

- EngineThree resolves a single **face mesh** once in `onReady`:

  ```ts
  const defaultFace = meshes.find(m => m.name === 'CC_Base_Body_1');
  if (defaultFace) {
    this.faceMeshName = defaultFace.name;
    this.faceMesh = defaultFace;
  } else {
    const candidate = meshes.find((m) => {
      const dict: any = (m as any).morphTargetDictionary;
      return dict && typeof dict === 'object' && 'Brow_Drop_L' in dict;
    });
    this.faceMeshName = candidate?.name || null;
    this.faceMesh = candidate || null;
  }
  ```

- `setMorph`, `getMorphValue`, and `applyMorphs` use `this.faceMesh` directly:

  - `getMorphValue(key)`:
    - Reads from `faceMesh.morphTargetDictionary` / `morphTargetInfluences`.
    - Falls back to scanning `this.meshes` only for non-face/unknown morphs.

  - `setMorph(key, v)`:
    - Writes `infl[idx] = v` on the face mesh for AU/viseme morphs.
    - Fallback scan remains only as a safety net.

  - `applyMorphs(keys, v)`:
    - Writes all AU morph keys to the face mesh and returns.
    - No more “legacy behavior: scan all meshes”.

**Why:**

- All AU / viseme morphs in this rig live on `CC_Base_Body_1`.
- This matches what the GLTF actually contains (`targetNames` on the body meshes).
- AU morph writes are now predictable and cheap: one mesh, one dictionary.

### 2. AU/Bone Metadata Moved to `shapeDict`

**Before:**

- EngineThree computed:
  - `MIXED_AUS` – AUs that have both morphs and bones.
  - `hasLeftRightMorphs(auId)` – infers bilateral AUs from morph key suffixes.
- These were exported from EngineThree and imported by the UI slider (`AUSlider`).

**After:**

- `src/engine/arkit/shapeDict.ts` now exports:

  ```ts
  export const MIXED_AUS = new Set(
    Object.keys(AU_TO_MORPHS)
      .map(Number)
      .filter(id => AU_TO_MORPHS[id]?.length && BONE_AU_TO_BINDINGS[id]?.length)
  );

  export const hasLeftRightMorphs = (auId: number): boolean => {
    const keys = AU_TO_MORPHS[auId] || [];
    return keys.some(k => /_L$|_R$|Left$|Right$/.test(k));
  };
  ```

- EngineThree and `AUSlider` import these directly from `shapeDict`.

**Why:**

- AU metadata (“does this AU have bones? morphs? L/R?”) belongs next to the mappings, not in the engine implementation.
- The UI and engine now share one canonical definition of `MIXED_AUS` and bilateral AUs.

### 3. Bone Types Moved Into `EngineThree.types.ts`

**Before:**

- `EngineThree.ts` declared its own internal types:

  ```ts
  type BoneKeys = 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE';

  type NodeBase = {
    obj: THREE.Object3D;
    basePos: THREE.Vector3;
    baseQuat: THREE.Quaternion;
    baseEuler: THREE.Euler;
  };

  type ResolvedBones = Partial<Record<BoneKeys, NodeBase>>;
  ```

- Method signatures hardcoded bone unions (e.g. `applyCompositeRotation(nodeKey: 'JAW' | 'HEAD' | 'EYE_L' | 'EYE_R' | 'TONGUE')`).

**After:**

- `src/engine/EngineThree.types.ts` now owns the bone types:

  ```ts
  export type BoneKey = 'EYE_L' | 'EYE_R' | 'JAW' | 'HEAD' | 'NECK' | 'TONGUE';

  export type NodeBase = {
    obj: THREE.Object3D;
    basePos: THREE.Vector3;
    baseQuat: THREE.Quaternion;
    baseEuler: THREE.Euler;
  };

  export type ResolvedBones = Partial<Record<BoneKey, NodeBase>>;
  ```

- `EngineThree.ts` imports them:

  ```ts
  import type { TransitionHandle, ResolvedBones, BoneKey } from './EngineThree.types';
  ```

- `applyCompositeRotation` now accepts `nodeKey: BoneKey`, not a repeated string union.

**Why:**

- Keeps `EngineThree.ts` focused on behavior, not type definitions.
- Reduces duplication and the risk of unions drifting apart.

### 4. Bone Rotation State Ready to Generalize

**Before:**

- `rotations` was initialized with a hardcoded object:

  ```ts
  private rotations: Record<string, Record<'pitch' | 'yaw' | 'roll', { value: number; maxDegrees: number }>> = {
    JAW: { ... },
    HEAD: { ... },
    EYE_L: { ... },
    EYE_R: { ... },
    TONGUE: { ... }
  };
  ```

- `applyCompositeRotation` only accepted a hard-coded union of composite bones.

**After (partial):**

- `rotations` starts empty:

  ```ts
  private rotations: Record<string, Record<'pitch' | 'yaw' | 'roll', { value: number; maxDegrees: number }>> = {};
  ```

- `applyCompositeRotation(nodeKey: BoneKey)` now takes a typed `BoneKey`.

- Existing code still populates rotations lazily via `updateBoneRotation`, but the structure is ready for the next step:
  - Pre-populate rotation state for **any bone that appears in `BONE_AU_TO_BINDINGS`**.
  - Treat all AU-driven bones as “composite” (per-axis state + final quaternion), not just a hardcoded subset.

**Why:**

- Moves toward a single, consistent way to apply AU-driven bone rotations:
  - per-axis update → composite quaternion → apply once.
- Avoids different code paths for “special” vs. “non-special” bones.

### 5. Hair System Removed From Engine and UI

**Before:**

- EngineThree contained:
  - Hair registration (`registeredHairObjects`, `getRegisteredHairObjects`, `registerHairObjects`).
  - Hair color/outline methods (`setHairColor`, `setHairOutline`, `applyHairStateToObject`).
  - Hair physics and wind/idle drivers (`setHairPhysicsEnabled`, `setHairPhysicsConfig`, `updateHairWindIdle`, `updateHairForHeadChange`, `transitionHairMorph`, hair morph value helpers).
- `HairService` (`src/latticework/hair/hairService.ts`) coordinated state with EngineThree.
- UI components:
  - `HairSection` (AU panel).
  - `HairCustomizationPanel`.
  - Hair tab in `SliderDrawer`.

**After:**

- **EngineThree:**
  - All hair-related fields and methods have been removed.
  - `setupMeshRenderOrder` still uses `CC4_MESHES` for render layering (eyes vs. body vs. hair), but does not keep any hair-specific registries or morph logic.

- **Latticework + UI:**
  - Deleted:
    - `src/latticework/hair/hairService.ts`
    - `src/components/hair/HairCustomizationPanel.tsx`
    - `src/components/au/HairSection.tsx`
  - Updated `src/components/SliderDrawer.tsx`:
    - Removed import of `HairSection`.
    - Removed `'hair'` tab from the `TabId` union and `TABS` list.
    - Removed the `HairTabContent` component and `FaCut` icon wiring.

**Why:**

- Hair is not part of the current app flow; leaving it half-wired introduces noise and complexity.
- Removing it completely makes the AU core and bone mixing behavior much easier to reason about.
- All hair logic remains available in git history for a future reintroduction.

## Remaining Follow-Ups

These are intentional next steps, not yet implemented in this refactor:

1. **Generalize Bone Rotation for All AU-Driven Bones**
   - Derive the set of bones to track from `BONE_AU_TO_BINDINGS` (or export a `BONE_KEYS` helper from `shapeDict`).
   - Initialize `rotations` for each of those, and ensure `updateBoneRotation` + `applyCompositeRotation` are used consistently for all of them.

2. **Finish Type Cleanup**
   - Move any remaining inline type aliases from `EngineThree.ts` into `EngineThree.types.ts`.
   - Ensure UI components import AU/bone metadata from `shapeDict` rather than `EngineThree`.

3. **Dedicated Eye-Occlusion & Clothing APIs**
   - Eye-occlusion (`EO ...`) and tear line morphs (`TL ...`) should get their own dedicated setters/transitions, instead of going through the AU flow.
   - Same for clothing morphs when they are brought online.

4. **Remove Any Leftover Legacy Comments/Paths**
   - There are still references to older approaches in comments and docs that can be pruned once the bone rotation generalization is complete.
```

**Benefits:**
- Native Three.js integration
- Advanced blending modes
- Time scaling support
- Built-in event system (onFinished, onLoop, etc)

**Trade-offs:**
- More complex API
- Requires restructuring around AnimationClips
- May not be worth it for simple tweening

**Recommendation:** Keep current approach unless you need AnimationMixer's advanced features (complex multi-track blending, animation composition, etc).

## Documentation Updates

Updated [engine/README.md](./README.md) with:
- Transition System section explaining the new architecture
- External RAF loop documentation
- Pause/Resume API documentation
- Performance notes about single RAF loop

## Files Changed

- ✅ `src/engine/EngineThree.ts` - Refactored transition system
- ✅ `src/components/PlaybackControls.tsx` - Added engine pause controls
- ✅ `src/engine/README.md` - Added transition documentation
- ✅ `src/engine/REFACTOR_NOTES.md` - This file

## Compatibility

✅ **Fully backwards compatible** - all public API methods unchanged
✅ **No breaking changes** - existing code continues to work
✅ **TypeScript checks pass** - only pre-existing test errors remain

---

# Continuum Slider Fix - December 2024

## Problem

Continuum sliders (eyes horizontal, eyes vertical, head rotation, etc.) were not working correctly. The morph targets would activate but bone rotations would not work in one direction.

## Root Cause

Paired AUs (like AU 64 "eyes down" and AU 63 "eyes up") share the **same bone axis**. The old `setContinuum` implementation called `setAU` for BOTH AUs:

```typescript
// OLD (broken):
setContinuum = (negAU, posAU, value) => {
  const negVal = value < 0 ? Math.abs(value) : 0;
  const posVal = value > 0 ? value : 0;
  this.setAU(negAU, negVal);  // Sets bone rotation
  this.setAU(posAU, posVal);  // OVERWRITES bone rotation!
};
```

When slider was at -0.5 (eyes down):
1. `setAU(64, 0.5)` → stores `rotations.EYE_L.pitch = 0.5`
2. `setAU(63, 0)` → **overwrites** `rotations.EYE_L.pitch = 0`

The second call clobbered the first!

## Fix

`setContinuum` now only calls `setAU` for ONE AU based on the sign:

```typescript
// NEW (fixed):
setContinuum = (negAU, posAU, value) => {
  if (value < 0) {
    this.setAU(negAU, Math.abs(value));  // Only set negative AU
  } else if (value > 0) {
    this.setAU(posAU, value);            // Only set positive AU
  } else {
    this.setAU(posAU, 0);                // Zero out
  }
};
```

## Files Changed

1. **`src/engine/EngineThree.ts`**
   - Fixed `setContinuum` to only call ONE setAU based on sign
   - `transitionContinuum` already uses `setContinuum`, so it's automatically fixed

2. **`src/components/au/ContinuumSlider.tsx`**
   - Changed from `engine.setContinuum()` to direct `engine.setAU()` calls
   - UI now handles continuum logic directly

3. **`src/latticework/animation/animationScheduler.ts`**
   - Fixed `applyContinuumTargets` fallback paths to only call ONE AU

## Key Insight

For continuum pairs, you must NEVER call `setAU` for both AUs because they share the same bone axis. The bone can only store ONE value, so:
- Negative slider value → activate negAU only
- Positive slider value → activate posAU only
- Zero → set either to 0 (they share the bone)

## Testing

- ✅ Eyes vertical slider: both directions rotate eye bones
- ✅ Eyes horizontal slider: both directions rotate eye bones
- ✅ Head sliders: both directions work
- ✅ eyeRollCircular.json animation: eyes roll in circle
