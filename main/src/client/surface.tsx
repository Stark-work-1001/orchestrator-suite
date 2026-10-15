import React from 'react';

// Each mounted slot owns its stylesheet. Disposing another slot or an older
// loader generation cannot remove the styles of a live surface.
declare const __SUITE_CSS__: string;
export function Surface({ children }: { children: React.ReactNode }) {
  return <div className="os-surface"><style>{__SUITE_CSS__}</style>{children}</div>;
}
