import { Routes, Route } from 'react-router-dom'
import { Header } from '@/components/layout/header'
import { UploadPage } from '@/pages/upload-page'
import { ResultsPage } from '@/pages/results-page'
import { DetailPage } from '@/pages/detail-page'

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:category/:id" element={<DetailPage />} />
        </Routes>
      </main>
      <footer className="border-t py-4 text-center text-sm text-muted-foreground">
        ローカル解析のみ — ファイルは外部に送信されません
      </footer>
    </div>
  )
}

export default App
