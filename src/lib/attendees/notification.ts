import type { AttendeeDetail, AttendeeListSummary, NotificationChannel } from "@/lib/attendees/types";

export type EmailMessage = {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  attachments?: Array<{ fileName: string; contentType: string; content: string }>;
};

export type SmsMessage = {
  to: string;
  body: string;
};

export type EmailProvider = {
  providerName: string;
  sendEmail(message: EmailMessage): Promise<void>;
};

export type SmsProvider = {
  providerName: string;
  sendSms(message: SmsMessage): Promise<void>;
};

class MockEmailProvider implements EmailProvider {
  providerName = "MOCK";
  async sendEmail() {}
}

class MockSmsProvider implements SmsProvider {
  providerName = "MOCK";
  async sendSms() {}
}

class UnconfiguredEmailProvider implements EmailProvider {
  providerName = "UNCONFIGURED";
  async sendEmail() {
    throw new Error("Email notification provider is not configured.");
  }
}

class UnconfiguredSmsProvider implements SmsProvider {
  providerName = "UNCONFIGURED";
  async sendSms() {
    throw new Error("SMS notification provider is not configured.");
  }
}

function useMockProvider() {
  return process.env.NODE_ENV !== "production" || process.env.ATTENDEE_NOTIFICATION_PROVIDER === "MOCK";
}

export function createEmailProvider(): EmailProvider {
  return useMockProvider() ? new MockEmailProvider() : new UnconfiguredEmailProvider();
}

export function createSmsProvider(): SmsProvider {
  return useMockProvider() ? new MockSmsProvider() : new UnconfiguredSmsProvider();
}

export class NotificationService {
  constructor(
    private readonly emailProvider: EmailProvider = createEmailProvider(),
    private readonly smsProvider: SmsProvider = createSmsProvider()
  ) {}

  async sendAttendeeQrCodeEmail(attendee: AttendeeDetail, attendeeList: AttendeeListSummary, qrPayload: string) {
    await this.emailProvider.sendEmail({
      to: attendee.email,
      subject: `Your ${attendeeList.listName} attendance QR code`,
      htmlBody: `<p>Hello ${attendee.firstName} ${attendee.lastName},</p><p>Present this QR link at the kiosk:</p><p>${qrPayload}</p><p>If the QR code is unavailable, enter your registered email address.</p>`,
      textBody: `Hello ${attendee.firstName} ${attendee.lastName}, present this QR link at the kiosk: ${qrPayload}. If unavailable, enter your registered email address.`,
    });
  }

  async sendAttendeeQrCodeSms(attendee: AttendeeDetail, attendeeList: AttendeeListSummary, qrPayload: string) {
    if (!attendee.phoneNumber) {
      throw new Error("Attendee does not have a phone number.");
    }
    await this.smsProvider.sendSms({
      to: attendee.phoneNumber,
      body: `${attendeeList.listName} attendance QR: ${qrPayload}`,
    });
  }

  async sendQrCode(
    attendee: AttendeeDetail,
    attendeeList: AttendeeListSummary,
    qrPayload: string,
    channels: NotificationChannel[] = ["EMAIL"]
  ) {
    if (channels.includes("EMAIL")) {
      await this.sendAttendeeQrCodeEmail(attendee, attendeeList, qrPayload);
    }
    if (channels.includes("SMS")) {
      await this.sendAttendeeQrCodeSms(attendee, attendeeList, qrPayload);
    }
  }
}
