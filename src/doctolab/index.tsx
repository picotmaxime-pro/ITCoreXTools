import React from 'react';
import ReactDOM from 'react-dom/client';
import { DoctoLabApp } from './App';
import '../shared/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <DoctoLabApp />
  </React.StrictMode>
);
