export type CollectionState = "loading" | "error" | "empty" | "ready";

export function getCollectionState({
  isLoading,
  isError,
  count,
}: {
  isLoading: boolean;
  isError: boolean;
  count: number;
}): CollectionState {
  if (isLoading) return "loading";
  if (isError) return "error";
  if (count === 0) return "empty";
  return "ready";
}
