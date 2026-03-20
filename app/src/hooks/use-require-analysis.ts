import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'

/**
 * Redirects to '/' if analysis data is not in 'success' state.
 * Returns the analysis state for consumers to use.
 */
export function useRequireAnalysis() {
  const { state } = useAnalysisContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (state.status !== 'success') {
      navigate('/', { replace: true })
    }
  }, [state.status, navigate])

  return state
}
