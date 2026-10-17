import { Routes, Route } from 'react-router-dom'
import { Header } from '@/components/layout/header'
import { UploadPage } from '@/pages/upload-page'
import { ResultsPage } from '@/pages/results-page'

function App() {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:category" element={<ResultsPage />} />
          <Route path="/results/:category/:id" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
