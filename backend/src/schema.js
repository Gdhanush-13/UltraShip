const { gql } = require('graphql-tag');

const typeDefs = gql`
  type Account {
    id: ID!
    name: String!
    type: AccountType!
    currency: String!
    balanceCents: Int!
    createdAt: String!
  }

  enum AccountType {
    asset
    liability
    equity
    revenue
    expense
  }

  type LedgerTransaction {
    id: ID!
    description: String!
    reference: String
    entries: [LedgerEntry!]!
    createdAt: String!
  }

  type LedgerEntry {
    id: ID!
    transactionId: ID!
    account: Account!
    amountCents: Int!
    entryType: EntryType!
    createdAt: String!
  }

  enum EntryType {
    debit
    credit
  }

  type Invoice {
    id: ID!
    payerAccount: Account!
    payeeAccount: Account!
    description: String!
    dueDate: String!
    status: InvoiceStatus!
    currency: String!
    totalCents: Int!
    paidCents: Int!
    remainingCents: Int!
    lineItems: [InvoiceLineItem!]!
    payments: [InvoicePayment!]!
    createdAt: String!
  }

  enum InvoiceStatus {
    draft
    sent
    paid
    overdue
  }

  type InvoiceLineItem {
    id: ID!
    invoiceId: ID!
    description: String!
    quantity: Int!
    unitPriceCents: Int!
    amountCents: Int!
  }

  type InvoicePayment {
    id: ID!
    invoiceId: ID!
    transaction: LedgerTransaction
    amountCents: Int!
    idempotencyKey: String!
    createdAt: String!
  }

  input LineItemInput {
    description: String!
    quantity: Int!
    unitPriceCents: Int!
  }

  type Query {
    accounts: [Account!]!
    account(id: ID!): Account
    ledgerTransactions: [LedgerTransaction!]!
    ledgerTransaction(id: ID!): LedgerTransaction
    invoices: [Invoice!]!
    invoice(id: ID!): Invoice
  }

  type Mutation {
    createAccount(name: String!, type: AccountType!, currency: String): Account!
    recordTransaction(
      debitAccountId: ID!
      creditAccountId: ID!
      amountCents: Int!
      description: String!
      reference: String
    ): LedgerTransaction!
    createInvoice(
      payerAccountId: ID!
      payeeAccountId: ID!
      description: String!
      dueDate: String!
      currency: String
      lineItems: [LineItemInput!]!
    ): Invoice!
    updateInvoiceStatus(id: ID!, status: InvoiceStatus!): Invoice!
    applyPayment(
      invoiceId: ID!
      amountCents: Int!
      idempotencyKey: String!
    ): InvoicePayment!
    markOverdueInvoices: Int!
  }
`;

module.exports = { typeDefs };
