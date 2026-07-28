export type Env = {
  DB: D1Database;
  FILES: R2Bucket;
  REMOTE_DB?: D1Database;
  REMOTE_FILES?: R2Bucket;
  APP_ENV: "local" | "preview" | "production";
  REMOTE_SYNC_ENABLED: string;
  SYNC_TOKEN?: string;
};
