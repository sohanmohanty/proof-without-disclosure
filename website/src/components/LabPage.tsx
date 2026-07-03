import type { ReactNode } from "react";

export function LabPage(props: {
  kicker: string;
  title: string;
  question: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="lab-header">
        <div className="lab-kicker">{props.kicker}</div>
        <h1>{props.title}</h1>
        <p className="lab-question">{props.question}</p>
        {props.intro && <div>{props.intro}</div>}
      </div>
      {props.children}
    </>
  );
}

export function Section(props: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="section">
      {props.title && <h2>{props.title}</h2>}
      {props.children}
    </section>
  );
}
