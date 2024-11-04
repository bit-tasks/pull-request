import { Routes, Route } from 'react-router-dom';
import { HelloWorld } from '@bit-tasks/test-scope.ui.hello-world'

export function MyApp() {
  return (
    <Routes>
      <Route path="/" element={<HelloWorld/>} />
    </Routes>
  );
}