import type { Insight } from '../domain/insights';
import { insights as insightCopy } from '../ui/copy';

interface InsightsProps {
  insights: Insight[];
}

export default function Insights({ insights }: InsightsProps) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{insightCopy.title}</h2>
      </div>
      <div className="card-body">
        {insights.length === 0 ? (
          <div className="hint">{insightCopy.empty}</div>
        ) : (
          insights.map((insight) => (
            <div key={insight.id}>
              <div className="row between">
                <div>{insight.title}</div>
                <span className="hint">{insightCopy.severityLabels[insight.severity]}</span>
              </div>
              <div className="hint">{insight.description}</div>
              <div className="hint">{insight.action}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
