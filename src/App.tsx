import { useCallback, useState, useEffect, lazy, Suspense } from 'react';
import CharacterGLBScene, { type CharacterReady } from './scenes/CharacterGLBScene';
import Preloader from './components/Preloader';
import { ThreeProvider, useSetEngine, useThreeOptional } from './context/threeContext';
import { ModulesProvider, useModulesContext } from './context/ModulesContext';
import { createEyeHeadTrackingService } from './latticework/eyeHeadTracking/eyeHeadTrackingService';
import { getDefaultCharacterConfig } from './presets/annotations';
import type { CharacterAnnotationConfig } from './camera/types';

// Lazy load Chakra UI - won't be parsed/executed until animationReady is true
const ChakraUI = lazy(() => import('./components/ChakraUI'));

// Lazy import for toaster - only loaded when needed
let toasterPromise: Promise<{ toaster: any }> | null = null;
const getToaster = () => {
  if (!toasterPromise) {
    toasterPromise = import('./components/ChakraUI').then(m => ({ toaster: m.toaster }));
  }
  return toasterPromise;
};

function AppContent() {
  const setEngine = useSetEngine();
  const threeCtx = useThreeOptional();
  const { setEyeHeadTrackingService, setCameraController } = useModulesContext();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [animationReady, setAnimationReady] = useState(false);

  // Character annotation config
  const [annotationConfig, setAnnotationConfig] = useState<CharacterAnnotationConfig | undefined>(
    getDefaultCharacterConfig()
  );

  // Handle character change from CharacterSection
  const handleCharacterChange = useCallback((config: CharacterAnnotationConfig) => {
    setIsLoading(true);
    setLoadProgress(0);
    setAnimationReady(false);
    setAnnotationConfig(config);
  }, []);

  const handleReady = useCallback(
    ({ cameraController, engine, anim }: CharacterReady) => {
      // Pass engine and anim to context
      setEngine(engine, anim);

      setCameraController(cameraController);
      setIsLoading(false);
      setAnimationReady(true);

      // Show toast after Chakra loads
      getToaster().then(({ toaster }) => {
        toaster.create({ title: 'Ready', type: 'success', duration: 2000 });
      });
    },
    [setEngine, setCameraController]
  );

  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Initialize eye/head tracking service when animation is ready
  useEffect(() => {
    if (!threeCtx?.engine || !threeCtx?.anim || !animationReady) return;

    const service = createEyeHeadTrackingService({
      animationAgency: threeCtx.anim,
      engine: threeCtx.engine,
    });

    service.start();
    setEyeHeadTrackingService(service);

    return () => {
      service.dispose();
      setEyeHeadTrackingService(null);
    };
  }, [threeCtx?.engine, threeCtx?.anim, animationReady, setEyeHeadTrackingService]);

  // Build GLB source from annotation config
  const glbSrc = annotationConfig
    ? import.meta.env.BASE_URL + annotationConfig.modelPath
    : import.meta.env.BASE_URL + "characters/jonathan_new.glb";

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
        onReady={handleReady}
        onProgress={setLoadProgress}
        annotationConfig={annotationConfig}
      />

      {/* Lazy load Chakra UI after animation is ready */}
      {animationReady && (
        <Suspense fallback={null}>
          <ChakraUI
            drawerOpen={drawerOpen}
            onDrawerToggle={handleDrawerToggle}
            animationManager={threeCtx?.anim}
            onCharacterChange={handleCharacterChange}
            currentCharacterConfig={annotationConfig}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThreeProvider>
      <ModulesProvider>
        <AppContent />
      </ModulesProvider>
    </ThreeProvider>
  );
}
