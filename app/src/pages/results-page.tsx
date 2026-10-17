import { useMemo } from 'react'
import { useRequireAnalysis } from '@/hooks/use-require-analysis'
import { SummaryCard } from '@/components/summary/summary-card'
import { DetailTabs } from '@/components/detail-list/detail-tabs'
import { ExportControls } from '@/components/export/export-controls'
import { AddPackUpload } from '@/components/upload/add-pack-upload'
import { WorldMap } from '@/components/world-map/world-map'
import type { CustomMapColor } from '@/world/block-colors'
import type { PackType } from '@/types'

const ALL_PACK_TYPES: PackType[] = ['behavior', 'resource']

export function ResultsPage() {
  const state = useRequireAnalysis()

  const missingTypes = useMemo(() => {
    if (!state.result) return []
    const existing = state.result.addon.packTypes
    return ALL_PACK_TYPES.filter(t => !existing.includes(t))
  }, [state.result])

  const worldFile = useMemo(
    () => state.files.find(f => f.name.toLowerCase().endsWith('.mcworld')),
    [state.files],
  )

  // Add-on blocks without minecraft:map_color do not show up on maps
  const customMapColors = useMemo(() => {
    const colors: Record<string, CustomMapColor> = {}
    for (const block of state.result?.blocks ?? []) {
      if (!block.id.includes(':') || block.id.startsWith('minecraft:')) continue
      const { mapColor, mapTintMethod } = block.stats
      colors[block.id] = mapColor ? { color: mapColor, tintMethod: mapTintMethod } : null
    }
    return colors
  }, [state.result])

  const addonEntityIds = useMemo(
    () => new Set((state.result?.entities ?? []).map(e => e.id)),
    [state.result],
  )

  if (!state.result) return null

  return (
    <div className="container mx-auto px-4 sm:px-16 py-8 space-y-8">
      <SummaryCard result={state.result} fileName={state.fileName} />
      {worldFile && (
        // Remount per world so map state (info, errors, view) never leaks between files
        <WorldMap
          key={`${worldFile.name}:${worldFile.size}:${worldFile.lastModified}`}
          file={worldFile}
          customColors={customMapColors}
          addonEntityIds={addonEntityIds}
        />
      )}
      {missingTypes.length > 0 && (
        <AddPackUpload missingTypes={missingTypes} />
      )}
      <DetailTabs result={state.result} />
      <ExportControls result={state.result} />
    </div>
  )
}
