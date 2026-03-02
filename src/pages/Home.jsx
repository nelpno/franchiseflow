import { useEffect } from "react";
import { createPageUrl } from "@/utils";

export default function Home() {
  useEffect(() => {
    window.location.replace(createPageUrl("Dashboard"));
  }, []);

  return null;
}