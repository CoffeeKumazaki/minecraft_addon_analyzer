import { useMemo } from 'react'
import { useRequireAnalysis } from '@/hooks/use-require-analysis'
import { SummaryCard } from '@/components/summary/summary-card'
import { DetailTabs } from '@/components/detail-list/detail-tabs'
import { ExportControls } from '@/components/export/export-controls'
import { AddPackUpload } from '@/components/upload/add-pack-upload'
import type { PackType } from '@/types'

const ALL_PACK_TYPES: PackType[] = ['behavior', 'resource']

export function ResultsPage() {
  const state = useRequireAnalysis()

  const missingTypes = useMemo(() => {
    if (!state.result) return []
    const existing = state.result.addon.packTypes
    return ALL_PACK_TYPES.filter(t => !existing.includes(t))
  }, [state.result])

  if (!state.result) return null

  return (
    <div className="container mx-auto px-4 sm:px-16 py-8 space-y-8">
      <SummaryCard result={state.result} fileName={state.fileName} />
      {missingTypes.length > 0 && (
        <AddPackUpload missingTypes={missingTypes} />
      )}
      <DetailTabs result={state.result} />
      <ExportControls result={state.result} />
    </div>
  )
}
