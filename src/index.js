import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 注意：不使用 React.StrictMode，避免 Kepler.gl 重复渲染
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);