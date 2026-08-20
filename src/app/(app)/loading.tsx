import { CardSkeleton, Skeleton, TableSkeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-2 h-7 w-64" />
      <Skeleton className="mb-6 h-4 w-96" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} height={96} />
        ))}
      </div>
      <TableSkeleton rows={7} cols={6} />
    </div>
  );
}
