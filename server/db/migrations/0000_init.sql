CREATE TABLE IF NOT EXISTS "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_color" text NOT NULL,
	"message" text NOT NULL,
	"frame_id" text,
	"at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_refs" (
	"asset_id" text NOT NULL,
	"frame_id" text NOT NULL,
	CONSTRAINT "asset_refs_asset_id_frame_id_pk" PRIMARY KEY("asset_id","frame_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text,
	"owner_id" text,
	"mime" text NOT NULL,
	"ext" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "canvas_members" (
	"canvas_id" text NOT NULL,
	"user_id" text NOT NULL,
	"added_by" text NOT NULL,
	"added_at" bigint NOT NULL,
	CONSTRAINT "canvas_members_canvas_id_user_id_pk" PRIMARY KEY("canvas_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "canvases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text,
	"link_access" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"frame_id" text NOT NULL,
	"selector" text NOT NULL,
	"snippet" text NOT NULL,
	"from_name" text NOT NULL,
	"text" text NOT NULL,
	"at" bigint NOT NULL,
	"for_agent" boolean DEFAULT false NOT NULL,
	"target_agent" text,
	"claimed_by" text,
	"claimed_at" bigint,
	"failed_at" bigint,
	"failure_reason" text,
	"resolved_by" text,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"text" text NOT NULL,
	"summary" text,
	"source" text NOT NULL,
	"frame_id" text,
	"from_name" text NOT NULL,
	"agent_name" text,
	"at" bigint NOT NULL,
	"distilled_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"canvas_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"target_agent" text,
	"from_name" text NOT NULL,
	"text" text NOT NULL,
	"at" bigint NOT NULL,
	"delivered_at" bigint,
	"claimed_by" text,
	"completed_at" bigint,
	"failed_at" bigint,
	"failure_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "frames" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"name" text NOT NULL,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"width" double precision NOT NULL,
	"height" double precision NOT NULL,
	"html" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guideline_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"name" text NOT NULL,
	"markdown" text NOT NULL,
	"saved_at" bigint NOT NULL,
	"saved_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guidelines" (
	"canvas_id" text NOT NULL,
	"name" text NOT NULL,
	"markdown" text NOT NULL,
	"title" text,
	"updated_at" bigint NOT NULL,
	"updated_by" text NOT NULL,
	"x" double precision,
	"y" double precision,
	CONSTRAINT "guidelines_canvas_id_name_pk" PRIMARY KEY("canvas_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"guide_name" text NOT NULL,
	"guide_title" text,
	"rule" text NOT NULL,
	"rationale" text NOT NULL,
	"based_on" text NOT NULL,
	"at" bigint NOT NULL,
	"status" text NOT NULL,
	"resolved_by" text,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_references" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"frame_id" text NOT NULL,
	"title" text NOT NULL,
	"html" text NOT NULL,
	"width" double precision NOT NULL,
	"height" double precision NOT NULL,
	"pinned_by" text NOT NULL,
	"pinned_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resident_usage" (
	"user_id" text PRIMARY KEY NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"canvas_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"owner" text,
	"color" text NOT NULL,
	"status" text NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint,
	"auto" boolean DEFAULT false NOT NULL,
	"queued_by" text,
	"claimed_at" bigint,
	"failed_at" bigint,
	"failure_reason" text,
	"pipeline" text,
	"stage" integer,
	"attachments" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"client_id" text NOT NULL,
	"user_id" text,
	"scopes" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_access_token_access_token_unique" UNIQUE("access_token"),
	CONSTRAINT "oauth_access_token_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_application" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"metadata" text,
	"client_id" text NOT NULL,
	"client_secret" text,
	"redirect_urls" text NOT NULL,
	"type" text NOT NULL,
	"disabled" boolean DEFAULT false,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_consent" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scopes" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"consent_given" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'account' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'session' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_canvas_idx" ON "activity" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_refs_frame_idx" ON "asset_refs" USING btree ("frame_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_canvas_idx" ON "assets" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_canvas_idx" ON "comments" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decisions_canvas_idx" ON "decisions" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_canvas_idx" ON "feedback" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "frames_canvas_idx" ON "frames" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guideline_versions_doc_idx" ON "guideline_versions" USING btree ("canvas_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_proposals_canvas_idx" ON "memory_proposals" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_references_canvas_idx" ON "memory_references" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_canvas_idx" ON "tasks" USING btree ("canvas_id");
--> statement-breakpoint
ALTER TABLE "canvases" ADD COLUMN IF NOT EXISTS "owner_id" text;--> statement-breakpoint
ALTER TABLE "canvases" ADD COLUMN IF NOT EXISTS "link_access" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "owner" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "queued_by" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "claimed_at" bigint;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "failed_at" bigint;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "failure_reason" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "pipeline" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "stage" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "attachments" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "failed_at" bigint;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "failure_reason" text;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "completed_at" bigint;--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "target_agent" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "failed_at" bigint;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "failure_reason" text;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "target_agent" text;--> statement-breakpoint
ALTER TABLE "guidelines" ADD COLUMN IF NOT EXISTS "x" double precision;--> statement-breakpoint
ALTER TABLE "guidelines" ADD COLUMN IF NOT EXISTS "y" double precision;--> statement-breakpoint
ALTER TABLE "guidelines" ADD COLUMN IF NOT EXISTS "title" text;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN IF NOT EXISTS "summary" text;
