type Props = {
  components: Record<string, unknown>
}

function formatKey(key: string): string {
  return key.replace(/^minecraft:/, '')
}

function isSimpleValue(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
}

function formatSimpleValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function ComponentTable({ components }: Props) {
  const entries = Object.entries(components)
  if (entries.length === 0) return null

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(140px,auto)_1fr] gap-2 py-1.5 border-b border-border/50 last:border-0">
          <span className="font-mono text-xs text-muted-foreground break-all">
            {formatKey(key)}
          </span>
          <div className="text-sm">
            {isSimpleValue(value) ? (
              <span className="font-mono text-xs">{formatSimpleValue(value)}</span>
            ) : (
              <details className="group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  {Array.isArray(value)
                    ? `[${value.length} 件]`
                    : `{${Object.keys(value as object).length} プロパティ}`
                  }
                </summary>
                <pre className="mt-1 text-xs bg-muted p-2 rounded-md overflow-auto max-h-48">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
