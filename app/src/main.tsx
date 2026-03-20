import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AnalysisProvider } from '@/context/analysis-context'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AnalysisProvider>
        <App />
      </AnalysisProvider>
    </HashRouter>
  </StrictMode>,
)
