import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global application configuration interface
declare global {
  interface Window {
    config?: Record<string, any>;
  }
}

window.config = {
  appName: "SumerAvera Protocol Core Framework",
  version: "1.0.0",
  environment: process.env.NODE_ENV || "development",
  apiEndpoint: "/api",
  timestamp: new Date().toISOString(),
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
