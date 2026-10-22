import { useEffect, useRef, useState } from 'react';
import { CarPresentation } from '@simple-strike/client-core';
import { carPresentationPort, type CarSnapshot } from '../modules/strike-map/carplay';

export function useCarPresentation(snapshot: CarSnapshot): boolean {
  const publisher = useRef<CarPresentation<CarSnapshot> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    const owner = new CarPresentation(carPresentationPort, () => { if (mounted) setFailed(true); });
    publisher.current = owner;
    return () => {
      mounted = false; publisher.current = null;
      void owner.close().catch(() => undefined);
    };
  }, []);
  useEffect(() => { publisher.current?.update(snapshot); }, [snapshot]);
  return failed;
}
