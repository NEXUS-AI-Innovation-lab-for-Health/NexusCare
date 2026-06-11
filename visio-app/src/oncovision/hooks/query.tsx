import { type DefinedInitialDataOptions, type QueryKey, useQuery, type UseQueryResult } from "@tanstack/react-query";

export type FineQueryType<TData = unknown, TError = Error, TQueryKey extends QueryKey = QueryKey> =
    Partial<DefinedInitialDataOptions<TData, TError, TData, TQueryKey>> & { queryKey: TQueryKey };

export function useFineQuery<T>(config: FineQueryType<T | null>): UseQueryResult<T | null, Error> {
    return useQuery<T | null, Error>({
        ...config,
        retry: config.retry ?? false,
        refetchOnWindowFocus: config.refetchOnWindowFocus ?? false,
        refetchOnReconnect: config.refetchOnReconnect ?? false,
        refetchOnMount: config.refetchOnMount ?? false,
        staleTime: config.staleTime ?? 0,
        gcTime: config.gcTime ?? 0,
    });
}
