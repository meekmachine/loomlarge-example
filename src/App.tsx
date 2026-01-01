import { useCallback, useState, useEffect, lazy, Suspense } from 'react';
import CharacterGLBScene, { type CharacterReady } from './scenes/CharacterGLBScene';
import Preloader from './components/Preloader';
import { ThreeProvider, useThreeOptional } from './context/threeContext';
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
  // Track previous config for fallback on load error
  const [previousConfig, setPreviousConfig] = useState<CharacterAnnotationConfig | undefined>(
    getDefaultCharacterConfig()
  );

  // Handle character change from CharacterSection
  const handleCharacterChange = useCallback((config: CharacterAnnotationConfig) => {
    // Save current config as fallback before changing
    setPreviousConfig(annotationConfig);
    setIsLoading(true);
    setLoadProgress(0);
    setAnimationReady(false);
    setAnnotationConfig(config);
  }, [annotationConfig]);

  // Handle load error - show toast and revert to previous character
  const handleLoadError = useCallback((error: Error, characterId?: string) => {
    console.error(`Failed to load character ${characterId}:`, error);

    // Show error toast after Chakra loads
    getToaster().then(({ toaster }) => {
      toaster.create({
        title: 'Failed to load character',
        description: `Could not load ${characterId || 'character'}. Reverting to previous character.`,
        type: 'error',
        duration: 4000,
      });
    });

    // Revert to previous config (or default if no previous)
    const fallback = previousConfig || getDefaultCharacterConfig();
    if (fallback && fallback.characterId !== characterId) {
      setAnnotationConfig(fallback);
      setLoadProgress(0);
    } else {
      // If fallback is the same as failed, just stop loading
      setIsLoading(false);
    }
  }, [previousConfig]);

  const handleReady = useCallback(
    ({ cameraController, engine, anim, scene, renderer }: CharacterReady) => {
      // Pass engine, anim, scene, and renderer to context
      threeCtx?.setEngine(engine, anim);
      threeCtx?.setScene(scene, renderer);

      setCameraController(cameraController);
      setIsLoading(false);
      setAnimationReady(true);

      // Show toast after Chakra loads
      getToaster().then(({ toaster }) => {
        toaster.create({ title: 'Ready', type: 'success', duration: 2000 });
      });
    },
    [threeCtx, setCameraController]
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

  // Build GLB source from annotation config - handle blob URLs for uploaded characters
  const glbSrc = annotationConfig
    ? annotationConfig.modelPath.startsWith('blob:')
      ? annotationConfig.modelPath
      : import.meta.env.BASE_URL + annotationConfig.modelPath
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
        onError={handleLoadError}
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
