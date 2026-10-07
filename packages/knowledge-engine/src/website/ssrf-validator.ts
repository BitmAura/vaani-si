/**
 * @vanni/knowledge-engine — Server-Side Request Forgery (SSRF) Defense Engine
 * Protects against internal network scanning, loopback exploitation, and cloud metadata theft
 * (AWS, GCP, Azure 169.254.169.254, metadata.google.internal).
 */

import dns from 'node:dns/promises';
import { URL } from 'node:url';

export interface SsrfValidationResult {
  isSafe: boolean;
  reason?: string;
  resolvedIp?: string;
  parsedUrl?: URL;
}

export class SsrfValidator {
  private allowedProtocols = new Set(['http:', 'https:']);
  private allowedPorts = new Set(['80', '443', '']);

  /**
   * Fast synchronous URL & IP safety check
   */
  static isUrlSafe(rawUrl: string): { safe: boolean; reason?: string } {
    const instance = new SsrfValidator();
    try {
      const parsed = new URL(rawUrl.trim());
      if (!instance.allowedProtocols.has(parsed.protocol)) {
        return { safe: false, reason: `Disallowed protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.` };
      }
      if (!instance.allowedPorts.has(parsed.port)) {
        return { safe: false, reason: `Disallowed port '${parsed.port}'. Only standard web ports (80, 443) are allowed.` };
      }
      const hostname = parsed.hostname.toLowerCase().trim();
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname.endsWith('.corp') ||
        hostname === 'metadata.google.internal' ||
        hostname === 'instance-data'
      ) {
        return { safe: false, reason: `Blocked internal or loopback hostname: ${hostname}` };
      }
      if (instance.isDirectIp(hostname) && instance.isPrivateOrReservedIp(hostname)) {
        return { safe: false, reason: `Blocked private or local network IP: ${hostname}` };
      }
      return { safe: true };
    } catch {
      return { safe: false, reason: 'Malformed URL format' };
    }
  }

  /**
   * Validates target redirect URL
   */
  static isRedirectSafe(redirectUrl: string): { safe: boolean; reason?: string } {
    return SsrfValidator.isUrlSafe(redirectUrl);
  }

  /**
   * Validates a target URL against all SSRF attack vectors
   */
  async validateUrl(rawUrl: string): Promise<SsrfValidationResult> {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { isSafe: false, reason: 'Empty or invalid URL provided' };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { isSafe: false, reason: 'Malformed URL format' };
    }

    // 1. Protocol Validation (HTTP/HTTPS only)
    if (!this.allowedProtocols.has(parsed.protocol)) {
      return { isSafe: false, reason: `Disallowed protocol '${parsed.protocol}'. Only HTTP and HTTPS are permitted.` };
    }

    // 2. Port Validation (80 and 443 only)
    if (!this.allowedPorts.has(parsed.port)) {
      return { isSafe: false, reason: `Disallowed port '${parsed.port}'. Only standard web ports (80, 443) are allowed.` };
    }

    const hostname = parsed.hostname.toLowerCase().trim();

    // 3. Block Known Dangerous Hostnames & TLDs
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.corp') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      return { isSafe: false, reason: `Blocked internal or loopback hostname: ${hostname}` };
    }

    // 4. If hostname is already an IP, check directly
    if (this.isDirectIp(hostname)) {
      if (this.isPrivateOrReservedIp(hostname)) {
        return { isSafe: false, reason: `Blocked private or cloud metadata IP: ${hostname}`, resolvedIp: hostname };
      }
      return { isSafe: true, resolvedIp: hostname, parsedUrl: parsed };
    }

    // 5. DNS Resolution & IP Range Check
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });
      if (!lookupResult || lookupResult.length === 0) {
        return { isSafe: false, reason: `DNS lookup failed for hostname: ${hostname}` };
      }

      for (const entry of lookupResult) {
        if (this.isPrivateOrReservedIp(entry.address)) {
          return {
            isSafe: false,
            reason: `Hostname ${hostname} resolves to blocked private IP address: ${entry.address}`,
            resolvedIp: entry.address,
          };
        }
      }

      return { isSafe: true, resolvedIp: lookupResult[0].address, parsedUrl: parsed };
    } catch (err: any) {
      return { isSafe: false, reason: `DNS resolution failed: ${err.message}` };
    }
  }

  /**
   * Checks whether a given string is a valid IPv4 or IPv6 address
   */
  private isDirectIp(host: string): boolean {
    // IPv4 check
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return true;
    // IPv6 check
    if (host.includes(':')) return true;
    return false;
  }

  /**
   * Checks if an IP address belongs to RFC 1918 private ranges, loopback, link-local,
   * multicast, or cloud metadata services.
   */
  isPrivateOrReservedIp(ip: string): boolean {
    const cleanIp = ip.toLowerCase().trim();

    // IPv6 checks
    if (cleanIp === '::1' || cleanIp === '::' || cleanIp.startsWith('fe80:') || cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) {
      return true;
    }

    // IPv4 mapped IPv6 (::ffff:127.0.0.1)
    if (cleanIp.startsWith('::ffff:')) {
      const ipv4Part = cleanIp.slice(7);
      return this.isPrivateOrReservedIp(ipv4Part);
    }

    const parts = cleanIp.split('.').map(p => parseInt(p, 10));
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // Malformed IP, block by default
    }

    const [a, b, c, d] = parts;

    // Loopback (127.0.0.0/8)
    if (a === 127) return true;

    // Zero / Current Network (0.0.0.0/8)
    if (a === 0) return true;

    // RFC 1918 Private Class A (10.0.0.0/8)
    if (a === 10) return true;

    // RFC 1918 Private Class B (172.16.0.0/12: 172.16.0.0 to 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // RFC 1918 Private Class C (192.168.0.0/16)
    if (a === 192 && b === 168) return true;

    // Link-Local / Cloud Metadata (169.254.0.0/16 - covers 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // Carrier-grade NAT (100.64.0.0/10)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // Broadcast (255.255.255.255)
    if (a === 255 && b === 255 && c === 255 && d === 255) return true;

    // Multicast (224.0.0.0/4)
    if (a >= 224 && a <= 239) return true;

    return false;
  }
}

export const globalSsrfValidator = new SsrfValidator();
