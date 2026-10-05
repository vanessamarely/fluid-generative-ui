// Grafo del workflow agéntico: secuencial → paralelo → secuencial (+ bucle del verificador).
import { CircleCheck, OctagonX, RotateCcw, TriangleAlert } from 'lucide-react';
import type { NodeId, NodeStatus } from '../trip/workflow';
import type { Check } from '../trip/verify';
import type { Budget } from '../trip/derive';

export type Nodes = Record<NodeId, { status: NodeStatus; note?: string }>;

export const initialNodes = (): Nodes => ({
  intent: { status: 'idle' },
  itinerary: { status: 'idle' },
  lodging: { status: 'idle' },
  verify: { status: 'idle' },
  synthesis: { status: 'idle' },
});

const LABEL: Record<NodeId, { name: string; who: string }> = {
  intent: { name: 'Intención', who: 'Gemini Nano' },
  itinerary: { name: 'Itinerario', who: 'agente · stream' },
  lodging: { name: 'Hospedaje', who: 'agente · stream' },
  verify: { name: 'Verificador', who: 'reglas en código' },
  synthesis: { name: 'Síntesis', who: 'presupuesto en código' },
};

const STATUS_TEXT: Record<NodeStatus, string> = {
  idle: 'en espera',
  waiting: 'esperando',
  running: 'trabajando',
  done: 'listo',
  error: 'error',
  skipped: 'reutilizado',
  loop: 'corrigiendo',
};

function Node({ id, node }: { id: NodeId; node: Nodes[NodeId] }) {
  return (
    <div className="wf-node" data-status={node.status}>
      <span className="wf-dot" aria-hidden="true" />
      <span className="wf-name">{LABEL[id].name}</span>
      <span className="wf-who">{LABEL[id].who}</span>
      <span className="wf-status">{node.note && node.status !== 'running' ? node.note : STATUS_TEXT[node.status]}</span>
    </div>
  );
}

export function WorkflowGraph({ nodes, verifyEnabled }: { nodes: Nodes; verifyEnabled: boolean }) {
  return (
    <section className="workflow" aria-label="Workflow de agentes">
      <div className="wf-step">
        <span className="wf-kind">secuencial</span>
        <Node id="intent" node={nodes.intent} />
      </div>
      <span className="wf-arrow" aria-hidden="true" />
      <div className="wf-step parallel">
        <span className="wf-kind">paralelo</span>
        <Node id="itinerary" node={nodes.itinerary} />
        <Node id="lodging" node={nodes.lodging} />
      </div>
      <span className="wf-arrow" aria-hidden="true" />
      <div className="wf-step" data-disabled={!verifyEnabled || undefined}>
        <span className="wf-kind">secuencial + bucle</span>
        <Node id="verify" node={verifyEnabled ? nodes.verify : { status: 'idle', note: 'apagado' }} />
      </div>
      <span className="wf-arrow" aria-hidden="true" />
      <div className="wf-step">
        <span className="wf-kind">secuencial</span>
        <Node id="synthesis" node={nodes.synthesis} />
      </div>
    </section>
  );
}

export function ChecksPanel({ checks, round }: { checks: Check[]; round: number }) {
  if (!checks.length) return null;
  return (
    <section className="checks" aria-label="Verificación">
      <h3>
        Verificación {round > 0 && <span className="tag">corregido en el bucle</span>}
      </h3>
      <ul>
        {checks.map((c) => (
          <li key={c.id} data-level={c.level}>
            <span className="check-icon" aria-hidden="true">
              {c.level === 'ok' ? <CircleCheck size={18} /> : c.level === 'warn' ? <TriangleAlert size={18} /> : c.level === 'fixed' ? <RotateCcw size={18} /> : <OctagonX size={18} />}
            </span>
            <span>
              <strong>{c.level === 'fixed' ? `Corregido: ${c.title}` : c.title}</strong> {c.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BudgetCard({ budget, people }: { budget: Budget; people: number }) {
  const rows: [string, number][] = [
    [`Hospedaje · ${budget.nights} noche${budget.nights > 1 ? 's' : ''}`, budget.lodging],
    ['Actividades', budget.activities],
    ['Transporte', budget.transfer],
    ['Comida', budget.food],
  ];
  return (
    <section className="budget" aria-label="Presupuesto estimado">
      <h3>Presupuesto</h3>
      <p className="budget-note">Calculado en tu navegador, no por la IA.</p>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>${v.toLocaleString('es-DO')}</dd>
          </div>
        ))}
      </dl>
      <p className="budget-total">
        <span>Total para {people}</span>
        <strong>${budget.total.toLocaleString('es-DO')}</strong>
      </p>
      <p className="budget-pp">${budget.perPerson.toLocaleString('es-DO')} por persona</p>
    </section>
  );
}
