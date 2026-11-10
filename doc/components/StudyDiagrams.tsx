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

type Transition = {
  /** What produced the next version: a person's request, or an error the system repaired. */
  kind: 'intent' | 'error';
  event: string;
  detail: string;
};

type Version = {
  id: string;
  origin: string;
  detail: string;
  /** The transition that produced this version. */
  from: Transition;
};

const LINEAGE: Version[] = [
  {
    id: 'v1',
    origin: 'generated',
    detail: '212 lines',
    from: { kind: 'intent', event: 'intent.create', detail: '"scatter of dose vs response"' },
  },
  {
    id: 'v2',
    origin: 'grab_edit',
    detail: 'parent v1',
    from: { kind: 'intent', event: 'intent.grab_edit', detail: '<circle> "color by cohort"' },
  },
  {
    id: 'v3',
    origin: 'autofix',
    detail: 'parent v2',
    from: { kind: 'error', event: 'error.runtime → autofix', detail: 'TypeError: cohort undefined' },
  },
];

const EDGE_STYLE: Record<Transition['kind'], { text: string; arrow: string }> = {
  intent: { text: 'text-slate', arrow: 'text-orange' },
  error: { text: 'text-red-800', arrow: 'text-red-700' },
};

/** The request (or error) that leads into a version. Vertical on phones, horizontal from sm up. */
const TransitionEdge = ({ t }: { t: Transition }) => {
  const style = EDGE_STYLE[t.kind];
  return (
    <div className="flex sm:flex-col items-center sm:justify-center gap-3 sm:gap-1 py-2 sm:py-0 sm:px-2 pl-6 sm:pl-2 sm:min-w-0 sm:flex-1">
      <span aria-hidden="true" className={`text-2xl leading-none sm:order-2 ${style.arrow}`}>
        <span className="sm:hidden">↓</span>
        <span className="hidden sm:inline">→</span>
      </span>
      <div className={`text-[11px] font-mono leading-snug sm:text-center sm:order-1 ${style.text}`}>
        <div className="font-bold break-words">{t.event}</div>
        <div className="opacity-80 break-words">{t.detail}</div>
      </div>
    </div>
  );
};

/** One lineage: each code version is a node, and the request that produced it is the arrow into it. */
export const TraceLineage = () => (
  <figure className="my-8 not-prose" aria-label="Example trace lineage: three code versions and the requests and error that produced them">
    <ol className="flex flex-col sm:flex-row sm:items-center list-none p-0 m-0">
      {LINEAGE.map((v) => (
        <li key={v.id} className="flex flex-col sm:flex-row sm:items-center sm:flex-1 m-0 p-0">
          <TransitionEdge t={v.from} />
          <div className="rounded-lg border-2 border-slate bg-white px-4 py-3 shadow-hard-sm sm:shrink-0">
            <div className="font-display text-lg font-bold text-slate leading-none">{v.id}</div>
            <div className="mt-1 text-[11px] font-mono text-slate">{v.origin}</div>
            <div className="text-[11px] font-mono text-slate/60">{v.detail}</div>
          </div>
        </li>
      ))}
    </ol>
    <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-slate/60">
      <span><span className="inline-block w-3 h-3 align-middle mr-1 rounded-sm bg-white border border-slate" />code version (artifact)</span>
      <span><span className="text-orange mr-1">→</span>request that produced it (intent)</span>
      <span><span className="text-red-700 mr-1">→</span>error the system repaired</span>
    </figcaption>
  </figure>
);
