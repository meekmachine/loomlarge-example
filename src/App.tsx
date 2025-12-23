import { useCallback, useState, useEffect, useMemo, lazy, Suspense } from 'react';
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
  const [animationReady, setAnimationReady] = useState(false);

  const handleReady = useCallback(
    ({ meshes, model, scene, renderer, skyboxTexture }: {
      meshes: any[];
      model?: any;
      scene?: THREE.Scene;
      renderer?: THREE.WebGLRenderer;
      skyboxTexture?: THREE.Texture;
    }) => {
      mark('app-handleReady-start');

      mark('engine-onReady-start');
      engine.onReady({ meshes, model, scene, renderer, skyboxTexture });
      mark('engine-onReady-end');
      measure('engine.onReady()', 'engine-onReady-start');

      mark('anim-play-start');
      anim?.play?.();
      mark('anim-play-end');
      measure('anim.play()', 'anim-play-start');

      setIsLoading(false);
      setAnimationReady(true);

      mark('app-handleReady-end');
      measure('App handleReady total', 'app-handleReady-start');

      // Show toast after Chakra loads
      getToaster().then(({ toaster }) => {
        toaster.create({ title: 'Animation Ready', type: 'success', duration: 2000 });
      });
    },
    [engine, anim]
  );

  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Initialize eye/head tracking service when animation is ready
  useEffect(() => {
    if (!engine || !anim || !animationReady) return;

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
  }, [engine, anim, animationReady, setEyeHeadTrackingService]);

  // Camera override memoized
  const cameraOverride = useMemo(() => ({
    position: [1.851, 5.597, 6.365] as [number, number, number],
    target:   [1.851, 5.597, -0.000] as [number, number, number],
  }), []);

  // Use BASE_URL for all assets to work with GitHub Pages base path
  const glbSrc = import.meta.env.BASE_URL + "characters/jonathan_new.glb";
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
        onReady={handleReady}
        onProgress={setLoadProgress}
      />

      {/* Lazy load Chakra UI after animation is ready */}
      {animationReady && (
        <Suspense fallback={null}>
          <ChakraUI
            drawerOpen={drawerOpen}
            onDrawerToggle={handleDrawerToggle}
            animationManager={anim}
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
