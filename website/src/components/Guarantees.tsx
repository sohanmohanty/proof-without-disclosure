export default function Guarantees(props: {
  does: string[];
  doesnt: string[];
  world: string[];
}) {
  return (
    <div className="guarantees">
      <div className="guarantee-card does">
        <h4>What this guarantees</h4>
        <ul>
          {props.does.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="guarantee-card doesnt">
        <h4>What this does not guarantee</h4>
        <ul>
          {props.doesnt.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div className="guarantee-card world">
        <h4>Where you have seen this</h4>
        <ul>
          {props.world.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
