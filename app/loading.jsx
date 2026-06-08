import DelayedLoadingState from '@/components/shared/DelayedLoadingState';

export default function RootLoading() {
  return <DelayedLoadingState loading fullScreen message="Loading the next page..." />;
}
