import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/capture-app.css';
import './styles/ascend.css';
import './styles/ascend-support.css';
import './styles/pose-3d.css';
import { registerAppWorker } from './pwa/register';
registerAppWorker();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
