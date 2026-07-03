import type { ReactNode } from "react";

export default function MathAside(props: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <details className="math-aside">
      <summary>{props.title ?? "For the mathematically curious"}</summary>
      <div className="math-body">{props.children}</div>
    </details>
  );
}
