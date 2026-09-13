export function KeyBadge({ keyContent }: { keyContent: string }) {
  return (
    <div className="key-badge">
      <p className="key-badge-title">You hold the key</p>
      <p className="key-badge-content">&ldquo;{keyContent}&rdquo;</p>
      <p className="hint-text">
        Share it inside a private conversation if you dare - once given, it's gone.
      </p>
    </div>
  );
}
