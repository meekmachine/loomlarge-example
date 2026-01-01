import { memo, useState, useEffect, useCallback } from 'react';
import { Box, Text, HStack, VStack, Button, Slider } from '@chakra-ui/react';
import DockableAccordionItem from './DockableAccordionItem';
import { useThreeOptional } from '../../context/threeContext';
import { SKYBOX_PRESETS, type SkyboxSettings } from '../../services/skyboxService';

interface SkyboxSectionProps {
  disabled?: boolean;
  defaultExpanded?: boolean;
}

/**
 * SkyboxSection - Controls for HDRI environment/skybox.
 *
 * Works seamlessly with the annotation camera system because HDRI environment maps
 * are rendered as scene backgrounds that automatically follow camera orientation.
 */
function SkyboxSection({ defaultExpanded = false }: SkyboxSectionProps) {
  const threeCtx = useThreeOptional();
  const skybox = threeCtx?.skybox;

  const [settings, setSettings] = useState<SkyboxSettings | null>(null);
  const [loading, setLoading] = useState(false);

  // Subscribe to skybox settings changes
  useEffect(() => {
    if (!skybox) return;

    setSettings(skybox.getSettings());
    const unsubscribe = skybox.subscribe(setSettings);
    return unsubscribe;
  }, [skybox]);

  const handlePresetChange = useCallback(async (presetName: string) => {
    if (!skybox) return;
    setLoading(true);
    await skybox.loadPreset(presetName);
    setLoading(false);
  }, [skybox]);

  const handleBlurChange = useCallback((details: { value: number[] }) => {
    skybox?.setBackgroundBlur(details.value[0]);
  }, [skybox]);

  const handleBgIntensityChange = useCallback((details: { value: number[] }) => {
    skybox?.setBackgroundIntensity(details.value[0]);
  }, [skybox]);

  const handleEnvIntensityChange = useCallback((details: { value: number[] }) => {
    skybox?.setEnvironmentIntensity(details.value[0]);
  }, [skybox]);

  if (!skybox) {
    return (
      <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">
            Loading skybox controls...
          </Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
      <VStack gap={3} p={2} align="stretch">
        {/* Preset selector */}
        <Box>
          <Text fontSize="xs" color="gray.400" mb={1}>Environment</Text>
          <HStack gap={1} flexWrap="wrap">
            {SKYBOX_PRESETS.map(preset => (
              <Button
                key={preset.name}
                size="xs"
                variant={settings?.preset === preset.name ? 'solid' : 'outline'}
                colorScheme={settings?.preset === preset.name ? 'blue' : 'gray'}
                onClick={() => handlePresetChange(preset.name)}
                loading={loading && settings?.preset !== preset.name}
                disabled={loading}
              >
                {preset.name}
              </Button>
            ))}
          </HStack>
        </Box>

        {/* Sliders - only show when skybox is enabled */}
        {settings?.enabled && (
          <>
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" color="gray.400">Background Blur</Text>
                <Text fontSize="xs" color="gray.500">{settings.backgroundBlur.toFixed(2)}</Text>
              </HStack>
              <Slider.Root
                value={[settings.backgroundBlur]}
                min={0}
                max={1}
                step={0.01}
                onValueChange={handleBlurChange}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>

            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" color="gray.400">Background Intensity</Text>
                <Text fontSize="xs" color="gray.500">{settings.backgroundIntensity.toFixed(2)}</Text>
              </HStack>
              <Slider.Root
                value={[settings.backgroundIntensity]}
                min={0}
                max={2}
                step={0.01}
                onValueChange={handleBgIntensityChange}
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0} boxSize={4} />
                </Slider.Control>
              </Slider.Root>
            </Box>

            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" color="gray.400">Environment Intensity</Text>
                <Text fontSize="xs" color="gray.500">{settings.environmentIntensity.toFixed(2)}</Text>
              </HStack>
              <Slider.Root
                value={[settings.environmentIntensity]}
                min={0}
                max={2}
                step={0.01}
                onValueChange={handleEnvIntensityChange}
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
