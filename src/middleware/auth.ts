import { Context, Next } from 'hono'
import type { Env } from '../types/env'

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401)
  }
  
  const token = authHeader.split(' ')[1]
  const expectedPassword = c.env.ACCESS_PASSWORD
  
  if (!expectedPassword) {
    console.error('ACCESS_PASSWORD not configured')
    return c.json({ error: 'Server configuration error' }, 500)
  }
  
  
  if (token !== expectedPassword) {
    return c.json({ error: 'Invalid password' }, 401)
  }
  
  await next()
}