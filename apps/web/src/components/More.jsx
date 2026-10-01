// A calmer way to show secondary things: one small line to open, and everything inside stays hidden until then.
export default function More({ label = "More options", children, open = false, className = "" }) {
  return (
    <details className={"more " + className} open={open}>
      <summary>{label}</summary>
      <div className="more-body">{children}</div>
    </details>
  );
}
