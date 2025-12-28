import React, { useEffect, useState, memo, useCallback } from 'react';
import {
  VStack,
  HStack,
  Text,
  Switch,
  Box,
  Badge,
} from '@chakra-ui/react';
import { LoomLargeThree } from 'loomlarge';
import DockableAccordionItem from './DockableAccordionItem';

interface MeshPanelProps {
  engine: LoomLargeThree | null;
  defaultExpanded?: boolean;
}

interface MeshInfo {
  name: string;
  visible: boolean;
  morphCount: number;
}

// Individual mesh row
function MeshRow({
  mesh,
  onToggle,
}: {
  mesh: MeshInfo;
  onToggle: (name: string, visible: boolean) => void;
}) {
  return (
    <Box>
      <HStack justify="space-between" fontSize="xs">
        <HStack gap={1}>
          <Text color={mesh.visible ? 'white' : 'gray.500'}>{mesh.name}</Text>
          {mesh.morphCount > 0 && (
            <Text color="white">({mesh.morphCount} morphs)</Text>
          )}
        </HStack>
        <Switch.Root
          size="sm"
          checked={mesh.visible}
          onCheckedChange={(details) => onToggle(mesh.name, details.checked)}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>
    </Box>
  );
}

function MeshPanel({ engine, defaultExpanded = false }: MeshPanelProps) {
  const [meshes, setMeshes] = useState<MeshInfo[]>([]);

  // Refresh mesh list
  const refreshMeshes = useCallback(() => {
    if (!engine) return;
    const list = engine.getMeshList();
    setMeshes(list);
  }, [engine]);

  useEffect(() => {
    refreshMeshes();
  }, [refreshMeshes]);

  const toggleMesh = useCallback((name: string, visible: boolean) => {
    engine?.setMeshVisible(name, visible);
    refreshMeshes();
  }, [engine, refreshMeshes]);

  if (!engine || meshes.length === 0) {
    return (
      <DockableAccordionItem title="Meshes" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="white">No meshes loaded</Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  return (
    <DockableAccordionItem title="Meshes" isDefaultExpanded={defaultExpanded}>
      <VStack align="stretch" gap={3} p={2}>
        <Text fontSize="xs" color="white">{meshes.length} meshes</Text>

        <Box borderWidth="1px" borderColor="gray.600" borderRadius="md" p={2}>
          <VStack align="stretch" gap={1}>
            {meshes.map(m => (
              <MeshRow
                key={m.name}
                mesh={m}
                onToggle={toggleMesh}
              />
            ))}
          </VStack>
        </Box>
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(MeshPanel);
