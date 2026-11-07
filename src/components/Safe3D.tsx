import { Component, useState, type ReactNode } from 'react';

let supported: boolean | null = null;
/** True when the browser can create a WebGL context (checked once). */
export function hasWebGL() {
  if (supported !== null) return supported;
  try {
    const c = document.createElement('canvas');
    const g = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    supported = !!g;
    g?.getExtension('WEBGL_lose_context')?.loseContext();   // don't keep the probe's context alive
  } catch {
    supported = false;
  }
  return supported;
}

/** Wraps a 3D canvas so a WebGL failure only removes that canvas, never the whole page. */
export default class Safe3D extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: !hasWebGL() };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn('3D view disabled:', e); }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}

/** Give a <Canvas> this key + onCreated: if the browser drops its WebGL context, the canvas is rebuilt. */
export function useContextRecovery() {
  const [key, setKey] = useState(0);
  const onCreated = ({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
    gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setTimeout(() => setKey((k) => k + 1), 300); }, { once: true });
  };
  return { key, onCreated };
}
