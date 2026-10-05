import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Sin <StrictMode>: duplicaría los observers de métricas y los números de la demo.
createRoot(document.getElementById('root')!).render(<App />);
