# v24.31

Import safety release.

- Bank imports can update only existing bank (`עו״ש`) rows.
- Card imports can update only existing card (`אשראי`) rows.
- Manual (`ידני`) rows are never candidates for import overwrite.
- Reconciliation updates are constrained by household and expected source.
- No SQL migration required.
