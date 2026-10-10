/**
 * Centro de Retención 360 · Integratel — Retention specialist agent.
 *
 * Built on @openai/agents SDK pointed at Databricks' Chat Completions API
 * (NOT Responses API, which is unsupported for Claude models on this workspace).
 * Agent performs retention risk investigation → plan drafting → approval-gated execution.
 *
 * CRITICAL: Azure workspace constraint — uses Chat Completions with Anthropic models
 * (databricks-claude-sonnet-5-5). See configureAgentsSdk() for setup.
 */
import type { Request } from 'express';
import OpenAI from 'openai';
import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setOpenAIAPI,
} from '@openai/agents';
import type { Tool } from '@openai/agents';
import { loggedTool as tool } from './tools/logged-tool.js';
import * as mlflow from 'mlflow-tracing';
import { z } from 'zod';
import { authHeaders } from '../lib/auth.js';
import type { AppDb } from '../db/index.js';

import {
  buscarClientes,
  listClientes,
  registrarPlanRetencion,
  type ClienteRow,
} from '../db/queries/clientes.js';

import { callMasEndpoint } from './tools/mas.js';
export type { ToolProgressEvent } from './tools/types.js';

export type ModelErrorDetail = {
  status: number;
  url: string;
  bodyText: string;
  code?: string;
  message?: string;
};

export type AgentContext = {
  db: AppDb;
  userEmail: string;
  req: Request;
  masEndpointName: string;
  genieSpaceId: string;
  databricksHost: string;
  model: string;
  onToolProgress?: (ev: import('./tools/types.js').ToolProgressEvent) => void;
  modelError?: { current: ModelErrorDetail | null };
};

/**
 * Reglas para `parameters: z.object(...)`: usar `.nullable()` (nunca `.optional()`),
 * `.describe(...)` en cada campo, nombres en snake_case, y el wrapper `loggedTool`.
 */
function fichaCliente(c: ClienteRow) {
  return {
    cliente_id: c.clienteId,
    nombre: c.nombreCompleto,
    region: c.region,
    distrito: c.distrito,
    antiguedad_anios: c.antiguedadAnios,
    planes: c.planes,
    plan_hogar: c.planHogar,
    nodo_hogar: c.nodoHogar,
    renta_hogar_soles: c.rentaHogar,
    renta_mensual_soles: c.rentaMensual,
    segmento_valor: c.segmentoValor,
    score_riesgo: c.scoreRiesgo,
    nivel_riesgo: c.nivelRiesgo,
    tickets_30d: c.tickets30d,
    fallas_red_30d: c.fallasRed30d,
    reclamos_abiertos: c.reclamosAbiertos,
    reclamo_abierto: c.reclamoAbiertoId ? `${c.reclamoAbiertoId}: ${c.reclamoAbiertoDetalle}` : null,
    consulta_portabilidad_30d: c.consultaPortabilidad30d,
    fecha_consulta_portabilidad: c.fechaUltimaConsultaPortabilidad?.toISOString().slice(0, 10) ?? null,
    operador_consultado: c.operadorConsultado,
    afectado_incidencia_masiva: c.afectadoIncidenciaMasiva,
    incidencia_masiva_id: c.incidenciaMasivaId,
    deuda_vencida_60d: c.deudaVencida60d,
    elegible_retencion: c.elegibleRetencion,
  };
}

function makeTools(ctx: AgentContext): Tool[] {
  const askMas = tool({
    name: 'ask_mas',
    description:
      'Consulta al Copiloto Supervisor de Integratel, que combina DATOS (Genie: tickets, reclamos, churn, nodos, incidencias) y DOCUMENTOS oficiales (Knowledge Assistant: política de retención 2026, guía de reclamos y compensaciones, manual técnico, portabilidad, comunicado de la incidencia de Cayma). Úsalo para qué dice la política/normativa y para cifras agregadas. Devuelve la respuesta con citas.',
    parameters: z.object({
      question: z.string().describe('Pregunta completa y autocontenida en español (incluye el contexto del cliente si aplica).'),
    }),
    execute: async ({ question }) =>
      mlflow.withSpan(async () => callMasEndpoint(ctx, ctx.masEndpointName, question), {
        name: 'ask_mas',
        spanType: mlflow.SpanType.TOOL,
        inputs: { question },
      }),
  });

  const buscarCliente = tool({
    name: 'buscar_cliente',
    description:
      'Ficha 360 de un cliente desde Lakebase (solo lectura): planes, nodo, renta, segmento, score y nivel de riesgo, tickets, reclamos, consulta de portabilidad, incidencia masiva, deuda y elegibilidad de retención. Acepta el id (CLI-xxxxxx) o parte del nombre.',
    parameters: z.object({
      texto: z.string().describe('cliente_id (ej. CLI-104217) o nombre/apellido del cliente.'),
    }),
    execute: async ({ texto }) =>
      mlflow.withSpan(
        async () => {
          const rows = await buscarClientes(ctx.db, texto);
          return rows.length ? { encontrados: rows.map(fichaCliente) } : { encontrados: [], mensaje: `No hay clientes activos que coincidan con "${texto}".` };
        },
        { name: 'buscar_cliente', spanType: mlflow.SpanType.TOOL, inputs: { texto } },
      ),
  });

  const listarRiesgo = tool({
    name: 'listar_clientes_riesgo',
    description: 'Lista (solo lectura) los clientes activos de mayor riesgo de fuga, ordenados por score. Filtros opcionales por nivel, distrito o nodo.',
    parameters: z.object({
      nivel: z.enum(['Crítico', 'Alto', 'Medio']).nullable().describe('Nivel de riesgo exacto; null = Crítico, Alto y Medio.'),
      distrito: z.string().nullable().describe('Distrito, ej. Cayma. Null = todos.'),
      nodo: z.string().nullable().describe('Nodo de red, ej. AQP-CAY-03. Null = todos.'),
      limite: z.number().nullable().describe('Cantidad máxima (default 10, máx 50).'),
    }),
    execute: async ({ nivel, distrito, nodo, limite }) =>
      mlflow.withSpan(
        async () => {
          const rows = await listClientes(ctx.db, {
            nivel: nivel ?? undefined,
            distrito: distrito ?? undefined,
            nodo: nodo ?? undefined,
            limit: Math.min(limite ?? 10, 50),
          });
          return { total: rows.length, clientes: rows.map(fichaCliente) };
        },
        { name: 'listar_clientes_riesgo', spanType: mlflow.SpanType.TOOL, inputs: { nivel, distrito, nodo, limite } },
      ),
  });

  const registrarPlan = tool({
    name: 'registrar_plan_retencion',
    description:
      'ESCRITURA. Registra un plan de retención en Lakebase. Llamar SOLO después de que el usuario apruebe explícitamente el borrador. El sistema valida la política (máx. 2 beneficios, topes de descuento, deuda, 1 retención/6 meses), calcula la compensación regulatoria y decide si requiere aprobación del Supervisor. Si devuelve ok=false, explica el motivo al usuario.',
    parameters: z.object({
      cliente_id: z.string().describe('ID del cliente, ej. CLI-104217.'),
      ofertas: z
        .array(
          z.object({
            codigo: z.enum(['R1', 'R2', 'R3', 'R4']).describe('R1 descuento, R2 upgrade de velocidad, R3 bono de datos, R4 visita técnica prioritaria.'),
            detalle: z.string().describe('Detalle legible, ej. "Upgrade FIB-400 → FIB-600 por 12 meses sin costo".'),
            descuento_pct: z.number().nullable().describe('Solo para R1: porcentaje de descuento sobre la renta hogar (ej. 25). Null en otras ofertas.'),
          }),
        )
        .describe('Beneficios comerciales (máximo 2). La compensación regulatoria NO va aquí.'),
      dias_interrupcion: z.number().nullable().describe('Días sin servicio a compensar (compensación = renta hogar × días / 30). Null si no aplica.'),
      guion_contacto: z.string().describe('Guion breve para la llamada: empático, explica la compensación y la oferta, sin condicionar la portabilidad.'),
    }),
    execute: async ({ cliente_id, ofertas, dias_interrupcion, guion_contacto }) =>
      mlflow.withSpan(
        async () =>
          registrarPlanRetencion(ctx.db, {
            clienteId: cliente_id,
            ofertas,
            diasInterrupcion: dias_interrupcion,
            guionContacto: guion_contacto,
            userEmail: ctx.userEmail,
          }),
        { name: 'registrar_plan_retencion', spanType: mlflow.SpanType.TOOL, inputs: { cliente_id, ofertas, dias_interrupcion } },
      ),
  });

  const tools: Tool[] = [buscarCliente, listarRiesgo, registrarPlan];
  if (ctx.masEndpointName) tools.unshift(askMas);
  return tools;
}

export async function configureAgentsSdk(ctx: AgentContext): Promise<void> {
  const headers = await authHeaders(ctx.req);
  const bearer = headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';

  // CRITICAL: This workspace uses Chat Completions for Claude models.
  // Configure SDK to use Chat Completions, not Responses API.
  setOpenAIAPI('chat_completions');

  // Custom fetch with Connection: close to avoid stale-socket issues
  const client = new OpenAI({
    apiKey: bearer,
    baseURL: `${ctx.databricksHost}/serving-endpoints`,
    maxRetries: 4,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('Connection', 'close');
      let body = init?.body;

      // Clean up long IDs and annotations
      if (typeof body === 'string' && body.startsWith('{')) {
        try {
          const parsed = JSON.parse(body) as {
            input?: Array<Record<string, unknown>>;
            messages?: Array<Record<string, unknown>>;
          };
          if (Array.isArray(parsed.input)) {
            for (const item of parsed.input) {
              const id = item.id;
              if (typeof id === 'string' && id.length > 64) {
                delete item.id;
              }
            }
          }
          if (Array.isArray(parsed.messages)) {
            for (const m of parsed.messages) {
              const content = (m as { content?: unknown }).content;
              if (Array.isArray(content)) {
                for (const part of content as Array<Record<string, unknown>>) {
                  if (part && typeof part === 'object') {
                    delete part.annotations;
                  }
                }
              }
            }
          }
          body = JSON.stringify(parsed);
        } catch {
          /* not JSON — pass through */
        }
      }

      const url =
        typeof input === 'string'
          ? input
          : (input as URL | Request).toString?.() ?? String(input);
      console.debug(
        `[openai-shim] → ${url}\n  request_body: ${typeof body === 'string' ? body.slice(0, 2000) : '(non-string)'}`,
      );

      const tShim = Date.now();
      let resp: Response;
      try {
        resp = await fetch(input as Parameters<typeof fetch>[0], {
          ...init,
          headers,
          body,
          keepalive: false,
        });
      } catch (e) {
        console.error('[openai-shim] fetch threw', { url, error: e });
        throw e;
      }

      console.debug(
        `[openai-shim] ← ${resp.status} in ${Date.now() - tShim}ms`,
      );

      if (!resp.ok) {
        const bodyText = await resp.clone().text();
        let code: string | undefined, message: string | undefined;
        try {
          const parsed = JSON.parse(bodyText) as Record<string, unknown>;
          const error = parsed.error as Record<string, unknown>;
          if (error && typeof error === 'object') {
            code = error.code as string;
            message = error.message as string;
          }
        } catch {
          /* */
        }
        if (ctx.modelError) {
          ctx.modelError.current = { status: resp.status, url, bodyText, code, message };
        }
      }

      return resp;
    },
  });

  setDefaultOpenAIClient(client);
}

export function buildRetentionAgent(ctx: AgentContext): Agent {
  const instructions = `Eres el copiloto de la ejecutiva de retención de Integratel Perú (${ctx.userEmail}).
Respondes SIEMPRE en español, claro y breve, con cifras en soles (S/) y citando el documento cuando hables de política.
Fecha de hoy para el negocio: 15-oct-2026.

## Herramientas
- buscar_cliente / listar_clientes_riesgo: hechos del cliente desde Lakebase (rápido, úsalo primero).
- ask_mas: el Copiloto Supervisor (datos con Genie + documentos con Knowledge Assistant). Úsalo para la política,
  la normativa de reclamos/compensaciones, la portabilidad y el detalle de tickets/incidencias. Haz UNA pregunta completa
  que incluya el perfil del cliente (segmento, plan, incidencia, consulta de portabilidad, días sin servicio).
- registrar_plan_retencion: ESCRITURA. Solo tras aprobación explícita del usuario.

## Modo A — Investigar (ej. "¿por qué X está en riesgo?")
1. buscar_cliente → 2. ask_mas con el perfil → 3. Responde: por qué está en riesgo (hechos) y qué permite la política.

## Modo B — Preparar plan (ej. "prepara el plan")
Redacta un BORRADOR con: beneficios comerciales (máx. 2), compensación regulatoria aparte (renta hogar × días / 30, usando
los días sin servicio que el cliente reclama en su reclamo abierto; si no hay reclamo, pregunta los días),
quién aprueba, y un guion de llamada de 4–6 líneas. Termina preguntando: "¿Apruebas que lo registre?". NO registres todavía.

## Modo C — Ejecutar (el usuario dice sí / apruebo / registra)
Llama a registrar_plan_retencion con el plan aprobado (si el usuario cambia el % de descuento, úsalo). Informa el estado
devuelto: "Aprobada" o "Pendiente aprobación supervisor" (descuento R1 > 25% → lo aprueba el Supervisor de Retención,
Jorge Paredes). Si devuelve ok=false, explica el motivo y propone una alternativa válida.

## Reglas que nunca rompes
- Nunca condiciones, demores ni desalientes la portabilidad: la oferta es voluntaria. Contactar ≤ 24 h desde la consulta.
- Sin retención si hay deuda vencida > 60 días o retención en los últimos 6 meses.
- No inventes cifras: usa las herramientas.`;

  return new Agent({
    name: 'copiloto_retencion',
    model: ctx.model,
    instructions,
    tools: makeTools(ctx),
  });
}

export { run };
