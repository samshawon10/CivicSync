import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/ui/Toaster.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { LocaleProvider } from './context/LocaleContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <HelmetProvider>
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <ToastProvider><ErrorBoundary><App /></ErrorBoundary></ToastProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </HelmetProvider>
    </BrowserRouter>
  </StrictMode>
);

