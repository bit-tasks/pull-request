import { Routes, Route } from 'react-router-dom';
import { GetMessage } from '@frontend/ci-scripts-tests.get-message';

export function MyApp() {
  return (
    <Routes>
      <Route path="/" element={<GetMessage>Hello World!</GetMessage>} />
    </Routes>
  );
}