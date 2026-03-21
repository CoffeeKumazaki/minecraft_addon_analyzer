import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { ReferenceLink } from '@/types'

const KIND_LABELS: Record<string, string> = {
  texture: 'Texture',
  geometry: 'Geometry',
  animation: 'Animation',
  animation_controller: 'Animation Controller',
  loot_table: 'Loot Table',
  icon: 'Icon',
  sound: 'Sound',
}

type Props = {
  references: ReferenceLink[]
}

export function ReferenceList({ references }: Props) {
  if (references.length === 0) return null

  const grouped = new Map<string, ReferenceLink[]>()
  for (const ref of references) {
    const list = grouped.get(ref.kind) ?? []
    list.push(ref)
    grouped.set(ref.kind, list)
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([kind, refs]) => (
        <div key={kind}>
          <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground mb-1">
            {KIND_LABELS[kind]?.toUpperCase() ?? kind.toUpperCase()}
          </h4>
          <div className="space-y-1">
            {refs.map((ref, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {ref.resolved ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                <span className="font-mono text-xs break-all">{ref.target}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
