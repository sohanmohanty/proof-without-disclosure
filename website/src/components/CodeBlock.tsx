export default function CodeBlock(props: { code: string; label?: string }) {
  return (
    <>
      {props.label && <div className="hex-label">{props.label}</div>}
      <pre className="code-block">{props.code.trim()}</pre>
    </>
  );
}
