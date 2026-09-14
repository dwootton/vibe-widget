import * as React from "react";

/** Catches render-time throws from the generated widget and reports them upward. */
export default class RuntimeErrorBoundary extends React.Component {
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
