import { compareReports, frameworkLabel } from '@hono/agent-dx/report'
import {
  type AdoptionReport,
  type AgentDxReport,
  type ProficiencyReport,
  isAdoptionReport,
  isProficiencyReport,
} from '@hono/agent-dx/schema'
import type { FC } from 'hono/jsx'

const STYLE = `
:root { color-scheme: light dark; }
body {
  font-family: ui-sans-serif, system-ui, sans-serif;
  max-width: 46rem;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  line-height: 1.6;
}
h1 { margin-bottom: 0.25rem; }
.tagline { color: #666; margin-top: 0; }
section { margin-top: 2.5rem; }
table { border-collapse: collapse; margin: 0.5rem 0 1rem; }
th, td { text-align: left; padding: 0.25rem 1rem 0.25rem 0; border-bottom: 1px solid #ddd; }
td.num, th.num { text-align: right; }
.meta { color: #666; font-size: 0.875rem; }
.empty { color: #666; font-style: italic; }
@media (prefers-color-scheme: dark) {
  .tagline, .meta, .empty { color: #999; }
  th, td { border-bottom-color: #333; }
}
`

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

const ReportMeta: FC<{ report: AgentDxReport }> = ({ report }) => (
  <p class="meta">
    {formatDate(report.finishedAt)} · model: {report.model} · runs:{' '}
    {report.runs}
    {report.variant ? ` · variant: ${report.variant}` : ''}
  </p>
)

const AdoptionSection: FC<{ reports: AdoptionReport[] }> = ({ reports }) => {
  const latest = reports[0]
  return (
    <section>
      <h2>Adoption</h2>
      <p>Do coding agents choose Hono?</p>
      {latest ? (
        <>
          <h3>
            Latest: {latest.runtime}
            {latest.scenario ? ` · ${latest.scenario}` : ''}
          </h3>
          <ReportMeta report={latest} />
          <table>
            <thead>
              <tr>
                <th>Framework</th>
                <th class="num">Share</th>
                <th class="num">Runs</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(latest.summary.counts)
                .sort((a, b) => b[1] - a[1])
                .map(([framework, count]) => (
                  <tr>
                    <td>{frameworkLabel(framework)}</td>
                    <td class="num">{percent(count / latest.runs)}</td>
                    <td class="num">
                      {count}/{latest.runs}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p>
            <strong>
              Hono adoption: {percent(latest.summary.honoAdoption)}
            </strong>
          </p>
        </>
      ) : (
        <p class="empty">No adoption results yet.</p>
      )}
    </section>
  )
}

const ProficiencySection: FC<{ reports: ProficiencyReport[] }> = ({
  reports,
}) => (
  <section>
    <h2>Proficiency</h2>
    <p>How effectively do coding agents use Hono?</p>
    {reports.length > 0 ? (
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Date</th>
            <th>Model</th>
            <th class="num">Runs</th>
            <th class="num">Success rate</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr>
              <td>{report.task}</td>
              <td>{formatDate(report.finishedAt)}</td>
              <td>{report.model}</td>
              <td class="num">{report.runs}</td>
              <td class="num">{percent(report.summary.successRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p class="empty">No proficiency results yet.</p>
    )}
  </section>
)

/** Pair reports labeled baseline/candidate within the same suite. */
function findExperiments(reports: AgentDxReport[]) {
  const groups = new Map<string, AgentDxReport[]>()
  for (const report of reports) {
    if (!report.variant) continue
    const subject = isAdoptionReport(report) ? report.runtime : report.task
    const key = `${report.suite}:${subject}:${report.target ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), report])
  }
  const experiments = []
  for (const group of groups.values()) {
    const baseline = group.find((r) => r.variant === 'baseline')
    const candidate = group.find((r) => r.variant === 'candidate')
    if (baseline && candidate)
      experiments.push(compareReports(baseline, candidate))
  }
  return experiments
}

const ExperimentsSection: FC<{ reports: AgentDxReport[] }> = ({ reports }) => {
  const experiments = findExperiments(reports)
  return (
    <section>
      <h2>Experiments</h2>
      <p>Do changes to Hono CLI, Skills, Docs, or Core improve Agent DX?</p>
      {experiments.length > 0 ? (
        experiments.map((experiment) => (
          <>
            <h3>
              {experiment.suite} ({experiment.subject})
            </h3>
            <p class="meta">model: {experiment.model}</p>
            <table>
              <thead>
                <tr>
                  <th />
                  <th class="num">Baseline</th>
                  <th class="num">Candidate</th>
                  <th class="num">Change</th>
                </tr>
              </thead>
              <tbody>
                {experiment.rows.map((row) => (
                  <tr>
                    <td>{row.label}</td>
                    <td class="num">{row.baseline}</td>
                    <td class="num">{row.candidate}</td>
                    <td class="num">{row.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ))
      ) : (
        <p class="empty">No experiment results yet.</p>
      )}
    </section>
  )
}

export const Page: FC<{ reports: AgentDxReport[] }> = ({ reports }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Hono Agent DX</title>
      <meta
        name="description"
        content="Measure and improve the developer experience of coding agents using Hono."
      />
      <style>{STYLE}</style>
    </head>
    <body>
      <h1>Hono Agent DX</h1>
      <p class="tagline">
        Measure and improve the developer experience of coding agents using
        Hono.
      </p>
      <AdoptionSection reports={reports.filter(isAdoptionReport)} />
      <ProficiencySection reports={reports.filter(isProficiencyReport)} />
      <ExperimentsSection reports={reports} />
      <section>
        <p class="meta">
          <a href="https://github.com/honojs/agent-dx">GitHub</a> ·{' '}
          <a href="https://www.npmjs.com/package/@hono/agent-dx">npm</a>
        </p>
      </section>
    </body>
  </html>
)
