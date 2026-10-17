import { parse } from 'acorn'
import type { VirtualFS, ItemSpec, SpawnLink } from '@/types'
import { decodeText } from '@/lib/json-parser'

/**
 * Infer what items spawn when the spawning is done by scripts instead of
 * entity_placer / block_placer (e.g. itemUse → spawnEntity / setType).
 *
 * Best effort on the parsed script (strings, comments and regexes never count as code):
 *  - a spawn call inside the `then` branch of `if (itemId === ITEM)` (also within && / ||)
 *  - `new Map([[ITEM, TARGET], ...])` whose `.get()` result reaches a spawn call
 * Ids are string literals or constants declared once and never reassigned.
 * Anything else (other scopes, negated conditions, TypeScript sources) is left out.
 */

type KnownIds = { items: Set<string>; entities: Set<string>; blocks: Set<string> }
type Target = { kind: SpawnLink['kind']; target: string }
type AstNode = { type: string; start: number; end: number; [key: string]: unknown }

/** Larger files are skipped rather than holding up the analysis */
const MAX_SCRIPT_CHARS = 5_000_000

/** Cap on (spawn call × compared item) link checks per file */
const MAX_LINK_CHECKS = 200_000

/** Setting a block to air removes it rather than placing anything */
const AIR_IDS = new Set(['air', 'minecraft:air'])

const SINK_METHODS: Record<string, SpawnLink['kind']> = { spawnEntity: 'entity', setType: 'block' }

function isNode(value: unknown): value is AstNode {
  return !!value && typeof value === 'object' && typeof (value as AstNode).type === 'string'
}

function parseScript(src: string): AstNode | null {
  for (const sourceType of ['module', 'script'] as const) {
    try {
      return parse(src, {
        ecmaVersion: 'latest',
        sourceType,
        allowHashBang: true,
        allowReturnOutsideFunction: true,
        allowAwaitOutsideFunction: true,
      }) as unknown as AstNode
    } catch {
      // Try the other source type; unparsable files (e.g. TypeScript) are skipped
    }
  }
  return null
}

/** Every node once, with its parent and the property it sits in (iterative: no stack overflow) */
function indexNodes(root: AstNode) {
  const nodes: AstNode[] = []
  const parents = new Map<AstNode, { node: AstNode; key: string }>()
  const stack = [root]
  while (stack.length > 0) {
    const node = stack.pop()!
    nodes.push(node)
    for (const [key, value] of Object.entries(node)) {
      const children = Array.isArray(value) ? value : [value]
      for (const child of children) {
        if (!isNode(child)) continue
        parents.set(child, { node, key })
        stack.push(child)
      }
    }
  }
  return { nodes, parents }
}

/** Names a binding or assignment target introduces / writes, destructuring included */
function patternNames(pattern: unknown, out: string[] = []): string[] {
  if (!isNode(pattern)) return out
  switch (pattern.type) {
    case 'Identifier':
      out.push(pattern.name as string)
      break
    case 'ObjectPattern':
      for (const prop of pattern.properties as AstNode[]) patternNames(prop.type === 'RestElement' ? prop : prop.value, out)
      break
    case 'ArrayPattern':
      for (const element of pattern.elements as unknown[]) patternNames(element, out)
      break
    case 'RestElement':
      patternNames(pattern.argument, out)
      break
    case 'AssignmentPattern':
      patternNames(pattern.left, out)
      break
  }
  return out
}

function stringLiteral(node: unknown): string | undefined {
  if (!isNode(node)) return undefined
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node.type === 'TemplateLiteral' && (node.expressions as unknown[]).length === 0) {
    const cooked = ((node.quasis as AstNode[])[0]?.value as { cooked?: string } | undefined)?.cooked
    return cooked ?? undefined
  }
  return undefined
}

const identifierName = (node: unknown) => (isNode(node) && node.type === 'Identifier' ? node.name as string : undefined)

/** `obj.method` (non-computed) → [object node, method name] */
function memberCall(callee: unknown): [AstNode, string] | undefined {
  if (!isNode(callee) || callee.type !== 'MemberExpression' || callee.computed) return undefined
  const name = identifierName(callee.property)
  return name && isNode(callee.object) ? [callee.object, name] : undefined
}

/**
 * Entity of a `summon` command: "summon ns:id ..." gives the id itself,
 * `summon ${X} ...` gives the expression X to resolve like any other argument.
 */
function summonTarget(arg: unknown): { arg?: unknown; literal?: string } | undefined {
  const literal = stringLiteral(arg)
  if (literal != null) {
    const id = /^\s*\/?summon\s+([^\s"]+)/.exec(literal)?.[1]
    return id ? { literal: id } : undefined
  }
  if (!isNode(arg) || arg.type !== 'TemplateLiteral') return undefined
  const quasis = arg.quasis as AstNode[]
  const [head, next] = quasis.map(q => (q.value as { cooked?: string } | undefined)?.cooked ?? '')
  // `summon ${X} ~ ~ ~`: X must be the whole id, so it ends at whitespace or the end of the
  // command (not `${X}_baby`, nor `${X}${Y}` where the empty text sits between two values)
  const endsId = /^\s/.test(next ?? '') || (next === '' && quasis.length === 2)
  const wholeId = /^\s*\/?summon\s+$/.test(head ?? '') && endsId
  return wholeId ? { arg: (arg.expressions as unknown[])[0] } : undefined
}

function scanScript(src: string, known: KnownIds): Map<string, Map<string, Target>> {
  const found = new Map<string, Map<string, Target>>()
  const root = parseScript(src)
  if (!root) return found
  const { nodes, parents } = indexNodes(root)

  // Names declared exactly once (any binding form) and never reassigned can be followed
  const declarations = new Map<string, number>()
  const values = new Map<string, string>()
  const reassigned = new Set<string>()
  const declare = (pattern: unknown) => {
    for (const name of patternNames(pattern)) declarations.set(name, (declarations.get(name) ?? 0) + 1)
  }
  const reassign = (pattern: unknown) => {
    for (const name of patternNames(pattern)) reassigned.add(name)
  }
  for (const node of nodes) {
    if (node.type === 'VariableDeclarator') {
      declare(node.id)
      const name = identifierName(node.id)
      const value = stringLiteral(node.init)
      if (name && value) values.set(name, value)
    } else if (/Function/.test(node.type)) {
      declare(node.id)
      for (const param of (node.params as unknown[] | undefined) ?? []) declare(param)
    } else if (node.type === 'CatchClause' || node.type === 'ClassDeclaration') {
      declare(node.type === 'CatchClause' ? node.param : node.id)
    } else if (node.type === 'AssignmentExpression') {
      reassign(node.left)
    } else if (node.type === 'UpdateExpression') {
      reassign(node.argument)
    } else if ((node.type === 'ForOfStatement' || node.type === 'ForInStatement') && isNode(node.left) && node.left.type !== 'VariableDeclaration') {
      reassign(node.left)
    }
  }
  const isStable = (name: string | undefined): name is string =>
    !!name && declarations.get(name) === 1 && !reassigned.has(name)
  const resolve = (node: unknown): string | undefined => {
    const literal = stringLiteral(node)
    if (literal) return literal
    const name = identifierName(node)
    return isStable(name) ? values.get(name) : undefined
  }

  // Bounded work: pathological scripts (huge || chains × many calls) stop adding links
  let budget = MAX_LINK_CHECKS
  const add = (item: string, target: Target) => {
    budget--
    const byKey = found.get(item) ?? new Map<string, Target>()
    byKey.set(`${target.kind}:${target.target}`, target)
    found.set(item, byKey)
  }

  // Item ids a condition requires to be true (negations and other forms give nothing); cached per if
  const conditionItems = new Map<AstNode, string[]>()
  const positiveItems = (test: unknown): string[] => {
    if (!isNode(test)) return []
    const cached = conditionItems.get(test)
    if (cached) return cached
    const items = new Set<string>()
    const pending: unknown[] = [test]
    while (pending.length > 0) {
      const node = pending.pop()
      if (!isNode(node)) continue
      if (node.type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||')) {
        pending.push(node.left, node.right)
        continue
      }
      if (node.type !== 'BinaryExpression' || (node.operator !== '===' && node.operator !== '==')) continue
      for (const [side, other] of [[node.left, node.right], [node.right, node.left]] as const) {
        const id = resolve(side)
        if (!id || !known.items.has(id) || !isNode(other)) continue
        // Vehicles often share the id of the item that places them: then only `item…` operands count
        const ambiguous = known.entities.has(id) || known.blocks.has(id)
        if (!ambiguous || /item/i.test(src.slice(other.start, other.end))) items.add(id)
      }
    }
    const result = [...items]
    conditionItems.set(test, result)
    return result
  }

  // Spawn calls, and which Maps / variables feed their first argument
  const sinks: { call: AstNode; kind: SpawnLink['kind']; arg?: unknown; literal?: string }[] = []
  for (const node of nodes) {
    if (node.type !== 'CallExpression') continue
    const member = memberCall(node.callee)
    if (!member) continue
    const [object, method] = member
    const arg = (node.arguments as unknown[])[0]
    if (method === 'runCommand' || method === 'runCommandAsync') {
      const summon = summonTarget(arg)
      if (summon) sinks.push({ call: node, kind: 'entity', ...summon })
      continue
    }
    const kind = SINK_METHODS[method] ?? (method === 'resolve' && identifierName(object) === 'BlockPermutation' ? 'block' : undefined)
    if (kind) sinks.push({ call: node, kind, arg })
  }

  // `if (item comparison) { ... spawn ... }`
  for (const { call, kind, arg, literal } of sinks) {
    if (budget <= 0) break
    const target = literal ?? resolve(arg)
    if (!target || AIR_IDS.has(target)) continue
    for (let up = parents.get(call); up && budget > 0; up = parents.get(up.node)) {
      if (up.node.type === 'IfStatement' && up.key === 'consequent') {
        for (const item of positiveItems(up.node.test)) add(item, { kind, target })
      }
    }
  }

  // `new Map([[ITEM, TARGET], ...])` whose `.get()` reaches a spawn call
  // Map and variable names follow the same rule as constants (declared once, never reassigned)
  const mapOfGet = (node: unknown): string | undefined => {
    if (!isNode(node) || node.type !== 'CallExpression') return undefined
    const member = memberCall(node.callee)
    const map = member && member[1] === 'get' ? identifierName(member[0]) : undefined
    return isStable(map) ? map : undefined
  }
  const variableFromMap = new Map<string, string>()
  for (const node of nodes) {
    if (node.type !== 'VariableDeclarator') continue
    const name = identifierName(node.id)
    const map = mapOfGet(node.init)
    if (isStable(name) && map) variableFromMap.set(name, map)
  }
  const mapSinkKinds = new Map<string, Set<SpawnLink['kind']>>()
  for (const { kind, arg } of sinks) {
    const variable = identifierName(arg)
    const map = mapOfGet(arg) ?? (variable ? variableFromMap.get(variable) : undefined)
    if (!map) continue
    const kinds = mapSinkKinds.get(map) ?? new Set()
    kinds.add(kind)
    mapSinkKinds.set(map, kinds)
  }
  for (const node of nodes) {
    if (node.type !== 'NewExpression' || identifierName(node.callee) !== 'Map') continue
    const up = parents.get(node)
    const mapName = up?.node.type === 'VariableDeclarator' && up.key === 'init' ? identifierName(up.node.id) : undefined
    const kinds = isStable(mapName) ? mapSinkKinds.get(mapName) : undefined
    const entries = (node.arguments as unknown[])[0]
    if (!kinds || !isNode(entries) || entries.type !== 'ArrayExpression') continue
    for (const pair of entries.elements as unknown[]) {
      if (!isNode(pair) || pair.type !== 'ArrayExpression' || (pair.elements as unknown[]).length !== 2) continue
      const [key, val] = pair.elements as unknown[]
      const item = resolve(key)
      const value = resolve(val)
      if (!item || !value || !known.items.has(item) || !value.includes(':') || AIR_IDS.has(value)) continue
      const kind = known.blocks.has(value) ? 'block'
        : known.entities.has(value) ? 'entity'
        : known.items.has(value) ? undefined // item → item tables are not spawns
        : kinds.size === 1 ? [...kinds][0] // unknown (e.g. vanilla) ids take the kind of the call they reach
        : undefined
      if (kind && kinds.has(kind)) add(item, { kind, target: value })
    }
  }

  return found
}

/** Add script-inferred spawns to items; links already known from components are kept as is */
export function attachScriptSpawns(
  files: VirtualFS,
  scriptPaths: string[],
  items: ItemSpec[],
  entityIds: Iterable<string>,
  blockIds: Iterable<string>,
): void {
  const known: KnownIds = {
    items: new Set(items.map(i => i.id)),
    entities: new Set(entityIds),
    blocks: new Set(blockIds),
  }
  // First definition per id, matching the item the detail page opens
  const byId = new Map<string, ItemSpec>()
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item)
  for (const path of scriptPaths) {
    const data = files.get(path)
    if (!data) continue
    const src = decodeText(data)
    if (src.length > MAX_SCRIPT_CHARS) continue
    for (const [itemId, targets] of scanScript(src, known)) {
      const item = byId.get(itemId)
      if (!item) continue
      for (const { kind, target } of targets.values()) {
        if (item.spawns.some(s => s.kind === kind && s.target === target)) continue
        item.spawns.push({ kind, target, source: 'script', sourcePath: path })
      }
    }
  }
}
