import { Context, Next } from 'hono'

export async function errorHandler(c: Context, next: Next) {
  try {
    await next()
  } catch (err) {
    console.error('Error:', err)
    
    if (err instanceof Error) {
      return c.json({
        error: err.message,
        stack: c.env?.ENVIRONMENT === 'development' ? err.stack : undefined
      }, 500)
    }
    
    return c.json({ error: 'Internal server error' }, 500)
  }
}