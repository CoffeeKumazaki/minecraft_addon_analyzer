import type { PackInfo, PackModule, DependencySpec, PackType } from '@/types'
import { MODULE_TYPE_MAP } from '@/lib/constants'
import type { PackRoot } from './pack-detector'

/**
 * Parse a manifest.json into PackInfo.
 */
export function parseManifest(packRoot: PackRoot): PackInfo {
  const m = packRoot.manifest
  const header = (m.header ?? {}) as Record<string, unknown>
  const rawModules = (m.modules ?? []) as Record<string, unknown>[]
  const rawDeps = (m.dependencies ?? []) as Record<string, unknown>[]

  const modules: PackModule[] = rawModules.map(mod => ({
    type: String(mod.type ?? 'unknown'),
    uuid: String(mod.uuid ?? ''),
    version: formatVersion(mod.version) ?? '',
    description: mod.description ? String(mod.description) : undefined,
    entry: mod.entry ? String(mod.entry) : undefined,
  }))

  const dependencies: DependencySpec[] = rawDeps.map(dep => ({
    uuid: String(dep.uuid ?? dep.module_name ?? ''),
    version: formatVersion(dep.version) ?? '',
    moduleName: dep.module_name ? String(dep.module_name) : undefined,
  }))

  // Determine pack type from modules
  const packTypes = new Set<PackType>()
  for (const mod of modules) {
    const mapped = MODULE_TYPE_MAP[mod.type]
    if (mapped) packTypes.add(mapped)
  }

  let type: PackInfo['type'] = 'unknown'
  if (packTypes.has('behavior') && packTypes.has('resource')) {
    type = 'mixed'
  } else if (packTypes.has('behavior') || packTypes.has('script')) {
    type = 'behavior'
  } else if (packTypes.has('resource')) {
    type = 'resource'
  }

  return {
    name: String(header.name ?? ''),
    type,
    path: packRoot.path,
    uuid: header.uuid ? String(header.uuid) : undefined,
    version: formatVersion(header.version),
    minEngineVersion: formatVersion(header.min_engine_version),
    modules,
    dependencies,
  }
}

function formatVersion(v: unknown): string | undefined {
  if (!v) return undefined
  if (Array.isArray(v)) return v.join('.')
  return String(v)
}
