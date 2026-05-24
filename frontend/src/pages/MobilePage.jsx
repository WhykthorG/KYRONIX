// Þ®▓Úáàþø«Õ«îÕà¿þö▒ Whykthor GSV Þú¢õ¢£
import React from 'react';

import MobileShellRoot from '@/components/mobile-shell/MobileShellRoot';
import {
  MOBILE_SHELL_DEMO_VIEWER,
  buildMobileShellModuleCatalog,
} from '@/lib/mocks/mobileShell';
import { ALL_APP_ENTRIES } from '@/lib/appManifest';

export default function MobilePage() {
  const moduleCatalog = buildMobileShellModuleCatalog(ALL_APP_ENTRIES);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_52%,#020617_100%)] px-0 py-0 md:px-6 md:py-10">
      <div className="mx-auto flex min-h-screen items-center justify-center md:min-h-0">
        <div className="h-screen w-full overflow-hidden md:h-[880px] md:max-w-[430px] md:rounded-[40px] md:border md:border-white/10 md:shadow-[0_45px_120px_rgba(2,6,23,0.45)]">
          <MobileShellRoot
            moduleCatalog={moduleCatalog}
            viewer={MOBILE_SHELL_DEMO_VIEWER}
            fullscreen={false}
          />
        </div>
      </div>
    </div>
  );
}
