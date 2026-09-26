# v24.29

Workspace stability release.

- Prevents stale/asynchronous loads from switching the UI back to an older workspace.
- Every save/reload operation now reloads the current workspace explicitly.
- Quick entry captures the workspace ID before saving and saves all rows to that exact workspace.
- Background refreshes inside the same workspace no longer replace the whole app with the loading screen.
- Switching workspaces closes quick entry so a draft cannot accidentally cross workspaces.
- Keeps separate quick-entry drafts per workspace.
- No SQL migration required.
