const Button = ({ children, onClick, disabled, className = '' }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded ${className}`}
    >
      {children}
    </button>
  )
}

export default Button 