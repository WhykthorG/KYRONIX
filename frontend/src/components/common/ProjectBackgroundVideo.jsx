import React from 'react';

import { cn } from '@/lib/utils';
import { getShellBackgroundOption } from '@/lib/shellBackground';
import { useUserShellBackgroundPreference } from '@/lib/userShellBackground';

export default function ProjectBackgroundVideo({
  className,
  contentClassName,
  videoClassName,
  overlayClassName,
  profileKey,
  mode,
  assetId,
  forceStatic = false,
  children,
}) {
  const profilePreference = useUserShellBackgroundPreference(profileKey);
  const resolvedMode = forceStatic ? 'estatico' : (mode || profilePreference.backgroundMode);
  const resolvedOption = getShellBackgroundOption(
    resolvedMode,
    assetId || profilePreference.backgroundAssetId,
  );
  const useStaticBackground = resolvedOption?.assetType === 'image';

  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      {useStaticBackground ? (
        <img
          src={resolvedOption.source}
          alt=""
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-cover',
            videoClassName
          )}
        />
      ) : (
        <video
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full object-cover',
            videoClassName
          )}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={resolvedOption?.source} type={resolvedOption?.mimeType || 'video/webm'} />
        </video>
      )}

      {overlayClassName ? (
        <div
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0', overlayClassName)}
        />
      ) : null}

      <div className={cn('relative z-10', contentClassName)}>
        {children}
      </div>
    </div>
  );
}
