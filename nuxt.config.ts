// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  routeRules: {
    '/': { redirect: '/communications' },
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Call Analysis RAG — Коммуникации',
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: 'anonymous',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inder&family=Inter:wght@400;500;700&display=swap',
        },
      ],
    },
  },
})
