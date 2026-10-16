import { Component, lazy, Suspense, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import type { ModelViewerProps } from './model-viewer'

// three.js is heavy; load the viewer only when a model is actually shown
const ModelViewer = lazy(() => import('./model-viewer').then(m => ({ default: m.ModelViewer })))

const DEFAULT_HEIGHT = 360

/** Keeps a failed viewer (e.g. chunk load error) from taking down the rest of the detail page */
class ViewerErrorBoundary extends Component<{ height: number; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex items-center justify-center gap-2 border border-border-light bg-secondary/50 text-xs text-muted-foreground" style={{ height: this.props.height }}>
        <TriangleAlert className="h-4 w-4" />
        <span>3D preview failed to load.</span>
      </div>
    )
  }
}

export function LazyModelViewer(props: ModelViewerProps) {
  const height = props.height ?? DEFAULT_HEIGHT
  return (
    <ViewerErrorBoundary height={height}>
      <Suspense fallback={<div className="bg-secondary/50 border border-border-light" style={{ height }} />}>
        <ModelViewer {...props} />
      </Suspense>
    </ViewerErrorBoundary>
  )
}
