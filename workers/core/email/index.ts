
export interface EmailOptions {
    to: string;
    subject: string;
    body: string;
}

export async function sendEmail(options: EmailOptions) {
    console.log('Sending email:', options);
    // Implementation for SendGrid/Resend/Mailgun would go here
    return true;
}
