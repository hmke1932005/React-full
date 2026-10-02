import { Component } from 'react';
import ServerError from '../pages/errors/ServerError';

/**
 * Wraps <Routes> in App.jsx. React error boundaries must be class
 * components (no hook equivalent). Any uncaught render error anywhere in
 * the tree now surfaces the same designed 500 page the rest of the app
 * uses for a backend 500, instead of an unstyled crash / blank screen.
 * "Try again" does a hard reload since React can't safely resume
 * rendering the subtree that threw.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ServerError onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
