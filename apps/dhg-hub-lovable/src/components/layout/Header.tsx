import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export const Header = () => {
  return (
    <header className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-2xl font-bold text-primary">
            Dynamic Healing Network
          </h1>
          <nav className="hidden md:flex space-x-6">
            <a
              href="/documents"
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Documents
            </a>
            <a
              href="/experts"
              className="text-gray-600 hover:text-primary transition-colors"
            >
              Experts
            </a>
          </nav>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary hover:text-primary/90"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};