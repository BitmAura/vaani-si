/**
 * VANNI Design System — Navigation Components
 */

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChangeJs?: string; // Optional client-side trigger
}

export function renderTabs(props: TabsProps): string {
  const tabsHtml = props.items
    .map(tab => {
      const isActive = tab.id === props.activeId;
      const borderBottom = isActive ? '2px solid var(--vanni-primary)' : '2px solid transparent';
      const color = isActive ? 'var(--vanni-text-primary)' : 'var(--vanni-text-muted)';
      const fontWeight = isActive ? '600' : '500';
      const clickAttr = props.onChangeJs ? `onclick="${props.onChangeJs}('${tab.id}')"` : '';

      return `
      <button 
        type="button" 
        role="tab" 
        aria-selected="${isActive ? 'true' : 'false'}"
        class="vanni-tab-item" 
        ${clickAttr}
        style="background: transparent; border: none; border-bottom: ${borderBottom}; padding: 10px 16px; font-size: 13px; font-weight: ${fontWeight}; color: ${color}; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-family: inherit;">
        <span>${tab.label}</span>
        ${tab.badge !== undefined ? `<span class="vanni-badge vanni-badge-default" style="font-size: 11px;">${tab.badge}</span>` : ''}
      </button>
      `;
    })
    .join('');

  return `
<div class="vanni-tabs" role="tablist" style="display: flex; border-bottom: 1px solid var(--vanni-border); gap: 4px;">
  ${tabsHtml}
</div>
  `.trim();
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function renderBreadcrumbs(props: BreadcrumbsProps): string {
  const listHtml = props.items
    .map((item, index) => {
      const isLast = index === props.items.length - 1;
      return `
      <li style="display: inline-flex; align-items: center; gap: 8px;">
        ${
          isLast || !item.href
            ? `<span style="color: var(--vanni-text-primary); font-weight: 500;">${item.label}</span>`
            : `<a href="${item.href}" style="color: var(--vanni-text-muted); text-decoration: none;">${item.label}</a>`
        }
        ${!isLast ? `<span style="color: var(--vanni-text-disabled);" aria-hidden="true">/</span>` : ''}
      </li>
      `;
    })
    .join('');

  return `
<nav aria-label="Breadcrumb">
  <ol style="list-style: none; padding: 0; margin: 0; display: flex; align-items: center; gap: 8px; font-size: 13px;">
    ${listHtml}
  </ol>
</nav>
  `.trim();
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  onPageChangeJs?: string;
}

export function renderPagination(props: PaginationProps): string {
  const prevDisabled = props.currentPage <= 1;
  const nextDisabled = props.currentPage >= props.totalPages;

  return `
<div class="vanni-pagination" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-top: 1px solid var(--vanni-border); font-size: 13px; color: var(--vanni-text-secondary);">
  <div>
    ${props.totalItems ? `Showing <span style="font-weight: 600; color: var(--vanni-text-primary);">${props.totalItems}</span> total entries` : `Page ${props.currentPage} of ${props.totalPages}`}
  </div>
  <div style="display: flex; gap: 8px;">
    <button 
      type="button" 
      class="vanni-button vanni-button-secondary vanni-button-sm" 
      ${prevDisabled ? 'disabled' : ''} 
      ${props.onPageChangeJs && !prevDisabled ? `onclick="${props.onPageChangeJs}(${props.currentPage - 1})"` : ''}>
      Previous
    </button>
    <button 
      type="button" 
      class="vanni-button vanni-button-secondary vanni-button-sm" 
      ${nextDisabled ? 'disabled' : ''} 
      ${props.onPageChangeJs && !nextDisabled ? `onclick="${props.onPageChangeJs}(${props.currentPage + 1})"` : ''}>
      Next
    </button>
  </div>
</div>
  `.trim();
}

export interface CommandMenuItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
}

export function renderCommandMenu(items: CommandMenuItem[]): string {
  const itemsHtml = items
    .map(item => `
    <div role="option" class="vanni-command-item" style="padding: 10px 14px; border-radius: var(--vanni-radius-md); display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 13px;">
      <div>
        <span style="font-weight: 500; color: var(--vanni-text-primary);">${item.title}</span>
        <span style="font-size: 11px; color: var(--vanni-text-muted); margin-left: 8px;">${item.category}</span>
      </div>
      ${item.shortcut ? `<kbd style="font-size: 11px; padding: 2px 6px; background: var(--vanni-surface-subdued); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-sm); font-family: var(--vanni-font-mono); color: var(--vanni-text-muted);">${item.shortcut}</kbd>` : ''}
    </div>
  `)
    .join('');

  return `
<div class="vanni-command-menu" role="dialog" aria-modal="true" style="width: 540px; background: var(--vanni-surface); border: 1px solid var(--vanni-border); border-radius: var(--vanni-radius-xl); box-shadow: var(--vanni-shadow-xl); overflow: hidden;">
  <div style="padding: 12px 16px; border-bottom: 1px solid var(--vanni-border); display: flex; align-items: center; gap: 8px;">
    <input type="text" placeholder="Search commands, agents, calls..." style="width: 100%; border: none; font-size: 14px; outline: none; background: transparent; font-family: inherit;" />
  </div>
  <div style="padding: 8px; max-height: 320px; overflow-y: auto;" role="listbox">
    ${itemsHtml}
  </div>
</div>
  `.trim();
}
