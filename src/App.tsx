import { DashboardApp } from './views/DashboardApp'
import { PublicTagPage } from './views/PublicTagPage'

function App() {
  const publicSlug = window.location.pathname.match(/^\/t\/([^/]+)/)?.[1]
  return publicSlug ? <PublicTagPage slug={decodeURIComponent(publicSlug)} /> : <DashboardApp />
}

export default App
