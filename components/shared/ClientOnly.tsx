"use client";
import { useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};

/**
 * İçeriği yalnız istemcide render eder. `useSyncExternalStore` sunucuda ve
 * hydration'ın ilk boyasında `false` (→ fallback), hydration sonrası `true`
 * (→ children) döner. Böylece sunucu/istemci ilk boyası fallback'te buluşur ve
 * istemci-tarafı veri (react-query cache vb.) kaynaklı hydration uyuşmazlıkları
 * tasarımdan önlenir. setState-in-effect yok.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,  // istemci snapshot'ı
    () => false, // sunucu snapshot'ı
  );
  return <>{isClient ? children : fallback}</>;
}
