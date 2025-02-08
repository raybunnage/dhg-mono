import Header from './components/Header/Header'
import Button from './components/Button/Button'
import ThemeToggle from './components/ThemeToggle/ThemeToggle'

function App() {
  return (
    <>
      <Header />
      <main>
        <h1>DHG App A</h1>
        <Button>Click Me</Button>
        <div className="mt-4">
          <ThemeToggle />
        </div>
        <p className="mt-2">Environment: {import.meta.env.VITE_ENV}</p>
      </main>
      <footer role="contentinfo">
        <p>© 2024 DHG App A</p>
      </footer>
    </>
  )
}

export default App 