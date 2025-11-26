import React, { useEffect, useRef } from 'react';
import '@babylonjs/loaders';
import {
  ArcRotateCamera,
  Color3,
  HemisphericLight,
  SceneLoader,
  Vector3,
  Engine as BabylonEngine,
  Scene as BabylonScene,
  Mesh,
  Skeleton,
  AnimationGroup
} from '@babylonjs/core';
import { useBabylonState } from '../context/babylonContext';

type CharacterReady = {
  scene: BabylonScene;
  meshes: Mesh[];
  skeletons: Skeleton[];
  animations: AnimationGroup[];
};

type Props = {
  src: string;
  onReady?: (payload: CharacterReady) => void;
  onProgress?: (progress: number) => void;
  className?: string;
};

export function CharacterBabylonScene({ src, onReady, onProgress, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<BabylonEngine | null>(null);
  const sceneRef = useRef<BabylonScene | null>(null);
  const { engine } = useBabylonState();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const babylonEngine = new BabylonEngine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      disableWebGL2Support: false
    });
    engineRef.current = babylonEngine;

    const scene = new BabylonScene(babylonEngine);
    sceneRef.current = scene;

    // Camera
    const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);

    // Lighting
    const light = new HemisphericLight('light1', new Vector3(0, 1, 0), scene);
    light.intensity = 0.9;
    light.diffuse = new Color3(1, 1, 1);

    // Load GLB
    (async () => {
      try {
        const result = await SceneLoader.AppendAsync('', src, scene, (evt: any) => {
          if (evt.lengthComputable) {
            onProgress?.((evt.loaded / evt.total) * 100);
          }
        });

        const meshes = scene.meshes.filter(m => m instanceof Mesh) as Mesh[];
        const skeletons = scene.skeletons || [];
        const animations = (result as any)?.animationGroups || scene.animationGroups || [];
        console.log('[CharacterBabylonScene] Loaded animationGroups:', animations.length, animations.map((g: any, idx: number) => g?.name || `clip_${idx}`));

        // Allow Babylon engine to manage baked animation playback (first clip plays by default)

        // Center model roughly
        if (meshes.length) {
          const boundingInfo = (meshes[0] as any).getHierarchyBoundingVectors();
          const size = boundingInfo.max.subtract(boundingInfo.min);
          const maxDim = Math.max(size.x, size.y, size.z);
          const desired = 2;
          const scale = desired / (maxDim || 1);
          meshes.forEach(m => m.scaling.scaleInPlace(scale));

          // Place feet at y=0
          const newBounds = (meshes[0] as any).getHierarchyBoundingVectors();
          const center = newBounds.max.add(newBounds.min).scale(0.5);
          const minY = newBounds.min.y;
          meshes.forEach(m => m.position.addInPlace(new Vector3(-center.x, -minY, -center.z)));
        }

        engine.onReady({
          scene,
          meshes: meshes as any,
          skeletons,
          animations,
        });

        onReady?.({
          scene,
          meshes,
          skeletons,
          animations
        });
      } catch (err) {
        console.error('[CharacterBabylonScene] Error loading model', err);
      }
    })();

    // Render loop
    babylonEngine.runRenderLoop(() => {
      scene.render();
    });

    // Resize
    const handleResize = () => {
      babylonEngine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      babylonEngine.dispose();
      engineRef.current = null;
      sceneRef.current = null;
    };
  }, [src, onProgress, onReady, engine]);

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
