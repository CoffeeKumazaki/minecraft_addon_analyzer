import { Link } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'
import { useAnalysisContext } from '@/context/analysis-context'
import { useLanguage } from '@/context/language-context'

export function Header() {
  const { state, dispatch } = useAnalysisContext()
  const { language, setLanguage, t } = useLanguage()

  return (
    <header className="h-14 shrink-0 border-b border-border-light bg-background">
      <div className="flex h-full items-center justify-between px-8">
        <Link to="/" className="flex items-center gap-2.5" onClick={() => dispatch({ type: 'RESET' })}>
          <span className="grid grid-cols-2 size-5" aria-hidden>
            <span className="bg-accent" />
            <span className="bg-secondary" />
            <span className="bg-secondary" />
            <span className="bg-accent" />
          </span>
          <span className="font-mono text-lg tracking-[1px]">ADD-ON ANALYZER</span>
        </Link>
        <div className="flex items-center gap-5">
          <div className="flex border border-border">
            {(['en', 'ja'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-3 py-1.5 font-mono text-xs transition-colors cursor-pointer ${
                  language === lang ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {lang === 'en' ? 'EN' : '日本語'}
              </button>
            ))}
          </div>
          <span className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground" aria-hidden />
            {t('header.local')}
          </span>
          {state.status === 'success' && (
            <Link
              to="/"
              onClick={() => dispatch({ type: 'RESET' })}
              className="flex items-center gap-2 border border-border px-3 py-1.5 text-xs text-subtle hover:bg-secondary transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('header.newAnalysis')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
