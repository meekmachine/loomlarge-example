import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import FrenchQuizApp from './FrenchQuizApp';
import { ModuleSettings } from '../../types/modules';
import { ModulesProvider } from '../../context/ModulesContext';

let root: ReactDOM.Root | null = null;

export function start(
  animationManager: any,
  settings: ModuleSettings,
  containerRef: React.RefObject<HTMLDivElement>,
  toaster: any
) {
  if (!containerRef.current) {
    console.error('Container ref is invalid');
    toaster.error({
      title: 'Error',
      description: 'Module container not found',
      duration: 3000,
    });
    return;
  }

  // Create root if it doesn't exist
  if (!root) {
    root = ReactDOM.createRoot(containerRef.current);
  }

  // Render the French Quiz app
  root.render(
    <ChakraProvider value={defaultSystem}>
      <ModulesProvider>
        <FrenchQuizApp
          animationManager={animationManager}
          settings={settings}
          toaster={toaster}
        />
      </ModulesProvider>
    </ChakraProvider>
  );

  toaster.success({
    title: 'French Quiz Started',
    description: 'Savoir-Faire Quiz is now active',
    duration: 2000,
  });
}

export function stop(animationManager: any) {
  if (root) {
    root.unmount();
    root = null;
  }

  console.log('French Quiz module stopped');
}
