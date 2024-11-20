import { Routes, Route } from 'react-router-dom';
import { HelloWorld } from '@bit-tasks/test-scope.ui.hello-world'

//app
export function MyApp() {
  return (
    <Routes>
      <Route path="/" element={<HelloWorld/>} />
    </Routes>
  );
}
