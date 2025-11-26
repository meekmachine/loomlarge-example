import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EngineBabylon } from '../engine/EngineBabylon';
import { createAnimationService } from '../latticework/animation/animationService';

export type BabylonContextValue = {
  engine: EngineBabylon;
  anim: ReturnType<typeof createAnimationService>;
  addFrameListener: (cb: (dt: number) => void) => () => void;
};

export const BabylonCtx = createContext<BabylonContextValue | null>(null);

export const BabylonProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const engineRef = useRef<EngineBabylon | null>(null);
  const animRef = useRef<ReturnType<typeof createAnimationService> | null>(null);
  const listenersRef = useRef(new Set<(dt: number) => void>());
  const rafRef = useRef<number | null>(null);
  const [animReady, setAnimReady] = useState(false);

  if (!engineRef.current) {
    engineRef.current = new EngineBabylon();
  }

  useEffect(() => {
    if (!animRef.current && engineRef.current) {
      const host = {
        applyAU: (id: number | string, v: number) => engineRef.current!.setAU(id, v),
        setMorph: (key: string, v: number) => engineRef.current!.setMorph(key, v),
        transitionAU: (id: number | string, v: number, dur?: number) => engineRef.current!.transitionAU(id, v, dur),
        transitionMorph: (key: string, v: number, dur?: number) => engineRef.current!.transitionMorph(key, v, dur),
        setEyesHorizontal: (v: number) => engineRef.current!.setEyesHorizontal(v),
        setEyesVertical: (v: number) => engineRef.current!.setEyesVertical(v),
        setHeadHorizontal: (v: number) => engineRef.current!.setHeadHorizontal(v),
        setHeadVertical: (v: number) => engineRef.current!.setHeadVertical(v),
        setHeadTilt: (v: number) => engineRef.current!.setHeadTilt(v),
        setJawHorizontal: (v: number) => engineRef.current!.setJawHorizontal(v),
        setTongueHorizontal: (v: number) => engineRef.current!.setTongueHorizontal(v),
        setTongueVertical: (v: number) => engineRef.current!.setTongueVertical(v),
        onSnippetEnd: (name: string) => {
          try { window.dispatchEvent(new CustomEvent('visos:snippetEnd', { detail: { name } })); } catch {}
        }
      };
      animRef.current = createAnimationService(host);
      (window as any).animBabylon = animRef.current;
      setAnimReady(true);
    }
  }, []);

  // Simple RAF loop to notify listeners; Babylon render loop lives in the scene component
  useEffect(() => {
    const step = (ts: number) => {
      const dt = 0.016; // approx; actual render loop handled in scene
      listenersRef.current.forEach(cb => cb(dt));
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      try { animRef.current?.dispose?.(); } catch {}
    };
  }, []);

  const value = useMemo(() => {
    if (!engineRef.current || !animRef.current) return null;
    return {
      engine: engineRef.current,
      anim: animRef.current,
      addFrameListener: (cb: (dt: number) => void) => {
        listenersRef.current.add(cb);
        return () => listenersRef.current.delete(cb);
      }
    };
  }, [animReady]);

  if (!value) return null;
  return <BabylonCtx.Provider value={value}>{children}</BabylonCtx.Provider>;
};

export function useBabylonState() {
  const ctx = useContext(BabylonCtx);
  if (!ctx) throw new Error('useBabylonState must be used within a BabylonProvider');
  return ctx;
}

export function useBabylonOptional() {
  return useContext(BabylonCtx);
}
