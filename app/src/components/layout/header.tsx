import { Link } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

export function Header() {
  const { state, dispatch } = useAnalysisContext()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold" onClick={() => dispatch({ type: 'RESET' })}>
          <Package className="h-5 w-5" />
          <span>Add-on Analyzer</span>
        </Link>
        {state.status === 'success' && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/">新しい解析</Link>
          </Button>
        )}
      </div>
    </header>
  )
}
