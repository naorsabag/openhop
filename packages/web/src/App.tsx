import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FlowLibrary } from './components/FlowLibrary'
import { FlowViewer } from './components/FlowViewer'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FlowLibrary />} />
        <Route path="/flow/:id" element={<FlowViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
