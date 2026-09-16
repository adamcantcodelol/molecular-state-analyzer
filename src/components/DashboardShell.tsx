import type { ImportedDataset } from '../types/dataset'
import type { Project } from '../types/project'
import { DatasetList } from './DatasetList'
import { HmmPanel } from './HmmPanel'
import { BootstrapPanel } from './BootstrapPanel'
import { ModelComparePanel } from './ModelComparePanel'
import { ImportPanel } from './ImportPanel'
import { SyntheticGeneratorPanel } from './SyntheticGeneratorPanel'
import { MolecularViewerPanel } from './MolecularViewerPanel'
import { ConditionsPanel } from './ConditionsPanel'
import { HypothesesPanel } from './HypothesesPanel'
import { SmFretPanel } from './SmFretPanel'
import { MultimodalPanel } from './MultimodalPanel'
import { StatsDashboardPanel } from './StatsDashboardPanel'
import { ExperimentPlannerPanel } from './ExperimentPlannerPanel'
import { NotebookPanel } from './NotebookPanel'
import { OptionalAiPanel } from './OptionalAiPanel'
import { PerfNotesPanel } from './PerfNotesPanel'
import { RawDataExplorer } from './RawDataExplorer'

type Props = {
  project: Project
  onBack: () => void
  onSave: () => Promise<void>
  onAddDataset: (dataset: ImportedDataset) => Promise<void>
  onRemoveDataset: (id: string) => Promise<void>
  /** Persist project (e.g. HMM runs under state) without inventing analysis claims. */
  onPersistProject: (project: Project) => Promise<void>
  saving?: boolean
  importing?: boolean
  removingId?: string | null
  saveMessage?: string | null
}

export function DashboardShell({
  project,
  onBack,
  onSave,
  onAddDataset,
  onRemoveDataset,
  onPersistProject,
  saving = false,
  importing = false,
  removingId = null,
  saveMessage = null,
}: Props) {
  const datasets = project.datasets ?? []

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-brand">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
            ← Projects
          </button>
          <div>
            <p className="eyebrow">Molecular State Analyzer</p>
            <h1 className="dash-title">{project.name}</h1>
          </div>
        </div>
        <div className="row actions">
          {saveMessage && <span className="muted small">{saveMessage}</span>}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSave()}
            disabled={saving || importing}
          >
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
      </header>

      <main className="dash-main">
        <ImportPanel onCommit={onAddDataset} busy={importing || saving} />

        <section className="panel" aria-labelledby="datasets-heading">
          <div className="panel-head">
            <h2 id="datasets-heading" className="panel-title">
              Imported datasets
            </h2>
            <span className="muted small">
              {datasets.length} in this project
            </span>
          </div>
          <DatasetList
            datasets={datasets}
            onRemove={(id) => void onRemoveDataset(id)}
            removingId={removingId}
          />
        </section>

        <RawDataExplorer datasets={datasets} />

        <StatsDashboardPanel project={project} />

        <ExperimentPlannerPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <NotebookPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <OptionalAiPanel project={project} />

        <PerfNotesPanel />

        <MolecularViewerPanel datasets={datasets} />

        <HmmPanel
          project={project}
          datasets={datasets}
          onPersistRun={onPersistProject}
          persisting={saving}
        />

        <ModelComparePanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <BootstrapPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <ConditionsPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <HypothesesPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <SmFretPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <MultimodalPanel
          project={project}
          datasets={datasets}
          onPersist={onPersistProject}
          persisting={saving || importing}
        />

        <SyntheticGeneratorPanel
          onAddDataset={onAddDataset}
          busy={importing || saving}
        />

        <section className="panel dash-meta" aria-labelledby="shell-heading">
          <h2 id="shell-heading" className="panel-title">
            Project details
          </h2>
          <p className="muted">
            Phases 4–15: Gaussian HMM (Baum–Welch + Viterbi) in a Web Worker,
            K=2 vs K=3 AIC/BIC comparison, moving-block bootstrap uncertainty,
            a seeded SYNTHETIC HMM generator, a display-only Mol* 3D viewer
            for PDB/mmCIF, experimental condition metadata and{' '}
            <strong>user hypotheses</strong> (never evidence / never auto-proven),
            plus an <strong>smFRET</strong> panel (E_FRET vs time; optional HMM
            on E_FRET only — statistical latent states, never structural),
            <strong>multimodal links</strong> (structure + time-series /
            conditions bundles with side-by-side or tabbed comparison —
            linking ≠ joint inference; modalities stay distinct), a
            read-only <strong>statistics dashboard</strong> that summarizes
            persisted HMM / AIC-BIC / bootstrap / smFRET runs with provenance
            (no biophysical overclaiming), an{' '}
            <strong>experimental design planner</strong> that drafts
            conditions × replicates × measurements as suggestions only
            (not prescriptions; does not guarantee power or significance),
            a <strong>lab notebook</strong> with append-only versioned
            notes, project version snapshots, and research report export
            that keeps Observations / Inferences / User hypotheses distinct,
            and an <strong>optional AI assistant</strong> (free/stub only —
            no paid cloud LLM; non-authoritative; never invents results or
            overwrites analyses). Latent states are unsupervised statistical
            indices — not biophysical names. Synthetic datasets are always
            labeled SYNTHETIC and never presented as experimental. Imported{' '}
            <code>originalText</code> is never mutated;
            runs/comparisons/bootstraps/conditions/hypotheses/smFRET HMM /
            multimodalLinks/experimentPlans/notebookEntries/projectVersions
            live under <code>project.state</code>. The 3D viewer reads
            originals for display only; the stats dashboard is read-only;
            planner drafts are labeled Suggestion / draft; notebook edits
            append versions rather than rewriting history; the AI panel is
            optional and separate from scientific engines.
          </p>
          <dl className="meta-grid">
            <div>
              <dt>Project ID</dt>
              <dd>
                <code>{project.id}</code>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(project.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Last saved</dt>
              <dd>{new Date(project.updatedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>IndexedDB (this browser)</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  )
}
