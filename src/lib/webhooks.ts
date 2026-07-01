/**
 * Webhook dispatch system.
 *
 * Fires outbound HTTP POSTs to user-registered endpoints when events occur.
 * Supports Slack-formatted payloads and generic JSON webhooks with HMAC signing.
 */

import { prisma } from './prisma';
import crypto from 'crypto';

export type WebhookEvent =
  | 'artifact.created'
  | 'artifact.versioned'
  | 'artifact.approved'
  | 'query.completed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Dispatch a webhook event to all active endpoints registered for this user + event.
 * Fire-and-forget — failures are logged but don't block the caller.
 */
export function dispatchWebhooks(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): void {
  // Intentionally not awaited — fire and forget
  dispatchAsync(userId, event, data).catch(err =>
    console.error('[webhooks] dispatch failed:', err),
  );
}

async function dispatchAsync(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      userId,
      isActive: true,
      events: { has: event },
    },
  });

  if (endpoints.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-GovSecure-Event': event,
      };

      // HMAC signature for verification
      if (endpoint.secret) {
        const signature = crypto
          .createHmac('sha256', endpoint.secret)
          .update(body)
          .digest('hex');
        headers['X-GovSecure-Signature'] = `sha256=${signature}`;
      }

      // Detect Slack webhook URLs and format accordingly
      const isSlack = endpoint.url.includes('hooks.slack.com');
      const finalBody = isSlack ? JSON.stringify(formatSlackPayload(payload)) : body;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers,
          body: finalBody,
          signal: controller.signal,
        });

        if (!response.ok) {
          console.warn(`[webhooks] ${endpoint.name} returned ${response.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }),
  );
}

/**
 * Format a webhook payload as a Slack Block Kit message.
 */
function formatSlackPayload(payload: WebhookPayload): { blocks: object[] } {
  const { event, data } = payload;

  const title =
    event === 'artifact.created'
      ? `:page_facing_up: New artifact generated`
      : event === 'artifact.versioned'
        ? `:arrows_counterclockwise: Artifact updated`
        : `:white_check_mark: Query completed`;

  const fields: { type: string; text: string }[] = [];

  if (data.title) fields.push({ type: 'mrkdwn', text: `*Title:*\n${data.title}` });
  if (data.type) fields.push({ type: 'mrkdwn', text: `*Type:*\n${data.type}` });
  if (data.riskTier) fields.push({ type: 'mrkdwn', text: `*Risk Tier:*\n${data.riskTier}` });
  if (data.version) fields.push({ type: 'mrkdwn', text: `*Version:*\nv${data.version}` });

  return {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: title },
      },
      ...(fields.length > 0
        ? [{ type: 'section', fields }]
        : []),
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `GovSecure • ${new Date().toLocaleDateString()}` },
        ],
      },
    ],
  };
}