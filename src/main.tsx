import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { setGameBackend } from '@/backend/client';
import { createConvexGameBackend } from '@/backend/convexBackend';
import './index.css';
import App from './App.tsx';

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

// Before any component runs `loadStaticCase`, point `gameBackend` at Convex.
if (convexClient) {
  setGameBackend(createConvexGameBackend(convexClient));
} else {
  setGameBackend(null);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {convexClient ? (
      <ConvexProvider client={convexClient}>
        <App />
      </ConvexProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
);
