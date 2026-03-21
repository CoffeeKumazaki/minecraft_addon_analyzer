import { useCallback, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'
import { analyzeAddon } from '@/analyzer'
import { Upload, FileArchive, Loader2 } from 'lucide-react'

const ACCEPTED_EXTENSIONS = ['.mcaddon', '.mcpack', '.mcworld', '.zip']

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

export function UploadArea() {
  const { state, dispatch } = useAnalysisContext()
  const navigate = useNavigate()
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!isAcceptedFile(file)) {
      dispatch({ type: 'SET_ERROR', error: '対応していないファイル形式です。.mcaddon, .mcpack, .mcworld, .zip に対応しています。' })
      return
    }

    dispatch({ type: 'START_ANALYSIS', fileName: file.name })

    try {
      const { result, textureMap, geometryMap } = await analyzeAddon(file, (step, percent) => {
        dispatch({ type: 'SET_PROGRESS', step, percent })
      })
      dispatch({ type: 'SET_RESULT', result, textureMap, geometryMap })
      navigate('/results')
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: e instanceof Error ? e.message : '解析に失敗しました' })
    }
  }, [dispatch, navigate])

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

  const isLoading = state.status === 'loading'

  return (
    <div className="w-full max-w-lg">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !isLoading && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
          ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
          ${isLoading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {state.progress?.step ?? '解析中...'}
            </p>
            {state.progress && (
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${state.progress.percent}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {isDragOver ? (
              <FileArchive className="h-10 w-10 text-primary" />
            ) : (
              <Upload className="h-10 w-10 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                {isDragOver ? 'ドロップして解析' : 'Add-on をアップロード'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ドラッグ＆ドロップ または クリックして選択
              </p>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".mcaddon,.mcpack,.mcworld,.zip"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {state.status === 'error' && (
        <p className="text-sm text-destructive mt-3 text-center">{state.error}</p>
      )}
    </div>
  )
}
