import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { L, KIN, MAXREACH, d2r } from "./spec.js";

// three.js scene graph. The arm is a nested group chain (one group per joint),
// which is the integration seam for real CAD meshes later: drop a mesh onto the
// matching group and it inherits correct motion. Reads joint angles + target
// from the shared `state` object every frame.
export default function RobotArm({ state }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x0c111a);
    const bgFog = new THREE.Fog(0x0c111a, 10, 26);
    scene.background = bgColor;
    scene.fog = bgFog;

    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(4.6, 3.2, 5.6);
    cam.lookAt(0, 1.5, 0);

    // alpha:true so the canvas can be transparent over the camera feed (AR)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { position: "absolute", inset: "0" });

    // Orbit / pinch-zoom camera. Auto-rotates until the teleop goes live, then
    // hands control to the user (drag to rotate, pinch / wheel to zoom).
    const controls = new OrbitControls(cam, renderer.domElement);
    controls.target.set(0, 1.4, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.2;
    controls.maxDistance = 24;
    controls.autoRotateSpeed = 0.8;
    controls.update();
    controls.saveState(); // capture the initial view for RESET VIEW
    state.resetView = () => controls.reset();

    // lighting
    scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x202a36, 1.1));
    const keyL = new THREE.DirectionalLight(0xffffff, 1.6);
    keyL.position.set(6, 9, 5);
    scene.add(keyL);
    const fill = new THREE.DirectionalLight(0x88bbff, 0.6);
    fill.position.set(-5, 4, -3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffa060, 0.5);
    rim.position.set(0, 3, -6);
    scene.add(rim);

    const grid = new THREE.GridHelper(18, 36, 0x2a3d52, 0x18222e);
    scene.add(grid);
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(MAXREACH, 28, 18),
      new THREE.MeshBasicMaterial({
        color: 0x2e9bff,
        transparent: true,
        opacity: 0.07,
        wireframe: true,
      })
    );
    env.position.y = KIN.shoulderY;
    scene.add(env);

    const mat = (c) =>
      new THREE.MeshStandardMaterial({ color: c, metalness: 0.45, roughness: 0.5 });
    const ORANGE = 0xf26a1b,
      ORANGE_D = 0xc9550f,
      GREY = 0x3b454f,
      DKGREY = 0x2a323b,
      BLACK = 0x1a1f25,
      STEEL = 0x8a98a6;

    const box = (w, h, d, c, mtl) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mtl || mat(c));
    const cyl = (rt, rb, h, c, seg = 24, mtl) =>
      new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mtl || mat(c));
    const add = (parent, mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, rz);
      parent.add(mesh);
      return mesh;
    };

    // ---- BASE: ribbed cast pedestal bolted to floor ----
    const baseGrp = new THREE.Group();
    scene.add(baseGrp);
    add(baseGrp, cyl(0.62, 0.92, 0.16, GREY), 0, 0.08, 0);
    add(baseGrp, cyl(0.5, 0.62, 0.5, ORANGE), 0, 0.41, 0);
    add(baseGrp, cyl(0.46, 0.5, L.base - 0.66, ORANGE), 0, (L.base - 0.66) / 2 + 0.66, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(baseGrp, cyl(0.05, 0.05, 0.08, BLACK, 10), Math.cos(a) * 0.78, 0.12, Math.sin(a) * 0.78);
    }

    // ---- J1: rotating shoulder turret (yaw about Y) ----
    const j1 = new THREE.Group();
    j1.position.y = L.base;
    scene.add(j1);
    add(j1, cyl(0.5, 0.55, 0.34, ORANGE), 0, 0.05, 0);
    add(j1, box(0.86, 0.62, 0.84, ORANGE), 0, 0.42, 0);
    add(j1, box(0.9, 0.5, 0.5, ORANGE_D), 0, 0.42, 0);
    add(j1, cyl(0.2, 0.2, 0.94, DKGREY, 20), 0, 0.46, 0, 0, 0, Math.PI / 2);
    add(j1, cyl(0.23, 0.23, 0.16, BLACK, 20), 0.48, 0.46, 0, 0, 0, Math.PI / 2);
    add(j1, cyl(0.23, 0.23, 0.16, BLACK, 20), -0.48, 0.46, 0, 0, 0, Math.PI / 2);

    // ---- J2: upper arm casting (pitch about Z) ----
    const j2 = new THREE.Group();
    j2.position.y = 0.46;
    j1.add(j2);
    const ua = new THREE.Group();
    j2.add(ua);
    const uaLen = L.upperArm;
    add(ua, box(0.34, uaLen, 0.5, ORANGE), 0, uaLen / 2, 0);
    add(ua, box(0.42, 0.34, 0.6, ORANGE), 0, 0.12, 0);
    add(ua, box(0.26, uaLen * 0.9, 0.34, ORANGE_D), 0, uaLen * 0.5, 0);
    add(ua, cyl(0.24, 0.24, 0.56, DKGREY, 20), 0, 0.04, 0, 0, 0, Math.PI / 2);

    // ---- J3: elbow knuckle + forearm (pitch about Z) ----
    const j3 = new THREE.Group();
    j3.position.y = uaLen;
    ua.add(j3);
    add(j3, cyl(0.28, 0.28, 0.52, GREY, 20), 0, 0, 0, 0, 0, Math.PI / 2);
    add(j3, cyl(0.3, 0.3, 0.18, BLACK, 20), 0.27, 0, 0, 0, 0, Math.PI / 2);
    add(j3, cyl(0.3, 0.3, 0.18, BLACK, 20), -0.27, 0, 0, 0, 0, Math.PI / 2);
    const fa = new THREE.Group();
    j3.add(fa);
    const faLen = L.foreArm;
    add(fa, box(0.28, faLen, 0.3, ORANGE), 0, faLen / 2, 0);
    add(fa, box(0.2, faLen * 0.95, 0.2, ORANGE_D), 0, faLen * 0.5, 0);
    add(fa, box(0.34, 0.3, 0.4, ORANGE), 0, 0.1, 0);

    // ---- J4: wrist roll (about arm axis / Y) ----
    const j4 = new THREE.Group();
    j4.position.y = faLen;
    fa.add(j4);
    add(j4, cyl(0.17, 0.2, 0.34, GREY), 0, 0.12, 0);

    // ---- J5: wrist bend (pitch about Z) ----
    const j5 = new THREE.Group();
    j5.position.y = 0.28;
    j4.add(j5);
    add(j5, cyl(0.16, 0.16, 0.36, DKGREY, 18), 0, 0, 0, 0, 0, Math.PI / 2);
    const wr = new THREE.Group();
    j5.add(wr);
    add(wr, cyl(0.14, 0.16, L.wrist, GREY), 0, L.wrist / 2, 0);

    // ---- J6: tool flange (roll about Y) ----
    const j6 = new THREE.Group();
    j6.position.y = L.wrist;
    wr.add(j6);
    add(j6, cyl(0.13, 0.13, 0.05, STEEL, 24), 0, 0.025, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(j6, cyl(0.012, 0.012, 0.06, BLACK, 8), Math.cos(a) * 0.09, 0.05, Math.sin(a) * 0.09);
    }
    const J = [j1, j2, j3, j4, j5, j6];

    const target = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x33ff99 })
    );
    scene.add(target);
    const ghost = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.62, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0x44ddff,
        transparent: true,
        opacity: 0.5,
        emissive: 0x113355,
      })
    );
    scene.add(ghost);

    // AIM mode: a ray from the shoulder along the phone's pointing direction;
    // the green target rides along it at the slider's reach distance.
    const rayGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const aimRay = new THREE.Line(
      rayGeom,
      new THREE.LineBasicMaterial({ color: 0x33ff99, transparent: true, opacity: 0.5 })
    );
    scene.add(aimRay);

    function resize() {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", resize);
    resize();

    let raf = 0;
    let wasAr = false;
    const off = new THREE.Vector3(0, KIN.shoulderY, 0);
    function tick() {
      raf = requestAnimationFrame(tick);
      // entering AR: snap to a front-on view centred on the sphere so the
      // camera image and the point/sphere line up
      if (state.ar && !wasAr) {
        cam.position.set(0, KIN.shoulderY, 6.8);
        controls.target.set(0, KIN.shoulderY, 0);
        controls.update();
      }
      wasAr = state.ar;
      const a = state.angles;
      J[0].rotation.y = d2r(a[0]);
      J[1].rotation.z = d2r(a[1]);
      J[2].rotation.z = d2r(a[2]);
      J[3].rotation.y = d2r(a[3]);
      J[4].rotation.z = d2r(a[4]);
      J[5].rotation.y = d2r(a[5]);

      const blob = state.armVisible === false; // arm hidden, free point follows finger
      j1.visible = !blob;
      baseGrp.visible = !blob;
      // sphere reads brighter when it's the main guide (blob mode)
      env.material.opacity = blob ? 0.16 : 0.07;

      if (blob) {
        // green dot = the free 3D point (already constrained to the sphere)
        target.position.copy(state.target).add(off);
      } else {
        // green dot = the ACTUAL flange (end-effector), read from the posed model
        j6.getWorldPosition(target.position);
      }
      const aim = state.mode === "aim";
      // ghost (phone) is meaningful in MOVE mode; the aim ray replaces it in AIM
      ghost.visible = !aim && !blob;
      ghost.position.copy(state.target).add(off);
      if (state.quat) ghost.quaternion.copy(state.quat);
      aimRay.visible = aim && !blob;
      if (aim && !blob && state.aimDir) {
        const tip = state.aimDir.clone().multiplyScalar(MAXREACH).add(off);
        rayGeom.setFromPoints([off, tip]);
      }
      // AR: transparent canvas over the camera feed; hide the dark backdrop
      if (state.ar) {
        scene.background = null;
        scene.fog = null;
        grid.visible = false;
        renderer.setClearColor(0x000000, 0);
      } else {
        scene.background = bgColor;
        scene.fog = bgFog;
        grid.visible = true;
        renderer.setClearColor(0x000000, 1);
      }
      // gentle auto-orbit until live (skip in AR — hand drives it)
      controls.autoRotate = !state.live && !state.ar;
      controls.update();
      renderer.render(scene, cam);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      controls.dispose();
      delete state.resetView;
      rayGeom.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [state]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
