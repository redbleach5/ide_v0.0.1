// Monaco Editor configuration
// @monaco-editor/react uses CDN by default, which is allowed by CSP
// This file ensures Monaco is properly initialized

// Set up Monaco environment for workers if needed
if (typeof window !== 'undefined') {
  // Monaco workers will be handled by @monaco-editor/react automatically
  window.MonacoEnvironment = window.MonacoEnvironment || {};
  
  // Set Russian locale for Monaco Editor
  // This will localize some UI elements, but context menu items need manual override
  window.MonacoEnvironment.locale = 'ru';
}

// Export empty object to make this a module (required for isolatedModules)
export {};
