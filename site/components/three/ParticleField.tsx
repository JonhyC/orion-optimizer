"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Campo de particulas em Three.js para o fundo do hero.
 *
 * Um unico THREE.Points com material aditivo - milhares de sprites separados
 * matariam a taxa de fotogramas. O campo roda muito devagar e inclina-se com
 * o rato (parallax).
 *
 * Pausa sozinho quando a seccao sai do ecra, para nao gastar GPU a desenhar
 * algo que ninguem ve.
 */
export default function ParticleField({ count = 2600 }: { count?: number }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el || prefersReducedMotion()) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      62,
      el.clientWidth / el.clientHeight,
      0.1,
      1000,
    );
    camera.position.z = 46;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // --- geometria: nuvem elipsoidal, mais densa no centro
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);

    const near = new THREE.Color("#D5BCFF");
    const far = new THREE.Color("#6422C7");

    for (let i = 0; i < count; i++) {
      // Math.cbrt distribui uniformemente por volume; sem isso as particulas
      // amontoam-se todas na casca exterior da esfera.
      const r = 46 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.5;
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.85;
      positions[i * 3 + 2] = r * Math.cos(phi);

      const mix = Math.random();
      const c = near.clone().lerp(far, mix);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      scales[i] = Math.random() * 1.6 + 0.35;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

    const material = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // --- parallax do rato
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };

    const onMouse = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse, { passive: true });

    // --- so anima enquanto estiver visivel
    let visible = true;
    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(el);

    const onResize = () => {
      if (!el.clientWidth || !el.clientHeight) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frame = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!visible) return;

      const t = clock.getElapsedTime();

      current.x += (target.x - current.x) * 0.035;
      current.y += (target.y - current.y) * 0.035;

      points.rotation.y = t * 0.035 + current.x * 0.28;
      points.rotation.x = current.y * 0.2;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [count]);

  return (
    <div
      ref={mount}
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-70"
    />
  );
}
