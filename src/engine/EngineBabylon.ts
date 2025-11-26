import {
  AnimationGroup,
  Mesh,
  MorphTargetManager,
  Nullable,
  Scene,
  Skeleton
} from '@babylonjs/core';

/**
  * Minimal Babylon engine adapter to share the same interface shape used by the animation service.
  * This is intentionally lightweight for the first pass; methods are mostly no-ops until
  * morph targets / bones are wired for the Babylon avatar.
  */
export class EngineBabylon {
  private scene: Nullable<Scene> = null;
  private meshes: Mesh[] = [];
  private skeletons: Skeleton[] = [];
  private animations: AnimationGroup[] = [];
  private bakedCurrent: string | null = null;
  private bakedPaused = false;

  onReady = ({
    scene,
    meshes,
    skeletons = [],
    animations = [],
  }: {
    scene: Scene;
    meshes: Mesh[];
    skeletons?: Skeleton[];
    animations?: AnimationGroup[];
  }) => {
    this.scene = scene;
    this.meshes = meshes;
    this.skeletons = skeletons;
    this.animations = animations;
    // Play all animation groups by default (matches earlier behavior)
    this.bakedCurrent = this.getName(this.animations[0], 0) ?? null;
    this.bakedPaused = false;
    this.animations.forEach((g) => {
      try { (g as any).reset?.(); (g as any).play?.(true); (g as any).pause = false; } catch {}
    });
  };

  update = (_dt: number) => {
    // Scene render is driven externally by the Babylon render loop created in the scene component.
  };

  pause = () => {};
  resume = () => {};
  getActiveTransitionCount = () => 0;

  // --- Morphs / AUs (stub implementations for now) ---
  setAU = (_id: number | string, _v: number) => {};
  setMorph = (name: string, value: number) => {
    if (!this.meshes.length) return;
    for (const mesh of this.meshes) {
      const mtm = mesh.morphTargetManager as MorphTargetManager | undefined;
      if (!mtm) continue;
      const target = mtm.getTargetByName(name);
      if (target) target.influence = value;
    }
  };

  transitionAU = (id: number | string, v: number, _durMs?: number) => this.setAU(id, v);
  transitionMorph = (key: string, v: number, _durMs?: number) => this.setMorph(key, v);

  // Continuum helpers (stub)
  setEyesHorizontal = (_v: number) => {};
  setEyesVertical = (_v: number) => {};
  setHeadHorizontal = (_v: number) => {};
  setHeadVertical = (_v: number) => {};
  setHeadTilt = (_v: number) => {};
  setJawHorizontal = (_v: number) => {};
  setTongueHorizontal = (_v: number) => {};
  setTongueVertical = (_v: number) => {};

  resetToNeutral = () => {
    this.meshes.forEach(m => {
      const mtm = m.morphTargetManager as MorphTargetManager | undefined;
      if (mtm) {
        for (let i = 0; i < mtm.numTargets; i++) {
          const t = mtm.getTarget(i);
          if (t) t.influence = 0;
        }
      }
    });
  };

  // ---- Baked animation helpers (mirror EngineThree API shape) ----
  private getName = (g: AnimationGroup | undefined, idx: number) => (g as any)?.name ?? `clip_${idx}`;

  getBakedClipNames = () => this.animations.map((g, idx) => this.getName(g, idx));

  getCurrentBakedClip = () => this.bakedCurrent;

  setBakedClip = (name: string) => {
    const target = this.animations.find((g, idx) => this.getName(g, idx) === name);
    if (!target) return;
    this.animations.forEach((g) => {
      if (g !== target) {
        try { (g as any).stop?.(); (g as any).reset?.(); (g as any).pause?.(); } catch {}
      }
    });
    this.bakedCurrent = name;
    if (!this.bakedPaused) {
      try { (target as any).reset?.(); (target as any).play?.(true); (target as any).pause = false; } catch {}
    }
  };

  setBakedPlayback = (play: boolean) => {
    if (!this.animations.length) return;
    if (!this.bakedCurrent) this.bakedCurrent = this.getName(this.animations[0], 0) ?? null;
    const current = this.animations.find((g, idx) => this.getName(g, idx) === this.bakedCurrent);
    if (!current) return;
    this.bakedPaused = !play;
    try {
      if (play) {
        (current as any).reset?.();
        (current as any).play?.(true);
        (current as any).pause = false;
      } else {
        (current as any).pause?.();
      }
    } catch {}
  };

  resetBakedClip = () => {
    if (!this.bakedCurrent) return;
    const current = this.animations.find((g, idx) => this.getName(g, idx) === this.bakedCurrent);
    if (!current) return;
    try { (current as any).reset?.(); if (!this.bakedPaused) (current as any).play?.(true); } catch {}
  };

  getBakedPlaybackState = () => !this.bakedPaused && !!this.animations.length;
}
