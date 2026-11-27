import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans-hebrew/400.css'
import '@fontsource/ibm-plex-sans-hebrew/500.css'
import '@fontsource/ibm-plex-sans-hebrew/600.css'
import '@fontsource/ibm-plex-sans-hebrew/700.css'
import App from './App.tsx'

// מבקש מהדפדפן לא למחוק את המידע כשחסר מקום
navigator.storage?.persist?.().catch(() => {})

// כשעולה גרסה חדשה לאתר, הדף נטען מחדש פעם אחת כדי להציג אותה מיד (ולא רק אחרי רענון נוסף).
// כל המידע כבר שמור בתיקייה, והכלי נפתח שוב במסך הנעילה.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let done = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (done) return
    done = true
    location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
