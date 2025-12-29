import { memo } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { LoomLargeThree } from 'loomlarge';
import DockableAccordionItem from './DockableAccordionItem';

interface SkyboxSectionProps {
  engine: LoomLargeThree | null;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

/**
 * SkyboxSection - Placeholder for skybox controls
 *
 * Skybox functionality is app-specific and not part of the loomlarge NPM package.
 * This component is kept as a placeholder for future app-level implementation.
 */
function SkyboxSection({ defaultExpanded = false }: SkyboxSectionProps) {
  return (
    <DockableAccordionItem title="Skybox & Lighting" isDefaultExpanded={defaultExpanded}>
      <Box p={2}>
        <Text fontSize="sm" color="gray.400">
          Skybox controls not available in this version
        </Text>
      </Box>
    </DockableAccordionItem>
  );
}

export default memo(SkyboxSection);
