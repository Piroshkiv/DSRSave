import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
