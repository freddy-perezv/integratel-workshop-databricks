CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."acciones_retencion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" text NOT NULL,
	"ofertas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compensacion_soles" double precision DEFAULT 0 NOT NULL,
	"requiere_aprobacion" boolean DEFAULT false NOT NULL,
	"aprobador" text,
	"estado" text DEFAULT 'Borrador' NOT NULL,
	"guion_contacto" text NOT NULL,
	"creado_por" text NOT NULL,
	"audit_trail" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app"."cliente_360" (
	"cliente_id" text PRIMARY KEY NOT NULL,
	"nombre_completo" text,
	"region" text,
	"provincia" text,
	"distrito" text,
	"estado" text,
	"fecha_alta" timestamp with time zone,
	"antiguedad_anios" double precision,
	"motivo_baja" text,
	"servicios_activos" integer,
	"planes" text,
	"tiene_hogar" boolean,
	"tecnologia_hogar" text,
	"plan_hogar" text,
	"renta_hogar" double precision,
	"nodo_hogar" text,
	"renta_mensual" double precision,
	"segmento_valor" text,
	"arpu_6m" double precision,
	"dias_atraso" integer,
	"deuda_vencida_60d" boolean,
	"tickets_30d" integer,
	"fallas_red_30d" integer,
	"tickets_abiertos" integer,
	"reclamos_abiertos" integer,
	"reclamos_90d" integer,
	"consulta_portabilidad_30d" boolean,
	"fecha_ultima_consulta_portabilidad" timestamp with time zone,
	"operador_consultado" text,
	"incidencia_masiva_id" text,
	"afectado_incidencia_masiva" boolean,
	"fecha_ultima_retencion" timestamp with time zone,
	"elegible_retencion" boolean,
	"score_riesgo" double precision,
	"nivel_riesgo" text,
	"sincronizado_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" text NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"value" text NOT NULL,
	"rationale" text,
	"trace_id" text,
	"mlflow_assessment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"trace_id" text,
	"thinking" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"canceled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."feedback" ADD CONSTRAINT "feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "app"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "app"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acciones_cliente_idx" ON "app"."acciones_retencion" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "acciones_estado_idx" ON "app"."acciones_retencion" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "acciones_created_idx" ON "app"."acciones_retencion" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cliente_nivel_riesgo_idx" ON "app"."cliente_360" USING btree ("nivel_riesgo");--> statement-breakpoint
CREATE INDEX "cliente_distrito_idx" ON "app"."cliente_360" USING btree ("distrito");--> statement-breakpoint
CREATE INDEX "cliente_score_riesgo_idx" ON "app"."cliente_360" USING btree ("score_riesgo");--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "app"."conversations" USING btree ("user_email","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_kind_idx" ON "app"."conversations" USING btree ("user_email","kind");--> statement-breakpoint
CREATE INDEX "feedback_message_idx" ON "app"."feedback" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_convo_pos_uq" ON "app"."messages" USING btree ("conversation_id","position");