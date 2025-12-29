import { useCallback, useState, useEffect, useMemo, lazy, Suspense } from 'react';
import * as THREE from 'three';
import CharacterGLBScene from './scenes/CharacterGLBScene';
import Preloader from './components/Preloader';
import { useEngineState } from './context/engineContext';
import { ModulesProvider, useModulesContext } from './context/ModulesContext';
import { createEyeHeadTrackingService } from './latticework/eyeHeadTracking/eyeHeadTrackingService';

// Lazy load Chakra UI - won't be parsed/executed until animationReady is true
const ChakraUI = lazy(() => import('./components/ChakraUI'));

// Profiling
const mark = (name: string) => performance.mark(name);
const measure = (name: string, start: string) => {
  try {
    performance.measure(name, start);
    const entries = performance.getEntriesByName(name, 'measure');
    const last = entries[entries.length - 1];
    if (last) console.log(`⏱️ ${name}: ${last.duration.toFixed(1)}ms`);
  } catch {}
};

// Lazy import for toaster - only loaded when needed
let toasterPromise: Promise<{ toaster: any }> | null = null;
const getToaster = () => {
  if (!toasterPromise) {
    toasterPromise = import('./components/ChakraUI').then(m => ({ toaster: m.toaster }));
  }
  return toasterPromise;
};

function AppContent() {
  const { engine, anim } = useEngineState();
  const { setEyeHeadTrackingService } = useModulesContext();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [modelVisible, setModelVisible] = useState(false);  // Model is rendered (before LoomLarge init)
  const [engineReady, setEngineReady] = useState(false);    // LoomLarge is fully initialized

  // Embedded animation state (for GLTF/GLB baked animations)
  const [embeddedMixer, setEmbeddedMixer] = useState<THREE.AnimationMixer | null>(null);
  const [embeddedClips, setEmbeddedClips] = useState<THREE.AnimationClip[]>([]);

  // Called immediately when model is visible (before LoomLarge init)
  const handleModelVisible = useCallback(() => {
    mark('model-visible');
    setIsLoading(false);
    setModelVisible(true);
  }, []);

  // Called when model + skybox are fully loaded - defer heavy engine init
  const handleReady = useCallback(
    ({ meshes, model, mixer, animations }: {
      meshes: any[];
      model: any;
      mixer?: THREE.AnimationMixer;
      animations?: THREE.AnimationClip[];
    }) => {
      mark('app-handleReady-start');

      // Store embedded animation data immediately
      if (mixer) setEmbeddedMixer(mixer);
      if (animations) setEmbeddedClips(animations);

      // Defer heavy LoomLarge initialization to next frame to avoid frame drop
      requestAnimationFrame(() => {
        mark('engine-onReady-start');
        engine.onReady({ meshes, model });
        mark('engine-onReady-end');
        measure('engine.onReady()', 'engine-onReady-start');

        mark('anim-play-start');
        anim?.play?.();
        mark('anim-play-end');
        measure('anim.play()', 'anim-play-start');

        setEngineReady(true);

        mark('app-handleReady-end');
        measure('App handleReady total', 'app-handleReady-start');

        // Show toast after Chakra loads
        getToaster().then(({ toaster }) => {
          const clipCount = animations?.length || 0;
          const message = clipCount > 0
            ? `Model loaded with ${clipCount} embedded animation${clipCount > 1 ? 's' : ''}`
            : 'Model loaded';
          toaster.create({ title: 'Animation Ready', description: message, type: 'success', duration: 2000 });
        });
      });
    },
    [engine, anim]
  );

  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Initialize eye/head tracking service when engine is ready
  useEffect(() => {
    if (!engine || !anim || !engineReady) return;

    const service = createEyeHeadTrackingService({
      animationAgency: anim,
      engine: engine,
    });

    service.start();
    setEyeHeadTrackingService(service);

    return () => {
      service.dispose();
      setEyeHeadTrackingService(null);
    };
  }, [engine, anim, engineReady, setEyeHeadTrackingService]);

  // Camera override memoized - adjusted for betta fish model
  // Model is placed at target position, camera looks at it from the side
  const cameraOverride = useMemo(() => ({
    position: [2, 0.5, 3] as [number, number, number],
    target:   [0, 0, 0] as [number, number, number],
  }), []);

  // Use BASE_URL for all assets to work with GitHub Pages base path
  // Load the betta fish model (GLTF format)
  const glbSrc = import.meta.env.BASE_URL + "characters/betta/scene.gltf";
  const skyboxUrl = import.meta.env.BASE_URL + "skyboxes/3BR2D07.jpg";

  return (
    <div className="fullscreen-scene">
      {/* Show black screen with loading text until ready - pure CSS, no Chakra */}
      <Preloader
        text="Loading Model"
        show={isLoading}
        progress={loadProgress}
      />

      {/* CharacterGLBScene handles its own visibility */}
      <CharacterGLBScene
        src={glbSrc}
        className="fullscreen-scene"
        cameraOverride={cameraOverride}
        skyboxUrl={skyboxUrl}
        onModelVisible={handleModelVisible}
        onReady={handleReady}
        onProgress={setLoadProgress}
      />

      {/* Lazy load Chakra UI when model is visible - UI controls wait for engineReady */}
      {modelVisible && (
        <Suspense fallback={null}>
          <ChakraUI
            drawerOpen={drawerOpen}
            onDrawerToggle={handleDrawerToggle}
            animationManager={anim}
            embeddedMixer={embeddedMixer}
            embeddedClips={embeddedClips}
            engineReady={engineReady}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ModulesProvider>
      <AppContent />
    </ModulesProvider>
  );
}
