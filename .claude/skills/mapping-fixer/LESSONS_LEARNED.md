# Mapping Fixer - Lessons Learned

This document captures key lessons from fixing the Betta fish gill mappings.

## Critical Workflow Steps

### 1. Always Rebuild After Changes

**Problem**: Changes to `node_modules/loomlarge/src/presets/bettaFish.ts` don't take effect until the package is rebuilt AND relinked.

**Solution**: After any changes to LoomLarge source files:
```bash
cd /path/to/LoomLarge
npm run build
npm link

cd /path/to/loomlarge-example
npm link loomlarge
npm run build
```

### 2. Data Structure Consistency

When adding new AUs, ALL of these must be updated consistently:

| Structure | Purpose | Key Format |
|-----------|---------|------------|
| `FishAction` enum | AU IDs with semantic names | `GILL_L_FLARE = 50` |
| `FISH_BONE_NODES` | Semantic name → actual bone | `GILL_L: 'Bone046_Armature'` |
| `FISH_BONE_BINDINGS` | AU ID → bone rotations | `[FishAction.GILL_L_FLARE]: [...]` |
| `FISH_AU_INFO` | AU metadata for UI | `'50': { id: '50', name: 'Gill L Flare', ... }` |
| `FISH_CONTINUUM_PAIRS_MAP` | Bidirectional pairs | `[FishAction.GILL_L_CLOSE]: { pairId: ... }` |
| `FISH_CONTINUUM_LABELS` | Human-readable slider labels | `'51-50': 'Gill L — Close ↔ Flare'` |
| `FISH_COMPOSITE_ROTATIONS` | Engine rotation definitions | `{ node: 'GILL_L', roll: { aus: [...] } }` |

### 3. Bilateral vs Unilateral Mappings

**Bilateral structures** (like gills) should have:
- Separate L and R bone nodes
- Separate L and R AUs (e.g., GILL_L_FLARE, GILL_R_FLARE)
- A combined AU for synchronized animation (e.g., GILLS_FLARE)
- Mirrored rotation directions (L uses `scale: 1`, R uses `scale: -1` for rz)

**Example**: Fish gills are bilateral - they have operculum on BOTH sides
- Wrong: `THROAT_L` (left only) + `GILL_R` (right only) - asymmetric naming
- Right: `GILL_L` + `GILL_R` with consistent naming pattern

### 4. Semantic Naming Matters

**Problem**: Original fish preset had `THROAT_L` (left side) and `GILL_R` (right side) which:
- Used inconsistent terminology (throat vs gill)
- Made it unclear they were paired structures
- Caused confusion about which bones controlled what

**Solution**: Use consistent, anatomically correct naming:
- `GILL_L`, `GILL_L_MID`, `GILL_L_TIP` for left side
- `GILL_R`, `GILL_R_MID`, `GILL_R_TIP` for right side

### 5. Rotation Axis Selection

Fish bones typically use:
- `rz` (roll) - horizontal sweep motion (tail left/right, gill flare/close)
- `rx` (pitch) - vertical motion (dorsal erect/fold, pitch up/down)
- `ry` (yaw) - turning motion (head turn left/right)

For gills:
- Gills flare outward from the body centerline
- Left gill: positive rz = flare outward
- Right gill: negative rz = flare outward (mirrored)

### 6. UI Updates Require Package Exports

The SliderDrawer imports from `loomlarge`:
```typescript
import { AU_INFO, FISH_AU_INFO, FISH_CONTINUUM_PAIRS_MAP, FISH_CONTINUUM_LABELS } from 'loomlarge';
```

If these aren't exported from `LoomLarge/src/index.ts`, the UI won't see them.

### 7. Debugging Missing Controls

If AU controls disappear from the UI:

1. **Check FISH_AU_INFO** - Is the AU defined with correct `facePart`?
2. **Check FISH_CONTINUUM_PAIRS_MAP** - Is it paired correctly?
3. **Check exports in index.ts** - Is it being exported?
4. **Rebuild the package** - Did you run `npm run build`?
5. **Relink the package** - Did you run `npm link` in both directories?

### 8. Don't Remove Working Mappings

**Mistake**: While adding gill mappings, nearly lost the head/body orientation mappings (AUs 2-7) which were working correctly.

**Prevention**:
- Make incremental changes
- Test after each change
- Don't modify unrelated sections
- Use version control (git) to track changes

## Fish Bone Reference

```
Bones 046-051: Gill/Operculum area
  - Even numbers (046, 048, 050) = LEFT side
  - Odd numbers (047, 049, 051) = RIGHT side

Bone046 → GILL_L (root)
Bone048 → GILL_L_MID
Bone050 → GILL_L_TIP

Bone047 → GILL_R (root)
Bone049 → GILL_R_MID
Bone051 → GILL_R_TIP
```

## Testing Checklist

After making mapping changes:

- [ ] Package rebuilt (`npm run build` in LoomLarge)
- [ ] Package relinked (`npm link` in both directories)
- [ ] App rebuilt (`npm run build` in example app)
- [ ] Dev server restarted
- [ ] Open AU panel in UI
- [ ] Verify all sections appear (Body Orientation, Caudal Fin, etc.)
- [ ] Test continuum sliders work bidirectionally
- [ ] Test combined AUs animate both sides
- [ ] No console errors

## Common Mistakes

1. **Forgetting to rebuild** - Most common cause of "nothing changed"
2. **Inconsistent AU IDs** - Using wrong number in one of the data structures
3. **Wrong rotation axis** - Fish bones have unusual orientations
4. **Missing continuum pair** - Slider won't show or won't work bidirectionally
5. **Wrong bone name** - Typo in `FISH_BONE_NODES` causes silent failure
