import type { AnalysisResult } from '@/types'

export function exportJson(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2)
}
