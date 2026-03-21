import { Link } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'

export function Header() {
  const { state, dispatch } = useAnalysisContext()

  return (
    <header className="bg-primary text-primary-foreground">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-16">
        <Link to="/" className="flex items-center gap-3" onClick={() => dispatch({ type: 'RESET' })}>
          <div className="w-7 h-7 bg-accent" />
          <span className="font-heading text-sm font-bold tracking-[3px]">ADD-ON ANALYZER</span>
        </Link>
        {state.status === 'success' && (
          <Link
            to="/"
            className="bg-[#2A2A30] px-4 py-2 font-heading text-xs font-semibold tracking-[1px] hover:bg-[#3A3A40] transition-colors"
          >
            New Analysis
          </Link>
        )}
      </div>
    </header>
  )
}
