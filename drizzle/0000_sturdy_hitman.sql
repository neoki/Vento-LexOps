CREATE TYPE "public"."action_status" AS ENUM('PENDING', 'APPROVED', 'EXECUTED', 'SKIPPED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."action_type" AS ENUM('UPLOAD_INVENTO', 'CREATE_NOTE', 'CREATE_EVENT', 'SEND_EMAIL_LAWYER', 'SEND_EMAIL_CLIENT', 'REQUEST_POWER', 'DOWNLOAD_LINK', 'DETECT_COLLISION');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('ONLINE', 'OFFLINE', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('OPENAI', 'GEMINI');--> statement-breakpoint
CREATE TYPE "public"."execution_plan_status" AS ENUM('DRAFT', 'PROPOSED', 'IN_REVIEW', 'APPROVED', 'EXECUTED', 'CANCELLED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'TRIAGE_REQUIRED', 'REVIEWED', 'SYNCED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."package_status" AS ENUM('DOWNLOADING', 'INCOMPLETE', 'READY_FOR_ANALYSIS', 'ANALYZED', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'LAWYER', 'ASSISTANT');--> statement-breakpoint
CREATE TABLE "agent_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"office_id" integer,
	"status" "agent_status" DEFAULT 'OFFLINE' NOT NULL,
	"last_heartbeat" timestamp,
	"host_info" jsonb,
	"certificate_thumbprint" text,
	"polling_interval_seconds" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_user_id" integer,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"outlook_category_name" text,
	"outlook_color" text,
	"email_highlight_color" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "deadline_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"procedure_type" text NOT NULL,
	"act_type" text,
	"deadline_days" integer NOT NULL,
	"is_business_days" boolean DEFAULT true,
	"august_exempt" boolean DEFAULT false,
	"description" text,
	"derived_events" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" integer,
	"notification_id" integer,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"renamed_name" text,
	"file_path" text NOT NULL,
	"file_hash" text,
	"file_size" integer,
	"mime_type" text,
	"is_primary" boolean DEFAULT false,
	"is_receipt" boolean DEFAULT false,
	"extracted_text" text,
	"requires_ocr" boolean DEFAULT false,
	"sequence_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text,
	"subject_template" text NOT NULL,
	"body_template" text NOT NULL,
	"is_html" boolean DEFAULT true,
	"variables" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "event_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"event_type" text NOT NULL,
	"title_template" text NOT NULL,
	"is_all_day" boolean DEFAULT false,
	"duration_minutes" integer,
	"reminder_minutes" integer,
	"variables" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "execution_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"action_type" "action_type" NOT NULL,
	"action_order" integer NOT NULL,
	"status" "action_status" DEFAULT 'PENDING' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"config" jsonb,
	"preview_data" jsonb,
	"execution_result" jsonb,
	"error_message" text,
	"approved_by" integer,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" integer NOT NULL,
	"status" "execution_plan_status" DEFAULT 'DRAFT' NOT NULL,
	"proposed_by" text DEFAULT 'AI',
	"proposed_at" timestamp DEFAULT now(),
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"approved_by" integer,
	"approved_at" timestamp,
	"executed_at" timestamp,
	"cancelled_by" integer,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"invento_config" jsonb,
	"outlook_config" jsonb,
	"email_config" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_id" integer,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"is_national" boolean DEFAULT false,
	"region" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp,
	"scopes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexnet_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"access_method" text NOT NULL,
	"certificate_thumbprint" text,
	"status" text DEFAULT 'ACTIVE',
	"last_successful_login" timestamp,
	"last_download" timestamp,
	"agent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lexnet_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"package_id" text NOT NULL,
	"lawyer_id" integer NOT NULL,
	"agent_id" integer,
	"lexnet_ids" jsonb,
	"download_date" timestamp NOT NULL,
	"status" "package_status" DEFAULT 'DOWNLOADING' NOT NULL,
	"zip_path" text,
	"zip_hash" text,
	"receipt_path" text,
	"receipt_hash" text,
	"has_receipt" boolean DEFAULT false,
	"extracted_path" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lexnet_packages_package_id_unique" UNIQUE("package_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"lexnet_id" text NOT NULL,
	"package_id" integer,
	"received_date" timestamp NOT NULL,
	"downloaded_date" timestamp,
	"court" text NOT NULL,
	"procedure_type" text,
	"procedure_number" text NOT NULL,
	"act_type" text,
	"parties" jsonb,
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"priority" "priority" DEFAULT 'MEDIUM' NOT NULL,
	"doc_type" text,
	"ai_confidence" integer,
	"ai_reasoning" jsonb,
	"ai_evidences" jsonb,
	"extracted_deadlines" jsonb,
	"extracted_dates" jsonb,
	"suggested_case_id" text,
	"suggested_case_confidence" integer,
	"assigned_lawyer_id" integer,
	"invento_case_id" text,
	"invento_instance" text,
	"invento_folder" text,
	"has_zip" boolean DEFAULT false,
	"has_receipt" boolean DEFAULT false,
	"triage_assigned_to" integer,
	"triage_resolved_by" integer,
	"triage_resolved_at" timestamp,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid',
	"common_calendar_id" text,
	"teams_channel_id" text,
	"generic_email" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offices_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rejected_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"lawyer_id" integer NOT NULL,
	"lexnet_id" text,
	"rejection_reason" text,
	"rejection_code" text,
	"detected_at" timestamp NOT NULL,
	"status" text DEFAULT 'DETECTED',
	"retry_count" integer DEFAULT 0,
	"last_retry_at" timestamp,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"office_id" integer,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_ai_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" "ai_provider" DEFAULT 'GEMINI' NOT NULL,
	"api_key" text,
	"model_preferences" jsonb,
	"temperature" numeric(3, 2) DEFAULT '0.7',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "user_role" DEFAULT 'ASSISTANT' NOT NULL,
	"office_id" integer,
	"team_id" integer,
	"category_id" integer,
	"tutor_user_id" integer,
	"teams_user_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_logs" ADD CONSTRAINT "agent_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_package_id_lexnet_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."lexnet_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_actions" ADD CONSTRAINT "execution_actions_plan_id_execution_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."execution_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_actions" ADD CONSTRAINT "execution_actions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD CONSTRAINT "execution_plans_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD CONSTRAINT "execution_plans_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD CONSTRAINT "execution_plans_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_plans" ADD CONSTRAINT "execution_plans_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_tokens" ADD CONSTRAINT "integration_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexnet_accounts" ADD CONSTRAINT "lexnet_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexnet_accounts" ADD CONSTRAINT "lexnet_accounts_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexnet_packages" ADD CONSTRAINT "lexnet_packages_lawyer_id_users_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lexnet_packages" ADD CONSTRAINT "lexnet_packages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_package_id_lexnet_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."lexnet_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assigned_lawyer_id_users_id_fk" FOREIGN KEY ("assigned_lawyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_triage_assigned_to_users_id_fk" FOREIGN KEY ("triage_assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_triage_resolved_by_users_id_fk" FOREIGN KEY ("triage_resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejected_items" ADD CONSTRAINT "rejected_items_lawyer_id_users_id_fk" FOREIGN KEY ("lawyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rejected_items" ADD CONSTRAINT "rejected_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_settings" ADD CONSTRAINT "user_ai_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;