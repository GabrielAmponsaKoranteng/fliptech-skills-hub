import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App, { prefetchLikelyPages, preloadRoute } from './App';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

// Fetch this page's code now, in parallel with start-up, rather than once start-up has finished.
preloadRoute(window.location.pathname);
// A few seconds after load, so the current page's own images and data go first.
window.addEventListener('load', () => setTimeout(prefetchLikelyPages, 3000), { once: true });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Last resort, if the app shell itself fails; pages have their own boundary inside the layouts. */}
      <ErrorBoundary variant="app">
        <AppProvider>
          <App />
        </AppProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
