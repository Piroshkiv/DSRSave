import React, { useState } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  disabled = false,
  className = '',
  style
}) => {
  const [localValue, setLocalValue] = useState<string | undefined>(undefined);

  const handleChange = (inputValue: string) => {
    setLocalValue(inputValue);
  };

  const handleBlur = () => {
    if (localValue === undefined || localValue === '') {
      setLocalValue(undefined);
      return;
    }

    let numValue = parseInt(localValue, 10);

    // If invalid number, keep current value
    if (isNaN(numValue)) {
      setLocalValue(undefined);
      return;
    }

    // Clamp to min-max range
    numValue = Math.max(min, Math.min(max, numValue));

    onChange(numValue);
    setLocalValue(undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="number"
      className={className}
      style={style}
      value={localValue !== undefined ? localValue : value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      disabled={disabled}
    />
  );
};
