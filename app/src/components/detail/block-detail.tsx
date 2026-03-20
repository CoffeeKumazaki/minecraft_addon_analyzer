import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { DiagnosticList } from './shared/diagnostic-list'
import { ComponentTable } from './shared/component-table'
import { BlockThumbnail, TextureThumbnail } from './shared/thumbnails'
import { FileText, Link2, AlertTriangle, Boxes, Image, ToggleLeft } from 'lucide-react'
import type { BlockSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

type Props = {
  block: BlockSpec
  textureMap: TextureMap | null
  geometryMap: GeometryMap | null
}

export function BlockDetail({ block, textureMap, geometryMap }: Props) {
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <BlockThumbnail
              src={block.textures[0] ? textureMap?.get(block.textures[0]) : undefined}
              geometry={geometry}
              size={80}
            />
            <div className="flex-1 min-w-0">
              <CardTitle className="font-mono text-lg">{block.id}</CardTitle>
              {block.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {block.tags.map(tag => (
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
        <div>
          <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
          <p className="text-sm font-mono">{block.sourcePath}</p>
        </div>
      </SectionCard>

      {/* Textures */}
      {block.textures.length > 0 && (
        <SectionCard title="テクスチャ" icon={Image} badge={`${block.textures.length}`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
            {block.textures.map((tex, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <TextureThumbnail src={textureMap?.get(tex)} size={64} />
                <span className="text-xs font-mono text-muted-foreground text-center break-all">{tex}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Block States */}
      {block.states && block.states.length > 0 && (
        <SectionCard title="ブロックステート" icon={ToggleLeft} badge={`${block.states.length}`}>
          <div className="flex flex-wrap gap-1">
            {block.states.map(state => (
              <Badge key={state} variant="outline" className="text-xs font-mono">{state}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Components */}
      {Object.keys(block.components).length > 0 && (
        <SectionCard title="コンポーネント" icon={Boxes} badge={`${Object.keys(block.components).length}`}>
          <ComponentTable components={block.components} />
        </SectionCard>
      )}

      {/* References */}
      {block.references.length > 0 && (
        <SectionCard title="参照" icon={Link2} badge={`${block.references.length}`}>
          <ReferenceList references={block.references} />
        </SectionCard>
      )}

      {/* Diagnostics */}
      {block.diagnostics.length > 0 && (
        <SectionCard title="警告" icon={AlertTriangle} badge={`${block.diagnostics.length}`}>
          <DiagnosticList diagnostics={block.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
