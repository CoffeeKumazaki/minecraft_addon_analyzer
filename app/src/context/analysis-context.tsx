import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { AnalysisResult } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'

type AnalysisState = {
  status: AnalysisStatus;
  fileName: string | null;
  result: AnalysisResult | null;
  textureMap: TextureMap | null;
  geometryMap: GeometryMap | null;
  error: string | null;
  progress: { step: string; percent: number } | null;
}

type AnalysisAction =
  | { type: 'START_ANALYSIS'; fileName: string }
  | { type: 'SET_PROGRESS'; step: string; percent: number }
  | { type: 'SET_RESULT'; result: AnalysisResult; textureMap: TextureMap; geometryMap: GeometryMap }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' }

const initialState: AnalysisState = {
  status: 'idle',
  fileName: null,
  result: null,
  textureMap: null,
  geometryMap: null,
  error: null,
  progress: null,
}

function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'START_ANALYSIS':
      return { ...initialState, status: 'loading', fileName: action.fileName }
    case 'SET_PROGRESS':
      return { ...state, progress: { step: action.step, percent: action.percent } }
    case 'SET_RESULT':
      return { ...state, status: 'success', result: action.result, textureMap: action.textureMap, geometryMap: action.geometryMap, progress: null }
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.error, progress: null }
    case 'RESET':
      if (state.textureMap) {
        for (const url of state.textureMap.values()) {
          URL.revokeObjectURL(url)
        }
      }
      if (state.result?.addon.iconUrl) {
        URL.revokeObjectURL(state.result.addon.iconUrl)
      }
      return initialState
    default:
      return state
  }
}

type AnalysisContextValue = {
  state: AnalysisState;
  dispatch: React.Dispatch<AnalysisAction>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null)

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(analysisReducer, initialState)
  return (
    <AnalysisContext.Provider value={{ state, dispatch }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysisContext() {
  const ctx = useContext(AnalysisContext)
  if (!ctx) throw new Error('useAnalysisContext must be used within AnalysisProvider')
  return ctx
}
