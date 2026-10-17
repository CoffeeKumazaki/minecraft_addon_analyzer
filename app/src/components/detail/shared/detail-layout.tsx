import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X, Layers, GitMerge, ArrowRightLeft, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/context/language-context'
import { cn } from '@/lib/utils'
import type { Diagnostic, MenuCategory, ReferenceLink } from '@/types'

type HeaderProps = {
  /** e.g. "ITEM / mypack:sword" */
  crumb: string
  /** Where the close button goes (the list without a selection) */
  closeTo: string
  thumbnail: ReactNode
  title: string
  path?: string
  children?: ReactNode
}

export function DetailHeader({ crumb, closeTo, thumbnail, title, path, children }: HeaderProps) {
  const { t } = useLanguage()
  return (
    <div className="px-7 pt-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] text-muted-foreground truncate">{crumb}</p>
        <Link to={closeTo} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={t('detail.close')}>
          <X className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="size-16 shrink-0 flex items-center justify-center border border-border bg-background">{thumbnail}</span>
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.5px] break-words">{title}</h2>
          {path && <p className="font-mono text-[11px] text-muted-foreground break-all">{path}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

type SummaryProps = {
  menuCategory?: MenuCategory
  obtainCount: number
  usedInCount: number
  issueCount: number
  /** Opens the list explaining the issues */
  onShowIssues?: () => void
}

function SummaryStat({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-subtle">
      <Icon className="h-3 w-3 text-muted-foreground" />
      {label}
    </span>
  )
}

/** One-line overview shared by items and blocks: what it is and how it is wired up */
export function SummaryLine({ menuCategory, obtainCount, usedInCount, issueCount, onShowIssues }: SummaryProps) {
  const { t } = useLanguage()
  const categoryKey = menuCategory ? `category.${menuCategory.category}` : 'category.unset'
  const categoryLabel = t(categoryKey) === categoryKey ? menuCategory!.category : t(categoryKey)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 border border-border px-2 py-1 text-xs text-subtle" title={menuCategory?.group}>
        <Layers className="h-3 w-3" />
        {categoryLabel}
      </span>
      <SummaryStat icon={GitMerge} label={t('detail.obtain', { n: obtainCount })} />
      <SummaryStat icon={ArrowRightLeft} label={t('detail.usedIn', { n: usedInCount })} />
      {issueCount > 0 && (
        <button
          onClick={onShowIssues}
          className="ml-auto flex items-center gap-1.5 border border-destructive px-2 py-1 text-xs text-destructive cursor-pointer hover:bg-destructive/10"
        >
          <TriangleAlert className="h-3 w-3" />
          {issueCount === 1 ? t('detail.issue') : t('detail.issues', { n: issueCount })}
        </button>
      )}
    </div>
  )
}

export type DetailTab = { key: string; label: string; count?: number }

const DETAIL_TABPANEL_ID = 'detail-tabpanel'
const tabId = (key: string) => `detail-tab-${key}`

export function DetailTabBar({ tabs, value, onChange }: { tabs: DetailTab[]; value: string; onChange: (key: string) => void }) {
  // Arrow keys move between tabs (WAI-ARIA tabs pattern with automatic activation)
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = tabs.findIndex(tab => tab.key === value)
    const next = e.key === 'ArrowRight' ? index + 1 : e.key === 'ArrowLeft' ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
    if (next == null) return
    e.preventDefault()
    const key = tabs[(next + tabs.length) % tabs.length].key
    onChange(key)
    document.getElementById(tabId(key))?.focus()
  }

  return (
    <div className="flex gap-5 border-b border-border-light overflow-x-auto" role="tablist" onKeyDown={onKeyDown}>
      {tabs.map(tab => {
        const active = tab.key === value
        return (
          <button
            key={tab.key}
            id={tabId(tab.key)}
            role="tab"
            aria-selected={active}
            aria-controls={DETAIL_TABPANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex items-center gap-1.5 pb-2.5 -mb-px border-b-2 text-[13px] whitespace-nowrap cursor-pointer transition-colors',
              active ? 'border-accent text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count != null && <span className="font-mono text-[10px] text-muted-foreground">{tab.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Content area for the selected DetailTabBar tab */
export function DetailTabPanel({ tab, children }: { tab: string; children: ReactNode }) {
  return (
    <div id={DETAIL_TABPANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)} className="px-7 pt-5 space-y-6">
      {children}
    </div>
  )
}

export function Section({ title, count, children, className }: { title: string; count?: number | string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="flex items-center gap-2 font-mono text-[10px] tracking-[2px] text-muted-foreground">
        {title}
        {count != null && <span className="text-accent">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

export type PropertyRow = { label: string; value: ReactNode }
export type PropertyGroup = { key: string; title: string; icon: LucideIcon; iconClass?: string; rows: PropertyRow[] }

/** Role-based parameter cards; groups without rows are dropped by the caller */
export function PropertyGroups({ groups }: { groups: PropertyGroup[] }) {
  const { t } = useLanguage()
  if (groups.length === 0) return null
  return (
    <Section title={t('section.properties')}>
      <div className="grid grid-cols-2 gap-3 items-start">
        {groups.map(({ key, title, icon: Icon, iconClass, rows }) => (
          <div key={key} className="border border-border-light bg-background/70 px-3.5 py-3 space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold text-subtle">
              <Icon className={cn('h-3.5 w-3.5', iconClass ?? 'text-subtle')} />
              {title}
            </p>
            {rows.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono text-foreground text-right">{row.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  )
}

function formatComponentValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value !== 'object') return String(value)
  const json = JSON.stringify(value)
  return json.length > 140 ? `${json.slice(0, 137)}…` : json
}

export function ComponentsTable({ components }: { components: Record<string, unknown> }) {
  const { t } = useLanguage()
  const entries = Object.entries(components)
  if (entries.length === 0) return <EmptyNote>{t('detail.nothing')}</EmptyNote>
  return (
    <div className="border-t border-border-light">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-3 border-b border-border-light py-2">
          <span className="w-48 shrink-0 font-mono text-[11px] text-subtle break-all">{key}</span>
          <span className="min-w-0 font-mono text-[11px] text-foreground break-all">{formatComponentValue(value)}</span>
        </div>
      ))}
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-muted-foreground">{children}</p>
}

const ISSUE_HINTS: Record<string, string> = {
  icon: 'issue.hint.texture',
  texture: 'issue.hint.texture',
  geometry: 'issue.hint.geometry',
  animation: 'issue.hint.animation',
  loot_table: 'issue.hint.file',
}

/** Unresolved references and diagnostics of one element, each with what was looked for and where */
export function IssueList({ references, diagnostics }: { references: ReferenceLink[]; diagnostics: Diagnostic[] }) {
  const { t } = useLanguage()
  const broken = references.filter(r => !r.resolved)
  if (broken.length === 0 && diagnostics.length === 0) return <EmptyNote>{t('detail.noIssues')}</EmptyNote>
  return (
    <ul className="space-y-2">
      {broken.map((ref, i) => {
        const kind = t(`refkind.${ref.kind}`) === `refkind.${ref.kind}` ? ref.kind : t(`refkind.${ref.kind}`)
        return (
          <li key={`ref-${i}`} className="border-l-2 border-destructive bg-secondary px-3.5 py-2.5 space-y-1">
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <span>{t('issue.missing', { kind })}</span>
            </p>
            <p className="pl-5.5 font-mono text-xs text-destructive break-all">{ref.target}</p>
            <p className="pl-5.5 text-xs text-muted-foreground">{t(ISSUE_HINTS[ref.kind] ?? 'issue.hint.file')}</p>
          </li>
        )
      })}
      {diagnostics.map((d, i) => (
        <li key={`diag-${i}`} className={cn('border-l-2 bg-secondary px-3.5 py-2.5 space-y-1', d.level === 'error' ? 'border-destructive' : 'border-gold')}>
          <p className="flex items-start gap-2 text-sm">
            <TriangleAlert className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', d.level === 'error' ? 'text-destructive' : 'text-gold')} />
            <span>{d.message}</span>
          </p>
          {d.path && <p className="pl-5.5 font-mono text-xs text-muted-foreground break-all">{d.path}</p>}
        </li>
      ))}
    </ul>
  )
}
