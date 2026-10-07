/**
 * VANNI Design System — Layout Components
 */

export interface AppShellProps {
  sidebarHtml: string;
  headerHtml: string;
  contentHtml: string;
}

export function renderAppShell(props: AppShellProps): string {
  return `
<div class="vanni-app-shell">
  ${props.sidebarHtml}
  <div class="vanni-dashboard-main">
    ${props.headerHtml}
    <main class="vanni-page-content" id="main-content">
      ${props.contentHtml}
    </main>
  </div>
</div>
  `.trim();
}

export interface MarketingHeaderProps {
  logoText?: string;
  navLinks: Array<{ label: string; href: string }>;
  ctaLabel?: string;
  ctaHref?: string;
}

export function renderMarketingHeader(props: MarketingHeaderProps): string {
  const linksHtml = props.navLinks
    .map(link => `<a href="${link.href}" class="vanni-nav-link" style="color: var(--vanni-text-secondary); text-decoration: none; font-weight: 500; font-size: 13px; margin: 0 12px;">${link.label}</a>`)
    .join('');

  return `
<header class="vanni-marketing-header" role="banner">
  <div style="display: flex; align-items: center; gap: 24px;">
    <a href="/" style="display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--vanni-text-primary); font-weight: 700; font-size: 16px; letter-spacing: -0.02em;">
      <span style="display: inline-block; width: 10px; height: 10px; background: var(--vanni-primary); border-radius: 2px;"></span>
      <span>${props.logoText || 'VANNI'}</span>
    </a>
    <nav style="display: flex; align-items: center;" aria-label="Main Navigation">
      ${linksHtml}
    </nav>
  </div>
  <div style="display: flex; align-items: center; gap: 12px;">
    <a href="/login" class="vanni-button vanni-button-ghost">Sign In</a>
    <a href="${props.ctaHref || '/talk'}" class="vanni-button vanni-button-primary">${props.ctaLabel || 'Talk to VANNI'}</a>
  </div>
</header>
  `.trim();
}

export interface MarketingFooterProps {
  copyrightYear?: number;
}

export function renderMarketingFooter(props: MarketingFooterProps = {}): string {
  const year = props.copyrightYear || 2026;
  return `
<footer class="vanni-marketing-footer" role="contentinfo">
  <div style="max-width: var(--vanni-max-content-width); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
    <div>
      <span style="font-weight: 600; color: var(--vanni-text-primary);">VANNI</span>
      <span style="margin-left: 8px; color: var(--vanni-text-muted);">— Autonomous AI Employee Platform</span>
    </div>
    <div style="display: flex; gap: 20px; font-size: 12px;">
      <a href="/privacy" style="color: var(--vanni-text-muted); text-decoration: none;">Privacy</a>
      <a href="/terms" style="color: var(--vanni-text-muted); text-decoration: none;">Terms of Service</a>
      <a href="/security" style="color: var(--vanni-text-muted); text-decoration: none;">Enterprise Security</a>
    </div>
    <div style="font-size: 12px; color: var(--vanni-text-muted);">
      &copy; ${year} VANNI Technologies Inc. All rights reserved.
    </div>
  </div>
</footer>
  `.trim();
}

export interface DashboardSidebarProps {
  activeRoute: string;
  tenantName: string;
  items: Array<{ id: string; label: string; href: string; iconSvg?: string }>;
}

export function renderDashboardSidebar(props: DashboardSidebarProps): string {
  const itemsHtml = props.items
    .map(item => {
      const isActive = props.activeRoute === item.id;
      const bg = isActive ? 'background: var(--vanni-surface-subdued); color: var(--vanni-text-primary); font-weight: 600;' : 'color: var(--vanni-text-secondary);';
      return `
      <a href="${item.href}" class="vanni-sidebar-item" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--vanni-radius-md); text-decoration: none; font-size: 13px; ${bg}">
        ${item.iconSvg || '<span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor;"></span>'}
        <span>${item.label}</span>
      </a>
      `;
    })
    .join('');

  return `
<aside class="vanni-dashboard-sidebar" aria-label="Dashboard Navigation">
  <div style="padding: 16px 20px; border-bottom: 1px solid var(--vanni-border); display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="display: inline-block; width: 8px; height: 8px; background: var(--vanni-primary); border-radius: 2px;"></span>
      <span style="font-weight: 700; font-size: 15px; letter-spacing: -0.02em;">VANNI</span>
    </div>
    <span class="vanni-badge vanni-badge-default" style="font-size: 10px;">PROD</span>
  </div>
  <div style="padding: 12px 16px; border-bottom: 1px solid var(--vanni-border-subdued);">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--vanni-text-muted); font-weight: 600;">Organization</div>
    <div style="font-size: 13px; font-weight: 600; color: var(--vanni-text-primary); margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${props.tenantName}</div>
  </div>
  <nav style="flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px;" aria-label="Primary">
    ${itemsHtml}
  </nav>
  <div style="padding: 12px 16px; border-top: 1px solid var(--vanni-border); font-size: 12px; color: var(--vanni-text-muted); display: flex; align-items: center; justify-content: space-between;">
    <span>Voice Engine</span>
    <span class="vanni-status-dot vanni-status-dot-live" title="Engine Operational"></span>
  </div>
</aside>
  `.trim();
}

export interface DashboardHeaderProps {
  breadcrumbsHtml?: string;
  userEmail: string;
}

export function renderDashboardHeader(props: DashboardHeaderProps): string {
  return `
<header class="vanni-dashboard-header" role="region" aria-label="Dashboard Controls">
  <div>
    ${props.breadcrumbsHtml || '<span style="font-size: 13px; font-weight: 500; color: var(--vanni-text-secondary);">Console</span>'}
  </div>
  <div style="display: flex; align-items: center; gap: 16px;">
    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--vanni-text-muted);">
      <span class="vanni-status-dot vanni-status-dot-live"></span>
      <span>Kannada Runtime Live</span>
    </div>
    <div style="width: 1px; height: 16px; background: var(--vanni-border);"></div>
    <span style="font-size: 13px; color: var(--vanni-text-secondary); font-weight: 500;">${props.userEmail}</span>
  </div>
</header>
  `.trim();
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actionsHtml?: string;
}

export function renderPageHeader(props: PageHeaderProps): string {
  return `
<div class="vanni-page-header">
  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
    <div>
      <h1 class="vanni-page-title">${props.title}</h1>
      ${props.subtitle ? `<div class="vanni-page-subtitle">${props.subtitle}</div>` : ''}
    </div>
    ${props.actionsHtml ? `<div style="display: flex; gap: 8px;">${props.actionsHtml}</div>` : ''}
  </div>
</div>
  `.trim();
}

export interface SectionProps {
  title?: string;
  description?: string;
  contentHtml: string;
}

export function renderSection(props: SectionProps): string {
  return `
<section style="margin-bottom: 32px;">
  ${props.title ? `
    <div style="margin-bottom: 16px;">
      <h2 style="font-size: 16px; font-weight: 600; margin: 0; color: var(--vanni-text-primary);">${props.title}</h2>
      ${props.description ? `<p style="font-size: 13px; color: var(--vanni-text-muted); margin: 4px 0 0 0;">${props.description}</p>` : ''}
    </div>
  ` : ''}
  ${props.contentHtml}
</section>
  `.trim();
}
