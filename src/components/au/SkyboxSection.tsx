import { useState, useEffect, memo } from 'react';
import {
  VStack,
  HStack,
  Text,
  Slider,
  Box,
  Button,
  NativeSelect,
  Separator,
} from '@chakra-ui/react';
import * as THREE from 'three';
import { EngineThree } from '../../engine/EngineThree';
import DockableAccordionItem from './DockableAccordionItem';

interface SkyboxSectionProps {
  engine: EngineThree | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

// Tone mapping options with readable labels
const TONE_MAPPING_OPTIONS: { value: THREE.ToneMapping; label: string }[] = [
  { value: THREE.NoToneMapping, label: 'None' },
  { value: THREE.LinearToneMapping, label: 'Linear' },
  { value: THREE.ReinhardToneMapping, label: 'Reinhard' },
  { value: THREE.CineonToneMapping, label: 'Cineon' },
  { value: THREE.ACESFilmicToneMapping, label: 'ACES Filmic' },
  { value: THREE.AgXToneMapping, label: 'AgX' },
];

function SkyboxSection({ engine, disabled = false, defaultExpanded = false }: SkyboxSectionProps) {
  // Skybox controls
  const [blur, setBlur] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Tone mapping / lighting controls
  const [toneMapping, setToneMapping] = useState<THREE.ToneMapping>(THREE.NoToneMapping);
  const [exposure, setExposure] = useState(1);
  const [envIntensity, setEnvIntensity] = useState(1);
  const [isRendererReady, setIsRendererReady] = useState(false);

  // Initialize from engine once it's ready
  useEffect(() => {
    if (!engine) return;

    const syncFromEngine = () => {
      const skyboxReady = engine.isSkyboxReady();
      const rendererReady = engine.isRendererReady();
      setIsReady(skyboxReady);
      setIsRendererReady(rendererReady);

      if (rendererReady) {
        setToneMapping(engine.getToneMapping());
        setExposure(engine.getExposure());
        setEnvIntensity(engine.getEnvironmentIntensity());
      }
    };

    syncFromEngine();
    const timeout = requestAnimationFrame(syncFromEngine);
    return () => cancelAnimationFrame(timeout);
  }, [engine]);

  // Skybox handlers
  const handleBlurChange = (details: { value: number[] }) => {
    const value = details.value[0];
    setBlur(value);
    engine?.setSkyboxBlur(value);
  };

  const handleIntensityChange = (details: { value: number[] }) => {
    const value = details.value[0];
    setIntensity(value);
    engine?.setSkyboxIntensity(value);
  };

  // Tone mapping / lighting handlers
  const handleToneMappingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(e.target.value) as THREE.ToneMapping;
    setToneMapping(value);
    engine?.setToneMapping(value);
  };

  const handleExposureChange = (details: { value: number[] }) => {
    const value = details.value[0];
    setExposure(value);
    engine?.setExposure(value);
  };

  const handleEnvIntensityChange = (details: { value: number[] }) => {
    const value = details.value[0];
    setEnvIntensity(value);
    engine?.setEnvironmentIntensity(value);
  };

  const resetToDefaults = () => {
    // Reset skybox
    setBlur(0);
    setIntensity(1);
    engine?.setSkyboxBlur(0);
    engine?.setSkyboxIntensity(1);

    // Reset tone mapping / lighting
    setToneMapping(THREE.NoToneMapping);
    setExposure(1);
    setEnvIntensity(1);
    engine?.setToneMapping(THREE.NoToneMapping);
    engine?.setExposure(1);
    engine?.setEnvironmentIntensity(1);
  };

  if (!isReady && !isRendererReady) {
    return (
      <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">Loading...</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
      <VStack gap={4} align="stretch" p={2}>
        <Button size="sm" onClick={resetToDefaults} colorPalette="red" variant="outline">
          Reset to Defaults
        </Button>

        {/* Skybox Controls */}
        {isReady && (
          <>
            <Text fontSize="xs" fontWeight="bold" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Skybox
            </Text>

            {/* Blur */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Blur</Text>
                <Text fontSize="xs" color="gray.500">{(blur * 100).toFixed(0)}%</Text>
              </HStack>
              <Slider.Root
                value={[blur]}
                onValueChange={handleBlurChange}
                min={0}
                max={1}
                step={0.01}
                disabled={disabled}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>

            {/* Intensity */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Intensity</Text>
                <Text fontSize="xs" color="gray.500">{(intensity * 100).toFixed(0)}%</Text>
              </HStack>
              <Slider.Root
                value={[intensity]}
                onValueChange={handleIntensityChange}
                min={0}
                max={2}
                step={0.01}
                disabled={disabled}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>
          </>
        )}

        {/* Tone Mapping / Lighting */}
        {isRendererReady && (
          <>
            <Separator borderColor="gray.600" />
            <Text fontSize="xs" fontWeight="bold" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Tone Mapping & Lighting
            </Text>

            {/* Tone Mapping */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Tone Mapping</Text>
              </HStack>
              <NativeSelect.Root size="sm" disabled={disabled}>
                <NativeSelect.Field
                  value={toneMapping}
                  onChange={handleToneMappingChange}
                >
                  {TONE_MAPPING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Box>

            {/* Exposure */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Exposure</Text>
                <Text fontSize="xs" color="gray.500">{exposure.toFixed(2)}</Text>
              </HStack>
              <Slider.Root
                value={[exposure]}
                onValueChange={handleExposureChange}
                min={0.1}
                max={3}
                step={0.01}
                disabled={disabled}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>

            {/* Environment Intensity */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" color="gray.300">Environment Intensity</Text>
                <Text fontSize="xs" color="gray.500">{(envIntensity * 100).toFixed(0)}%</Text>
              </HStack>
              <Slider.Root
                value={[envIntensity]}
                onValueChange={handleEnvIntensityChange}
                min={0}
                max={3}
                step={0.01}
                disabled={disabled}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>
          </>
        )}
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(SkyboxSection);

