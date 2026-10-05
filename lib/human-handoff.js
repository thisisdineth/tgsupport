export const HUMAN_SUPPORT_NUMBER = "+94701840527";

export function normalizePhoneNumber(value) {
  return String(value || '').replace(/\D/g, '');
}

export function shouldEscalateToHuman(text = '') {
  const normalized = String(text).trim().toLowerCase();
  if (!normalized) return false;

  const patterns = [
    /real person|human agent|human support|speak to a person|talk to a real person|talk to a human|call a real person|call me|message a real person|message a human|message or call a real person|want to message a real person|want to call a real person|need to talk to someone|speak with someone|talk to someone/i,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

export function buildEscalationMessage(customerNumber, incomingText = '') {
  const cleaned = String(incomingText).replace(/\s+/g, ' ').trim();
  return `New human support request from WhatsApp ${customerNumber}. Customer said: "${cleaned || 'No message text provided'}". Please contact them or respond via WhatsApp.`;
}
