import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { ReferenceLink } from '@/types'

const KIND_LABELS: Record<string, string> = {
  texture: 'テクスチャ',
  geometry: 'ジオメトリ',
  animation: 'アニメーション',
  animation_controller: 'アニメーションコントローラ',
  loot_table: 'ルートテーブル',
  icon: 'アイコン',
  sound: 'サウンド',
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
    <div className="space-y-3">
      {Array.from(grouped.entries()).map(([kind, refs]) => (
        <div key={kind}>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">
            {KIND_LABELS[kind] ?? kind}
          </h4>
          <div className="space-y-1">
            {refs.map((ref, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {ref.resolved ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
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
