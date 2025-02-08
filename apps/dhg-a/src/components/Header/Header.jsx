const Header = () => {
  return (
    <header role="banner" aria-label="Main Header">
      <img src="/logo.svg" alt="logo" className="h-8" />
      <nav>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    </header>
  )
}

export default Header 