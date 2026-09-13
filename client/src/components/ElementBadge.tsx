import { getElement, type ElementId } from "@last-stand/shared";

export function ElementBadge({ element }: { element: ElementId }) {
  const definition = getElement(element);

  return (
    <div className="element-badge" style={{ borderColor: definition.color }}>
      <span className="element-badge-dot" style={{ background: definition.color }} />
      You are <strong style={{ color: definition.color }}>{definition.name}</strong>
    </div>
  );
}
