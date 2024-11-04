import type { ReactNode } from 'react';
import cx from 'classnames';

export type ButtonProps = {
  /**
   * sets the component children
   */
  children?: ReactNode;
  className?: string;
};

export function Button({ className, children }: ButtonProps) {
  return <div className={cx(className)}>{children}</div>;
}
