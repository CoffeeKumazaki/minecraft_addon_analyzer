import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, Box, Blocks, Bug, CookingPot, AlertTriangle, FileCode } from 'lucide-react'
import type { AnalysisResult } from '@/types'

type Props = {
  result: AnalysisResult;
  fileName: string | null;
}

export function SummaryCard({ result, fileName }: Props) {
  const { addon, summary } = result

  const counts = [
    { label: 'アイテム', count: result.items.length, icon: Box },
    { label: 'ブロック', count: result.blocks.length, icon: Blocks },
    { label: 'モブ', count: result.entities.length, icon: Bug },
    { label: 'レシピ', count: result.recipes.length, icon: CookingPot },
  ]

  const warningCount = result.warnings.length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {addon.iconUrl && (
              <img
                src={addon.iconUrl}
                alt=""
                className="h-12 w-12 rounded-md object-cover flex-shrink-0"
              />
            )}
            <div>
              <CardTitle className="text-xl">{addon.name || fileName || 'Add-on'}</CardTitle>
              {addon.description && (
                <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
              )}
            </div>
          </div>
          {warningCount > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {warningCount}件の警告
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pack info */}
        <div className="flex flex-wrap gap-2">
          {addon.packTypes.map(type => (
            <Badge key={type} variant="outline" className="flex items-center gap-1">
              {type === 'script' ? <FileCode className="h-3 w-3" /> : <Package className="h-3 w-3" />}
              {type === 'behavior' ? 'Behavior Pack' : type === 'resource' ? 'Resource Pack' : 'Script'}
            </Badge>
          ))}
          {addon.minEngineVersion && (
            <Badge variant="outline">Engine {addon.minEngineVersion}+</Badge>
          )}
          {addon.dependencies.length > 0 && (
            <Badge variant="outline">依存: {addon.dependencies.length}件</Badge>
          )}
        </div>

        {/* Content counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {counts.map(({ label, count, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2 rounded-md border p-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold leading-none">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature tags */}
        {summary.contentFocus.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {summary.contentFocus.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Summary text */}
        {summary.shortDescription && (
          <p className="text-sm bg-muted/50 rounded-md p-3">{summary.shortDescription}</p>
        )}
      </CardContent>
    </Card>
  )
}
