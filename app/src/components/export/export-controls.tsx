import { Button } from '@/components/ui/button'
import { Download, FileText } from 'lucide-react'
import { exportMarkdown } from '@/export/markdown-exporter'
import type { AnalysisResult } from '@/types'

type Props = {
  result: AnalysisResult;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportControls({ result }: Props) {
  const handleJsonExport = () => {
    const json = JSON.stringify(result, null, 2)
    downloadFile(json, 'addon-analysis.json', 'application/json')
  }

  const handleMarkdownExport = () => {
    const md = exportMarkdown(result)
    downloadFile(md, 'addon-analysis.md', 'text/markdown')
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleJsonExport}>
        <Download className="h-4 w-4 mr-1" />
        JSON出力
      </Button>
      <Button variant="outline" size="sm" onClick={handleMarkdownExport}>
        <FileText className="h-4 w-4 mr-1" />
        Markdown出力
      </Button>
    </div>
  )
}
