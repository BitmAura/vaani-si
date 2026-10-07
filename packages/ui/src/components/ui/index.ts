/**
 * VANNI Design System — Base UI Primitives (Actions, Feedback, Overlays)
 */

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  iconHtml?: string;
  onClickJs?: string;
  id?: string;
}

export function renderButton(props: ButtonProps): string {
  const variant = props.variant || 'primary';
  const sizeClass = props.size === 'sm' ? 'vanni-button-sm' : props.size === 'lg' ? 'vanni-button-lg' : '';
  const clickAttr = props.onClickJs ? `onclick="${props.onClickJs}"` : '';
  const idAttr = props.id ? `id="${props.id}"` : '';

  return `
<button 
  type="${props.type || 'button'}" 
  class="vanni-button vanni-button-${variant} ${sizeClass}" 
  ${props.disabled ? 'disabled' : ''} 
  ${clickAttr} 
  ${idAttr}>
  ${props.iconHtml ? `<span>${props.iconHtml}</span>` : ''}
  <span>${props.label}</span>
</button>
  `.trim();
}

export interface IconButtonProps {
  iconHtml: string;
  ariaLabel: string;
  onClickJs?: string;
  id?: string;
}

export function renderIconButton(props: IconButtonProps): string {
  const clickAttr = props.onClickJs ? `onclick="${props.onClickJs}"` : '';
  const idAttr = props.id ? `id="${props.id}"` : '';
  return `
<button 
  type="button" 
  class="vanni-icon-button" 
  aria-label="${props.ariaLabel}" 
  ${clickAttr} 
  ${idAttr}>
  ${props.iconHtml}
</button>
  `.trim();
}

export interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  iconHtml?: string;
}

export function renderBadge(props: BadgeProps): string {
  const variant = props.variant || 'default';
  return `
<span class="vanni-badge vanni-badge-${variant}">
  ${props.iconHtml ? `<span>${props.iconHtml}</span>` : ''}
  <span>${props.label}</span>
</span>
  `.trim();
}

export interface StatusIndicatorProps {
  status: 'live' | 'idle' | 'busy' | 'error';
  label?: string;
}

export function renderStatusIndicator(props: StatusIndicatorProps): string {
  return `
<div style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--vanni-text-secondary);">
  <span class="vanni-status-dot vanni-status-dot-${props.status}" aria-hidden="true"></span>
  ${props.label ? `<span>${props.label}</span>` : ''}
</div>
  `.trim();
}

export interface AlertProps {
  title?: string;
  message: string;
  variant?: 'info' | 'warning' | 'danger' | 'success';
}

export function renderAlert(props: AlertProps): string {
  const variant = props.variant || 'info';
  return `
<div class="vanni-alert vanni-alert-${variant}" role="alert">
  <div style="flex: 1;">
    ${props.title ? `<div style="font-weight: 600; margin-bottom: 2px;">${props.title}</div>` : ''}
    <div>${props.message}</div>
  </div>
</div>
  `.trim();
}

export interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
}

export function renderSkeleton(props: SkeletonProps = {}): string {
  return `
<div class="vanni-skeleton" style="width: ${props.width || '100%'}; height: ${props.height || '20px'}; border-radius: ${props.radius || 'var(--vanni-radius-sm)'};" aria-hidden="true"></div>
  `.trim();
}

export interface DrawerProps {
  id: string;
  title: string;
  subtitle?: string;
  contentHtml: string;
  footerActionsHtml?: string;
  onCloseJs?: string;
}

export function renderDrawer(props: DrawerProps): string {
  const closeJs = props.onCloseJs || `document.getElementById('${props.id}').classList.remove('active'); document.getElementById('${props.id}-backdrop').classList.remove('active');`;

  return `
<div id="${props.id}-backdrop" class="vanni-drawer-backdrop" onclick="${closeJs}"></div>
<div id="${props.id}" class="vanni-drawer" role="dialog" aria-modal="true" aria-label="${props.title}">
  <div style="padding: 16px 24px; border-bottom: 1px solid var(--vanni-border); display: flex; align-items: center; justify-content: space-between;">
    <div>
      <div style="font-size: 16px; font-weight: 600; color: var(--vanni-text-primary);">${props.title}</div>
      ${props.subtitle ? `<div style="font-size: 12px; color: var(--vanni-text-muted);">${props.subtitle}</div>` : ''}
    </div>
    <button type="button" class="vanni-icon-button" onclick="${closeJs}" aria-label="Close Drawer">&times;</button>
  </div>
  <div style="flex: 1; overflow-y: auto; padding: 24px;">
    ${props.contentHtml}
  </div>
  ${props.footerActionsHtml ? `
    <div style="padding: 16px 24px; border-top: 1px solid var(--vanni-border); background: var(--vanni-surface-subdued); display: flex; justify-content: flex-end; gap: 8px;">
      ${props.footerActionsHtml}
    </div>
  ` : ''}
</div>
  `.trim();
}

export interface ModalProps {
  id: string;
  title: string;
  contentHtml: string;
  actionsHtml?: string;
  onCloseJs?: string;
}

export function renderModal(props: ModalProps): string {
  const closeJs = props.onCloseJs || `document.getElementById('${props.id}').style.display='none';`;
  return `
<div id="${props.id}" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); z-index: 70; align-items: center; justify-content: center; padding: 16px;" role="dialog" aria-modal="true">
  <div style="background: var(--vanni-surface); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-xl); box-shadow: var(--vanni-shadow-xl); width: 100%; max-width: 500px; overflow: hidden;">
    <div style="padding: 16px 20px; border-bottom: 1px solid var(--vanni-border); display: flex; align-items: center; justify-content: space-between;">
      <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: var(--vanni-text-primary);">${props.title}</h3>
      <button type="button" class="vanni-icon-button" onclick="${closeJs}" aria-label="Close Modal">&times;</button>
    </div>
    <div style="padding: 20px;">
      ${props.contentHtml}
    </div>
    ${props.actionsHtml ? `
      <div style="padding: 12px 20px; border-top: 1px solid var(--vanni-border); background: var(--vanni-surface-subdued); display: flex; justify-content: flex-end; gap: 8px;">
        ${props.actionsHtml}
      </div>
    ` : ''}
  </div>
</div>
  `.trim();
}
