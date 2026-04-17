'use client';

import { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center">
                    <div className="terminal-window max-w-lg w-full">
                        <div className="terminal-header">
                            <div className="terminal-dot bg-red-500" />
                            <div className="terminal-dot bg-yellow-500" />
                            <div className="terminal-dot bg-green-500" />
                            <span className="ml-4 text-xs text-terminal-muted font-mono">error</span>
                        </div>
                        <div className="p-6">
                            <h2 className="text-terminal-green font-mono text-lg mb-2">
                                Something went wrong
                            </h2>
                            <p className="text-terminal-muted font-mono text-sm mb-4">
                                {this.state.error?.message ?? 'An unexpected error occurred.'}
                            </p>
                            <button
                                onClick={() => this.setState({ hasError: false, error: null })}
                                className="btn-primary text-sm"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
