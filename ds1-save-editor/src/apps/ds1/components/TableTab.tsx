import React, { useState, useEffect } from 'react';
import { Character } from '../lib/Character';
import { NumberInput } from './NumberInput';

interface TableTabProps {
  character: Character;
  onCharacterUpdate: () => void;
}

export const TableTab: React.FC<TableTabProps> = ({ character, onCharacterUpdate }) => {
  const [pattern1Offset, setPattern1Offset] = useState<number>(-1);
  const [usePatternMode, setUsePatternMode] = useState<boolean>(false);
  const [startOffset, setStartOffset] = useState<number>(0);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [, forceUpdate] = useState({});

  const ROWS = 16;
  const COLS = 16;
  const BYTES_PER_PAGE = ROWS * COLS;

  const handleDownloadSlot = () => {
    try {
      const slotData = character.getRawData();
      const blob = new Blob([slotData], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `slot_${character.slotNumber}_${character.name || 'unnamed'}.bin`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading slot:', error);
      alert('Error downloading slot. Please try again.');
    }
  };

  useEffect(() => {
    const offset = character.findPattern1();
    setPattern1Offset(offset);
  }, [character]);

  const handleFindPattern1 = () => {
    const offset = character.findPattern1();
    const wasPatternMode = usePatternMode;
    setPattern1Offset(offset);
    if (offset === -1) {
      alert('Pattern1 not found');
      setUsePatternMode(false);
    } else {
      alert(`Pattern1 found at 0x${offset.toString(16).toUpperCase()}`);
      // Restore pattern mode if it was enabled
      if (wasPatternMode) {
        setUsePatternMode(true);
      }
    }
  };

  const handleTogglePatternMode = () => {
    if (!usePatternMode && pattern1Offset !== -1) {
      // Set startOffset so that pattern appears at column +0 (first column)
      // This means startOffset should equal pattern1Offset
      setStartOffset(pattern1Offset);
      setUsePatternMode(true);
    } else {
      setUsePatternMode(false);
    }
  };

  const handleGoToOffset = (offsetInput: string) => {
    let absoluteOffset: number;

    if (usePatternMode && pattern1Offset !== -1) {
      // In pattern mode, interpret as relative offset
      const relativeOffset = parseInt(offsetInput.replace(/^[+-]?0x/i, ''), 16);
      if (isNaN(relativeOffset)) return;

      // Handle negative offsets
      const isNegative = offsetInput.trim().startsWith('-');
      absoluteOffset = isNegative
        ? pattern1Offset - relativeOffset
        : pattern1Offset + relativeOffset;
    } else {
      // In normal mode, interpret as absolute offset
      absoluteOffset = parseInt(offsetInput.replace(/^0x/i, ''), 16);
      if (isNaN(absoluteOffset)) return;
    }

    // Navigate to the page containing this offset
    const targetPage = Math.floor(absoluteOffset / BYTES_PER_PAGE);
    setStartOffset(Math.max(0, targetPage * BYTES_PER_PAGE));

    // Auto-select the byte
    handleByteClick(absoluteOffset);
  };

  const handleByteClick = (offset: number) => {
    const data = character.getRawData();
    if (offset >= 0 && offset < data.length) {
      setSelectedOffset(offset);
      setEditValue(data[offset]);
    }
  };

  const handleValueChange = () => {
    if (selectedOffset !== null) {
      character.setByte(selectedOffset, editValue);
      onCharacterUpdate();
      forceUpdate({});
    }
  };

  const handleNextPage = () => {
    const maxOffset = character.getRawData().length - BYTES_PER_PAGE;
    setStartOffset(Math.min(startOffset + BYTES_PER_PAGE, maxOffset));
  };

  const handlePrevPage = () => {
    setStartOffset(Math.max(0, startOffset - BYTES_PER_PAGE));
  };

  const getRelativeOffset = (absoluteOffset: number): number => {
    if (pattern1Offset === -1) return 0;
    return absoluteOffset - pattern1Offset;
  };

  const data = character.getRawData();

  return (
    <div className="table-tab">
      <div className="table-tab-header">
        <div className="pattern-controls">
          <button onClick={handleFindPattern1} className="action-button">
            Find Pattern1
          </button>
          <button onClick={handleDownloadSlot} className="action-button">
            Download Slot
          </button>

          {pattern1Offset !== -1 && (
            <>
              <div className="pattern-info-inline">
                Pattern1: 0x{pattern1Offset.toString(16).toUpperCase().padStart(5, '0')}
              </div>
              <label className="pattern-mode-toggle">
                <input
                  type="checkbox"
                  checked={usePatternMode}
                  onChange={handleTogglePatternMode}
                />
                <span>Pattern Mode (0 = Pattern1)</span>
              </label>
            </>
          )}
        </div>

        <div className="navigation-controls">
          <button onClick={handlePrevPage} className="nav-button" disabled={startOffset === 0}>
            ← Prev
          </button>
          <div className="offset-input-group">
            <label>Go to offset:</label>
            <input
              type="text"
              placeholder={usePatternMode && pattern1Offset !== -1 ? "±0x0000" : "0x0000"}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleGoToOffset(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
          <button onClick={handleNextPage} className="nav-button" disabled={startOffset >= data.length - BYTES_PER_PAGE}>
            Next →
          </button>
        </div>
      </div>

      {selectedOffset !== null && (
        <div className="selected-byte-editor">
          <div className="editor-info">
            <div className="offset-display">
              <strong>Absolute Offset:</strong> 0x{selectedOffset.toString(16).toUpperCase().padStart(5, '0')}
            </div>
            {pattern1Offset !== -1 && (
              <div className="offset-display">
                <strong>Pattern Relative:</strong> {getRelativeOffset(selectedOffset) >= 0 ? '+' : ''}0x{getRelativeOffset(selectedOffset).toString(16).toUpperCase()}
              </div>
            )}
          </div>
          <div className="editor-controls">
            <div className="form-group">
              <label>Value (Dec):</label>
              <NumberInput
                value={editValue}
                onChange={setEditValue}
                min={0}
                max={255}
              />
            </div>
            <div className="form-group">
              <label>Value (Hex):</label>
              <input
                type="text"
                value={'0x' + editValue.toString(16).toUpperCase().padStart(2, '0')}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value.replace(/^0x/i, ''), 16);
                  if (!isNaN(parsed) && parsed >= 0 && parsed <= 255) {
                    setEditValue(parsed);
                  }
                }}
              />
            </div>
            <button onClick={handleValueChange} className="action-button">
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="hex-table-container">
        <table className="hex-table">
          <thead>
            <tr>
              <th>Offset</th>
              {Array.from({ length: COLS }, (_, i) => {
                if (usePatternMode && pattern1Offset !== -1) {
                  // Always show +0 to +F in pattern mode
                  return <th key={i}>+{i.toString(16).toUpperCase()}</th>;
                } else {
                  return <th key={i}>{i.toString(16).toUpperCase()}</th>;
                }
              })}
              <th>ASCII</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, row) => {
              const rowOffset = startOffset + row * COLS;
              return (
                <tr key={row}>
                  <td className="offset-cell">
                    {usePatternMode && pattern1Offset !== -1
                      ? (getRelativeOffset(rowOffset) >= 0 ? '+' : '') + '0x' + getRelativeOffset(rowOffset).toString(16).toUpperCase().padStart(4, '0')
                      : '0x' + rowOffset.toString(16).toUpperCase().padStart(5, '0')
                    }
                  </td>
                  {Array.from({ length: COLS }, (_, col) => {
                    const offset = rowOffset + col;
                    const value = offset < data.length ? data[offset] : null;
                    const isSelected = offset === selectedOffset;
                    const isPatternStart = offset === pattern1Offset;

                    return (
                      <td
                        key={col}
                        className={`byte-cell ${isSelected ? 'selected' : ''} ${isPatternStart ? 'pattern-marker' : ''}`}
                        onClick={() => value !== null && handleByteClick(offset)}
                      >
                        {value !== null ? value.toString(16).toUpperCase().padStart(2, '0') : ''}
                      </td>
                    );
                  })}
                  <td className="ascii-cell">
                    {Array.from({ length: COLS }, (_, col) => {
                      const offset = rowOffset + col;
                      const value = offset < data.length ? data[offset] : null;
                      if (value === null) return '';
                      return value >= 32 && value <= 126 ? String.fromCharCode(value) : '.';
                    }).join('')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
