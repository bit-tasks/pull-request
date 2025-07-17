import type { ReactNode } from 'react';

export type GetMessageProps = {
  /**
   * sets the component children.
   */
  children?: ReactNode;
};

export function GetMessage({ children }: GetMessageProps) {
  return (
    <div>
      {children}!
    </div>
  );
}
