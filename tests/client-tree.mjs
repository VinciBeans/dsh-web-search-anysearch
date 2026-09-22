/**
 * Element-tree helpers for the client smoke test: the bundle is rendered with
 * a hand-rolled `createElement` stub, so the tree is plain objects.
 */

/**
 * Flatten one element or child list into every element it contains, calling
 * function components the way React would so a nested component's markup is
 * reachable.
 * @param node - an element, an array of them, or a primitive child.
 * @returns the elements found, depth-first.
 */
export function elementsOf(node) {
  if (Array.isArray(node)) return node.flatMap(elementsOf)
  if (node === null || typeof node !== 'object') return []
  if (typeof node.type !== 'function') {
    const children = node.props?.children
    return children === undefined ? [node] : [node, ...elementsOf(children)]
  }
  const resolved = node.type(node.props)
  if (resolved === null || resolved === undefined) return []
  if (Array.isArray(resolved)) return elementsOf(resolved)
  const children = resolved.props?.children
  return children === undefined ? [resolved] : [resolved, ...elementsOf(children)]
}

/**
 * Find the first element with the given class name.
 * @param node - the tree to search.
 * @param className - the exact `className` to match.
 * @returns the element, or undefined.
 */
export function byClass(node, className) {
  return elementsOf(node).find(element => element.props?.className === className)
}

/**
 * Find the first `<button>` whose text content equals `label`.
 * @param node - the tree to search.
 * @param label - the button's rendered label.
 * @returns the button element, or undefined.
 */
export function buttonByText(node, label) {
  return elementsOf(node).find(element => element.type === 'button' && textOf(element) === label)
}

/**
 * Read an element's text content.
 * @param node - an element, child list, or primitive.
 * @returns the concatenated text.
 */
export function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node === null || node === undefined || typeof node !== 'object') return String(node ?? '')
  return textOf(node.props?.children)
}
