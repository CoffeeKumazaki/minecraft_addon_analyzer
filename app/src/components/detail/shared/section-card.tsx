import { useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3 px-4"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-4 pb-4 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
