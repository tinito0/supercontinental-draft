import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger', success: 'btn-success' };
const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/**
 * Button of the design system (see docs/DESIGN_SYSTEM.md). `type` defaults to "button" so a button
 * inside a form never submits it by accident (Enter in a field must not trigger it).
 */
export const Button = forwardRef(function Button({
  variant = 'secondary', size = 'md', icon: Icon, iconRight: IconRight, loading = false,
  type = 'button', className = '', children, disabled, ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn ${VARIANTS[variant] || VARIANTS.secondary} ${SIZES[size] || ''} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />}
      {children}
      {IconRight && <IconRight className="w-4 h-4 shrink-0" aria-hidden="true" />}
    </button>
  );
});

/** Icon-only button: `label` is required and becomes the accessible name and tooltip. */
export const IconButton = forwardRef(function IconButton({
  icon: Icon, label, variant = 'ghost', size = 'md', type = 'button', className = '', ...props
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`btn btn-icon ${VARIANTS[variant] || VARIANTS.ghost} ${SIZES[size] || ''} ${className}`}
      {...props}
    >
      <Icon className={size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'} aria-hidden="true" />
    </button>
  );
});

export default Button;
