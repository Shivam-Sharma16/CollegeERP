import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store/index'
import { loadTheme } from './features/ui/themeSlice'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/global.css'
import App from './App.jsx'

// Load theme config on boot (applies CSS variables to :root)
store.dispatch(loadTheme())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
)
