import { useMemo, useState } from 'react';

type PanelProps = {
  title: string;
  score: number;
};

function HealthPanel({ title, score }: PanelProps) {
  return (
    <section>
      <h2>{title}</h2>
      <p>{score}</p>
    </section>
  );
}

export default function App() {
  const [count, setCount] = useState(2);
  const score = useMemo(() => count * 10, [count]);

  return (
    <main>
      <h1>Architect Fixture</h1>
      <button onClick={() => setCount((value) => value + 1)}>Increment</button>
      <HealthPanel title="Health" score={score} />
    </main>
  );
}