/**
 * VGX Binding Algebra runtime and schema helpers.
 *
 * This module is intentionally framework-agnostic so it can be tested via Node
 * and reused by UI/runtime code.
 */

const GEON_TAGS = new Set(["scalar", "delta", "range", "point", "box", "vsegment", "hsegment"])

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function isCollection(value) {
  return isObject(value) && value.tag === "collection" && Array.isArray(value.elements)
}

function isGeon(value) {
  return isObject(value) && GEON_TAGS.has(value.tag)
}

function minMaxFromScalarCollection(collection) {
  if (!isCollection(collection) || collection.elements.length === 0) {
    return null
  }
  const numbers = collection.elements
    .filter((element) => element && element.tag === "scalar")
    .map((element) => asNumber(element.value))

  if (numbers.length === 0) {
    return null
  }

  return {
    lo: Math.min(...numbers),
    hi: Math.max(...numbers),
  }
}

function nearestScalarValue(collection, value) {
  if (!isCollection(collection) || collection.elements.length === 0) {
    return asNumber(value)
  }
  const candidates = collection.elements
    .filter((element) => element && element.tag === "scalar")
    .map((element) => asNumber(element.value))

  if (candidates.length === 0) {
    return asNumber(value)
  }

  return candidates.reduce((nearest, candidate) => {
    const nearestDistance = Math.abs(nearest - asNumber(value))
    const candidateDistance = Math.abs(candidate - asNumber(value))
    return candidateDistance < nearestDistance ? candidate : nearest
  }, candidates[0])
}

export function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value))
}

export function clampRange(child, parent) {
  const nextLo = clamp(asNumber(child.lo), asNumber(parent.lo), asNumber(parent.hi))
  const nextHi = clamp(asNumber(child.hi), asNumber(parent.lo), asNumber(parent.hi))
  return {
    tag: "range",
    lo: Math.min(nextLo, nextHi),
    hi: Math.max(nextLo, nextHi),
  }
}

export function Scalar(value) {
  return { tag: "scalar", value }
}

export function Delta(value) {
  return { tag: "delta", value }
}

export function Range(loOrRange, hi) {
  if (isObject(loOrRange) && ("lo" in loOrRange || "hi" in loOrRange)) {
    return {
      tag: "range",
      lo: loOrRange.lo,
      hi: loOrRange.hi,
    }
  }

  return {
    tag: "range",
    lo: loOrRange,
    hi,
  }
}

function normalizeScalarInput(value) {
  if (isObject(value) && (value.tag === "scalar" || value.tag === "delta")) {
    return value
  }
  return Scalar(value)
}

function normalizeRangeInput(value) {
  if (isObject(value) && value.tag === "range") {
    return value
  }
  if (isObject(value) && ("lo" in value || "hi" in value)) {
    return Range(value)
  }
  throw new Error("Range-like input is required")
}

export function Point(input) {
  return {
    tag: "point",
    x: normalizeScalarInput(input.x),
    y: normalizeScalarInput(input.y),
  }
}

export function Box(input) {
  if ("x" in input || "y" in input) {
    return {
      tag: "box",
      x: normalizeRangeInput(input.x),
      y: normalizeRangeInput(input.y),
    }
  }

  if ("x1" in input || "x2" in input || "y1" in input || "y2" in input) {
    return {
      tag: "box",
      x: Range(input.x1, input.x2),
      y: Range(input.y1, input.y2),
    }
  }

  throw new Error("Box requires either {x, y} ranges or {x1, y1, x2, y2} endpoints")
}

export function VSegment(input) {
  return {
    tag: "vsegment",
    x: normalizeScalarInput(input.x),
    y: normalizeRangeInput(input.y),
  }
}

export function HSegment(input) {
  return {
    tag: "hsegment",
    x: normalizeRangeInput(input.x),
    y: normalizeScalarInput(input.y),
  }
}

export function Collection(modeOrConfig, elements = []) {
  if (isObject(modeOrConfig)) {
    return {
      tag: "collection",
      mode: modeOrConfig.mode,
      elements: modeOrConfig.elements ?? [],
    }
  }

  return {
    tag: "collection",
    mode: modeOrConfig,
    elements,
  }
}

export function dimensionality(geon) {
  switch (geon.tag) {
    case "scalar":
    case "range":
      return 1
    case "point":
    case "box":
    case "vsegment":
    case "hsegment":
      return 2
    default:
      return 0
  }
}

export function isSeparable(geon) {
  switch (geon.tag) {
    case "scalar":
    case "range":
    case "point":
    case "box":
    case "vsegment":
    case "hsegment":
      return true
    default:
      return false
  }
}

export function dof(anchorValue) {
  if (!anchorValue) {
    return 0
  }

  if (anchorValue.tag === "collection") {
    if (!Array.isArray(anchorValue.elements) || anchorValue.elements.length === 0) {
      return 0
    }
    return anchorValue.elements.length * dof(anchorValue.elements[0])
  }

  switch (anchorValue.tag) {
    case "scalar":
      return 1
    case "range":
      return 2
    case "point":
      return 2
    case "box":
      return 4
    case "vsegment":
    case "hsegment":
      return 3
    default:
      return 0
  }
}

function makeBindingEdge(parent, child, rule, channel = "both") {
  const edge = {
    parent,
    child,
    rule,
  }
  if (channel) {
    edge.channel = channel
  }
  return edge
}

export function classifyChannelwise(parent, child) {
  if (parent.tag === "box" && child.tag === "box") {
    return makeBindingEdge(parent, child, "limit", "both")
  }

  if (parent.tag === "box" && child.tag === "point") {
    return makeBindingEdge(parent, child, "limit", "both")
  }

  if (parent.tag === "range" && child.tag === "range") {
    return makeBindingEdge(parent, child, "limit", "both")
  }

  if (parent.tag === "range" && child.tag === "scalar") {
    return makeBindingEdge(parent, child, "project-limit", "both")
  }

  if (parent.tag === "scalar" && child.tag === "scalar") {
    return makeBindingEdge(parent, child, "equate", "both")
  }

  if (parent.tag === "point" && child.tag === "point") {
    return makeBindingEdge(parent, child, "equate", "both")
  }

  if (parent.tag === "vsegment" && child.tag === "point") {
    return makeBindingEdge(parent, child, "project-limit", "y")
  }

  if (parent.tag === "hsegment" && child.tag === "point") {
    return makeBindingEdge(parent, child, "project-limit", "x")
  }

  return makeBindingEdge(parent, child, "disallowed")
}

export function classifyBinding(parent, child) {
  const parentDOF = dof(parent)
  const childDOF = dof(child)

  if (parentDOF < childDOF) {
    return makeBindingEdge(parent, child, "disallowed")
  }

  if (isCollection(parent) && isCollection(child)) {
    const sameDOF = parentDOF === childDOF
    if (sameDOF && parent.mode === "continuous" && child.mode === "continuous") {
      return makeBindingEdge(parent, child, "limit", "both")
    }
    if (sameDOF && parent.mode === "independent" && child.mode === "independent") {
      return makeBindingEdge(parent, child, "equate", "both")
    }
    if (sameDOF && parent.mode === "independent" && child.mode === "continuous") {
      return makeBindingEdge(parent, child, "equate-index", "both")
    }
    if (sameDOF && parent.mode === "continuous" && child.mode === "independent") {
      return makeBindingEdge(parent, child, "quantize", "both")
    }
  }

  if (isCollection(parent) && isGeon(child)) {
    if (parent.mode === "independent" && child.tag === "scalar") {
      return makeBindingEdge(parent, child, "project-snap", "both")
    }
    if (parent.mode === "continuous" && child.tag === "scalar") {
      return makeBindingEdge(parent, child, "project-limit", "both")
    }
    if (parent.mode === "independent" && child.tag === "range" && parentDOF === childDOF) {
      return makeBindingEdge(parent, child, "equate-index", "both")
    }
  }

  if (isGeon(parent) && isGeon(child) && isSeparable(parent) && isSeparable(child)) {
    return classifyChannelwise(parent, child)
  }

  return makeBindingEdge(parent, child, "joint-project", "both")
}

export function anchorsMatch(a, b, aliases = {}) {
  if (a === b) {
    return true
  }

  const alias = aliases[a]
  if (typeof alias === "string") {
    return alias === b
  }

  if (Array.isArray(alias)) {
    return alias.includes(b)
  }

  return false
}

export function buildBindingGraph(chain, options = {}) {
  const nodes = []
  const edges = []

  for (const component of chain) {
    for (const anchorId of Object.keys(component.anchors ?? {})) {
      nodes.push({ component, anchorId })
    }
  }

  for (let index = 0; index < chain.length - 1; index += 1) {
    const parent = chain[index]
    const child = chain[index + 1]

    for (const [parentAnchorId, parentAnchorValue] of Object.entries(parent.anchors ?? {})) {
      for (const [childAnchorId, childAnchorValue] of Object.entries(child.anchors ?? {})) {
        if (!anchorsMatch(parentAnchorId, childAnchorId, options.aliases)) {
          continue
        }

        const bindingEdge = classifyBinding(parentAnchorValue, childAnchorValue)
        edges.push({
          ...bindingEdge,
          from: {
            component: parent,
            anchorId: parentAnchorId,
          },
          to: {
            component: child,
            anchorId: childAnchorId,
          },
        })
      }
    }
  }

  return { nodes, edges }
}

function projectSegmentPoint(parent, child, channel) {
  const next = {
    tag: "point",
    x: Scalar(asNumber(child.x.value)),
    y: Scalar(asNumber(child.y.value)),
  }

  if (channel === "x") {
    next.x = Scalar(clamp(asNumber(child.x.value), asNumber(parent.x.lo), asNumber(parent.x.hi)))
    next.y = Scalar(asNumber(parent.y.value))
  } else if (channel === "y") {
    next.x = Scalar(asNumber(parent.x.value))
    next.y = Scalar(clamp(asNumber(child.y.value), asNumber(parent.y.lo), asNumber(parent.y.hi)))
  }

  return next
}

export function compileEdge(edge) {
  switch (edge.rule) {
    case "equate":
      return (parent) => cloneValue(parent)

    case "limit":
      return (parent, child) => {
        if (parent.tag === "range" && child.tag === "range") {
          return clampRange(child, parent)
        }

        if (parent.tag === "box" && child.tag === "box") {
          return {
            tag: "box",
            x: clampRange(child.x, parent.x),
            y: clampRange(child.y, parent.y),
          }
        }

        if (parent.tag === "box" && child.tag === "point") {
          return {
            tag: "point",
            x: Scalar(clamp(asNumber(child.x.value), asNumber(parent.x.lo), asNumber(parent.x.hi))),
            y: Scalar(clamp(asNumber(child.y.value), asNumber(parent.y.lo), asNumber(parent.y.hi))),
          }
        }

        return cloneValue(child)
      }

    case "project-limit":
      return (parent, child) => {
        if (parent.tag === "range" && child.tag === "scalar") {
          return {
            tag: "scalar",
            value: clamp(asNumber(child.value), asNumber(parent.lo), asNumber(parent.hi)),
          }
        }

        if ((parent.tag === "vsegment" || parent.tag === "hsegment") && child.tag === "point") {
          return projectSegmentPoint(parent, child, edge.channel)
        }

        if (parent.tag === "collection" && child.tag === "scalar") {
          const limits = minMaxFromScalarCollection(parent)
          if (!limits) {
            return cloneValue(child)
          }

          return {
            tag: "scalar",
            value: clamp(asNumber(child.value), limits.lo, limits.hi),
          }
        }

        return cloneValue(child)
      }

    case "project-snap":
      return (parent, child) => {
        if (parent.tag === "collection" && child.tag === "scalar") {
          return {
            tag: "scalar",
            value: nearestScalarValue(parent, child.value),
          }
        }

        return cloneValue(child)
      }

    case "equate-index":
      return (parent, child) => {
        if (parent.tag === "collection" && child.tag === "range") {
          const scalars = parent.elements.filter((element) => element.tag === "scalar")
          if (scalars.length >= 2) {
            return {
              tag: "range",
              lo: asNumber(scalars[0].value),
              hi: asNumber(scalars[1].value),
            }
          }
        }

        return cloneValue(child)
      }

    case "quantize":
      return (parent, child) => {
        if (parent.tag === "collection" && child.tag === "collection") {
          const snapped = child.elements.map((element) => {
            if (element.tag !== "scalar") {
              return element
            }
            return {
              tag: "scalar",
              value: nearestScalarValue(parent, element.value),
            }
          })
          return {
            tag: "collection",
            mode: child.mode,
            elements: snapped,
          }
        }

        return cloneValue(child)
      }

    case "disallowed":
      return () => {
        throw new Error(`Disallowed binding: ${JSON.stringify(edge)}`)
      }

    case "joint-project":
    default:
      return (_parent, child) => cloneValue(child)
  }
}

function initializeGraphState(graph, initialState) {
  const state = {}

  for (const node of graph.nodes) {
    const componentId = node.component.id
    state[componentId] = state[componentId] ?? {}

    if (initialState?.[componentId]?.[node.anchorId] !== undefined) {
      state[componentId][node.anchorId] = cloneValue(initialState[componentId][node.anchorId])
      continue
    }

    state[componentId][node.anchorId] = cloneValue(node.component.anchors[node.anchorId])
  }

  return state
}

export function runBindingGraph(graph, initialState = {}) {
  const state = initializeGraphState(graph, initialState)
  const updates = []

  for (const edge of graph.edges) {
    const fromId = edge.from.component.id
    const toId = edge.to.component.id
    const fromAnchor = edge.from.anchorId
    const toAnchor = edge.to.anchorId
    const parentValue = state[fromId]?.[fromAnchor]
    const childValue = state[toId]?.[toAnchor]
    const update = compileEdge(edge)
    const nextChildValue = update(parentValue, childValue)

    state[toId] = state[toId] ?? {}
    state[toId][toAnchor] = nextChildValue
    updates.push({ edge, value: nextChildValue })
  }

  return {
    state,
    updates,
  }
}

export class StateExpr {
  constructor(kind, payload) {
    this.kind = kind
    this.payload = payload
  }

  static path(path) {
    return new StateExpr("path", path)
  }

  add(other) {
    return new StateExpr("binary", {
      op: "add",
      left: this,
      right: asExpr(other),
    })
  }

  subtract(other) {
    return new StateExpr("binary", {
      op: "subtract",
      left: this,
      right: asExpr(other),
    })
  }

  multiply(other) {
    return new StateExpr("binary", {
      op: "multiply",
      left: this,
      right: asExpr(other),
    })
  }

  divide(other) {
    return new StateExpr("binary", {
      op: "divide",
      left: this,
      right: asExpr(other),
    })
  }

  evaluate(state) {
    return evaluateExpr(this, state)
  }
}

function asExpr(value) {
  if (value instanceof StateExpr) {
    return value
  }
  return new StateExpr("const", value)
}

function readPath(state, path) {
  let cursor = state
  for (const segment of path) {
    if (!isObject(cursor) || !(segment in cursor)) {
      return undefined
    }
    cursor = cursor[segment]
  }
  return cursor
}

export function evaluateExpr(expr, state) {
  if (!(expr instanceof StateExpr)) {
    return asNumber(expr)
  }

  if (expr.kind === "const") {
    return asNumber(expr.payload)
  }

  if (expr.kind === "path") {
    return asNumber(readPath(state, expr.payload))
  }

  if (expr.kind === "binary") {
    const left = evaluateExpr(expr.payload.left, state)
    const right = evaluateExpr(expr.payload.right, state)

    switch (expr.payload.op) {
      case "add":
        return left + right
      case "subtract":
        return left - right
      case "multiply":
        return left * right
      case "divide":
        return right === 0 ? 0 : left / right
      default:
        return left
    }
  }

  return 0
}

function buildStateRefs(shape, path = []) {
  if (!isObject(shape)) {
    return StateExpr.path(path)
  }

  const output = {}
  for (const [key, value] of Object.entries(shape)) {
    output[key] = buildStateRefs(value, [...path, key])
  }
  return output
}

export function createStateRefs(shape) {
  return buildStateRefs(shape)
}

export function createStateFromShape(shape) {
  return cloneValue(shape)
}

export function tuple(...items) {
  if (items.length === 1 && Array.isArray(items[0])) {
    return {
      tag: "tuple",
      items: items[0],
    }
  }

  return {
    tag: "tuple",
    items,
  }
}

function evaluateNumeric(value, state) {
  if (value instanceof StateExpr) {
    return value.evaluate(state)
  }
  return asNumber(value)
}

function evaluateScalar(value, state) {
  if (isObject(value) && (value.tag === "scalar" || value.tag === "delta")) {
    return {
      tag: value.tag,
      value: evaluateNumeric(value.value, state),
    }
  }

  return {
    tag: "scalar",
    value: evaluateNumeric(value, state),
  }
}

function evaluateRange(value, state) {
  if (!isObject(value) || value.tag !== "range") {
    throw new Error("Expected range")
  }

  const lo = evaluateNumeric(value.lo, state)
  const hi = evaluateNumeric(value.hi, state)
  return {
    tag: "range",
    lo: Math.min(lo, hi),
    hi: Math.max(lo, hi),
  }
}

function evaluateTuple(value, state, context) {
  return value.items.map((item) => evaluateAnchorValue(item, state, context))
}

function evaluateCollectionSource(source, state, context) {
  if (isObject(source) && source.tag === "tuple") {
    return evaluateTuple(source, state, context)
  }

  if (Array.isArray(source)) {
    return source.map((item) => evaluateAnchorValue(item, state, context))
  }

  const evaluated = evaluateAnchorValue(source, state, context)
  if (isCollection(evaluated)) {
    return evaluated.elements
  }
  return [evaluated]
}

function normalizeEditRules(editRules) {
  if (!Array.isArray(editRules)) {
    return []
  }

  return editRules
    .filter((rule) => isObject(rule) && typeof rule.when === "string")
    .map((rule) => ({
      when: rule.when,
      do: Array.isArray(rule.do) ? rule.do : [rule.do],
    }))
}

export class CollectionAnchor {
  constructor(config) {
    this.source = config.source
    this.kind = config.kind ?? "independent"
    this.scope = config.scope ?? "none"
    this.cardinality = config.cardinality ?? "extensible"
    this.editRules = normalizeEditRules(config.editRules)
  }
}

export function evaluateAnchorValue(anchorDefinition, state, context = {}) {
  if (anchorDefinition instanceof CollectionAnchor) {
    const buffer = context.collectionBuffers?.[context.anchorId]
    if (buffer) {
      return {
        tag: "collection",
        mode: anchorDefinition.kind,
        elements: cloneValue(buffer),
      }
    }

    if (anchorDefinition.editRules.length > 0) {
      return {
        tag: "collection",
        mode: anchorDefinition.kind,
        elements: [],
      }
    }

    return {
      tag: "collection",
      mode: anchorDefinition.kind,
      elements: evaluateCollectionSource(anchorDefinition.source, state, context),
    }
  }

  if (anchorDefinition instanceof StateExpr) {
    return Scalar(anchorDefinition.evaluate(state))
  }

  if (typeof anchorDefinition === "number") {
    return Scalar(anchorDefinition)
  }

  if (!isObject(anchorDefinition)) {
    throw new Error("Unsupported anchor definition")
  }

  if (anchorDefinition.tag === "scalar" || anchorDefinition.tag === "delta") {
    return {
      tag: anchorDefinition.tag,
      value: evaluateNumeric(anchorDefinition.value, state),
    }
  }

  if (anchorDefinition.tag === "range") {
    return evaluateRange(anchorDefinition, state)
  }

  if (anchorDefinition.tag === "point") {
    return {
      tag: "point",
      x: evaluateScalar(anchorDefinition.x, state),
      y: evaluateScalar(anchorDefinition.y, state),
    }
  }

  if (anchorDefinition.tag === "box") {
    return {
      tag: "box",
      x: evaluateRange(anchorDefinition.x, state),
      y: evaluateRange(anchorDefinition.y, state),
    }
  }

  if (anchorDefinition.tag === "vsegment") {
    return {
      tag: "vsegment",
      x: evaluateScalar(anchorDefinition.x, state),
      y: evaluateRange(anchorDefinition.y, state),
    }
  }

  if (anchorDefinition.tag === "hsegment") {
    return {
      tag: "hsegment",
      x: evaluateRange(anchorDefinition.x, state),
      y: evaluateScalar(anchorDefinition.y, state),
    }
  }

  if (anchorDefinition.tag === "collection") {
    return {
      tag: "collection",
      mode: anchorDefinition.mode,
      elements: anchorDefinition.elements.map((element) => evaluateAnchorValue(element, state, context)),
    }
  }

  if (anchorDefinition.tag === "tuple") {
    return evaluateTuple(anchorDefinition, state, context)
  }

  throw new Error(`Unsupported anchor definition tag: ${anchorDefinition.tag}`)
}

export function resolveAnchors(anchorDefinitions, state, context = {}) {
  const output = {}

  for (const [anchorId, anchorDefinition] of Object.entries(anchorDefinitions ?? {})) {
    output[anchorId] = evaluateAnchorValue(anchorDefinition, state, {
      ...context,
      anchorId,
    })
  }

  return output
}

export function createComponentFromSchema(componentId, schema, state, context = {}) {
  return {
    id: componentId,
    anchors: resolveAnchors(schema.anchors, state, context),
  }
}

function parseEventExpression(logicalName, expression) {
  if (typeof expression !== "string") {
    return null
  }

  const trimmed = expression.trim().toLowerCase()
  if (!trimmed) {
    return null
  }

  const gatedMatch = /^\[\s*([^\],]+)\s*,\s*([^\]]+)\s*\]\s*>\s*([^\s]+)$/.exec(trimmed)
  if (gatedMatch) {
    return {
      logicalName,
      kind: "gated",
      start: gatedMatch[1].trim(),
      end: gatedMatch[2].trim(),
      event: gatedMatch[3].trim(),
      active: false,
    }
  }

  return {
    logicalName,
    kind: "direct",
    event: trimmed,
  }
}

function ensurePointerBranch(state, key) {
  state.pointer = state.pointer ?? {}
  state.pointer[key] = state.pointer[key] ?? { x: 0, y: 0 }
}

function extractPointPayload(payload) {
  if (!isObject(payload)) {
    return null
  }

  if (typeof payload.x === "number" && typeof payload.y === "number") {
    return { x: payload.x, y: payload.y }
  }

  if (typeof payload.clientX === "number" && typeof payload.clientY === "number") {
    return { x: payload.clientX, y: payload.clientY }
  }

  return null
}

function toActionList(actionOrActions) {
  if (Array.isArray(actionOrActions)) {
    return actionOrActions
  }
  return [actionOrActions]
}

export function createInteractionRuntime({ schema, initialState = {} }) {
  const eventSpecs = Object.entries(schema.events ?? {})
    .map(([logicalName, expression]) => parseEventExpression(logicalName, expression))
    .filter(Boolean)

  const listeners = new Map()
  const collectionBuffers = {}

  const runtime = {
    schema,
    state: cloneValue(initialState),

    on(logicalName, listener) {
      const bucket = listeners.get(logicalName) ?? new Set()
      bucket.add(listener)
      listeners.set(logicalName, bucket)
      return () => runtime.off(logicalName, listener)
    },

    off(logicalName, listener) {
      const bucket = listeners.get(logicalName)
      if (!bucket) {
        return
      }
      bucket.delete(listener)
      if (bucket.size === 0) {
        listeners.delete(logicalName)
      }
    },

    getRegisteredDomEvents() {
      const domEvents = new Set()
      for (const spec of eventSpecs) {
        if (spec.kind === "direct") {
          domEvents.add(spec.event)
        } else {
          domEvents.add(spec.start)
          domEvents.add(spec.event)
          domEvents.add(spec.end)
        }
      }
      return [...domEvents]
    },

    attach(target) {
      const handlers = new Map()
      for (const domEvent of runtime.getRegisteredDomEvents()) {
        const handler = (payload) => {
          runtime.emitDomEvent(domEvent, payload)
        }
        target.addEventListener(domEvent, handler)
        handlers.set(domEvent, handler)
      }

      return () => {
        for (const [domEvent, handler] of handlers.entries()) {
          target.removeEventListener(domEvent, handler)
        }
      }
    },

    emitDomEvent(domEventType, payload = {}) {
      const domEvent = String(domEventType).toLowerCase()
      const point = extractPointPayload(payload)

      if (point) {
        if (domEvent === "pointerdown") {
          ensurePointerBranch(runtime.state, "down")
          ensurePointerBranch(runtime.state, "move")
          runtime.state.pointer.down = point
          runtime.state.pointer.move = point
        } else if (domEvent === "pointermove") {
          ensurePointerBranch(runtime.state, "move")
          runtime.state.pointer.move = point
        } else if (domEvent === "pointerup") {
          ensurePointerBranch(runtime.state, "up")
          ensurePointerBranch(runtime.state, "move")
          runtime.state.pointer.up = point
          runtime.state.pointer.move = point
        }
      }

      for (const spec of eventSpecs) {
        if (spec.kind === "gated" && domEvent === spec.start) {
          spec.active = true
        }
      }

      const triggered = []
      for (const spec of eventSpecs) {
        if (spec.kind === "direct" && domEvent === spec.event) {
          triggered.push(spec.logicalName)
        }
        if (spec.kind === "gated" && domEvent === spec.event && spec.active) {
          triggered.push(spec.logicalName)
        }
      }

      for (const logicalName of triggered) {
        applyCollectionRules(logicalName)
        emitLogicalEvent(logicalName, {
          type: logicalName,
          domEvent,
          payload,
          state: cloneValue(runtime.state),
          anchors: runtime.getAnchors(),
        })
      }

      for (const spec of eventSpecs) {
        if (spec.kind === "gated" && domEvent === spec.end) {
          spec.active = false
        }
      }

      return triggered
    },

    getAnchors() {
      return resolveAnchors(schema.anchors, runtime.state, {
        collectionBuffers,
      })
    },

    getAnchor(anchorId) {
      return runtime.getAnchors()[anchorId]
    },

    getState() {
      return cloneValue(runtime.state)
    },
  }

  function emitLogicalEvent(logicalName, event) {
    const bucket = listeners.get(logicalName)
    if (!bucket) {
      return
    }
    for (const listener of bucket) {
      listener(event)
    }
  }

  function applyCollectionRules(logicalName) {
    for (const [anchorId, anchorDefinition] of Object.entries(schema.anchors ?? {})) {
      if (!(anchorDefinition instanceof CollectionAnchor) || anchorDefinition.editRules.length === 0) {
        continue
      }

      for (const rule of anchorDefinition.editRules) {
        if (rule.when !== logicalName) {
          continue
        }

        let buffer = collectionBuffers[anchorId] ? cloneValue(collectionBuffers[anchorId]) : []
        for (const action of toActionList(rule.do)) {
          if (!isObject(action)) {
            continue
          }

          if (action.clear) {
            buffer = []
          }

          if (action.insert) {
            const insertValues = evaluateCollectionSource(anchorDefinition.source, runtime.state, {
              collectionBuffers,
            })
            buffer.push(...insertValues)
          }
        }

        if (typeof anchorDefinition.cardinality === "number" && buffer.length > anchorDefinition.cardinality) {
          buffer = buffer.slice(buffer.length - anchorDefinition.cardinality)
        }

        collectionBuffers[anchorId] = buffer
      }
    }
  }

  return runtime
}

export const circleStateShape = {
  x: 0,
  y: 0,
  r: 1,
}

const circleState = createStateRefs(circleStateShape)

export const circleSchema = {
  state: {
    x: circleState.x,
    y: circleState.y,
    r: circleState.r,
  },
  anchors: {
    center: Point({
      x: circleState.x,
      y: circleState.y,
    }),
    top: Point({
      x: circleState.x,
      y: circleState.y.subtract(circleState.r),
    }),
    bottom: Point({
      x: circleState.x,
      y: circleState.y.add(circleState.r),
    }),
    left: Point({
      x: circleState.x.subtract(circleState.r),
      y: circleState.y,
    }),
    right: Point({
      x: circleState.x.add(circleState.r),
      y: circleState.y,
    }),
    box: Box({
      x1: circleState.x.subtract(circleState.r),
      y1: circleState.y.subtract(circleState.r),
      x2: circleState.x.add(circleState.r),
      y2: circleState.y.add(circleState.r),
    }),
  },
  paramAliases: {
    radius: "r",
  },
}

export const dragStateShape = {
  pointer: {
    down: { x: 0, y: 0 },
    move: { x: 0, y: 0 },
    up: { x: 0, y: 0 },
  },
}

const dragState = createStateRefs(dragStateShape)

export const dragSchema = {
  state: {
    pointer: {
      down: {
        x: dragState.pointer.down.x,
        y: dragState.pointer.down.y,
      },
      move: {
        x: dragState.pointer.move.x,
        y: dragState.pointer.move.y,
      },
      up: {
        x: dragState.pointer.up.x,
        y: dragState.pointer.up.y,
      },
    },
  },
  anchors: {
    current: Point({
      x: dragState.pointer.move.x,
      y: dragState.pointer.move.y,
    }),
    start: Point({
      x: dragState.pointer.down.x,
      y: dragState.pointer.down.y,
    }),
    delta: Point({
      x: dragState.pointer.move.x.subtract(dragState.pointer.down.x),
      y: dragState.pointer.move.y.subtract(dragState.pointer.down.y),
    }),
    end: Point({
      x: dragState.pointer.up.x,
      y: dragState.pointer.up.y,
    }),
    path: new CollectionAnchor({
      source: Point({
        x: dragState.pointer.move.x,
        y: dragState.pointer.move.y,
      }),
      kind: "independent",
      scope: "none",
      cardinality: "extensible",
      editRules: [
        {
          when: "start",
          do: [{ clear: true }, { insert: "end" }],
        },
        {
          when: "move",
          do: { insert: "end" },
        },
      ],
    }),
    span: new CollectionAnchor({
      source: tuple(
        Point({
          x: dragState.pointer.down.x,
          y: dragState.pointer.down.y,
        }),
        Point({
          x: dragState.pointer.move.x,
          y: dragState.pointer.move.y,
        })
      ),
      kind: "independent",
      scope: "none",
      cardinality: 2,
    }),
  },
  events: {
    start: "pointerdown",
    move: "[pointerdown, pointerup] > pointermove",
    end: "pointerup",
  },
}

export const compositionCatalog = [
  {
    id: "chart-brush",
    expression: "chart(bind: brush)",
    description: "Basic parent bounds limiting a brush extent.",
  },
  {
    id: "chart-grid-brush",
    expression: "chart(bind: grid(bind: brush))",
    description: "Chart bounds constrain grid/brush and gridlines snap brush position.",
  },
  {
    id: "scatter-lasso-detail",
    expression: "scatter(bind: lasso(bind: detailPane))",
    description: "Selection geometry controls downstream detail widgets.",
  },
  {
    id: "timeline-drag-range",
    expression: "timeline(bind: drag(bind: range))",
    description: "Drag gestures map to constrained timeline ranges.",
  },
]

export function listCompositions() {
  return compositionCatalog.map((entry) => ({ ...entry }))
}

export function createChartGridBrushDemo({
  chartBounds = Box({
    x: Range(0, 100),
    y: Range(0, 100),
  }),
  gridBounds = Box({
    x: Range(-20, 120),
    y: Range(-20, 120),
  }),
  gridLines = [10, 20, 30, 40],
  brushX = Scalar(23),
} = {}) {
  const chart = {
    id: "chart",
    anchors: {
      bounds: chartBounds,
    },
  }

  const grid = {
    id: "grid",
    anchors: {
      bounds: gridBounds,
      x: Collection(
        "independent",
        gridLines.map((value) => Scalar(value))
      ),
    },
  }

  const brush = {
    id: "brush",
    anchors: {
      x: brushX,
    },
  }

  const graph = buildBindingGraph([chart, grid, brush])
  const result = runBindingGraph(graph)

  return {
    chain: [chart, grid, brush],
    graph,
    result,
  }
}
