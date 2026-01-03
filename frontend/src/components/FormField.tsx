interface FormFieldProps {
  label: string
  name: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  error?: string
  required?: boolean
  placeholder?: string
  textarea?: boolean
  rows?: number
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  placeholder,
  textarea = false,
  rows = 3,
}: FormFieldProps) {
  const InputComponent = textarea ? 'textarea' : 'input'
  const inputProps = textarea
    ? { rows, placeholder }
    : { type, placeholder }

  return (
    <div style={{ marginBottom: 'var(--spacing-md)' }}>
      <label htmlFor={name} className="label" style={{ fontFamily: 'inherit' }}>
        {label}
        {required && <span style={{ color: 'var(--color-error)' }}> *</span>}
      </label>
      <InputComponent
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={`input ${error ? 'input-error' : ''}`}
        required={required}
        {...inputProps}
      />
      {error && <div className="error-message">{error}</div>}
    </div>
  )
}
