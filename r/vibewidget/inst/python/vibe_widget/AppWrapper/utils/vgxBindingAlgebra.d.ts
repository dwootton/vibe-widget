export type Scalar = { tag: "scalar"; value: number }
export type Delta = { tag: "delta"; value: number }
export type Range = { tag: "range"; lo: number; hi: number }
export type Point = { tag: "point"; x: Scalar; y: Scalar }
export type Box = { tag: "box"; x: Range; y: Range }
export type VSegment = { tag: "vsegment"; x: Scalar; y: Range }
export type HSegment = { tag: "hsegment"; x: Range; y: Scalar }

export type Geon = Scalar | Delta | Range | Point | Box | VSegment | HSegment

export type CollectionMode = "independent" | "continuous"

export type Collection<T extends Geon = Geon> = {
  tag: "collection"
  mode: CollectionMode
  elements: T[]
}

export type AnchorValue = Geon | Collection<Geon>

export type BindingRule =
  | "equate"
  | "limit"
  | "project-limit"
  | "project-snap"
  | "equate-index"
  | "quantize"
  | "joint-project"
  | "disallowed"

export type BindingEdge = {
  parent: AnchorValue
  child: AnchorValue
  rule: BindingRule
  channel?: "x" | "y" | "both"
}

export type Component = {
  id: string
  anchors: Record<string, AnchorValue>
}

export type GraphNode = {
  component: Component
  anchorId: string
}

export type GraphEdge = BindingEdge & {
  from: GraphNode
  to: GraphNode
}

export type BindingGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function Scalar(value: number): Scalar
export function Delta(value: number): Delta
export function Range(lo: number, hi: number): Range
export function Point(input: { x: number | Scalar; y: number | Scalar }): Point
export function Box(input: { x: Range; y: Range } | { x1: number; y1: number; x2: number; y2: number }): Box
export function VSegment(input: { x: number | Scalar; y: Range }): VSegment
export function HSegment(input: { x: Range; y: number | Scalar }): HSegment
export function Collection(mode: CollectionMode, elements: Geon[]): Collection<Geon>

export function dimensionality(geon: Geon): number
export function isSeparable(geon: Geon): boolean
export function dof(anchorValue: AnchorValue): number

export function classifyChannelwise(parent: Geon, child: Geon): BindingEdge
export function classifyBinding(parent: AnchorValue, child: AnchorValue): BindingEdge

export function anchorsMatch(a: string, b: string, aliases?: Record<string, string | string[]>): boolean
export function buildBindingGraph(chain: Component[], options?: { aliases?: Record<string, string | string[]> }): BindingGraph

export type UpdateFn = (parentVal: AnchorValue, childVal: AnchorValue) => AnchorValue
export function compileEdge(edge: BindingEdge): UpdateFn
export function clamp(value: number, lo: number, hi: number): number
export function clampRange(child: Range, parent: Range): Range

export function runBindingGraph(
  graph: BindingGraph,
  initialState?: Record<string, Record<string, AnchorValue>>
): {
  state: Record<string, Record<string, AnchorValue>>
  updates: Array<{ edge: GraphEdge; value: AnchorValue }>
}

export class StateExpr {
  add(other: number | StateExpr): StateExpr
  subtract(other: number | StateExpr): StateExpr
  multiply(other: number | StateExpr): StateExpr
  divide(other: number | StateExpr): StateExpr
  evaluate(state: Record<string, unknown>): number
}

export function createStateRefs<T extends Record<string, unknown>>(shape: T): any
export function createStateFromShape<T>(shape: T): T
export function evaluateExpr(expr: StateExpr, state: Record<string, unknown>): number

export type TupleAnchor = { tag: "tuple"; items: unknown[] }
export function tuple(...items: unknown[]): TupleAnchor

export class CollectionAnchor {
  source: unknown
  kind: CollectionMode
  scope: string
  cardinality: "extensible" | number
  editRules: Array<{ when: string; do: unknown[] }>
  constructor(config: {
    source: unknown
    kind?: CollectionMode
    scope?: string
    cardinality?: "extensible" | number
    editRules?: Array<{ when: string; do: unknown | unknown[] }>
  })
}

export function evaluateAnchorValue(anchorDefinition: unknown, state: Record<string, unknown>, context?: Record<string, unknown>): unknown
export function resolveAnchors(anchorDefinitions: Record<string, unknown>, state: Record<string, unknown>, context?: Record<string, unknown>): Record<string, AnchorValue>
export function createComponentFromSchema(componentId: string, schema: { anchors: Record<string, unknown> }, state: Record<string, unknown>, context?: Record<string, unknown>): Component

export function createInteractionRuntime(config: {
  schema: {
    anchors: Record<string, unknown>
    events?: Record<string, string>
  }
  initialState?: Record<string, unknown>
}): {
  schema: unknown
  state: Record<string, unknown>
  on(logicalName: string, listener: (event: unknown) => void): () => void
  off(logicalName: string, listener: (event: unknown) => void): void
  getRegisteredDomEvents(): string[]
  attach(target: {
    addEventListener(type: string, handler: (payload: unknown) => void): void
    removeEventListener(type: string, handler: (payload: unknown) => void): void
  }): () => void
  emitDomEvent(domEventType: string, payload?: unknown): string[]
  getAnchors(): Record<string, AnchorValue>
  getAnchor(anchorId: string): AnchorValue
  getState(): Record<string, unknown>
}

export const circleStateShape: { x: number; y: number; r: number }
export const circleSchema: {
  state: Record<string, unknown>
  anchors: Record<string, unknown>
  paramAliases: { radius: "r" }
}

export const dragStateShape: {
  pointer: {
    down: { x: number; y: number }
    move: { x: number; y: number }
    up: { x: number; y: number }
  }
}

export const dragSchema: {
  state: Record<string, unknown>
  anchors: Record<string, unknown>
  events: Record<string, string>
}

export const compositionCatalog: Array<{
  id: string
  expression: string
  description: string
}>

export function listCompositions(): Array<{
  id: string
  expression: string
  description: string
}>

export function createChartGridBrushDemo(config?: {
  chartBounds?: Box
  gridBounds?: Box
  gridLines?: number[]
  brushX?: Scalar
}): {
  chain: Component[]
  graph: BindingGraph
  result: {
    state: Record<string, Record<string, AnchorValue>>
    updates: Array<{ edge: GraphEdge; value: AnchorValue }>
  }
}
