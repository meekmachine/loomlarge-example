/**
 * Lazy-loaded Chakra UI wrapper
 * This file is dynamically imported so Chakra/Emotion doesn't block initial render
 */
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import * as THREE from 'three';
import SliderDrawer from './SliderDrawer';
import ModulesMenu from './ModulesMenu';
import { Toaster, toaster } from './ui/toaster';

type Props = {
  drawerOpen: boolean;
  onDrawerToggle: () => void;
  animationManager: any;
  embeddedMixer?: THREE.AnimationMixer | null;
  embeddedClips?: THREE.AnimationClip[];
  engineReady?: boolean;  // Whether LoomLarge engine is initialized
};

export default function ChakraUI({
  drawerOpen,
  onDrawerToggle,
  animationManager,
  embeddedMixer,
  embeddedClips,
  engineReady = false
}: Props) {
  return (
    <ChakraProvider value={defaultSystem}>
      <Toaster />
      <SliderDrawer
        isOpen={drawerOpen}
        onToggle={onDrawerToggle}
        disabled={!engineReady}
        embeddedMixer={embeddedMixer}
        embeddedClips={embeddedClips}
      />
      <ModulesMenu animationManager={animationManager} />
    </ChakraProvider>
  );
}

// Re-export toaster for use in handleReady
export { toaster };
