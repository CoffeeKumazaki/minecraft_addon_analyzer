import { useEffect, useRef, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { Sword, Box, Ghost, Grid3x3, Map as MapIcon, ChefHat, Skull, Drumstick, Swords, FileCode, PanelLeft, X, type LucideIcon } from 'lucide-react'
import { useLanguage, formatCount } from '@/context/language-context'
import { AddPackUpload } from '@/components/upload/add-pack-upload'
import { ExportControls } from '@/components/export/export-controls'
import { cn } from '@/lib/utils'
import type { AnalysisResult, PackType } from '@/types'
import type { ListCategory, WorkspaceCategory } from './categories'

type Props = {
  result: AnalysisResult
  fileName: string | null
  category: WorkspaceCategory
  counts: Record<ListCategory, number>
  hasWorld: boolean
  missingTypes: PackType[]
  /** Below lg the sidebar is a drawer opened from CompactNav */
  open: boolean
  onClose: () => void
}

const CONTENT_NAV: { category: ListCategory; labelKey: string; icon: LucideIcon }[] = [
  { category: 'items', labelKey: 'nav.items', icon: Sword },
  { category: 'blocks', labelKey: 'nav.blocks', icon: Box },
  { category: 'entities', labelKey: 'nav.entities', icon: Ghost },
  { category: 'recipes', labelKey: 'nav.recipes', icon: Grid3x3 },
]

const SIDEBAR_ID = 'workspace-sidebar'

const PACK_BADGES: Record<PackType, { label: string; className: string }> = {
  behavior: { label: 'BP', className: 'border-accent text-accent' },
  resource: { label: 'RP', className: 'border-accent text-accent' },
  script: { label: 'SCRIPT', className: 'border-amethyst text-amethyst' },
}

function NavLabel({ children }: { children: string }) {
  return <p className="mb-2 font-mono text-[10px] tracking-[2px] text-muted-foreground">{children}</p>
}

function NavItem({ to, icon: Icon, label, count, active }: { to: string; icon: LucideIcon; label: string; count?: string; active: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 border-l-2 transition-colors',
        active ? 'bg-secondary border-accent' : 'border-transparent hover:bg-secondary/60',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-muted-foreground')} />
      <span className={cn('flex-1 text-sm', active ? 'text-foreground' : 'text-subtle')}>{label}</span>
      {count != null && <span className={cn('font-mono text-xs', active ? 'text-accent' : 'text-muted-foreground')}>{count}</span>}
    </Link>
  )
}

export function Sidebar({ result, fileName, category, counts, hasWorld, missingTypes, open, onClose }: Props) {
  const { t, language } = useLanguage()
  const { addon, summary } = result
  const version = addon.versions[0]
  const { detailCounts } = summary
  const highlights: { key: string; icon: LucideIcon; iconClass: string; label: string }[] = [
    { key: 'recipes', icon: ChefHat, iconClass: 'text-subtle', count: detailCounts.recipes, labelKey: 'badge.recipes', unit: 'items' as const },
    { key: 'hostile', icon: Skull, iconClass: 'text-destructive', count: detailCounts.hostileMobs, labelKey: 'badge.hostileMobs', unit: 'mobs' as const },
    { key: 'food', icon: Drumstick, iconClass: 'text-gold', count: detailCounts.foodItems, labelKey: 'badge.foodItems', unit: 'items' as const },
    { key: 'weapons', icon: Swords, iconClass: 'text-gold', count: detailCounts.weapons, labelKey: 'badge.weapons', unit: 'items' as const },
  ]
    .filter(h => h.count > 0)
    .map(h => ({ key: h.key, icon: h.icon, iconClass: h.iconClass, label: `${t(h.labelKey)} ${formatCount(h.count, h.unit, language)}` }))
  if (summary.scriptUsage) highlights.push({ key: 'script', icon: FileCode, iconClass: 'text-amethyst', label: t('badge.scriptUsage') })

  const asideRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  // Modal drawer: Escape closes, Tab cycles within the drawer
  const onDrawerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !asideRef.current) return
    const focusable = [...asideRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')]
      .filter(el => el.offsetParent !== null)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <>
    {/* The backdrop also covers the header so nothing outside the modal drawer can be clicked */}
    {open && <div className="lg:hidden fixed inset-0 z-30 bg-background/70" onClick={onClose} aria-hidden />}
    <aside
      ref={asideRef}
      id={SIDEBAR_ID}
      {...(open ? { role: 'dialog', 'aria-modal': true, 'aria-label': t('nav.menu') } : {})}
      onKeyDown={open ? onDrawerKeyDown : undefined}
      className={cn(
        'w-72 shrink-0 overflow-y-auto border-r border-border-light bg-background p-6 flex-col gap-7',
        'lg:static lg:z-auto lg:flex lg:h-full lg:bg-background/95',
        open ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden',
      )}
    >
      <button ref={closeRef} onClick={onClose} className="lg:hidden self-end -mb-4 cursor-pointer text-muted-foreground hover:text-foreground" aria-label={t('detail.close')}>
        <X className="h-4 w-4" />
      </button>
      <div className="space-y-3.5">
        <div className="flex items-center gap-3">
          {addon.iconUrl ? (
            <img src={addon.iconUrl} alt="" className="size-12 shrink-0 border border-border object-cover" style={{ imageRendering: 'pixelated' }} />
          ) : (
            <div className="size-12 shrink-0 border border-border bg-secondary" />
          )}
          <div className="min-w-0">
            <p className="font-semibold truncate">{addon.name || fileName || 'Add-on'}</p>
            <p className="font-mono text-[11px] text-muted-foreground truncate">
              {[version && `v${version}`, addon.minEngineVersion && `engine ${addon.minEngineVersion}+`].filter(Boolean).join(' · ') || fileName}
            </p>
          </div>
        </div>
        {addon.description && <p className="text-[13px] leading-relaxed text-subtle">{addon.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          {hasWorld && <span className="border border-gold px-1.5 py-0.5 font-mono text-[10px] tracking-[1px] text-gold">WORLD</span>}
          {addon.packTypes.map(type => (
            <span key={type} className={cn('border px-1.5 py-0.5 font-mono text-[10px] tracking-[1px]', PACK_BADGES[type].className)}>
              {PACK_BADGES[type].label}
            </span>
          ))}
          {addon.dependencies.length > 0 && (
            <span className="border border-border px-1.5 py-0.5 font-mono text-[10px] tracking-[1px] text-subtle">DEPS {addon.dependencies.length}</span>
          )}
        </div>
      </div>

      <nav>
        <NavLabel>{t('nav.contents')}</NavLabel>
        <div className="space-y-0.5">
          {CONTENT_NAV.map(item => (
            <NavItem
              key={item.category}
              to={`/results/${item.category}`}
              icon={item.icon}
              label={t(item.labelKey)}
              count={String(counts[item.category])}
              active={category === item.category}
            />
          ))}
        </div>
      </nav>

      {hasWorld && (
        <nav>
          <NavLabel>{t('nav.world')}</NavLabel>
          <NavItem to="/results/map" icon={MapIcon} label={t('nav.map')} count="3 dim" active={category === 'map'} />
        </nav>
      )}

      {(summary.contentFocus.length > 0 || highlights.length > 0) && (
        <div className="space-y-2.5">
          <NavLabel>{t('nav.focus')}</NavLabel>
          {summary.contentFocus.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.contentFocus.map(tag => (
                <span key={tag} className="bg-secondary px-2 py-1 text-xs text-subtle">{t(tag)}</span>
              ))}
            </div>
          )}
          {highlights.length > 0 && (
            <ul className="space-y-1">
              {highlights.map(({ key, icon: Icon, iconClass, label }) => (
                <li key={key} className="flex items-center gap-2 text-xs text-subtle">
                  <Icon className={cn('h-3.5 w-3.5', iconClass)} />
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-auto space-y-3">
        {missingTypes.length > 0 && <AddPackUpload missingTypes={missingTypes} />}
        <ExportControls result={result} />
      </div>
    </aside>
    </>
  )
}

type CompactNavProps = Pick<Props, 'category' | 'counts' | 'hasWorld'> & {
  menuOpen: boolean
  onOpenMenu: () => void
  menuButtonRef: RefObject<HTMLButtonElement | null>
}

/** Category switcher shown instead of the sidebar on narrow screens */
export function CompactNav({ category, counts, hasWorld, menuOpen, onOpenMenu, menuButtonRef }: CompactNavProps) {
  const { t } = useLanguage()
  const items = [
    ...CONTENT_NAV.map(item => ({ key: item.category, to: `/results/${item.category}`, icon: item.icon, label: t(item.labelKey), count: String(counts[item.category]) })),
    ...(hasWorld ? [{ key: 'map', to: '/results/map', icon: MapIcon, label: t('nav.map'), count: undefined }] : []),
  ]
  return (
    <nav className="lg:hidden shrink-0 flex gap-1 overflow-x-auto border-b border-border-light bg-background/95 px-3 py-2">
      <button
        ref={menuButtonRef}
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls={SIDEBAR_ID}
        className="flex shrink-0 items-center gap-2 border border-border px-3 py-1.5 text-sm text-subtle cursor-pointer hover:bg-secondary"
      >
        <PanelLeft className="h-4 w-4" />
        {t('nav.menu')}
      </button>
      {items.map(({ key, to, icon: Icon, label, count }) => {
        const active = category === key
        return (
          <Link
            key={key}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 px-3 py-1.5 border-b-2 text-sm whitespace-nowrap',
              active ? 'border-accent bg-secondary text-foreground' : 'border-transparent text-subtle hover:bg-secondary/60',
            )}
          >
            <Icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-muted-foreground')} />
            {label}
            {count != null && <span className={cn('font-mono text-xs', active ? 'text-accent' : 'text-muted-foreground')}>{count}</span>}
          </Link>
        )
      })}
    </nav>
  )
}
