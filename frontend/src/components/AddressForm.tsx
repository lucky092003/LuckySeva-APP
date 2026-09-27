import { useId, type ChangeEvent, type ReactNode } from 'react';
import { LocateFixed } from 'lucide-react';
import { INDIAN_STATES, type AddressErrors, type AddressParts } from '@/services/address';

type Props = {
  value: AddressParts;
  onChange: (next: AddressParts) => void;
  errors?: AddressErrors;
  /** Errors stay hidden until the user has actually tried to submit. */
  showErrors?: boolean;
  onLocate?: () => void;
  locating?: boolean;
  locateError?: string;
  onFieldChange?: (field: keyof AddressParts) => void;
};

function Field({
  label,
  error,
  showErrors,
  children,
  hint,
}: {
  label: string;
  error?: string;
  showErrors: boolean;
  children: ReactNode;
  hint?: string;
}) {
  const invalid = Boolean(showErrors && error);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {invalid ? (
        <span className="mt-1 block text-[11px] font-medium text-red-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>
      ) : null}
    </label>
  );
}

export const AddressForm = ({
  value,
  onChange,
  errors = {},
  showErrors = false,
  onLocate,
  locating = false,
  locateError = '',
  onFieldChange,
}: Props) => {
  const statesListId = useId();
  const invalidBorder = 'border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-red-100';
  const base =
    'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';

  const set = (field: keyof AddressParts) => (e: ChangeEvent<HTMLInputElement>) => {
    onFieldChange?.(field);
    const next = e.target.value;
    onChange({
      ...value,
      [field]: field === 'pincode' ? next.replace(/\D/g, '').slice(0, 6) : next,
    });
  };

  const cls = (field: keyof AddressParts) =>
    `${base} ${showErrors && errors[field] ? invalidBorder : ''}`;

  return (
    <div className="space-y-3">
      <Field label="House / Flat No, Street" error={errors.houseNo} showErrors={showErrors}>
        <input
          value={value.houseNo}
          onChange={set('houseNo')}
          placeholder="e.g. 12, MG Road"
          autoComplete="address-line1"
          className={cls('houseNo')}
        />
      </Field>

      <Field label="Area / Locality" error={errors.area} showErrors={showErrors}>
        <input
          value={value.area}
          onChange={set('area')}
          placeholder="e.g. Baner"
          autoComplete="address-line2"
          className={cls('area')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="City" error={errors.city} showErrors={showErrors}>
          <input
            value={value.city}
            onChange={set('city')}
            placeholder="e.g. Pune"
            autoComplete="address-level2"
            className={cls('city')}
          />
        </Field>
        <Field label="State" error={errors.state} showErrors={showErrors}>
          <input
            value={value.state}
            onChange={set('state')}
            placeholder="e.g. Maharashtra"
            list={statesListId}
            autoComplete="address-level1"
            className={cls('state')}
          />
        </Field>
      </div>

      <datalist id={statesListId}>
        {INDIAN_STATES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <Field
        label="Pincode"
        error={errors.pincode}
        showErrors={showErrors}
        hint={!showErrors ? '6 digits' : undefined}
      >
        <input
          value={value.pincode}
          onChange={set('pincode')}
          placeholder="411045"
          inputMode="numeric"
          autoComplete="postal-code"
          className={cls('pincode')}
        />
      </Field>

      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          disabled={locating}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
        >
          <LocateFixed size={16} />
          {locating ? 'Fetching your location...' : 'Use my current location'}
        </button>
      )}
      {locateError && <p className="text-xs text-red-500">{locateError}</p>}
    </div>
  );
};
