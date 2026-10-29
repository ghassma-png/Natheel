CREATE TABLE "docs" (
	"path" text PRIMARY KEY,
	"collection" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "docs_collection_idx" ON "docs" ("collection");