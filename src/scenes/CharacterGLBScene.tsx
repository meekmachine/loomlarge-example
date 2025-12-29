import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
  mixer?: THREE.AnimationMixer; // animation mixer for embedded animations
  skyboxTexture?: THREE.Texture; // skybox texture for engine control
};

export type ModelVisiblePayload = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  model: THREE.Object3D;
};

type CameraOverride = {
  position: [number, number, number];
  target: [number, number, number];
};

type Props = {
  src?: string;              // path to the .glb in /public
  autoRotate?: boolean;      // slow autorotate for idle viewing
  onReady?: (payload: CharacterReady) => void; // callback when model + skybox are fully loaded
  onModelVisible?: (payload: ModelVisiblePayload) => void; // callback when model is visible (before skybox)
  onProgress?: (progress: number) => void; // callback for loading progress (0-100)
  className?: string;        // optional class for the container div
  cameraOverride?: CameraOverride; // manually set camera for quick testing
  skyboxUrl?: string;        // path to HDR/EXR skybox file in /public
};

export default function CharacterGLBScene({
  src = '/characters/jonathan.glb',
  autoRotate = false,
  onReady,
  onModelVisible,
  onProgress,
  className,
  cameraOverride,
  skyboxUrl,
}: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Use refs for callbacks to avoid re-running the effect when they change
  const onReadyRef = useRef(onReady);
  const onModelVisibleRef = useRef(onModelVisible);
  const onProgressRef = useRef(onProgress);
  onReadyRef.current = onReady;
  onModelVisibleRef.current = onModelVisible;
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

    // Camera position from override
    let targetPos = new THREE.Vector3(0, 1.6, 0);
    if (cameraOverride) {
      const [px, py, pz] = cameraOverride.position;
      camera.position.set(px, py, pz);
      const [tx, ty, tz] = cameraOverride.target;
      targetPos.set(tx, ty, tz);
      camera.lookAt(targetPos);
    } else {
      camera.position.set(0, 1.6, 3);
      camera.lookAt(targetPos);
    }

    // OrbitControls for camera interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(targetPos);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 50;
    controls.update();

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
    let modelVisible = false; // Model is visible and rendering
    let allReady = false;     // Model + skybox fully loaded
    let mixer: THREE.AnimationMixer | null = null;
    const clock = new THREE.Clock();

    // Track loading state
    let modelProcessed = false;
    let skyboxReady = !skyboxUrl; // If no skybox, consider it ready
    let skyboxTexture: THREE.Texture | null = null;
    let processedMeshes: THREE.Mesh[] = [];
    let processedAnimations: THREE.AnimationClip[] | undefined;

    // Process and display model immediately (don't wait for skybox)
    const processAndShowModel = (gltf: { scene: THREE.Object3D; animations?: THREE.AnimationClip[] }) => {
      if (modelProcessed) return;
      modelProcessed = true;

      mark('model-process-start');
      model = gltf.scene;
      scene.add(model);

      // Center & scale model
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      // First scale the model
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 1.6 / maxDim;
      model.scale.setScalar(scale);

      // Recalculate bounding box after scaling
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);

      // Position model at the camera target (where camera is looking)
      model.position.sub(scaledCenter);
      model.position.add(targetPos);
      // Nudge the model in screen space (from viewer's perspective)
      model.position.x -= 2.0; // move left (from viewer's perspective)
      model.position.y += 0.8; // move up

      // Rotate model to face the camera, then add 90° rotation
      model.lookAt(camera.position);
      model.rotation.y += Math.PI / 2; // rotate 90° around Y axis
      mark('model-process-end');
      measure('Model processing', 'model-process-start', 'model-process-end');

      // Play embedded animations if any
      processedAnimations = gltf.animations;
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          const action = mixer!.clipAction(clip);
          action.play();
          console.log(`Playing animation: ${clip.name}, duration: ${clip.duration}s, tracks: ${clip.tracks.length}`);
          // Log what the animation controls (bones, morph targets, etc.)
          clip.tracks.forEach((track, i) => {
            if (i < 10) { // Log first 10 tracks to avoid spam
              console.log(`  Track ${i}: ${track.name} (${track.constructor.name})`);
            }
          });
          if (clip.tracks.length > 10) {
            console.log(`  ... and ${clip.tracks.length - 10} more tracks`);
          }
        });
      }

      // Check for skeleton/bones - log ALL bones for preset creation
      let skeleton: THREE.Skeleton | null = null;
      model.traverse((obj) => {
        if ((obj as THREE.SkinnedMesh).isSkinnedMesh && !skeleton) {
          const skinnedMesh = obj as THREE.SkinnedMesh;
          skeleton = skinnedMesh.skeleton;
          console.log(`\n========== SKELETON BONES (${skeleton.bones.length} total) ==========`);
          skeleton.bones.forEach((bone, i) => {
            const parent = bone.parent?.name || 'root';
            console.log(`  [${i}] "${bone.name}" (parent: "${parent}")`);
          });
          console.log(`\n========== BONE HIERARCHY ==========`);
          // Log hierarchy
          const logBoneHierarchy = (bone: THREE.Bone, depth: number = 0) => {
            const indent = '  '.repeat(depth);
            console.log(`${indent}${bone.name}`);
            bone.children.forEach(child => {
              if ((child as THREE.Bone).isBone) {
                logBoneHierarchy(child as THREE.Bone, depth + 1);
              }
            });
          };
          // Find root bones
          skeleton.bones.filter(b => !b.parent || !(b.parent as THREE.Bone).isBone).forEach(rootBone => {
            logBoneHierarchy(rootBone);
          });
          console.log(`\n========== PRESET TEMPLATE ==========`);
          console.log(`Copy this to create a fish preset:\n`);
          const boneNames = skeleton.bones.map(b => `"${b.name}"`).join(',\n    ');
          console.log(`const FISH_BONES = [\n    ${boneNames}\n];`);
        }
      });

      // Model is now visible and rendering - notify immediately
      modelVisible = true;
      mark('model-visible');
      measure('Time to model visible', 'scene-effect-start', 'model-visible');
      setIsReady(true);

      // Call onModelVisible callback so App can show character immediately
      onModelVisibleRef.current?.({ scene, renderer, model });

      // Check if we can also call onReady (skybox already loaded)
      checkAllReady();
    };

    // Called when both model AND skybox are ready (for full initialization)
    const checkAllReady = () => {
      if (modelProcessed && skyboxReady && !allReady) {
        allReady = true;
        mark('all-assets-ready');
        measure('Total asset loading', 'scene-effect-start', 'all-assets-ready');

        // Call onReady with full payload (includes skybox)
        mark('onReady-callback-start');
        onReadyRef.current?.({
          scene,
          renderer,
          model: model!,
          meshes: processedMeshes,
          animations: processedAnimations,
          mixer: mixer || undefined,
          skyboxTexture: skyboxTexture || undefined
        });
        mark('onReady-callback-end');
        measure('onReady callback', 'onReady-callback-start', 'onReady-callback-end');
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
          // Log all meshes and their morph targets
          if (m.morphTargetDictionary && Object.keys(m.morphTargetDictionary).length > 0) {
            console.log(`Mesh "${m.name}" has ${Object.keys(m.morphTargetDictionary).length} blend shapes:`);
            Object.entries(m.morphTargetDictionary).forEach(([name, index]) => {
              console.log(`  [${index}] ${name}`);
            });
            meshes.push(m);
          } else if (Array.isArray(m.morphTargetInfluences) && m.morphTargetInfluences.length > 0) {
            console.log(`Mesh "${m.name}" has ${m.morphTargetInfluences.length} morph targets (unnamed)`);
            meshes.push(m);
          }
        }
      });
      if (meshes.length === 0) {
        console.log('No meshes with morph targets/blend shapes found in this model');
      }
      return meshes;
    };

    // Helper: process loaded GLTF - now shows model immediately
    const processGLTF = (gltf: { scene: THREE.Object3D; animations?: THREE.AnimationClip[] }) => {
      mark('glb-load-end');
      measure('GLB download + parse', 'glb-load-start', 'glb-load-end');
      mark('mesh-collect-start');
      processedMeshes = collectMeshes(gltf);
      mark('mesh-collect-end');
      measure('Mesh collection', 'mesh-collect-start', 'mesh-collect-end');
      // Process and show model immediately - don't wait for skybox
      processAndShowModel(gltf);
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

    // Log camera position periodically for debugging
    let lastLogTime = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      // Start rendering as soon as model is visible (don't wait for skybox)
      if (!modelVisible) return;

      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);

      // Log camera position and mixer state every 2 seconds
      const now = performance.now();
      if (now - lastLogTime > 2000) {
        lastLogTime = now;
        console.log(`Camera position: [${camera.position.x.toFixed(3)}, ${camera.position.y.toFixed(3)}, ${camera.position.z.toFixed(3)}]`);
        console.log(`Camera target: [${controls.target.x.toFixed(3)}, ${controls.target.y.toFixed(3)}, ${controls.target.z.toFixed(3)}]`);
        if (mixer) {
          console.log(`Mixer time: ${mixer.time.toFixed(3)}, delta: ${delta.toFixed(4)}`);
        }
      }

      if (autoRotate && model) model.rotation.y += 0.003;
      controls.update(); // Update orbit controls
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
      controls.dispose();
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
