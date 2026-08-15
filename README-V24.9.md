# v24.9

- Reconciliation no longer excludes credit-card rows after manual category edits (`manual_override`). Category edits cannot break Visa settlement matching.
- Card-file integrity checks are batch-wide, not transaction-month vs charge-month comparisons. False June/July ~11k gaps are removed.
- Data Check only raises issues that can affect totals: unmatched bank card debits, genuinely empty imported batches, or category-total mismatch.
- Known electricity/water/gas merchants use a two-month rolling monthly-equivalent for trend percentages. Actual paid expense totals are unchanged.
- Comparison table and Insights show the two-month monthly-equivalent for periodic utilities.
