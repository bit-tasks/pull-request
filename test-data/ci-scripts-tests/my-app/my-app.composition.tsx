import { MemoryRouter } from 'react-router-dom';
import { MyApp } from "./my-app.js";
    
export const MyAppBasic = () => {
  return (
    <MemoryRouter>
      <MyApp />
    </MemoryRouter>
  );
}