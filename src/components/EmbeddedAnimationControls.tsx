/**
 * EmbeddedAnimationControls - Controls for GLTF/GLB embedded animations
 * Allows play/pause/stop, speed control, and scrubbing for animations
 * baked into the model file (e.g., fish swimming, character walking)
 */
import { useState, useEffect, useCallback, memo } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Slider,
  IconButton,
} from '@chakra-ui/react';
import { FaPlay, FaPause, FaStop, FaRedo } from 'react-icons/fa';
import * as THREE from 'three';

interface AnimationClipInfo {
  name: string;
  duration: number;
  action: THREE.AnimationAction;
}

interface EmbeddedAnimationControlsProps {
  mixer: THREE.AnimationMixer | null;
  clips: THREE.AnimationClip[];
}

// Individual clip control card
const ClipCard = memo(function ClipCard({
  clip,
  action,
  isPlaying,
  currentTime,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSpeedChange,
  onIntensityChange,
  onLoopToggle,
}: {
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
  isPlaying: boolean;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onIntensityChange: (intensity: number) => void;
  onLoopToggle: () => void;
}) {
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(1);
  const isLooping = action.loop === THREE.LoopRepeat;
  const progress = clip.duration > 0 ? (currentTime / clip.duration) * 100 : 0;

  const handleSpeedChange = (details: { value: number[] }) => {
    const newSpeed = details.value[0];
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  const handleIntensityChange = (details: { value: number[] }) => {
    const newIntensity = details.value[0];
    setIntensity(newIntensity);
    onIntensityChange(newIntensity);
  };

  const handleSeek = (details: { value: number[] }) => {
    const percent = details.value[0];
    const time = (percent / 100) * clip.duration;
    onSeek(time);
  };

  return (
    <Box
      p={3}
      bg="gray.700"
      borderRadius="md"
      borderLeft="4px solid"
      borderLeftColor="teal.400"
    >
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold" fontSize="sm" color="white">
          {clip.name || 'Unnamed Animation'}
        </Text>
        <Text fontSize="xs" color="gray.400">
          {clip.duration.toFixed(2)}s
        </Text>
      </HStack>

      {/* Playback controls */}
      <HStack gap={1} mb={3}>
        {isPlaying ? (
          <IconButton
            aria-label="Pause"
            size="sm"
            colorPalette="yellow"
            onClick={onPause}
          >
            <FaPause />
          </IconButton>
        ) : (
          <IconButton
            aria-label="Play"
            size="sm"
            colorPalette="green"
            onClick={onPlay}
          >
            <FaPlay />
          </IconButton>
        )}
        <IconButton
          aria-label="Stop"
          size="sm"
          colorPalette="red"
          onClick={onStop}
        >
          <FaStop />
        </IconButton>
        <IconButton
          aria-label="Toggle Loop"
          size="sm"
          colorPalette={isLooping ? 'teal' : 'gray'}
          onClick={onLoopToggle}
          title={isLooping ? 'Looping' : 'Play Once'}
        >
          <FaRedo />
        </IconButton>
        <Text fontSize="xs" color="gray.300" ml={2}>
          {currentTime.toFixed(2)}s / {clip.duration.toFixed(2)}s
        </Text>
      </HStack>

      {/* Timeline scrubber */}
      <Box mb={3}>
        <Text fontSize="xs" color="gray.400" mb={1}>Timeline</Text>
        <Slider.Root
          min={0}
          max={100}
          step={0.1}
          value={[progress]}
          onValueChange={handleSeek}
          size="sm"
        >
          <Slider.Control>
            <Slider.Track bg="gray.600">
              <Slider.Range bg="teal.400" />
            </Slider.Track>
            <Slider.Thumb index={0} bg="white" />
          </Slider.Control>
        </Slider.Root>
      </Box>

      {/* Intensity control (animation weight) */}
      <Box mb={3}>
        <HStack justify="space-between" mb={1}>
          <Text fontSize="xs" color="gray.400">Intensity</Text>
          <Text fontSize="xs" color="orange.300">{Math.round(intensity * 100)}%</Text>
        </HStack>
        <Slider.Root
          min={0}
          max={1}
          step={0.01}
          value={[intensity]}
          onValueChange={handleIntensityChange}
          size="sm"
        >
          <Slider.Control>
            <Slider.Track bg="gray.600">
              <Slider.Range bg="orange.400" />
            </Slider.Track>
            <Slider.Thumb index={0} bg="white" />
          </Slider.Control>
        </Slider.Root>
      </Box>

      {/* Speed control */}
      <Box>
        <HStack justify="space-between" mb={1}>
          <Text fontSize="xs" color="gray.400">Speed</Text>
          <Text fontSize="xs" color="purple.300">{speed.toFixed(2)}x</Text>
        </HStack>
        <Slider.Root
          min={0.1}
          max={3}
          step={0.1}
          value={[speed]}
          onValueChange={handleSpeedChange}
          size="sm"
        >
          <Slider.Control>
            <Slider.Track bg="gray.600">
              <Slider.Range bg="purple.400" />
            </Slider.Track>
            <Slider.Thumb index={0} bg="white" />
          </Slider.Control>
        </Slider.Root>
      </Box>
    </Box>
  );
});

function EmbeddedAnimationControls({ mixer, clips }: EmbeddedAnimationControlsProps) {
  const [actions, setActions] = useState<Map<string, THREE.AnimationAction>>(new Map());
  const [playingStates, setPlayingStates] = useState<Map<string, boolean>>(new Map());
  const [currentTimes, setCurrentTimes] = useState<Map<string, number>>(new Map());

  // Initialize actions when mixer/clips change
  useEffect(() => {
    if (!mixer || !clips.length) {
      setActions(new Map());
      return;
    }

    const newActions = new Map<string, THREE.AnimationAction>();
    const newPlayingStates = new Map<string, boolean>();
    const newTimes = new Map<string, number>();

    clips.forEach((clip) => {
      // Get the existing action (clipAction returns cached action if it exists)
      const action = mixer.clipAction(clip);
      console.log(`EmbeddedAnimationControls: Action "${clip.name}" - isRunning: ${action.isRunning()}, time: ${action.time}, enabled: ${action.enabled}, paused: ${action.paused}`);
      newActions.set(clip.name, action);
      newPlayingStates.set(clip.name, action.isRunning());
      newTimes.set(clip.name, action.time);
    });

    setActions(newActions);
    setPlayingStates(newPlayingStates);
    setCurrentTimes(newTimes);
  }, [mixer, clips]);

  // Update current times periodically
  useEffect(() => {
    if (!mixer || !actions.size) return;

    const interval = setInterval(() => {
      const newTimes = new Map<string, number>();
      const newPlaying = new Map<string, boolean>();

      actions.forEach((action, name) => {
        newTimes.set(name, action.time);
        newPlaying.set(name, action.isRunning());
      });

      setCurrentTimes(newTimes);
      setPlayingStates(newPlaying);
    }, 50); // Update at ~20fps

    return () => clearInterval(interval);
  }, [mixer, actions]);

  const handlePlay = useCallback((clipName: string) => {
    const action = actions.get(clipName);
    if (action) {
      action.paused = false;
      action.play();
      setPlayingStates(prev => new Map(prev).set(clipName, true));
    }
  }, [actions]);

  const handlePause = useCallback((clipName: string) => {
    const action = actions.get(clipName);
    if (action) {
      action.paused = true;
      setPlayingStates(prev => new Map(prev).set(clipName, false));
    }
  }, [actions]);

  const handleStop = useCallback((clipName: string) => {
    const action = actions.get(clipName);
    if (action) {
      action.stop();
      setPlayingStates(prev => new Map(prev).set(clipName, false));
      setCurrentTimes(prev => new Map(prev).set(clipName, 0));
    }
  }, [actions]);

  const handleSeek = useCallback((clipName: string, time: number) => {
    const action = actions.get(clipName);
    if (action) {
      action.time = time;
      setCurrentTimes(prev => new Map(prev).set(clipName, time));
    }
  }, [actions]);

  const handleSpeedChange = useCallback((clipName: string, speed: number) => {
    const action = actions.get(clipName);
    if (action) {
      action.timeScale = speed;
    }
  }, [actions]);

  const handleIntensityChange = useCallback((clipName: string, intensity: number) => {
    const action = actions.get(clipName);
    if (action) {
      // action.weight controls how much this animation contributes to the final pose
      // 0 = no effect (blend with bind pose), 1 = full effect
      action.setEffectiveWeight(intensity);
    }
  }, [actions]);

  const handleLoopToggle = useCallback((clipName: string) => {
    const action = actions.get(clipName);
    if (action) {
      if (action.loop === THREE.LoopRepeat) {
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = true;
      } else {
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = false;
      }
      // Force re-render
      setActions(new Map(actions));
    }
  }, [actions]);

  // Global controls
  const handlePlayAll = useCallback(() => {
    actions.forEach((action, name) => {
      action.paused = false;
      action.play();
    });
    setPlayingStates(new Map([...actions.keys()].map(k => [k, true])));
  }, [actions]);

  const handlePauseAll = useCallback(() => {
    actions.forEach((action) => {
      action.paused = true;
    });
    setPlayingStates(new Map([...actions.keys()].map(k => [k, false])));
  }, [actions]);

  const handleStopAll = useCallback(() => {
    actions.forEach((action) => {
      action.stop();
    });
    setPlayingStates(new Map([...actions.keys()].map(k => [k, false])));
    setCurrentTimes(new Map([...actions.keys()].map(k => [k, 0])));
  }, [actions]);

  if (!clips.length) {
    return (
      <Box p={3} bg="gray.800" borderRadius="md">
        <Text fontSize="sm" color="gray.400" textAlign="center">
          No embedded animations found in this model.
        </Text>
      </Box>
    );
  }

  return (
    <Box p={3} borderWidth="1px" borderRadius="md" borderColor="gray.600" bg="gray.800">
      <Text fontWeight="bold" mb={3} fontSize="sm" color="teal.300">
        Embedded Animations ({clips.length})
      </Text>

      {/* Global controls */}
      <HStack gap={2} mb={4}>
        <Button size="sm" colorPalette="green" onClick={handlePlayAll}>
          <FaPlay /> Play All
        </Button>
        <Button size="sm" colorPalette="yellow" onClick={handlePauseAll}>
          <FaPause /> Pause All
        </Button>
        <Button size="sm" colorPalette="red" onClick={handleStopAll}>
          <FaStop /> Stop All
        </Button>
      </HStack>

      {/* Individual clip controls */}
      <VStack align="stretch" gap={2}>
        {clips.map((clip) => {
          const action = actions.get(clip.name);
          if (!action) return null;

          return (
            <ClipCard
              key={clip.name}
              clip={clip}
              action={action}
              isPlaying={playingStates.get(clip.name) || false}
              currentTime={currentTimes.get(clip.name) || 0}
              onPlay={() => handlePlay(clip.name)}
              onPause={() => handlePause(clip.name)}
              onStop={() => handleStop(clip.name)}
              onSeek={(time) => handleSeek(clip.name, time)}
              onSpeedChange={(speed) => handleSpeedChange(clip.name, speed)}
              onIntensityChange={(intensity) => handleIntensityChange(clip.name, intensity)}
              onLoopToggle={() => handleLoopToggle(clip.name)}
            />
          );
        })}
      </VStack>
    </Box>
  );
}

export default memo(EmbeddedAnimationControls);
