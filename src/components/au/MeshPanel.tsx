import { useEffect, useState, memo, useCallback, useMemo } from 'react';
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
import { LoomLargeThree } from 'loomlarge';
import * as THREE from 'three';
import DockableAccordionItem from './DockableAccordionItem';
import { LuChevronDown, LuChevronRight } from 'react-icons/lu';

// Blending modes mapping (THREE.js blending constants)
const BLENDING_MODES = {
  Normal: THREE.NormalBlending,
  Additive: THREE.AdditiveBlending,
  Subtractive: THREE.SubtractiveBlending,
  Multiply: THREE.MultiplyBlending,
  Custom: THREE.CustomBlending,
  None: THREE.NoBlending,
} as const;

type BlendingMode = keyof typeof BLENDING_MODES;

interface MeshPanelProps {
  engine: LoomLargeThree | null;
  defaultExpanded?: boolean;
}

interface MeshInfo {
  name: string;
  visible: boolean;
  morphCount: number;
  category?: string;
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

// Category display names
const CATEGORY_LABELS: Record<string, string> = {
  body: 'Body',
  eye: 'Eyes',
  eyeOcclusion: 'Eye Occlusion',
  tearLine: 'Tear Lines',
  cornea: 'Cornea',
  teeth: 'Teeth',
  tongue: 'Tongue',
  eyebrow: 'Eyebrows',
  hair: 'Hair',
  eyelash: 'Eyelashes',
  other: 'Other',
};

// Type guard for engines that support material config
function hasMaterialConfig(engine: LoomLargeThree): engine is LoomLargeThree & {
  getMeshMaterialConfig: (name: string) => MaterialConfig | null;
  setMeshMaterialConfig: (name: string, config: Partial<MaterialConfig>) => void;
} {
  return 'getMeshMaterialConfig' in engine && 'setMeshMaterialConfig' in engine;
}

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
    if (hasMaterialConfig(engine)) {
      const c = engine.getMeshMaterialConfig(meshName);
      if (c) setConfig(c);
    }
  }, [engine, meshName]);

  if (!config || !hasMaterialConfig(engine)) return null;

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
                color="white"
              >
                {expanded ? <LuChevronDown size={16} /> : <LuChevronRight size={16} />}
              </IconButton>
            </Collapsible.Trigger>
            <Text color={mesh.visible ? 'white' : 'gray.500'}>{mesh.name}</Text>
            {mesh.morphCount > 0 && (
              <Text color="white">({mesh.morphCount})</Text>
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

// Category group component
function CategoryGroup({
  category,
  meshes,
  engine,
  onToggle,
}: {
  category: string;
  meshes: MeshInfo[];
  engine: LoomLargeThree;
  onToggle: (name: string, visible: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const label = CATEGORY_LABELS[category] || category;
  const visibleCount = meshes.filter(m => m.visible).length;

  return (
    <Collapsible.Root open={expanded} onOpenChange={(details) => setExpanded(details.open)}>
      <Box borderWidth="1px" borderColor="gray.600" borderRadius="md" mb={2}>
        <HStack
          justify="space-between"
          p={2}
          bg="gray.800"
          borderRadius="md"
          cursor="pointer"
        >
          <Collapsible.Trigger asChild>
            <HStack gap={1} flex={1}>
              <IconButton
                aria-label="Expand category"
                size="xs"
                variant="ghost"
                color="white"
              >
                {expanded ? <LuChevronDown size={16} /> : <LuChevronRight size={16} />}
              </IconButton>
              <Text fontSize="sm" fontWeight="bold" color="white">{label}</Text>
              <Text fontSize="xs" color="white">({visibleCount}/{meshes.length})</Text>
            </HStack>
          </Collapsible.Trigger>
        </HStack>
        <Collapsible.Content>
          <VStack align="stretch" gap={1} p={2}>
            {meshes.map(m => (
              <MeshRow
                key={m.name}
                mesh={m}
                engine={engine}
                onToggle={onToggle}
              />
            ))}
          </VStack>
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

  // Group meshes by category
  const groupedMeshes = useMemo(() => {
    const groups: Record<string, MeshInfo[]> = {};
    for (const mesh of meshes) {
      const cat = mesh.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(mesh);
    }
    // Sort categories in a logical order
    const order = ['body', 'eye', 'cornea', 'eyeOcclusion', 'tearLine', 'eyebrow', 'eyelash', 'teeth', 'tongue', 'hair', 'other'];
    const sorted: [string, MeshInfo[]][] = [];
    for (const cat of order) {
      if (groups[cat]) sorted.push([cat, groups[cat]]);
    }
    // Add any categories not in the order list
    for (const cat of Object.keys(groups)) {
      if (!order.includes(cat)) sorted.push([cat, groups[cat]]);
    }
    return sorted;
  }, [meshes]);

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
      <VStack align="stretch" gap={2} p={2}>
        <Text fontSize="xs" color="white">{meshes.length} meshes - click arrow to configure material</Text>

        {groupedMeshes.map(([category, categoryMeshes]) => (
          <CategoryGroup
            key={category}
            category={category}
            meshes={categoryMeshes}
            engine={engine}
            onToggle={toggleMesh}
          />
        ))}
      </VStack>
    </DockableAccordionItem>
  );
}

export default memo(MeshPanel);
