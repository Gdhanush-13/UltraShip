import { gql } from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts {
    accounts {
      id name type currency balanceCents createdAt
    }
  }
`;

export const GET_TRANSACTIONS = gql`
  query GetTransactions {
    ledgerTransactions {
      id description reference createdAt
      entries { id entryType amountCents account { id name type } }
    }
  }
`;

export const GET_INVOICES = gql`
  query GetInvoices {
    invoices {
      id description dueDate status currency totalCents paidCents remainingCents createdAt
      payerAccount { id name }
      payeeAccount { id name }
    }
  }
`;

export const GET_INVOICE = gql`
  query GetInvoice($id: ID!) {
    invoice(id: $id) {
      id description dueDate status currency totalCents paidCents remainingCents createdAt
      payerAccount { id name }
      payeeAccount { id name }
      lineItems { id description quantity unitPriceCents amountCents }
      payments { id amountCents idempotencyKey createdAt }
    }
  }
`;

export const CREATE_ACCOUNT = gql`
  mutation CreateAccount($name: String!, $type: AccountType!, $currency: String) {
    createAccount(name: $name, type: $type, currency: $currency) {
      id name type currency balanceCents createdAt
    }
  }
`;

export const RECORD_TRANSACTION = gql`
  mutation RecordTransaction(
    $debitAccountId: ID!, $creditAccountId: ID!,
    $amountCents: Int!, $description: String!, $reference: String
  ) {
    recordTransaction(
      debitAccountId: $debitAccountId, creditAccountId: $creditAccountId,
      amountCents: $amountCents, description: $description, reference: $reference
    ) {
      id description createdAt
      entries { id entryType amountCents account { id name } }
    }
  }
`;

export const CREATE_INVOICE = gql`
  mutation CreateInvoice(
    $payerAccountId: ID!, $payeeAccountId: ID!,
    $description: String!, $dueDate: String!, $currency: String,
    $lineItems: [LineItemInput!]!
  ) {
    createInvoice(
      payerAccountId: $payerAccountId, payeeAccountId: $payeeAccountId,
      description: $description, dueDate: $dueDate, currency: $currency,
      lineItems: $lineItems
    ) {
      id description status totalCents dueDate createdAt
    }
  }
`;

export const UPDATE_INVOICE_STATUS = gql`
  mutation UpdateInvoiceStatus($id: ID!, $status: InvoiceStatus!) {
    updateInvoiceStatus(id: $id, status: $status) {
      id status
    }
  }
`;

export const APPLY_PAYMENT = gql`
  mutation ApplyPayment($invoiceId: ID!, $amountCents: Int!, $idempotencyKey: String!) {
    applyPayment(invoiceId: $invoiceId, amountCents: $amountCents, idempotencyKey: $idempotencyKey) {
      id amountCents idempotencyKey createdAt
    }
  }
`;

export const MARK_OVERDUE = gql`
  mutation MarkOverdue {
    markOverdueInvoices
  }
`;
