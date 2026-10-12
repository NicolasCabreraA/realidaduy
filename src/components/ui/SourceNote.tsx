import type { Indicator, Observation } from "@/lib/types";
import { getObservationSource, getSource } from "@/data/sources";
import { StatusBadge } from "@/components/ui/Badge";

/** "¿De dónde sale este dato?" — provenance completo, expandible sin JS. */
export default function SourceNote({
  indicator,
  obs,
}: {
  indicator: Indicator;
  obs?: Observation;
}) {
  const source = obs ? getObservationSource(indicator.sourceId, obs) : getSource(indicator.sourceId);
  return (
    <details className="fold rounded-2xl border border-line bg-surface px-4 py-3">
      <summary className="text-sm font-semibold text-primary">
        ¿De dónde sale este dato?
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-bold text-ink-faint">Organismo</dt>
          <dd>
            {source ? (
              <a
                className="text-primary underline decoration-line underline-offset-2 hover:decoration-primary"
                href={source.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {source.name}
              </a>
            ) : (
              indicator.sourceId
            )}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-ink-faint">Período</dt>
          <dd>{obs ? obs.periodLabel : "—"}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink-faint">Tipo de dato</dt>
          <dd>{obs ? <StatusBadge status={obs.status} /> : <StatusBadge status="UNAVAILABLE" />}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink-faint">Última actualización</dt>
          <dd>{obs?.retrievedAt ?? indicator.lastUpdated}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-bold text-ink-faint">¿Qué significa?</dt>
          <dd>{indicator.plainDefinition}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-bold text-ink-faint">Metodología</dt>
          <dd>{indicator.methodology}</dd>
        </div>
        {obs?.notes ? (
          <div className="sm:col-span-2">
            <dt className="font-bold text-ink-faint">Nota</dt>
            <dd>{obs.notes}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-bold text-ink-faint">Dato original</dt>
          <dd>
            <a
              className="break-all text-primary underline decoration-line underline-offset-2 hover:decoration-primary"
              href={obs?.sourceUrl ?? indicator.sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {obs?.sourceUrl ?? indicator.sourceUrl}
            </a>
          </dd>
        </div>
      </dl>
    </details>
  );
}
