import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAnalysisContext } from '@/context/analysis-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import type { AnalysisResult } from '@/types'

function getItem(result: AnalysisResult, category: string, id: string) {
  switch (category) {
    case 'items':
      return result.items.find(i => i.id === id)
    case 'blocks':
      return result.blocks.find(b => b.id === id)
    case 'entities':
      return result.entities.find(e => e.id === id)
    case 'recipes':
      return result.recipes.find(r => r.id === id)
    default:
      return undefined
  }
}

export function DetailPage() {
  const { category, id } = useParams<{ category: string; id: string }>()
  const { state } = useAnalysisContext()
  const navigate = useNavigate()

  if (!state.result || !category || !id) {
    navigate('/')
    return null
  }

  const item = getItem(state.result, category, decodeURIComponent(id))

  if (!item) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">要素が見つかりません</p>
        <Button variant="link" asChild>
          <Link to="/results">結果一覧に戻る</Link>
        </Button>
      </div>
    )
  }

  const displayId = 'id' in item ? (item as { id: string }).id : category
  const tags = 'tags' in item ? (item as { tags: string[] }).tags : []
  const components = 'components' in item ? (item as { components: Record<string, unknown> }).components : {}
  const diagnostics = 'diagnostics' in item ? (item as { diagnostics: { level: string; message: string }[] }).diagnostics : []

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/results">
          <ArrowLeft className="h-4 w-4 mr-1" />
          結果一覧
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-lg">{displayId}</CardTitle>
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map(tag => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {'sourcePath' in item && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">ソースパス</h3>
              <p className="text-sm font-mono">{(item as { sourcePath: string }).sourcePath}</p>
            </div>
          )}

          {'health' in item && (item as { health?: number }).health != null && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">ステータス</h3>
              <p className="text-sm">HP: {(item as { health: number }).health}</p>
            </div>
          )}

          {'recipeType' in item && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">レシピタイプ</h3>
              <p className="text-sm">{(item as { recipeType: string }).recipeType}</p>
            </div>
          )}

          {Object.keys(components).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">コンポーネント</h3>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-80">
                {JSON.stringify(components, null, 2)}
              </pre>
            </div>
          )}

          {diagnostics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">警告</h3>
              {diagnostics.map((d, i) => (
                <p key={i} className="text-sm text-destructive">{d.message}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
