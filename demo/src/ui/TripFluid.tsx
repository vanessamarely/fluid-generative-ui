// Vista FLUIDA del viaje:
//  · Espacio reservado desde que se conoce el número de días (lo da la intención,
//    antes de que el agente de itinerario escriba una sola palabra) → CLS ≈ 0.
//  · Cada tarjeta se suscribe SOLO a su ítem (useItem) → render granular.
//  · Claves estables (día por posición, lugar y hospedaje por id) → el DOM se reutiliza.
//  · Mientras llega lo nuevo se ve lo anterior atenuado: nunca pantalla en blanco.
import { memo } from 'react';
import type { DocStore } from '../genui/doc-store';
import type { Intent, ItineraryDay, LodgingOption, TripRequest } from '../trip/agents';
import { KIND_EMOJI, LODGING_BY_ID, PLACE_BY_ID, REGIONS, type RegionId } from '../trip/places';
import type { Check } from '../trip/verify';
import type { Selection } from '../trip/derive';
import { useField, useItem, useListLength, usePrevious, useStatus } from './useDoc';

const isBusy = (s: string) => s === 'thinking' || s === 'streaming' || s === 'waiting';

export function TripHeader({ store, intent }: { store: DocStore; intent: Intent | null }) {
  const title = useField<string>(store, 'title');
  const subtitle = useField<string>(store, 'subtitle');
  const status = useStatus(store);
  const region = intent ? REGIONS[intent.region as RegionId] : null;
  return (
    <header className="trip-header" aria-busy={isBusy(status)}>
      <div className="trip-header-meta">
        {region ? (
          <span className="region-chip" style={{ '--region': region.color } as React.CSSProperties}>
            {region.name}
          </span>
        ) : (
          <span className="region-chip skeleton-text">Entendiendo tu viaje…</span>
        )}
        {intent && (
          <span className="intent-tags">
            {intent.interests.map((i) => (
              <span key={i} className="tag">
                {i}
              </span>
            ))}
            <span className="tag">ritmo {intent.pace}</span>
            {intent.withKids && <span className="tag">con niños</span>}
          </span>
        )}
      </div>
      {/* Altura reservada y texto recortado: el título puede crecer letra a letra sin empujar nada. */}
      <h2 className="trip-title">{title || <span className="skeleton-text">Armando tu escapada…</span>}</h2>
      <p className="trip-subtitle">{subtitle || ' '}</p>
    </header>
  );
}

export function DaysList({
  store,
  req,
  checks,
  selection,
  onSelect,
}: {
  store: DocStore;
  req: TripRequest;
  checks: Check[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const status = useStatus(store);
  const dayCount = useField<number>(store, 'dayCount');
  const length = useListLength(store, 'plan');
  const previous = usePrevious<ItineraryDay[]>(store, 'plan');
  const busy = isBusy(status);
  // Mientras genera: reservamos tantos slots como días pedidos. Al terminar: los reales.
  const slots = busy ? Math.max(dayCount ?? req.days, length) : length || (previous?.length ?? 0);

  return (
    <ol className="days" aria-label="Itinerario por día" aria-busy={busy}>
      {Array.from({ length: slots }, (_, i) => (
        <DaySlot key={`day-${i}`} store={store} index={i} previous={busy ? previous?.[i] : undefined} checks={checks} selection={selection} onSelect={onSelect} />
      ))}
    </ol>
  );
}

const DaySlot = memo(function DaySlot({
  store,
  index,
  previous,
  checks,
  selection,
  onSelect,
}: {
  store: DocStore;
  index: number;
  previous?: ItineraryDay;
  checks: Check[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  const item = useItem(store, 'plan', index);
  const live = item?.value as ItineraryDay | undefined;
  // Un parcial que aún no dice nada útil no reemplaza a lo anterior.
  const hasLive = !!(live?.title || live?.placeIds?.length);
  const day = hasLive ? live : (previous ?? live);
  const stale = !hasLive && !!previous;
  const heavy = checks.find((c) => c.id === `day-hours-${index}`);
  const selected = selection.kind === 'day' && selection.index === index;

  return (
    <li className="day-slot" data-day={index} data-stale={stale || undefined} data-complete={item?.complete || undefined}>
      {!day?.title && !day?.placeIds?.length ? (
        <div className="day-card skeleton" aria-hidden="true">
          <span className="day-num">Día {index + 1}</span>
          <span className="sk-line w60" />
          <span className="sk-line w90" />
          <span className="sk-line w75" />
        </div>
      ) : (
        <article className="day-card" aria-current={selected || undefined}>
          <button className="day-head" type="button" onClick={() => onSelect({ kind: 'day', index })}>
            <span className="day-num">Día {index + 1}</span>
            <h3>{day.title}</h3>
            {heavy && (
              <span className="check-pill warn" title={heavy.detail}>
                ⚠ cargado
              </span>
            )}
          </button>
          <ul className="places">
            {(day.placeIds ?? []).map((id) => (
              <PlaceRow key={id} id={id} day={index} checks={checks} selected={selection.kind === 'place' && selection.id === id} onSelect={onSelect} />
            ))}
          </ul>
          <p className="day-note">{day.note ?? ' '}</p>
        </article>
      )}
    </li>
  );
});

const PlaceRow = memo(function PlaceRow({
  id,
  day,
  checks,
  selected,
  onSelect,
}: {
  id: string;
  day: number;
  checks: Check[];
  selected: boolean;
  onSelect: (s: Selection) => void;
}) {
  const p = PLACE_BY_ID.get(id);
  if (!p) return null;
  const blocked = checks.find((c) => c.level === 'block' && c.exclude === id);
  const caution = checks.find((c) => c.id === `place-caution-${id}`);
  return (
    <li className="place" data-place={id} data-blocked={blocked ? true : undefined} style={{ viewTransitionName: `place-${id}` }}>
      <button type="button" aria-pressed={selected} onClick={() => onSelect({ kind: 'place', id, day })}>
        <span className="place-emoji" aria-hidden="true">
          {KIND_EMOJI[p.kind]}
        </span>
        <span className="place-body">
          <span className="place-name">{p.name}</span>
          <span className="place-meta">
            {p.hours} h · {p.cost ? `$${p.cost}/pers.` : 'gratis'}
          </span>
        </span>
        {blocked && <span className="check-pill block">fuera de temporada</span>}
        {!blocked && caution && (
          <span className="check-pill warn" title={caution.detail}>
            aviso
          </span>
        )}
      </button>
    </li>
  );
});

export function LodgingList({
  store,
  checks,
  chosen,
  onSelect,
  onChoose,
}: {
  store: DocStore;
  checks: Check[];
  chosen: string | null;
  onSelect: (s: Selection) => void;
  onChoose: (id: string) => void;
}) {
  const status = useStatus(store);
  const length = useListLength(store, 'options');
  const previous = usePrevious<LodgingOption[]>(store, 'options');
  const busy = isBusy(status);
  const slots = busy ? 3 : Math.max(length, 0);
  return (
    <div className="lodgings" aria-busy={busy} aria-label="Hospedajes recomendados" role="list">
      {status === 'waiting' && <p className="lodging-wait">Esperando la región del agente de intención…</p>}
      {Array.from({ length: slots }, (_, i) => (
        <LodgingSlot key={`lodging-${i}`} store={store} index={i} previous={busy ? previous?.[i] : undefined} checks={checks} chosen={chosen} onSelect={onSelect} onChoose={onChoose} />
      ))}
    </div>
  );
}

const LodgingSlot = memo(function LodgingSlot({
  store,
  index,
  previous,
  checks,
  chosen,
  onSelect,
  onChoose,
}: {
  store: DocStore;
  index: number;
  previous?: LodgingOption;
  checks: Check[];
  chosen: string | null;
  onSelect: (s: Selection) => void;
  onChoose: (id: string) => void;
}) {
  const item = useItem(store, 'options', index);
  const live = item?.value as LodgingOption | undefined;
  const hasLive = !!(live?.lodgingId && LODGING_BY_ID.has(live.lodgingId));
  const opt = hasLive ? live : (previous ?? live);
  const l = opt?.lodgingId ? LODGING_BY_ID.get(opt.lodgingId) : undefined;
  const stale = !hasLive && !!previous;
  if (!l) {
    return (
      <div className="lodging-slot" role="listitem">
        <div className="lodging-card skeleton" aria-hidden="true">
          <span className="sk-line w60" />
          <span className="sk-line w40" />
          <span className="sk-line w90" />
        </div>
      </div>
    );
  }
  const blocked = checks.find((c) => c.level === 'block' && c.exclude === l.id);
  const priceWarn = checks.find((c) => c.id === `lodging-price-${l.id}`);
  return (
    <div className="lodging-slot" role="listitem" data-index={index} data-stale={stale || undefined}>
      <article className="lodging-card" data-lodging={l.id} data-blocked={blocked ? true : undefined} aria-current={chosen === l.id || undefined} style={{ viewTransitionName: `lodging-${l.id}` }}>
        {opt?.badge && <span className="badge">{opt.badge}</span>}
        <button className="lodging-head" type="button" onClick={() => onSelect({ kind: 'lodging', id: l.id })}>
          <h3>{l.name}</h3>
          <span className="lodging-meta">
            {l.style} · {l.rating}★ ({l.reviews}) · {l.verified ? '✓ verificado' : 'sin verificar'}
          </span>
        </button>
        <p className="lodging-reason">{opt?.reason ?? ' '}</p>
        <div className="lodging-foot">
          <span className="price">
            ${l.pricePerNight}
            <small>/noche</small>
          </span>
          <button className="btn small" type="button" disabled={!!blocked} onClick={() => onChoose(l.id)}>
            {chosen === l.id ? 'Elegido' : 'Elegir'}
          </button>
        </div>
        {blocked && (
          <p className="stamp" role="alert">
            ⚠ Descartado por el verificador: {blocked.detail}
          </p>
        )}
        {priceWarn && !blocked && <p className="stamp warn">{priceWarn.detail}</p>}
      </article>
    </div>
  );
});
