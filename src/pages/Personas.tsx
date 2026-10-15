/**
 * Step 11 / Part D (B-132) — the persona surface.
 *
 * ## What this page is, and the two things it deliberately is not
 *
 * It is **the routing decision, on screen**. `routePersonaForCaen` has answered "which demo profile is
 * closest to this CAEN code" since B-128, and B-131 closed the coverage behind it — but until now no
 * component or page imported `PERSONAS` or any routing function, so the answer reached a browser only
 * through `e2e/persona-harness.ts` writing localStorage. A person could not see which profile applied, at
 * which level, or why.
 *
 * It is not a gallery. Fifteen browsable cards was rejected as bloat: the routing already decides which
 * profile applies, so the surface shows that decision and lets the person act on it. It is also not a CAEN
 * browser — there is no list of the nomenclator and no type-ahead over it. The one input here asks about a
 * single code, which is what makes a secțiune-level route and a tie reachable without editing the person's
 * own declared activity.
 *
 * ## Why the badge does not live next to the CAEN field
 *
 * The only CAEN surface before this page was the person's own fiscal field in Setări. A demo marker there
 * reads as a statement about their real activity. So the marker lives here and in the topbar, and this page
 * reads `profile.identity.caen` without ever writing to it.
 *
 * ## What the render must never flatten
 *
 * Part B shipped a lineage walk rather than the affinity-table scoring brief 64 specified, and the measured
 * result is that most routed clase match on bare secțiune ancestry — the coarsest key in the nomenclator,
 * contested between two official sources per B-136 (PARKED, so this page renders whatever the data says).
 * A secțiune-level match therefore must not look like a clasă-level one. That difference is carried by
 * `personas.levelSentence` — a different sentence per level, asserted on rendered text, not by a colour —
 * and by rendering `matchedOn`, so the person can see *what* matched rather than only how strongly.
 *
 * A tie renders every candidate. The app has no basis for choosing between a person who genuinely holds
 * both 5520 and 6820, and picking one would turn a map into a guess.
 *
 * `sample` stays a different kind of object from `candidates`: a match claims resemblance, a sample claims
 * only that the app works on somebody's data. It is rendered under `CAEN_SAMPLE_LABEL`, never as a fifth
 * rung of the ladder.
 */
import { useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { caenClassProblem } from '../data/caenRev3';
import {
  CAEN_MATCH_LEVEL_LABELS,
  CAEN_SAMPLE_LABEL,
  caenCoverage,
  caenInfo,
  routePersonaForCaen,
  type CaenPersonaRoute,
} from '../data/personas';
import type { PersonaId } from '../data/personas/personaTypes';
import { personas as t } from '../ui/copy/personas';
import { Card, Empty } from '../components/ui';

function CandidateRow({ route, personaId }: { route: CaenPersonaRoute; personaId: PersonaId }) {
  const match = route.candidates.find(c => c.persona.id === personaId);
  if (!match) return null;
  const { demoPersonaId, loadDemoPersona, unloadDemoPersona, toast } = useStore();
  const active = demoPersonaId === match.persona.id;
  return (
    <li className="persona-candidate" data-candidate={match.persona.id}>
      <span className="persona-candidate-label" data-candidate-label>{match.persona.label}</span>
      <span className="persona-candidate-role" data-candidate-role>
        {t.candidateRole[match.role]} · {match.persona.caen.principal}
      </span>
      {active ? (
        <button
          type="button"
          className="btn btn-primary"
          data-demo-exit
          onClick={() => {
            unloadDemoPersona();
            toast('success', t.toasts.unloaded);
          }}
        >
          {t.exitDemo}
        </button>
      ) : (
        <button
          type="button"
          className="btn"
          data-demo-load
          onClick={() => {
            if (loadDemoPersona(match.persona.id)) toast('success', t.toasts.loaded(match.persona.label));
          }}
        >
          {t.loadDemo}
        </button>
      )}
    </li>
  );
}

/**
 * One route, rendered. `data-match-level` is on the article so a test can find the level without depending
 * on the sentence, and the sentence is asserted separately — the level must be legible in the text, not
 * only in the class name.
 */
function RouteCard({ route }: { route: CaenPersonaRoute }) {
  const { demoPersonaId, loadDemoPersona, unloadDemoPersona, toast } = useStore();
  const levelLabel = CAEN_MATCH_LEVEL_LABELS[route.matchLevel];
  const info = caenInfo(route.cod);
  const sample = route.sample;
  const sampleActive = sample !== undefined && demoPersonaId === sample.id;
  return (
    <article
      className={`persona-route persona-route--${route.matchLevel}`}
      data-match-level={route.matchLevel}
      data-route-for={route.cod}
    >
      <div className="persona-route-head">
        <span className="persona-route-cod" data-route-cod>{route.cod}</span>
        <span className={`persona-level persona-level--${route.matchLevel}`} data-match-level-label>
          {levelLabel}
        </span>
        {route.tie && (
          <span className="persona-route-tie" data-route-tie>{t.tieHeading(route.candidates.length)}</span>
        )}
      </div>

      {info && <p className="persona-route-den" data-route-denumire>{t.denumireLine(info.denumire)}</p>}

      {/* The strength sentence, per level. This is the element acceptance 3 asserts on. */}
      <p className="persona-route-strength" data-match-strength>{t.levelSentence[route.matchLevel]}</p>

      {route.matchedOn !== '' && (
        <p className="persona-route-matched" data-matched-on>
          {t.matchedOnLine(levelLabel, route.matchedOn)}
        </p>
      )}

      {/* Verbatim from the router. Not collapsed: for an unreachable code this sentence IS the answer, and
          a `<details>` around it would hide the reason 40 clase exist. */}
      <p className="persona-route-reason" data-route-reason>{route.reason}</p>

      {route.candidates.length > 0 && (
        <ul className="persona-candidates" data-candidate-list>
          {route.candidates.map(c => (
            <CandidateRow key={c.persona.id} route={route} personaId={c.persona.id} />
          ))}
        </ul>
      )}

      {sample && (
        <div className="persona-sample" data-sample-block>
          <strong data-sample-label>{CAEN_SAMPLE_LABEL}</strong>
          <span className="persona-sample-label" data-sample-persona={sample.id}>{sample.label}</span>
          {sampleActive ? (
            <button
              type="button"
              className="btn btn-primary"
              data-demo-exit
              onClick={() => {
                unloadDemoPersona();
                toast('success', t.toasts.unloaded);
              }}
            >
              {t.exitDemo}
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              data-sample-load
              onClick={() => {
                if (loadDemoPersona(sample.id)) toast('success', t.toasts.loaded(sample.label));
              }}
            >
              {t.loadDemo}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function Personas() {
  const { profile } = useStore();
  const [draft, setDraft] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Computed from the shipped nomenclator, never typed into this file: the distribution the page states is
  // the distribution the data supports today.
  const coverage = useMemo(() => caenCoverage(), []);
  const declared = profile.identity.caen ?? [];
  const routes = useMemo(
    () => declared.map(entry => routePersonaForCaen(entry.cod)),
    [declared],
  );

  const check = () => {
    const cod = draft.trim();
    const bad = caenClassProblem(cod);
    if (bad) {
      setProblem(bad);
      setAsked(null);
      return;
    }
    setProblem(null);
    setAsked(cod);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{t.introTitle}</h1>
          <div className="sub" data-coverage-line>
            {t.coverageLine(coverage.matchLevelCounts.sectiune, coverage.routedClasses, coverage.totalClasses)}
          </div>
        </div>
      </div>

      <Card title={t.introTitle}>
        <p className="muted">{t.introBody}</p>
      </Card>

      {declared.length === 0 ? (
        <Card title={t.declaredTitle}>
          <Empty icon="🧭" title={t.noCaenTitle} text={t.noCaenBody} />
        </Card>
      ) : (
        <Card title={t.declaredTitle}>
          {routes.map(route => (
            <RouteCard key={route.cod} route={route} />
          ))}
        </Card>
      )}

      <Card title={t.checkTitle}>
        <p className="muted">{t.checkBody}</p>
        <div className="persona-check">
          <div className="field">
            <label htmlFor="persona-cod-input">{t.checkInputLabel}</label>
            <input
              id="persona-cod-input"
              data-persona-cod-input
              placeholder={t.checkPlaceholder}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') check();
              }}
            />
            {problem && <span className="error" data-persona-problem>{t.checkInvalid(problem)}</span>}
          </div>
          <button type="button" className="btn btn-primary" data-persona-check onClick={check}>
            {t.checkButton}
          </button>
        </div>
        {asked && <RouteCard route={routePersonaForCaen(asked)} />}
      </Card>
    </div>
  );
}
