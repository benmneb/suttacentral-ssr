// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

export const onRequest = defineMiddleware(async (context, next) => {
  const startTime = performance.now()

  Object.defineProperty(context.locals, 'renderTime', {
    get() {
      return ((performance.now() - startTime) / 1000).toFixed(2)
    },
  })

  const response = await next()

  return response
})
