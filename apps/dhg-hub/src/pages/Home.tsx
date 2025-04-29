export function Home() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to DHG Hub</h1>
      <p className="mb-4">
        This is a new application that demonstrates the use of shared services and components
        from the DHG monorepo.
      </p>
      <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
        <h2 className="text-xl font-semibold mb-2 text-blue-800">Features</h2>
        <ul className="list-disc pl-6">
          <li className="mb-1">Shared Supabase client service</li>
          <li className="mb-1">Route-based navigation</li>
          <li className="mb-1">Tailwind CSS styling</li>
          <li className="mb-1">TypeScript support</li>
        </ul>
      </div>
    </div>
  )
}