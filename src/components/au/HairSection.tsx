import React, { useEffect, useState, memo, useRef, useCallback } from 'react';
import {
  VStack,
  HStack,
  Text,
  NativeSelect,
  Slider,
  Box,
  Input,
  Switch,
  Button,
} from '@chakra-ui/react';
import { HairService } from '../../latticework/hair/hairService';
import { HairState, HAIR_COLOR_PRESETS } from '../../latticework/hair/types';
import DockableAccordionItem from './DockableAccordionItem';
import { useThreeState } from '../../context/threeContext';

interface HairSectionProps {
  disabled?: boolean;
  defaultExpanded?: boolean;
}

// Physics config interface matching HairService
interface PhysicsConfig {
  enabled: boolean;
  stiffness: number;
  damping: number;
  inertia: number;
  gravity: number;
  responseScale: number;
  idleSwayAmount: number;
  idleSwaySpeed: number;
  windStrength: number;
  windDirectionX: number;
  windDirectionZ: number;
  windTurbulence: number;
  windFrequency: number;
}

// Uncontrolled slider component - manages its own state
const UncontrolledSlider = memo(function UncontrolledSlider({
  label,
  initialValue,
  min,
  max,
  step,
  disabled,
  onChange,
  color = 'var(--chakra-colors-cyan-400)',
  showValue = true,
  formatValue = (v: number) => v.toFixed(2),
}: {
  label: string;
  initialValue: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  color?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
}) {
  const [value, setValue] = useState(initialValue);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback((details: { value: number[] }) => {
    const newValue = details.value[0];
    setValue(newValue);
    onChangeRef.current(newValue);
  }, []);

  return (
    <VStack align="stretch" gap={1}>
      <HStack justify="space-between">
        <Text fontSize="xs" color="gray.50">{label}</Text>
        {showValue && (
          <Text fontSize="xs" color="gray.300">{formatValue(value)}</Text>
        )}
      </HStack>
      <Slider.Root
        value={[value]}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range style={{ background: color }} />
          </Slider.Track>
          <Slider.Thumb index={0} />
        </Slider.Control>
      </Slider.Root>
    </VStack>
  );
});

// Uncontrolled color input - manages its own state
const UncontrolledColorInput = memo(function UncontrolledColorInput({
  label,
  initialValue,
  disabled,
  onChange,
}: {
  label: string;
  initialValue: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChangeRef.current(newValue);
  }, []);

  return (
    <VStack align="stretch" gap={1}>
      <Text fontSize="xs" color="gray.50">{label}</Text>
      <HStack gap={2}>
        <Input
          type="color"
          value={value}
          onChange={handleChange}
          w="60px"
          h="32px"
          p={1}
          disabled={disabled}
        />
        <Input
          type="text"
          value={value.toUpperCase()}
          onChange={handleChange}
          placeholder="#000000"
          size="sm"
          fontFamily="mono"
          textTransform="uppercase"
          disabled={disabled}
        />
      </HStack>
    </VStack>
  );
});

// Uncontrolled switch - manages its own state
const UncontrolledSwitch = memo(function UncontrolledSwitch({
  label,
  initialValue,
  disabled,
  onChange,
  colorPalette = 'brand',
}: {
  label: string;
  initialValue: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  colorPalette?: string;
}) {
  const [checked, setChecked] = useState(initialValue);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback((details: { checked: boolean }) => {
    setChecked(details.checked);
    onChangeRef.current(details.checked);
  }, []);

  return (
    <HStack justify="space-between">
      <Text fontSize="xs" color="gray.50">{label}</Text>
      <Switch.Root
        checked={checked}
        onCheckedChange={handleChange}
        disabled={disabled}
        size="sm"
        colorPalette={colorPalette}
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Root>
    </HStack>
  );
});

const HairSection = memo(function HairSection({ disabled = false, defaultExpanded = false }: HairSectionProps) {
  const { engine } = useThreeState();
  const hairServiceRef = useRef<HairService | null>(null);

  // Only store initial state - don't subscribe to updates
  const [initialState, setInitialState] = useState<HairState | null>(null);
  const [availableMorphs, setAvailableMorphs] = useState<string[]>([]);
  const [initialPhysicsConfig, setInitialPhysicsConfig] = useState<PhysicsConfig | null>(null);

  // Create HairService on mount
  useEffect(() => {
    if (!engine) return;

    const hairObjects = engine.getRegisteredHairObjects();
    if (hairObjects.length === 0) return;

    // Create service if not exists
    if (!hairServiceRef.current) {
      hairServiceRef.current = new HairService(engine);
      hairServiceRef.current.registerObjects(hairObjects);
    }

    const hairService = hairServiceRef.current;

    // Get initial state ONCE - don't subscribe
    setInitialState(hairService.getState());
    setAvailableMorphs(hairService.getAvailableHairMorphs());
    setInitialPhysicsConfig(hairService.getPhysicsConfig());

    // NO subscriptions - sliders are uncontrolled
  }, [engine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      hairServiceRef.current?.dispose();
      hairServiceRef.current = null;
    };
  }, []);

  const hairService = hairServiceRef.current;

  if (!hairService || !initialState) {
    return (
      <DockableAccordionItem title="Hair & Eyebrows" isDefaultExpanded={defaultExpanded}>
        <Box p={2}>
          <Text fontSize="sm" color="gray.400">
            No hair objects in model
          </Text>
        </Box>
      </DockableAccordionItem>
    );
  }

  // Stable callbacks using refs - don't cause re-renders
  const handleHairPresetChange = (colorKey: string) => {
    const color = HAIR_COLOR_PRESETS[colorKey];
    if (color) {
      hairService.send({ type: 'SET_HAIR_COLOR', color });
    }
  };

  const handleHairBaseColorChange = (baseColor: string) => {
    hairService.send({ type: 'SET_HAIR_BASE_COLOR', baseColor });
  };

  const handleHairGlowColorChange = (emissive: string) => {
    hairService.send({
      type: 'SET_HAIR_GLOW',
      emissive,
      intensity: initialState.hairColor.emissiveIntensity,
    });
  };

  const handleHairGlowIntensityChange = (intensity: number) => {
    hairService.send({
      type: 'SET_HAIR_GLOW',
      emissive: initialState.hairColor.emissive,
      intensity,
    });
  };

  const handleEyebrowPresetChange = (colorKey: string) => {
    const color = HAIR_COLOR_PRESETS[colorKey];
    if (color) {
      hairService.send({ type: 'SET_EYEBROW_COLOR', color });
    }
  };

  const handleEyebrowBaseColorChange = (baseColor: string) => {
    hairService.send({ type: 'SET_EYEBROW_BASE_COLOR', baseColor });
  };

  const handleEyebrowGlowColorChange = (emissive: string) => {
    hairService.send({
      type: 'SET_EYEBROW_GLOW',
      emissive,
      intensity: initialState.eyebrowColor.emissiveIntensity,
    });
  };

  const handleEyebrowGlowIntensityChange = (intensity: number) => {
    hairService.send({
      type: 'SET_EYEBROW_GLOW',
      emissive: initialState.eyebrowColor.emissive,
      intensity,
    });
  };

  const handleOutlineToggle = (show: boolean) => {
    hairService.send({ type: 'SET_OUTLINE', show });
  };

  const handleOutlineColorChange = (color: string) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: true, // If changing color, outline is on
      color,
    });
  };

  const handleOutlineOpacityChange = (opacity: number) => {
    hairService.send({
      type: 'SET_OUTLINE',
      show: true,
      opacity,
    });
  };

  const handlePhysicsToggle = (enabled: boolean) => {
    hairService.setPhysicsEnabled(enabled);
  };

  const handlePhysicsConfigChange = (key: keyof PhysicsConfig, value: number) => {
    hairService.updatePhysicsConfig({ [key]: value });
  };

  const handleAnimateHairMorph = (morphKey: string, value: number) => {
    hairService.animateHairMorph(morphKey, value, 300);
  };

  const handleReset = () => {
    hairService.send({ type: 'RESET_TO_DEFAULT' });
  };

  const colorPresetKeys = Object.keys(HAIR_COLOR_PRESETS);

  return (
    <DockableAccordionItem title="Hair & Eyebrows" isDefaultExpanded={defaultExpanded}>
      <VStack gap={4} align="stretch" p={2}>
        {/* HAIR SECTION */}
        <Box>
          <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
            HAIR
          </Text>

          {/* Hair Preset */}
          <VStack align="stretch" gap={2} mb={3}>
            <Text fontSize="xs" color="gray.50">Preset</Text>
            <NativeSelect.Root size="sm" disabled={disabled}>
              <NativeSelect.Field
                defaultValue=""
                onChange={(e) => handleHairPresetChange(e.target.value)}
              >
                <option value="">Select Preset...</option>
                {colorPresetKeys.map((key) => (
                  <option key={key} value={key}>
                    {HAIR_COLOR_PRESETS[key].name}
                  </option>
                ))}
              </NativeSelect.Field>
            </NativeSelect.Root>
          </VStack>

          {/* Hair Base Color */}
          <Box mb={3}>
            <UncontrolledColorInput
              label="Base Color"
              initialValue={initialState.hairColor.baseColor}
              disabled={disabled}
              onChange={handleHairBaseColorChange}
            />
          </Box>

          {/* Hair Glow Color */}
          <Box mb={3}>
            <UncontrolledColorInput
              label="Glow Color"
              initialValue={initialState.hairColor.emissive}
              disabled={disabled}
              onChange={handleHairGlowColorChange}
            />
          </Box>

          {/* Hair Glow Intensity */}
          <Box mb={3}>
            <UncontrolledSlider
              label="Glow Intensity"
              initialValue={initialState.hairColor.emissiveIntensity}
              min={0}
              max={1}
              step={0.01}
              disabled={disabled}
              onChange={handleHairGlowIntensityChange}
            />
          </Box>
        </Box>

        {/* EYEBROWS SECTION */}
        <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
          <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
            EYEBROWS
          </Text>

          {/* Eyebrow Preset */}
          <VStack align="stretch" gap={2} mb={3}>
            <Text fontSize="xs" color="gray.50">Preset</Text>
            <NativeSelect.Root size="sm" disabled={disabled}>
              <NativeSelect.Field
                defaultValue=""
                onChange={(e) => handleEyebrowPresetChange(e.target.value)}
              >
                <option value="">Select Preset...</option>
                {colorPresetKeys.map((key) => (
                  <option key={key} value={key}>
                    {HAIR_COLOR_PRESETS[key].name}
                  </option>
                ))}
              </NativeSelect.Field>
            </NativeSelect.Root>
          </VStack>

          {/* Eyebrow Base Color */}
          <Box mb={3}>
            <UncontrolledColorInput
              label="Base Color"
              initialValue={initialState.eyebrowColor.baseColor}
              disabled={disabled}
              onChange={handleEyebrowBaseColorChange}
            />
          </Box>

          {/* Eyebrow Glow Color */}
          <Box mb={3}>
            <UncontrolledColorInput
              label="Glow Color"
              initialValue={initialState.eyebrowColor.emissive}
              disabled={disabled}
              onChange={handleEyebrowGlowColorChange}
            />
          </Box>

          {/* Eyebrow Glow Intensity */}
          <Box mb={3}>
            <UncontrolledSlider
              label="Glow Intensity"
              initialValue={initialState.eyebrowColor.emissiveIntensity}
              min={0}
              max={1}
              step={0.01}
              disabled={disabled}
              onChange={handleEyebrowGlowIntensityChange}
            />
          </Box>
        </Box>

        {/* OUTLINE SECTION */}
        <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
          <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
            OUTLINE
          </Text>

          <Box mb={3}>
            <UncontrolledSwitch
              label="Show Outline"
              initialValue={initialState.showOutline}
              disabled={disabled}
              onChange={handleOutlineToggle}
            />
          </Box>

          {/* Outline Color - always visible since we don't track state */}
          <Box mb={3}>
            <UncontrolledColorInput
              label="Outline Color"
              initialValue={initialState.outlineColor}
              disabled={disabled}
              onChange={handleOutlineColorChange}
            />
          </Box>

          <Box mb={3}>
            <UncontrolledSlider
              label="Opacity"
              initialValue={initialState.outlineOpacity}
              min={0}
              max={1}
              step={0.1}
              disabled={disabled}
              onChange={handleOutlineOpacityChange}
              formatValue={(v) => v.toFixed(1)}
            />
          </Box>
        </Box>

        {/* HAIR PHYSICS SECTION */}
        {initialPhysicsConfig && (
          <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
            <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
              HAIR PHYSICS
            </Text>
            <Text fontSize="xs" color="gray.400" mb={3}>
              Simulates hair movement based on head motion
            </Text>

            <Box mb={4}>
              <UncontrolledSwitch
                label="Enable Physics"
                initialValue={initialPhysicsConfig.enabled}
                disabled={disabled}
                onChange={handlePhysicsToggle}
                colorPalette="cyan"
              />
            </Box>

            <VStack align="stretch" gap={3}>
              <UncontrolledSlider
                label="Head Influence"
                initialValue={initialPhysicsConfig.inertia}
                min={0}
                max={5}
                step={0.2}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('inertia', v)}
                formatValue={(v) => v.toFixed(1)}
              />

              <UncontrolledSlider
                label="Stiffness"
                initialValue={initialPhysicsConfig.stiffness}
                min={1}
                max={20}
                step={0.5}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('stiffness', v)}
                formatValue={(v) => v.toFixed(1)}
              />

              <UncontrolledSlider
                label="Air Resistance"
                initialValue={initialPhysicsConfig.damping}
                min={0}
                max={1}
                step={0.05}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('damping', v)}
              />

              <UncontrolledSlider
                label="Gravity"
                initialValue={initialPhysicsConfig.gravity}
                min={0}
                max={40}
                step={0.5}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('gravity', v)}
                formatValue={(v) => v.toFixed(1)}
              />

              <UncontrolledSlider
                label="Response Scale"
                initialValue={initialPhysicsConfig.responseScale}
                min={1}
                max={5}
                step={0.25}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('responseScale', v)}
                color="var(--chakra-colors-yellow-400)"
                formatValue={(v) => `${v.toFixed(1)}x`}
              />

              <UncontrolledSlider
                label="Idle Sway"
                initialValue={initialPhysicsConfig.idleSwayAmount}
                min={0}
                max={0.5}
                step={0.02}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('idleSwayAmount', v)}
              />

              <UncontrolledSlider
                label="Sway Speed"
                initialValue={initialPhysicsConfig.idleSwaySpeed}
                min={0.2}
                max={2}
                step={0.1}
                disabled={disabled}
                onChange={(v) => handlePhysicsConfigChange('idleSwaySpeed', v)}
                formatValue={(v) => v.toFixed(1)}
              />

              {/* Wind Simulation Section */}
              <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={3} mt={2}>
                <Text fontSize="xs" fontWeight="bold" color="teal.300" mb={2}>
                  WIND SIMULATION
                </Text>

                <VStack align="stretch" gap={3}>
                  <UncontrolledSlider
                    label="Wind Strength"
                    initialValue={initialPhysicsConfig.windStrength}
                    min={0}
                    max={20}
                    step={0.5}
                    disabled={disabled}
                    onChange={(v) => handlePhysicsConfigChange('windStrength', v)}
                    color="var(--chakra-colors-teal-400)"
                    formatValue={(v) => v.toFixed(1)}
                  />

                  <UncontrolledSlider
                    label="Direction (Left/Right)"
                    initialValue={initialPhysicsConfig.windDirectionX}
                    min={-1}
                    max={1}
                    step={0.1}
                    disabled={disabled}
                    onChange={(v) => handlePhysicsConfigChange('windDirectionX', v)}
                    color="var(--chakra-colors-teal-400)"
                  />

                  <UncontrolledSlider
                    label="Direction (Front/Back)"
                    initialValue={initialPhysicsConfig.windDirectionZ}
                    min={-1}
                    max={1}
                    step={0.1}
                    disabled={disabled}
                    onChange={(v) => handlePhysicsConfigChange('windDirectionZ', v)}
                    color="var(--chakra-colors-teal-400)"
                  />

                  <UncontrolledSlider
                    label="Turbulence"
                    initialValue={initialPhysicsConfig.windTurbulence}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={disabled}
                    onChange={(v) => handlePhysicsConfigChange('windTurbulence', v)}
                    color="var(--chakra-colors-teal-400)"
                  />

                  <UncontrolledSlider
                    label="Gust Speed"
                    initialValue={initialPhysicsConfig.windFrequency}
                    min={0.5}
                    max={5}
                    step={0.1}
                    disabled={disabled}
                    onChange={(v) => handlePhysicsConfigChange('windFrequency', v)}
                    color="var(--chakra-colors-teal-400)"
                    formatValue={(v) => v.toFixed(1)}
                  />
                </VStack>
              </Box>
            </VStack>
          </Box>
        )}

        {/* HAIR ANIMATION SECTION */}
        {availableMorphs.length > 0 && (
          <Box borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}>
            <Text fontSize="sm" fontWeight="bold" color="brand.300" mb={2}>
              HAIR ANIMATION
            </Text>
            <Text fontSize="xs" color="gray.400" mb={3}>
              Animate hair shape keys (morph targets)
            </Text>
            <VStack align="stretch" gap={3}>
              {availableMorphs.map((morphKey) => (
                <UncontrolledSlider
                  key={morphKey}
                  label={morphKey}
                  initialValue={0}
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={disabled}
                  onChange={(v) => handleAnimateHairMorph(morphKey, v)}
                  color="var(--chakra-colors-cyan-400)"
                  formatValue={(v) => v.toFixed(1)}
                />
              ))}
            </VStack>
          </Box>
        )}

        {/* RESET BUTTON */}
        <Button
          size="sm"
          colorPalette="orange"
          onClick={handleReset}
          disabled={disabled}
        >
          Reset to Default
        </Button>
      </VStack>
    </DockableAccordionItem>
  );
});

export default HairSection;
