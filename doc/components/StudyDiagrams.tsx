import React from 'react';

type Status = 'now' | 'planned';

const Node = ({
  eyebrow,
  title,
  lines,
  accent = false,
}: {
  eyebrow: string;
  title: string;
  lines: string[];
  accent?: boolean;
}) => (
  <div
    className={`rounded-xl border-2 border-slate p-4 shadow-hard-sm sm:flex sm:items-center sm:gap-6 ${
      accent ? 'bg-orange/10' : 'bg-white'
    }`}
  >
    <div className="sm:w-56 shrink-0">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate/50">{eyebrow}</div>
      <div className="mt-1 font-display text-lg font-bold text-slate leading-tight">{title}</div>
    </div>
    <ul className="mt-2 sm:mt-0 space-y-1 text-xs font-mono text-slate/70 list-none p-0 m-0">
      {lines.map((line) => (
        <li key={line} className="m-0 p-0">{line}</li>
      ))}
    </ul>
  </div>
);

const Edge = ({ label, status }: { label: string; status: Status }) => (
  <div className="flex items-center gap-3 py-1 pl-6">
    <span
      aria-hidden="true"
      className={`text-xl leading-none ${status === 'now' ? 'text-orange' : 'text-slate/30'}`}
    >
      ↓
    </span>
    <span
      className={`text-[11px] font-mono leading-snug ${
        status === 'now' ? 'text-slate' : 'text-slate/50 italic'
      }`}
    >
      {label}
      {status === 'planned' && (
        <span className="ml-2 not-italic text-[10px] uppercase tracking-wider">planned</span>
      )}
    </span>
  </div>
);

/** Who is involved in a study and how a trace travels between them. */
export const StudyLoopDiagram = () => (
  <figure className="my-8 not-prose" aria-label="How a study trace travels from a domain collaborator to a vis researcher">
    <div className="flex flex-col gap-1">
      <Node
        eyebrow="Domain collaborator"
        title="Their own notebook"
        lines={['uses vibe_widget as usual', 'joins with the researcher\'s code', 'creates, edits, approves widgets']}
      />
      <Edge label="intents, code, errors" status="now" />
      <Node
        accent
        eyebrow="On their machine"
        title="Local trace log"
        lines={['.vibewidget/traces/<session>.jsonl', 'readable and pausable', 'deletable at any time']}
      />
      <Edge label="consented streams only" status="planned" />
      <Node
        eyebrow="Vis researcher"
        title="Study store + analysis"
        lines={['their own Supabase project', 'study.fetch() → DataFrame', 'lineage and replay views']}
      />
    </div>
    <figcaption className="mt-3 text-xs font-mono text-slate/50">
      The researcher sets up the study and shares a join code; nothing leaves the collaborator's
      machine until they agree to the study's consent card.
    </figcaption>
  </figure>
);

type Step = {
  kind: 'intent' | 'artifact' | 'error';
  label: string;
  detail: string;
};

const LINEAGE: Step[] = [
  { kind: 'intent', label: 'intent.create', detail: '"scatter of dose vs response"' },
  { kind: 'artifact', label: 'v1 · generated', detail: '212 lines' },
  { kind: 'intent', label: 'intent.grab_edit', detail: '<circle> "color by cohort"' },
  { kind: 'artifact', label: 'v2 · grab_edit', detail: 'parent v1' },
  { kind: 'error', label: 'error.runtime', detail: 'TypeError: cohort undefined' },
  { kind: 'artifact', label: 'v3 · autofix', detail: 'parent v2' },
  { kind: 'intent', label: 'intent.approve', detail: 'review mode' },
];

const STEP_STYLE: Record<Step['kind'], string> = {
  intent: 'bg-orange text-white border-slate',
  artifact: 'bg-white text-slate border-slate',
  error: 'bg-red-50 text-red-800 border-red-800',
};

/** One lineage: intents interleaved with the artifacts they produced. */
export const TraceLineage = () => (
  <figure className="my-8 not-prose" aria-label="Example trace lineage: intents, code versions and an error">
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-3 list-none p-0 m-0">
      {LINEAGE.map((step, i) => (
        <li key={step.label} className="flex items-center gap-1 m-0 p-0">
          <div className={`rounded-lg border-2 px-3 py-2 shadow-hard-sm ${STEP_STYLE[step.kind]}`}>
            <div className="text-[11px] font-mono font-bold">{step.label}</div>
            <div className="text-[11px] font-mono opacity-80">{step.detail}</div>
          </div>
          {i < LINEAGE.length - 1 && (
            <span aria-hidden="true" className="text-slate/40 font-mono">→</span>
          )}
        </li>
      ))}
    </ol>
    <figcaption className="mt-3 flex flex-wrap gap-4 text-xs font-mono text-slate/60">
      <span><span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm bg-orange border border-slate" />intent (what they asked for)</span>
      <span><span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm bg-white border border-slate" />artifact (code version)</span>
      <span><span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm bg-red-50 border border-red-800" />error</span>
    </figcaption>
  </figure>
);
