import type { VerifyOutcome } from "../crypto/format";

export default function ResultBanner(props: { outcome: VerifyOutcome | null }) {
  if (!props.outcome) return null;
  const { verdict, title, details } = props.outcome;
  const symbol = verdict === "valid" ? "✓" : verdict === "invalid" ? "✗" : "ℹ";
  return (
    <div className={`banner ${verdict}`} role="status">
      <strong>
        {symbol} {title}
      </strong>
      <ul>
        {details.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
