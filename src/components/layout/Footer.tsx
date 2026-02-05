export function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Laguna Hills Homeowners Association. All
          rights reserved.
        </p>
      </div>
    </footer>
  );
}
