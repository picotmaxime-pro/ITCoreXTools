import React from 'react';
import ReactDOM from 'react-dom/client';
import { PerfLabApp } from './App';
import '../shared/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PerfLabApp />
  </React.StrictMode>
);
