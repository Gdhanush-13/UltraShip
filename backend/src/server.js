const express = require('express');
const cors = require('cors');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const bodyParser = require('body-parser');
const { initDb } = require('./db');
const { typeDefs } = require('./schema');
const { resolvers } = require('./resolvers');

async function startServer() {
  await initDb();

  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: allowedOrigin }));
  app.use('/graphql', bodyParser.json(), expressMiddleware(server));
  app.get('/health', (_, res) => res.json({ status: 'ok', service: 'ultraship-ledger' }));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`UltraShip Ledger API running at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch(console.error);
