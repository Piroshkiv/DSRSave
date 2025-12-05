import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorPage } from './ErrorPage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: 'notFound' | 'redirect' | 'general';
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'general'
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if error is related to redirects
    const isRedirectError =
      error.message.includes('redirect') ||
      error.message.includes('ERR_TOO_MANY_REDIRECTS') ||
      error.name === 'NavigationError';

    return {
      hasError: true,
      error,
      errorType: isRedirectError ? 'redirect' : 'general'
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          errorType={this.state.errorType}
          message={this.state.error?.message}
        />
      );
    }

    return this.props.children;
  }
}
