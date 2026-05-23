export function Footer() {
  return (
    <div className="px-6">
    <footer className="max-w-280 mx-auto py-12 flex flex-col md:flex-row justify-between items-center text-sm text-muted">
      <div className="mb-6 md:mb-0 text-center md:text-left">
        <strong className="text-dark font-medium font-serif">Architect</strong> © 2026 Leviron<br />
        Open source under MIT License.
      </div>
      <div className="flex space-x-8">
        <a href="https://github.com/Levironexe/architect" target="_blank" className="hover:text-dark transition-colors">GitHub</a>
        <a href="https://www.npmjs.com/package/@levironexe/architect" target="_blank" className="hover:text-dark transition-colors">NPM Package</a>
        <a href="/docs" className="hover:text-dark transition-colors">Documentation</a>
      </div>
    </footer>
    </div>
  );
}
