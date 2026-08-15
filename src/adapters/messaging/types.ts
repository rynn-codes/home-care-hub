/**
 * Messaging provider port.
 *
 * Section 5: external systems sit behind adapters, and vendor SDK calls must not
 * be scattered through React components. Section 16 draws the boundary — Joy
 * owns workflow state, Spruce owns client, family and employee messaging.
 *
 * The shape here is deliberately narrow. Everything Joy needs from a messaging
 * provider is "make sure this person exists" and "send them this", plus an
 * honest answer about whether it worked.
 */

export type MessageChannel = "sms" | "email" | "voice" | "in_app";

export interface MessagingContactInput {
  personId: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}

export interface ExternalContactRef {
  externalId: string;
}

export interface OutboundMessageInput {
  /** Idempotency: the same key must never send twice. */
  idempotencyKey: string;
  channel: MessageChannel;
  toExternalId: string;
  templateKey: string;
  variables: Record<string, string>;
}

/**
 * The result of a send.
 *
 * A success MUST carry the provider's own message id. Section 23's rule
 * generalises: never show an action as successful unless the integration
 * actually confirms it, and a confirmation without an id from the provider is
 * not a confirmation.
 */
export type MessageSendResult =
  | { status: "sent"; providerMessageId: string; sentAt: string }
  | { status: "failed"; errorCode: string; errorMessage: string; retryable: boolean };

export interface MessagingProvider {
  readonly name: string;
  upsertContact(input: MessagingContactInput): Promise<ExternalContactRef>;
  sendMessage(input: OutboundMessageInput): Promise<MessageSendResult>;
}

/**
 * Thrown when messaging is called while its feature flag is off.
 *
 * Section 41: the app must remain usable when integrations are disabled, and it
 * must never show fake success. A disabled provider therefore fails loudly
 * rather than pretending to send — the notification stays queued and visible.
 */
export class MessagingDisabledError extends Error {
  constructor(providerName: string) {
    super(
      `${providerName} messaging is turned off. The message stays queued and nothing was sent.`,
    );
    this.name = "MessagingDisabledError";
  }
}
