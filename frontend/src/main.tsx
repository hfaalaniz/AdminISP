import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { initGlobalErrorCapture, vitalReporter } from './services/monitor'
import { onCLS, onFCP, onLCP, onTTFB, onINP } from 'web-vitals'

initGlobalErrorCapture()
onCLS(vitalReporter); onFCP(vitalReporter); onLCP(vitalReporter)
onTTFB(vitalReporter); onINP(vitalReporter)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
  </StrictMode>,
)
