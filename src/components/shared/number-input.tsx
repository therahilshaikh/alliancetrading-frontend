import { NumericFormat, type NumericFormatProps } from 'react-number-format'
import { Input } from '@/components/ui/input'

type Base = Omit<NumericFormatProps, 'value' | 'onValueChange' | 'customInput' | 'onChange'> & {
  value: number | null | undefined
  onChange: (value: number | undefined) => void
}

/** ₹ input with Indian grouping (₹1,00,000.00) and 2 decimals. */
export function MoneyInput({ value, onChange, allowNegative = false, ...props }: Base) {
  return (
    <NumericFormat
      customInput={Input}
      inputMode="decimal"
      prefix="₹"
      thousandSeparator=","
      thousandsGroupStyle="lakh"
      decimalScale={2}
      allowNegative={allowNegative}
      value={value ?? ''}
      onValueChange={(v) => onChange(v.floatValue)}
      className="tabular-nums"
      {...props}
    />
  )
}

/** Percentage input (percent units: 1 = 1%), up to 4 decimals. */
export function PercentInput({ value, onChange, allowNegative = true, ...props }: Base) {
  return (
    <NumericFormat
      customInput={Input}
      inputMode="decimal"
      suffix="%"
      decimalScale={4}
      allowNegative={allowNegative}
      value={value ?? ''}
      onValueChange={(v) => onChange(v.floatValue)}
      className="tabular-nums"
      {...props}
    />
  )
}
