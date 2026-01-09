import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'info' | 'success' | 'error';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning'
}) => {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'warning':
        return '#ff6b35';
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'info':
        return '#3b82f6';
      default:
        return '#ff6b35';
    }
  };

  const typeColor = getTypeColor();

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="modal-button cancel-button" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="modal-button confirm-button" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-content {
          background: #1a1a1a;
          border: 2px solid ${typeColor};
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-header h3 {
          margin: 0;
          color: ${typeColor};
          font-size: 1.5rem;
          font-weight: 600;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-body p {
          margin: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 1rem;
          line-height: 1.6;
          white-space: pre-line;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .modal-button {
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 600;
          border: 2px solid;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .cancel-button {
          background: transparent;
          border-color: rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.8);
        }

        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .confirm-button {
          background: ${typeColor};
          border-color: ${typeColor};
          color: #fff;
        }

        .confirm-button:hover {
          filter: brightness(1.2);
          transform: translateY(-2px);
        }

        .modal-button:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};
