/**
 * Development-only gateway configuration. Android devices reach the host
 * through an ADB reverse tunnel (`adb reverse tcp:8080 tcp:8080`), so the
 * same local URL works for the USB-connected phone and emulator. A LAN URL
 * can still be supplied through configureGatewayBaseUrl when needed.
 *
 * This module intentionally contains no secret, provider key, or JWT.
 */
let gatewayBaseUrl = 'http://127.0.0.1:8080';

export function configureGatewayBaseUrl(value: string) {
  const normalized = value.trim().replace(/\/$/, '');
  if (!/^https?:\/\//.test(normalized)) {
    throw new Error('Gateway URL must begin with http:// or https://');
  }
  gatewayBaseUrl = normalized;
}

export function getGatewayBaseUrl() {
  return gatewayBaseUrl;
}

