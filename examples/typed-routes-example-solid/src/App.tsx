import type { ParentProps } from "solid-js";
import { Router } from "./router";
import "./App.css";

export default function App() {
  return (
    <Router>
      {(props: ParentProps) => props.children}
    </Router>
  );
}
