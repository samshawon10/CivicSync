import { Component } from 'react';
import Icon from './Icon.jsx';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('CivicSync UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900"><section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-lg" role="alert"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-700"><Icon name="alertCircle" size={24} /></span><h1 className="mt-4 text-xl font-bold">Something went wrong</h1><p className="mt-2 text-sm leading-6 text-slate-600">CivicSync could not render this view. Reload the page to try again. If the problem continues, contact an administrator.</p><button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-civic-600 px-4 py-2 text-sm font-bold text-white">Reload page</button></section></main>;
  }
}
