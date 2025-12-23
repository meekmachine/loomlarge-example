import React, { useState } from 'react';
import {
  Box,
  Slider,
  Tooltip,
  Text
} from '@chakra-ui/react';

interface VisemeSliderProps {
  viseme: string;
  name?: string;
  intensity: number;
  onChange: (newIntensity: number) => void;
}

/**
 * VisemeSlider - Controls viseme (speech pose) intensity from 0-1
 * Calls engine.setMorph() directly via onChange callback
 */
const VisemeSlider: React.FC<VisemeSliderProps> = ({
  viseme,
  name,
  intensity,
  onChange
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Color interpolation: teal (0) -> magenta (1)
  const getSliderColor = (value: number): string => {
    // Simple RGB interpolation between teal and magenta
    const teal = { r: 0, g: 128, b: 128 };
    const magenta = { r: 255, g: 0, b: 255 };
    const r = Math.round(teal.r + (magenta.r - teal.r) * value);
    const g = Math.round(teal.g + (magenta.g - teal.g) * value);
    const b = Math.round(teal.b + (magenta.b - teal.b) * value);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const handleSliderChange = (value: number) => {
    onChange(value);
  };

  return (
    <Box width="100%">
      {name && <Text mb={2} fontSize="sm">{name}</Text>}

      <Slider.Root
        value={[intensity]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={(details) => handleSliderChange(details.value[0])}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Slider.Control>
          <Slider.Track>
            <Slider.Range style={{ background: getSliderColor(intensity) }} />
          </Slider.Track>
          <Tooltip.Root open={showTooltip}>
            <Tooltip.Trigger asChild>
              <Slider.Thumb index={0} />
            </Tooltip.Trigger>
            <Tooltip.Positioner>
              <Tooltip.Content bg="teal.500" color="white">
                {`${(intensity * 100).toFixed(0)}%`}
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Tooltip.Root>
        </Slider.Control>
      </Slider.Root>
    </Box>
  );
};

export default VisemeSlider;
