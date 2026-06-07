export const FooterCredits = () => (
  <footer className="flex items-center justify-between text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
    <span>© {new Date().getFullYear()} AdminISP. Todos los derechos reservados.</span>
    <span>
      Desarrollado por{' '}
      <a
        href="https://developers-soft.pages.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-700 font-medium transition-colors"
      >
        Developers-Soft
      </a>
    </span>
  </footer>
);
