import { memo } from 'react';

type PreloaderProps = {
  text?: string;
  show?: boolean;
  progress?: number; // 0-100
};

// Pure CSS preloader - no Chakra/Emotion to avoid frame drops
const Preloader = memo(function Preloader({
  text = 'Loading...',
  show = true,
  progress,
}: PreloaderProps) {
  if (!show) return null;

  const hasProgress = typeof progress === 'number';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#171717',
        gap: '1.5rem',
      }}
    >
      <div
        style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: 'white',
          textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 255, 255, 0.5)',
          fontFamily: 'Arial, sans-serif',
          letterSpacing: '0.05em',
        }}
      >
        {text}
      </div>

      {hasProgress && (
        <div
          style={{
            width: '200px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              height: '100%',
              background: 'white',
              borderRadius: '2px',
              transition: 'width 0.1s ease-out',
            }}
          />
        </div>
      )}
    </div>
  );
});

export default Preloader;
