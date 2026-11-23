import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { recarregarSeVersaoVelha } from '@/lib/versaoVelha'

// Vite avisa antes de o erro chegar à tela quando um chunk pré-carregado sumiu (deploy novo).
window.addEventListener('vite:preloadError', (e) => {
  if (recarregarSeVersaoVelha(e.payload || 'dynamically imported module')) e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



