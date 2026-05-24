import React from 'react';

// Layout is a thin pass-through. The Desktop page handles its own chrome
// (taskbar, windows, start menu). Other pages render inside Desktop windows.
export default function Layout({ children, currentPageName }) {
  if (currentPageName === 'Desktop') {
    return <>{children}</>;
  }

  return (
    <div className="app-shell-page">
      <div className="app-page-content">{children}</div>
    </div>
  );
}
