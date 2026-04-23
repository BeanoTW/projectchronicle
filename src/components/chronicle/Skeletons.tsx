import { Skeleton } from '@/components/ui/skeleton';

/** Content-shaped skeleton for the Timeline list (compact rows). */
export const TimelineSkeleton = () => (
  <div className="px-5 space-y-5" aria-hidden="true">
    {[0, 1].map(group => (
      <div key={group}>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="space-y-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="rounded-lg border border-border border-l-[5px] border-l-muted bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/** Content-shaped skeleton for the Incident detail screen card. */
export const IncidentDetailSkeleton = () => (
  <div className="min-h-screen bg-background pb-20" aria-hidden="true">
    <div className="bg-card border-b border-border px-5 pt-4 pb-3">
      <Skeleton className="h-4 w-12" />
    </div>
    <div className="px-5 pt-5 space-y-4">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
          <Skeleton className="h-3 w-24" />
          <div className="text-right space-y-1">
            <Skeleton className="h-3.5 w-28 ml-auto" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
        </div>
        <div className="px-4 py-2.5 border-b border-border/50 space-y-1.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="px-4 py-3 space-y-4">
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
          <div>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-3 w-24 mb-2" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
);
