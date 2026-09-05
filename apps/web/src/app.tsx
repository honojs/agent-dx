import { compareReports, frameworkLabel } from '@hono/agent-dx/report'
import {
  type AdoptionReport,
  type AgentDxReport,
  type PracticalReport,
  isAdoptionReport,
  isPracticalReport,
} from '@hono/agent-dx/schema'
import { Style, css } from 'hono/css'
import type { Child, FC, PropsWithChildren } from 'hono/jsx'

const bodyClass = css`
  color-scheme: light dark;
  --accent: #ff5b11;
  --fg: #1c1917;
  --muted: #78716c;
  --line: #e7e5e4;
  --card: #fafaf9;
  --good: #16a34a;
  font-family: ui-sans-serif, system-ui, sans-serif;
  color: var(--fg);
  max-width: 52rem;
  margin: 0 auto;
  padding: 2.5rem 1.25rem 5rem;
  line-height: 1.65;
  @media (prefers-color-scheme: dark) {
    --fg: #e7e5e4;
    --muted: #a8a29e;
    --line: #292524;
    --card: #1c1917;
    --good: #4ade80;
  }
  a {
    color: var(--accent);
  }
`

const headerClass = css`
  h1 {
    margin: 0;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
  }
  h1 a {
    color: inherit;
    text-decoration: none;
  }
  p {
    color: var(--muted);
    margin: 0.25rem 0 0;
  }
`

const sectionClass = css`
  margin-top: 3rem;
  h2 {
    font-size: 1.15rem;
    margin: 0 0 0.1rem;
    padding-left: 0.6rem;
    border-left: 3px solid var(--accent);
  }
  h3 {
    font-size: 0.95rem;
    margin: 1.5rem 0 0.25rem;
  }
`

const ledeClass = css`
  color: var(--muted);
  margin: 0 0 1rem;
  font-size: 0.925rem;
`

const tableClass = css`
  border-collapse: collapse;
  width: 100%;
  margin: 0.5rem 0 0.75rem;
  font-size: 0.925rem;
  th,
  td {
    text-align: left;
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--line);
  }
  th {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.8rem;
  }
  th.num,
  td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  th.cell,
  td.cell {
    text-align: center;
  }
`

const pctClass = css`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--accent);
`

const pctZeroClass = css`
  font-variant-numeric: tabular-nums;
  color: var(--muted);
`

const whoClass = css`
  display: block;
  color: var(--muted);
  font-size: 0.75rem;
`

const metaClass = css`
  color: var(--muted);
  font-size: 0.85rem;
  margin: 0.1rem 0 0.75rem;
`

const emptyClass = css`
  color: var(--muted);
  font-style: italic;
  background: var(--card);
  border: 1px dashed var(--line);
  border-radius: 8px;
  padding: 0.9rem 1rem;
`

const footerClass = css`
  margin-top: 4rem;
  color: var(--muted);
  font-size: 0.85rem;
`

const RUNTIME_ORDER = ['cloudflare-workers', 'bun', 'node-js', 'deno']
const SCENARIO_ORDER = ['minimal', 'routes', 'api', 'framework']

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

function ordered(found: string[], order: string[]): string[] {
  const known = order.filter((name) => found.includes(name))
  const rest = found.filter((name) => !order.includes(name)).sort()
  return [...known, ...rest]
}

/** Most-chosen framework and its share, for the matrix cell footnote. */
function topFramework(report: AdoptionReport): string {
  const entries = Object.entries(report.summary.counts)
  entries.sort((a, b) => b[1] - a[1])
  const top = entries[0]
  if (!top) {
    return '—'
  }
  return `${frameworkLabel(top[0])} ${percent(top[1] / report.runs)}`
}

const cellLinkClass = css`
  display: block;
  text-decoration: none;
  color: inherit;
`

const AdoptionCell: FC<{
  runtime: string
  scenario: string
  report?: AdoptionReport
}> = ({ runtime, scenario, report }) => {
  if (!report) {
    return <td class='cell'>·</td>
  }
  const rate = report.summary.honoAdoption
  return (
    <td
      class='cell'
      style={rate > 0 ? `background: rgba(255, 91, 17, ${0.05 + rate * 0.12})` : ''}
      title={`${formatDate(report.finishedAt)} · ${report.model} · ${report.runs} runs`}
    >
      <a class={cellLinkClass} href={`/adoption/${runtime}/${scenario}`}>
        <span class={rate > 0 ? pctClass : pctZeroClass}>{percent(rate)}</span>
        <span class={whoClass}>{topFramework(report)}</span>
      </a>
    </td>
  )
}

interface AdoptionCells {
  latest: Map<string, AdoptionReport>
  runtimes: string[]
  scenarios: string[]
}

/** Newest report per runtime × scenario (reports arrive newest first). */
function collectCells(reports: AdoptionReport[]): AdoptionCells {
  const latest = new Map<string, AdoptionReport>()
  const runtimes: string[] = []
  const scenarios: string[] = []
  for (const report of reports) {
    const scenario = report.scenario ?? 'default'
    const key = `${report.runtime} ${scenario}`
    if (!latest.has(key)) {
      latest.set(key, report)
    }
    if (!runtimes.includes(report.runtime)) {
      runtimes.push(report.runtime)
    }
    if (!scenarios.includes(scenario)) {
      scenarios.push(scenario)
    }
  }
  return {
    latest,
    runtimes: ordered(runtimes, RUNTIME_ORDER),
    scenarios: ordered(scenarios, SCENARIO_ORDER),
  }
}

const CHART_COLORS = ['#ff8b3e', '#5e6ad2', '#9a8cfc', '#3dd68c']

interface Bar {
  label: string
  value: number
  color: string
  title?: string
}

interface BarGroup {
  label: string
  bars: (Bar | null)[]
}

/** Dependency-free grouped bar chart with a 0–100% y axis and a legend. */
const GroupedBars: FC<{
  groups: BarGroup[]
  legend: { label: string; color: string }[]
  ariaLabel: string
}> = ({ groups, legend, ariaLabel }) => {
  const width = 640
  const height = 170
  const pad = { left: 44, right: 16, top: 16, bottom: 40 }
  const plotWidth = width - pad.left - pad.right
  const groupWidth = plotWidth / Math.max(groups.length, 1)
  const barsPerGroup = Math.max(...groups.map((g) => g.bars.length), 1)
  const barWidth = Math.min(22, (groupWidth * 0.7) / barsPerGroup)
  const y = (rate: number): number => pad.top + (1 - rate) * (height - pad.top - pad.bottom)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role='img'
      aria-label={ariaLabel}
      style='width: 100%; height: auto;'
    >
      {[0, 0.5, 1].map((rate) => (
        <>
          <line
            x1={pad.left}
            y1={y(rate)}
            x2={width - pad.right}
            y2={y(rate)}
            stroke='currentColor'
            opacity={0.15}
          />
          <text
            x={pad.left - 8}
            y={y(rate) + 4}
            text-anchor='end'
            font-size='11'
            fill='currentColor'
            opacity={0.6}
          >
            {percent(rate)}
          </text>
        </>
      ))}
      {groups.map((group, groupIndex) => {
        const groupStart = pad.left + groupIndex * groupWidth
        const barsWidth = barWidth * group.bars.length
        return (
          <>
            {group.bars.map((bar, barIndex) => {
              if (!bar) {
                return null
              }
              return (
                <rect
                  x={groupStart + (groupWidth - barsWidth) / 2 + barIndex * barWidth}
                  y={y(bar.value)}
                  width={barWidth - 3}
                  height={y(0) - y(bar.value)}
                  fill={bar.color}
                  fill-opacity='0.75'
                  rx='2'
                >
                  <title>{bar.title ?? `${bar.label}: ${percent(bar.value)}`}</title>
                </rect>
              )
            })}
            <text
              x={groupStart + groupWidth / 2}
              y={height - 22}
              text-anchor='middle'
              font-size='11'
              fill='currentColor'
              opacity={0.7}
            >
              {group.label}
            </text>
          </>
        )
      })}
      {legend.map((entry, index) => (
        <text x={pad.left + index * 150} y={height - 6} font-size='11' fill={entry.color}>
          {entry.label}
        </text>
      ))}
    </svg>
  )
}

/** Brand-ish colors per runtime; Deno is monochrome so it follows the theme. */
const RUNTIME_COLORS: Record<string, string> = {
  'cloudflare-workers': '#ff8b3e',
  bun: '#ffc53d',
  'node-js': '#3dd68c',
  deno: '#8b8d98',
}

function runtimeColor(runtime: string, index: number): string {
  return RUNTIME_COLORS[runtime] ?? CHART_COLORS[index % CHART_COLORS.length] ?? '#888'
}

/** Grouped bars: Hono adoption per scenario, one bar per runtime. */
const AdoptionBars: FC<{ cells: AdoptionCells }> = ({ cells }) => (
  <GroupedBars
    ariaLabel='Hono adoption per scenario and runtime'
    groups={cells.scenarios.map((scenario) => ({
      label: scenario,
      bars: cells.runtimes.map((runtime, index) => {
        const report = cells.latest.get(`${runtime} ${scenario}`)
        if (!report) {
          return null
        }
        return {
          label: `${runtime} × ${scenario}`,
          value: report.summary.honoAdoption,
          color: runtimeColor(runtime, index),
        }
      }),
    }))}
    legend={cells.runtimes.map((runtime, index) => ({
      label: runtime,
      color: runtimeColor(runtime, index),
    }))}
  />
)

const AdoptionMatrix: FC<{ cells: AdoptionCells }> = ({ cells }) => (
  <table class={tableClass}>
    <thead>
      <tr>
        <th>Runtime</th>
        {cells.scenarios.map((scenario) => (
          <th class='cell'>{scenario}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {cells.runtimes.map((runtime) => (
        <tr>
          <td>{runtime}</td>
          {cells.scenarios.map((scenario) => (
            <AdoptionCell
              runtime={runtime}
              scenario={scenario}
              report={cells.latest.get(`${runtime} ${scenario}`)}
            />
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)

const AdoptionSection: FC<{ reports: AdoptionReport[] }> = ({ reports }) => {
  const models: string[] = []
  for (const report of reports) {
    if (!models.includes(report.model)) {
      models.push(report.model)
    }
  }
  models.sort()
  return (
    <section class={sectionClass}>
      <h2>Adoption</h2>
      <p class={ledeClass}>
        Given a neutral prompt — no framework named — does a coding agent choose Hono? Hono adoption
        rate and the most-chosen option, per runtime × scenario. Click a cell for history and
        details.
      </p>
      {models.length > 0 ? (
        models.map((model) => {
          const cells = collectCells(reports.filter((r) => r.model === model))
          return (
            <>
              <h3>{model}</h3>
              <AdoptionBars cells={cells} />
              <AdoptionMatrix cells={cells} />
            </>
          )
        })
      ) : (
        <p class={emptyClass}>No adoption results yet.</p>
      )}
    </section>
  )
}

/** Hono adoption over time, one line per model. Dependency-free SVG. */
const AdoptionChart: FC<{ reports: AdoptionReport[] }> = ({ reports }) => {
  const byTime = [...reports].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
  const dates = [...new Set(byTime.map((r) => formatDate(r.finishedAt)))]
  const models = [...new Set(byTime.map((r) => r.model))].sort()
  const width = 640
  const height = 200
  const pad = { left: 44, right: 16, top: 12, bottom: 28 }
  const x = (date: string): number => {
    const i = dates.indexOf(date)
    const span = Math.max(dates.length - 1, 1)
    return pad.left + (i / span) * (width - pad.left - pad.right)
  }
  const y = (rate: number): number => pad.top + (1 - rate) * (height - pad.top - pad.bottom)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role='img'
      aria-label='Hono adoption over time'
      style='width: 100%; height: auto;'
    >
      {[0, 0.5, 1].map((rate) => (
        <>
          <line
            x1={pad.left}
            y1={y(rate)}
            x2={width - pad.right}
            y2={y(rate)}
            stroke='currentColor'
            opacity={0.15}
          />
          <text
            x={pad.left - 8}
            y={y(rate) + 4}
            text-anchor='end'
            font-size='11'
            fill='currentColor'
            opacity={0.6}
          >
            {percent(rate)}
          </text>
        </>
      ))}
      {dates.length > 0 && (
        <>
          <text x={pad.left} y={height - 8} font-size='11' fill='currentColor' opacity={0.6}>
            {dates[0]}
          </text>
          <text
            x={width - pad.right}
            y={height - 8}
            text-anchor='end'
            font-size='11'
            fill='currentColor'
            opacity={0.6}
          >
            {dates[dates.length - 1]}
          </text>
        </>
      )}
      {models.map((model, index) => {
        const rows = byTime.filter((r) => r.model === model)
        const color = CHART_COLORS[index % CHART_COLORS.length]
        const points = rows
          .map((r) => `${x(formatDate(r.finishedAt))},${y(r.summary.honoAdoption)}`)
          .join(' ')
        return (
          <>
            <polyline points={points} fill='none' stroke={color} stroke-width='2' />
            {rows.map((r) => (
              <circle
                cx={x(formatDate(r.finishedAt))}
                cy={y(r.summary.honoAdoption)}
                r='3'
                fill={color}
              />
            ))}
            <text x={pad.left + 4 + index * 150} y={pad.top + 4} font-size='11' fill={color}>
              {model.split('/').pop()}
            </text>
          </>
        )
      })}
    </svg>
  )
}

function breakdown(report: AdoptionReport): string {
  return Object.entries(report.summary.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([framework, count]) => `${frameworkLabel(framework)} ${count}`)
    .join(' · ')
}

const FRAMEWORK_COLORS: Record<string, string> = {
  hono: 'var(--accent)',
  'raw-handler': '#8b8d98',
  other: '#d6d3d1',
  express: '#3dd68c',
  fastify: '#5e6ad2',
  elysia: '#9a8cfc',
  h3: '#ffc53d',
  'itty-router': '#e879a9',
}

const shareBarClass = css`
  display: flex;
  width: 8rem;
  height: 0.7rem;
  border-radius: 4px;
  overflow: hidden;
  span {
    display: block;
    height: 100%;
  }
`

/** 100%-stacked bar of which frameworks the runs chose. */
const FrameworkShareBar: FC<{ report: AdoptionReport }> = ({ report }) => {
  const entries = Object.entries(report.summary.counts).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  if (total === 0) {
    return null
  }
  return (
    <div class={shareBarClass}>
      {entries.map(([framework, count]) => (
        <span
          style={`width: ${(count / total) * 100}%; background: ${FRAMEWORK_COLORS[framework] ?? '#78716c'}; opacity: 0.8`}
          title={`${frameworkLabel(framework)}: ${count}/${total}`}
        />
      ))}
    </div>
  )
}

const promptClass = css`
  background: var(--card);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
  white-space: pre-wrap;
`

export const AdoptionDetail: FC<{
  runtime: string
  scenario: string
  reports: AdoptionReport[]
}> = ({ runtime, scenario, reports }) => (
  <section class={sectionClass}>
    <h2>
      Adoption · {runtime} × {scenario}
    </h2>
    <p class={ledeClass}>
      Hono adoption over time, and what was chosen instead. <a href='/'>← back</a>
    </p>
    {reports[0]?.prompt && (
      <>
        <h3>Prompt</h3>
        <p class={promptClass}>{reports[0].prompt}</p>
      </>
    )}
    <AdoptionChart reports={reports} />
    <table class={tableClass}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Model</th>
          <th class='num'>Hono</th>
          <th>Share</th>
          <th>What agents chose</th>
          <th>Code</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => {
          const samples = report.results.filter((run) => run.sampleUrl)
          return (
            <tr>
              <td>{formatDate(report.finishedAt)}</td>
              <td>{report.model.split('/').pop()}</td>
              <td class='num'>
                <span class={report.summary.honoAdoption > 0 ? pctClass : pctZeroClass}>
                  {percent(report.summary.honoAdoption)}
                </span>
              </td>
              <td>
                <FrameworkShareBar report={report} />
              </td>
              <td>{breakdown(report)}</td>
              <td>
                {samples.length > 0
                  ? samples.map((run, i) => (
                      <>
                        {i > 0 ? ' ' : ''}
                        <a href={run.sampleUrl}>#{run.index}</a>
                      </>
                    ))
                  : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </section>
)

/** Which rails were given to the agent — the comparison axis of the suite. */
function practicalCondition(report: PracticalReport): string {
  if (report.honoCli && report.skill) {
    return 'cli + skill'
  }
  if (report.honoCli) {
    return 'cli'
  }
  if (report.skill) {
    return 'skill'
  }
  return 'baseline'
}

const CONDITION_ORDER = ['baseline', 'cli', 'skill', 'cli + skill']

const CONDITION_COLORS: Record<string, string> = {
  baseline: '#8b8d98',
  cli: '#5e6ad2',
  skill: '#e879a9',
  'cli + skill': 'var(--accent)',
}

const PracticalCell: FC<{ report?: PracticalReport }> = ({ report }) => {
  if (!report) {
    return <td class='cell'>·</td>
  }
  const success = report.summary.successRate
  return (
    <td
      class='cell'
      title={`${formatDate(report.finishedAt)} · ${report.model} · ${report.runs} runs${report.honoCliVersion ? ` · @hono/cli ${report.honoCliVersion}` : ''}`}
    >
      <span class={success === 1 ? pctClass : pctZeroClass}>{percent(success)}</span>
      <span class={whoClass}>
        {report.summary.medianTokens
          ? `${Math.round(report.summary.medianTokens / 1000)}k tok`
          : '—'}
        {report.summary.honoCli ? ` · CLI ${percent(report.summary.honoCli.usageRate)}` : ''}
      </span>
    </td>
  )
}

const PracticalSection: FC<{ reports: PracticalReport[] }> = ({ reports }) => {
  // Newest report per task × condition; the columns are the point:
  // does giving the agent the CLI or the skill change the outcome?
  const latest = new Map<string, PracticalReport>()
  const tasks: string[] = []
  const conditions: string[] = []
  for (const report of reports) {
    const condition = practicalCondition(report)
    const key = `${report.task} ${condition}`
    if (!latest.has(key)) {
      latest.set(key, report)
    }
    if (!tasks.includes(report.task)) {
      tasks.push(report.task)
    }
    if (!conditions.includes(condition)) {
      conditions.push(condition)
    }
  }
  tasks.sort()
  return (
    <section class={sectionClass}>
      <h2>Practical</h2>
      <p class={ledeClass}>
        Hand the agent a real Hono project and a change request, grade the result with hidden
        deterministic checks. Success rate, median tokens, and CLI usage per task — with and without
        the Hono CLI and skill.
      </p>
      {latest.size > 0 ? (
        <>
          <GroupedBars
            ariaLabel='Practical success rate per task and condition'
            groups={tasks.map((task) => ({
              label: task,
              bars: ordered(conditions, CONDITION_ORDER).map((condition) => {
                const report = latest.get(`${task} ${condition}`)
                if (!report) {
                  return null
                }
                return {
                  label: `${task} · ${condition}`,
                  value: report.summary.successRate,
                  color: CONDITION_COLORS[condition] ?? '#888',
                }
              }),
            }))}
            legend={ordered(conditions, CONDITION_ORDER).map((condition) => ({
              label: condition,
              color: CONDITION_COLORS[condition] ?? '#888',
            }))}
          />
          <table class={tableClass}>
            <thead>
              <tr>
                <th>Task</th>
                {ordered(conditions, CONDITION_ORDER).map((condition) => (
                  <th class='cell'>{condition}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr>
                  <td>{task}</td>
                  {ordered(conditions, CONDITION_ORDER).map((condition) => (
                    <PracticalCell report={latest.get(`${task} ${condition}`)} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p class={emptyClass}>No practical results yet.</p>
      )}
    </section>
  )
}

/** Pair reports labeled baseline/candidate within the same suite. */
function findExperiments(reports: AgentDxReport[]) {
  const groups = new Map<string, AgentDxReport[]>()
  for (const report of reports) {
    if (!report.variant) {
      continue
    }
    const subject = isAdoptionReport(report) ? report.runtime : report.task
    const key = `${report.suite}:${subject}:${report.target ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), report])
  }
  const experiments = []
  for (const group of groups.values()) {
    const baseline = group.find((r) => r.variant === 'baseline')
    const candidate = group.find((r) => r.variant === 'candidate')
    if (baseline && candidate) {
      experiments.push(compareReports(baseline, candidate))
    }
  }
  return experiments
}

const ExperimentsSection: FC<{ reports: AgentDxReport[] }> = ({ reports }) => {
  const experiments = findExperiments(reports)
  return (
    <section class={sectionClass}>
      <h2>Experiments</h2>
      <p class={ledeClass}>
        Do changes to Hono CLI, Skills, Docs, or Core improve Agent DX? Baseline vs candidate, same
        task and fixture.
      </p>
      {experiments.length > 0 ? (
        experiments.map((experiment) => (
          <>
            <h3>
              {experiment.suite} ({experiment.subject})
            </h3>
            <p class={metaClass}>model: {experiment.model}</p>
            <table class={tableClass}>
              <thead>
                <tr>
                  <th />
                  <th class='num'>Baseline</th>
                  <th class='num'>Candidate</th>
                  <th class='num'>Change</th>
                </tr>
              </thead>
              <tbody>
                {experiment.rows.map((row) => (
                  <tr>
                    <td>{row.label}</td>
                    <td class='num'>{row.baseline}</td>
                    <td class='num'>{row.candidate}</td>
                    <td class='num'>{row.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ))
      ) : (
        <p class={emptyClass}>No experiment results yet.</p>
      )}
    </section>
  )
}

export const Layout: FC<PropsWithChildren<{ head?: Child }>> = ({ head, children }) => (
  <html lang='en'>
    <head>
      <meta charset='utf-8' />
      <meta name='viewport' content='width=device-width, initial-scale=1' />
      <title>Hono Agent DX</title>
      <meta
        name='description'
        content='Measure and improve the developer experience of coding agents using Hono.'
      />
      <link rel='icon' href='/favicon.ico' />
      {head}
      <Style />
    </head>
    <body class={bodyClass}>
      <header class={headerClass}>
        <h1>
          <a href='/'>Hono Agent DX</a>
        </h1>
        <p>Measure and improve the developer experience of coding agents using Hono.</p>
      </header>
      {children}
      <footer class={footerClass}>
        <a href='https://github.com/honojs/agent-dx'>GitHub</a> ·{' '}
        <a href='https://www.npmjs.com/package/@hono/agent-dx'>npm</a>
      </footer>
    </body>
  </html>
)

export const Home: FC<{ reports: AgentDxReport[] }> = ({ reports }) => (
  <>
    <AdoptionSection reports={reports.filter(isAdoptionReport)} />
    <PracticalSection reports={reports.filter(isPracticalReport)} />
    <ExperimentsSection reports={reports} />
  </>
)
