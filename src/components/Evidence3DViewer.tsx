import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  glbUrl: string;
  previewUrl?: string;
  label: string;
  description: string;
  onClose?: () => void;
  inline?: boolean;
}

export function Evidence3DViewer({ glbUrl, previewUrl, label, description, onClose, inline }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e110e);
    scene.fog = new THREE.Fog(0x0e110e, 8, 20);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
    camera.position.set(0, 1.2, 3.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 12;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;

    const ambientLight = new THREE.AmbientLight(0xd4d4c8, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffe5b0, 1.8);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x8ab4d4, 0.5);
    fillLight.position.set(-3, 2, -2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xd6c440, 0.35);
    rimLight.position.set(0, -1, -4);
    scene.add(rimLight);

    const gridHelper = new THREE.GridHelper(6, 20, 0x1a3020, 0x141a14);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    let animId: number;

    const loader = new GLTFLoader();
    loader.load(
      glbUrl,
      (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.2 / maxDim;

        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y -= scaledBox.min.y;

        gridHelper.position.y = scaledBox.min.y - 0.01;

        model.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        scene.add(model);

        const boxHeight = scaledBox.max.y - scaledBox.min.y;
        camera.position.set(0, boxHeight * 0.6, maxDim * scale * 2.2);
        controls.target.set(0, boxHeight * 0.3, 0);
        controls.update();

        setLoading(false);
      },
      undefined,
      (err) => {
        setError(`Failed to load 3D model: ${err instanceof Error ? err.message : String(err)}`);
        setLoading(false);
      },
    );

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [glbUrl]);

  if (inline) {
    return (
      <div className="relative w-full h-full">
        <div ref={canvasRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ background: '#0e110e' }}>
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="h-20 w-20 object-contain opacity-40" />
            )}
            <div className="text-[10px] tracking-[0.2em] animate-pulse" style={{ color: 'var(--accent-yellow, #c9b06a)' }}>
              LOADING 3D…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] opacity-60" style={{ background: '#0e110e' }}>
            3D UNAVAILABLE
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="relative flex flex-col"
        style={{
          width: 'min(92vw, 760px)',
          height: 'min(88vh, 580px)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-3 py-2 shrink-0"
          style={{
            borderBottom: '1px solid var(--border-yellow)',
            background: 'var(--bg-statusbar)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-[9px] tracking-[0.2em]"
              style={{ color: 'var(--accent-yellow)' }}
            >
              FORENSIC ANALYSIS
            </span>
            <span
              className="text-[11px] tracking-[0.12em]"
              style={{ color: 'var(--text-primary)' }}
            >
              {label.toUpperCase()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="text-[11px] tracking-[0.15em]"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Close 3D viewer"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Canvas area */}
        <div className="relative flex-1 min-h-0">
          <div ref={canvasRef} className="w-full h-full" />

          {loading && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: 'var(--bg-panel)' }}
            >
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Evidence preview"
                  className="h-32 w-32 object-contain opacity-40"
                />
              )}
              <div
                className="text-[10px] tracking-[0.2em] animate-pulse"
                style={{ color: 'var(--accent-yellow)' }}
              >
                LOADING 3D MODEL…
              </div>
            </div>
          )}

          {error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{ background: 'var(--bg-panel)' }}
            >
              <div
                className="text-[11px] tracking-[0.1em]"
                style={{ color: 'var(--accent-red)' }}
              >
                MODEL LOAD ERROR
              </div>
              <div
                className="text-[10px] max-w-[60%] text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-3 py-2 shrink-0 flex items-center justify-between"
          style={{
            borderTop: '1px solid var(--border-yellow)',
            background: 'var(--bg-statusbar)',
          }}
        >
          <p
            className="text-[10px] leading-snug flex-1 mr-4"
            style={{ color: 'var(--text-muted)' }}
          >
            {description}
          </p>
          {!loading && !error && (
            <span
              className="text-[9px] tracking-[0.15em] shrink-0"
              style={{ color: 'var(--accent-green)' }}
            >
              DRAG TO ROTATE · SCROLL TO ZOOM
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
