import { useRequireAnalysis } from '@/hooks/use-require-analysis'
import { SummaryCard } from '@/components/summary/summary-card'
import { DetailTabs } from '@/components/detail-list/detail-tabs'
import { ExportControls } from '@/components/export/export-controls'

export function ResultsPage() {
  const state = useRequireAnalysis()

  if (!state.result) return null

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <SummaryCard result={state.result} fileName={state.fileName} />
      <DetailTabs result={state.result} />
      <ExportControls result={state.result} />
    </div>
  )
}
