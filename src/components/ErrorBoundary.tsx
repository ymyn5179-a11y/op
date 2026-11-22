import React from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { NonoCharacter } from './NonoCharacter';
import { NonoLandLogo } from './NonoLandLogo';
import { Language } from '../types/nonoland';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  language?: Language;
  onResetHome?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[NonoLand ErrorBoundary]', error.message, errorInfo.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const lang = this.props.language || 'ar';
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="nono-card max-w-md w-full p-6 bg-white text-center space-y-4">
          <div className="flex justify-center">
            <NonoLandLogo variant="compact" size="sm" language={lang} />
          </div>
          <div className="flex justify-center">
            <NonoCharacter mood="encouraging" size="lg" />
          </div>
          <h2 className="text-xl font-extrabold text-[#27345C]">
            {lang === 'ar' ? 'تعثّر بسيط في المغامرة!' : 'A tiny adventure hiccup!'}
          </h2>
          <p className="text-sm font-bold text-[#27345C]/70">
            {lang === 'ar'
              ? 'لا تقلق، بياناتك ونجومك محفوظة بأمان. لنرجع معاً إلى الصفحة الرئيسية.'
              : 'Do not worry — your progress and stars are safely saved. Let us hop back home.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                this.props.onResetHome?.();
              }}
              className="min-h-[44px] px-5 rounded-2xl bg-[#8054D9] text-white font-extrabold flex items-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>{lang === 'ar' ? 'العودة للرئيسية' : 'Back Home'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 rounded-2xl bg-slate-100 text-[#27345C] font-extrabold flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{lang === 'ar' ? 'تحديث' : 'Reload'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
