import React from 'react';
import { Character } from '../lib/Character';

interface SlotGridProps {
  characters: Character[];
  selectedIndex: number | null;
  onSelectSlot: (index: number) => void;
  mode: 'source' | 'destination';
  title?: string;
}

export const SlotGrid: React.FC<SlotGridProps> = ({
  characters,
  selectedIndex,
  onSelectSlot,
  mode,
  title = mode === 'source' ? 'SOURCE SLOTS' : 'DESTINATION SLOTS'
}) => {
  const accentColor = mode === 'source' ? '#ff6b35' : '#3b82f6';

  return (
    <div className="slot-grid-container">
      <h3 className="slot-grid-title">{title}</h3>
      <div className="slot-grid">
        {characters.slice(0, 10).map((char, index) => {
          const isSelected = selectedIndex === index;
          const isEmpty = char.isEmpty;

          return (
            <div
              key={index}
              className={`slot-item ${isSelected ? 'selected' : ''} ${isEmpty ? 'empty' : ''}`}
              onClick={() => onSelectSlot(index)}
            >
              <div className="slot-header">
                <span className="slot-number">Slot {index}</span>
              </div>
              <div className="slot-info">
                {isEmpty ? (
                  <span className="empty-label">Empty Slot</span>
                ) : (
                  <>
                    <div className="slot-name">{char.name || 'Unnamed'}</div>
                    <div className="slot-level">Level {char.level}</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .slot-grid-container {
          background: rgba(0, 0, 0, 0.3);
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid ${mode === 'source' ? 'rgba(255, 107, 53, 0.3)' : 'rgba(59, 130, 246, 0.3)'};
        }

        .slot-grid-title {
          color: ${accentColor};
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          text-align: center;
          letter-spacing: 0.5px;
        }

        .slot-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.75rem;
        }

        .slot-item {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 85px;
          display: flex;
          flex-direction: column;
        }

        .slot-item:hover {
          border-color: ${accentColor};
          background: rgba(${mode === 'source' ? '255, 107, 53' : '59, 130, 246'}, 0.1);
        }

        .slot-item.selected {
          border-color: ${accentColor};
          border-width: 2px;
          background: rgba(${mode === 'source' ? '255, 107, 53' : '59, 130, 246'}, 0.2);
        }

        .slot-item.empty {
          background: rgba(0, 0, 0, 0.2);
          opacity: 0.6;
        }

        .slot-item.empty:hover {
          opacity: 0.8;
        }

        .slot-header {
          margin-bottom: 0.5rem;
        }

        .slot-number {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .slot-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .slot-name {
          color: rgba(255, 255, 255, 0.95);
          font-weight: 500;
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .slot-level {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.75rem;
        }

        .empty-label {
          color: rgba(255, 255, 255, 0.3);
          font-size: 0.8rem;
          font-style: italic;
          text-align: center;
        }

        @media (max-width: 1200px) {
          .slot-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 768px) {
          .slot-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 480px) {
          .slot-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .slot-item {
            padding: 0.5rem;
            min-height: 70px;
          }
        }
      `}</style>
    </div>
  );
};
