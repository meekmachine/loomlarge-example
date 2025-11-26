import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFiberState } from '../context/fiberContext';

type CharacterReady = {
  scene: THREE.Scene;
  model: THREE.Object3D;
  meshes: THREE.Mesh[];
};

type Props = {
  src?: string;
  autoRotate?: boolean;
  onReady?: (payload: CharacterReady) => void;
  onProgress?: (progress: number) => void;
  className?: string;
  skyboxUrl?: string;
  environmentPreset?: 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'city' | 'park' | 'lobby';
  cameraOverride?: { position: [number, number, number]; target: [number, number, number] };
};

/**
 * Internal component that loads and displays the GLB model
 * This runs inside the Canvas context where Three.js hooks are available
 */
function CharacterModel({
  src,
  autoRotate,
  onReady,
  onProgress
}: {
  src: string;
  autoRotate?: boolean;
  onReady?: (payload: CharacterReady) => void;
  onProgress?: (progress: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  const { scene: threeScene } = useThree();
  const { engine, anim } = useFiberState();

  // Load the GLB file using drei's useGLTF hook
  const { scene: loadedScene } = useGLTF(src, true, true, (loader) => {
    loader.manager.onProgress = (url, loaded, total) => {
      const progress = (loaded / total) * 100;
      onProgress?.(progress);
    };
  });

  // Initialize the model when it loads
  useEffect(() => {
    if (!loadedScene) return;
    // Skip if we've already instantiated a model
    if (modelRef.current) return;

    // Clone the scene to avoid modifying the cached version (preserve skinning)
    const model = SkeletonUtils.clone(loadedScene);
    modelRef.current = model;

    // Scale & center: shrink to ~1.6 units tall and place feet on ground
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const desiredMax = .03;
    const scale = desiredMax / maxDim;
    model.scale.setScalar(scale);

    // Recompute bounds after scaling
    const box2 = new THREE.Box3().setFromObject(model);
    const center2 = box2.getCenter(new THREE.Vector3());
    const min2 = box2.min;

    // Center X/Z and lift so feet rest at y=0
    model.position.set(-center2.x, -min2.y, -center2.z);

    // Collect all meshes with morph targets
    const meshes: THREE.Mesh[] = [];
    model.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
          meshes.push(mesh);
        }
      }
    });

    console.log('[CharacterFiberScene] Found', meshes.length, 'meshes with morph targets');

    // Add model to the group
    if (groupRef.current) {
      groupRef.current.add(model);
    }

    // Call onReady callback
    onReady?.({
      scene: threeScene,
      model,
      meshes
    });

    // Cleanup in case of remount (e.g., React StrictMode) to avoid duplicate models
    return () => {
      if (groupRef.current && modelRef.current) {
        groupRef.current.remove(modelRef.current);
      }
      try {
        modelRef.current?.traverse((node: any) => {
          if (node.geometry) node.geometry.dispose?.();
          if (node.material) {
            if (Array.isArray(node.material)) {
              node.material.forEach((m: any) => m.dispose?.());
            } else {
              node.material.dispose?.();
            }
          }
        });
      } catch {}
      modelRef.current = null;
    };
  }, [loadedScene, threeScene, onReady, onProgress]);

  // Auto-rotate animation and engine updates
  useFrame((state, delta) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3;
    }

    // Update EngineThree (transitions)
    if (engine) {
      engine.update(delta);
    }

    // Update animation service (snippets)
    if (anim) {
      try {
        anim.step?.(delta);
      } catch (e) {
        console.error('[CharacterFiberScene] Animation step error:', e);
      }
    }
  });

  return <group ref={groupRef} />;
}

/**
 * Loading fallback component
 */
function LoadingFallback() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime) * 0.2;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.1);
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4299e1" />
    </mesh>
  );
}

/**
 * CharacterFiberScene - React Three Fiber based character viewer
 *
 * This scene uses React Three Fiber instead of vanilla Three.js,
 * providing better React integration and declarative scene composition.
 */
export function CharacterFiberScene({
  src = '/models/default-character.glb',
  autoRotate = false,
  onReady,
  onProgress,
  className = '',
  skyboxUrl,
  environmentPreset = 'studio',
  cameraOverride
}: Props) {
  const [progress, setProgress] = useState(0);

  const handleProgress = (p: number) => {
    setProgress(p);
    onProgress?.(p);
  };

  return (
    <div className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Loading indicator */}
      {progress < 100 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            zIndex: 10,
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            pointerEvents: 'none'
          }}
        >
          Loading {Math.round(progress)}%
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 1.6, 3], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 3, -5]} intensity={0.3} />
        <pointLight position={[0, 2, 0]} intensity={0.3} />

        {/* Environment / Skybox */}
        {skyboxUrl ? (
          <Environment files={skyboxUrl} background />
        ) : (
          <Environment preset={environmentPreset} background />
        )}

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={10}
          target={[0, 1, 0]}
        />

        {/* Character Model */}
        <Suspense fallback={<LoadingFallback />}>
          <CharacterModel
            src={src}
            autoRotate={autoRotate}
            onReady={onReady}
            onProgress={handleProgress}
          />
        </Suspense>

        {/* Ground plane for reference */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </Canvas>
    </div>
  );
}

// Preload the GLB file
export function preloadCharacterModel(src: string) {
  useGLTF.preload(src);
}
