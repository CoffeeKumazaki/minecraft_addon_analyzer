import { Download } from 'lucide-react'
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

  const buttonClass = 'flex-1 flex items-center justify-center gap-2 py-2.5 bg-secondary font-mono text-xs text-subtle hover:text-foreground transition-colors cursor-pointer'

  return (
    <div className="flex gap-2">
      <button onClick={handleJsonExport} className={buttonClass}>
        <Download className="h-3.5 w-3.5" />
        JSON
      </button>
      <button onClick={handleMarkdownExport} className={buttonClass}>
        <Download className="h-3.5 w-3.5" />
        Markdown
      </button>
    </div>
  )
}
