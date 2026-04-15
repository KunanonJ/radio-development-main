export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="app-page space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <p className="surface-1 text-sm text-muted-foreground rounded-lg border border-border p-4">
        Placeholder route — port UI from <code className="font-mono text-xs">src/pages/app/*</code> and wire
        Firestore per <code className="font-mono text-xs">docs/MIGRATION-NEXT-FIREBASE.md</code>.
      </p>
    </div>
  );
}
