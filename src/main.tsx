import { createRoot } from "react-dom/client"
import { App } from "./App"
import { installDemoWarningFilter } from "./rendering/install-demo-warning-filter"

installDemoWarningFilter()

createRoot(document.getElementById("root")!).render(<App />)
