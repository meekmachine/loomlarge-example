import React from 'react';
import {
  Dialog,
  Button,
  CloseButton,
  Portal,
} from '@chakra-ui/react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>Bienvenue au Quiz de Vocabulaire Français!</Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton position="absolute" top={2} right={2} />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <p>
                Welcome to the French Vocabulary Quiz! I will ask you the English meaning
                of French words. Please answer by speaking in English.
              </p>
              <p style={{ marginTop: '1rem' }}>
                Make sure your microphone is enabled and working properly.
              </p>
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="blue" mr={3} onClick={onClose}>
                Start Quiz
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
