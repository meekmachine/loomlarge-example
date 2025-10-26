import React, { useCallback, useMemo, useState } from 'react';
import CharacterGLBScene from './scenes/CharacterGLBScene';
import AUQuickPanel from './components/au/AUQuickPanel';
import { EngineThree } from './engine/EngineThree';
import { useThreeState } from './context/threeContext';
import './styles.css';

export default function App() {
  // Access the global three context
  const threeCtx = useThreeState();

  // Create and persist engine
  const [engine] = useState(() => new EngineThree());

  const handleReady = useCallback(
    ({ meshes, model }: { meshes: any[]; model?: any }) => {
      engine.onReady({ meshes, model });
    },
    [engine]
  );

  const applyAU = useCallback(
    (id: number | string, value: number) => {
      engine.setAU(id, value);
    },
    [engine]
  );

  const setMorph = useCallback(
    (key: string, value: number) => {
      engine.setMorph(key, value);
    },
    [engine]
  );

  // Enrich the three context dynamically
  threeCtx.engine = engine;

  return (
    <div className="fullscreen-scene">
      <CharacterGLBScene
        src="/characters/jonathan.glb"
        className="fullscreen-scene"
        cameraOverride={{ position: [1.851, 5.597, 6.365], target: [1.851, 5.597, -0.000] }}
        onReady={handleReady}
      />
      <AUQuickPanel applyAU={applyAU} setMorph={setMorph} />
    </div>
  );
}