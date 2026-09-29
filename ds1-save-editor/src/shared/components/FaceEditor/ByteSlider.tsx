import React from 'react';
import './faceEditor.css';

/** Number + range pair, the shape every 0..255 field uses. */
export const ByteSlider: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => (
  <div className="face-row">
    <span className="face-label" title={label}>{label}</span>
    <input
      type="number"
      className="face-num"
      value={value}
      min={0}
      max={255}
      onChange={e => {
        const v = parseInt(e.target.value, 10);
        if (!isNaN(v)) onChange(Math.max(0, Math.min(255, v)));
      }}
    />
    <input
      type="range"
      className="face-range"
      value={value}
      min={0}
      max={255}
      onChange={e => onChange(parseInt(e.target.value, 10))}
    />
  </div>
);
