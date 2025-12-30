import { memo, useCallback } from 'react';
import { VStack, Text, NativeSelect, SimpleGrid, Button, Box } from '@chakra-ui/react';
import { useModulesContext } from '../../context/ModulesContext';
import { ANNOTATION_REGISTRY, getAnnotationConfig } from '../../presets/annotations';
import type { CharacterAnnotationConfig } from '../../camera/types';

interface CharacterSectionProps {
  onCharacterChange?: (config: CharacterAnnotationConfig) => void;
  currentCharacterConfig?: CharacterAnnotationConfig;
  disabled?: boolean;
}

/**
 * Format annotation name for display
 * Converts snake_case to Title Case
 */
function formatName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * CharacterSection - Tab content for character selection and camera annotations
 */
export const CharacterSection = memo(function CharacterSection({
  onCharacterChange,
  currentCharacterConfig,
  disabled = false,
}: CharacterSectionProps) {
  const { cameraController } = useModulesContext();

  // Handle character dropdown change
  const handleCharacterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const config = getAnnotationConfig(e.target.value);
      if (config && onCharacterChange) {
        onCharacterChange(config);
      }
    },
    [onCharacterChange]
  );

  // Handle annotation button click
  const handleAnnotationClick = useCallback(
    (annotationName: string) => {
      if (cameraController) {
        cameraController.focusAnnotation(annotationName);
      }
    },
    [cameraController]
  );

  // Handle full body view
  const handleFullBodyClick = useCallback(() => {
    if (cameraController) {
      cameraController.focusFullBody();
    }
  }, [cameraController]);

  const annotations = currentCharacterConfig?.annotations || [];

  return (
    <VStack align="stretch" gap={4} p={2}>
      {/* Character Selector */}
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="gray.200" mb={2}>
          Character
        </Text>
        <NativeSelect.Root size="sm" disabled={disabled}>
          <NativeSelect.Field
            value={currentCharacterConfig?.characterId || ''}
            onChange={handleCharacterChange}
            bg="gray.700"
            color="white"
            borderColor="gray.600"
          >
            {ANNOTATION_REGISTRY.characters.map((char) => (
              <option key={char.characterId} value={char.characterId}>
                {char.characterName}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Box>

      {/* Camera Views */}
      <Box>
        <Text fontSize="sm" fontWeight="semibold" color="gray.200" mb={2}>
          Camera Views
        </Text>
        <SimpleGrid columns={2} gap={2}>
          {annotations.map((annotation) => (
            <Button
              key={annotation.name}
              size="sm"
              variant="outline"
              colorPalette="blue"
              onClick={() => handleAnnotationClick(annotation.name)}
              disabled={disabled || !cameraController}
            >
              {formatName(annotation.name)}
            </Button>
          ))}
        </SimpleGrid>
      </Box>

      {/* Reset Camera */}
      <Box>
        <Button
          size="sm"
          variant="solid"
          colorPalette="gray"
          width="100%"
          onClick={handleFullBodyClick}
          disabled={disabled || !cameraController}
        >
          Reset to Full Body
        </Button>
      </Box>

      {/* Camera Info */}
      {cameraController && (
        <Box>
          <Text fontSize="xs" color="gray.400">
            Current view: {cameraController.getCurrentAnnotation() || 'Custom'}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>
            Use mouse to orbit, scroll to zoom
          </Text>
        </Box>
      )}
    </VStack>
  );
});

export default CharacterSection;
