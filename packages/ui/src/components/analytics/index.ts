/**
 * VANNI Design System — Analytics, Data Tables & Metric Components
 * Strict rule: Honest telemetry only. Real zero states, zero fake numbers.
 */

export interface MetricCardProps {
  label: string;
  value: string | number;
  metaText?: string;
  badgeText?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
}

export function renderMetricCard(props: MetricCardProps): string {
  return `
<div class="vanni-metric-card">
  <div style="display: flex; align-items: center; justify-content: space-between;">
    <span class="vanni-metric-label">${props.label}</span>
    ${props.badgeText ? `<span class="vanni-badge vanni-badge-${props.badgeVariant || 'default'}">${props.badgeText}</span>` : ''}
  </div>
  <div class="vanni-metric-value">${props.value}</div>
  ${props.metaText ? `<div class="vanni-metric-meta">${props.metaText}</div>` : ''}
</div>
  `.trim();
}

export interface TableColumn<T = any> {
  key: string;
  title: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => string;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  emptyStateHtml?: string;
  onRowClickJs?: string;
}

export function renderTable<T = any>(props: TableProps<T>): string {
  if (props.data.length === 0) {
    return props.emptyStateHtml || renderEmptyState({
      title: 'No records found',
      description: 'Items will appear here once calls or events occur.',
    });
  }

  const headerHtml = props.columns
    .map(col => `<th style="${col.width ? `width: ${col.width};` : ''} text-align: ${col.align || 'left'};">${col.title}</th>`)
    .join('');

  const rowsHtml = props.data
    .map((row: any) => {
      const cells = props.columns
        .map(col => {
          const content = col.render ? col.render(row) : (row[col.key] ?? '');
          return `<td style="text-align: ${col.align || 'left'};">${content}</td>`;
        })
        .join('');

      const clickAttr = props.onRowClickJs && row.id ? `onclick="${props.onRowClickJs}('${row.id}')" style="cursor: pointer;"` : '';
      return `<tr ${clickAttr}>${cells}</tr>`;
    })
    .join('');

  return `
<div class="vanni-table-container">
  <table class="vanni-table">
    <thead>
      <tr>${headerHtml}</tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</div>
  `.trim();
}

export interface EmptyStateProps {
  title: string;
  description: string;
  iconHtml?: string;
  actionHtml?: string;
}

export function renderEmptyState(props: EmptyStateProps): string {
  return `
<div class="vanni-empty-state">
  ${props.iconHtml ? `<div style="color: var(--vanni-text-disabled); margin-bottom: 8px;">${props.iconHtml}</div>` : `
    <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--vanni-surface-subdued); display: flex; align-items: center; justify-content: center; color: var(--vanni-text-muted); font-size: 18px; margin-bottom: 8px;">
      &bull;
    </div>
  `}
  <div class="vanni-empty-title">${props.title}</div>
  <div class="vanni-empty-description">${props.description}</div>
  ${props.actionHtml ? `<div>${props.actionHtml}</div>` : ''}
</div>
  `.trim();
}

export interface TimelineItem {
  timestamp: string;
  title: string;
  description?: string;
  status?: 'success' | 'warning' | 'danger' | 'info';
}

export function renderTimeline(items: TimelineItem[]): string {
  const itemsHtml = items
    .map((item, index) => {
      const isLast = index === items.length - 1;
      return `
      <div style="display: flex; gap: 16px; position: relative;">
        <div style="display: flex; flex-direction: column; align-items: center;">
          <span class="vanni-status-dot vanni-status-dot-${item.status === 'success' ? 'live' : item.status === 'danger' ? 'error' : 'idle'}" style="margin-top: 4px;"></span>
          ${!isLast ? `<div style="width: 1px; flex: 1; background: var(--vanni-border); margin: 4px 0;"></div>` : ''}
        </div>
        <div style="padding-bottom: 16px;">
          <div style="font-size: 11px; color: var(--vanni-text-muted); font-family: var(--vanni-font-mono);">${item.timestamp}</div>
          <div style="font-size: 13px; font-weight: 500; color: var(--vanni-text-primary); margin-top: 2px;">${item.title}</div>
          ${item.description ? `<div style="font-size: 12px; color: var(--vanni-text-secondary); margin-top: 2px;">${item.description}</div>` : ''}
        </div>
      </div>
      `;
    })
    .join('');

  return `
<div class="vanni-timeline">
  ${itemsHtml}
</div>
  `.trim();
}
