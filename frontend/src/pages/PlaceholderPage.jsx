import { Link } from "react-router-dom";

export default function PlaceholderPage({ title, text }) {
  return (
    <div className="placeholder">
      <h1>{title}</h1>
      {text && <p className="muted">{text}</p>}
      <Link to="/">← Back to home</Link>
    </div>
  );
}
