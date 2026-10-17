import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useRequireAnalysis } from '@/hooks/use-require-analysis'
import { useWorkspaceData } from '@/hooks/use-workspace-data'
import { Sidebar, CompactNav } from '@/components/workspace/sidebar'
import { ListPane } from '@/components/workspace/list-pane'
import { DetailPane } from '@/components/workspace/detail-pane'
import { LIST_CATEGORIES, isWorkspaceCategory, type ListCategory } from '@/components/workspace/categories'
import { WorldMap } from '@/components/world-map/world-map'
import type { CustomMapColor } from '@/world/block-colors'
import type { AnalysisResult, PackType } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

const ALL_PACK_TYPES: PackType[] = ['behavior', 'resource']

export function ResultsPage() {
  const state = useRequireAnalysis()
  if (!state.result) return null
  return <Workspace result={state.result} textureMap={state.textureMap} geometryMap={state.geometryMap} files={state.files} fileName={state.fileName} />
}

type WorkspaceProps = {
  result: AnalysisResult
  textureMap: TextureMap | null
  geometryMap: GeometryMap | null
  files: File[]
  fileName: string | null
}

function Workspace({ result, textureMap, geometryMap, files, fileName }: WorkspaceProps) {
  const params = useParams<{ category?: string; id?: string }>()
  const data = useWorkspaceData(result, textureMap, geometryMap)
  // Narrow-screen sidebar drawer
  const routeKey = `${params.category ?? ''}/${params.id ?? ''}`
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuRouteKey, setMenuRouteKey] = useState(routeKey)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef(false)
  // Any navigation closes the drawer (state adjusted during render rather than in an effect)
  if (menuRouteKey !== routeKey) {
    setMenuRouteKey(routeKey)
    setMenuOpen(false)
  }
  const closeMenu = useCallback(() => {
    restoreFocusRef.current = true
    setMenuOpen(false)
  }, [])

  // Return focus to the opener once the content is interactive again (it is inert while the drawer is open)
  useEffect(() => {
    if (!menuOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false
      menuButtonRef.current?.focus()
    }
  }, [menuOpen])

  // The drawer only exists below lg; growing past it must not leave the content inert
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const onChange = () => { if (query.matches) setMenuOpen(false) }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const missingTypes = useMemo(
    () => ALL_PACK_TYPES.filter(t => !result.addon.packTypes.includes(t)),
    [result],
  )

  const worldFile = useMemo(
    () => files.find(f => f.name.toLowerCase().endsWith('.mcworld')),
    [files],
  )

  // Add-on blocks without minecraft:map_color do not show up on maps
  const customMapColors = useMemo(() => {
    const colors: Record<string, CustomMapColor> = {}
    for (const block of result.blocks) {
      if (!block.id.includes(':') || block.id.startsWith('minecraft:')) continue
      const { mapColor, mapTintMethod } = block.stats
      colors[block.id] = mapColor ? { color: mapColor, tintMethod: mapTintMethod } : null
    }
    return colors
  }, [result])

  // Map markers link to entity details only for entities defined in the analyzed packs
  const addonEntityNames = useMemo(
    () => new Map(result.entities.map(e => [e.id, e.title ?? e.id])),
    [result],
  )

  const counts: Record<ListCategory, number> = {
    items: result.items.length,
    blocks: result.blocks.length,
    entities: result.entities.length,
    recipes: data.recipeGroups.length,
  }

  const category = params.category
  if (!isWorkspaceCategory(category) || (category === 'map' && !worldFile)) {
    const fallback = LIST_CATEGORIES.find(c => counts[c] > 0) ?? (worldFile ? 'map' : 'items')
    return <Navigate to={`/results/${fallback}`} replace />
  }

  const selectedId = params.id
  return (
    <div className="h-full flex">
      <Sidebar
        result={result}
        fileName={fileName}
        category={category}
        counts={counts}
        hasWorld={worldFile != null}
        missingTypes={missingTypes}
        open={menuOpen}
        onClose={closeMenu}
      />
      <div className="flex-1 min-w-0 flex flex-col" inert={menuOpen}>
        <CompactNav category={category} counts={counts} hasWorld={worldFile != null} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} menuButtonRef={menuButtonRef} />
        <div className="flex-1 min-h-0 flex">
          {category === 'map' ? (
            <section className="flex-1 min-w-0 h-full overflow-y-auto px-7 py-6">
              {worldFile && (
                // Remount per world so map state (info, errors, view) never leaks between files
                <WorldMap
                  key={`${worldFile.name}:${worldFile.size}:${worldFile.lastModified}`}
                  file={worldFile}
                  customColors={customMapColors}
                  addonEntityNames={addonEntityNames}
                />
              )}
            </section>
          ) : (
            <>
              {/* Below xl the list and the detail take turns: the detail replaces the list while an entry is open */}
              <ListPane
                key={category}
                category={category}
                data={data}
                selectedId={selectedId}
                className={selectedId ? 'hidden xl:block' : undefined}
              />
              <DetailPane
                category={category}
                id={selectedId}
                data={data}
                className={selectedId ? 'flex-1 xl:flex-none xl:w-[540px] xl:shrink-0' : 'hidden xl:block xl:w-[540px] xl:shrink-0'}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
