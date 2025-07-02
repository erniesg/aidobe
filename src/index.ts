import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'
import { imageRoutes } from './handlers/image'
import { videoRoutes } from './handlers/video'
import { promptRoutes } from './handlers/prompt'
import { downloadRoutes } from './handlers/download'
import { mediaRoutes } from './handlers/media'
import type { Env } from './types/env'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors())
app.use('*', errorHandler)

app.get('/', (c) => {
  return c.json({
    name: 'aidobe',
    version: '1.0.0',
    description: 'AI-powered image and video generation platform',
    endpoints: {
      images: '/api/images',
      videos: '/api/videos',
      prompts: '/api/prompts',
      downloads: '/api/downloads',
      media: '/media'
    }
  })
})

const api = new Hono<{ Bindings: Env }>()
api.use('*', authMiddleware)

api.route('/images', imageRoutes)
api.route('/videos', videoRoutes)
api.route('/prompts', promptRoutes)
api.route('/downloads', downloadRoutes)

app.route('/api', api)
app.route('/media', mediaRoutes)

export default app