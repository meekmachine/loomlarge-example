declare module '@babylonjs/core' {
  export type Nullable<T> = T | null;
  export class Scene { constructor(engine?: Engine); meshes: any[]; skeletons: any[]; animationGroups: any[]; onReadyObservable: any; render(): void; dispose(): void; }
  export class Engine { constructor(canvas: any, antialias?: boolean, opts?: any); runRenderLoop(cb: () => void): void; resize(): void; dispose(): void; }
  export class ArcRotateCamera { constructor(name: string, alpha: number, beta: number, radius: number, target: any, scene: Scene); attachControl(canvas: any, noPreventDefault?: boolean): void; }
  export class HemisphericLight { constructor(name: string, direction: any, scene: Scene); intensity: number; diffuse: any; }
  export class Vector3 { constructor(x?: number, y?: number, z?: number); static Zero(): Vector3; static Up(): Vector3; addInPlace(v: Vector3): Vector3; subtract(v: Vector3): Vector3; scale(f: number): Vector3; }
  export class Color3 { constructor(r?: number, g?: number, b?: number); static White(): Color3; }
  export class Mesh { morphTargetManager: any; scaling: any; position: any; getHierarchyBoundingVectors(): { min: Vector3; max: Vector3 }; }
  export class Skeleton {}
  export class AnimationGroup { name?: string; reset?(): void; play?(loop?: boolean): void; pause?(): void; stop?(): void; }
  export class MorphTargetManager { numTargets: number; getTarget(index: number): any; getTargetByName(name: string): any; }
  export const SceneLoader: any;
}

declare module '@babylonjs/loaders';
