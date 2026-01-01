import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  Button,
  CloseButton,
  Portal,
  VStack,
  Input,
  NativeSelect,
  Text,
  Box,
  HStack,
} from '@chakra-ui/react';
import { FaUpload } from 'react-icons/fa';
import type { CharacterAnnotationConfig } from '../camera/types';

// Preset type for AU mappings
export type PresetType = 'cc4' | 'skeletal' | 'custom';

// Extended config type with internal preset property
export interface UploadedCharacterConfig extends CharacterAnnotationConfig {
  _uploadedPreset?: PresetType;
}

interface CharacterUploadWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (config: UploadedCharacterConfig) => void;
}

// Generate a URL-safe ID from character name
function generateCharacterId(name: string): string {
  return `uploaded_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
}

// Create minimal annotation config for uploaded character
function createUploadedCharacterConfig(
  file: File,
  name: string,
  presetType: PresetType
): UploadedCharacterConfig {
  const blobUrl = URL.createObjectURL(file);

  return {
    characterId: generateCharacterId(name),
    characterName: name,
    modelPath: blobUrl,
    defaultAnnotation: 'full_body',
    markerStyle: presetType === 'skeletal' ? '3d' : 'html',
    annotations: [
      {
        name: 'full_body',
        objects: ['*'],
        paddingFactor: 2.0,
      },
    ],
    _uploadedPreset: presetType,
  };
}

export default function CharacterUploadWizard({
  isOpen,
  onClose,
  onUpload,
}: CharacterUploadWizardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [presetType, setPresetType] = useState<PresetType>('cc4');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog closes
  const handleClose = useCallback(() => {
    setFile(null);
    setCharacterName('');
    setPresetType('cc4');
    setError(null);
    onClose();
  }, [onClose]);

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      // Validate file extension
      const validExtensions = ['.glb', '.gltf'];
      const ext = selectedFile.name
        .toLowerCase()
        .slice(selectedFile.name.lastIndexOf('.'));
      if (!validExtensions.includes(ext)) {
        setError('Please select a .glb or .gltf file');
        return;
      }

      setFile(selectedFile);
      setError(null);

      // Auto-fill name from filename if empty
      if (!characterName) {
        const baseName = selectedFile.name.replace(/\.(glb|gltf)$/i, '');
        setCharacterName(baseName);
      }
    },
    [characterName]
  );

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    if (!characterName.trim()) {
      setError('Please enter a character name');
      return;
    }

    const config = createUploadedCharacterConfig(
      file,
      characterName.trim(),
      presetType
    );
    onUpload(config);
    handleClose();
  }, [file, characterName, presetType, onUpload, handleClose]);

  // Trigger file input click
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(details) => !details.open && handleClose()}
    >
      <Portal>
        <Dialog.Backdrop
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        />
        <Dialog.Positioner>
          <Dialog.Content
            style={{
              background: '#1A202C',
              borderColor: '#2D3748',
              borderWidth: '1px',
              borderRadius: '12px',
              maxWidth: '400px',
              margin: '0 16px',
            }}
          >
            <Dialog.Header
              style={{
                color: 'white',
                borderBottom: '1px solid #2D3748',
                paddingBottom: '12px',
              }}
            >
              Upload Character
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton
                position="absolute"
                top={2}
                right={2}
                color="gray.400"
                _hover={{ color: 'white' }}
              />
            </Dialog.CloseTrigger>

            <Dialog.Body py={4}>
              <VStack gap={4} align="stretch">
                {/* File Upload */}
                <Box>
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color="gray.200"
                    mb={2}
                  >
                    Model File
                  </Text>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,.gltf"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <HStack>
                    <Button
                      size="sm"
                      colorPalette="blue"
                      variant="outline"
                      onClick={handleBrowseClick}
                    >
                      <FaUpload style={{ marginRight: '6px' }} />
                      Browse
                    </Button>
                    <Text
                      fontSize="sm"
                      color={file ? 'gray.200' : 'gray.500'}
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      flex={1}
                    >
                      {file ? file.name : 'No file selected'}
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Supports .glb and .gltf files
                  </Text>
                </Box>

                {/* Character Name */}
                <Box>
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color="gray.200"
                    mb={2}
                  >
                    Character Name
                  </Text>
                  <Input
                    size="sm"
                    placeholder="Enter character name"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    bg="gray.700"
                    borderColor="gray.600"
                    color="white"
                    _placeholder={{ color: 'gray.500' }}
                    _hover={{ borderColor: 'gray.500' }}
                    _focus={{ borderColor: 'blue.500', bg: 'gray.700' }}
                  />
                </Box>

                {/* Preset Type */}
                <Box>
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color="gray.200"
                    mb={2}
                  >
                    AU Mapping Preset
                  </Text>
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={presetType}
                      onChange={(e) =>
                        setPresetType(e.target.value as PresetType)
                      }
                      style={{
                        background: '#2D3748',
                        color: 'white',
                        borderColor: '#4A5568',
                      }}
                    >
                      <option value="cc4">CC4 (Humanoid with blend shapes)</option>
                      <option value="skeletal">Skeletal Only (like Betta fish)</option>
                      <option value="custom">Custom (no mappings)</option>
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    {presetType === 'cc4' &&
                      'For Character Creator 4 exported models'}
                    {presetType === 'skeletal' &&
                      'For models with bone-based animations only'}
                    {presetType === 'custom' && 'No AU mappings will be applied'}
                  </Text>
                </Box>

                {/* Error Message */}
                {error && (
                  <Text fontSize="sm" color="red.400">
                    {error}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer
              style={{
                borderTop: '1px solid #2D3748',
                paddingTop: '12px',
                gap: '8px',
              }}
            >
              <Button variant="ghost" colorPalette="gray" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                colorPalette="blue"
                onClick={handleSubmit}
                disabled={!file || !characterName.trim()}
              >
                Load Character
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
