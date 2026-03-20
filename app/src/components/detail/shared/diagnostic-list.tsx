import { Badge } from '@/components/ui/badge'
import type { Diagnostic } from '@/types'

type Props = {
  diagnostics: Diagnostic[]
}

export function DiagnosticList({ diagnostics }: Props) {
  if (diagnostics.length === 0) return null

  return (
    <div className="space-y-2">
      {diagnostics.map((d, i) => (
        <div key={i} className="flex items-start gap-2">
          <Badge
            variant={d.level === 'error' ? 'destructive' : d.level === 'warning' ? 'outline' : 'secondary'}
            className="text-xs shrink-0"
          >
            {d.level}
          </Badge>
          <div>
            <p className="text-sm">{d.message}</p>
            {d.path && <p className="text-xs text-muted-foreground font-mono">{d.path}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
