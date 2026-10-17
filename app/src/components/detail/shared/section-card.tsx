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
        className="w-full flex items-center justify-between pb-2 mb-3 border-b border-border-light cursor-pointer"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="font-mono text-[10px] tracking-[2px] text-muted-foreground">{title.toUpperCase()}</span>
          {badge && <span className="font-mono text-[10px] text-accent">{badge}</span>}
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && children}
    </div>
  )
}
