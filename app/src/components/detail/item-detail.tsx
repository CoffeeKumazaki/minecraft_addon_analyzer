import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { DiagnosticList } from './shared/diagnostic-list'
import { ComponentTable } from './shared/component-table'
import { TextureThumbnail } from './shared/thumbnails'
import { FileText, Link2, AlertTriangle, Boxes } from 'lucide-react'
import type { ItemSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

type Props = {
  item: ItemSpec
  textureMap: TextureMap | null
}

export function ItemDetail({ item, textureMap }: Props) {
  const iconSrc = item.icon ? textureMap?.get(item.icon) : undefined

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <TextureThumbnail src={iconSrc} size={64} />
            <div className="flex-1 min-w-0">
              <CardTitle className="font-mono text-lg">{item.id}</CardTitle>
              {item.title && (
                <p className="text-sm text-muted-foreground mt-0.5">{item.title}</p>
              )}
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Info */}
      <SectionCard title="基本情報" icon={FileText}>
        <div className="space-y-2">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
            <p className="text-sm font-mono">{item.sourcePath}</p>
          </div>
          {item.icon && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">アイコン参照</h4>
              <p className="text-sm font-mono">{item.icon}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Components */}
      {Object.keys(item.components).length > 0 && (
        <SectionCard title="コンポーネント" icon={Boxes} badge={`${Object.keys(item.components).length}`}>
          <ComponentTable components={item.components} />
        </SectionCard>
      )}

      {/* References */}
      {item.references.length > 0 && (
        <SectionCard title="参照" icon={Link2} badge={`${item.references.length}`}>
          <ReferenceList references={item.references} />
        </SectionCard>
      )}

      {/* Diagnostics */}
      {item.diagnostics.length > 0 && (
        <SectionCard title="警告" icon={AlertTriangle} badge={`${item.diagnostics.length}`}>
          <DiagnosticList diagnostics={item.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
