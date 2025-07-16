import React from 'react';
import { render } from '@testing-library/react';
import { BasicGetMessage } from './get-message.composition.js';

it('should render the correct text', () => {
  const { getByText } = render(<BasicGetMessage />);
  const rendered = getByText('hello world!');
  expect(rendered).toBeTruthy();
});
