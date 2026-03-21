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
    <div className="flex gap-3 justify-end">
      <button
        onClick={handleJsonExport}
        className="flex items-center gap-2 border-2 border-border px-5 py-2.5 font-heading text-[11px] font-semibold tracking-[1px] hover:bg-secondary transition-colors cursor-pointer"
      >
        <Download className="h-4 w-4" />
        EXPORT JSON
      </button>
      <button
        onClick={handleMarkdownExport}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 font-heading text-[11px] font-semibold tracking-[1px] hover:opacity-90 transition-opacity cursor-pointer"
      >
        <FileText className="h-4 w-4" />
        EXPORT MARKDOWN
      </button>
    </div>
  )
}
