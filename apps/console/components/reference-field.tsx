export type ReferenceOption = {
  label: string;
  value: string;
};

export function ReferenceField({
  emptyLabel,
  id,
  label,
  name,
  options,
  placeholder,
}: {
  emptyLabel: string;
  id: string;
  label: string;
  name: string;
  options: ReferenceOption[];
  placeholder: string;
}) {
  const hasOptions = options.length > 0;
  const helpId = `${id}-help`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hasOptions ? (
        <select
          aria-describedby={helpId}
          defaultValue=""
          id={id}
          name={name}
          required
        >
          <option disabled value="">
            {emptyLabel}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-describedby={helpId}
          id={id}
          name={name}
          placeholder={placeholder}
          required
          type="text"
        />
      )}
      <small id={helpId}>
        {hasOptions
          ? "Choose an existing record."
          : "No existing records are available; enter the ID manually."}
      </small>
    </div>
  );
}
