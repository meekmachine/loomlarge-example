import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  Box,
  Button,
  Text,
  Flex,
  Alert,
  Input,
  Field,
  VStack,
} from '@chakra-ui/react';
import { Phone, PhoneOff, X } from 'lucide-react';
import { toaster } from './ui/toaster';
import modulesConfig from '../modules/config';
import { Module, ModuleSettings, ModuleInstance } from '../types/modules';

// Map module paths to preview videos
const modulePreviewVideos: Record<string, string> = {
  frenchQuiz: '/previews/betta.webm',
  aiChat: '/previews/jonathan.webm',
};

// Video preview component that plays on hover
function VideoPreview({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  return (
    <Box
      position="relative"
      w="80px"
      h="80px"
      flexShrink={0}
      borderRadius="lg"
      overflow="hidden"
      bg="gray.900"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isHovered ? 1 : 0.7,
          transition: 'opacity 0.2s ease',
        }}
      />
      {!isHovered && (
        <Box
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg="blackAlpha.400"
          transition="opacity 0.2s ease"
        >
          <Box
            w="24px"
            h="24px"
            borderRadius="full"
            bg="whiteAlpha.800"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Box
              w={0}
              h={0}
              ml="2px"
              borderLeft="8px solid"
              borderLeftColor="gray.800"
              borderTop="5px solid transparent"
              borderBottom="5px solid transparent"
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Inject keyframes into document head
const injectKeyframes = () => {
  const styleId = 'modules-menu-animations';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes slideInFromRight {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes expandRing {
      0% {
        transform: scale(1, 1);
        opacity: 0.5;
        box-shadow: 0 0 8px rgba(104, 211, 145, 0.3);
      }
      8% {
        transform: scale(1.3, 1.4);
        opacity: 0.25;
        box-shadow: 0 0 12px rgba(104, 211, 145, 0.2);
      }
      18% {
        transform: scale(1.7, 1.9);
        opacity: 0.08;
        box-shadow: 0 0 15px rgba(104, 211, 145, 0.1);
      }
      30% {
        transform: scale(2.0, 2.3);
        opacity: 0;
        box-shadow: 0 0 0px rgba(104, 211, 145, 0);
      }
      100% {
        transform: scale(2.0, 2.3);
        opacity: 0;
        box-shadow: 0 0 0px rgba(104, 211, 145, 0);
      }
    }

    @keyframes expandRingHover {
      0% {
        transform: scale(1, 1);
        opacity: 0.25;
        filter: blur(1px);
        box-shadow: 0 0 10px rgba(104, 211, 145, 0.18);
      }
      10% {
        transform: scale(1.3, 1.45);
        opacity: 0.1;
        filter: blur(2px);
        box-shadow: 0 0 14px rgba(104, 211, 145, 0.1);
      }
      25% {
        transform: scale(1.7, 1.95);
        opacity: 0.03;
        filter: blur(3px);
        box-shadow: 0 0 18px rgba(104, 211, 145, 0.04);
      }
      40% {
        transform: scale(2.0, 2.3);
        opacity: 0;
        filter: blur(4px);
        box-shadow: 0 0 0px rgba(104, 211, 145, 0);
      }
      100% {
        transform: scale(2.0, 2.3);
        opacity: 0;
        filter: blur(4px);
        box-shadow: 0 0 0px rgba(104, 211, 145, 0);
      }
    }

    @keyframes pulseGlow {
      0%, 100% {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(72, 187, 120, 0.4);
      }
      50% {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 45px rgba(72, 187, 120, 0.7);
      }
    }

    @keyframes colorCycle {
      0%, 100% {
        filter: hue-rotate(0deg) brightness(1);
      }
      25% {
        filter: hue-rotate(-15deg) brightness(0.9);
      }
      50% {
        filter: hue-rotate(-25deg) brightness(0.8);
      }
      75% {
        filter: hue-rotate(-15deg) brightness(0.9);
      }
    }

    @keyframes gradientHighlight {
      0% {
        background-position: 0% 0%;
      }
      50% {
        background-position: 100% 100%;
      }
      100% {
        background-position: 0% 0%;
      }
    }

    @keyframes phoneShake {
      0%, 100% {
        transform: rotate(0deg);
      }
      10% {
        transform: rotate(-8deg);
      }
      20% {
        transform: rotate(8deg);
      }
      30% {
        transform: rotate(-8deg);
      }
      40% {
        transform: rotate(8deg);
      }
      50% {
        transform: rotate(0deg);
      }
    }

    .start-call-btn {
      background: linear-gradient(135deg, #0D5A2A 0%, #15803D 20%, #22C55E 50%, #15803D 80%, #0D5A2A 100%) !important;
      background-size: 400% 400% !important;
      animation: pulseGlow 4s ease-in-out infinite, colorCycle 15s ease-in-out infinite, gradientHighlight 3s ease-in-out infinite !important;
    }

    .start-call-btn:hover {
      background: linear-gradient(135deg, #22C55E 0%, #4ADE80 50%, #22C55E 100%) !important;
      background-size: 200% 200% !important;
      filter: brightness(1.15) !important;
    }

    .phone-icon-shake {
      display: inline-block;
    }

    .phone-icon-idle {
      display: inline-block;
    }

    .disabled-btn:hover .phone-icon-idle {
      animation: phoneShake 0.6s ease-in-out;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-100%);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .slide-down-enter {
      animation: slideDown 1.5s ease-out forwards !important;
    }

    @keyframes attentionShake {
      0% { transform: rotate(0deg) scale(1); }
      2% { transform: rotate(-18deg) scale(1.3); }
      4% { transform: rotate(18deg) scale(1.4); }
      6% { transform: rotate(-18deg) scale(1.3); }
      8% { transform: rotate(18deg) scale(1.35); }
      10% { transform: rotate(-16deg) scale(1.3); }
      12% { transform: rotate(16deg) scale(1.25); }
      14% { transform: rotate(-14deg) scale(1.2); }
      16% { transform: rotate(14deg) scale(1.25); }
      18% { transform: rotate(-12deg) scale(1.2); }
      20% { transform: rotate(12deg) scale(1.15); }
      22% { transform: rotate(-10deg) scale(1.1); }
      24% { transform: rotate(10deg) scale(1.15); }
      26% { transform: rotate(-8deg) scale(1.1); }
      28% { transform: rotate(8deg) scale(1.05); }
      30% { transform: rotate(-6deg) scale(1.08); }
      32% { transform: rotate(6deg) scale(1.05); }
      34% { transform: rotate(-4deg) scale(1.03); }
      36% { transform: rotate(4deg) scale(1.02); }
      38% { transform: rotate(-2deg) scale(1.01); }
      40% { transform: rotate(2deg) scale(1); }
      42% { transform: rotate(0deg) scale(1); }
      100% { transform: rotate(0deg) scale(1); }
    }

    .attention-shake {
      animation: attentionShake 4s ease-out;
    }
  `;
  document.head.appendChild(style);
};

interface ModulesMenuProps {
  animationManager?: any;
  characterName?: string;
}

function ModulesMenu({ animationManager, characterName }: ModulesMenuProps) {
  const [moduleSettings, setModuleSettings] = useState<Record<string, ModuleSettings>>({});
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Entrance animation states
  // Start visible immediately since component only mounts after animationReady is true
  const [hasSlid, setHasSlid] = useState(false);
  // Button starts gray, becomes enabled (green) after slide animation completes
  const [isEnabled, setIsEnabled] = useState(false);
  const [showAttentionShake, setShowAttentionShake] = useState(false);
  // Track hover state for ripple effect and phone shake
  const [isHovered, setIsHovered] = useState(false);

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Entrance animation sequence - starts immediately on mount since ChakraUI lazy loads after animationReady
  useEffect(() => {
    // Step 1: Trigger slide-down animation immediately (1.5s duration)
    // Use requestAnimationFrame to ensure DOM is ready before triggering animation
    requestAnimationFrame(() => {
      setHasSlid(true);
    });

    // Step 2: Enable button (turn green) 3 seconds after slide completes (1.5s slide + 3s delay = 4.5s)
    const enableTimer = setTimeout(() => {
      setIsEnabled(true);
    }, 4500);

    // Function to trigger the shake animation
    const triggerShake = () => {
      setShowAttentionShake(true);
      // Remove the shake class after animation completes (now 4s)
      setTimeout(() => {
        setShowAttentionShake(false);
      }, 4000);
    };

    // Step 3: First shake comes 6.5 seconds after mount (4.5s until enabled + 2s delay)
    const initialShakeTimer = setTimeout(triggerShake, 6500);

    // Step 4: Repeat shake with 30 second pause between shakes (4s animation + 30s pause = 34s cycle)
    const repeatShakeInterval = setInterval(() => {
      triggerShake();
    }, 34000);

    return () => {
      clearTimeout(enableTimer);
      clearTimeout(initialShakeTimer);
      clearInterval(repeatShakeInterval);
    };
  }, []);

  // Hover shake effect - trigger immediately on hover, then repeat with 3s pause between shakes
  useEffect(() => {
    if (!isHovered || !isEnabled) return;

    // Trigger shake immediately on hover
    setShowAttentionShake(true);
    const clearInitialShake = setTimeout(() => {
      setShowAttentionShake(false);
    }, 4000);

    // Repeat shake every 7 seconds (4s animation + 3s pause) while hovered
    const hoverShakeInterval = setInterval(() => {
      setShowAttentionShake(true);
      setTimeout(() => {
        setShowAttentionShake(false);
      }, 4000);
    }, 7000); // 4s shake + 3s pause = 7s total cycle

    return () => {
      clearTimeout(clearInitialShake);
      clearInterval(hoverShakeInterval);
      setShowAttentionShake(false);
    };
  }, [isHovered, isEnabled]);

  // Load settings from localStorage or use default from config
  useEffect(() => {
    const initialSettings: Record<string, ModuleSettings> = {};
    modulesConfig.modules.forEach((module) => {
      const storedSettings = localStorage.getItem(module.name);
      initialSettings[module.name] = storedSettings
        ? JSON.parse(storedSettings)
        : { ...module.settings };
    });
    setModuleSettings(initialSettings);
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsPopupOpen(false);
      }
    };

    if (isPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupOpen]);

  const handleModuleSelect = async (module: Module) => {
    try {
      const moduleInstance = await import(`../modules/${module.path}/index.tsx`) as ModuleInstance;

      if (!containerRef.current) {
        console.error('Module container reference is invalid. Unable to start the module.');
        setError('Module container reference is invalid. Unable to start the module.');
        return;
      }
      setError('');

      moduleInstance.start(
        animationManager,
        moduleSettings[module.name],
        containerRef,
        toaster
      );

      setActiveModule(module);
      setIsPopupOpen(false);
    } catch (err: any) {
      console.error(`Failed to load the module: ${module.name}`, err);
      setError(`Failed to load the module: ${module.name}`);
      toaster.error({
        title: 'Module Error',
        description: `Failed to load ${module.name}`,
      });
    }
  };

  const handleEndCall = async () => {
    if (!activeModule) return;

    try {
      const moduleInstance = await import(`../modules/${activeModule.path}/index.tsx`) as ModuleInstance;
      moduleInstance.stop(animationManager);
      setActiveModule(null);
    } catch (err: any) {
      console.error(`Failed to stop the module: ${activeModule.name}`, err);
      toaster.error({
        title: 'Module Error',
        description: `Failed to stop ${activeModule.name}`,
      });
    }
  };

  const togglePopup = () => {
    if (activeModule) {
      handleEndCall();
    } else {
      setIsPopupOpen(!isPopupOpen);
    }
  };

  // Determine if button should show enabled state (green gradient + ripples)
  const showEnabledState = isEnabled && !activeModule && !isPopupOpen;

  return (
    <>
      <Box
        position="fixed"
        right="1rem"
        top="0"
        zIndex={1000}
        ref={popupRef}
        style={{
          // Start hidden, animate in via CSS class
          opacity: hasSlid ? 1 : 0,
          transform: hasSlid ? 'translateY(0)' : 'translateY(-100%)',
        }}
        className={hasSlid ? 'slide-down-enter' : undefined}
      >
        {/* Tab container with glassmorphism */}
        <Box
          bg="rgba(255, 255, 255, 0.12)"
          backdropFilter="blur(16px)"
          borderBottomLeftRadius="16px"
          borderBottomRightRadius="16px"
          boxShadow="0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)"
          borderBottom="1px solid rgba(255, 255, 255, 0.15)"
          borderLeft="1px solid rgba(255, 255, 255, 0.1)"
          borderRight="1px solid rgba(255, 255, 255, 0.1)"
          px={6}
          pt={6}
          pb={6}
          overflow="hidden"
        >
        {/* Intro text - only show when not in call */}
        {!activeModule && (
          <Box textAlign="left" mb={6} mt={2} maxW="220px">
            <Text fontSize="sm" fontWeight="bold" color="white" mb={2}>
              Your {characterName || 'AI'} character can't wait to meet you!
            </Text>
            <Text fontSize="xs" color="gray.300" lineHeight="short">
              Use the button below to start an AI conversation.
            </Text>
          </Box>
        )}

        {/* Main Start Call / End Call Button */}
        <Box position="relative" display="flex" justifyContent="center" w="100%">
        <Box
          position="relative"
          display="inline-block"
          w="100%"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Expanding ring animations - only show when button is in enabled state */}
          {/* Animation: 20s total cycle, ripples expand slowly over 30% of cycle, then long pause for 70% */}
          {/* Each ripple is staggered by 0.8s for a sequential burst effect */}
          {showEnabledState && !isHovered && (
            <>
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.5)',
                  animation: 'expandRing 20s ease-out infinite',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.5)',
                  animation: 'expandRing 20s ease-out infinite 0.8s',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.5)',
                  animation: 'expandRing 20s ease-out infinite 1.6s',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          {/* Hover ripple effect - twice as frequent, more transparent, with blur */}
          {showEnabledState && isHovered && (
            <>
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.28)',
                  animation: 'expandRingHover 6s ease-out infinite',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.28)',
                  animation: 'expandRingHover 6s ease-out infinite 0.2s',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.28)',
                  animation: 'expandRingHover 6s ease-out infinite 0.4s',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.28)',
                  animation: 'expandRingHover 6s ease-out infinite 0.6s',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.28)',
                  animation: 'expandRingHover 6s ease-out infinite 0.8s',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid rgba(104, 211, 145, 0.28)',
                  animation: 'expandRingHover 6s ease-out infinite 1.0s',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          <Button
            onClick={togglePopup}
            size="lg"
            w="100%"
            px={5}
            py={5}
            borderRadius="full"
            bg={activeModule ? 'red.500' : !showEnabledState ? 'gray.600' : undefined}
            color="white"
            fontWeight="semibold"
            fontSize="md"
            className={showEnabledState ? 'start-call-btn' : isPopupOpen ? 'disabled-btn' : undefined}
            _hover={{
              bg: activeModule ? 'red.600' : !showEnabledState ? 'gray.500' : undefined,
              transform: 'scale(1.03)',
            }}
            _active={{
              transform: 'scale(0.98)',
            }}
            transition="all 8s ease, transform 0.2s ease"
            position="relative"
            zIndex={1}
          >
            {activeModule ? (
              <>
                <PhoneOff size={20} style={{ marginRight: '8px' }} />
                End Call
              </>
            ) : (
              <>
                <span className={`${showEnabledState ? 'phone-icon-shake' : 'phone-icon-idle'} ${showAttentionShake ? 'attention-shake' : ''}`}>
                  <Phone size={showEnabledState ? 22 : 18} style={{ marginRight: '8px' }} />
                </span>
                Start Call
              </>
            )}
          </Button>
        </Box>
        </Box>
        </Box>

        {/* Popup Module Selector */}
        {isPopupOpen && !activeModule && (
          <Box
            position="absolute"
            top="100%"
            right="0"
            mt={3}
            bg="gray.800"
            borderRadius="2xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.4)"
            borderWidth="1px"
            borderColor="gray.600"
            overflow="hidden"
            minW="320px"
            style={{
              animation: 'slideInFromRight 0.25s ease-out',
            }}
          >
            {/* Header with close button */}
            <Flex
              justify="space-between"
              align="center"
              px={4}
              py={3}
              borderBottomWidth="1px"
              borderColor="gray.700"
              bg="gray.850"
            >
              <Text color="gray.100" fontWeight="semibold" fontSize="md">
                Select an AI Experience
              </Text>
              <Button
                onClick={() => setIsPopupOpen(false)}
                variant="ghost"
                size="sm"
                p={1}
                minW="auto"
                color="gray.400"
                _hover={{ color: 'white', bg: 'gray.700' }}
              >
                <X size={18} />
              </Button>
            </Flex>

            {error && (
              <Alert.Root status="error" m={3}>
                <Alert.Indicator />
                <Alert.Content fontSize="sm">{error}</Alert.Content>
              </Alert.Root>
            )}

            {/* Module List */}
            <VStack gap={0} align="stretch">
              {modulesConfig.modules.map((module, index) => (
                <Box key={index}>
                  <Flex
                    as="button"
                    w="100%"
                    textAlign="left"
                    px={4}
                    py={4}
                    gap={4}
                    align="center"
                    bg="transparent"
                    _hover={{ bg: 'gray.700' }}
                    transition="background 0.15s ease"
                    onClick={() => handleModuleSelect(module)}
                    cursor="pointer"
                  >
                    {/* Video Preview */}
                    {modulePreviewVideos[module.path] && (
                      <VideoPreview src={modulePreviewVideos[module.path]} />
                    )}

                    {/* Text Content */}
                    <Box flex={1}>
                      <Text color="white" fontWeight="medium" fontSize="md" mb={1}>
                        {module.name}
                      </Text>
                      <Text color="gray.400" fontSize="sm" lineHeight="short">
                        {module.description}
                      </Text>
                    </Box>
                  </Flex>

                  {/* API Key input for AI Chat */}
                  {module.name === 'AI Chat' && (
                    <Box px={4} pb={3} onClick={(e) => e.stopPropagation()}>
                      <Field.Root>
                        <Input
                          type="password"
                          placeholder="Enter Anthropic API Key (sk-ant-...)"
                          size="sm"
                          value={moduleSettings[module.name]?.anthropicApiKey || ''}
                          onChange={(e) => {
                            const newSettings = {
                              ...moduleSettings[module.name],
                              anthropicApiKey: e.target.value,
                            };
                            setModuleSettings({
                              ...moduleSettings,
                              [module.name]: newSettings,
                            });
                            localStorage.setItem('anthropic_api_key', e.target.value);
                            localStorage.setItem(module.name, JSON.stringify(newSettings));
                          }}
                          bg="gray.700"
                          borderColor="gray.600"
                          borderRadius="lg"
                          color="gray.50"
                          _hover={{ borderColor: 'gray.500' }}
                          _focus={{ borderColor: 'green.500', bg: 'gray.700' }}
                        />
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Get your key from{' '}
                          <a
                            href="https://console.anthropic.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'underline', color: '#68D391' }}
                          >
                            console.anthropic.com
                          </a>
                        </Text>
                      </Field.Root>
                    </Box>
                  )}

                  {index < modulesConfig.modules.length - 1 && (
                    <Box h="1px" bg="gray.700" mx={4} />
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </Box>

      <Box ref={containerRef} id="module-container" />
    </>
  );
}

export default memo(ModulesMenu);
