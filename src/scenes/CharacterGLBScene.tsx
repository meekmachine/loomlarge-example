import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LoomLargeThree, CC4_PRESET } from 'loomlarge';
import { AU_MAPPING_CONFIG } from '../presets/bettaFish';
import { AnnotationCameraController } from '../camera';
import { createAnimationService, type AnimationService } from '../latticework/animation/animationService';
import type { Engine } from '../latticework/animation/types';
import type { CharacterAnnotationConfig } from '../camera/types';

/**
 * Create an Engine adapter that wraps LoomLargeThree for the animation service.
 */
function createEngineAdapter(engine: LoomLargeThree): Engine {
  return {
    applyAU: (id, v) => engine.setAU(id as number, v),
    setMorph: (key, v) => engine.setMorph(key, v),
    transitionAU: (id, v, dur, balance) => engine.transitionAU(id as number, v, dur, balance),
    transitionMorph: (key, v, dur) => engine.transitionMorph(key, v, dur),
    setViseme: (idx, v, jawScale) => engine.setViseme(idx, v, jawScale),
    transitionViseme: (idx, v, dur, jawScale) => engine.transitionViseme(idx, v, dur, jawScale),
    getCompositeRotations: () => engine.getCompositeRotations(),
    // buildClip removed - using legacy transitionAU path until engine supports it
    onSnippetEnd: (name) => {
      try {
        window.dispatchEvent(new CustomEvent('visos:snippetEnd', { detail: { name } }));
      } catch {}
      try {
        (window as any).__lastSnippetEnded = name;
      } catch {}
    }
  };
}

export type CharacterReady = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  model: THREE.Object3D;
  meshes: THREE.Mesh[];
  animations?: THREE.AnimationClip[];
  cameraController: AnnotationCameraController;
  engine: LoomLargeThree;
  anim: AnimationService;
};

type Props = {
  src?: string;
  onReady?: (payload: CharacterReady) => void;
  onProgress?: (progress: number) => void;
  className?: string;
  annotationConfig?: CharacterAnnotationConfig;
};

export default function CharacterGLBScene({
  src = '/characters/jonathan.glb',
  onReady,
  onProgress,
  className,
  annotationConfig,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Use refs to avoid triggering effect re-runs when callbacks change
  const onReadyRef = useRef(onReady);
  const onProgressRef = useRef(onProgress);
  const annotationConfigRef = useRef(annotationConfig);
  onReadyRef.current = onReady;
  onProgressRef.current = onProgress;
  annotationConfigRef.current = annotationConfig;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    console.log(`[Scene] Creating renderer with size ${width}x${height}, mount size: ${mount.clientWidth}x${mount.clientHeight}`);

    // ===== CREATE THREE.JS CORE =====
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // Use true to update CSS style - ensures canvas matches container
    renderer.setSize(width, height, true);
    mount.appendChild(renderer.domElement);

    // Ensure canvas fills the container
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0c);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.6);
    hemi.position.set(0, 10, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);

    // ===== CREATE LOOMLARGE ENGINE =====
    // Select the appropriate AU preset based on character type
    const characterId = annotationConfigRef.current?.characterId;
    const auPreset = characterId === 'betta' ? AU_MAPPING_CONFIG : CC4_PRESET;
    const engine = new LoomLargeThree({ auMappings: auPreset });
    if (typeof window !== 'undefined') {
      (window as any).engine = engine;
    }

    // Create animation service
    const host = createEngineAdapter(engine);
    const anim = createAnimationService(host);

    // ===== CREATE CAMERA CONTROLLER =====
    const cameraController = new AnnotationCameraController({
      camera,
      domElement: renderer.domElement,
      scene,
      showDOMControls: true,
      controlsContainer: mount,
    });

    // ===== STATE =====
    let model: THREE.Object3D | null = null;
    let disposed = false;

    // ===== LOAD GLB =====
    const loader = new GLTFLoader();

    const handleProgress = (progressEvent: ProgressEvent) => {
      if (progressEvent.lengthComputable) {
        onProgressRef.current?.(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      }
    };

    // Collect meshes with morph targets
    const collectMorphMeshes = (gltf: { scene: THREE.Object3D }) => {
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          if (Array.isArray(m.morphTargetInfluences) && m.morphTargetInfluences.length > 0) {
            meshes.push(m);
          }
        }
      });
      return meshes;
    };

    loader.load(
      src,
      (gltf) => {
        if (disposed) return;

        model = gltf.scene;
        scene.add(model);

        const meshes = collectMorphMeshes(gltf);

        // Initialize LoomLarge with the model (cast to any to handle type differences)
        engine.onReady({ meshes, model: model as any });

        // Load baked animations from the GLB file if present
        if (gltf.animations && gltf.animations.length > 0) {
          engine.loadAnimationClips(gltf.animations);
          console.log(`[Scene] Loaded ${gltf.animations.length} baked animations:`, gltf.animations.map(a => a.name));
        }

        // Wire up baked animation engine to animation service for RxJS events
        anim.setBakedAnimationEngine?.(engine as any);

        // Start the engine's internal animation loop
        engine.start();

        // Start animation playback
        anim.play?.();

        // Set up camera controller with model
        cameraController.setModel(model);

        // Load annotations if provided
        // Use requestAnimationFrame to ensure layout is complete and aspect ratio is correct
        const config = annotationConfigRef.current;
        if (config) {
          requestAnimationFrame(() => {
            // Update camera aspect ratio to match current container size
            const w = mount.clientWidth || window.innerWidth;
            const h = mount.clientHeight || window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            console.log(`[Scene] Updated camera aspect to ${camera.aspect.toFixed(2)} (${w}x${h})`);

            cameraController.loadAnnotations(config);
          });
        }

        setIsReady(true);
        onReadyRef.current?.({
          scene,
          renderer,
          camera,
          model,
          meshes,
          animations: gltf.animations,
          cameraController,
          engine,
          anim,
        });
      },
      handleProgress,
      (err) => {
        console.error(`Failed to load ${src}:`, err);
      }
    );

    // ===== RENDER LOOP =====
    // Use Three.js's setAnimationLoop for the render loop
    // Animation service is self-driving via async playback runners (XState + TransitionHandles)
    renderer.setAnimationLoop(() => {
      // Update camera controller (OrbitControls damping, marker positions)
      cameraController.update();

      // Render the scene
      renderer.render(scene, camera);
    });

    // ===== RESIZE HANDLER =====
    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    // ===== CLEANUP =====
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);

      // Stop render loop
      renderer.setAnimationLoop(null);

      // Dispose services
      anim.dispose();
      engine.stop();
      engine.dispose();
      cameraController.dispose();

      // Clean up Three.js
      if (model) scene.remove(model);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [src]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ visibility: isReady ? 'visible' : 'hidden' }}
    />
  );
}
