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
  
  let isValid = false
  
  // Method 1: Direct comparison (for simple passwords without special chars)
  if (token === expectedPassword) {
    isValid = true
  }
  
  // Method 2: Base64 encoded token (RECOMMENDED for passwords with special chars)
  // Client sends: base64(password) as Bearer token
  if (!isValid) {
    try {
      const decodedToken = atob(token)
      if (decodedToken === expectedPassword) {
        isValid = true
        console.log('✅ Authentication successful via base64 decoded token')
      }
    } catch (error) {
      // Token is not valid base64, continue to next method
    }
  }
  
  // Method 3: Base64 encoded expected password (alternative approach)
  // Server compares with base64(expected_password) 
  if (!isValid) {
    try {
      const base64Expected = btoa(expectedPassword)
      if (token === base64Expected) {
        isValid = true
        console.log('✅ Authentication successful via base64 encoded expected password')
      }
    } catch (error) {
      // Base64 encoding failed, continue
    }
  }
  
  if (!isValid) {
    console.log(`❌ Authentication failed. Token: "${token.substring(0, 10)}..." Expected: "${expectedPassword.substring(0, 10)}..."`)
    return c.json({ error: 'Invalid password' }, 401)
  }
  
  await next()
}