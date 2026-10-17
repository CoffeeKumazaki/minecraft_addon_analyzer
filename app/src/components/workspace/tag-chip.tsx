import { useLanguage } from '@/context/language-context'
import { cn } from '@/lib/utils'

const TAG_DOT: Record<string, string> = {
  hostile: 'bg-destructive',
  ranged: 'bg-gold',
  melee: 'bg-destructive',
  neutral: 'bg-gold',
  passive: 'bg-accent',
  flying: 'bg-accent',
  aquatic: 'bg-accent',
  tameable: 'bg-amethyst',
  breedable: 'bg-amethyst',
  rideable: 'bg-amethyst',
  weapon: 'bg-gold',
  tool: 'bg-accent',
  edible: 'bg-gold',
  wearable: 'bg-accent',
  emissive: 'bg-gold',
  directional: 'bg-accent',
}

/** Small tag label with a colored dot; colors group tags by meaning (danger, utility, ...) */
export function TagChip({ tag, className }: { tag: string; className?: string }) {
  const { t } = useLanguage()
  return (
    <span className={cn('inline-flex items-center gap-1.5 bg-card px-1.5 py-0.5 text-[11px] text-subtle whitespace-nowrap', className)}>
      <span className={cn('size-1.5 shrink-0', TAG_DOT[tag] ?? 'bg-muted-foreground')} aria-hidden />
      {t(tag)}
    </span>
  )
}
