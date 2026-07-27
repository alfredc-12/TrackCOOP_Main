# Graphify

Graphify builds a local codebase knowledge graph for TrackCOOP. Use it first for architecture and relationship questions, then verify the relevant source files before making changes.

## Initial build

```powershell
graphify . --mode deep
```

If no semantic backend or API key is configured, use the local deterministic scan:

```powershell
graphify . --mode deep --code-only
```

## Open full graph

```powershell
Start-Process .\graphify-out\graph.html
```

## Ask the graph a question

```powershell
graphify query "Show the TrackCOOP authentication flow."
```

## Explain one node

```powershell
graphify explain "member_profiles"
```

## Trace a relationship

```powershell
graphify path "membership_applications" "member_profiles"
```

## Check automatic hooks

```powershell
graphify hook status
```

## Refresh after uncommitted changes

```powershell
graphify . --mode deep
```

Use the deterministic form when semantic documentation scanning is unavailable:

```powershell
graphify . --mode deep --code-only
```

## Refresh while editing

Run this in a separate terminal while coding:

```powershell
npm run graph:watch
```

The watcher refreshes the graph after supported code-file changes. Stop it with `Ctrl+C` when you are done coding.

## Refresh after pulling repository changes

Graphify's local Git hooks refresh the graph after commits, branch checkouts, merges, and pull-rebase rewrites. If hooks are missing after cloning or reinstalling Graphify, run:

```powershell
graphify hook install
```

Then reinstall the local pull hooks from this repository setup if needed.

## Refresh Graphify hooks after an upgrade

```powershell
graphify hook install
```

## Use Graphify from Codex chat

```text
$graphify . --mode deep
```

Codex should consult Graphify before broad repository searches, use `graphify explain` for one entity, use `graphify path` to trace relationships, and then inspect only the source files needed to verify the graph result.
