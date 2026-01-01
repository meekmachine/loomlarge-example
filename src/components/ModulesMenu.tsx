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
    @keyframes expandRing {
      0% {
        transform: scale(1, 1);
        opacity: 0.4;
      }
      100% {
        transform: scale(1.6, 2.4);
        opacity: 0;
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

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
};

interface ModulesMenuProps {
  animationManager?: any;
}

function ModulesMenu({ animationManager }: ModulesMenuProps) {
  const [moduleSettings, setModuleSettings] = useState<Record<string, ModuleSettings>>({});
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

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

  return (
    <>
      <Box
        position="fixed"
        right="1rem"
        top="1rem"
        zIndex={1000}
        ref={popupRef}
      >
        {/* Main Start Call / End Call Button with animated rings */}
        <Box position="relative" display="inline-block">
          {/* Expanding ring animations - only show when not in call */}
          {!activeModule && (
            <>
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid #68D391',
                  animation: 'expandRing 4s ease-out infinite',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid #68D391',
                  animation: 'expandRing 4s ease-out infinite 1.33s',
                  pointerEvents: 'none',
                }}
              />
              <Box
                position="absolute"
                inset={0}
                borderRadius="full"
                style={{
                  border: '1.5px solid #68D391',
                  animation: 'expandRing 4s ease-out infinite 2.66s',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          <Button
            onClick={togglePopup}
            size="lg"
            px={6}
            py={6}
            borderRadius="full"
            bg={activeModule ? 'red.500' : 'green.500'}
            color="white"
            fontWeight="bold"
            fontSize="lg"
            style={{
              animation: !activeModule ? 'pulseGlow 2s ease-in-out infinite' : undefined,
            }}
            _hover={{
              bg: activeModule ? 'red.600' : 'green.600',
              transform: 'scale(1.05)',
            }}
            _active={{
              transform: 'scale(0.98)',
            }}
            transition="all 0.2s ease"
            position="relative"
            zIndex={1}
          >
            {activeModule ? (
              <>
                <PhoneOff size={24} style={{ marginRight: '8px' }} />
                End Call
              </>
            ) : (
              <>
                <Phone size={24} style={{ marginRight: '8px' }} />
                Start Call
              </>
            )}
          </Button>
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
              animation: 'fadeIn 0.2s ease',
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
