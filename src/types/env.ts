export interface Env {
  R2_OUTPUTS: R2Bucket
  R2_PROMPTS: R2Bucket
  DB: D1Database
  ACCESS_PASSWORD: string
  OPENAI_API_KEY: string
  REPLICATE_API_TOKEN: string
  ENVIRONMENT: string
}