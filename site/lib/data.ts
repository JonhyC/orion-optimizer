import type { LucideIcon } from "lucide-react";
import {
  Rocket,
  Zap,
  Gamepad2,
  Cpu,
  Flame,
  MonitorCheck,
  ShoppingCart,
  MessagesSquare,
  Wrench,
  Trophy,
} from "lucide-react";

export type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** O que e tocado. Deliberadamente NAO e um ganho prometido: o ganho
   *  depende inteiramente da maquina e so se sabe depois de medir. */
  tag: string;
};

export const features: Feature[] = [
  {
    icon: Rocket,
    title: "More FPS",
    body: "Background load stripped away so the frame budget goes to your game, not to telemetry and update services.",
    tag: "Startup & services",
  },
  {
    icon: Zap,
    title: "Lower Input Lag",
    body: "Exclusive fullscreen, scheduling priority and network stack tuning — every millisecond between mouse and monitor.",
    tag: "Input path",
  },
  {
    icon: Gamepad2,
    title: "Better Gaming Experience",
    body: "Stutter and frame-time spikes flattened. Not just a higher average — a smoother line.",
    tag: "Frame times",
  },
  {
    icon: Cpu,
    title: "CPU Optimization",
    body: "Core parking, power states and MMCSS scheduling tuned so your processor stops throttling mid-fight.",
    tag: "Scheduling & power",
  },
  {
    icon: Flame,
    title: "GPU Performance",
    body: "Hardware-accelerated scheduling and driver-level tuning, matched to your exact card.",
    tag: "Driver level",
  },
  {
    icon: MonitorCheck,
    title: "Cleaner Windows",
    body: "Bloatware, startup clutter and silent installs removed. Every change logged and fully reversible.",
    tag: "Debloat",
  },
];

export type Plan = {
  id: string;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  featured?: boolean;
  cta: string;
};

// Os ids batem certo com os cargos do Discord e com a tabela `plans`:
// comprar um plano e receber o cargo passam a ser a mesma coisa.
export const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 14.99,
    tagline: "The essentials, done properly.",
    cta: "Get Basic",
    features: [
      "Startup & background cleanup",
      "Windows debloat pass",
      "Power plan tuning",
      "System restore point first",
      "Full rollback included",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29.99,
    tagline: "Where most players land.",
    cta: "Get Pro",
    features: [
      "Everything in Basic",
      "CPU scheduling & core parking",
      "GPU driver-level tuning",
      "Network latency pass",
      "Per-game profile setup",
      "30 days of follow-up support",
    ],
  },
  {
    id: "ultimate",
    name: "Ultimate",
    price: 49.99,
    tagline: "Every millisecond, hunted down.",
    featured: true,
    cta: "Get Ultimate",
    features: [
      "Everything in Pro",
      "Full 1-on-1 remote session",
      "Frame-time analysis with PresentMon",
      "Before / after benchmark report",
      "Peripheral & monitor calibration",
      "Priority support, lifetime",
      "Free re-optimization after upgrades",
    ],
  },
];

export type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export const steps: Step[] = [
  {
    icon: ShoppingCart,
    title: "Purchase",
    body: "Pick your package and check out. You get instant access credentials for the Orion client.",
  },
  {
    icon: MessagesSquare,
    title: "Contact on Discord",
    body: "Open a ticket. We look at your specs, your games and what you actually want fixed.",
  },
  {
    icon: Wrench,
    title: "Remote Optimization",
    body: "We take a restore point, then work through your machine live. You watch every change happen.",
  },
  {
    icon: Trophy,
    title: "Enjoy Maximum FPS",
    body: "Benchmarks before and after, in writing. If you ever want it undone, one click reverts everything.",
  },
];

// As avaliacoes e os numeros de prova social NAO vivem aqui: sao lidos da
// base de dados em lib/site-data.ts. Enquanto nao existirem dados reais, o
// site mostra um estado honesto em vez de material inventado.

export type Faq = { q: string; a: string };

export const faqs: Faq[] = [
  {
    q: "Is this safe for my PC?",
    a: "Yes, by design. We take a system restore point before touching anything, log every single change, and ship a one-click rollback. We never disable Windows Defender, Windows Update, or any service the system needs to boot — those aren't hidden options, they simply don't exist in our toolset.",
  },
  {
    q: "Will this get me banned from games?",
    a: "No. We never inject into, suspend, or hook a running game process, and we never install kernel drivers — those are the behaviours anti-cheat systems like Vanguard, EAC and BattlEye flag. Every change is applied before the game launches, at the operating system level.",
  },
  {
    q: "What FPS gain can I actually expect?",
    a: "Honestly: we don't know until we look at your machine, and we're not going to invent a percentage to close a sale. It depends on your hardware and how loaded your Windows install already is — a neglected machine has far more to recover than a clean one, and the gain often shows up in 1% lows rather than average FPS. Send us your specs on Discord and we'll give you our estimate before you pay anything.",
  },
  {
    q: "Do you use RAM cleaners or registry cleaners?",
    a: "No, and we'll actively talk you out of them. RAM cleaners force Windows to dump cached data it needs, making things slower while showing a satisfying graph. Registry cleaners have no measurable effect. Selling those would be easy money and we don't do it.",
  },
  {
    q: "Can I undo everything?",
    a: "Completely. Every value we change is recorded with its original state before we write anything — including whether the setting existed at all, which is the part most tools get wrong. One click restores your machine exactly as it was.",
  },
  {
    q: "Do I need to be there during the session?",
    a: "For Basic, no — it runs from the client. For Pro and Ultimate we do it together over Discord so you can see each change, ask why, and stop us at any point.",
  },
  {
    q: "What if it doesn't help?",
    a: "We benchmark before and after, and you get the numbers in writing. If there's no measurable improvement on your machine, you get your money back and we roll everything back.",
  },
];

export const DISCORD_URL = "https://discord.gg/7DcjHq5jfU";
