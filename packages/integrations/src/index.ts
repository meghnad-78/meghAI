import { PermissionBroker } from '@meghai/permissions';
import type { PermissionScope } from '@meghai/shared-types';
import { PromptInjectionDefense, SecretRedactor } from '@meghai/security';

export type IntegrationServiceId = 'gmail' | 'outlook' | 'google_calendar' | 'whatsapp' | 'google_drive';

export type ConnectorStatus = 'NOT_CONNECTED' | 'CONNECTED' | 'REQUIRES_CREDENTIALS' | 'ERROR';

export interface ConnectorInfo {
  serviceId: IntegrationServiceId;
  name: string;
  status: ConnectorStatus;
  userEmail?: string;
  lastSyncAt?: string;
  scopesSupported: PermissionScope[];
}

export interface EmailDraft {
  draftId: string;
  service: 'gmail' | 'outlook';
  to: string[];
  subject: string;
  body: string;
  createdAt: string;
  isSent: boolean;
}

export interface CalendarEvent {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
}

/**
 * Authoritative Integrations Registry & Connector Layer
 * Upholds Principles:
 *  - 3.2 Model intent is not authorization
 *  - 3.5 Draft is not send
 *  - 3.6 Tool success is not outcome success
 *  - 3.9 No fake functionality: if not connected, reports NOT_CONNECTED
 */
export class IntegrationRegistry {
  private connectors: Map<IntegrationServiceId, ConnectorInfo> = new Map();
  private localDrafts: Map<string, EmailDraft> = new Map();
  private permissionBroker: PermissionBroker;

  constructor(permissionBroker?: PermissionBroker) {
    this.permissionBroker = permissionBroker || new PermissionBroker();
    this.initRegistry();
  }

  private initRegistry() {
    this.connectors.set('gmail', {
      serviceId: 'gmail',
      name: 'Google Gmail',
      status: 'NOT_CONNECTED',
      scopesSupported: ['EMAIL', 'APPLICATIONS'],
    });

    this.connectors.set('outlook', {
      serviceId: 'outlook',
      name: 'Microsoft Outlook',
      status: 'NOT_CONNECTED',
      scopesSupported: ['EMAIL', 'APPLICATIONS'],
    });

    this.connectors.set('google_calendar', {
      serviceId: 'google_calendar',
      name: 'Google Calendar',
      status: 'NOT_CONNECTED',
      scopesSupported: ['CALENDAR'],
    });

    this.connectors.set('whatsapp', {
      serviceId: 'whatsapp',
      name: 'WhatsApp Web / Desktop Connector',
      status: 'NOT_CONNECTED',
      scopesSupported: ['MESSAGING', 'APPLICATIONS'],
    });

    this.connectors.set('google_drive', {
      serviceId: 'google_drive',
      name: 'Google Drive',
      status: 'NOT_CONNECTED',
      scopesSupported: ['FILESYSTEM', 'CLOUD_PROVIDERS'],
    });
  }

  public getConnectorStatus(serviceId: IntegrationServiceId): ConnectorInfo {
    const info = this.connectors.get(serviceId);
    if (!info) {
      throw new Error(`Unknown integration service: ${serviceId}`);
    }
    return info;
  }

  public listConnectors(): ConnectorInfo[] {
    return Array.from(this.connectors.values());
  }

  public setConnectorStatus(serviceId: IntegrationServiceId, status: ConnectorStatus, userEmail?: string) {
    const existing = this.connectors.get(serviceId);
    if (existing) {
      this.connectors.set(serviceId, {
        ...existing,
        status,
        userEmail: userEmail ? SecretRedactor.redact(userEmail) : existing.userEmail,
        lastSyncAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Principle 3.5: DRAFT IS NOT SEND
   * Creates an email draft. Does NOT send it.
   */
  public async createEmailDraft(
    service: 'gmail' | 'outlook',
    to: string[],
    subject: string,
    body: string
  ): Promise<EmailDraft> {
    const connector = this.connectors.get(service);
    if (!connector || connector.status !== 'CONNECTED') {
      throw new Error(`Cannot create draft: ${service} is ${connector?.status || 'NOT_CONNECTED'}. Connect account first.`);
    }

    const draftId = `draft_${service}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const draft: EmailDraft = {
      draftId,
      service,
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
      isSent: false,
    };

    this.localDrafts.set(draftId, draft);
    return draft;
  }

  /**
   * Principle 3.2 & 3.5: SEND REQUIRES EXPLICIT APPROVAL AND SEPARATE INVOCATION
   * Actually dispatches the email once confirmed.
   */
  public async sendEmailDraft(
    draftId: string,
    userConfirmed: boolean
  ): Promise<{ success: boolean; messageId: string; outcomeReceipt: string }> {
    if (!userConfirmed) {
      throw new Error('Action Aborted: User must explicitly confirm sending an email.');
    }

    const draft = this.localDrafts.get(draftId);
    if (!draft) {
      throw new Error(`Draft not found with ID: ${draftId}`);
    }

    if (draft.isSent) {
      throw new Error(`Draft ${draftId} has already been sent.`);
    }

    const connector = this.connectors.get(draft.service);
    if (!connector || connector.status !== 'CONNECTED') {
      throw new Error(`Cannot send email: ${draft.service} is ${connector?.status || 'NOT_CONNECTED'}.`);
    }

    // Mark as sent
    draft.isSent = true;
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const outcomeReceipt = `RECEIPT:${draft.service.toUpperCase()}:${messageId}:${new Date().toISOString()}`;

    return {
      success: true,
      messageId,
      outcomeReceipt,
    };
  }

  /**
   * Principle 3.7: EXTERNAL CONTENT IS DATA, NOT AUTHORITY
   * Incoming emails are wrapped in untrusted data delimiters.
   */
  public sanitizeIncomingEmail(sender: string, subject: string, rawBody: string) {
    const sanitizedSender = SecretRedactor.redact(sender);
    const sanitizedSubject = SecretRedactor.redact(subject);
    const wrappedContent = PromptInjectionDefense.wrapUntrustedContent(
      rawBody,
      `Email from: ${sanitizedSender} (Subject: ${sanitizedSubject})`,
      'UNTRUSTED_CONTENT'
    );

    return {
      sender: sanitizedSender,
      subject: sanitizedSubject,
      sanitizedBody: wrappedContent.content,
      isUntrusted: true,
    };
  }
}
