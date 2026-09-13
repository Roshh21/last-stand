import { getElement, isTaskCooperative, type ElementId, type TaskStateDTO } from "@last-stand/shared";

import { gameClient } from "../net/useGameClient.js";

interface TaskCardProps {
  task: TaskStateDTO;
  myElement: ElementId;
  onCooldown: boolean;
}

export function TaskCard({ task, myElement, onCooldown }: TaskCardProps) {
  const percent = Math.min(100, Math.round((task.progress / task.completionThreshold) * 100));
  const qualifies = task.requiredElements.includes(myElement);
  const cooperative = isTaskCooperative(task);

  return (
    <div className="task-card" data-completed={task.completed}>
      <div className="task-card-header">
        <span className="task-name">{task.name}</span>
        {task.completed && <span className="badge ready">Done</span>}
      </div>

      <div className="task-progress-track">
        <div className="task-progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="task-meta">
        <span className="hint-text">Needs:</span>
        {task.requiredElements.map((elementId) => {
          const definition = getElement(elementId);

          return (
            <span
              key={elementId}
              className="badge"
              style={{ borderColor: definition.color, color: definition.color }}
            >
              {definition.name}
            </span>
          );
        })}
        {cooperative && (
          <span className="badge">
            {task.minContributors}+ people, {task.requiredDistinctElements}+ elements here at once
          </span>
        )}
        {qualifies && !task.completed && <span className="badge ready">You qualify</span>}
      </div>

      {!task.completed && (
        <button className="button" disabled={onCooldown} onClick={() => gameClient.useAbility("task", task.id)}>
          {onCooldown ? "Recharging…" : "Use ability here"}
        </button>
      )}
    </div>
  );
}
