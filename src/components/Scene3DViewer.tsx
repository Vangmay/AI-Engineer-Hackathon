import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface Props {
  glbUrl: string;
  previewUrl?: string;
}

export function Scene3DViewer({ glbUrl, previewUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2236);
    scene.fog = new THREE.FogExp2(0x1a2236, 0.018);

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.01, 200);
    camera.position.set(0, 2, 7);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1;
    controls.maxDistance = 30;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.maxPolarAngle = Math.PI * 0.72;

    // Sky/ground hemisphere — fills shadows with cool sky bounce
    const hemi = new THREE.HemisphereLight(0x8aaed4, 0x3d5c2a, 1.6);
    scene.add(hemi);

    // Bright moonlight key
    const moon = new THREE.DirectionalLight(0xd8eaff, 3.5);
    moon.position.set(-6, 10, 5);
    moon.castShadow = true;
    moon.shadow.mapSize.set(4096, 4096);
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 80;
    moon.shadow.camera.left = -20;
    moon.shadow.camera.right = 20;
    moon.shadow.camera.top = 20;
    moon.shadow.camera.bottom = -20;
    moon.shadow.bias = -0.0005;
    scene.add(moon);

    // Soft fill from opposite side to reveal shadow detail
    const fill = new THREE.DirectionalLight(0x6080c0, 1.2);
    fill.position.set(6, 4, -4);
    scene.add(fill);

    // Police car blue-red strobes
    const blueLight = new THREE.PointLight(0x4488ff, 5, 18);
    blueLight.position.set(-4, 1.5, 4);
    scene.add(blueLight);

    const redLight = new THREE.PointLight(0xff3300, 4, 18);
    redLight.position.set(4, 1.5, 3);
    scene.add(redLight);

    // Warm forensic work-light
    const workLight = new THREE.PointLight(0xffe8a0, 3.5, 10);
    workLight.position.set(0, 3, 2);
    scene.add(workLight);

    // Warm window glow
    const windowLight = new THREE.PointLight(0xffcc44, 2.5, 8);
    windowLight.position.set(0, 2, -1);
    scene.add(windowLight);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2a3820,
      roughness: 0.9,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

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
        const targetSize = 5;
        const scale = targetSize / maxDim;

        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        const scaledBox = new THREE.Box3().setFromObject(model);
        model.position.y -= scaledBox.min.y;

        ground.position.y = scaledBox.min.y - 0.02;

        model.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          // Boost material brightness so dark-baked textures read clearly
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.roughness = Math.min(mat.roughness, 0.82);
              mat.envMapIntensity = 1.4;
            }
          }
        });

        scene.add(model);

        const h3 = scaledBox.max.y - scaledBox.min.y;
        camera.position.set(0, h3 * 0.55, maxDim * scale * 1.6);
        controls.target.set(0, h3 * 0.35, 0);
        controls.update();

        setLoading(false);
      },
      undefined,
      (err) => {
        setError(String(err instanceof Error ? err.message : err));
        setLoading(false);
      },
    );

    let t = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.012;
      // Strobe the police lights slowly
      blueLight.intensity = 3 + Math.sin(t * 3.7) * 1.2;
      redLight.intensity = 2.5 + Math.sin(t * 3.7 + Math.PI) * 1.0;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

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

  return (
    <div className="relative w-full h-full" style={{ background: '#0b0f1a' }}>
      <div ref={containerRef} className="w-full h-full" />

      {loading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ background: '#0b0f1a' }}
        >
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Scene preview"
              className="h-full w-full object-cover opacity-30 absolute inset-0"
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div
              className="text-[10px] tracking-[0.25em] animate-pulse"
              style={{ color: '#c9b06a' }}
            >
              LOADING CRIME SCENE…
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          className="absolute inset-0 flex items-center justify-center text-[10px] opacity-50"
          style={{ background: '#0b0f1a', color: '#c9b06a' }}
        >
          SCENE UNAVAILABLE
        </div>
      )}

      {!loading && !error && (
        <div
          className="absolute bottom-2 left-2 text-[8px] tracking-[0.18em] pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          DRAG · ROTATE &nbsp;|&nbsp; SCROLL · ZOOM
        </div>
      )}
    </div>
  );
}
