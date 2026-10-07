import { CITIZEN_STAGES, citizenStageLabel } from '../department/workflowLabels.js';

// Legacy fallback for reports created before the workflow stage existed.
const legacySteps = [['pending', 'Submitted'], ['verified', 'Verified'], ['assigned', 'Assigned'], ['in_progress', 'In Progress'], ['under_review', 'Under Review'], ['completed', 'Completed'], ['closed', 'Closed']];

const stageSteps = CITIZEN_STAGES.map((value) => [value, citizenStageLabel(value)]);

export default function ReportStatusTimeline({ status, stage, history = [] }) {
  const canonicalStage = ({ ACCEPTED: 'TEAM_FORMED', BLOCKED: 'IN_PROGRESS', ON_HOLD: 'IN_PROGRESS', DEPARTMENT_OFFICER_REVIEW: 'ASSIGNED_TO_DEPARTMENT_OFFICER', REOPENED: 'DEPARTMENT_HEAD_REVIEW' })[stage] || stage;
  const useStages = Boolean(canonicalStage) && CITIZEN_STAGES.includes(canonicalStage);
  const steps = useStages ? stageSteps : legacySteps;
  const current = steps.findIndex(([value]) => value === (useStages ? canonicalStage : status));
  const reachedAt = new Map(history.filter((item) => item?.stage).map((item) => [item.stage, item.at || item.timestamp]));
  return (
    <ol className="space-y-0">
      {steps.map(([value, label], index) => {
        const done = index < current;
        const active = index === current;
        const at = reachedAt.get(value);
        return (
          <li key={value} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`grid h-6 w-6 place-items-center rounded-full border text-xs font-bold ${done ? 'border-civic-600 bg-civic-600 text-white' : active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-300 dark:bg-slate-900'}`}>{done ? '✓' : active ? '●' : '○'}</span>
              {index < steps.length - 1 && <span className={`h-7 w-px ${done ? 'bg-civic-300' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            </div>
            <div className="pb-4">
              <p className={`text-sm font-bold ${done || active ? 'text-ink dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>{label}</p>
              {active && <p className="text-xs text-slate-500 dark:text-slate-400">Current stage{at ? ` · ${new Date(at).toLocaleString()}` : ''}</p>}
              {done && at && <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(at).toLocaleString()}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
