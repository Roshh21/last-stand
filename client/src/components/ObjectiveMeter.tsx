import type { ObjectiveStateDTO } from "@last-stand/shared";

export function ObjectiveMeter({ objective }: { objective: ObjectiveStateDTO }) {
  const percent =
    objective.requiredTasks > 0
      ? Math.min(100, Math.round((objective.completedTasks / objective.requiredTasks) * 100))
      : 0;

  return (
    <div className="objective-meter">
      <div className="objective-meter-header">
        <span>Team objective</span>
        <span>
          {objective.completedTasks} / {objective.requiredTasks} tasks
        </span>
      </div>
      <div className="task-progress-track">
        <div className="task-progress-fill objective-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
