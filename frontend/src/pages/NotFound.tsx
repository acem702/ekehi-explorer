import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
      <svg width="64" height="64" viewBox="0 0 100 100" className="text-primary/30 mb-6">
        <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
          fill="none" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>
      </svg>
      <h1 className="text-6xl font-bold text-white mb-3">404</h1>
      <p className="text-muted mb-8 text-lg">This page doesn't exist on the Ekehi Network.</p>
      <div className="flex gap-3">
        <Link to="/" className="btn-primary">Back to Explorer</Link>
        <Link to="/blocks" className="btn-ghost">Latest Blocks</Link>
      </div>
    </div>
  );
}
