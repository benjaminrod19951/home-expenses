// Supabase returns at most 1000 rows per request (project default).
// Without paging, households with more history silently lost their oldest transactions
// from charts, comparisons and bank/card reconciliation.
//
// Usage: fetchAllRows(() => supabase.from("transactions").select("*").eq(...).order(...))
// The builder is a function because every page needs a fresh query object.
// Always include a unique column (id) in the ordering so pages never overlap.
export async function fetchAllRows(buildQuery, pageSize = 1000) {
    const all = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error)
            return { data: null, error };
        all.push(...(data || []));
        if (!data || data.length < pageSize)
            return { data: all, error: null };
    }
}
