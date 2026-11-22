import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { webPerfMonitor } from './utils/webperf'

// Initialize Core Web Vitals and Web Performance Monitoring (nucliweb/webperf-snippets)
webPerfMonitor.init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
