/** Monospace digest display; when `diffAgainst` is given, characters that
 * differ are highlighted — the avalanche effect made visible. */
export default function HexDigest(props: {
  value: string;
  label?: string;
  diffAgainst?: string;
}) {
  const { value, diffAgainst } = props;
  return (
    <>
      {props.label && <div className="hex-label">{props.label}</div>}
      <div className="hex">
        {diffAgainst && diffAgainst.length === value.length
          ? [...value].map((ch, i) => (
              <span key={i} className={ch !== diffAgainst[i] ? "diff" : ""}>
                {ch}
              </span>
            ))
          : value}
      </div>
    </>
  );
}
