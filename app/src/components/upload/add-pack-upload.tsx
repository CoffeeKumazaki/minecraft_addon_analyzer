import { useCallback, useState, useRef } from 'react'
import { useAnalysisContext } from '@/context/analysis-context'
import { useLanguage } from '@/context/language-context'
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
  const { t } = useLanguage()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const missingLabel = missingTypes.map(type => PACK_LABELS[type]).join(' / ')

  const handleFile = useCallback(async (file: File) => {
    if (!isAcceptedFile(file)) {
      setError(t('upload.unsupported'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const allFiles = [...state.files, file]
      const { result, textureMap, geometryMap } = await analyzeAddon(allFiles)
      dispatch({ type: 'SET_RESULT', result, textureMap, geometryMap, files: allFiles })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('upload.failed'))
    } finally {
      setIsLoading(false)
    }
  }, [state.files, dispatch, t])

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
    // Allow picking the same file again after an error
    e.target.value = ''
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !isLoading && inputRef.current?.click()}
      className={`
        border px-3.5 py-3 cursor-pointer transition-colors
        ${isDragOver ? 'border-accent bg-secondary' : 'border-border hover:border-accent'}
        ${isLoading ? 'pointer-events-none opacity-60' : ''}
      `}
    >
      {isLoading ? (
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" />
          <p className="text-[13px] text-subtle">{t('sidebar.merging')}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <Plus className="h-3.5 w-3.5 shrink-0 text-subtle" />
          <p className="text-[13px] text-subtle">{t('sidebar.addPack', { packs: missingLabel })}</p>
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
