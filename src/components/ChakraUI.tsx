/**
 * Lazy-loaded Chakra UI wrapper
 * This file is dynamically imported so Chakra/Emotion doesn't block initial render
 */
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import SliderDrawer from './SliderDrawer';
import ModulesMenu from './ModulesMenu';
import { Toaster, toaster } from './ui/toaster';
import type { CharacterAnnotationConfig } from '../camera/types';

type Props = {
  drawerOpen: boolean;
  onDrawerToggle: () => void;
  animationManager: any;
  onCharacterChange?: (config: CharacterAnnotationConfig) => void;
  currentCharacterConfig?: CharacterAnnotationConfig;
};

export default function ChakraUI({
  drawerOpen,
  onDrawerToggle,
  animationManager,
  onCharacterChange,
  currentCharacterConfig,
}: Props) {
  return (
    <ChakraProvider value={defaultSystem}>
      <Toaster />
      <SliderDrawer
        isOpen={drawerOpen}
        onToggle={onDrawerToggle}
        disabled={false}
        onCharacterChange={onCharacterChange}
        currentCharacterConfig={currentCharacterConfig}
      />
      <ModulesMenu animationManager={animationManager} />
    </ChakraProvider>
  );
}

// Re-export toaster for use in handleReady
export { toaster };
