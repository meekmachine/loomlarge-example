import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Profiling helpers - shows in Chrome DevTools Performance tab
const PROFILE = true;
const mark = (name: string) => PROFILE && performance.mark(name);
const measure = (name: string, start: string, end?: string) => {
  if (!PROFILE) return;
  try {
    performance.measure(name, start, end);
    const entries = performance.getEntriesByName(name, 'measure');
    const last = entries[entries.length - 1];
    if (last) console.log(`⏱️ ${name}: ${last.duration.toFixed(1)}ms`);
  } catch {}
};

export type CharacterReady = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  model: THREE.Object3D;
  meshes: THREE.Mesh[]; // meshes with morph targets
  animations?: THREE.AnimationClip[];
  skyboxTexture?: THREE.Texture; // skybox texture for engine control
};

type CameraOverride = {
  position: [number, number, number];
  target: [number, number, number];
};

type Props = {
  src?: string;              // path to the .glb in /public
  autoRotate?: boolean;      // slow autorotate for idle viewing
  onReady?: (payload: CharacterReady) => void; // callback when model is loaded
  onProgress?: (progress: number) => void; // callback for loading progress (0-100)
  className?: string;        // optional class for the container div
  cameraOverride?: CameraOverride; // manually set camera for quick testing
  skyboxUrl?: string;        // path to HDR/EXR skybox file in /public
};

export default function CharacterGLBScene({
  src = '/characters/jonathan.glb',
  autoRotate = false,
  onReady,
  onProgress,
  className,
  cameraOverride,
  skyboxUrl,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Use refs for callbacks to avoid re-running the effect when they change
  const onReadyRef = useRef(onReady);
  const onProgressRef = useRef(onProgress);
  onReadyRef.current = onReady;
  onProgressRef.current = onProgress;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    mark('scene-effect-start');

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight;

    // Renderer - append immediately, visibility is controlled by React state
    mark('renderer-create-start');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    mount.appendChild(renderer.domElement);
    mark('renderer-create-end');
    measure('Renderer creation', 'renderer-create-start', 'renderer-create-end');

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0c);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    // Camera position from override (fixed, no interactivity)
    if (cameraOverride) {
      const [px, py, pz] = cameraOverride.position;
      camera.position.set(px, py, pz);
      const [tx, ty, tz] = cameraOverride.target;
      camera.lookAt(tx, ty, tz);
    } else {
      camera.position.set(0, 1.6, 3);
      camera.lookAt(0, 1.6, 0);
    }

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.4);
    hemi.position.set(0, 10, 0);
    scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.3);
    dir.position.set(5, 10, 7.5);
    dir.castShadow = true;
    scene.add(dir);

    // GLB loader with Draco support
    mark('loader-setup-start');
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dracoLoader);
    mark('loader-setup-end');
    measure('Loader setup', 'loader-setup-start', 'loader-setup-end');

    let model: THREE.Object3D | null = null;
    let raf = 0;
    let allReady = false;

    // Track loading state - wait for both model AND skybox
    let modelReady = false;
    let skyboxReady = !skyboxUrl; // If no skybox, consider it ready
    let skyboxTexture: THREE.Texture | null = null;
    let pendingGltf: { scene: THREE.Object3D; animations?: THREE.AnimationClip[] } | null = null;
    let pendingMeshes: THREE.Mesh[] = [];

    // Called when both model and skybox are ready
    const checkAllReady = () => {
      if (modelReady && skyboxReady && !allReady) {
        allReady = true;
        mark('all-assets-ready');
        measure('Total asset loading', 'scene-effect-start', 'all-assets-ready');

        // Process the model now that everything is loaded
        if (pendingGltf) {
          mark('model-process-start');
          model = pendingGltf.scene;
          scene.add(model);

          // Center & scale model
          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);

          console.log('📦 [example] Model bounding box size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
          console.log('📦 [example] Model center:', center.x.toFixed(2), center.y.toFixed(2), center.z.toFixed(2));

          model.position.sub(center);

          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 1.6 / maxDim;
          console.log('📦 [example] Scaling model by:', scale.toFixed(4), '(maxDim was:', maxDim.toFixed(2), ')');
          model.scale.setScalar(scale);

          console.log('📷 [example] Camera position:', camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2));
          mark('model-process-end');
          measure('Model processing', 'model-process-start', 'model-process-end');

          // Signal ready to React state for visibility
          mark('onReady-callback-start');
          setIsReady(true);
          onReadyRef.current?.({ scene, renderer, model, meshes: pendingMeshes, animations: pendingGltf.animations, skyboxTexture: skyboxTexture || undefined });
          mark('onReady-callback-end');
          measure('onReady callback', 'onReady-callback-start', 'onReady-callback-end');
        }
      }
    };

    // Load skybox texture
    if (skyboxUrl) {
      mark('skybox-load-start');
      const isHDR = skyboxUrl.toLowerCase().endsWith('.hdr') || skyboxUrl.toLowerCase().endsWith('.exr');

      if (isHDR) {
        const rgbeLoader = new RGBELoader();
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();

        rgbeLoader.load(skyboxUrl, (texture) => {
          mark('skybox-load-end');
          measure('Skybox load (HDR)', 'skybox-load-start', 'skybox-load-end');
          const envMap = pmremGenerator.fromEquirectangular(texture).texture;
          scene.environment = envMap;
          scene.background = texture;
          skyboxTexture = texture;
          pmremGenerator.dispose();
          skyboxReady = true;
          checkAllReady();
        });
      } else {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(skyboxUrl, (texture) => {
          mark('skybox-load-end');
          measure('Skybox load (JPG)', 'skybox-load-start', 'skybox-load-end');
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.environment = texture;
          scene.background = texture;
          skyboxTexture = texture;
          skyboxReady = true;
          checkAllReady();
        });
      }
    }

    // Helper: collect meshes with morph targets
    const collectMeshes = (gltf: { scene: THREE.Object3D }) => {
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

    // Helper: process loaded GLTF
    const processGLTF = (gltf: { scene: THREE.Object3D; animations?: THREE.AnimationClip[] }) => {
      mark('glb-load-end');
      measure('GLB download + parse', 'glb-load-start', 'glb-load-end');
      mark('mesh-collect-start');
      pendingGltf = gltf;
      pendingMeshes = collectMeshes(gltf);
      mark('mesh-collect-end');
      measure('Mesh collection', 'mesh-collect-start', 'mesh-collect-end');
      modelReady = true;
      checkAllReady();
    };

    const handleProgress = (progressEvent: ProgressEvent) => {
      if (progressEvent.lengthComputable) {
        onProgressRef.current?.(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      }
    };

    // Load GLB directly
    mark('glb-load-start');
    loader.load(src, processGLTF, handleProgress, (err) => {
      console.error(`Failed to load ${src}:`, err);
    });

    const animate = () => {
      raf = requestAnimationFrame(animate);
      // Only render once everything is ready
      if (!allReady) return;
      if (autoRotate && model) model.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (model) scene.remove(model);
      renderer.dispose();
      dracoLoader.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [src, autoRotate, cameraOverride, skyboxUrl]);

  // Hide the container completely until everything is ready
  // This prevents any visual "flash" or intermediate states
  return (
    <div
      ref={mountRef}
      className={className}
      style={{ visibility: isReady ? 'visible' : 'hidden' }}
    />
  );
}
