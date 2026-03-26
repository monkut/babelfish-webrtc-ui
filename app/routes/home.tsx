import { Babelfish } from "../components/Babelfish";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Babelfish" },
    { name: "description", content: "WebRTC voice interface for Babelfish" },
  ];
}

export default function Home() {
  return <Babelfish />;
}
