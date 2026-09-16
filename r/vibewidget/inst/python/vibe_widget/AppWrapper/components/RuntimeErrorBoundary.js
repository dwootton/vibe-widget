const cache = new WeakMap();

/**
 * Builds the boundary that catches render-time throws from the generated widget
 * and reports them upward. It is a factory, not a class: a boundary only guards
 * a tree rendered by the same React instance that defined it, and guest trees
 * run under the page-wide instance rather than this bundle's copy.
 */
export function makeErrorBoundary(React) {
  const cached = cache.get(React);
  if (cached) return cached;

  class RuntimeErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
      return { error };
    }

    componentDidCatch(err, info) {
      const componentStack = info && info.componentStack
        ? `\n\nComponent stack:\n${info.componentStack}`
        : "";
      if (this.props.onError) {
        this.props.onError(err, componentStack);
      }
    }

    componentDidUpdate(prevProps) {
      if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
        this.setState({ error: null });
      }
    }

    render() {
      if (this.state.error) {
        return this.props.fallback || null;
      }
      return this.props.children;
    }
  }

  cache.set(React, RuntimeErrorBoundary);
  return RuntimeErrorBoundary;
}
