import '../fonts/typography.css';
import '../theme/glass.css';
import '../vuelo/style.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CrewApp } from './CrewApp.jsx';

createRoot(document.getElementById('root')).render(<CrewApp />);
