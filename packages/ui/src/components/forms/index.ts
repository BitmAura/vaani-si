/**
 * VANNI Design System — Forms & Inputs Components
 */

export interface BaseFieldProps {
  id: string;
  name: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export interface InputProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'search';
  value?: string;
  placeholder?: string;
}

export function renderInput(props: InputProps): string {
  const type = props.type || 'text';
  return `
<div class="vanni-form-group">
  ${props.label ? `<label for="${props.id}" class="vanni-label">${props.label}${props.required ? ' *' : ''}</label>` : ''}
  <input 
    type="${type}" 
    id="${props.id}" 
    name="${props.name}" 
    value="${props.value || ''}" 
    placeholder="${props.placeholder || ''}" 
    class="vanni-input" 
    ${props.required ? 'required' : ''} 
    ${props.disabled ? 'disabled' : ''} 
    aria-invalid="${props.error ? 'true' : 'false'}"
  />
  ${props.error ? `<div class="vanni-form-error">${props.error}</div>` : ''}
  ${props.hint && !props.error ? `<div class="vanni-form-hint">${props.hint}</div>` : ''}
</div>
  `.trim();
}

export interface TextareaProps extends BaseFieldProps {
  value?: string;
  placeholder?: string;
  rows?: number;
}

export function renderTextarea(props: TextareaProps): string {
  return `
<div class="vanni-form-group">
  ${props.label ? `<label for="${props.id}" class="vanni-label">${props.label}${props.required ? ' *' : ''}</label>` : ''}
  <textarea 
    id="${props.id}" 
    name="${props.name}" 
    rows="${props.rows || 4}" 
    placeholder="${props.placeholder || ''}" 
    class="vanni-textarea" 
    ${props.required ? 'required' : ''} 
    ${props.disabled ? 'disabled' : ''} 
    aria-invalid="${props.error ? 'true' : 'false'}"
  >${props.value || ''}</textarea>
  ${props.error ? `<div class="vanni-form-error">${props.error}</div>` : ''}
  ${props.hint && !props.error ? `<div class="vanni-form-hint">${props.hint}</div>` : ''}
</div>
  `.trim();
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends BaseFieldProps {
  options: SelectOption[];
  selectedValue?: string;
}

export function renderSelect(props: SelectProps): string {
  const optionsHtml = props.options
    .map(opt => `<option value="${opt.value}" ${opt.value === props.selectedValue ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}>${opt.label}</option>`)
    .join('');

  return `
<div class="vanni-form-group">
  ${props.label ? `<label for="${props.id}" class="vanni-label">${props.label}${props.required ? ' *' : ''}</label>` : ''}
  <select 
    id="${props.id}" 
    name="${props.name}" 
    class="vanni-select" 
    ${props.required ? 'required' : ''} 
    ${props.disabled ? 'disabled' : ''} 
    aria-invalid="${props.error ? 'true' : 'false'}">
    ${optionsHtml}
  </select>
  ${props.error ? `<div class="vanni-form-error">${props.error}</div>` : ''}
  ${props.hint && !props.error ? `<div class="vanni-form-hint">${props.hint}</div>` : ''}
</div>
  `.trim();
}

export interface SwitchProps extends BaseFieldProps {
  checked?: boolean;
  description?: string;
}

export function renderSwitch(props: SwitchProps): string {
  return `
<div class="vanni-form-group">
  <label class="vanni-switch-label" for="${props.id}">
    <span class="vanni-switch">
      <input type="checkbox" id="${props.id}" name="${props.name}" ${props.checked ? 'checked' : ''} ${props.disabled ? 'disabled' : ''} />
      <span class="vanni-switch-slider"></span>
    </span>
    <div>
      <div style="font-size: 13px; font-weight: 500; color: var(--vanni-text-primary);">${props.label || ''}</div>
      ${props.description ? `<div style="font-size: 12px; color: var(--vanni-text-muted);">${props.description}</div>` : ''}
    </div>
  </label>
</div>
  `.trim();
}

export interface CheckboxProps extends BaseFieldProps {
  checked?: boolean;
}

export function renderCheckbox(props: CheckboxProps): string {
  return `
<div class="vanni-form-group" style="flex-direction: row; align-items: center; gap: 8px;">
  <input 
    type="checkbox" 
    id="${props.id}" 
    name="${props.name}" 
    ${props.checked ? 'checked' : ''} 
    ${props.disabled ? 'disabled' : ''} 
    style="width: 16px; height: 16px; accent-color: var(--vanni-accent); cursor: pointer;"
  />
  ${props.label ? `<label for="${props.id}" style="font-size: 13px; color: var(--vanni-text-primary); cursor: pointer;">${props.label}</label>` : ''}
</div>
  `.trim();
}

export interface RadioGroupOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps extends BaseFieldProps {
  options: RadioGroupOption[];
  selectedValue?: string;
}

export function renderRadioGroup(props: RadioGroupProps): string {
  const optionsHtml = props.options
    .map(opt => `
    <label style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; cursor: pointer;">
      <input 
        type="radio" 
        name="${props.name}" 
        value="${opt.value}" 
        ${opt.value === props.selectedValue ? 'checked' : ''} 
        style="margin-top: 3px; accent-color: var(--vanni-accent);"
      />
      <div>
        <div style="font-size: 13px; font-weight: 500; color: var(--vanni-text-primary);">${opt.label}</div>
        ${opt.description ? `<div style="font-size: 12px; color: var(--vanni-text-muted);">${opt.description}</div>` : ''}
      </div>
    </label>
  `)
    .join('');

  return `
<fieldset style="border: none; padding: 0; margin: 0 0 16px 0;">
  ${props.label ? `<legend class="vanni-label" style="margin-bottom: 8px;">${props.label}</legend>` : ''}
  ${optionsHtml}
</fieldset>
  `.trim();
}

export interface FileUploadProps extends BaseFieldProps {
  accept?: string;
  promptText?: string;
}

export function renderFileUpload(props: FileUploadProps): string {
  return `
<div class="vanni-form-group">
  ${props.label ? `<label class="vanni-label">${props.label}</label>` : ''}
  <div style="border: 2px dashed var(--vanni-border-strong); border-radius: var(--vanni-radius-lg); padding: 24px; text-align: center; background: var(--vanni-surface); cursor: pointer;">
    <input type="file" id="${props.id}" name="${props.name}" accept="${props.accept || '*'}" style="display: none;" />
    <label for="${props.id}" style="cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px;">
      <div style="font-size: 13px; font-weight: 500; color: var(--vanni-text-primary);">${props.promptText || 'Click or drag files to upload Knowledge documents'}</div>
      <div style="font-size: 12px; color: var(--vanni-text-muted);">PDF, TXT, DOCX, CSV up to 10MB</div>
    </label>
  </div>
</div>
  `.trim();
}
