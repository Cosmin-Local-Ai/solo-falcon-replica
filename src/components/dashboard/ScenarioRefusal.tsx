import { scenarioFixHref, type ScenarioOutcome } from '../../domain/scenarios';
import { scenarios as scenariosCopy } from '../../ui/copy';

/**
 * PG-6a — the refusal block: what the app could not compute, why, and where to fix it.
 *
 * This is the surface that makes a scenario refusal worth having. A refusal that only changes a badge
 * leaves the reader with a word and no next step, and `fixTarget` that goes nowhere is worse than no
 * link at all — so the link is built by `scenarioFixHref`, the same resolver the registry's own route
 * test follows, and the reason is the rule's own sentence lifted verbatim from the layer that wrote it.
 * Nothing here re-states a legal conclusion in plainer words: the framing sentence is about this app's
 * capability, and the citation stays attached to it.
 *
 * Presentational only. It receives the outcome the one evaluation point produced and renders it; it
 * does not run a detector, does not decide whether the estimate may run, and does not render a figure —
 * a refusal replaces the number, it does not annotate it.
 */
export interface ScenarioRefusalProps {
  scenario: ScenarioOutcome;
}

export default function ScenarioRefusal({ scenario }: ScenarioRefusalProps) {
  return (
    <div className="scenario-refusal" data-scenario-refusal={scenario.id}>
      <p className="hint">{scenariosCopy.messages[scenario.message]}</p>
      {scenario.detail ? (
        <p className="hint scenario-refusal-detail" data-scenario-detail={scenario.id}>
          {scenario.detail}
        </p>
      ) : null}
      <a className="btn btn-sm" href={scenarioFixHref(scenario.fixTarget)}>
        {scenariosCopy.open}
      </a>
    </div>
  );
}
