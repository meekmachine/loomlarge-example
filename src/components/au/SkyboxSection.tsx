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
  Switch,
} from '@chakra-ui/react';
import * as THREE from 'three';
import {
  EngineThree,
  type PostEffect,
  type BloomParams,
  type FilmParams,
  type GlitchParams,
  type HalftoneParams,
  type DotScreenParams,
  type VignetteParams,
  type SepiaParams,
  DEFAULT_EFFECT_PARAMS,
} from '../../engine/EngineThree';
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

// Post-processing effect options
const POST_EFFECT_OPTIONS: { value: PostEffect; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'film', label: 'Film Grain' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'halftone', label: 'Halftone' },
  { value: 'dotScreen', label: 'Dot Screen' },
  { value: 'vignette', label: 'Vignette' },
  { value: 'sepia', label: 'Sepia' },
];

function SkyboxSection({ engine, disabled = false, defaultExpanded = false }: SkyboxSectionProps) {
  // Skybox controls
  const [blur, setBlur] = useState(0);
  const [intensity, setIntensity] = useState(1);
  const [isReady, setIsReady] = useState(false);

  // Post-processing controls
  const [toneMapping, setToneMapping] = useState<THREE.ToneMapping>(THREE.NoToneMapping);
  const [exposure, setExposure] = useState(1);
  const [envIntensity, setEnvIntensity] = useState(1);
  const [postEffect, setPostEffect] = useState<PostEffect>('none');
  const [isRendererReady, setIsRendererReady] = useState(false);
  const [isComposerReady, setIsComposerReady] = useState(false);

  // Effect-specific parameters
  const [bloomParams, setBloomParams] = useState<BloomParams>(DEFAULT_EFFECT_PARAMS.bloom);
  const [filmParams, setFilmParams] = useState<FilmParams>(DEFAULT_EFFECT_PARAMS.film);
  const [glitchParams, setGlitchParams] = useState<GlitchParams>(DEFAULT_EFFECT_PARAMS.glitch);
  const [halftoneParams, setHalftoneParams] = useState<HalftoneParams>(DEFAULT_EFFECT_PARAMS.halftone);
  const [dotScreenParams, setDotScreenParams] = useState<DotScreenParams>(DEFAULT_EFFECT_PARAMS.dotScreen);
  const [vignetteParams, setVignetteParams] = useState<VignetteParams>(DEFAULT_EFFECT_PARAMS.vignette);
  const [sepiaParams, setSepiaParams] = useState<SepiaParams>(DEFAULT_EFFECT_PARAMS.sepia);

  // Check if skybox/renderer/composer are ready - check once on mount
  // Resources should already be ready by the time SkyboxSection renders (UI deferred until after scene loads)
  useEffect(() => {
    if (!engine) return;

    const syncFromEngine = () => {
      const skyboxReady = engine.isSkyboxReady();
      const rendererReady = engine.isRendererReady();
      const composerReady = engine.isComposerReady();
      setIsReady(skyboxReady);
      setIsRendererReady(rendererReady);
      setIsComposerReady(composerReady);

      // Initialize post-processing values from engine when renderer is ready
      if (rendererReady) {
        setToneMapping(engine.getToneMapping());
        setExposure(engine.getExposure());
        setEnvIntensity(engine.getEnvironmentIntensity());
      }

      // Initialize post effect and params from engine when composer is ready
      if (composerReady) {
        setPostEffect(engine.getPostEffect());
        setBloomParams(engine.getEffectParams('bloom'));
        setFilmParams(engine.getEffectParams('film'));
        setGlitchParams(engine.getEffectParams('glitch'));
        setHalftoneParams(engine.getEffectParams('halftone'));
        setDotScreenParams(engine.getEffectParams('dotScreen'));
        setVignetteParams(engine.getEffectParams('vignette'));
        setSepiaParams(engine.getEffectParams('sepia'));
      }
    };

    // Check immediately - UI is deferred so engine should be ready
    syncFromEngine();

    // If not ready yet (edge case), schedule one retry after a short delay
    // Using requestAnimationFrame to avoid frame drops during render
    const timeout = requestAnimationFrame(() => {
      syncFromEngine();
    });

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

  // Post-processing handlers
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

  const handlePostEffectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as PostEffect;
    setPostEffect(value);
    engine?.setPostEffect(value);
  };

  // Effect parameter handlers
  const updateBloomParam = (key: keyof BloomParams, details: { value: number[] }) => {
    const value = details.value[0];
    const newParams = { ...bloomParams, [key]: value };
    setBloomParams(newParams);
    engine?.setEffectParams('bloom', { [key]: value });
  };

  const updateFilmParam = (key: keyof FilmParams, details: { value: number[] }) => {
    const value = details.value[0];
    const newParams = { ...filmParams, [key]: value };
    setFilmParams(newParams);
    engine?.setEffectParams('film', { [key]: value });
  };

  const updateGlitchParam = (key: keyof GlitchParams, details: { checked: boolean }) => {
    const value = details.checked;
    const newParams = { ...glitchParams, [key]: value };
    setGlitchParams(newParams);
    engine?.setEffectParams('glitch', { [key]: value });
  };

  const updateHalftoneParamNum = (key: keyof HalftoneParams, details: { value: number[] }) => {
    const value = details.value[0];
    const newParams = { ...halftoneParams, [key]: value };
    setHalftoneParams(newParams);
    engine?.setEffectParams('halftone', { [key]: value });
  };

  const updateHalftoneParamBool = (key: keyof HalftoneParams, details: { checked: boolean }) => {
    const value = details.checked;
    const newParams = { ...halftoneParams, [key]: value };
    setHalftoneParams(newParams);
    engine?.setEffectParams('halftone', { [key]: value });
  };

  const updateDotScreenParam = (key: keyof DotScreenParams, details: { value: number[] }) => {
    const value = details.value[0];
    const newParams = { ...dotScreenParams, [key]: value };
    setDotScreenParams(newParams);
    engine?.setEffectParams('dotScreen', { [key]: value });
  };

  const updateVignetteParam = (key: keyof VignetteParams, details: { value: number[] }) => {
    const value = details.value[0];
    const newParams = { ...vignetteParams, [key]: value };
    setVignetteParams(newParams);
    engine?.setEffectParams('vignette', { [key]: value });
  };

  const updateSepiaParam = (key: keyof SepiaParams, details: { value: number[] }) => {
    const value = details.value[0];
    const newParams = { ...sepiaParams, [key]: value };
    setSepiaParams(newParams);
    engine?.setEffectParams('sepia', { [key]: value });
  };

  const resetToDefaults = () => {
    // Reset skybox
    setBlur(0);
    setIntensity(1);
    engine?.setSkyboxBlur(0);
    engine?.setSkyboxIntensity(1);

    // Reset post-processing
    setToneMapping(THREE.NoToneMapping);
    setExposure(1);
    setEnvIntensity(1);
    setPostEffect('none');
    engine?.setToneMapping(THREE.NoToneMapping);
    engine?.setExposure(1);
    engine?.setEnvironmentIntensity(1);
    engine?.setPostEffect('none');

    // Reset all effect params to defaults
    setBloomParams(DEFAULT_EFFECT_PARAMS.bloom);
    setFilmParams(DEFAULT_EFFECT_PARAMS.film);
    setGlitchParams(DEFAULT_EFFECT_PARAMS.glitch);
    setHalftoneParams(DEFAULT_EFFECT_PARAMS.halftone);
    setDotScreenParams(DEFAULT_EFFECT_PARAMS.dotScreen);
    setVignetteParams(DEFAULT_EFFECT_PARAMS.vignette);
    setSepiaParams(DEFAULT_EFFECT_PARAMS.sepia);
  };

  if (!isReady && !isRendererReady && !isComposerReady) {
    return (
      <DockableAccordionItem title="Skybox & Post FX" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">Loading...</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Skybox & Post FX" isDefaultExpanded={defaultExpanded}>
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

        {/* Post-Processing Controls */}
        {isRendererReady && (
          <>
            <Separator borderColor="gray.600" />
            <Text fontSize="xs" fontWeight="bold" color="gray.400" textTransform="uppercase" letterSpacing="wider">
              Post Processing
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

            {/* Post Effect */}
            {isComposerReady && (
              <>
                <Box>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="sm" color="gray.300">Effect</Text>
                  </HStack>
                  <NativeSelect.Root size="sm" disabled={disabled}>
                    <NativeSelect.Field
                      value={postEffect}
                      onChange={handlePostEffectChange}
                    >
                      {POST_EFFECT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Box>

                {/* Effect-specific parameters */}
                {postEffect === 'bloom' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="blue.500">
                    <Text fontSize="xs" color="blue.300" mb={2}>Bloom Settings</Text>
                    <VStack gap={3} align="stretch">
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Strength</Text>
                          <Text fontSize="xs" color="gray.500">{bloomParams.strength.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[bloomParams.strength]} onValueChange={(d) => updateBloomParam('strength', d)} min={0} max={3} step={0.01} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-blue-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Radius</Text>
                          <Text fontSize="xs" color="gray.500">{bloomParams.radius.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[bloomParams.radius]} onValueChange={(d) => updateBloomParam('radius', d)} min={0} max={1} step={0.01} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-blue-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Threshold</Text>
                          <Text fontSize="xs" color="gray.500">{bloomParams.threshold.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[bloomParams.threshold]} onValueChange={(d) => updateBloomParam('threshold', d)} min={0} max={1} step={0.01} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-blue-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                    </VStack>
                  </Box>
                )}

                {postEffect === 'film' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="orange.500">
                    <Text fontSize="xs" color="orange.300" mb={2}>Film Grain Settings</Text>
                    <Box>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="xs" color="gray.400">Intensity</Text>
                        <Text fontSize="xs" color="gray.500">{filmParams.intensity.toFixed(2)}</Text>
                      </HStack>
                      <Slider.Root value={[filmParams.intensity]} onValueChange={(d) => updateFilmParam('intensity', d)} min={0} max={1} step={0.01} disabled={disabled}>
                        <Slider.Control>
                          <Slider.Track>
                            <Slider.Range style={{ background: 'var(--chakra-colors-orange-400)' }} />
                          </Slider.Track>
                          <Slider.Thumb index={0} boxSize={3} />
                        </Slider.Control>
                      </Slider.Root>
                    </Box>
                  </Box>
                )}

                {postEffect === 'glitch' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="red.500">
                    <Text fontSize="xs" color="red.300" mb={2}>Glitch Settings</Text>
                    <HStack justify="space-between">
                      <Text fontSize="xs" color="gray.400">Wild Mode</Text>
                      <Switch.Root
                        size="sm"
                        checked={glitchParams.wild}
                        onCheckedChange={(d) => updateGlitchParam('wild', d)}
                        disabled={disabled}
                        colorPalette="red"
                      >
                        <Switch.HiddenInput />
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Root>
                    </HStack>
                  </Box>
                )}

                {postEffect === 'halftone' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="purple.500">
                    <Text fontSize="xs" color="purple.300" mb={2}>Halftone Settings</Text>
                    <VStack gap={3} align="stretch">
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Dot Size</Text>
                          <Text fontSize="xs" color="gray.500">{halftoneParams.radius.toFixed(1)}</Text>
                        </HStack>
                        <Slider.Root value={[halftoneParams.radius]} onValueChange={(d) => updateHalftoneParamNum('radius', d)} min={1} max={10} step={0.5} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-purple-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Scatter</Text>
                          <Text fontSize="xs" color="gray.500">{halftoneParams.scatter.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[halftoneParams.scatter]} onValueChange={(d) => updateHalftoneParamNum('scatter', d)} min={0} max={2} step={0.1} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-purple-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                      <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.400">Greyscale</Text>
                        <Switch.Root
                          size="sm"
                          checked={halftoneParams.greyscale}
                          onCheckedChange={(d) => updateHalftoneParamBool('greyscale', d)}
                          disabled={disabled}
                          colorPalette="purple"
                        >
                          <Switch.HiddenInput />
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Root>
                      </HStack>
                    </VStack>
                  </Box>
                )}

                {postEffect === 'dotScreen' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="cyan.500">
                    <Text fontSize="xs" color="cyan.300" mb={2}>Dot Screen Settings</Text>
                    <VStack gap={3} align="stretch">
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Scale</Text>
                          <Text fontSize="xs" color="gray.500">{dotScreenParams.scale.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[dotScreenParams.scale]} onValueChange={(d) => updateDotScreenParam('scale', d)} min={0.1} max={2} step={0.05} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-cyan-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Angle</Text>
                          <Text fontSize="xs" color="gray.500">{(dotScreenParams.angle * 180 / Math.PI).toFixed(0)}°</Text>
                        </HStack>
                        <Slider.Root value={[dotScreenParams.angle]} onValueChange={(d) => updateDotScreenParam('angle', d)} min={0} max={Math.PI} step={0.05} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range style={{ background: 'var(--chakra-colors-cyan-400)' }} />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                    </VStack>
                  </Box>
                )}

                {postEffect === 'vignette' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="gray.500">
                    <Text fontSize="xs" color="gray.300" mb={2}>Vignette Settings</Text>
                    <VStack gap={3} align="stretch">
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Offset</Text>
                          <Text fontSize="xs" color="gray.500">{vignetteParams.offset.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[vignetteParams.offset]} onValueChange={(d) => updateVignetteParam('offset', d)} min={0} max={2} step={0.05} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                      <Box>
                        <HStack justify="space-between" mb={1}>
                          <Text fontSize="xs" color="gray.400">Darkness</Text>
                          <Text fontSize="xs" color="gray.500">{vignetteParams.darkness.toFixed(2)}</Text>
                        </HStack>
                        <Slider.Root value={[vignetteParams.darkness]} onValueChange={(d) => updateVignetteParam('darkness', d)} min={0} max={2} step={0.05} disabled={disabled}>
                          <Slider.Control>
                            <Slider.Track>
                              <Slider.Range />
                            </Slider.Track>
                            <Slider.Thumb index={0} boxSize={3} />
                          </Slider.Control>
                        </Slider.Root>
                      </Box>
                    </VStack>
                  </Box>
                )}

                {postEffect === 'sepia' && (
                  <Box pl={2} borderLeft="2px solid" borderColor="yellow.600">
                    <Text fontSize="xs" color="yellow.400" mb={2}>Sepia Settings</Text>
                    <Box>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="xs" color="gray.400">Amount</Text>
                        <Text fontSize="xs" color="gray.500">{(sepiaParams.amount * 100).toFixed(0)}%</Text>
                      </HStack>
                      <Slider.Root value={[sepiaParams.amount]} onValueChange={(d) => updateSepiaParam('amount', d)} min={0} max={1} step={0.01} disabled={disabled}>
                        <Slider.Control>
                          <Slider.Track>
                            <Slider.Range style={{ background: 'var(--chakra-colors-yellow-500)' }} />
                          </Slider.Track>
                          <Slider.Thumb index={0} boxSize={3} />
                        </Slider.Control>
                      </Slider.Root>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </>
        )}
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(SkyboxSection);
