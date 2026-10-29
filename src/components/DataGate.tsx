import type { ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { ErrorState, PageSkeleton } from './ui';

/**
 * Holds back content that depends on the signed-in user's data (orders, enquiries, saved centres…)
 * or the marketplace listings until it has loaded. Shows placeholders meanwhile, so pages never
 * flash an empty state like "No orders yet" before the real data arrives.
 */
export function DataGate({ children, skeleton = <PageSkeleton /> }: { children: ReactNode; skeleton?: ReactNode }) {
  const { dataStatus, dataError, retryData } = useApp();
  if (dataStatus === 'loading') return <>{skeleton}</>;
  if (dataStatus === 'error') return <div className="card"><ErrorState error={dataError} onRetry={retryData} title="We couldn’t load your data" /></div>;
  return <>{children}</>;
}
