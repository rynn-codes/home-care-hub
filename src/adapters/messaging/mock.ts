import {
  MessagingDisabledError,
  type ExternalContactRef,
  type MessageSendResult,
  type MessagingContactInput,
  type MessagingProvider,
  type OutboundMessageInput,
} from "@/adapters/messaging/types";

export interface MockMessagingOptions {
  /** Mirrors SPRUCE_ENABLED. Off by default, matching the real flag. */
  enabled?: boolean;
  /** Force failures, to exercise the retry and error paths. */
  failWith?: { errorCode: string; errorMessage: string; retryable: boolean } | null;
  now?: () => Date;
}

/**
 * In-memory messaging provider.
 *
 * Section 34 step 8 asks for the provider interface and a mock before the live
 * Spruce adapter, so the whole notification path — queue, send, fail, retry —
 * can be built and tested before credentials exist. Section 48 requires an
 * "assessment saved but Spruce fails" test, which needs a provider that can be
 * told to fail on demand.
 *
 * Records everything it was asked to do so tests can assert on it.
 */
export function createMockMessagingProvider(options: MockMessagingOptions = {}) {
  const { enabled = false, failWith = null, now = () => new Date() } = options;

  const contacts = new Map<string, ExternalContactRef>();
  const sent: OutboundMessageInput[] = [];
  /** Keyed by idempotency key, so a replay returns the original result. */
  const results = new Map<string, MessageSendResult>();
  let counter = 0;

  const provider: MessagingProvider & {
    sentMessages: OutboundMessageInput[];
    sendCount: () => number;
  } = {
    name: "mock",
    sentMessages: sent,
    sendCount: () => sent.length,

    async upsertContact(input: MessagingContactInput): Promise<ExternalContactRef> {
      if (!enabled) throw new MessagingDisabledError("mock");

      const existing = contacts.get(input.personId);
      if (existing) return existing;

      const ref = { externalId: `mock-contact-${input.personId}` };
      contacts.set(input.personId, ref);
      return ref;
    },

    async sendMessage(input: OutboundMessageInput): Promise<MessageSendResult> {
      if (!enabled) throw new MessagingDisabledError("mock");

      // Idempotency. A retried outbox attempt for a message that already went
      // out must not send a second copy to the family.
      const prior = results.get(input.idempotencyKey);
      if (prior) return prior;

      if (failWith) {
        const failure: MessageSendResult = {
          status: "failed",
          errorCode: failWith.errorCode,
          errorMessage: failWith.errorMessage,
          retryable: failWith.retryable,
        };
        // Failures are not memoised: the point of a retry is to try again.
        return failure;
      }

      counter += 1;
      const result: MessageSendResult = {
        status: "sent",
        providerMessageId: `mock-msg-${counter}`,
        sentAt: now().toISOString(),
      };
      results.set(input.idempotencyKey, result);
      sent.push(input);
      return result;
    },
  };

  return provider;
}

export type MockMessagingProvider = ReturnType<typeof createMockMessagingProvider>;
