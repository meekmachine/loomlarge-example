import { memo, useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import { Switch } from '@chakra-ui/react';
import { FaChevronLeft, FaChevronRight, FaCamera, FaVideo } from 'react-icons/fa';
import { useModulesContext } from '../context/ModulesContext';
import { useThreeOptional } from '../context/threeContext';
import { ANNOTATION_REGISTRY, getAnnotationConfig } from '../presets/annotations';
import { createCaptureService, type CaptureService } from '../services/captureService';
import type { CharacterAnnotationConfig } from '../camera/types';

// CSS styles for the component
const switcherStyles = `
  .character-switcher {
    position: fixed;
    top: 1rem;
    z-index: 1390;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .character-switcher.drawer-closed {
    left: 76px;
  }
  .character-switcher.drawer-open {
    left: 420px;
  }
  .character-carousel-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .character-carousel {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
  }
  .carousel-btn {
    width: 20px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(23, 25, 35, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 10px;
  }
  .carousel-btn:hover:not(:disabled) {
    background: rgba(66, 153, 225, 0.3);
    border-color: rgba(66, 153, 225, 0.5);
    color: white;
  }
  .carousel-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .character-cards-container {
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(23, 25, 35, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 260px;
    overflow: hidden;
  }
  .character-cards-track {
    display: flex;
    flex-direction: row;
    gap: 8px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .carousel-dots {
    display: flex;
    gap: 6px;
    justify-content: center;
  }
  .carousel-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.2s;
  }
  .carousel-dot:hover {
    background: rgba(255, 255, 255, 0.5);
  }
  .carousel-dot.active {
    background: #4299E1;
    transform: scale(1.2);
  }
  @keyframes rainbow-glow {
    0% {
      box-shadow: 0 0 15px 4px rgba(255, 0, 128, 0.6), 0 0 30px 8px rgba(255, 0, 128, 0.3);
      border-color: rgba(255, 0, 128, 0.8);
    }
    16% {
      box-shadow: 0 0 15px 4px rgba(255, 128, 0, 0.6), 0 0 30px 8px rgba(255, 128, 0, 0.3);
      border-color: rgba(255, 128, 0, 0.8);
    }
    33% {
      box-shadow: 0 0 15px 4px rgba(255, 255, 0, 0.6), 0 0 30px 8px rgba(255, 255, 0, 0.3);
      border-color: rgba(255, 255, 0, 0.8);
    }
    50% {
      box-shadow: 0 0 15px 4px rgba(0, 255, 128, 0.6), 0 0 30px 8px rgba(0, 255, 128, 0.3);
      border-color: rgba(0, 255, 128, 0.8);
    }
    66% {
      box-shadow: 0 0 15px 4px rgba(0, 128, 255, 0.6), 0 0 30px 8px rgba(0, 128, 255, 0.3);
      border-color: rgba(0, 128, 255, 0.8);
    }
    83% {
      box-shadow: 0 0 15px 4px rgba(128, 0, 255, 0.6), 0 0 30px 8px rgba(128, 0, 255, 0.3);
      border-color: rgba(128, 0, 255, 0.8);
    }
    100% {
      box-shadow: 0 0 15px 4px rgba(255, 0, 128, 0.6), 0 0 30px 8px rgba(255, 0, 128, 0.3);
      border-color: rgba(255, 0, 128, 0.8);
    }
  }
  @keyframes glow-pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }
  @keyframes thumbnail-breathe {
    0% {
      transform: scale(1.4);
      filter: brightness(1.25) saturate(1.1);
    }
    50% {
      transform: scale(1.55);
      filter: brightness(1.45) saturate(1.15);
    }
    100% {
      transform: scale(1.4);
      filter: brightness(1.25) saturate(1.1);
    }
  }
  .character-card {
    flex-shrink: 0;
    width: 72px;
    height: 56px;
    border-radius: 8px;
    background: rgba(45, 55, 72, 0.8);
    border: 2px solid transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                background 0.3s ease,
                box-shadow 0.3s ease;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }
  .character-card:hover {
    background: rgba(30, 35, 50, 0.95);
    transform: scale(1.6);
    z-index: 100;
    animation: rainbow-glow 3s linear infinite, glow-pulse 2s ease-in-out infinite;
  }
  .character-card.active {
    border-color: #4299E1;
    background: rgba(66, 153, 225, 0.4);
  }
  .character-card-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: rgba(255, 255, 255, 0.6);
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .character-card:hover .character-card-placeholder {
    transform: scale(1.4);
  }
  .character-card-thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                filter 0.3s ease;
  }
  .character-card:hover .character-card-thumbnail {
    animation: thumbnail-breathe 2s ease-in-out 0.4s infinite;
    transform: scale(1.4);
    filter: brightness(1.25) saturate(1.1);
  }
  .character-card-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    padding: 4px 8px;
    background: #1A202C;
    color: white;
    font-size: 11px;
    border-radius: 4px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
    z-index: 10000;
  }
  .character-card:hover .character-card-tooltip {
    opacity: 1;
  }
  .camera-controls-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(23, 25, 35, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .camera-controls-bar button {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 10px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .camera-controls-bar button:hover {
    background: rgba(66, 153, 225, 0.3);
    border-color: rgba(66, 153, 225, 0.5);
    color: white;
  }
  .camera-controls-bar button.reset-btn {
    background: rgba(66, 153, 225, 0.2);
    border-color: rgba(66, 153, 225, 0.4);
  }
  .markers-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }
  .markers-toggle span {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }
  .capture-btn {
    width: 26px;
    height: 26px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(45, 55, 72, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    transition: all 0.15s;
    font-size: 11px;
  }
  .capture-btn:hover:not(:disabled) {
    background: rgba(72, 187, 120, 0.4);
    border-color: rgba(72, 187, 120, 0.6);
    color: white;
  }
  .capture-btn.recording {
    background: rgba(245, 101, 101, 0.5);
    border-color: rgba(245, 101, 101, 0.7);
    animation: pulse-recording 1s ease-in-out infinite;
  }
  @keyframes pulse-recording {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .capture-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .capture-controls {
    display: flex;
    gap: 4px;
    margin-left: 6px;
    padding-left: 6px;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
  }
`;

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = switcherStyles;
  document.head.appendChild(style);
  stylesInjected = true;
}

// Get thumbnail paths for character (static image + animated video)
function getCharacterThumbnail(characterId: string): { poster: string; video: string } | null {
  switch (characterId) {
    case 'jonathan':
      return { poster: '/thumbnails/jonathan.png', video: '/thumbnails/jonathan.webm' };
    case 'betta':
      return { poster: '/thumbnails/betta.png', video: '/thumbnails/betta.webm' };
    default:
      return null;
  }
}

// Get emoji placeholder for character (fallback when no thumbnail)
function getCharacterEmoji(characterId: string): string {
  switch (characterId) {
    case 'jonathan':
      return '🎭';
    case 'betta':
      return '🐟';
    case 'placeholder_cat':
      return '🐱';
    case 'placeholder_dog':
      return '🐕';
    case 'placeholder_robot':
      return '🤖';
    case 'placeholder_alien':
      return '👽';
    default:
      return '🎭';
  }
}

// Placeholder characters for testing scroll (these won't actually load)
const PLACEHOLDER_CHARACTERS = [
  { characterId: 'placeholder_cat', characterName: 'Cat (Coming Soon)' },
  { characterId: 'placeholder_dog', characterName: 'Dog (Coming Soon)' },
  { characterId: 'placeholder_robot', characterName: 'Robot (Coming Soon)' },
  { characterId: 'placeholder_alien', characterName: 'Alien (Coming Soon)' },
];

interface CharacterSwitcherProps {
  isDrawerOpen: boolean;
  onCharacterChange?: (config: CharacterAnnotationConfig) => void;
  currentCharacterConfig?: CharacterAnnotationConfig;
  disabled?: boolean;
}

// Constants for carousel
const VISIBLE_CARDS = 3;
const CARD_WIDTH = 72;
const CARD_GAP = 8;

export const CharacterSwitcher = memo(function CharacterSwitcher({
  isDrawerOpen,
  onCharacterChange,
  currentCharacterConfig,
  disabled = false,
}: CharacterSwitcherProps) {
  const { cameraController, markersVisible, setMarkersVisible, markerStyle, setMarkerStyle } = useModulesContext();
  const threeCtx = useThreeOptional();
  const containerRef = useRef<HTMLDivElement>(null);
  const captureServiceRef = useRef<CaptureService | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Inject styles on mount
  if (typeof window !== 'undefined') {
    injectStyles();
  }

  // Create capture service when renderer is available
  const getCaptureService = useCallback((): CaptureService | null => {
    if (!threeCtx?.renderer || !threeCtx?.scene) return null;

    if (!captureServiceRef.current) {
      // Get camera from cameraController or scene
      const camera = cameraController?.camera ||
        threeCtx.scene.children.find((c): c is THREE.PerspectiveCamera => c.type === 'PerspectiveCamera');

      if (camera) {
        captureServiceRef.current = createCaptureService(
          threeCtx.renderer,
          threeCtx.scene,
          camera
        );
      }
    }
    return captureServiceRef.current;
  }, [threeCtx?.renderer, threeCtx?.scene, cameraController]);

  // Combine real and placeholder characters
  const allCharacters = [
    ...ANNOTATION_REGISTRY.characters.map(c => ({ ...c, isPlaceholder: false })),
    ...PLACEHOLDER_CHARACTERS.map(c => ({ ...c, isPlaceholder: true })),
  ];

  // Calculate total pages
  const totalPages = Math.ceil(allCharacters.length / VISIBLE_CARDS);

  // Handle character card click
  const handleCharacterClick = useCallback(
    (characterId: string) => {
      if (disabled) return;
      const config = getAnnotationConfig(characterId);
      if (config && onCharacterChange) {
        onCharacterChange(config);
      }
    },
    [disabled, onCharacterChange]
  );

  // Handle screenshot capture
  const handleScreenshot = useCallback(async () => {
    const service = getCaptureService();
    if (!service) return;

    const characterName = currentCharacterConfig?.characterId || 'character';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await service.downloadScreenshot(`${characterName}_${timestamp}.png`);
  }, [getCaptureService, currentCharacterConfig]);

  // Handle video recording
  const handleRecord = useCallback(async () => {
    const service = getCaptureService();
    if (!service) return;

    if (isRecording) {
      service.stopRecording();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      const characterName = currentCharacterConfig?.characterId || 'character';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      try {
        await service.downloadWebM(`${characterName}_${timestamp}.webm`, { duration: 5000 });
      } finally {
        setIsRecording(false);
      }
    }
  }, [getCaptureService, currentCharacterConfig, isRecording]);

  // Handle full body view
  const handleFullBodyClick = useCallback(() => {
    if (cameraController) {
      cameraController.focusFullBody();
    }
  }, [cameraController]);

  // Carousel navigation
  const handlePrev = useCallback(() => {
    setCurrentPage(p => Math.max(0, p - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentPage(p => Math.min(totalPages - 1, p + 1));
  }, [totalPages]);

  const handleDotClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Calculate transform offset
  const trackOffset = currentPage * (VISIBLE_CARDS * (CARD_WIDTH + CARD_GAP));

  // Get quick camera annotations (limited set for the compact bar)
  const quickAnnotations = currentCharacterConfig?.annotations
    ?.filter(a => ['head', 'face', 'full_body'].includes(a.name))
    .slice(0, 3) || [];

  return (
    <div
      ref={containerRef}
      className={`character-switcher ${isDrawerOpen ? 'drawer-open' : 'drawer-closed'}`}
    >
      {/* Character Carousel */}
      <div className="character-carousel-wrapper">
        <div className="character-carousel">
          {/* Left arrow */}
          <button
            className="carousel-btn"
            onClick={handlePrev}
            disabled={currentPage === 0}
            aria-label="Previous"
          >
            <FaChevronLeft />
          </button>

          {/* Cards container */}
          <div className="character-cards-container">
            <div
              className="character-cards-track"
              style={{ transform: `translateX(-${trackOffset}px)` }}
            >
              {allCharacters.map((char) => {
                const thumbnail = getCharacterThumbnail(char.characterId);
                return (
                  <div
                    key={char.characterId}
                    className={`character-card ${currentCharacterConfig?.characterId === char.characterId ? 'active' : ''}`}
                    onClick={() => !char.isPlaceholder && handleCharacterClick(char.characterId)}
                    style={char.isPlaceholder ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    onMouseEnter={(e) => {
                      const video = e.currentTarget.querySelector('video');
                      if (video) video.play();
                    }}
                    onMouseLeave={(e) => {
                      const video = e.currentTarget.querySelector('video');
                      if (video) {
                        video.pause();
                        video.currentTime = 0;
                      }
                    }}
                  >
                    {thumbnail ? (
                      <video
                        src={thumbnail.video}
                        poster={thumbnail.poster}
                        className="character-card-thumbnail"
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <div className="character-card-placeholder">
                        {getCharacterEmoji(char.characterId)}
                      </div>
                    )}
                    <div className="character-card-tooltip">
                      {char.characterName}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right arrow */}
          <button
            className="carousel-btn"
            onClick={handleNext}
            disabled={currentPage >= totalPages - 1}
            aria-label="Next"
          >
            <FaChevronRight />
          </button>
        </div>

        {/* Dots indicator */}
        {totalPages > 1 && (
          <div className="carousel-dots">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                className={`carousel-dot ${currentPage === i ? 'active' : ''}`}
                onClick={() => handleDotClick(i)}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Compact Camera Controls Bar */}
      <div className="camera-controls-bar">
        <button
          className="reset-btn"
          onClick={handleFullBodyClick}
          disabled={disabled || !cameraController}
        >
          Reset
        </button>
        {quickAnnotations
          .filter(a => a.name !== 'full_body')
          .map(annotation => (
            <button
              key={annotation.name}
              onClick={() => cameraController?.focusAnnotation(annotation.name)}
              disabled={disabled || !cameraController}
            >
              {annotation.name.charAt(0).toUpperCase() + annotation.name.slice(1)}
            </button>
          ))}
        <div className="markers-toggle">
          <span>Markers</span>
          <Switch.Root
            checked={markersVisible}
            onCheckedChange={(details) => setMarkersVisible(details.checked)}
            size="sm"
            colorPalette="blue"
          >
            <Switch.HiddenInput />
            <Switch.Control style={{ transform: 'scale(0.8)' }}>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </div>
        <div className="markers-toggle">
          <span>3D</span>
          <Switch.Root
            checked={markerStyle === '3d'}
            onCheckedChange={(details) => setMarkerStyle(details.checked ? '3d' : 'html')}
            size="sm"
            colorPalette="purple"
          >
            <Switch.HiddenInput />
            <Switch.Control style={{ transform: 'scale(0.8)' }}>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </div>

        {/* Capture Controls */}
        <div className="capture-controls">
          <button
            className="capture-btn"
            onClick={handleScreenshot}
            disabled={!threeCtx?.renderer}
            title="Take Screenshot"
          >
            <FaCamera />
          </button>
          <button
            className={`capture-btn ${isRecording ? 'recording' : ''}`}
            onClick={handleRecord}
            disabled={!threeCtx?.renderer}
            title={isRecording ? 'Stop Recording' : 'Record Video (5s)'}
          >
            <FaVideo />
          </button>
        </div>
      </div>
    </div>
  );
});

export default CharacterSwitcher;
