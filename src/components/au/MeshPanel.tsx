import { useEffect, useState, memo, useCallback } from 'react';
import {
  VStack,
  HStack,
  Text,
  Switch,
  Box,
  IconButton,
  Collapsible,
  NativeSelect,
  Slider,
} from '@chakra-ui/react';
import { LoomLargeThree, BLENDING_MODES, type BlendingMode } from 'loomlarge';
import DockableAccordionItem from './DockableAccordionItem';
import { LuChevronDown, LuChevronRight } from 'react-icons/lu';

interface MeshPanelProps {
  engine: LoomLargeThree | null;
  defaultExpanded?: boolean;
}

interface MeshInfo {
  name: string;
  visible: boolean;
  morphCount: number;
}

interface MaterialConfig {
  renderOrder: number;
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  depthTest: boolean;
  blending: string;
}

// Blending mode options for dropdown
const BLENDING_OPTIONS = Object.keys(BLENDING_MODES) as BlendingMode[];

// Material config sub-component
function MeshMaterialConfig({
  meshName,
  engine,
}: {
  meshName: string;
  engine: LoomLargeThree;
}) {
  const [config, setConfig] = useState<MaterialConfig | null>(null);

  useEffect(() => {
    const c = engine.getMeshMaterialConfig(meshName);
    if (c) setConfig(c);
  }, [engine, meshName]);

  if (!config) return null;

  const updateConfig = (updates: Partial<MaterialConfig>) => {
    engine.setMeshMaterialConfig(meshName, updates);
    const newConfig = engine.getMeshMaterialConfig(meshName);
    if (newConfig) setConfig(newConfig);
  };

  return (
    <VStack align="stretch" gap={2} pl={4} pt={2} pb={2} borderLeft="2px solid" borderColor="gray.600">
      {/* Render Order */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Render Order</Text>
        <Text fontSize="xs" color="white" w="40px" textAlign="right">{config.renderOrder}</Text>
      </HStack>
      <Slider.Root
        size="sm"
        min={-20}
        max={20}
        step={1}
        value={[config.renderOrder]}
        onValueChange={(details) => updateConfig({ renderOrder: details.value[0] })}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>

      {/* Opacity */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Opacity</Text>
        <Text fontSize="xs" color="white" w="40px" textAlign="right">{config.opacity.toFixed(2)}</Text>
      </HStack>
      <Slider.Root
        size="sm"
        min={0}
        max={1}
        step={0.01}
        value={[config.opacity]}
        onValueChange={(details) => updateConfig({ opacity: details.value[0] })}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>

      {/* Toggles */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Transparent</Text>
        <Switch.Root
          size="sm"
          checked={config.transparent}
          onCheckedChange={(details) => updateConfig({ transparent: details.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Depth Write</Text>
        <Switch.Root
          size="sm"
          checked={config.depthWrite}
          onCheckedChange={(details) => updateConfig({ depthWrite: details.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Depth Test</Text>
        <Switch.Root
          size="sm"
          checked={config.depthTest}
          onCheckedChange={(details) => updateConfig({ depthTest: details.checked })}
        >
          <Switch.HiddenInput />
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Root>
      </HStack>

      {/* Blending Mode */}
      <HStack justify="space-between">
        <Text fontSize="xs" color="white">Blending</Text>
        <NativeSelect.Root size="xs" w="100px">
          <NativeSelect.Field
            value={config.blending}
            onChange={(e) => updateConfig({ blending: e.target.value })}
          >
            {BLENDING_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
      </HStack>
    </VStack>
  );
}

// Individual mesh row with expandable material config
function MeshRow({
  mesh,
  engine,
  onToggle,
}: {
  mesh: MeshInfo;
  engine: LoomLargeThree;
  onToggle: (name: string, visible: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible.Root open={expanded} onOpenChange={(details) => setExpanded(details.open)}>
      <Box>
        <HStack justify="space-between" fontSize="xs">
          <HStack gap={1}>
            <Collapsible.Trigger asChild>
              <IconButton
                aria-label="Expand material config"
                size="xs"
                variant="ghost"
              >
                {expanded ? <LuChevronDown size={16} /> : <LuChevronRight size={16} />}
              </IconButton>
            </Collapsible.Trigger>
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
        <Collapsible.Content>
          <MeshMaterialConfig meshName={mesh.name} engine={engine} />
        </Collapsible.Content>
      </Box>
    </Collapsible.Root>
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
        <Text fontSize="xs" color="white">{meshes.length} meshes - click arrow to configure material</Text>

        <Box borderWidth="1px" borderColor="gray.600" borderRadius="md" p={2}>
          <VStack align="stretch" gap={1}>
            {meshes.map(m => (
              <MeshRow
                key={m.name}
                mesh={m}
                engine={engine}
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
