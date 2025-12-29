import { Toaster as ChakraToaster, createToaster, Portal, Toast } from '@chakra-ui/react';

// Create a toaster instance for the app
export const toaster = createToaster({
  placement: 'bottom',
  pauseOnPageIdle: true,
});

// Toaster component to be rendered at the app root
export function Toaster() {
  return (
    <Portal>
      <ChakraToaster
        toaster={toaster}
        insetInline={{ base: '4', md: 'auto' }}
      >
        {(toast) => (
          <Toast.Root
            width={{ base: '100%', md: '320px' }}
            bg={
              toast.type === 'error' ? 'red.600' :
              toast.type === 'success' ? 'green.600' :
              toast.type === 'info' ? 'blue.600' :
              'gray.700'
            }
            color="white"
            borderRadius="md"
            boxShadow="lg"
            p="3"
          >
            {toast.title && (
              <Toast.Title fontWeight="semibold" fontSize="sm">
                {toast.title}
              </Toast.Title>
            )}
            {toast.description && (
              <Toast.Description fontSize="sm" opacity="0.9">
                {toast.description}
              </Toast.Description>
            )}
            <Toast.CloseTrigger
              position="absolute"
              top="2"
              right="2"
              color="white"
              opacity="0.7"
              _hover={{ opacity: 1 }}
            />
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
}
