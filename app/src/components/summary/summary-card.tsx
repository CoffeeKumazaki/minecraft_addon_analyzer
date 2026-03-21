import { useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, FileCode, Box, Blocks, Bug, ChefHat, Skull, Drumstick, Swords } from 'lucide-react'
import type { AnalysisResult } from '@/types'
import type { LucideIcon } from 'lucide-react'
import { useLanguage, formatCount } from '@/context/language-context'

type Props = {
  result: AnalysisResult;
  fileName: string | null;
}

export function SummaryCard({ result, fileName }: Props) {
  const { addon, summary } = result
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'items'
  const { t, language } = useLanguage()

  const counts: { label: string; count: number; tab: string; icon: LucideIcon }[] = [
    { label: 'ITEMS', count: result.items.length, tab: 'items', icon: Box },
    { label: 'BLOCKS', count: result.blocks.length, tab: 'blocks', icon: Blocks },
    { label: 'ENTITIES', count: result.entities.length, tab: 'entities', icon: Bug },
  ]

  const detailBadges: { key: string; count: number; labelKey: string; unitType: 'items' | 'mobs'; icon: LucideIcon; className: string }[] = [
    { key: 'recipes', count: summary.detailCounts.recipes, labelKey: 'badge.recipes', unitType: 'items', icon: ChefHat, className: 'bg-secondary' },
    { key: 'hostile', count: summary.detailCounts.hostileMobs, labelKey: 'badge.hostileMobs', unitType: 'mobs', icon: Skull, className: 'bg-destructive/10 text-destructive' },
    { key: 'food', count: summary.detailCounts.foodItems, labelKey: 'badge.foodItems', unitType: 'items', icon: Drumstick, className: 'bg-success/10 text-success' },
    { key: 'weapons', count: summary.detailCounts.weapons, labelKey: 'badge.weapons', unitType: 'items', icon: Swords, className: 'bg-accent/10 text-accent' },
  ]

  const hasDetailBadges = detailBadges.some(b => b.count > 0) || summary.scriptUsage

  return (
    <Card className="border-2 border-border">
      <CardHeader className="p-6 sm:p-8">
        <div className="flex items-center gap-5">
          {addon.iconUrl ? (
            <img
              src={addon.iconUrl}
              alt=""
              className="h-16 w-16 object-cover flex-shrink-0"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <div className="h-16 w-16 bg-secondary flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="font-heading text-2xl font-bold tracking-[-1px]">
              {addon.name || fileName || 'Add-on'}
            </CardTitle>
            {addon.description && (
              <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-5">
        {/* Pack badges */}
        <div className="flex flex-wrap gap-2">
          {addon.packTypes.map(type => (
            <Badge key={type} className="bg-primary text-primary-foreground font-heading text-[10px] font-semibold tracking-[1px] border-0 gap-1.5 rounded-none">
              {type === 'script' ? <FileCode className="h-3 w-3" /> : <Package className="h-3 w-3" />}
              {type === 'behavior' ? 'BEHAVIOR PACK' : type === 'resource' ? 'RESOURCE PACK' : 'SCRIPT'}
            </Badge>
          ))}
          {addon.minEngineVersion && (
            <Badge variant="outline" className="font-heading text-[10px] font-semibold tracking-[1px] border-border rounded-none">
              ENGINE {addon.minEngineVersion}+
            </Badge>
          )}
          {addon.dependencies.length > 0 && (
            <Badge variant="outline" className="font-heading text-[10px] font-semibold tracking-[1px] border-border rounded-none">
              DEPS: {addon.dependencies.length}
            </Badge>
          )}
        </div>

        {/* Content counts - clickable tab switchers */}
        <div className="grid grid-cols-3 gap-3">
          {counts.map(({ label, count, tab, icon: Icon }) => (
            <button
              key={tab}
              onClick={() => setSearchParams({ tab }, { replace: true })}
              className={`border-2 p-4 text-center transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent/50'
              }`}
            >
              <Icon className={`h-4 w-4 mx-auto mb-1 ${activeTab === tab ? 'text-accent' : 'text-muted-foreground'}`} />
              <p className="font-heading text-3xl font-bold tracking-[-1px]">{count}</p>
              <p className="font-heading text-[11px] font-semibold tracking-[2px] text-muted-foreground">{label}</p>
            </button>
          ))}
        </div>

        {/* Feature tags */}
        {summary.contentFocus.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {summary.contentFocus.map(tag => (
              <Badge key={tag} variant="secondary" className="font-heading text-[10px] font-semibold tracking-[1px] rounded-none">{t(tag)}</Badge>
            ))}
          </div>
        )}

        {/* Detail badges */}
        {hasDetailBadges && (
          <div className="flex flex-wrap gap-2">
            {detailBadges.map(({ key, count, labelKey, unitType, icon: Icon, className }) =>
              count > 0 && (
                <span key={key} className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-heading text-[11px] font-semibold tracking-[0.5px] ${className}`}>
                  <Icon className="h-3.5 w-3.5" />
                  {t(labelKey)} {formatCount(count, unitType, language)}
                </span>
              )
            )}
            {summary.scriptUsage && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-chart-5/10 text-chart-5 font-heading text-[11px] font-semibold tracking-[0.5px]">
                <FileCode className="h-3.5 w-3.5" />
                {t('badge.scriptUsage')}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
