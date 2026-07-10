import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import App from './App';
import './index.css';

const client = new ApolloClient({
  uri: `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/graphql`,
  cache: new InMemoryCache(),
  defaultOptions: { watchQuery: { fetchPolicy: 'network-only' } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>
);
