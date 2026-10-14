import React, { useId, cloneElement, isValidElement } from 'react';

/**
 * Labelled form field. Wraps one control (input/select/textarea) and wires id, aria-describedby and
 * aria-invalid so the label, help text and error are announced together.
 */
export function Field({ label, help, error, required = false, className = '', children }) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id || id,
      'aria-describedby': [children.props['aria-describedby'], helpId, errorId].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : children.props['aria-invalid'],
      required: required || children.props.required,
    })
    : children;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={(isValidElement(children) && children.props.id) || id} className="field-label">
          {label}{required && <span className="text-danger-soft" aria-hidden="true"> *</span>}
        </label>
      )}
      {control}
      {help && !error && <p id={helpId} className="field-help">{help}</p>}
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export default Field;
