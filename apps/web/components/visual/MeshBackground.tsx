/** Continuous blended mesh canvas — sky / cyan / indigo / violet bleeding
 *  into each other over the themed base. Pure CSS, GPU-cheap, reduced-motion
 *  safe (drift is disabled via media query). Sits behind all content. */
export function MeshBackground() {
  return (
    <div className="mesh-canvas mesh-grain" aria-hidden="true">
      <div className="mesh-blob b-sky m1" />
      <div className="mesh-blob b-indigo m2" />
      <div className="mesh-blob b-cyan m3" />
      <div className="mesh-blob b-violet m4" />
    </div>
  );
}
