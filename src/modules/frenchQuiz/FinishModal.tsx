import React from 'react';
import {
  Dialog,
  Button,
  CloseButton,
  Portal,
  Text,
} from '@chakra-ui/react';

interface FinishModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FinishModal({ isOpen, onClose }: FinishModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>Quiz Complete!</Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton position="absolute" top={2} right={2} />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <Text>
                Thank you for completing the Savoir-Faire Quiz! Your responses have
                been recorded.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="green" onClick={onClose}>
                Finish
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
