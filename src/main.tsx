import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-grotesk/latin-ext-400.css';
import '@fontsource/space-grotesk/latin-ext-500.css';
import '@fontsource/space-grotesk/latin-ext-700.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import { App } from '@/app/App';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import '@/styles/index';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root is missing from index.html');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
