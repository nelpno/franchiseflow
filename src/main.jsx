import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { startVersionCheck } from '@/lib/versionCheck'
import { toast } from 'sonner'

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>,
)

// Auto-detect new deployments — show persistent toast
startVersionCheck(() => {
  toast('Nova versão disponível!', {
    duration: Infinity,
    action: {
      label: 'Atualizar',
      onClick: () => window.location.reload(),
    },
  });
});

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}



