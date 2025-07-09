export interface Env {
  R2_OUTPUTS: R2Bucket
  R2_PROMPTS: R2Bucket
  DB: D1Database
  KV: KVNamespace
  ACCESS_PASSWORD: string
  OPENAI_API_KEY: string
  REPLICATE_API_TOKEN: string
  ARGIL_API_KEY: string
  ARGIL_WEBHOOK_SECRET: string
  MODAL_API_URL?: string
  MODAL_API_TOKEN?: string
  MODAL_WEBHOOK_SECRET?: string
  CLOUDFLARE_WORKER_URL?: string
  ENVIRONMENT: string
}
