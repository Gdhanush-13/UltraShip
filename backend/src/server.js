const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const { initDb } = require('./db');
const { typeDefs } = require('./schema');
const { resolvers } = require('./resolvers');

const IS_PROD = process.env.NODE_ENV === 'production';

// Support comma-separated origins: "https://foo.vercel.app,http://localhost:3000"
function buildCorsOptions() {
  const raw = (process.env.CORS_ORIGIN || '').trim();
  if (!raw || raw === '*') {
    return { origin: '*', credentials: false };
  }
  const allowed = raw.split(',').map(o => o.trim()).filter(Boolean);
  return {
    origin(origin, cb) {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  };
}

async function startServer() {
  await initDb();

  const app = express();
  const corsOptions = buildCorsOptions();

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    formatError(formattedError) {
      if (IS_PROD) {
        return {
          message: formattedError.message,
          locations: formattedError.locations,
          path: formattedError.path,
          extensions: { code: formattedError.extensions?.code },
        };
      }
      return formattedError;
    },
  });
  await apolloServer.start();

  // OPTIONS preflight for all routes
  app.options('*', cors(corsOptions));
  app.use(cors(corsOptions));

  // Root info endpoint
  app.get('/', (_, res) => res.json({
    service: 'ultraship-ledger-api',
    version: '1.0.0',
    endpoints: { graphql: '/graphql', health: '/health' },
    docs: 'POST /graphql — Apollo GraphQL API',
  }));

  // Health check (used by Render)
  app.get('/health', (_, res) => res.json({
    status: 'ok',
    service: 'ultraship-ledger',
    env: process.env.NODE_ENV || 'development',
    ts: new Date().toISOString(),
  }));

  // GraphQL endpoint
  app.use(
    '/graphql',
    bodyParser.json({ limit: '2mb' }),
    expressMiddleware(apolloServer, { context: async () => ({}) }),
  );

  const PORT = process.env.PORT || 4000;
  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ultraship] API ready → http://0.0.0.0:${PORT}/graphql (${IS_PROD ? 'production' : 'development'})`);
  });

  // Graceful shutdown on Render SIGTERM
  process.on('SIGTERM', () => {
    console.log('[ultraship] SIGTERM received — shutting down gracefully');
    httpServer.close(() => {
      console.log('[ultraship] HTTP server closed');
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error('[ultraship] Fatal startup error:', err);
  process.exit(1);
});
