import { Link } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'
import { useLanguage } from '@/context/language-context'

export function Header() {
  const { state, dispatch } = useAnalysisContext()
  const { language, setLanguage } = useLanguage()

  return (
    <header className="bg-primary text-primary-foreground">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-16">
        <Link to="/" className="flex items-center gap-3" onClick={() => dispatch({ type: 'RESET' })}>
          <div className="w-7 h-7 bg-accent" />
          <span className="font-heading text-sm font-bold tracking-[3px]">ADD-ON ANALYZER</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex font-heading text-[10px] font-semibold tracking-[1px]">
            {(['en', 'ja'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 transition-colors cursor-pointer ${
                  language === lang
                    ? 'bg-accent text-primary'
                    : 'bg-[#2A2A30] text-primary-foreground hover:bg-[#3A3A40]'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          {state.status === 'success' && (
            <Link
              to="/"
              className="bg-[#2A2A30] px-4 py-2 font-heading text-xs font-semibold tracking-[1px] hover:bg-[#3A3A40] transition-colors"
            >
              New Analysis
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
