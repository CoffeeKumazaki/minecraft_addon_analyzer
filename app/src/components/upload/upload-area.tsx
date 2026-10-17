import { useCallback, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'
import { useLanguage } from '@/context/language-context'
import { analyzeAddon } from '@/analyzer'
import { PackageOpen, FolderOpen, Loader2, FileX } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED_EXTENSIONS = ['.mcaddon', '.mcpack', '.mcworld', '.zip']

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

const CORNERS = [
  '-left-1 -top-1 border-l-2 border-t-2',
  '-right-1 -top-1 border-r-2 border-t-2',
  '-left-1 -bottom-1 border-l-2 border-b-2',
  '-right-1 -bottom-1 border-r-2 border-b-2',
]

export function UploadArea() {
  const { state, dispatch } = useAnalysisContext()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Synchronous guard: a second drop during analysis would mix one file's result with another's metadata
  const busyRef = useRef(false)

  const handleFile = useCallback(async (file: File) => {
    if (busyRef.current) return
    if (!isAcceptedFile(file)) {
      dispatch({ type: 'SET_ERROR', error: t('upload.unsupported') })
      return
    }

    busyRef.current = true
    dispatch({ type: 'START_ANALYSIS', fileName: file.name, files: [file] })

    try {
      const { result, textureMap, geometryMap } = await analyzeAddon(file, (step, percent) => {
        dispatch({ type: 'SET_PROGRESS', step, percent })
      })
      dispatch({ type: 'SET_RESULT', result, textureMap, geometryMap })
      navigate('/results')
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: e instanceof Error ? e.message : t('upload.failed') })
    } finally {
      busyRef.current = false
    }
  }, [dispatch, navigate, t])

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

  const isLoading = state.status === 'loading'
  const isError = state.status === 'error'

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={cn(
        'relative w-full max-w-[720px] min-h-[440px] flex flex-col items-center justify-center gap-8 p-10 border bg-card/90 transition-colors',
        isError ? 'border-destructive' : 'border-accent',
        isDragOver && 'bg-secondary',
      )}
    >
      {CORNERS.map(c => <span key={c} aria-hidden className={cn('absolute size-4 border-gold pointer-events-none', c)} />)}
      <span className="absolute right-4 top-3 font-mono text-[10px] tracking-[1.5px] text-muted-foreground">FIG. 00 / INPUT</span>

      {isLoading ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="size-14 flex items-center justify-center border-2 border-accent bg-accent-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
          <p className="text-base font-semibold">{state.progress?.step ?? t('upload.analyzing')}</p>
          <div className="w-full max-w-[360px] space-y-1.5">
            <div className="h-1.5 bg-secondary">
              <div className="h-1.5 bg-accent transition-all" style={{ width: `${state.progress?.percent ?? 0}%` }} />
            </div>
            <p className="text-right font-mono text-[10px] text-accent">{Math.round(state.progress?.percent ?? 0)}%</p>
          </div>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-14 flex items-center justify-center border-2 border-destructive">
            <FileX className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-base font-semibold max-w-[460px]">{state.error}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2.5 bg-accent text-accent-foreground text-sm font-semibold cursor-pointer hover:opacity-90"
          >
            {t('upload.chooseOther')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className={cn(
                  'size-14 flex items-center justify-center',
                  i === 2 ? 'border-2 border-accent bg-accent-foreground' : 'border border-border-light bg-background',
                )}
              >
                {i === 2 && <PackageOpen className="h-6 w-6 text-accent" />}
              </span>
            ))}
          </div>
          <div className="text-center space-y-2.5">
            <p className="text-[22px] font-semibold">{isDragOver ? t('upload.dropping') : t('upload.drop')}</p>
            <p className="text-sm text-muted-foreground">{t('upload.sub')}</p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2.5 px-5 py-3 bg-accent text-accent-foreground text-sm font-semibold cursor-pointer hover:opacity-90"
          >
            <FolderOpen className="h-4 w-4" />
            {t('upload.choose')}
          </button>
          <div className="flex gap-2">
            {ACCEPTED_EXTENSIONS.map(ext => (
              <span key={ext} className="px-2 py-1 border border-border-light font-mono text-[11px] text-subtle">{ext}</span>
            ))}
          </div>
        </>
      )}

      <span className="absolute left-4 bottom-3 font-mono text-[10px] tracking-[1.5px] text-muted-foreground">DROP AREA · 720 × 440</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={onFileSelect}
        className="hidden"
      />
    </div>
  )
}
