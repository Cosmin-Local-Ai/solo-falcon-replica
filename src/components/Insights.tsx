import type { Insight } from '../domain/insights';

interface InsightsProps {
  insights: Insight[];
}

const SEVERITY_LABELS: Record<Insight['severity'], string> = {
  info: 'Info',
  warning: 'Atenție',
  danger: 'Urgent',
};

export default function Insights({ insights }: InsightsProps) {
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Observații</h2>
      </div>
      <div className="card-body">
        {insights.length === 0 ? (
          <div className="hint">
            Ești la zi. Nu există probleme de rezolvat în momentul de față.
          </div>
        ) : (
          insights.map((insight) => (
            <div key={insight.id}>
              <div className="row between">
                <div>{insight.title}</div>
                <span className="hint">{SEVERITY_LABELS[insight.severity]}</span>
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
