import { useCallback, useState, useRef } from 'react'
import { useAnalysisContext } from '@/context/analysis-context'
import { analyzeAddon } from '@/analyzer'
import { Plus, Loader2 } from 'lucide-react'
import type { PackType } from '@/types'

const ACCEPTED_EXTENSIONS = ['.mcaddon', '.mcpack', '.mcworld', '.zip']

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

const PACK_LABELS: Record<PackType, string> = {
  behavior: 'Behavior Pack',
  resource: 'Resource Pack',
  script: 'Script',
}

type Props = {
  missingTypes: PackType[];
}

export function AddPackUpload({ missingTypes }: Props) {
  const { state, dispatch } = useAnalysisContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const missingLabel = missingTypes.map(t => PACK_LABELS[t]).join(' / ')

  const handleFile = useCallback(async (file: File) => {
    if (!isAcceptedFile(file)) {
      setError('対応していないファイル形式です。')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const allFiles = [...state.files, file]
      const { result, textureMap, geometryMap } = await analyzeAddon(allFiles)
      dispatch({ type: 'SET_RESULT', result, textureMap, geometryMap, files: allFiles })
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [state.files, dispatch])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={`
        border border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
        ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
        ${isLoading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">統合解析中...</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {missingLabel} をドロップまたはクリックして追加
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".mcaddon,.mcpack,.mcworld,.zip"
        onChange={onFileSelect}
        className="hidden"
      />
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}
