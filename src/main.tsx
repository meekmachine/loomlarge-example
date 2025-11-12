import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import { ThreeProvider } from './context/threeContext';
import './styles.css';

const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>
      {/*
        Initialize global contexts here.
        For now, ThreeProvider can start with an empty object and be filled inside App.
      */}
      <ThreeProvider >
        <App />
      </ThreeProvider>
    </ChakraProvider>
  </React.StrictMode>
);