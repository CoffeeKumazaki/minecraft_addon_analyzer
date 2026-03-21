import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  icon?: LucideIcon
  defaultOpen?: boolean
  badge?: string
  children: ReactNode
}

export function SectionCard({ title, icon: Icon, defaultOpen = true, badge, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        className="w-full flex items-center justify-between border-b border-border-light pb-2 mb-3 cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="font-heading text-[11px] font-semibold tracking-[1px] text-muted-foreground">{title.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="bg-accent text-accent-foreground font-heading text-[9px] font-semibold px-1.5 py-0.5">
              {badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>
      {open && children}
    </div>
  )
}
